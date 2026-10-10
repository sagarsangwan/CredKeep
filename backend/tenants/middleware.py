from django.db import connection, DatabaseError
from django.core.exceptions import PermissionDenied, ObjectDoesNotExist

class TenantMiddleware:
    """
    Middleware to extract the tenant from the authenticated user and set it in the database context.
    Sets a session-level configuration for PostgreSQL RLS and resets it after the request.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.user.is_authenticated:
            request.tenant = None
            return self.get_response(request)

        try:
            tenant = request.user.owned_tenant
            request.tenant = tenant
        except ObjectDoesNotExist as e:
            raise PermissionDenied("User does not have an active tenant.") from e

        if connection.vendor == 'postgresql':
            with connection.cursor() as cursor:
                # SET LOCAL is scoped to the current transaction.
                # Since ATOMIC_REQUESTS is True, this automatically resets when the transaction commits or rolls back.
                cursor.execute("SET LOCAL credkeep.current_tenant = %s", [str(tenant.id)])

        response = self.get_response(request)
        return response
