from django.contrib import admin

from .models import Integration, Product, ProductImage, Profile, PromptTemplate, Tariff, User, UserSubscription


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
    list_display = ("id", "name", "model", "image_model", "api_url", "has_api_key", "is_platform_default", "is_active")
    search_fields = ("name", "model", "image_model", "api_url")
    list_filter = ("is_active", "is_platform_default")
    fields = ("name", "api_url", "model", "image_model", "api_key", "is_platform_default", "is_active")

    @admin.display(boolean=True, description="Built-in key")
    def has_api_key(self, obj: Integration) -> bool:
        return bool(obj.api_key)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "user", "integration", "key_mode", "model", "image_model", "prompt_template", "created_at")
    search_fields = ("title", "model", "image_model")
    list_filter = ("key_mode",)
    fields = (
        "title",
        "user",
        "integration",
        "key_mode",
        "model",
        "image_model",
        "DeepSeekApiKey",
        "prompt_template",
        "Prompt",
        "image_prompt",
    )


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0
    fields = ("image", "source", "is_primary", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "product_type", "profile", "created_at")
    search_fields = ("title", "tags", "product_type", "external_id")
    inlines = [ProductImageInline]


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ("id", "product", "source", "is_primary", "created_at")
    list_filter = ("source", "is_primary")


@admin.register(Tariff)
class TariffAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "price",
        "keypolicy",
        "number_of_products",
        "number_of_profiles",
        "number_of_generations",
        "number_of_image_generations",
        "is_active",
    )
    list_filter = ("keypolicy", "is_active")
    search_fields = ("title",)


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "tariff",
        "keypolicy",
        "product_usage",
        "product_limit",
        "profile_usage",
        "profile_limit",
        "generation_usage",
        "generation_limit",
        "image_generation_usage",
        "image_generation_limit",
        "is_active",
        "start_date",
    )
    list_filter = ("keypolicy", "is_active")
    search_fields = ("user__username", "tariff__title")
