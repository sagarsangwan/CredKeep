from django.urls import path
from .views import HealthCheckView, ReadinessCheckView
from tenants.views import DeviceListView

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('ready/', ReadinessCheckView.as_view(), name='readiness-check'),
    path('devices/', DeviceListView.as_view(), name='device-list'),
]
