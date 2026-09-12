from rest_framework import serializers

from .models import Integration, Product, Profile, PromptTemplate, User, Tariff, UserSubscription


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password")
        read_only_fields = ("id",)

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )


def user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_staff": bool(user.is_staff or user.is_superuser),
    }


class IntegrationSerializer(serializers.ModelSerializer):
    has_api_key = serializers.SerializerMethodField()

    class Meta:
        model = Integration
        fields = (
            "id",
            "name",
            "api_url",
            "model",
            "api_key",
            "has_api_key",
            "is_platform_default",
            "is_active",
        )
        read_only_fields = ("id", "has_api_key")
        extra_kwargs = {
            "api_key": {"write_only": True, "required": False, "allow_blank": True},
            "model": {"required": False, "allow_blank": True},
        }

    def get_has_api_key(self, obj: Integration) -> bool:
        return bool(obj.api_key)

    def update(self, instance, validated_data):
        if not validated_data.get("api_key"):
            validated_data.pop("api_key", None)
        return super().update(instance, validated_data)


def _request_user_id(serializer) -> int | None:
    request = serializer.context.get("request")
    if request and request.user and request.user.is_authenticated:
        return request.user.id
    return None


class PromptTemplateSerializer(serializers.ModelSerializer):
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = PromptTemplate
        fields = ("id", "slug", "title", "body", "owner", "can_edit")
        read_only_fields = ("id", "slug", "owner", "can_edit")

    def get_can_edit(self, obj: PromptTemplate) -> bool:
        return obj.owner_id is not None and obj.owner_id == _request_user_id(self)


class ProfileSerializer(serializers.ModelSerializer):
    has_deepseek_key = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = (
            "id",
            "title",
            "user",
            "integration",
            "key_mode",
            "model",
            "DeepSeekApiKey",
            "prompt_template",
            "Prompt",
            "has_deepseek_key",
            "can_edit",
        )
        read_only_fields = ("id", "user", "has_deepseek_key", "can_edit")
        extra_kwargs = {
            "model": {"required": False, "allow_blank": True},
            "DeepSeekApiKey": {"write_only": True, "required": False, "allow_blank": True},
            "key_mode": {"required": False},
        }

    def get_has_deepseek_key(self, obj: Profile) -> bool:
        return bool(obj.DeepSeekApiKey)

    def get_can_edit(self, obj: Profile) -> bool:
        return obj.user_id is not None and obj.user_id == _request_user_id(self)

    def validate_integration(self, integration: Integration) -> Integration:
        if integration and not integration.is_active:
            raise serializers.ValidationError("This integration is not active.")
        return integration

    def validate(self, attrs):
        instance = self.instance
        key_mode = attrs.get("key_mode")
        if key_mode is None:
            key_mode = instance.key_mode if instance else Profile.KeyMode.PLATFORM

        integration = attrs.get("integration")
        if integration is None and instance is not None:
            integration = instance.integration

        if self.instance is None and not integration:
            raise serializers.ValidationError({"integration": "This field is required."})

        request = self.context.get("request")
        user = request.user if request and request.user and request.user.is_authenticated else None
        if user is not None:
            from .subscriptions import ensure_key_mode_allowed

            ensure_key_mode_allowed(user, key_mode)

        if key_mode == Profile.KeyMode.PLATFORM:
            if integration and not integration.api_key:
                raise serializers.ValidationError(
                    {
                        "integration": (
                            "This integration has no built-in platform key. "
                            "Choose another integration or use your own API key."
                        )
                    }
                )
        elif key_mode == Profile.KeyMode.BYOK:
            key = attrs.get("DeepSeekApiKey")
            has_existing = bool(instance and instance.DeepSeekApiKey)
            if self.instance is None and not key:
                raise serializers.ValidationError({"DeepSeekApiKey": "This field is required for your own key."})
            if self.instance is not None and "DeepSeekApiKey" in attrs and not key and not has_existing:
                raise serializers.ValidationError({"DeepSeekApiKey": "This field is required for your own key."})

        return attrs

    def update(self, instance, validated_data):
        if not validated_data.get("DeepSeekApiKey"):
            validated_data.pop("DeepSeekApiKey", None)
        return super().update(instance, validated_data)


class ProductSerializer(serializers.ModelSerializer):
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "title",
            "description",
            "short_description",
            "meta_title",
            "meta_description",
            "bullet_points",
            "tags",
            "product_type",
            "profile",
            "google_product_category",
            "google_product_category_path",
            "external_id",
            "barcode",
            "group_id",
            "created_at",
            "can_edit",
        )
        read_only_fields = ("id", "created_at", "can_edit")

    def get_can_edit(self, obj: Product) -> bool:
        return obj.profile.user_id is not None and obj.profile.user_id == _request_user_id(self)

    def validate_profile(self, profile: Profile) -> Profile:
        request = self.context["request"]
        if profile.user_id != request.user.id:
            raise serializers.ValidationError("You can only use your own profile.")
        return profile

    def validate(self, attrs):
        if self.instance is None:
            request = self.context.get("request")
            if request and request.user and request.user.is_authenticated:
                from .subscriptions import require_active_subscription

                subscription = require_active_subscription(request.user)
                if subscription.product_usage >= subscription.product_limit:
                    raise serializers.ValidationError(
                        {"detail": "Product limit reached. Buy more capacity or upgrade."}
                    )
        return attrs


class GenerateProductSerializer(serializers.Serializer):
    prompt = serializers.CharField(required=False, allow_blank=True)


class ProductCsvImportSerializer(serializers.Serializer):
    profile = serializers.PrimaryKeyRelatedField(queryset=Profile.objects.all())
    file = serializers.FileField()

    def validate_profile(self, profile: Profile) -> Profile:
        request = self.context["request"]
        if profile.user_id != request.user.id:
            raise serializers.ValidationError("You can only use your own profile.")
        return profile

    def validate_file(self, uploaded):
        name = (getattr(uploaded, "name", "") or "").lower()
        if name and not name.endswith(".csv"):
            raise serializers.ValidationError("Upload a .csv file.")
        size = getattr(uploaded, "size", 0) or 0
        if size > 5 * 1024 * 1024:
            raise serializers.ValidationError("CSV is too large (max 5 MB).")
        return uploaded


class ProductCsvExportSerializer(serializers.Serializer):
    profile = serializers.PrimaryKeyRelatedField(queryset=Profile.objects.all())
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=False,
    )

    def validate_profile(self, profile: Profile) -> Profile:
        request = self.context["request"]
        if profile.user_id not in (None, request.user.id):
            raise serializers.ValidationError("You do not have access to this profile.")
        return profile

class TariffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tariff
        fields = (
            "id",
            "title",
            "description",
            "price",
            "keypolicy",
            "number_of_products",
            "number_of_profiles",
            "number_of_generations",
            "is_active",
        )
        read_only_fields = ("id",)

    def create(self, validated_data):
        request = self.context.get("request")
        if not request or not (request.user.is_staff or request.user.is_superuser):
            raise serializers.ValidationError("Only staff can create tariffs.")
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context.get("request")
        if not request or not (request.user.is_staff or request.user.is_superuser):
            raise serializers.ValidationError("Only staff can update tariffs.")
        return super().update(instance, validated_data)


class UserSubscriptionSerializer(serializers.ModelSerializer):
    tariff_title = serializers.CharField(source="tariff.title", read_only=True)

    class Meta:
        model = UserSubscription
        fields = (
            "id",
            "user",
            "tariff",
            "tariff_title",
            "keypolicy",
            "product_limit",
            "profile_limit",
            "generation_limit",
            "product_usage",
            "profile_usage",
            "generation_usage",
            "start_date",
            "end_date",
            "is_active",
        )
        read_only_fields = fields


class SubscribeSerializer(serializers.Serializer):
    tariff = serializers.PrimaryKeyRelatedField(queryset=Tariff.objects.filter(is_active=True))
