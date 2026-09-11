from rest_framework import serializers

from .models import Integration, Product, Profile, PromptTemplate, User


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
    class Meta:
        model = Integration
        fields = ("id", "name", "api_url", "model", "is_active")
        read_only_fields = ("id",)


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
        key = attrs.get("DeepSeekApiKey")
        if self.instance is None and not key:
            raise serializers.ValidationError({"DeepSeekApiKey": "This field is required."})
        if self.instance is None and not attrs.get("integration"):
            raise serializers.ValidationError({"integration": "This field is required."})
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
            "profile",
            "google_product_category",
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

