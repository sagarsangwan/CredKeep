from rest_framework.authentication import TokenAuthentication

class BearerTokenAuthentication(TokenAuthentication):
    """
    Token authentication supporting both 'Bearer <token>' and 'Token <token>'
    authorization headers.
    """
    keyword = 'Bearer'

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header:
            return None

        parts = auth_header.split()
        if not parts or parts[0].lower() not in ('bearer', 'token'):
            return None

        if len(parts) != 2:
            return None

        return self.authenticate_credentials(parts[1])
