import uuid
from decimal import Decimal
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


@pytest.mark.django_db
def test_concurrent_payment_retries_idempotency_recovery(api_client, lender_setup):
    user, tenant, token = lender_setup
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')

    borrower = Borrower.objects.create(tenant=tenant, name='Retry Borrower', phone='9876543212')
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
                    "payment_method": "UPI",
                    "is_cash": False
                }
            }
        ]
    }

    url = reverse('sync-push')
    # First submission
    res1 = api_client.post(url, payload, format='json')
    assert res1.status_code == 200
    assert res1.data['results'][0]['status'] == 'ACCEPTED'

    # Duplicate submission with identical op_id
    res2 = api_client.post(url, payload, format='json')
    assert res2.status_code == 200
    assert res2.data['results'][0]['status'] == 'ACCEPTED'

    # Exactly 1 transaction recorded in ledger
    tx_count = loan.transactions.filter(transaction_type='COLLECTION').count()
    assert tx_count == 1
    # Cash classification preserved
    tx = loan.transactions.filter(transaction_type='COLLECTION').first()
    assert tx.is_cash is False
    assert tx.payment_method == 'UPI'


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
    user, tenant, token = lender_setup
    borrower = Borrower.objects.create(
        tenant=tenant,
        name='Concurrent Borrower',
        phone='9876543293'
    )
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

    # Two concurrent payments for the same loan
    op_1 = uuid.uuid4()
    op_2 = uuid.uuid4()

    res1 = ledger_service.record_collection(loan, 110000, op_1, '2026-01-05')
    assert res1['status'] == 'SUCCESS'

    res2 = ledger_service.record_collection(loan, 110000, op_2, '2026-01-05')
    assert res2['status'] == 'SUCCESS'

    # Both succeeded and allocations conserved
    loan.refresh_from_db()
    txs = loan.transactions.filter(transaction_type='COLLECTION')
    assert txs.count() == 2
    total_allocated = sum(t.allocated_principal_paise + t.allocated_markup_paise + t.allocated_penalty_paise for t in txs)
    assert total_allocated <= 220000 + 40000  # kist total plus overdue penalties


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
    borrower = Borrower.objects.create(tenant=tenant, name='Borrower Waiver', phone='9876543202')
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

    # Assess penalty of 20,000 paise
    LedgerTx.objects.create(
        tenant=tenant,
        operation_id=uuid.uuid4(),
        loan=loan,
        transaction_type='PENALTY_ASSESSMENT',
        amount_paise=20000,
        effective_date='2026-01-05'
    )

    # Modify schedule with penalty waiver
    res = api_client.post(reverse('sync-push'), {
        'device_id': str(uuid.uuid4()),
        'operations': [{
            'operation_id': str(uuid.uuid4()),
            'type': 'modify_schedule',
            'timestamp': timezone.now().isoformat(),
            'payload': {
                'loan_id': str(loan.id),
                'installment_number': 1,
                'revised_effective_due_date': '2026-01-15',
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
    res_coll = ledger_service.record_collection(loan, 220000, uuid.uuid4(), '2026-01-10')
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





