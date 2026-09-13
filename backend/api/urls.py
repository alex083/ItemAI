from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BackgroundJobViewSet,
    IntegrationViewSet,
    LoginView,
    MeView,
    ProductImageViewSet,
    ProductViewSet,
    ProfileViewSet,
    PromptTemplateViewSet,
    RegisterView,
    TariffViewSet,
    UserSubscriptionViewSet,
    health,
)

router = DefaultRouter()
router.register("integrations", IntegrationViewSet, basename="integration")
router.register("prompt-templates", PromptTemplateViewSet, basename="prompt-template")
router.register("profiles", ProfileViewSet, basename="profile")
router.register("products", ProductViewSet, basename="product")
router.register("product-images", ProductImageViewSet, basename="product-image")
router.register("tariffs", TariffViewSet, basename="tariff")
router.register("subscriptions", UserSubscriptionViewSet, basename="subscription")
router.register("jobs", BackgroundJobViewSet, basename="job")

urlpatterns = [
    path("health/", health, name="health"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("", include(router.urls)),
]
