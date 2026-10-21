from django.urls import path
from .views import HealthCheckView, ReadinessCheckView
from .views_auth import (
    RegisterView,
    LoginView,
    DeviceRegisterView,
    GoogleAuthView,
    GoogleCompleteView,
    GoogleLinkView,
    PasswordResetRequestView,
)
from .views_sync import SyncPushView, SyncPullView, PortfolioSummaryView
from tenants.views import DeviceListView

urlpatterns = [
    # Health checks
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('ready/', ReadinessCheckView.as_view(), name='readiness-check'),

    # Authentication
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/google/', GoogleAuthView.as_view(), name='auth-google'),
    path('auth/google/complete/', GoogleCompleteView.as_view(), name='auth-google-complete'),
    path('auth/google/link/', GoogleLinkView.as_view(), name='auth-google-link'),
    path('auth/password-reset/', PasswordResetRequestView.as_view(), name='auth-password-reset'),
    path('auth/device/', DeviceRegisterView.as_view(), name='auth-device'),

    # Sync endpoints
    path('sync/push/', SyncPushView.as_view(), name='sync-push'),
    path('sync/pull/', SyncPullView.as_view(), name='sync-pull'),
    path('sync/portfolio/', PortfolioSummaryView.as_view(), name='portfolio-summary'),
    path('portfolio/summary/', PortfolioSummaryView.as_view(), name='portfolio-summary-alt'),

    # Tenancy / legacy devices
    path('devices/', DeviceListView.as_view(), name='device-list'),
]

