from rest_framework import permissions


class IsCustomer(permissions.BasePermission):
    """Allow access only to customers."""

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == 'customer'
        )


class IsAgent(permissions.BasePermission):
    """Allow access only to agents."""

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == 'agent'
        )


class IsOwnerOrAgent(permissions.BasePermission):
    """Allow access to the owner of the object or agents."""

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'agent':
            return True
        if hasattr(obj, 'customer'):
            return obj.customer == request.user
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return False
