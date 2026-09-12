import uuid

from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils.text import slugify
from openai import APIError
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .csv_import import CsvImportError, build_product_csv, parse_product_csv
from .deepseek import DeepSeekError, generate_product_copy
from .models import Integration, Product, Profile, PromptTemplate, Tariff, UserSubscription
from .permissions import IsAdminOrReadOnly, IsOwnerOrReadOnly, is_admin
from .providers import ProviderError, fetch_available_models
from .serializers import (
    GenerateProductSerializer,
    IntegrationSerializer,
    LoginSerializer,
    ProductCsvExportSerializer,
    ProductCsvImportSerializer,
    ProductSerializer,
    ProfileSerializer,
    PromptTemplateSerializer,
    RegisterSerializer,
    SubscribeSerializer,
    TariffSerializer,
    UserSubscriptionSerializer,
    user_payload,
)
from .subscriptions import (
    apply_tariff_purchase,
    consume_generation_slot,
    consume_product_slot,
    consume_profile_slot,
    ensure_key_mode_allowed,
    get_active_subscription,
)


@api_view(["GET"])
def health(_request: Request) -> Response:
    return Response({"status": "ok"})


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            return Response(
                {"detail": "Invalid username or password"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, **user_payload(user)})


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, **user_payload(user)}, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        return Response(user_payload(request.user))


class IntegrationViewSet(ModelViewSet):
    serializer_class = IntegrationSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    def get_permissions(self):
        if self.action == "available_models":
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminOrReadOnly()]

    def get_queryset(self):
        queryset = Integration.objects.all()
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            queryset = queryset.filter(is_active=True)
        return queryset

    @action(detail=False, methods=["post"], url_path="available-models")
    def available_models(self, request: Request) -> Response:
        api_url = (request.data.get("api_url") or "").strip()
        api_key = (request.data.get("api_key") or "").strip()
        integration_id = request.data.get("integration")
        profile_id = request.data.get("profile")

        if profile_id not in (None, ""):
            profile = (
                Profile.objects.select_related("integration")
                .filter(pk=profile_id)
                .filter(Q(user=request.user) | Q(user__isnull=True))
                .first()
            )
            if profile is None:
                return Response({"detail": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)
            if not api_key:
                try:
                    api_key = profile.resolve_api_key()
                except ValueError:
                    if profile.user_id == request.user.id and profile.DeepSeekApiKey:
                        api_key = profile.DeepSeekApiKey
            if integration_id in (None, "") and profile.integration_id:
                integration_id = profile.integration_id

        if integration_id not in (None, ""):
            integration = self.get_queryset().filter(pk=integration_id).first()
            if integration is None:
                return Response({"detail": "Integration not found."}, status=status.HTTP_404_NOT_FOUND)
            api_url = integration.api_url
            if not api_key and integration.api_key:
                api_key = integration.api_key
        elif not api_url:
            return Response({"detail": "API URL is required."}, status=status.HTTP_400_BAD_REQUEST)
        elif not is_admin(request.user):
            return Response({"detail": "Only staff can preview an unsaved API URL."}, status=status.HTTP_403_FORBIDDEN)

        try:
            models = fetch_available_models(api_url=api_url, api_key=api_key)
        except ProviderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"models": models})


class PromptTemplateViewSet(ModelViewSet):
    serializer_class = PromptTemplateSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        return PromptTemplate.objects.filter(is_active=True).filter(
            Q(owner=self.request.user) | Q(owner__isnull=True)
        )

    def perform_create(self, serializer):
        title = serializer.validated_data["title"]
        base = slugify(title) or "prompt"
        slug = f"{base}-{self.request.user.id}-{uuid.uuid4().hex[:8]}"
        serializer.save(owner=self.request.user, slug=slug)


class ProfileViewSet(ModelViewSet):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        return Profile.objects.select_related("integration").filter(
            Q(user=self.request.user) | Q(user__isnull=True)
        )

    @transaction.atomic
    def perform_create(self, serializer):
        consume_profile_slot(self.request.user)
        serializer.save(user=self.request.user)


class ProductViewSet(ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        return Product.objects.select_related("profile", "profile__integration").filter(
            Q(profile__user=self.request.user) | Q(profile__user__isnull=True)
        )

    @transaction.atomic
    def perform_create(self, serializer):
        consume_product_slot(self.request.user, count=1)
        serializer.save()

    @action(detail=False, methods=["post"], url_path="import", parser_classes=[MultiPartParser, FormParser])
    def import_csv(self, request: Request) -> Response:
        serializer = ProductCsvImportSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        profile = serializer.validated_data["profile"]
        uploaded = serializer.validated_data["file"]

        try:
            payload, parse_errors = parse_product_csv(uploaded.read())
        except CsvImportError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if payload:
            try:
                consume_product_slot(request.user, count=len(payload))
            except ValidationError as exc:
                return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        created = Product.objects.bulk_create(
            [Product(profile=profile, **fields) for fields in payload],
            batch_size=500,
        )
        return Response(
            {
                "created": len(created),
                "skipped": len(parse_errors),
                "errors": parse_errors[:50],
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="export")
    def export_csv(self, request: Request) -> HttpResponse:
        serializer = ProductCsvExportSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        profile = serializer.validated_data["profile"]
        ids = serializer.validated_data.get("ids")

        queryset = self.get_queryset().filter(profile=profile).order_by("id")
        if ids is not None:
            queryset = queryset.filter(id__in=ids)
            found = set(queryset.values_list("id", flat=True))
            missing = [product_id for product_id in ids if product_id not in found]
            if missing:
                return Response(
                    {"detail": f"Products not found in this profile: {', '.join(map(str, missing))}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        products = list(queryset)
        if not products:
            return Response({"detail": "No products to export."}, status=status.HTTP_400_BAD_REQUEST)

        response = HttpResponse(build_product_csv(products), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="products-profile-{profile.id}.csv"'
        return response

    @action(detail=True, methods=["post"])
    def generate(self, request: Request, pk=None) -> Response:
        product = self.get_object()
        payload = GenerateProductSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        custom_prompt = (payload.validated_data.get("prompt") or "").strip()
        system_prompt = custom_prompt or product.profile.get_system_prompt()

        try:
            ensure_key_mode_allowed(request.user, product.profile.key_mode)
            if product.profile.key_mode == Profile.KeyMode.PLATFORM:
                subscription = get_active_subscription(request.user)
                if subscription is None:
                    raise ValidationError({"detail": "Choose a tariff first."})
                if subscription.generation_usage >= subscription.generation_limit:
                    raise ValidationError(
                        {"detail": "Generation limit reached. Buy more capacity or upgrade."}
                    )
            integration = product.profile.integration
            result = generate_product_copy(
                api_key=product.profile.resolve_api_key(),
                system_prompt=system_prompt,
                title=product.title,
                base_url=integration.api_url if integration else None,
                model=product.profile.get_generation_model() or None,
            )
            if product.profile.key_mode == Profile.KeyMode.PLATFORM:
                consume_generation_slot(request.user)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except DeepSeekError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except APIError as exc:
            if getattr(exc, "status_code", None) == 402:
                return Response(
                    {
                        "detail": (
                            "The selected API account does not have enough funds. "
                            "Top up the balance and try again."
                        )
                    },
                    status=status.HTTP_402_PAYMENT_REQUIRED,
                )
            return Response(
                {"detail": f"API request failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        product.description = result["description"]
        product.short_description = result["short_description"]
        product.meta_title = result["meta_title"]
        product.meta_description = result["meta_description"]
        product.bullet_points = result["bullet_points"]
        product.tags = result["tags"]
        product.product_type = result["product_type"]
        product.google_product_category = result["google_product_category"]
        product.google_product_category_path = result["google_product_category_path"]
        product.save(
            update_fields=[
                "description",
                "short_description",
                "meta_title",
                "meta_description",
                "bullet_points",
                "tags",
                "product_type",
                "google_product_category",
                "google_product_category_path",
            ]
        )
        return Response(self.get_serializer(product).data)


class TariffViewSet(ModelViewSet):
    serializer_class = TariffSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = Tariff.objects.all()
        if not is_admin(self.request.user):
            queryset = queryset.filter(is_active=True)
        return queryset


class UserSubscriptionViewSet(ReadOnlyModelViewSet):
    serializer_class = UserSubscriptionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserSubscription.objects.select_related("tariff").filter(user=self.request.user)

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request: Request) -> Response:
        subscription = get_active_subscription(request.user)
        if subscription is None:
            return Response({"detail": "No active subscription."}, status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(subscription).data)

    @action(detail=False, methods=["post"], url_path="subscribe")
    def subscribe(self, request: Request) -> Response:
        serializer = SubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subscription = apply_tariff_purchase(request.user, serializer.validated_data["tariff"])
        return Response(UserSubscriptionSerializer(subscription).data, status=status.HTTP_200_OK)
