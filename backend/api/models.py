from django.contrib.auth.models import AbstractUser
from django.db import models

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
    prompt_template = models.ForeignKey(
        PromptTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="profiles",
    )
    Prompt = models.TextField(blank=True)
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
    product_usage = models.IntegerField(default=0)
    profile_usage = models.IntegerField(default=0)
    generation_usage = models.IntegerField(default=0)
    start_date = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-start_date", "tariff"]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.tariff.title}"
