from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    IntegrationViewSet,
    LoginView,
    MeView,
    ProductViewSet,
    ProfileViewSet,
    PromptTemplateViewSet,
    RegisterView,
    health,
)

router = DefaultRouter()
router.register("integrations", IntegrationViewSet, basename="integration")
router.register("prompt-templates", PromptTemplateViewSet, basename="prompt-template")
router.register("profiles", ProfileViewSet, basename="profile")
router.register("products", ProductViewSet, basename="product")

urlpatterns = [
    path("health/", health, name="health"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("", include(router.urls)),
]
