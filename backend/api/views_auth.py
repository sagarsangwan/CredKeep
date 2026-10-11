import uuid
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction, IntegrityError
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from tenants.models import Tenant, Device

class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        workspace_name = request.data.get('workspace_name', '').strip()
        email = request.data.get('email', '').strip()

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
            user = User.objects.create_user(username=username, password=password, email=email)
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
