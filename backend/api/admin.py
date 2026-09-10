from django.contrib import admin

from .models import Integration, Product, Profile, PromptTemplate, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "created_at")
    search_fields = ("username", "email")


@admin.register(PromptTemplate)
class PromptTemplateAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "slug", "owner", "is_active")
    search_fields = ("title", "slug")
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Integration)
class IntegrationAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "model", "api_url", "is_active")
    search_fields = ("name", "model", "api_url")


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "user", "integration", "prompt_template", "created_at")
    search_fields = ("title",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "profile", "created_at")
    search_fields = ("title",)
