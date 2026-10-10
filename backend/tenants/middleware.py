from django.db import connection, DatabaseError, transaction
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
            auth_header = request.headers.get('Authorization', '')
            if auth_header:
                parts = auth_header.split()
                if len(parts) == 2 and parts[0].lower() in ('bearer', 'token'):
                    try:
                        from rest_framework.authtoken.models import Token
                        token = Token.objects.select_related('user').get(key=parts[1])
                        request.user = token.user
                    except Exception:
                        pass

        if not request.user.is_authenticated:
            request.tenant = None
            return self.get_response(request)

        try:
            tenant = request.user.owned_tenant
            request.tenant = tenant
        except ObjectDoesNotExist as e:
            raise PermissionDenied("User does not have an active tenant.") from e

        with transaction.atomic():
            if connection.vendor == 'postgresql':
                with connection.cursor() as cursor:
                    # SET LOCAL is scoped to the current transaction.
                    # By executing within transaction.atomic(), this configuration remains active
                    # for the entire view execution and is automatically cleared on commit or rollback.
                    cursor.execute("SET LOCAL credkeep.current_tenant = %s", [str(tenant.id)])

            response = self.get_response(request)
            return response

