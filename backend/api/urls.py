from django.urls import path
from .views import HealthCheckView, ReadinessCheckView
from .views_auth import RegisterView, LoginView, DeviceRegisterView
from .views_sync import SyncPushView, SyncPullView
from tenants.views import DeviceListView

urlpatterns = [
    # Health checks
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('ready/', ReadinessCheckView.as_view(), name='readiness-check'),

    # Authentication
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/device/', DeviceRegisterView.as_view(), name='auth-device'),

    # Sync endpoints
    path('sync/push/', SyncPushView.as_view(), name='sync-push'),
    path('sync/pull/', SyncPullView.as_view(), name='sync-pull'),

    # Tenancy / legacy devices
    path('devices/', DeviceListView.as_view(), name='device-list'),
]
