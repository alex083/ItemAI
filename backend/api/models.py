import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .prompts import DEFAULT_PRODUCT_PROMPT


class User(AbstractUser):
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.username

    class Meta:
        ordering = ["-created_at", "username", "email"]


class PromptTemplate(models.Model):
    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=200)
    body = models.TextField()
    owner = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name="prompt_templates")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["title"]

    def __str__(self) -> str:
        return self.title


class Integration(models.Model):
    name = models.CharField(max_length=200, unique=True)
    api_url = models.URLField(max_length=500)
    model = models.CharField(max_length=300, blank=True)
    image_model = models.CharField(max_length=300, blank=True)
    # Built-in platform key (admin-only). Never expose via API responses.
    api_key = models.CharField(max_length=500, blank=True)
    is_platform_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.model})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_platform_default:
            type(self).objects.exclude(pk=self.pk).filter(is_platform_default=True).update(
                is_platform_default=False
            )


class Profile(models.Model):
    class KeyMode(models.TextChoices):
        PLATFORM = "platform", "Platform key"
        BYOK = "byok", "Bring your own key"

    title = models.CharField(max_length=200)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name="profile")
    integration = models.ForeignKey(
        Integration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="profiles",
    )
    key_mode = models.CharField(
        max_length=20,
        choices=KeyMode.choices,
        default=KeyMode.PLATFORM,
    )
    DeepSeekApiKey = models.CharField(max_length=200, blank=True)
    model = models.CharField(max_length=300, blank=True)
    image_model = models.CharField(max_length=300, blank=True)
    prompt_template = models.ForeignKey(
        PromptTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="profiles",
    )
    Prompt = models.TextField(blank=True)
    image_prompt = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.title

    def get_system_prompt(self) -> str:
        custom = self.Prompt.strip()
        if custom:
            return custom
        if self.prompt_template_id:
            return self.prompt_template.body
        return DEFAULT_PRODUCT_PROMPT

    def get_generation_model(self) -> str:
        if self.model.strip():
            return self.model.strip()
        if self.integration_id and self.integration.model:
            return self.integration.model
        return ""

    def get_image_model(self) -> str:
        if self.image_model.strip():
            return self.image_model.strip()
        if self.integration_id and self.integration.image_model:
            return self.integration.image_model.strip()
        return ""

    def get_image_prompt(self) -> str:
        return self.image_prompt.strip()

    def resolve_api_key(self) -> str:
        if self.key_mode == self.KeyMode.PLATFORM:
            if self.integration_id and self.integration.api_key.strip():
                return self.integration.api_key.strip()
            raise ValueError(
                "This profile uses the platform key, but the selected integration has no built-in key. "
                "Ask an admin to add one, or switch to your own API key."
            )
        key = self.DeepSeekApiKey.strip()
        if key:
            return key
        raise ValueError("Profile has no API key. Add your own key in profile settings.")


class Product(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    short_description = models.TextField(blank=True)
    meta_title = models.CharField(max_length=200, blank=True)
    meta_description = models.CharField(max_length=320, blank=True)
    bullet_points = models.JSONField(default=list, blank=True)
    tags = models.CharField(max_length=500, blank=True)
    product_type = models.CharField(max_length=200, blank=True)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="product")
    google_product_category = models.CharField(max_length=200, blank=True)
    google_product_category_path = models.CharField(max_length=500, blank=True)
    external_id = models.CharField(max_length=200, blank=True)
    barcode = models.CharField(max_length=200, blank=True)
    group_id = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.title

    class Meta:
        ordering = ["-created_at", "title", "google_product_category", "profile"]


def product_image_upload_path(instance: "ProductImage", filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    return f"products/{instance.product_id}/{uuid.uuid4().hex}.{ext}"


class ProductImage(models.Model):
    class Source(models.TextChoices):
        GENERATED = "generated", "Generated"
        UPLOADED = "uploaded", "Uploaded"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to=product_image_upload_path)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.UPLOADED)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_primary", "-created_at"]

    def __str__(self) -> str:
        return f"Image #{self.pk} for product #{self.product_id}"


@receiver(post_delete, sender=ProductImage)
def _delete_product_image_file(sender, instance: "ProductImage", **kwargs) -> None:
    """Always remove the file from storage, including cascade deletes from Product/Profile."""
    if instance.image:
        instance.image.delete(save=False)


class Tariff(models.Model):
    class KeyPolicy(models.TextChoices):
        HYBRID = "hybrid", "Hybrid"
        PLATFORM_KEY = "platform_key", "Platform Key"
        BYOK = "byok", "BYOK"

    keypolicy = models.CharField(
        max_length=20,
        choices=KeyPolicy.choices,
        default=KeyPolicy.HYBRID,
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    number_of_products = models.IntegerField()
    number_of_profiles = models.IntegerField()
    number_of_generations = models.IntegerField()
    number_of_image_generations = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["title", "price"]

    def __str__(self) -> str:
        return self.title


class UserSubscription(models.Model):
    class KeyPolicy(models.TextChoices):
        HYBRID = "hybrid", "Hybrid"
        PLATFORM_KEY = "platform_key", "Platform Key"
        BYOK = "byok", "BYOK"

    keypolicy = models.CharField(
        max_length=20,
        choices=KeyPolicy.choices,
        default=KeyPolicy.HYBRID,
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="subscriptions")
    tariff = models.ForeignKey(Tariff, on_delete=models.CASCADE, related_name="subscriptions")
    product_limit = models.IntegerField()
    profile_limit = models.IntegerField()
    generation_limit = models.IntegerField()
    image_generation_limit = models.IntegerField(default=0)
    product_usage = models.IntegerField(default=0)
    profile_usage = models.IntegerField(default=0)
    generation_usage = models.IntegerField(default=0)
    image_generation_usage = models.IntegerField(default=0)
    start_date = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-start_date", "tariff"]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.tariff.title}"


def background_job_result_path(instance: "BackgroundJob", filename: str) -> str:
    return f"jobs/{instance.user_id}/{uuid.uuid4().hex}_{filename}"


class BackgroundJob(models.Model):
    class JobType(models.TextChoices):
        GENERATE_COPY = "generate_copy", "Generate descriptions"
        GENERATE_IMAGES = "generate_images", "Generate images"
        EXPORT_CSV = "export_csv", "Export CSV"

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    class Stage(models.TextChoices):
        QUEUED = "queued", "Waiting in queue"
        PREPARING = "preparing", "Preparing"
        PROCESSING = "processing", "Processing items"
        FINALIZING = "finalizing", "Finalizing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="background_jobs")
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="background_jobs")
    job_type = models.CharField(max_length=32, choices=JobType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED, db_index=True)
    stage = models.CharField(max_length=20, choices=Stage.choices, default=Stage.QUEUED)
    stage_message = models.CharField(max_length=500, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    product_ids = models.JSONField(default=list, blank=True)
    total_count = models.PositiveIntegerField(default=0)
    processed_count = models.PositiveIntegerField(default=0)
    success_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    cancel_requested = models.BooleanField(default=False)
    error = models.TextField(blank=True)
    result_file = models.FileField(upload_to=background_job_result_path, blank=True)
    celery_task_id = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Job #{self.pk} {self.job_type} ({self.status})"

    @property
    def progress_percent(self) -> int:
        if self.total_count <= 0:
            if self.status == self.Status.SUCCEEDED:
                return 100
            if self.status in {self.Status.QUEUED, self.Status.RUNNING}:
                return 0
            return 0
        return min(100, int(round((self.processed_count / self.total_count) * 100)))
