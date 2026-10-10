import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from django.db import connection, transaction, DatabaseError
from tenants.models import Tenant, Device

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

@pytest.fixture
def device_for_tenant1(user_with_tenant):
    user, tenant = user_with_tenant
    if connection.vendor == 'postgresql':
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL credkeep.current_tenant = %s", [str(tenant.id)])
                device = Device.objects.create(tenant=tenant, push_token='token1')
                return device
    return Device.objects.create(tenant=tenant, push_token='token1')

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
    assert response.status_code == 200
    assert response.data == {"status": "ready"}

@pytest.mark.django_db(transaction=True)
def test_cross_tenant_middleware_permission(api_client, user_with_tenant, user_without_tenant):
    """
    Validates that users without an active tenant are blocked with PermissionDenied (403),
    while users with an active tenant pass through middleware.
    """
    user1, tenant1 = user_with_tenant
    
    # User without tenant gets blocked
    api_client.force_login(user=user_without_tenant)
    response = api_client.get(reverse('health-check'))
    assert response.status_code == 403

    # User with tenant passes
    api_client.force_login(user=user1)
    response = api_client.get(reverse('health-check'))
    assert response.status_code == 200

@pytest.mark.django_db(transaction=True)
def test_http_device_endpoint_tenant_isolation(api_client, user_with_tenant, device_for_tenant1):
    """
    Validates end-to-end HTTP request isolation through TenantMiddleware and view layers.
    Lender 1 should see only their own device.
    Lender 2 should see only their own devices (or none), never Lender 1's.
    """
    user1, tenant1 = user_with_tenant
    other_user = User.objects.create_user(username='lender_other', password='password')
    other_tenant = Tenant.objects.create(name='Other Lender Workspace', owner=other_user)

    url = reverse('device-list')

    # 1. Unauthenticated request rejected
    response = api_client.get(url)
    assert response.status_code in (401, 403)

    # 2. Lender 1 accesses device list -> sees tenant1's device
    api_client.force_login(user=user1)
    response = api_client.get(url)
    assert response.status_code == 200
    device_ids = [d['id'] for d in response.data]
    assert str(device_for_tenant1.id) in device_ids

    # 3. Lender 2 accesses device list -> does not see tenant1's device
    api_client.force_login(user=other_user)
    response = api_client.get(url)
    assert response.status_code == 200
    assert len(response.data) == 0

    # 4. Lender 2 registers their own device
    response = api_client.post(url, {'push_token': 'token2'}, format='json')
    assert response.status_code == 201
    lender2_device_id = response.data['id']

    # 5. Lender 1 still only sees their own device, not Lender 2's
    api_client.force_login(user=user1)
    response = api_client.get(url)
    assert response.status_code == 200
    device_ids = [d['id'] for d in response.data]
    assert str(device_for_tenant1.id) in device_ids
    assert lender2_device_id not in device_ids

@pytest.mark.django_db(transaction=True)
def test_rls_sql_generation(user_with_tenant):
    user, tenant = user_with_tenant
    if connection.vendor == 'postgresql':
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL credkeep.current_tenant = %s", [str(tenant.id)])
                cursor.execute("SHOW credkeep.current_tenant")
                result = cursor.fetchone()
                assert result[0] == str(tenant.id)
    else:
        pytest.skip("Skipping RLS validation on SQLite backend.")

@pytest.mark.django_db(transaction=True)
def test_cross_tenant_device_isolation(user_with_tenant, device_for_tenant1):
    """
    Validates RLS for Device model in PostgreSQL within atomic transactions.
    """
    user1, tenant1 = user_with_tenant
    
    if connection.vendor == 'postgresql':
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Set to tenant1
                cursor.execute("SET LOCAL credkeep.current_tenant = %s", [str(tenant1.id)])
                cursor.execute("SELECT id FROM tenants_device")
                result = cursor.fetchall()
                assert len(result) == 1
                
                # Context as other tenant (simulated with random uuid)
                cursor.execute("SET LOCAL credkeep.current_tenant = '00000000-0000-0000-0000-000000000000'")
                cursor.execute("SELECT id FROM tenants_device")
                result2 = cursor.fetchall()
                assert len(result2) == 0
    else:
        pytest.skip("Skipping RLS validation on SQLite backend.")

@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(connection.vendor != 'postgresql', reason="Requires PostgreSQL RLS")
def test_postgresql_restricted_role_isolation(user_with_tenant, device_for_tenant1):
    user, tenant = user_with_tenant
    other_tenant = Tenant.objects.create(
        name="Other Tenant",
        owner=User.objects.create_user(username='other_user', password='password')
    )
    
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = 'credkeep_app'")
        if not cursor.fetchone():
            pytest.skip("Restricted role 'credkeep_app' is not provisioned on this PostgreSQL instance.")
        
        try:
            cursor.execute("SET ROLE credkeep_app")
            
            with transaction.atomic():
                # Set context to other_tenant
                cursor.execute("SET LOCAL credkeep.current_tenant = %s", [str(other_tenant.id)])
                
                # Cross-tenant reads should fail / return 0
                devices = Device.objects.all()
                assert devices.count() == 0, "Role failed to isolate reads"
                
                # Rejected writes
                with pytest.raises(DatabaseError):
                    with transaction.atomic():
                        # RLS should reject this insert under credkeep_app
                        Device.objects.create(tenant=tenant, push_token="hack")
        finally:
            cursor.execute("RESET ROLE")
