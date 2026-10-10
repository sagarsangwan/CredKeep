import logging
from django.utils.decorators import method_decorator
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

@method_decorator(transaction.non_atomic_requests, name='dispatch')
class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok"}, status=status.HTTP_200_OK)

@method_decorator(transaction.non_atomic_requests, name='dispatch')
class ReadinessCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from django.db import connection, DatabaseError
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return Response({"status": "ready"}, status=status.HTTP_200_OK)
        except DatabaseError:
            return Response({"status": "unready"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
