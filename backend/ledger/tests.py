import uuid
from decimal import Decimal
import pytest
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from tenants.models import Tenant, Device
from ledger.models import (
    Borrower,
    LoanAccount,
    Kist,
    Transaction,
    ScheduleModification,
    SyncLog,
    SyncOutbox,
)

@pytest.fixture
def tenant_fixture():
    user = User.objects.create_user(username='lender1', password='password')
    tenant = Tenant.objects.create(name='Lender 1 Workspace', owner=user)
    return tenant

@pytest.fixture
def other_tenant_fixture():
    user = User.objects.create_user(username='lender2', password='password')
    tenant = Tenant.objects.create(name='Lender 2 Workspace', owner=user)
    return tenant

@pytest.fixture
def borrower_fixture(tenant_fixture):
    return Borrower.objects.create(
        tenant=tenant_fixture,
        name='Ramesh Kumar',
        phone='9876543210'
    )

@pytest.fixture
def loan_fixture(tenant_fixture, borrower_fixture):
    return LoanAccount.objects.create(
        tenant=tenant_fixture,
        borrower=borrower_fixture,
        principal_paise=2400000, # ₹24,000
        markup_factor=Decimal('0.3000'), # 30%
        term_months=12,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment'
    )

@pytest.mark.django_db
def test_borrower_phone_unique_per_tenant(tenant_fixture, other_tenant_fixture):
    Borrower.objects.create(tenant=tenant_fixture, name='Borrower 1', phone='9999999999')
    
    # Same phone under different tenant is allowed
    borrower_other = Borrower.objects.create(tenant=other_tenant_fixture, name='Borrower 2', phone='9999999999')
    assert borrower_other.id is not None

    # Duplicate phone within same tenant raises IntegrityError
    with pytest.raises(IntegrityError):
        Borrower.objects.create(tenant=tenant_fixture, name='Duplicate Phone', phone='9999999999')

@pytest.mark.django_db
def test_loan_and_kist_creation(loan_fixture, tenant_fixture):
    kist1 = Kist.objects.create(
        tenant=tenant_fixture,
        loan=loan_fixture,
        installment_number=1,
        original_due_date='2026-02-01',
        effective_due_date='2026-02-01',
        principal_component_paise=200000,
        markup_component_paise=60000,
        total_due_paise=260000,
    )
    assert kist1.status == 'PENDING'
    assert kist1.principal_paid_paise == 0

    # Duplicate installment number on same loan raises IntegrityError
    with pytest.raises(IntegrityError):
        Kist.objects.create(
            tenant=tenant_fixture,
            loan=loan_fixture,
            installment_number=1,
            original_due_date='2026-02-01',
            effective_due_date='2026-02-01',
            principal_component_paise=200000,
            markup_component_paise=60000,
            total_due_paise=260000,
        )

@pytest.mark.django_db
def test_transaction_conservation_validation(tenant_fixture, loan_fixture):
    # Valid transaction satisfying conservation: allocations sum to amount_paise
    tx = Transaction(
        tenant=tenant_fixture,
        operation_id=uuid.uuid4(),
        loan=loan_fixture,
        transaction_type='COLLECTION',
        amount_paise=260000,
        allocated_principal_paise=200000,
        allocated_markup_paise=60000,
        allocated_penalty_paise=0,
        unallocated_surplus_paise=0,
        effective_date='2026-02-01',
    )
    tx.save()
    assert tx.sequence_number == 1

    # Violation: allocations do not sum to amount_paise
    invalid_tx = Transaction(
        tenant=tenant_fixture,
        operation_id=uuid.uuid4(),
        loan=loan_fixture,
        transaction_type='COLLECTION',
        amount_paise=260000,
        allocated_principal_paise=100000, # Only 160000 allocated instead of 260000
        allocated_markup_paise=60000,
        allocated_penalty_paise=0,
        unallocated_surplus_paise=0,
        effective_date='2026-02-01',
    )
    with pytest.raises(ValidationError) as exc:
        invalid_tx.save()
    assert "Conservation violation" in str(exc.value)

@pytest.mark.django_db
def test_transaction_append_only_immutability(tenant_fixture, loan_fixture):
    tx = Transaction.objects.create(
        tenant=tenant_fixture,
        operation_id=uuid.uuid4(),
        loan=loan_fixture,
        transaction_type='COLLECTION',
        amount_paise=100000,
        allocated_principal_paise=100000,
        allocated_markup_paise=0,
        allocated_penalty_paise=0,
        unallocated_surplus_paise=0,
        effective_date='2026-02-01',
    )
    
    # Attempting to update existing transaction raises ValidationError
    tx.amount_paise = 200000
    with pytest.raises(ValidationError) as exc:
        tx.save()
    assert "append-only" in str(exc.value)

    # Attempting to delete existing transaction raises ValidationError
    with pytest.raises(ValidationError) as exc:
        tx.delete()
    assert "append-only" in str(exc.value)

@pytest.mark.django_db
def test_transaction_per_tenant_sequential_numbering(tenant_fixture, other_tenant_fixture, loan_fixture):
    other_borrower = Borrower.objects.create(tenant=other_tenant_fixture, name='B2', phone='8888888888')
    other_loan = LoanAccount.objects.create(
        tenant=other_tenant_fixture,
        borrower=other_borrower,
        principal_paise=1000000,
        markup_factor=Decimal('0.1000'),
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='bullet'
    )

    # First transaction for Tenant 1
    t1_tx1 = Transaction.objects.create(
        tenant=tenant_fixture,
        operation_id=uuid.uuid4(),
        loan=loan_fixture,
        transaction_type='PENALTY_ASSESSMENT',
        amount_paise=10000,
        effective_date='2026-02-02'
    )
    assert t1_tx1.sequence_number == 1

    # First transaction for Tenant 2 starts at sequence 1
    t2_tx1 = Transaction.objects.create(
        tenant=other_tenant_fixture,
        operation_id=uuid.uuid4(),
        loan=other_loan,
        transaction_type='PENALTY_ASSESSMENT',
        amount_paise=10000,
        effective_date='2026-02-02'
    )
    assert t2_tx1.sequence_number == 1

    # Second transaction for Tenant 1 increments to 2
    t1_tx2 = Transaction.objects.create(
        tenant=tenant_fixture,
        operation_id=uuid.uuid4(),
        loan=loan_fixture,
        transaction_type='PENALTY_ASSESSMENT',
        amount_paise=10000,
        effective_date='2026-02-03'
    )
    assert t1_tx2.sequence_number == 2

@pytest.mark.django_db
def test_sync_outbox_and_sync_log(tenant_fixture, borrower_fixture):
    device = Device.objects.create(tenant=tenant_fixture, push_token='test-device-token')
    
    op_id = uuid.uuid4()
    sync_log = SyncLog.objects.create(
        tenant=tenant_fixture,
        device=device,
        operation_id=op_id,
        status='ACCEPTED'
    )
    assert sync_log.status == 'ACCEPTED'

    outbox1 = SyncOutbox.objects.create(
        tenant=tenant_fixture,
        record_type='BORROWER',
        record_id=borrower_fixture.id,
        operation_type='INSERT',
        payload={'name': borrower_fixture.name, 'phone': borrower_fixture.phone}
    )
    assert outbox1.sequence_number == 1

    outbox2 = SyncOutbox.objects.create(
        tenant=tenant_fixture,
        record_type='BORROWER',
        record_id=borrower_fixture.id,
        operation_type='UPDATE',
        payload={'name': 'Ramesh K'}
    )
    assert outbox2.sequence_number == 2

@pytest.mark.django_db
def test_schedule_modification_tracking(tenant_fixture, loan_fixture):
    kist = Kist.objects.create(
        tenant=tenant_fixture,
        loan=loan_fixture,
        installment_number=1,
        original_due_date='2026-02-01',
        effective_due_date='2026-02-01',
        principal_component_paise=200000,
        markup_component_paise=60000,
        total_due_paise=260000
    )
    mod = ScheduleModification.objects.create(
        tenant=tenant_fixture,
        loan=loan_fixture,
        kist=kist,
        operation_id=uuid.uuid4(),
        original_due_date='2026-02-01',
        prior_effective_due_date='2026-02-01',
        revised_effective_due_date='2026-02-15',
        reason='Borrower requested extension due to festival',
        accrued_penalty_action='WAIVE',
        waived_penalty_paise=10000
    )
    assert mod.revised_effective_due_date == '2026-02-15'
    assert mod.accrued_penalty_action == 'WAIVE'
