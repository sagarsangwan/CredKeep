import os
import uuid
import json
import urllib.request
import urllib.error
import logging
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core import signing
from django.core.mail import send_mail
from django.db import transaction, IntegrityError
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from tenants.models import Tenant, Device, GoogleIdentity

logger = logging.getLogger(__name__)


def verify_google_id_token(id_token: str, google_client_id: str) -> dict:
    """
    Verifies a Google ID token against Google's public tokeninfo service.
    Validates audience, expiration, and email_verified.
    Raises ValueError with client-safe message if verification fails.
    """
    if not google_client_id:
        raise ValueError("Google OAuth is not configured on the backend. Please configure GOOGLE_CLIENT_ID in backend environment.")

    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
        req = urllib.request.Request(url, headers={'User-Agent': 'CredKeep-Backend'})
        with urllib.request.urlopen(req, timeout=5) as response:
            payload = json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        logger.warning("Google tokeninfo HTTP error: %s", e)
        raise ValueError("Invalid or expired Google identity token.")
    except Exception as e:
        logger.warning("Failed to verify Google token: %s", e)
        raise ValueError("Failed to verify Google identity token.")

    aud = payload.get('aud')
    if aud != google_client_id:
        raise ValueError("Token audience does not match configured Google client ID.")

    if not payload.get('email_verified', False):
        raise ValueError("Google account email is not verified.")

    if not payload.get('sub'):
        raise ValueError("Google identity token missing subject (sub) claim.")

    return payload


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        workspace_name = request.data.get('workspace_name', '').strip()
        email = request.data.get('email', '').strip()
        full_name = request.data.get('full_name', '').strip()
        phone = request.data.get('phone', '').strip()

        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not workspace_name:
            workspace_name = f"{username}'s Workspace"

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Username already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            first_name = full_name[:30] if full_name else ''
            last_name = full_name[30:150] if len(full_name) > 30 else ''
            user = User.objects.create_user(
                username=username,
                password=password,
                email=email,
                first_name=first_name,
                last_name=last_name
            )
            tenant = Tenant.objects.create(name=workspace_name, owner=user)
            token = Token.objects.create(user=user)

        return Response({
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
            },
            "tenant": {
                "id": str(tenant.id),
                "name": tenant.name,
            }
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(request, username=username, password=password)
        if not user:
            return Response(
                {"error": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        token, _ = Token.objects.get_or_create(user=user)
        tenant = getattr(user, 'owned_tenant', None)

        return Response({
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
            },
            "tenant": {
                "id": str(tenant.id),
                "name": tenant.name,
            } if tenant else None
        }, status=status.HTTP_200_OK)


class GoogleAuthView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        id_token = request.data.get('id_token', '').strip()
        if not id_token:
            return Response(
                {"error": "id_token is required for Google authentication."},
                status=status.HTTP_400_BAD_REQUEST
            )

        google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None) or os.environ.get('GOOGLE_CLIENT_ID')
        if not google_client_id:
            return Response(
                {"error": "Google OAuth is not configured on the backend. Please configure GOOGLE_CLIENT_ID in backend environment."},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )

        try:
            payload = verify_google_id_token(id_token, google_client_id)
        except ValueError as e:
            err_msg = str(e)
            if "not configured" in err_msg:
                return Response({"error": err_msg}, status=status.HTTP_501_NOT_IMPLEMENTED)
            return Response({"error": err_msg}, status=status.HTTP_400_BAD_REQUEST)

        sub = payload['sub']
        email = payload.get('email', '').strip().lower()
        name = payload.get('name', '').strip()

        # 1. Lookup by immutable Google sub identifier
        identity = GoogleIdentity.objects.filter(google_sub=sub).select_related('user').first()
        if identity:
            user = identity.user
            token, _ = Token.objects.get_or_create(user=user)
            tenant = getattr(user, 'owned_tenant', None)
            return Response({
                "status": "success",
                "token": token.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                },
                "tenant": {
                    "id": str(tenant.id),
                    "name": tenant.name,
                } if tenant else None
            }, status=status.HTTP_200_OK)

        # 2. Account Takeover Protection (Requirement 9):
        # Prevent logging into an existing account solely because the Google token presents a matching email.
        if User.objects.filter(email=email).exists():
            return Response({
                "error": "An account with this email already exists. Please log in with your username and password, then link your Google account to enable Google Sign-In.",
                "code": "ACCOUNT_EXISTS_LINK_REQUIRED"
            }, status=status.HTTP_409_CONFLICT)

        # 3. New user: requires phone number before tenant creation
        temp_data = {
            'email': email,
            'name': name,
            'sub': sub,
            'timestamp': timezone.now().isoformat()
        }
        signer = signing.TimestampSigner(salt='google-onboarding')
        temp_token = signer.sign(json.dumps(temp_data))

        return Response({
            "status": "needs_profile",
            "temp_token": temp_token,
            "profile_name": name,
            "email": email
        }, status=status.HTTP_200_OK)


class GoogleCompleteView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        temp_token = request.data.get('temp_token', '').strip()
        phone = request.data.get('phone', '').strip()
        workspace_name = request.data.get('workspace_name', '').strip()
        full_name = request.data.get('full_name', '').strip()

        if not temp_token or not phone:
            return Response(
                {"error": "temp_token and phone are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify signed token (max-age 15 minutes)
        signer = signing.TimestampSigner(salt='google-onboarding')
        try:
            raw_data = signer.unsign(temp_token, max_age=900)
            token_payload = json.loads(raw_data)
        except (signing.BadSignature, signing.SignatureExpired):
            return Response(
                {"error": "Onboarding session expired or invalid. Please sign in with Google again."},
                status=status.HTTP_400_BAD_REQUEST
            )

        sub = token_payload.get('sub', '').strip()
        email = token_payload.get('email', '').strip().lower()
        name = full_name or token_payload.get('name', '').strip()

        # Idempotency / Duplicate request check (Requirement 7)
        if sub:
            existing_identity = GoogleIdentity.objects.filter(google_sub=sub).select_related('user').first()
            if existing_identity:
                user = existing_identity.user
                token, _ = Token.objects.get_or_create(user=user)
                tenant = getattr(user, 'owned_tenant', None)
                return Response({
                    "token": token.key,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                    },
                    "tenant": {
                        "id": str(tenant.id),
                        "name": tenant.name,
                    } if tenant else None
                }, status=status.HTTP_200_OK)

        if User.objects.filter(email=email).exists():
            user = User.objects.get(email=email)
            if sub:
                GoogleIdentity.objects.get_or_create(
                    user=user,
                    defaults={'google_sub': sub, 'email': email}
                )
            token, _ = Token.objects.get_or_create(user=user)
            tenant = getattr(user, 'owned_tenant', None)
            return Response({
                "token": token.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                },
                "tenant": {
                    "id": str(tenant.id),
                    "name": tenant.name,
                } if tenant else None
            }, status=status.HTTP_200_OK)

        base_username = email.split('@')[0]
        username = base_username
        suffix = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{suffix}"
            suffix += 1

        if not workspace_name:
            workspace_name = f"{name or username}'s Workspace"

        with transaction.atomic():
            first_name = name[:30] if name else ''
            last_name = name[30:150] if len(name) > 30 else ''
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name
            )
            # Unusable password for OAuth-only users until password reset is configured
            user.set_unusable_password()
            user.save()

            tenant = Tenant.objects.create(name=workspace_name, owner=user)
            token = Token.objects.create(user=user)
            if sub:
                GoogleIdentity.objects.create(user=user, google_sub=sub, email=email)

        return Response({
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
            },
            "tenant": {
                "id": str(tenant.id),
                "name": tenant.name,
            }
        }, status=status.HTTP_201_CREATED)


class GoogleLinkView(APIView):
    """
    Securely links a Google identity to an existing authenticated user.
    Protects against account takeover while preserving the user's existing tenant workspace.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        id_token = request.data.get('id_token', '').strip()
        if not id_token:
            return Response(
                {"error": "id_token is required to link Google identity."},
                status=status.HTTP_400_BAD_REQUEST
            )

        google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None) or os.environ.get('GOOGLE_CLIENT_ID')
        if not google_client_id:
            return Response(
                {"error": "Google OAuth is not configured on the backend. Please configure GOOGLE_CLIENT_ID in backend environment."},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )

        try:
            payload = verify_google_id_token(id_token, google_client_id)
        except ValueError as e:
            err_msg = str(e)
            if "not configured" in err_msg:
                return Response({"error": err_msg}, status=status.HTTP_501_NOT_IMPLEMENTED)
            return Response({"error": err_msg}, status=status.HTTP_400_BAD_REQUEST)

        sub = payload['sub']
        email = payload.get('email', '').strip().lower()

        # Check if this Google sub is already linked to another user
        existing = GoogleIdentity.objects.filter(google_sub=sub).first()
        if existing:
            if existing.user_id != request.user.id:
                return Response(
                    {"error": "This Google account is already linked to another user."},
                    status=status.HTTP_409_CONFLICT
                )
            return Response({
                "status": "already_linked",
                "message": "Google identity is already linked to this account.",
                "google_sub": sub,
                "email": email
            }, status=status.HTTP_200_OK)

        with transaction.atomic():
            identity, created = GoogleIdentity.objects.update_or_create(
                user=request.user,
                defaults={'google_sub': sub, 'email': email}
            )

        return Response({
            "status": "linked",
            "message": "Google identity linked successfully.",
            "google_sub": sub,
            "email": email
        }, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response(
                {"error": "Email address is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Zero-Knowledge Protection:
        # Always return identical neutral confirmation regardless of whether account exists.
        neutral_message = "If an account matches this email, password reset instructions will be sent."

        user = User.objects.filter(email=email).first()
        if user and user.is_active:
            signer = signing.TimestampSigner(salt='password-reset')
            reset_token = signer.sign(str(user.id))
            logger.info("Generated password reset token for user %s: %s", user.id, reset_token)

            # Check if email is configured
            email_host = getattr(settings, 'EMAIL_HOST', None) or os.environ.get('EMAIL_HOST')
            if email_host:
                try:
                    send_mail(
                        subject="CredKeep Password Reset",
                        message=f"Use this token to reset your CredKeep password: {reset_token}\nThis token expires in 15 minutes.",
                        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@credkeep.local'),
                        recipient_list=[email],
                        fail_silently=True
                    )
                except Exception as e:
                    logger.warning("Failed to send reset email: %s", e)

        return Response({"message": neutral_message}, status=status.HTTP_200_OK)


class DeviceRegisterView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not getattr(request, 'tenant', None):
            return Response(
                {"error": "User does not have an active tenant."},
                status=status.HTTP_403_FORBIDDEN
            )

        push_token = request.data.get('push_token', '')
        device_id_str = request.data.get('device_id', None)

        if device_id_str:
            try:
                device_id = uuid.UUID(str(device_id_str))
                existing = Device.objects.filter(id=device_id).first()
                if existing and existing.tenant_id != request.tenant.id:
                    return Response(
                        {"error": "Device ID is registered to another tenant."},
                        status=status.HTTP_409_CONFLICT
                    )
                device, created = Device.objects.get_or_create(
                    id=device_id,
                    tenant=request.tenant,
                    defaults={'push_token': push_token, 'last_sync': timezone.now()}
                )
                if not created:
                    device.push_token = push_token
                    device.last_sync = timezone.now()
                    device.save(update_fields=['push_token', 'last_sync'])
            except (ValueError, TypeError):
                return Response(
                    {"error": "Invalid device_id format."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except IntegrityError:
                return Response(
                    {"error": "Device ID is registered to another tenant."},
                    status=status.HTTP_409_CONFLICT
                )
        else:
            device = Device.objects.create(
                tenant=request.tenant,
                push_token=push_token,
                last_sync=timezone.now()
            )

        return Response({
            "device_id": str(device.id),
            "push_token": device.push_token,
            "tenant_id": str(request.tenant.id)
        }, status=status.HTTP_200_OK)
