from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Product, ProductImage, Profile, PromptTemplate


def is_admin(user) -> bool:
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


class IsOwnerOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True
        if isinstance(obj, Profile):
            return obj.user_id == request.user.id
        if isinstance(obj, PromptTemplate):
            return obj.owner_id == request.user.id
        if isinstance(obj, Product):
            return obj.profile.user_id == request.user.id
        if isinstance(obj, ProductImage):
            return obj.product.profile.user_id == request.user.id
        return False


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return is_admin(request.user)
