from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from tenants.models import Device

class DeviceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(request, 'tenant', None):
            return Response({"error": "No tenant associated with user"}, status=status.HTTP_403_FORBIDDEN)
        # Defense-in-depth: Application-layer tenant filter combined with PostgreSQL RLS
        devices = Device.objects.filter(tenant=request.tenant)
        data = [{"id": str(d.id), "push_token": d.push_token} for d in devices]
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        if not getattr(request, 'tenant', None):
            return Response({"error": "No tenant associated with user"}, status=status.HTTP_403_FORBIDDEN)
        push_token = request.data.get('push_token', '')
        device = Device.objects.create(tenant=request.tenant, push_token=push_token)
        return Response({"id": str(device.id), "push_token": device.push_token}, status=status.HTTP_201_CREATED)
