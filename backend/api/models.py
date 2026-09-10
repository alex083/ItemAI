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
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.model})"


class Profile(models.Model):
    title = models.CharField(max_length=200)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name="profile")
    integration = models.ForeignKey(
        Integration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="profiles",
    )
    DeepSeekApiKey = models.CharField(max_length=200)
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

class Product(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="product")
    google_product_category = models.CharField(max_length=200, blank=True)
    external_id = models.CharField(max_length=200, blank=True)
    barcode = models.CharField(max_length=200, blank=True)
    group_id = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.title

    class Meta:
        ordering = ["-created_at", "title", "google_product_category", "profile"]

