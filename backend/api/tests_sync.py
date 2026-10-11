import uuid
from decimal import Decimal
from datetime import timedelta
import pytest
from django.utils import timezone
from django.db import models
from django.core.exceptions import ValidationError
from django.urls import reverse
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

from tenants.models import Tenant, Device
from ledger.models import Borrower, LoanAccount, Kist, Transaction as LedgerTx, SyncLog, SyncOutbox, ScheduleModification
from ledger.engine import ledger_service


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def lender_setup():
    user = User.objects.create_user(username='lender_api_1', password='secretpassword123')
    tenant = Tenant.objects.create(name='Lender 1 Workspace', owner=user)
    token = Token.objects.create(user=user)
    return user, tenant, token


@pytest.fixture
def other_lender_setup():
    user = User.objects.create_user(username='lender_api_2', password='secretpassword456')
    tenant = Tenant.objects.create(name='Lender 2 Workspace', owner=user)
    token = Token.objects.create(user=user)
    return user, tenant, token


# ============================================================================
# Authentication API Tests (CK-V2-API-001)
# ============================================================================

@pytest.mark.django_db
def test_auth_register_success(api_client):
    url = reverse('auth-register')
    payload = {
        'username': 'new_lender',
        'password': 'StrongPassword!99',
        'workspace_name': 'New Lender Microfinance',
        'email': 'new@lender.com'
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == 201
    assert 'token' in response.data
    assert response.data['user']['username'] == 'new_lender'
    assert response.data['tenant']['name'] == 'New Lender Microfinance'

    user = User.objects.get(username='new_lender')
    assert user.owned_tenant.name == 'New Lender Microfinance'
    assert Token.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_auth_register_duplicate_username(api_client, lender_setup):
    url = reverse('auth-register')
    payload = {
        'username': 'lender_api_1',
        'password': 'any_password',
        'workspace_name': 'Duplicate Test'
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == 400
    assert 'already exists' in response.data['error']


@pytest.mark.django_db
def test_auth_login_success(api_client, lender_setup):
    user, tenant, token = lender_setup
    url = reverse('auth-login')
    payload = {
        'username': 'lender_api_1',
        'password': 'secretpassword123'
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['token'] == token.key
    assert response.data['tenant']['id'] == str(tenant.id)


@pytest.mark.django_db
def test_auth_login_invalid_credentials(api_client, lender_setup):
    url = reverse('auth-login')
    payload = {
        'username': 'lender_api_1',
        'password': 'wrong_password'
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == 401
    assert 'Invalid credentials' in response.data['error']


@pytest.mark.django_db
def test_auth_device_register(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    url = reverse('auth-device')
    device_id = str(uuid.uuid4())
    payload = {
        'device_id': device_id,
        'push_token': 'fcm-sample-token-12345'
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['device_id'] == device_id
    assert response.data['push_token'] == 'fcm-sample-token-12345'

    device = Device.objects.get(id=device_id)
    assert device.tenant == tenant
    assert device.push_token == 'fcm-sample-token-12345'


# ============================================================================
# Sync PUSH API Tests (CK-V2-SYNC-001)
# ============================================================================

@pytest.mark.django_db
def test_sync_push_create_borrower_and_idempotency(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    url = reverse('sync-push')

    borrower_id = str(uuid.uuid4())
    op_id = str(uuid.uuid4())
    device_id = str(uuid.uuid4())

    payload = {
        'device_id': device_id,
        'operations': [
            {
                'operation_id': op_id,
                'type': 'create_borrower',
                'payload': {
                    'id': borrower_id,
                    'name': 'Ramesh Kumar',
                    'phone': '9876543210'
                }
            }
        ]
    }

    # 1. First push
    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['results'][0]['operation_id'] == op_id
    assert response.data['results'][0]['status'] == 'ACCEPTED'

    # Check Borrower in DB
    borrower = Borrower.objects.get(id=borrower_id)
    assert borrower.tenant == tenant
    assert borrower.name == 'Ramesh Kumar'
    assert borrower.phone == '9876543210'

    # Check SyncLog
    log = SyncLog.objects.get(tenant=tenant, operation_id=op_id)
    assert log.status == 'ACCEPTED'

    # Check Outbox
    outbox = SyncOutbox.objects.filter(tenant=tenant, record_type='BORROWER', record_id=borrower_id).first()
    assert outbox is not None
    assert outbox.payload['name'] == 'Ramesh Kumar'

    # 2. Second push with same operation_id (Idempotency)
    response2 = api_client.post(url, payload, format='json')
    assert response2.status_code == 200
    assert response2.data['results'][0]['operation_id'] == op_id
    assert response2.data['results'][0]['status'] == 'ACCEPTED'
    assert Borrower.objects.filter(tenant=tenant).count() == 1


@pytest.mark.django_db
def test_sync_push_create_loan_and_kist_generation(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    url = reverse('sync-push')

    borrower = Borrower.objects.create(tenant=tenant, name='Sunita Devi', phone='9123456780')
    loan_id = str(uuid.uuid4())
    op_id = str(uuid.uuid4())

    payload = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'create_loan',
                'payload': {
                    'id': loan_id,
                    'borrower_id': str(borrower.id),
                    'principal_paise': 3000000,      # ₹30,000
                    'markup_factor': '0.1000',       # 10%
                    'term_months': 3,
                    'start_date': '2026-01-01',
                    'due_day': 10,
                    'product_type': 'instalment'
                }
            }
        ]
    }

    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['results'][0]['status'] == 'ACCEPTED'

    loan = LoanAccount.objects.get(id=loan_id)
    assert loan.tenant == tenant
    assert loan.status == 'ACTIVE'

    # Verify 3 Kists created
    kists = list(loan.schedules.all().order_by('installment_number'))
    assert len(kists) == 3
    assert sum(k.principal_component_paise for k in kists) == 3000000
    assert sum(k.markup_component_paise for k in kists) == 300000

    # Verify Outbox entries created
    outbox_loans = SyncOutbox.objects.filter(tenant=tenant, record_type='LOAN', record_id=loan.id)
    assert outbox_loans.exists()
    outbox_kists = SyncOutbox.objects.filter(tenant=tenant, record_type='KIST')
    assert outbox_kists.count() == 3


@pytest.mark.django_db
def test_sync_push_record_collection_and_settlement(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    url = reverse('sync-push')

    today_str = str(timezone.now().date())
    borrower = Borrower.objects.create(tenant=tenant, name='Kavita Patel', phone='9988776655')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.10'),
        term_months=1,
        start_date=today_str,
        due_day=timezone.now().date().day,
        product_type='instalment',
        status='ACTIVE'
    )
    kist = Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date=today_str,
        effective_due_date=today_str,
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    op_id = str(uuid.uuid4())
    payload = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 110000,
                    'effective_date': today_str,
                    'payment_method': 'CASH'
                }
            }
        ]
    }

    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['results'][0]['status'] == 'ACCEPTED'

    # Check Transaction created
    tx = LedgerTx.objects.get(tenant=tenant, operation_id=op_id)
    assert tx.amount_paise == 110000
    assert tx.allocated_principal_paise == 100000
    assert tx.allocated_markup_paise == 10000

    # Check Kist and Loan settled
    kist.refresh_from_db()
    assert kist.status == 'PAID'
    loan.refresh_from_db()
    assert loan.status == 'SETTLED'


@pytest.mark.django_db
def test_sync_push_stale_settled_loan_needs_review(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    url = reverse('sync-push')

    borrower = Borrower.objects.create(tenant=tenant, name='Anita', phone='9811223344')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.10'),
        term_months=1,
        start_date='2026-01-01',
        due_day=15,
        product_type='instalment',
        status='SETTLED'  # Already settled
    )
    kist = Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date='2026-01-15',
        effective_due_date='2026-01-15',
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PAID'
    )

    op_id = str(uuid.uuid4())
    payload = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan.id),
                    'installment_number': 1,
                    'revised_effective_due_date': '2026-02-15'
                }
            }
        ]
    }

    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['results'][0]['status'] == 'NEEDS_REVIEW'

    # Verify no schedule modification record was added
    assert not ScheduleModification.objects.filter(tenant=tenant, operation_id=op_id).exists()


@pytest.mark.django_db
def test_sync_push_modify_schedule(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    url = reverse('sync-push')

    borrower = Borrower.objects.create(tenant=tenant, name='Vikas', phone='9811223355')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.10'),
        term_months=1,
        start_date='2026-01-01',
        due_day=15,
        product_type='instalment',
        status='ACTIVE'
    )
    kist = Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date='2026-01-15',
        effective_due_date='2026-01-15',
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    op_id = str(uuid.uuid4())
    payload = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan.id),
                    'kist_id': str(kist.id),
                    'revised_effective_due_date': '2026-01-25',
                    'reason': 'Borrower requested 10 days grace'
                }
            }
        ]
    }

    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['results'][0]['status'] == 'ACCEPTED'

    kist.refresh_from_db()
    assert str(kist.effective_due_date) == '2026-01-25'


# ============================================================================
# Sync PULL API Tests (CK-V2-SYNC-002)
# ============================================================================

@pytest.mark.django_db
def test_sync_pull_cursor_pagination_and_isolation(api_client, lender_setup, other_lender_setup):
    user1, tenant1, token1 = lender_setup
    user2, tenant2, token2 = other_lender_setup

    # Create 5 outbox entries for Tenant 1
    for i in range(1, 6):
        SyncOutbox.objects.create(
            tenant=tenant1,
            record_type='BORROWER',
            record_id=uuid.uuid4(),
            operation_type='INSERT',
            payload={'index': i}
        )

    # Create 2 outbox entries for Tenant 2
    for i in range(1, 3):
        SyncOutbox.objects.create(
            tenant=tenant2,
            record_type='BORROWER',
            record_id=uuid.uuid4(),
            operation_type='INSERT',
            payload={'other_tenant_index': i}
        )

    # Lender 1 pulls with limit 2
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token1.key}')
    url = reverse('sync-pull')
    response = api_client.get(f"{url}?cursor=0&limit=2")
    assert response.status_code == 200
    assert len(response.data['changes']) == 2
    assert response.data['has_more'] is True
    next_cursor = response.data['next_cursor']

    # Pull remaining changes for Lender 1
    response2 = api_client.get(f"{url}?cursor={next_cursor}&limit=10")
    assert response2.status_code == 200
    assert len(response2.data['changes']) == 3
    assert response2.data['has_more'] is False

    # Check all changes belong to tenant1
    for change in response.data['changes'] + response2.data['changes']:
        assert 'index' in change['payload']
        assert 'other_tenant_index' not in change['payload']

    # Lender 2 pulls: only sees their 2 items
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token2.key}')
    response_other = api_client.get(f"{url}?cursor=0&limit=10")
    assert response_other.status_code == 200
    assert len(response_other.data['changes']) == 2
    for change in response_other.data['changes']:
        assert 'other_tenant_index' in change['payload']


@pytest.mark.django_db
def test_create_loan_emits_parent_loan_outbox_before_child_kists(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')

    borrower = Borrower.objects.create(tenant=tenant, name='Ordering Borrower', phone='9876543210')
    loan_id = str(uuid.uuid4())
    op_id = str(uuid.uuid4())

    push_payload = {
        "operations": [
            {
                "type": "create_loan",
                "operation_id": op_id,
                "payload": {
                    "id": loan_id,
                    "borrower_id": str(borrower.id),
                    "principal_paise": 100000,
                    "markup_factor": 0.2,
                    "term_months": 2,
                    "start_date": "2026-01-01",
                    "due_day": 5,
                    "product_type": "instalment"
                }
            }
        ]
    }
    url = reverse('sync-push')
    res = api_client.post(url, push_payload, format='json')
    assert res.status_code == 200

    outbox_entries = list(SyncOutbox.objects.filter(tenant=tenant).order_by('sequence_number'))
    assert len(outbox_entries) >= 3  # 1 LOAN + 2 KISTs
    # The first entry must be LOAN
    assert outbox_entries[0].record_type == 'LOAN'
    assert outbox_entries[0].payload['id'] == loan_id
    # Subsequent entries are KISTs
    assert outbox_entries[1].record_type == 'KIST'
    assert outbox_entries[2].record_type == 'KIST'


@pytest.mark.django_db
def test_penalty_waiver_reduces_collectible_balance_and_allows_settlement(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')

    import datetime
    today = timezone.now().date()
    due_date = today - datetime.timedelta(days=5)
    today_str = str(today)
    due_date_str = str(due_date)

    borrower = Borrower.objects.create(tenant=tenant, name='Waiver Borrower', phone='9876543211')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date=due_date_str,
        due_day=due_date.day,
        product_type='instalment',
        status='ACTIVE'
    )
    kist = Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date=due_date_str,
        effective_due_date=due_date_str,
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    # Late by 5 days: assess ₹500 penalty (50,000 paise)
    ledger_service.assess_penalties(loan, today_str)
    assert loan.transactions.filter(transaction_type='PENALTY_ASSESSMENT').count() == 5

    # Waive ₹500 penalty via push
    waive_op = str(uuid.uuid4())
    push_payload = {
        "operations": [
            {
                "type": "waive_penalty",
                "operation_id": waive_op,
                "payload": {
                    "loan_id": str(loan.id),
                    "amount_paise": 50000,
                    "effective_date": today_str
                }
            }
        ]
    }
    url = reverse('sync-push')
    res = api_client.post(url, push_payload, format='json')
    assert res.status_code == 200
    assert res.data['results'][0]['status'] == 'ACCEPTED'

    # Pay full principal + markup (110,000 paise).
    # Since penalty was waived, this should settle the loan!
    pay_op = str(uuid.uuid4())
    pay_payload = {
        "operations": [
            {
                "type": "record_collection",
                "operation_id": pay_op,
                "payload": {
                    "loan_id": str(loan.id),
                    "amount_paise": 110000,
                    "effective_date": today_str,
                    "payment_method": "CASH",
                    "is_cash": True
                }
            }
        ]
    }
    res2 = api_client.post(url, pay_payload, format='json')
    assert res2.status_code == 200
    assert res2.data['results'][0]['status'] == 'ACCEPTED'

    loan.refresh_from_db()
    assert loan.status == 'SETTLED'


@pytest.mark.django_db(transaction=True)
def test_concurrent_payment_retries_idempotency_recovery(lender_setup):
    import concurrent.futures
    from django.db import connection
    from rest_framework.test import APIClient

    user, tenant, token = lender_setup
    borrower = Borrower.objects.create(tenant=tenant, name='Retry Borrower', phone='9876543212')
    loan1 = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment',
        status='ACTIVE'
    )
    loan2 = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment',
        status='ACTIVE'
    )
    Kist.objects.create(
        tenant=tenant,
        loan=loan1,
        installment_number=1,
        original_due_date='2026-01-01',
        effective_due_date='2026-01-01',
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )
    Kist.objects.create(
        tenant=tenant,
        loan=loan2,
        installment_number=1,
        original_due_date='2026-01-01',
        effective_due_date='2026-01-01',
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    Device.objects.create(tenant=tenant)
    url = reverse('sync-push')
    from rest_framework.test import APIRequestFactory, force_authenticate
    from api.views_sync import SyncPushView

    factory = APIRequestFactory()
    view = SyncPushView.as_view()

    def post_op(payload_data):
        import time
        for attempt in range(8):
            request = factory.post(url, payload_data, format='json')
            request.tenant = tenant
            request.user = user
            force_authenticate(request, user=user, token=token)
            try:
                res = view(request)
                if (
                    hasattr(res, 'data')
                    and isinstance(res.data, dict)
                    and res.data.get('results')
                    and res.data['results'][0].get('status') == 'FAILED'
                    and any(k in str(res.data['results'][0].get('error', '')).lower() for k in ('locked', 'busy'))
                    and attempt < 7
                ):
                    time.sleep(0.05 * (attempt + 1))
                    continue
                return res
            except Exception as e:
                if any(k in str(e).lower() for k in ('locked', 'busy')) and attempt < 7:
                    time.sleep(0.05 * (attempt + 1))
                    continue
                raise

            finally:
                connection.close()

    # Part 1: Concurrent identical payment submissions
    identical_op_id = str(uuid.uuid4())
    payload_identical = {
        "operations": [
            {
                "type": "record_collection",
                "operation_id": identical_op_id,
                "payload": {
                    "loan_id": str(loan1.id),
                    "amount_paise": 50000,
                    "effective_date": "2026-01-01",
                    "payment_method": "UPI",
                    "is_cash": False
                }
            }
        ]
    }

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(post_op, payload_identical)
        f2 = executor.submit(post_op, payload_identical)
        res1 = f1.result()
        res2 = f2.result()

    assert res1.status_code == 200
    assert res2.status_code == 200
    statuses = {res1.data['results'][0]['status'], res2.data['results'][0]['status']}
    assert 'ACCEPTED' in statuses
    if 'FAILED' in statuses:
        # Transient failure due to SQLite thread race: retry recovers and receives ACCEPTED
        retry_res = post_op(payload_identical)
        assert retry_res.data['results'][0]['status'] == 'ACCEPTED'
    else:
        assert statuses == {'ACCEPTED'}

    # Exactly 1 transaction recorded in ledger for identical_op_id
    tx_count = loan1.transactions.filter(transaction_type='COLLECTION', operation_id=identical_op_id).count()
    assert tx_count == 1
    tx = loan1.transactions.filter(transaction_type='COLLECTION', operation_id=identical_op_id).first()
    assert tx.is_cash is False
    assert tx.payment_method == 'UPI'

    # Part 2: Concurrent conflicting payment requests (same operation_id, differing loan_id and amount)
    conflicting_op_id = str(uuid.uuid4())
    payload_a = {
        "operations": [
            {
                "type": "record_collection",
                "operation_id": conflicting_op_id,
                "payload": {
                    "loan_id": str(loan1.id),
                    "amount_paise": 30000,
                    "effective_date": "2026-01-01",
                    "payment_method": "CASH",
                    "is_cash": True
                }
            }
        ]
    }
    payload_b_conflict = {
        "operations": [
            {
                "type": "record_collection",
                "operation_id": conflicting_op_id,
                "payload": {
                    "loan_id": str(loan2.id),
                    "amount_paise": 40000,
                    "effective_date": "2026-01-01",
                    "payment_method": "CASH",
                    "is_cash": True
                }
            }
        ]
    }

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f_a = executor.submit(post_op, payload_a)
        f_b = executor.submit(post_op, payload_b_conflict)
        res_a = f_a.result()
        res_b = f_b.result()

    assert res_a.status_code == 200
    assert res_b.status_code == 200
    statuses_conflict = {res_a.data['results'][0]['status'], res_b.data['results'][0]['status']}
    assert 'ACCEPTED' in statuses_conflict

    # Identify winner and loser
    if res_a.data['results'][0]['status'] == 'ACCEPTED':
        loser_payload = payload_b_conflict
        loser_res = res_b
    else:
        loser_payload = payload_a
        loser_res = res_a

    # The loser must NEVER receive false ACCEPTED: it must be REJECTED with idempotency conflict error
    if loser_res.data['results'][0]['status'] == 'FAILED':
        loser_retry = post_op(loser_payload)
        assert loser_retry.data['results'][0]['status'] == 'REJECTED'
        assert 'Idempotency conflict' in loser_retry.data['results'][0]['error']
    else:
        assert loser_res.data['results'][0]['status'] == 'REJECTED'
        assert 'Idempotency conflict' in loser_res.data['results'][0]['error']

    # Exactly 1 transaction recorded across both loans for this operation_id
    assert LedgerTx.objects.filter(tenant=tenant, operation_id=conflicting_op_id).count() == 1


@pytest.mark.django_db
def test_temporary_infrastructure_failure_preserves_retryability(api_client, lender_setup):
    from unittest.mock import patch
    from django.db import OperationalError

    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')

    borrower = Borrower.objects.create(tenant=tenant, name='Transient Retry Borrower', phone='9876543299')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment',
        status='ACTIVE'
    )
    Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date='2026-01-01',
        effective_due_date='2026-01-01',
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    op_id = str(uuid.uuid4())
    payload = {
        "operations": [
            {
                "type": "record_collection",
                "operation_id": op_id,
                "payload": {
                    "loan_id": str(loan.id),
                    "amount_paise": 50000,
                    "effective_date": "2026-01-01",
                    "payment_method": "CASH",
                    "is_cash": True
                }
            }
        ]
    }
    url = reverse('sync-push')

    # 1. First push encounters a transient database/infrastructure failure
    real_record = ledger_service.record_collection
    with patch('ledger.engine.ledger_service.record_collection', side_effect=OperationalError('database connection lost')):
        res1 = api_client.post(url, payload, format='json')
        assert res1.status_code == 200
        assert res1.data['results'][0]['status'] == 'FAILED'

    # Verify no poisonous permanent REJECTED log was created
    rejected_log = SyncLog.objects.filter(tenant=tenant, operation_id=op_id, status='REJECTED').first()
    assert rejected_log is None

    # 2. Second push retries the exact same operation after recovery
    res2 = api_client.post(url, payload, format='json')
    assert res2.status_code == 200
    assert res2.data['results'][0]['status'] == 'ACCEPTED'

    # Exactly 1 transaction is created
    assert loan.transactions.filter(transaction_type='COLLECTION').count() == 1


@pytest.mark.django_db
def test_bounded_penalty_waiver_cannot_erase_future_penalties(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')

    borrower = Borrower.objects.create(tenant=tenant, name='Waiver Borrower', phone='9876543298')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment',
        status='ACTIVE'
    )
    Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date='2026-01-01',
        effective_due_date='2026-01-01',
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    url = reverse('sync-push')

    # 1. Waiving when no penalties are outstanding is rejected
    res_zero = api_client.post(url, {
        "operations": [{
            "type": "waive_penalty",
            "operation_id": str(uuid.uuid4()),
            "payload": {
                "loan_id": str(loan.id),
                "amount_paise": 50000,
                "effective_date": "2026-01-01"
            }
        }]
    }, format='json')
    assert res_zero.status_code == 200
    assert res_zero.data['results'][0]['status'] == 'REJECTED'

    # 2. 1 overdue day passes: ₹100 penalty assessed
    ledger_service.assess_penalties(loan, '2026-01-02')
    assert loan.transactions.filter(transaction_type='PENALTY_ASSESSMENT').count() == 1

    # 3. Client attempts an excess waiver of ₹500 (50,000 Paise) when only ₹100 (10,000 Paise) is outstanding
    res_waive = api_client.post(url, {
        "operations": [{
            "type": "waive_penalty",
            "operation_id": str(uuid.uuid4()),
            "payload": {
                "loan_id": str(loan.id),
                "amount_paise": 50000,
                "effective_date": "2026-01-02"
            }
        }]
    }, format='json')
    assert res_waive.status_code == 200
    assert res_waive.data['results'][0]['status'] == 'ACCEPTED'

    # The waiver is bounded to actual outstanding penalty (₹100 = 10,000 Paise)
    waive_tx = loan.transactions.filter(transaction_type='REVERSAL').first()
    assert waive_tx is not None
    assert waive_tx.forgiven_penalty_paise == 10000  # Capped at outstanding debt!

    # 4. Another day passes: new penalty of ₹100 assessed for 2026-01-03
    ledger_service.assess_penalties(loan, '2026-01-03')
    assert loan.transactions.filter(transaction_type='PENALTY_ASSESSMENT').count() == 2

    # Verify that future penalty is NOT erased by the previous excess waiver attempt
    total_assessed = loan.transactions.filter(transaction_type='PENALTY_ASSESSMENT').aggregate(t=models.Sum('amount_paise'))['t'] or 0
    total_waived = loan.transactions.filter(transaction_type='REVERSAL').aggregate(t=models.Sum('forgiven_penalty_paise'))['t'] or 0
    outstanding = total_assessed - total_waived
    assert total_assessed == 20000  # ₹200
    assert total_waived == 10000    # ₹100
    assert outstanding == 10000     # ₹100 outstanding, not 0!


@pytest.mark.django_db
def test_outbox_allocates_strictly_unique_sequential_cursors(lender_setup):
    user, tenant, token = lender_setup

    outbox1 = SyncOutbox.objects.create(
        tenant=tenant,
        record_type='LOAN',
        record_id=uuid.uuid4(),
        operation_type='INSERT',
        payload={'name': 'test-1'}
    )
    outbox2 = SyncOutbox.objects.create(
        tenant=tenant,
        record_type='LOAN',
        record_id=uuid.uuid4(),
        operation_type='INSERT',
        payload={'name': 'test-2'}
    )

    assert outbox1.sequence_number == 1
    assert outbox2.sequence_number == 2
    tenant.refresh_from_db()
    assert tenant.outbox_sequence_counter == 2


@pytest.mark.django_db
def test_transaction_bulk_deletion_prevented(lender_setup):
    from django.core.exceptions import ValidationError
    from ledger.admin import TransactionAdmin
    from django.contrib.admin.sites import AdminSite

    user, tenant, token = lender_setup
    borrower = Borrower.objects.create(tenant=tenant, name='Delete Borrower', phone='9876543297')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment',
        status='ACTIVE'
    )
    tx = LedgerTx.objects.create(
        tenant=tenant,
        operation_id=uuid.uuid4(),
        loan=loan,
        transaction_type='COLLECTION',
        amount_paise=10000,
        allocated_principal_paise=10000,
        effective_date='2026-01-01'
    )

    # 1. QuerySet.delete() raises ValidationError
    with pytest.raises(ValidationError, match="bulk deletions are prohibited"):
        LedgerTx.objects.filter(id=tx.id).delete()

    # 2. TransactionAdmin denies delete permission and bulk actions
    admin = TransactionAdmin(LedgerTx, AdminSite())
    assert admin.has_delete_permission(None) is False
    assert admin.actions is None


@pytest.mark.django_db
def test_settled_loan_payment_recorded_as_unallocated_surplus(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')

    borrower = Borrower.objects.create(tenant=tenant, name='Settled Borrower', phone='9876543296')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment',
        status='SETTLED'
    )

    op_id = str(uuid.uuid4())
    url = reverse('sync-push')
    res = api_client.post(url, {
        "operations": [{
            "type": "record_collection",
            "operation_id": op_id,
            "payload": {
                "loan_id": str(loan.id),
                "amount_paise": 25000,
                "effective_date": "2026-01-15",
                "payment_method": "CASH",
                "is_cash": True
            }
        }]
    }, format='json')

    # Failure matrix requirement: Accepted, recorded as surplus, loan remains settled
    assert res.status_code == 200
    assert res.data['results'][0]['status'] == 'ACCEPTED'

    tx = loan.transactions.filter(operation_id=op_id).first()
    assert tx is not None
    assert tx.amount_paise == 25000
    assert tx.unallocated_surplus_paise == 25000
    assert tx.allocated_principal_paise == 0

    loan.refresh_from_db()
    assert loan.status == 'SETTLED'


@pytest.mark.django_db
def test_anti_backdating_penalty_assessment_governed_by_server_clock(api_client, lender_setup):
    from django.utils import timezone
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')

    borrower = Borrower.objects.create(tenant=tenant, name='Backdate Borrower', phone='9876543295')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment',
        status='ACTIVE'
    )
    Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date='2026-01-01',
        effective_due_date='2026-01-01',
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    # Client submits payment claimed to be from 2026-01-01 (backdated)
    # But today (server clock) is past the due date
    op_id = str(uuid.uuid4())
    url = reverse('sync-push')
    res = api_client.post(url, {
        "operations": [{
            "type": "record_collection",
            "operation_id": op_id,
            "payload": {
                "loan_id": str(loan.id),
                "amount_paise": 50000,
                "effective_date": "2026-01-01",
                "payment_method": "CASH",
                "is_cash": True
            }
        }]
    }, format='json')

    assert res.status_code == 200
    assert res.data['results'][0]['status'] == 'ACCEPTED'

    # The collection receipt maintains the client's claimed effective_date
    tx = loan.transactions.filter(operation_id=op_id).first()
    assert str(tx.effective_date) == '2026-01-01'

    # If server's clock is ahead of due date, penalties were assessed up to server clock
    server_today = timezone.now().date().isoformat()
    if server_today > '2026-01-01':
        assert loan.transactions.filter(transaction_type='PENALTY_ASSESSMENT').exists()


@pytest.mark.django_db
def test_reject_fractional_paise_and_boolean_coercion(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    url = reverse('sync-push')

    borrower = Borrower.objects.create(tenant=tenant, name='Strict Borrower', phone='9876543291')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment',
        status='ACTIVE'
    )

    # 1. Float paise must be REJECTED (no lossy truncation)
    res_float = api_client.post(url, {
        "operations": [{
            "type": "record_collection",
            "operation_id": str(uuid.uuid4()),
            "payload": {
                "loan_id": str(loan.id),
                "amount_paise": 100.9,
                "effective_date": "2026-01-01"
            }
        }]
    }, format='json')
    assert res_float.status_code == 200
    assert res_float.data['results'][0]['status'] == 'REJECTED'
    assert 'exact positive integer' in res_float.data['results'][0]['error']

    # 2. Boolean paise must be REJECTED (no True -> 1 coercion)
    res_bool = api_client.post(url, {
        "operations": [{
            "type": "record_collection",
            "operation_id": str(uuid.uuid4()),
            "payload": {
                "loan_id": str(loan.id),
                "amount_paise": True,
                "effective_date": "2026-01-01"
            }
        }]
    }, format='json')
    assert res_bool.status_code == 200
    assert res_bool.data['results'][0]['status'] == 'REJECTED'


@pytest.mark.django_db
def test_reject_unsupported_product_type_without_schedule(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    url = reverse('sync-push')

    borrower = Borrower.objects.create(tenant=tenant, name='Product Borrower', phone='9876543292')
    res = api_client.post(url, {
        "operations": [{
            "type": "create_loan",
            "operation_id": str(uuid.uuid4()),
            "payload": {
                "borrower_id": str(borrower.id),
                "principal_paise": 100000,
                "markup_factor": "0.1",
                "term_months": 1,
                "start_date": "2026-01-01",
                "due_day": 1,
                "product_type": "unsupported_product_type"
            }
        }]
    }, format='json')

    assert res.status_code == 200
    assert res.data['results'][0]['status'] == 'REJECTED'
    assert 'Unsupported product_type' in res.data['results'][0]['error']
    assert not LoanAccount.objects.filter(borrower=borrower).exists()


@pytest.mark.django_db(transaction=True)
def test_concurrent_overdue_collections_under_row_lock(lender_setup):
    import concurrent.futures
    from django.db import connection

    user, tenant, token = lender_setup
    borrower = Borrower.objects.create(
        tenant=tenant,
        name='Concurrent Borrower',
        phone='9876543293'
    )
    loan1 = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=200000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment'
    )
    Kist.objects.create(
        tenant=tenant,
        loan=loan1,
        installment_number=1,
        original_due_date='2026-01-01',
        effective_due_date='2026-01-01',
        principal_component_paise=200000,
        markup_component_paise=20000,
        total_due_paise=220000,
        status='PENDING'
    )

    loan2 = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment'
    )
    Kist.objects.create(
        tenant=tenant,
        loan=loan2,
        installment_number=1,
        original_due_date='2026-01-01',
        effective_due_date='2026-01-01',
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    # 1. Race two threads submitting duplicate operation_id on loan1
    dup_op_id = uuid.uuid4()
    def submit_collection_dup():
        try:
            return ledger_service.record_collection(loan1, 110000, dup_op_id, '2026-01-05')
        finally:
            connection.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(submit_collection_dup)
        f2 = executor.submit(submit_collection_dup)
        res1 = f1.result()
        res2 = f2.result()

    statuses = {res1['status'], res2['status']}
    assert 'SUCCESS' in statuses
    assert statuses.issubset({'SUCCESS', 'ALREADY_EXISTS'})
    # Exactly 1 collection transaction created for dup_op_id
    assert LedgerTx.objects.filter(tenant=tenant, operation_id=dup_op_id).count() == 1

    # 2. Race two concurrent collections on different loans for the same tenant
    op_loan1 = uuid.uuid4()
    op_loan2 = uuid.uuid4()
    def submit_loan1():
        try:
            return ledger_service.record_collection(loan1, 55000, op_loan1, '2026-01-05')
        finally:
            connection.close()

    def submit_loan2():
        try:
            return ledger_service.record_collection(loan2, 55000, op_loan2, '2026-01-05')
        finally:
            connection.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(submit_loan1)
        f2 = executor.submit(submit_loan2)
        r1 = f1.result()
        r2 = f2.result()

    assert r1['status'] == 'SUCCESS'
    assert r2['status'] == 'SUCCESS'

    tx_loan1 = LedgerTx.objects.get(tenant=tenant, operation_id=op_loan1)
    tx_loan2 = LedgerTx.objects.get(tenant=tenant, operation_id=op_loan2)

    # Sequence numbers must be strictly distinct and monotonic under concurrent writes
    assert tx_loan1.sequence_number != tx_loan2.sequence_number
    all_seqs = list(LedgerTx.objects.filter(tenant=tenant).values_list('sequence_number', flat=True))
    assert len(all_seqs) == len(set(all_seqs))



@pytest.mark.django_db
def test_negative_and_nan_markup_factor_rejected(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    borrower = Borrower.objects.create(tenant=tenant, name='Test Borrower', phone='9876543201')

    # 1. Negative markup factor
    res_neg = api_client.post(reverse('sync-push'), {
        'device_id': str(uuid.uuid4()),
        'operations': [{
            'operation_id': str(uuid.uuid4()),
            'type': 'create_loan',
            'timestamp': timezone.now().isoformat(),
            'payload': {
                'borrower_id': str(borrower.id),
                'principal_paise': 10000,
                'markup_factor': '-2',
                'term_months': 1,
                'start_date': '2026-01-01',
                'due_day': 1,
                'product_type': 'instalment'
            }
        }]
    }, format='json')
    assert res_neg.status_code == 200
    assert res_neg.data['results'][0]['status'] == 'REJECTED'
    assert 'markup_factor must be a finite non-negative number' in res_neg.data['results'][0]['error']

    # 2. NaN markup factor
    res_nan = api_client.post(reverse('sync-push'), {
        'device_id': str(uuid.uuid4()),
        'operations': [{
            'operation_id': str(uuid.uuid4()),
            'type': 'create_loan',
            'timestamp': timezone.now().isoformat(),
            'payload': {
                'borrower_id': str(borrower.id),
                'principal_paise': 10000,
                'markup_factor': 'NaN',
                'term_months': 1,
                'start_date': '2026-01-01',
                'due_day': 1,
                'product_type': 'instalment'
            }
        }]
    }, format='json')
    assert res_nan.status_code == 200
    assert res_nan.data['results'][0]['status'] == 'REJECTED'
    assert 'markup_factor must be a finite non-negative number' in res_nan.data['results'][0]['error']
    assert not LoanAccount.objects.filter(borrower=borrower).exists()


@pytest.mark.django_db
def test_modify_schedule_waiver_creates_compensating_reversal_transaction(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    today = timezone.now().date()
    due_date = today - timedelta(days=2)
    revised_date = today + timedelta(days=12)

    borrower = Borrower.objects.create(tenant=tenant, name='Borrower Waiver', phone='9876543202')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=200000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date=str(due_date),
        due_day=due_date.day,
        product_type='instalment'
    )
    kist = Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date=str(due_date),
        effective_due_date=str(due_date),
        principal_component_paise=200000,
        markup_component_paise=20000,
        total_due_paise=220000,
        status='PENDING'
    )

    # Assess penalty of 20,000 paise (2 days late: Jan 2, Jan 3)
    ledger_service.assess_penalties(loan, str(today))
    assert LedgerTx.objects.filter(loan=loan, transaction_type='PENALTY_ASSESSMENT').count() == 2

    # Modify schedule with penalty waiver
    res = api_client.post(reverse('sync-push'), {
        'device_id': str(uuid.uuid4()),
        'operations': [{
            'operation_id': str(uuid.uuid4()),
            'type': 'modify_schedule',
            'timestamp': f'{today}T00:00:00Z',
            'payload': {
                'loan_id': str(loan.id),
                'installment_number': 1,
                'revised_effective_due_date': str(revised_date),
                'effective_date': str(today),
                'accrued_penalty_action': 'WAIVE',
                'waived_penalty_paise': 20000
            }
        }]
    }, format='json')
    assert res.status_code == 200
    assert res.data['results'][0]['status'] == 'ACCEPTED'

    # Compensating REVERSAL transaction created in ledger
    reversal_tx = loan.transactions.filter(transaction_type='REVERSAL').first()
    assert reversal_tx is not None
    assert reversal_tx.forgiven_penalty_paise == 20000

    # Subsequent collection does not charge waived penalty
    loan.refresh_from_db()
    res_coll = ledger_service.record_collection(loan, 220000, uuid.uuid4(), str(today))
    assert res_coll['status'] == 'SUCCESS'
    loan.refresh_from_db()
    coll_tx = loan.transactions.filter(transaction_type='COLLECTION').first()
    assert coll_tx.allocated_penalty_paise == 0
    assert coll_tx.allocated_principal_paise == 200000
    assert coll_tx.allocated_markup_paise == 20000
    assert loan.status == 'SETTLED'


@pytest.mark.django_db
def test_settlement_blocked_when_principal_unpaid(lender_setup):
    user, tenant, token = lender_setup
    borrower = Borrower.objects.create(tenant=tenant, name='Borrower Partial', phone='9876543203')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=200000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment'
    )
    kist = Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date='2026-01-01',
        effective_due_date='2026-01-01',
        principal_component_paise=200000,
        markup_component_paise=20000,
        total_due_paise=220000,
        status='PENDING'
    )

    # Pay only partial amount (110,000 paise)
    res = ledger_service.record_collection(loan, 110000, uuid.uuid4(), '2026-01-01')
    assert res['status'] == 'SUCCESS'
    loan.refresh_from_db()
    assert loan.status == 'ACTIVE'


@pytest.mark.django_db
def test_transaction_queryset_update_bulk_update_prohibited(lender_setup):
    user, tenant, token = lender_setup
    borrower = Borrower.objects.create(tenant=tenant, name='Borrower Immutability', phone='9876543204')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment'
    )
    tx = LedgerTx.objects.create(
        tenant=tenant,
        operation_id=uuid.uuid4(),
        loan=loan,
        transaction_type='COLLECTION',
        amount_paise=110000,
        allocated_principal_paise=100000,
        allocated_markup_paise=10000,
        effective_date='2026-01-01'
    )

    # QuerySet.update() prohibited
    with pytest.raises(ValidationError, match="Transaction records are append-only: bulk updates are prohibited"):
        LedgerTx.objects.filter(id=tx.id).update(amount_paise=99999)

    # QuerySet.bulk_update() prohibited
    with pytest.raises(ValidationError, match="Transaction records are append-only: bulk updates are prohibited"):
        LedgerTx.objects.bulk_update([tx], ['amount_paise'])

    # QuerySet.delete() prohibited
    with pytest.raises(ValidationError, match="Transaction records are append-only: bulk deletions are prohibited"):
        LedgerTx.objects.filter(id=tx.id).delete()


@pytest.mark.django_db
def test_device_collision_cross_tenant_returns_409(api_client, lender_setup, other_lender_setup):
    user1, tenant1, token1 = lender_setup
    user2, tenant2, token2 = other_lender_setup

    dev_id = uuid.uuid4()
    # Tenant 1 owns dev_id
    Device.objects.create(id=dev_id, tenant=tenant1)

    # Tenant 2 tries to push using dev_id
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token2.key}')
    url = reverse('sync-push')
    payload = {
        'device_id': str(dev_id),
        'operations': []
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == 409
    assert 'registered to another tenant' in response.data['error']


@pytest.mark.django_db
def test_modify_schedule_postponement_action_none_preserves_accrued_penalties(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    today = timezone.now().date()
    due_date = today - timedelta(days=4)
    revised_date = today + timedelta(days=20)

    borrower = Borrower.objects.create(tenant=tenant, name='Borrower Overdue', phone='9876543999')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.10'),
        term_months=1,
        start_date=str(due_date),
        due_day=due_date.day,
        product_type='instalment',
        status='ACTIVE'
    )
    kist = Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date=str(due_date),
        effective_due_date=str(due_date),
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    # Postpone overdue kist to revised_date on effective_date today (4 overdue days) with action NONE
    url = reverse('sync-push')
    op_id = str(uuid.uuid4())
    payload = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan.id),
                    'installment_number': 1,
                    'revised_effective_due_date': str(revised_date),
                    'effective_date': str(today),
                    'accrued_penalty_action': 'NONE',
                    'reason': 'Borrower requested extension'
                }
            }
        ]
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['results'][0]['status'] == 'ACCEPTED'

    # Overdue penalties must have been assessed prior to moving due date
    assessed_penalties = LedgerTx.objects.filter(loan=loan, transaction_type='PENALTY_ASSESSMENT')
    assert assessed_penalties.count() == 4
    total_assessed = sum(tx.amount_paise for tx in assessed_penalties)
    assert total_assessed == 40000  # 4 days * 10,000 paise (Rs 100/day)

    # Schedule is updated to new date
    kist.refresh_from_db()
    assert str(kist.effective_due_date) == str(revised_date)

    # Loan balance still includes the accrued penalties
    outstanding_pen = (
        LedgerTx.objects.filter(loan=loan, transaction_type='PENALTY_ASSESSMENT')
        .aggregate(total=models.Sum('amount_paise'))['total'] or 0
    )
    assert outstanding_pen == 40000


@pytest.mark.django_db
def test_modify_schedule_postponement_action_none_with_omitted_effective_date_preserves_accrued_penalties(api_client, lender_setup):
    """
    Verifies that when payload.effective_date is omitted, modify_schedule resolves
    the modification date from operation timestamp and assesses accrued penalties
    before postponing the due date under 'Retain Penalty' (action NONE).
    """
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    today = timezone.now().date()
    due_date = today - timedelta(days=4)
    revised_date = today + timedelta(days=20)

    borrower = Borrower.objects.create(tenant=tenant, name='Borrower Omitted Date', phone='9876543998')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.10'),
        term_months=1,
        start_date=str(due_date),
        due_day=due_date.day,
        product_type='instalment',
        status='ACTIVE'
    )
    kist = Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date=str(due_date),
        effective_due_date=str(due_date),
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    # Postpone overdue kist to revised_date on today without payload.effective_date, using operation timestamp
    url = reverse('sync-push')
    op_id = str(uuid.uuid4())
    payload = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'modify_schedule',
                'timestamp': timezone.now().isoformat(),
                'payload': {
                    'loan_id': str(loan.id),
                    'installment_number': 1,
                    'revised_effective_due_date': str(revised_date),
                    'accrued_penalty_action': 'NONE',
                    'reason': 'Borrower requested extension without explicit effective_date'
                }
            }
        ]
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['results'][0]['status'] == 'ACCEPTED'

    # 4 overdue days must be assessed
    assessed_penalties = LedgerTx.objects.filter(loan=loan, transaction_type='PENALTY_ASSESSMENT')
    assert assessed_penalties.count() == 4
    total_assessed = sum(tx.amount_paise for tx in assessed_penalties)
    assert total_assessed == 40000

    # Schedule is updated to new date
    kist.refresh_from_db()
    assert str(kist.effective_due_date) == str(revised_date)

    # Outstanding penalties remain payable on the ledger
    outstanding_pen = (
        LedgerTx.objects.filter(loan=loan, transaction_type='PENALTY_ASSESSMENT')
        .aggregate(total=models.Sum('amount_paise'))['total'] or 0
    )
    assert outstanding_pen == 40000


@pytest.mark.django_db
def test_modify_schedule_postponement_backdated_client_date_preserves_accrued_penalties_via_server_clock(api_client, lender_setup):
    """
    Verifies that if a client attempts to backdate the postponement effective date to avoid accrued late fees,
    the server clock bound max(effective_date, server_date) governs penalty assessment, preserving all accrued fees.
    """
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    today = timezone.now().date()
    due_date = today - timedelta(days=4)
    revised_date = today + timedelta(days=20)

    borrower = Borrower.objects.create(tenant=tenant, name='Borrower Backdated Date', phone='9876543997')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.10'),
        term_months=1,
        start_date=str(due_date),
        due_day=due_date.day,
        product_type='instalment',
        status='ACTIVE'
    )
    kist = Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date=str(due_date),
        effective_due_date=str(due_date),
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    # Client sends backdated effective_date = due_date (attempting to erase the 4 overdue days)
    url = reverse('sync-push')
    op_id = str(uuid.uuid4())
    payload = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan.id),
                    'installment_number': 1,
                    'revised_effective_due_date': str(revised_date),
                    'effective_date': str(due_date),  # Backdated!
                    'accrued_penalty_action': 'NONE',
                    'reason': 'Borrower attempted backdating'
                }
            }
        ]
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['results'][0]['status'] == 'ACCEPTED'

    # The 4 overdue days must still be assessed up to server clock
    assessed_penalties = LedgerTx.objects.filter(loan=loan, transaction_type='PENALTY_ASSESSMENT')
    assert assessed_penalties.count() == 4
    total_assessed = sum(tx.amount_paise for tx in assessed_penalties)
    assert total_assessed == 40000

    kist.refresh_from_db()
    assert str(kist.effective_due_date) == str(revised_date)


@pytest.mark.django_db
def test_sync_push_create_loan_rejects_excess_markup_precision(api_client, lender_setup):
    """
    Verifies that create_loan rejects markup_factor values that exceed 4 decimal places,
    preventing precision mismatch between initial and extended schedules.
    """
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    borrower = Borrower.objects.create(tenant=tenant, name='Borrower Precision', phone='9876543996')
    url = reverse('sync-push')
    op_id = str(uuid.uuid4())
    payload = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'create_loan',
                'payload': {
                    'borrower_id': str(borrower.id),
                    'principal_paise': 100000,
                    'markup_factor': '0.12345',  # 5 decimal places - excess precision!
                    'term_months': 1,
                    'start_date': '2026-01-01',
                    'due_day': 1,
                    'product_type': 'instalment'
                }
            }
        ]
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['results'][0]['status'] == 'REJECTED'
    assert 'markup_factor cannot exceed 4 decimal places' in response.data['results'][0]['error']


@pytest.mark.django_db
def test_sync_push_malformed_uuid_returns_terminal_rejected(api_client, lender_setup):
    """
    Verifies that malformed UUID fields in sync payloads return terminal REJECTED
    and record a REJECTED SyncLog instead of retrying indefinitely with FAILED.
    """
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    url = reverse('sync-push')

    # 1. create_loan with malformed borrower_id
    op_id_1 = str(uuid.uuid4())
    res1 = api_client.post(url, {
        'operations': [{
            'operation_id': op_id_1,
            'type': 'create_loan',
            'payload': {
                'borrower_id': 'not-a-valid-uuid',
                'principal_paise': 100000,
                'markup_factor': '0.1',
                'term_months': 1,
                'start_date': '2026-01-01',
                'due_day': 1,
                'product_type': 'instalment'
            }
        }]
    }, format='json')
    assert res1.status_code == 200
    assert res1.data['results'][0]['status'] == 'REJECTED'
    log1 = SyncLog.objects.filter(tenant=tenant, operation_id=op_id_1).first()
    assert log1 is not None
    assert log1.status == 'REJECTED'

    # 2. create_borrower with malformed id
    op_id_2 = str(uuid.uuid4())
    res2 = api_client.post(url, {
        'operations': [{
            'operation_id': op_id_2,
            'type': 'create_borrower',
            'payload': {
                'id': 'invalid-borrower-uuid',
                'name': 'Bad UUID Borrower',
                'phone': '9876543000'
            }
        }]
    }, format='json')
    assert res2.status_code == 200
    assert res2.data['results'][0]['status'] == 'REJECTED'
    log2 = SyncLog.objects.filter(tenant=tenant, operation_id=op_id_2).first()
    assert log2 is not None
    assert log2.status == 'REJECTED'

    # 3. modify_schedule with malformed kist_id
    borrower = Borrower.objects.create(tenant=tenant, name='Valid Borrower', phone='9876543001')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment',
        status='ACTIVE'
    )
    op_id_3 = str(uuid.uuid4())
    res3 = api_client.post(url, {
        'operations': [{
            'operation_id': op_id_3,
            'type': 'modify_schedule',
            'payload': {
                'loan_id': str(loan.id),
                'kist_id': 'malformed-kist-uuid',
                'revised_effective_due_date': '2026-02-01'
            }
        }]
    }, format='json')
    assert res3.status_code == 200
    assert res3.data['results'][0]['status'] == 'REJECTED'
    log3 = SyncLog.objects.filter(tenant=tenant, operation_id=op_id_3).first()
    assert log3 is not None
    assert log3.status == 'REJECTED'


@pytest.mark.django_db
def test_zero_value_installment_does_not_accrue_penalties(lender_setup):
    """
    Verifies that an overdue installment with 0 total due (e.g. zero-markup bullet interim kist)
    never accrues late penalties even when overdue and status is PENDING.
    """
    user, tenant, token = lender_setup
    borrower = Borrower.objects.create(tenant=tenant, name='Zero Due Borrower', phone='9876543002')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.0'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='bullet',
        status='ACTIVE'
    )
    kist = Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date='2026-01-01',
        effective_due_date='2026-01-01',
        principal_component_paise=0,
        markup_component_paise=0,
        total_due_paise=0,
        principal_paid_paise=0,
        markup_paid_paise=0,
        status='PENDING'
    )

    # Assess penalties 10 days later
    new_pen = ledger_service.assess_penalties(loan, '2026-01-11')
    assert new_pen == 0
    pen_txs = LedgerTx.objects.filter(loan=loan, transaction_type='PENALTY_ASSESSMENT')
    assert pen_txs.count() == 0


@pytest.mark.django_db
def test_sync_push_invalid_payment_method_returns_terminal_rejected(api_client, lender_setup):
    """
    Verifies that non-string or unsupported payment_method values return terminal REJECTED
    and record a REJECTED SyncLog instead of throwing unhandled 500/FAILED errors.
    """
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    url = reverse('sync-push')

    borrower = Borrower.objects.create(tenant=tenant, name='Pay Method Borrower', phone='9876543003')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment',
        status='ACTIVE'
    )
    Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date='2026-01-01',
        effective_due_date='2026-01-01',
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    # 1. Non-string integer payment_method
    op_id_int = str(uuid.uuid4())
    res1 = api_client.post(url, {
        'operations': [{
            'operation_id': op_id_int,
            'type': 'record_collection',
            'payload': {
                'loan_id': str(loan.id),
                'amount_paise': 50000,
                'payment_method': 12345
            }
        }]
    }, format='json')
    assert res1.status_code == 200
    assert res1.data['results'][0]['status'] == 'REJECTED'
    log1 = SyncLog.objects.filter(tenant=tenant, operation_id=op_id_int).first()
    assert log1 is not None and log1.status == 'REJECTED'

    # 2. Unsupported string payment_method
    op_id_bad = str(uuid.uuid4())
    res2 = api_client.post(url, {
        'operations': [{
            'operation_id': op_id_bad,
            'type': 'record_collection',
            'payload': {
                'loan_id': str(loan.id),
                'amount_paise': 50000,
                'payment_method': 'BITCOIN'
            }
        }]
    }, format='json')
    assert res2.status_code == 200
    assert res2.data['results'][0]['status'] == 'REJECTED'
    log2 = SyncLog.objects.filter(tenant=tenant, operation_id=op_id_bad).first()
    assert log2 is not None and log2.status == 'REJECTED'

    # 3. Disallowed CHEQUE and SYSTEM methods permanently rejected
    for rejected_method in ('CHEQUE', 'SYSTEM'):
        op_id_rej = str(uuid.uuid4())
        res_rej = api_client.post(url, {
            'operations': [{
                'operation_id': op_id_rej,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 50000,
                    'payment_method': rejected_method
                }
            }]
        }, format='json')
        assert res_rej.status_code == 200
        assert res_rej.data['results'][0]['status'] == 'REJECTED'
        log_rej = SyncLog.objects.filter(tenant=tenant, operation_id=op_id_rej).first()
        assert log_rej is not None and log_rej.status == 'REJECTED'

    # 4. Allowed methods: CASH, UPI, BANK_TRANSFER are accepted and persisted
    for allowed_method in ('CASH', 'UPI', 'BANK_TRANSFER'):
        op_id_ok = str(uuid.uuid4())
        res_ok = api_client.post(url, {
            'operations': [{
                'operation_id': op_id_ok,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 1000,
                    'payment_method': allowed_method
                }
            }]
        }, format='json')
        assert res_ok.status_code == 200
        assert res_ok.data['results'][0]['status'] == 'ACCEPTED'
        tx_ok = LedgerTx.objects.filter(loan=loan, operation_id=op_id_ok).first()
        assert tx_ok is not None
        assert tx_ok.payment_method == allowed_method

    # 5. None / null payment_method falls back gracefully to CASH
    op_id_null = str(uuid.uuid4())
    res_null = api_client.post(url, {
        'operations': [{
            'operation_id': op_id_null,
            'type': 'record_collection',
            'payload': {
                'loan_id': str(loan.id),
                'amount_paise': 1000,
                'payment_method': None
            }
        }]
    }, format='json')
    assert res_null.status_code == 200
    assert res_null.data['results'][0]['status'] == 'ACCEPTED'
    tx_null = LedgerTx.objects.filter(loan=loan, operation_id=op_id_null).first()
    assert tx_null is not None
    assert tx_null.payment_method == 'CASH'


@pytest.mark.django_db
def test_rejected_penalty_waiver_rolls_back_schedule_and_outbox_mutations(api_client, lender_setup):
    """
    Validates that a rejected waive_penalty operation completely rolls back
    any schedule extensions, penalty assessments, or outbox rows created during evaluation.
    """
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')

    borrower = Borrower.objects.create(tenant=tenant, name='Rollback Borrower', phone='9876543999')
    # ACTIVE zero-markup bullet loan with a past due date
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0'),
        term_months=1,
        start_date='2025-01-01',
        due_day=1,
        product_type='bullet',
        status='ACTIVE'
    )
    # 1 initial kist for the bullet loan with zero markup
    Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date='2025-02-01',
        effective_due_date='2025-02-01',
        principal_component_paise=0,
        markup_component_paise=0,
        total_due_paise=0,
        status='PENDING'
    )

    initial_kist_count = Kist.objects.filter(loan=loan).count()
    initial_outbox_count = SyncOutbox.objects.filter(tenant=tenant).count()
    initial_tx_count = LedgerTx.objects.filter(loan=loan).count()

    url = reverse('sync-push')
    op_id = str(uuid.uuid4())
    res = api_client.post(url, {
        'operations': [{
            'operation_id': op_id,
            'type': 'waive_penalty',
            'payload': {
                'loan_id': str(loan.id),
                'amount_paise': 50000,
                'effective_date': '2025-02-15'
            }
        }]
    }, format='json')

    assert res.status_code == 200
    assert res.data['results'][0]['status'] == 'REJECTED'

    # Verify all mutations are rolled back
    assert Kist.objects.filter(loan=loan).count() == initial_kist_count
    assert SyncOutbox.objects.filter(tenant=tenant).count() == initial_outbox_count
    assert LedgerTx.objects.filter(loan=loan).count() == initial_tx_count

    # Loan status remains ACTIVE
    loan.refresh_from_db()
    assert loan.status == 'ACTIVE'


@pytest.mark.django_db
def test_future_dated_collection_does_not_assess_future_penalties_or_extend_bullet_schedule(api_client, lender_setup):
    """
    Verifies that a collection with a future timestamp is bounded by the authoritative server clock
    and does not assess unearned future late penalties or extend bullet schedules ahead of server time.
    """
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    today = timezone.now().date()
    future_date = today + timedelta(days=60)

    borrower = Borrower.objects.create(tenant=tenant, name='Borrower Future Date', phone='9876543998')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.10'),
        term_months=1,
        start_date=str(today),
        due_day=today.day,
        product_type='bullet',
        status='ACTIVE'
    )
    kist = Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date=str(today),
        effective_due_date=str(today),
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    initial_kist_count = loan.schedules.count()

    url = reverse('sync-push')
    op_id = str(uuid.uuid4())
    payload = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 5000,
                    'effective_date': str(future_date),
                    'payment_method': 'CASH',
                    'is_cash': True
                }
            }
        ]
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['results'][0]['status'] == 'ACCEPTED'

    # Bullet schedule must not have been extended into the future beyond server clock
    assert loan.schedules.count() == initial_kist_count
    # No future penalty assessments beyond server clock
    future_penalties = LedgerTx.objects.filter(loan=loan, transaction_type='PENALTY_ASSESSMENT', effective_date__gt=today)
    assert future_penalties.count() == 0


@pytest.mark.django_db
def test_future_dated_postponement_does_not_assess_future_penalties(api_client, lender_setup):
    """
    Verifies that a postponement modification with a future effective_date does not assess
    unearned future late penalties beyond the server clock.
    """
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    today = timezone.now().date()
    future_date = today + timedelta(days=45)
    revised_date = today + timedelta(days=90)

    borrower = Borrower.objects.create(tenant=tenant, name='Borrower Future Postpone', phone='9876543999')
    loan = LoanAccount.objects.create(
        tenant=tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.10'),
        term_months=1,
        start_date=str(today),
        due_day=today.day,
        product_type='instalment',
        status='ACTIVE'
    )
    kist = Kist.objects.create(
        tenant=tenant,
        loan=loan,
        installment_number=1,
        original_due_date=str(today),
        effective_due_date=str(today),
        principal_component_paise=100000,
        markup_component_paise=10000,
        total_due_paise=110000,
        status='PENDING'
    )

    url = reverse('sync-push')
    op_id = str(uuid.uuid4())
    payload = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan.id),
                    'installment_number': 1,
                    'revised_effective_due_date': str(revised_date),
                    'effective_date': str(future_date),  # Claimed future modification date
                    'accrued_penalty_action': 'NONE',
                    'reason': 'Future modification test'
                }
            }
        ]
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['results'][0]['status'] == 'ACCEPTED'

    # No penalties assessed beyond server today
    future_penalties = LedgerTx.objects.filter(loan=loan, transaction_type='PENALTY_ASSESSMENT', effective_date__gt=today)
    assert future_penalties.count() == 0


@pytest.mark.django_db
def test_sync_push_record_collection_idempotency_conflict_different_loan(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    b = Borrower.objects.create(tenant=tenant, name='Borrower Idemp', phone='9876543290')
    loan1 = LoanAccount.objects.create(
        tenant=tenant, borrower=b, product_type='instalment',
        principal_paise=100000, markup_factor=Decimal('0.10'),
        term_months=1, due_day=1, status='ACTIVE', start_date='2026-01-01'
    )
    loan2 = LoanAccount.objects.create(
        tenant=tenant, borrower=b, product_type='instalment',
        principal_paise=100000, markup_factor=Decimal('0.10'),
        term_months=1, due_day=1, status='ACTIVE', start_date='2026-01-01'
    )
    url = reverse('sync-push')
    op_id = str(uuid.uuid4())

    # 1. First push for loan1
    payload1 = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan1.id),
                    'amount_paise': 5000,
                    'effective_date': '2026-01-02',
                    'payment_method': 'CASH'
                }
            }
        ]
    }
    res1 = api_client.post(url, payload1, format='json')
    assert res1.status_code == 200
    assert res1.data['results'][0]['status'] == 'ACCEPTED'

    # 2. Conflicting reuse with same op_id but different loan (loan2)
    payload2 = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan2.id),
                    'amount_paise': 5000,
                    'effective_date': '2026-01-02',
                    'payment_method': 'CASH'
                }
            }
        ]
    }
    res2 = api_client.post(url, payload2, format='json')
    assert res2.status_code == 200
    assert res2.data['results'][0]['status'] == 'REJECTED'
    assert 'Idempotency conflict' in res2.data['results'][0]['error']
    # Ensure no transaction recorded on loan2
    assert LedgerTx.objects.filter(loan=loan2).count() == 0


@pytest.mark.django_db
def test_sync_push_record_collection_idempotency_conflict_different_amount(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    b = Borrower.objects.create(tenant=tenant, name='Borrower Idemp Amt', phone='9876543291')
    loan = LoanAccount.objects.create(
        tenant=tenant, borrower=b, product_type='instalment',
        principal_paise=100000, markup_factor=Decimal('0.10'),
        term_months=1, due_day=1, status='ACTIVE', start_date='2026-01-01'
    )
    url = reverse('sync-push')
    op_id = str(uuid.uuid4())

    # 1. First push for 5000 paise
    payload1 = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 5000,
                    'effective_date': '2026-01-02',
                    'payment_method': 'CASH'
                }
            }
        ]
    }
    res1 = api_client.post(url, payload1, format='json')
    assert res1.status_code == 200
    assert res1.data['results'][0]['status'] == 'ACCEPTED'

    # 2. Conflicting reuse with same op_id but different amount (10000 paise)
    payload2 = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 10000,
                    'effective_date': '2026-01-02',
                    'payment_method': 'CASH'
                }
            }
        ]
    }
    res2 = api_client.post(url, payload2, format='json')
    assert res2.status_code == 200
    assert res2.data['results'][0]['status'] == 'REJECTED'
    assert 'Idempotency conflict' in res2.data['results'][0]['error']
    # Ensure amount on recorded transaction remains 5000
    tx = LedgerTx.objects.get(loan=loan, operation_id=op_id)
    assert tx.amount_paise == 5000


@pytest.mark.django_db
def test_sync_push_record_collection_idempotency_conflict_changed_payment_method(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    b = Borrower.objects.create(tenant=tenant, name='Borrower Idemp Method', phone='9876543292')
    loan = LoanAccount.objects.create(
        tenant=tenant, borrower=b, product_type='instalment',
        principal_paise=100000, markup_factor=Decimal('0.10'),
        term_months=1, due_day=1, status='ACTIVE', start_date='2026-01-01'
    )
    url = reverse('sync-push')
    op_id = str(uuid.uuid4())

    # 1. First push with CASH
    payload1 = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 5000,
                    'effective_date': '2026-01-02',
                    'payment_method': 'CASH',
                    'is_cash': True
                }
            }
        ]
    }
    res1 = api_client.post(url, payload1, format='json')
    assert res1.status_code == 200
    assert res1.data['results'][0]['status'] == 'ACCEPTED'

    # 2. Conflicting reuse with UPI
    payload2 = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 5000,
                    'effective_date': '2026-01-02',
                    'payment_method': 'UPI',
                    'is_cash': False
                }
            }
        ]
    }
    res2 = api_client.post(url, payload2, format='json')
    assert res2.status_code == 200
    assert res2.data['results'][0]['status'] == 'REJECTED'
    assert 'Idempotency conflict' in res2.data['results'][0]['error']
    tx = LedgerTx.objects.get(loan=loan, operation_id=op_id)
    assert tx.payment_method == 'CASH'


@pytest.mark.django_db
def test_sync_push_waive_penalty_retry_identical_accepted(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    b = Borrower.objects.create(tenant=tenant, name='Borrower Waive Retry', phone='9876543293')
    loan = LoanAccount.objects.create(
        tenant=tenant, borrower=b, product_type='instalment',
        principal_paise=100000, markup_factor=Decimal('0.10'),
        term_months=1, due_day=1, status='ACTIVE', start_date='2026-01-01'
    )
    # Create an overdue kist and penalty assessment
    Kist.objects.create(
        tenant=tenant, loan=loan, installment_number=1,
        original_due_date='2026-01-01', effective_due_date='2026-01-01',
        principal_component_paise=100000, markup_component_paise=10000,
        total_due_paise=110000, status='PENDING'
    )
    LedgerTx.objects.create(
        tenant=tenant, loan=loan, operation_id=uuid.uuid4(),
        transaction_type='PENALTY_ASSESSMENT', amount_paise=500,
        effective_date='2026-01-02'
    )

    url = reverse('sync-push')
    op_id = str(uuid.uuid4())
    payload = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'waive_penalty',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 500,
                    'effective_date': '2026-01-02',
                    'reason': 'Good conduct waiver'
                }
            }
        ]
    }

    # 1. Initial waiver push
    res1 = api_client.post(url, payload, format='json')
    assert res1.status_code == 200
    assert res1.data['results'][0]['status'] == 'ACCEPTED'

    # 2. Identical retry with same op_id -> must be ACCEPTED (idempotent retry)
    res2 = api_client.post(url, payload, format='json')
    assert res2.status_code == 200
    assert res2.data['results'][0]['status'] == 'ACCEPTED'


@pytest.mark.django_db
def test_sync_push_malformed_retry_returns_rejected_not_500(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    b = Borrower.objects.create(tenant=tenant, name='Borrower Malformed', phone='9876543294')
    loan = LoanAccount.objects.create(
        tenant=tenant, borrower=b, product_type='instalment',
        principal_paise=100000, markup_factor=Decimal('0.10'),
        term_months=1, due_day=1, status='ACTIVE', start_date='2026-01-01'
    )
    url = reverse('sync-push')
    op_id = str(uuid.uuid4())

    # 1. Accepted payment
    payload1 = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 2000,
                    'effective_date': '2026-01-02',
                    'payment_method': 'CASH'
                }
            }
        ]
    }
    res1 = api_client.post(url, payload1, format='json')
    assert res1.status_code == 200
    assert res1.data['results'][0]['status'] == 'ACCEPTED'

    # 2. Malformed retry with string amount inside mixed batch
    valid_op_id = str(uuid.uuid4())
    payload2 = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': "not-an-integer",
                    'effective_date': '2026-01-02'
                }
            },
            {
                'operation_id': valid_op_id,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 1000,
                    'effective_date': '2026-01-02'
                }
            }
        ]
    }
    res2 = api_client.post(url, payload2, format='json')
    assert res2.status_code == 200
    assert len(res2.data['results']) == 2
    # The malformed retry is REJECTED without failing the whole request or 500'ing
    assert res2.data['results'][0]['status'] == 'REJECTED'
    # The valid second operation is processed cleanly
    assert res2.data['results'][1]['status'] == 'ACCEPTED'


@pytest.mark.django_db
def test_sync_push_operation_id_reuse_across_incompatible_types_rejected(api_client, lender_setup):
    user, test_tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    borrower = Borrower.objects.create(tenant=test_tenant, name="Borrower Type", phone="9988776611")
    loan = LoanAccount.objects.create(
        tenant=test_tenant, borrower=borrower,
        principal_paise=100000, markup_factor=Decimal('0.10'),
        term_months=1, due_day=1, status='ACTIVE', start_date='2026-01-01'
    )
    url = reverse('sync-push')

    # 1. Accepted create_borrower operation
    borrower_op_id = str(uuid.uuid4())
    res_b = api_client.post(url, {
        'operations': [
            {
                'operation_id': borrower_op_id,
                'type': 'create_borrower',
                'payload': {
                    'name': 'New Borrower',
                    'phone': '9111222333'
                }
            }
        ]
    }, format='json')
    assert res_b.status_code == 200
    assert res_b.data['results'][0]['status'] == 'ACCEPTED'

    # 2. Reusing borrower creation op_id for record_collection MUST be REJECTED
    res_reuse = api_client.post(url, {
        'operations': [
            {
                'operation_id': borrower_op_id,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 5000,
                    'effective_date': '2026-01-02'
                }
            }
        ]
    }, format='json')
    assert res_reuse.status_code == 200
    assert res_reuse.data['results'][0]['status'] == 'REJECTED'
    assert 'Idempotency conflict' in res_reuse.data['results'][0]['error']

    # 3. Assess penalty and waive penalty
    LedgerTx.objects.create(
        tenant=test_tenant, operation_id=uuid.uuid4(),
        loan=loan, transaction_type='PENALTY_ASSESSMENT',
        amount_paise=1000, effective_date='2026-01-01'
    )
    waiver_op_id = str(uuid.uuid4())
    res_w = api_client.post(url, {
        'operations': [
            {
                'operation_id': waiver_op_id,
                'type': 'waive_penalty',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 500,
                    'effective_date': '2026-01-02'
                }
            }
        ]
    }, format='json')
    assert res_w.status_code == 200
    assert res_w.data['results'][0]['status'] == 'ACCEPTED'

    # 4. Reusing waiver op_id for record_collection MUST be REJECTED
    res_reuse_w = api_client.post(url, {
        'operations': [
            {
                'operation_id': waiver_op_id,
                'type': 'record_collection',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 500,
                    'effective_date': '2026-01-02'
                }
            }
        ]
    }, format='json')
    assert res_reuse_w.status_code == 200
    assert res_reuse_w.data['results'][0]['status'] == 'REJECTED'
    assert 'Idempotency conflict' in res_reuse_w.data['results'][0]['error']


@pytest.mark.django_db
def test_sync_push_waive_penalty_retry_changed_amount_rejected(api_client, lender_setup):
    user, test_tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    borrower = Borrower.objects.create(tenant=test_tenant, name="Borrower Capped", phone="9988776622")
    loan = LoanAccount.objects.create(
        tenant=test_tenant, borrower=borrower,
        principal_paise=100000, markup_factor=Decimal('0.10'),
        term_months=1, due_day=1, status='ACTIVE', start_date='2026-01-01'
    )
    # Overdue penalty of 1000 paise
    LedgerTx.objects.create(
        tenant=test_tenant, operation_id=uuid.uuid4(),
        loan=loan, transaction_type='PENALTY_ASSESSMENT',
        amount_paise=1000, effective_date='2026-01-01'
    )

    url = reverse('sync-push')
    waiver_op_id = str(uuid.uuid4())

    # 1. Client requests 2000 paise waiver, but server caps it at 1000 paise
    res1 = api_client.post(url, {
        'operations': [
            {
                'operation_id': waiver_op_id,
                'type': 'waive_penalty',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 2000,
                    'effective_date': '2026-01-02'
                }
            }
        ]
    }, format='json')
    assert res1.status_code == 200
    assert res1.data['results'][0]['status'] == 'ACCEPTED'

    # Check that forgiven_penalty_paise is 1000
    tx = LedgerTx.objects.get(tenant=test_tenant, operation_id=waiver_op_id)
    assert tx.forgiven_penalty_paise == 1000

    # 2. Changed retry: Client now sends 1000 paise (instead of original 2000 paise requested)
    res_changed = api_client.post(url, {
        'operations': [
            {
                'operation_id': waiver_op_id,
                'type': 'waive_penalty',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 1000,
                    'effective_date': '2026-01-02'
                }
            }
        ]
    }, format='json')
    assert res_changed.status_code == 200
    # Must be REJECTED as a conflict because requested amount changed
    assert res_changed.data['results'][0]['status'] == 'REJECTED'
    assert 'Idempotency conflict' in res_changed.data['results'][0]['error']

    # 3. Identical retry: Client sends original 2000 paise -> ACCEPTED
    res_identical = api_client.post(url, {
        'operations': [
            {
                'operation_id': waiver_op_id,
                'type': 'waive_penalty',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 2000,
                    'effective_date': '2026-01-02'
                }
            }
        ]
    }, format='json')
    assert res_identical.status_code == 200
    assert res_identical.data['results'][0]['status'] == 'ACCEPTED'


@pytest.mark.django_db
def test_sync_push_modify_schedule_retry_changed_attributes_rejected(api_client, lender_setup):
    """
    Verifies that modify_schedule retries with changed attributes (loan_id, installment_number,
    revised_effective_due_date, accrued_penalty_action, waived_penalty_paise) are rejected
    with idempotency conflicts rather than returning ACCEPTED.
    """
    user, test_tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    url = reverse('sync-push')
    borrower = Borrower.objects.create(tenant=test_tenant, name="Mod Sched User", phone="9988776655")
    loan = LoanAccount.objects.create(
        tenant=test_tenant,
        borrower=borrower,
        principal_paise=100000,
        markup_factor=Decimal('0.1'),
        term_months=3,
        start_date="2026-01-01",
        due_day=1,
        product_type='instalment',
        status='ACTIVE'
    )
    kist1 = Kist.objects.create(
        tenant=test_tenant,
        loan=loan,
        installment_number=1,
        original_due_date="2026-02-01",
        effective_due_date="2026-02-01",
        principal_component_paise=33333,
        markup_component_paise=3333,
        total_due_paise=36666,
        status='PENDING'
    )
    kist2 = Kist.objects.create(
        tenant=test_tenant,
        loan=loan,
        installment_number=2,
        original_due_date="2026-03-01",
        effective_due_date="2026-03-01",
        principal_component_paise=33333,
        markup_component_paise=3333,
        total_due_paise=36666,
        status='PENDING'
    )

    mod_op_id = str(uuid.uuid4())

    # 1. Initial valid schedule modification
    res1 = api_client.post(url, {
        'operations': [
            {
                'operation_id': mod_op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan.id),
                    'installment_number': 1,
                    'revised_effective_due_date': '2026-02-15',
                    'accrued_penalty_action': 'NONE',
                    'waived_penalty_paise': 0
                }
            }
        ]
    }, format='json')
    assert res1.status_code == 200
    assert res1.data['results'][0]['status'] == 'ACCEPTED'

    # 2. Identical retry returns ACCEPTED
    res_identical = api_client.post(url, {
        'operations': [
            {
                'operation_id': mod_op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan.id),
                    'installment_number': 1,
                    'revised_effective_due_date': '2026-02-15',
                    'accrued_penalty_action': 'NONE',
                    'waived_penalty_paise': 0
                }
            }
        ]
    }, format='json')
    assert res_identical.status_code == 200
    assert res_identical.data['results'][0]['status'] == 'ACCEPTED'

    # 3. Changed revised_effective_due_date -> REJECTED
    res_changed_date = api_client.post(url, {
        'operations': [
            {
                'operation_id': mod_op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan.id),
                    'installment_number': 1,
                    'revised_effective_due_date': '2026-02-28',
                    'accrued_penalty_action': 'NONE',
                    'waived_penalty_paise': 0
                }
            }
        ]
    }, format='json')
    assert res_changed_date.status_code == 200
    assert res_changed_date.data['results'][0]['status'] == 'REJECTED'
    assert 'Idempotency conflict' in res_changed_date.data['results'][0]['error']

    # 4. Changed kist/installment_number -> REJECTED
    res_changed_kist = api_client.post(url, {
        'operations': [
            {
                'operation_id': mod_op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan.id),
                    'installment_number': 2,
                    'revised_effective_due_date': '2026-02-15',
                    'accrued_penalty_action': 'NONE',
                    'waived_penalty_paise': 0
                }
            }
        ]
    }, format='json')
    assert res_changed_kist.status_code == 200
    assert res_changed_kist.data['results'][0]['status'] == 'REJECTED'
    assert 'Idempotency conflict' in res_changed_kist.data['results'][0]['error']

    # 5. Changed accrued_penalty_action -> REJECTED
    res_changed_action = api_client.post(url, {
        'operations': [
            {
                'operation_id': mod_op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan.id),
                    'installment_number': 1,
                    'revised_effective_due_date': '2026-02-15',
                    'accrued_penalty_action': 'WAIVE',
                    'waived_penalty_paise': 0
                }
            }
        ]
    }, format='json')
    assert res_changed_action.status_code == 200
    assert res_changed_action.data['results'][0]['status'] == 'REJECTED'
    assert 'Idempotency conflict' in res_changed_action.data['results'][0]['error']


@pytest.mark.django_db
def test_sync_push_waive_penalty_future_date_clamped_retry_accepted(api_client, lender_setup):
    from datetime import timedelta
    from django.utils import timezone
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    b = Borrower.objects.create(tenant=tenant, name='Borrower Clamped Retry', phone='9876543297')
    loan = LoanAccount.objects.create(
        tenant=tenant, borrower=b, product_type='instalment',
        principal_paise=100000, markup_factor=Decimal('0.10'),
        term_months=1, due_day=1, status='ACTIVE', start_date='2026-01-01'
    )
    Kist.objects.create(
        tenant=tenant, loan=loan, installment_number=1,
        original_due_date='2026-01-01', effective_due_date='2026-01-01',
        principal_component_paise=100000, markup_component_paise=10000,
        total_due_paise=110000, status='PENDING'
    )
    LedgerTx.objects.create(
        tenant=tenant, loan=loan, operation_id=uuid.uuid4(),
        transaction_type='PENALTY_ASSESSMENT', amount_paise=500,
        effective_date='2026-01-02'
    )

    url = reverse('sync-push')
    op_id = str(uuid.uuid4())
    today = timezone.now().date()
    future_date = today + timedelta(days=30)
    payload = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'waive_penalty',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 500,
                    'effective_date': str(future_date),
                    'reason': 'Future date waiver'
                }
            }
        ]
    }

    # 1. Initial waiver push: server accepts and clamps transaction effective_date to server today
    res1 = api_client.post(url, payload, format='json')
    assert res1.status_code == 200
    assert res1.data['results'][0]['status'] == 'ACCEPTED'

    tx = LedgerTx.objects.get(tenant=tenant, operation_id=op_id)
    assert str(tx.effective_date) == str(today)

    # 2. Identical retry with original future date -> must return ACCEPTED (not falsely rejected due to clamping)
    res_retry = api_client.post(url, payload, format='json')
    assert res_retry.status_code == 200
    assert res_retry.data['results'][0]['status'] == 'ACCEPTED'

    # 3. Retry with changed future date -> must return REJECTED
    changed_future = today + timedelta(days=60)
    res_changed = api_client.post(url, {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'waive_penalty',
                'payload': {
                    'loan_id': str(loan.id),
                    'amount_paise': 500,
                    'effective_date': str(changed_future),
                    'reason': 'Future date waiver'
                }
            }
        ]
    }, format='json')
    assert res_changed.status_code == 200
    assert res_changed.data['results'][0]['status'] == 'REJECTED'
    assert 'Idempotency conflict' in res_changed.data['results'][0]['error']


@pytest.mark.django_db
def test_sync_push_modify_schedule_waiver_retry_capped_or_zero_accepted(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    b = Borrower.objects.create(tenant=tenant, name='Borrower Mod Waive Retry', phone='9876543298')
    loan = LoanAccount.objects.create(
        tenant=tenant, borrower=b, product_type='instalment',
        principal_paise=100000, markup_factor=Decimal('0.10'),
        term_months=2, due_day=1, status='ACTIVE', start_date='2026-01-01'
    )
    k1 = Kist.objects.create(
        tenant=tenant, loan=loan, installment_number=1,
        original_due_date='2026-01-01', effective_due_date='2026-01-01',
        principal_component_paise=50000, markup_component_paise=5000,
        total_due_paise=55000, status='PENDING'
    )
    Kist.objects.create(
        tenant=tenant, loan=loan, installment_number=2,
        original_due_date='2026-02-01', effective_due_date='2026-02-01',
        principal_component_paise=50000, markup_component_paise=5000,
        total_due_paise=55000, status='PENDING'
    )
    # 500 paise penalty assessed
    LedgerTx.objects.create(
        tenant=tenant, loan=loan, operation_id=uuid.uuid4(),
        transaction_type='PENALTY_ASSESSMENT', amount_paise=500,
        effective_date='2026-01-02'
    )

    url = reverse('sync-push')
    mod_op_id = str(uuid.uuid4())
    # Client requests WAIVE with waived_penalty_paise=0 (meaning waive full accrued penalty)
    payload_waive_zero = {
        'operations': [
            {
                'operation_id': mod_op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan.id),
                    'installment_number': 1,
                    'revised_effective_due_date': '2026-01-15',
                    'accrued_penalty_action': 'WAIVE',
                    'waived_penalty_paise': 0
                }
            }
        ]
    }

    # 1. Initial push: succeeds, ScheduleModification records actual_waived=500
    res1 = api_client.post(url, payload_waive_zero, format='json')
    assert res1.status_code == 200
    assert res1.data['results'][0]['status'] == 'ACCEPTED'

    mod = ScheduleModification.objects.get(tenant=tenant, operation_id=mod_op_id)
    assert mod.waived_penalty_paise > 0

    # 2. Identical retry with original requested waived_penalty_paise=0 -> must return ACCEPTED
    res_retry = api_client.post(url, payload_waive_zero, format='json')
    assert res_retry.status_code == 200
    assert res_retry.data['results'][0]['status'] == 'ACCEPTED'

    # 3. Changed retry with waived_penalty_paise=200 -> must return REJECTED
    res_changed = api_client.post(url, {
        'operations': [
            {
                'operation_id': mod_op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan.id),
                    'installment_number': 1,
                    'revised_effective_due_date': '2026-01-15',
                    'accrued_penalty_action': 'WAIVE',
                    'waived_penalty_paise': 200
                }
            }
        ]
    }, format='json')
    assert res_changed.status_code == 200
    assert res_changed.data['results'][0]['status'] == 'REJECTED'
    assert 'Idempotency conflict' in res_changed.data['results'][0]['error']

    # 4. Another loan with capped excess waiver (requested 50,000,000 paise exceeding total outstanding)
    b2 = Borrower.objects.create(tenant=tenant, name='Borrower Capped Waive', phone='9876543299')
    loan2 = LoanAccount.objects.create(
        tenant=tenant, borrower=b2, product_type='instalment',
        principal_paise=100000, markup_factor=Decimal('0.10'),
        term_months=1, due_day=1, status='ACTIVE', start_date='2026-01-01'
    )
    Kist.objects.create(
        tenant=tenant, loan=loan2, installment_number=1,
        original_due_date='2026-01-01', effective_due_date='2026-01-01',
        principal_component_paise=100000, markup_component_paise=10000,
        total_due_paise=110000, status='PENDING'
    )
    LedgerTx.objects.create(
        tenant=tenant, loan=loan2, operation_id=uuid.uuid4(),
        transaction_type='PENALTY_ASSESSMENT', amount_paise=500,
        effective_date='2026-01-02'
    )

    capped_op_id = str(uuid.uuid4())
    payload_capped = {
        'operations': [
            {
                'operation_id': capped_op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan2.id),
                    'installment_number': 1,
                    'revised_effective_due_date': '2026-01-20',
                    'accrued_penalty_action': 'CAP',
                    'waived_penalty_paise': 50000000
                }
            }
        ]
    }
    res_cap1 = api_client.post(url, payload_capped, format='json')
    assert res_cap1.status_code == 200
    assert res_cap1.data['results'][0]['status'] == 'ACCEPTED'

    mod2 = ScheduleModification.objects.get(tenant=tenant, operation_id=capped_op_id)
    assert mod2.waived_penalty_paise < 50000000  # Capped to actual outstanding penalty
    assert mod2.waived_penalty_paise > 0

    # Identical retry with original requested 50,000,000 paise -> ACCEPTED
    res_cap_retry = api_client.post(url, payload_capped, format='json')
    assert res_cap_retry.status_code == 200
    assert res_cap_retry.data['results'][0]['status'] == 'ACCEPTED'

    # Changed retry with 40,000,000 paise -> REJECTED
    res_cap_changed = api_client.post(url, {
        'operations': [
            {
                'operation_id': capped_op_id,
                'type': 'modify_schedule',
                'payload': {
                    'loan_id': str(loan2.id),
                    'installment_number': 1,
                    'revised_effective_due_date': '2026-01-20',
                    'accrued_penalty_action': 'CAP',
                    'waived_penalty_paise': 40000000
                }
            }
        ]
    }, format='json')
    assert res_cap_changed.status_code == 200
    assert res_cap_changed.data['results'][0]['status'] == 'REJECTED'
    assert 'Idempotency conflict' in res_cap_changed.data['results'][0]['error']


@pytest.mark.django_db
def test_create_loan_rejects_settled_status(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
    url = reverse('sync-push')

    borrower = Borrower.objects.create(tenant=tenant, name='Meera Bai', phone='9876543210')
    loan_id = str(uuid.uuid4())
    op_id = str(uuid.uuid4())

    payload = {
        'operations': [
            {
                'operation_id': op_id,
                'type': 'create_loan',
                'payload': {
                    'id': loan_id,
                    'borrower_id': str(borrower.id),
                    'principal_paise': 2000000,
                    'markup_factor': '0.1000',
                    'term_months': 2,
                    'start_date': '2026-01-01',
                    'due_day': 10,
                    'product_type': 'instalment',
                    'status': 'SETTLED'
                }
            }
        ]
    }

    response = api_client.post(url, payload, format='json')
    assert response.status_code == 200
    assert response.data['results'][0]['status'] == 'REJECTED'
    assert 'SETTLED' in response.data['results'][0]['error']
    assert not LoanAccount.objects.filter(id=loan_id).exists()


@pytest.mark.django_db
def test_portfolio_summary_view_and_tenant_isolation(api_client, lender_setup):
    user1, tenant1, token1 = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token1.key}')
    url = reverse('portfolio-summary')

    b1 = Borrower.objects.create(tenant=tenant1, name='Farmer 1', phone='9123456781')
    loan1 = LoanAccount.objects.create(
        tenant=tenant1, borrower=b1, principal_paise=500000, markup_factor=Decimal('0.1000'),
        term_months=1, start_date='2026-01-01', due_day=1, product_type='instalment', status='ACTIVE'
    )
    Kist.objects.create(
        tenant=tenant1, loan=loan1, installment_number=1, original_due_date='2026-02-01', effective_due_date='2026-02-01',
        principal_component_paise=500000, markup_component_paise=50000, total_due_paise=550000, status='PENDING'
    )

    loan2 = LoanAccount.objects.create(
        tenant=tenant1, borrower=b1, principal_paise=300000, markup_factor=Decimal('0.1000'),
        term_months=1, start_date='2026-01-01', due_day=1, product_type='instalment', status='SETTLED'
    )
    Kist.objects.create(
        tenant=tenant1, loan=loan2, installment_number=1, original_due_date='2026-02-01', effective_due_date='2026-02-01',
        principal_component_paise=300000, markup_component_paise=30000, total_due_paise=330000,
        principal_paid_paise=300000, markup_paid_paise=30000, status='PAID'
    )

    # Collection on loan 2
    LedgerTx.objects.create(
        tenant=tenant1, operation_id=str(uuid.uuid4()), loan=loan2, transaction_type='COLLECTION',
        amount_paise=330000, allocated_principal_paise=300000, allocated_markup_paise=30000,
        allocated_penalty_paise=0, unallocated_surplus_paise=0, effective_date='2026-02-01'
    )

    # Tenant 2 setup for isolation check
    u2 = user1.__class__.objects.create_user(username='other_lender', password='pwd')
    from tenants.models import Tenant
    Tenant.objects.create(name='Other Tenant', owner=u2)
    from rest_framework.authtoken.models import Token
    tok2 = Token.objects.create(user=u2)

    # Query tenant 1
    resp = api_client.get(url)
    assert resp.status_code == 200
    data = resp.data
    assert data['active_loans_count'] == 1
    assert data['settled_loans_count'] == 1
    assert data['total_loans_count'] == 2
    assert data['total_principal_paise'] == 800000
    assert data['total_collections_paise'] == 330000
    assert data['total_collections_count'] == 1
    assert data['total_outstanding_balance_paise'] == 550000

    # Query tenant 2
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {tok2.key}')
    resp2 = api_client.get(url)
    assert resp2.status_code == 200
    data2 = resp2.data
    assert data2['total_loans_count'] == 0
    assert data2['total_principal_paise'] == 0














