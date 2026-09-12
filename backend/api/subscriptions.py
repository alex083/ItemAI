from __future__ import annotations

from django.db import transaction
from django.db.models import F
from rest_framework.exceptions import ValidationError

from .models import Profile, Tariff, UserSubscription

# Profile.key_mode uses "platform" / "byok"
# Subscription/Tariff.keypolicy uses "hybrid" / "platform_key" / "byok"


def get_active_subscription(user) -> UserSubscription | None:
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    return user.subscriptions.filter(is_active=True).order_by("-start_date").first()


def key_mode_allowed(keypolicy: str, key_mode: str) -> bool:
    if keypolicy == "hybrid":
        return key_mode in (Profile.KeyMode.PLATFORM, Profile.KeyMode.BYOK)
    if keypolicy == "platform_key":
        return key_mode == Profile.KeyMode.PLATFORM
    if keypolicy == "byok":
        return key_mode == Profile.KeyMode.BYOK
    return False


def merge_keypolicy(current: str | None, incoming: str) -> str:
    policies = {current, incoming} - {None, ""}
    if "hybrid" in policies or policies == {"platform_key", "byok"}:
        return "hybrid"
    if "byok" in policies and len(policies) == 1:
        return "byok"
    if "platform_key" in policies and len(policies) == 1:
        return "platform_key"
    return incoming


def require_active_subscription(user) -> UserSubscription:
    subscription = get_active_subscription(user)
    if subscription is None:
        raise ValidationError({"detail": "Choose a tariff first."})
    return subscription


def ensure_key_mode_allowed(user, key_mode: str) -> UserSubscription:
    subscription = require_active_subscription(user)
    if not key_mode_allowed(subscription.keypolicy, key_mode):
        raise ValidationError(
            {
                "key_mode": (
                    f"Your plan ({subscription.keypolicy}) does not allow "
                    f"key mode “{key_mode}”."
                )
            }
        )
    return subscription


@transaction.atomic
def apply_tariff_purchase(user, tariff: Tariff) -> UserSubscription:
    subscription = (
        user.subscriptions.select_for_update().filter(is_active=True).order_by("-start_date").first()
    )
    if subscription is None:
        return UserSubscription.objects.create(
            user=user,
            tariff=tariff,
            keypolicy=tariff.keypolicy,
            product_limit=tariff.number_of_products,
            profile_limit=tariff.number_of_profiles,
            generation_limit=tariff.number_of_generations,
            product_usage=0,
            profile_usage=0,
            generation_usage=0,
            is_active=True,
        )

    subscription.tariff = tariff
    subscription.keypolicy = merge_keypolicy(subscription.keypolicy, tariff.keypolicy)
    subscription.product_limit = F("product_limit") + tariff.number_of_products
    subscription.profile_limit = F("profile_limit") + tariff.number_of_profiles
    subscription.generation_limit = F("generation_limit") + tariff.number_of_generations
    subscription.is_active = True
    subscription.save(
        update_fields=[
            "tariff",
            "keypolicy",
            "product_limit",
            "profile_limit",
            "generation_limit",
            "is_active",
        ]
    )
    subscription.refresh_from_db()
    return subscription


@transaction.atomic
def consume_profile_slot(user) -> UserSubscription:
    subscription = (
        user.subscriptions.select_for_update().filter(is_active=True).order_by("-start_date").first()
    )
    if subscription is None:
        raise ValidationError({"detail": "Choose a tariff first."})
    if subscription.profile_usage >= subscription.profile_limit:
        raise ValidationError({"detail": "Profile limit reached. Buy more capacity or upgrade."})
    subscription.profile_usage = F("profile_usage") + 1
    subscription.save(update_fields=["profile_usage"])
    subscription.refresh_from_db()
    return subscription


@transaction.atomic
def consume_product_slot(user, count: int = 1) -> UserSubscription:
    if count < 1:
        raise ValidationError({"detail": "Nothing to create."})
    subscription = (
        user.subscriptions.select_for_update().filter(is_active=True).order_by("-start_date").first()
    )
    if subscription is None:
        raise ValidationError({"detail": "Choose a tariff first."})
    if subscription.product_usage + count > subscription.product_limit:
        raise ValidationError({"detail": "Product limit reached. Buy more capacity or upgrade."})
    subscription.product_usage = F("product_usage") + count
    subscription.save(update_fields=["product_usage"])
    subscription.refresh_from_db()
    return subscription


@transaction.atomic
def consume_generation_slot(user) -> UserSubscription:
    subscription = (
        user.subscriptions.select_for_update().filter(is_active=True).order_by("-start_date").first()
    )
    if subscription is None:
        raise ValidationError({"detail": "Choose a tariff first."})
    if subscription.generation_usage >= subscription.generation_limit:
        raise ValidationError({"detail": "Generation limit reached. Buy more capacity or upgrade."})
    subscription.generation_usage = F("generation_usage") + 1
    subscription.save(update_fields=["generation_usage"])
    subscription.refresh_from_db()
    return subscription
