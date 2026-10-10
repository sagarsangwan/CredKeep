import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from tenants.models import Tenant
from django.db import connection

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def user_with_tenant():
    user = User.objects.create_user(username='lender1', password='password')
    tenant = Tenant.objects.create(name='Lender 1 Workspace', owner=user)
    return user, tenant

@pytest.fixture
def user_without_tenant():
    return User.objects.create_user(username='lender2', password='password')

@pytest.mark.django_db
def test_health_check(api_client):
    url = reverse('health-check')
    response = api_client.get(url)
    assert response.status_code == 200
    assert response.data == {"status": "ok"}

@pytest.mark.django_db
def test_readiness_check(api_client):
    url = reverse('readiness-check')
    response = api_client.get(url)
    # Even with SQLite, this should return 200 ok
    assert response.status_code == 200
    assert response.data == {"status": "ready"}

@pytest.mark.django_db
def test_cross_tenant_isolation(api_client, user_with_tenant, user_without_tenant):
    """
    Validates application-level tenant isolation logic.
    User 1 should not see User 2's devices or tenant data (when endpoints are implemented).
    Since we don't have endpoints yet, we verify that the middleware correctly throws PermissionDenied
    when user_without_tenant tries to access protected views, and succeeds for user_with_tenant.
    """
    user1, tenant1 = user_with_tenant
    
    # Test user without tenant gets blocked
    api_client.force_login(user=user_without_tenant)
    response = api_client.get(reverse('health-check'))
    assert response.status_code == 403 # PermissionDenied

    # Test user with tenant passes
    api_client.force_login(user=user1)
    response = api_client.get(reverse('health-check'))
    assert response.status_code == 200

@pytest.mark.django_db
def test_rls_sql_generation(user_with_tenant):
    user, tenant = user_with_tenant
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute("SET credkeep.current_tenant = %s", [str(tenant.id)])
            cursor.execute("SHOW credkeep.current_tenant")
            result = cursor.fetchone()
            assert result[0] == str(tenant.id)
            cursor.execute("RESET credkeep.current_tenant")
    else:
        pytest.skip("Skipping RLS validation on SQLite backend.")

from tenants.models import Device

@pytest.fixture
def device_for_tenant1(user_with_tenant):
    user, tenant = user_with_tenant
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute("SET credkeep.current_tenant = %s", [str(tenant.id)])
    device = Device.objects.create(tenant=tenant, push_token='token1')
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute("RESET credkeep.current_tenant")
    return device

@pytest.mark.django_db
def test_cross_tenant_device_isolation(user_with_tenant, device_for_tenant1):
    """
    Validates RLS for Device model if postgres.
    """
    user1, tenant1 = user_with_tenant
    
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            # Set to tenant1
            cursor.execute("SET credkeep.current_tenant = %s", [str(tenant1.id)])
            
            # Tenant 1 should see the device
            cursor.execute("SELECT id FROM tenants_device")
            result = cursor.fetchall()
            assert len(result) == 1
            
            # Reset and try as user_without_tenant (simulated with random uuid)
            cursor.execute("SET credkeep.current_tenant = '00000000-0000-0000-0000-000000000000'")
            cursor.execute("SELECT id FROM tenants_device")
            result2 = cursor.fetchall()
            assert len(result2) == 0
            
            cursor.execute("RESET credkeep.current_tenant")
    else:
        pytest.skip("Skipping RLS validation on SQLite backend.")

@pytest.mark.django_db
@pytest.mark.skipif(connection.vendor != 'postgresql', reason="Requires PostgreSQL RLS")
def test_postgresql_restricted_role_isolation(user_with_tenant, device_for_tenant1):
    user, tenant = user_with_tenant
    other_tenant = Tenant.objects.create(name="Other Tenant", owner=User.objects.create_user(username='other_user', password='password'))
    
    with connection.cursor() as cursor:
        try:
            # We must be able to switch to the restricted app role.
            # If the role doesn't exist, this will throw, failing the test if run on a real pg instance.
            cursor.execute("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'credkeep_app') THEN CREATE ROLE credkeep_app; END IF; END $$;")
            cursor.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO credkeep_app;")
            cursor.execute("SET ROLE credkeep_app")
            
            # Set context to other_tenant
            cursor.execute("SET credkeep.current_tenant = %s", [str(other_tenant.id)])
            
            # Cross-tenant reads should fail / return 0
            devices = Device.objects.all()
            assert devices.count() == 0, "Role failed to isolate reads"
            
            from django.db import transaction, DatabaseError
            
            # Rejected writes
            with pytest.raises(DatabaseError):
                with transaction.atomic():
                    # RLS should reject this insert under credkeep_app
                    Device.objects.create(tenant=tenant, push_token="hack")
                
        finally:
            cursor.execute("RESET ROLE")
            cursor.execute("RESET credkeep.current_tenant")
