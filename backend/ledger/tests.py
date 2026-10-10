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


# ==============================================================================
# Phase 3: Financial Engine Core Tests (Ported from V1 Fixtures)
# ==============================================================================

from ledger.engine.allocation import (
    KistAllocationState,
    AllocationInput,
    allocate_payment,
)
from ledger.engine.penalty import (
    PenaltyRule,
    OverdueKist,
    LoanPenaltyState,
    calculate_new_penalties,
)
from ledger.engine.schedule import (
    divide_paise,
    calculate_next_due_date,
    generate_schedule,
)
from ledger.engine.ledger_service import (
    record_collection,
    assess_penalties,
)

def to_paise(rupees: int) -> int:
    return rupees * 100

def test_allocation_allocates_fully_to_oldest_unpaid_instalment():
    kists = [
        KistAllocationState(kist_number=1, amount_due=to_paise(2600), principal_due=to_paise(2000), markup_due=to_paise(600)),
        KistAllocationState(kist_number=2, amount_due=to_paise(2600), principal_due=to_paise(2000), markup_due=to_paise(600)),
    ]
    result = allocate_payment(AllocationInput(payment_amount=to_paise(2600), kists=kists, outstanding_penalty=0))

    assert len(result.allocations) == 1
    assert result.allocations[0].allocated_to_kist == 1
    assert result.allocations[0].amount == to_paise(2600)
    assert result.updated_kists[0].amount_paid == to_paise(2600)
    assert result.updated_kists[0].status == 'PAID'
    assert result.remaining_penalty == 0
    assert result.unallocated_funds == 0

def test_allocation_instalment_first_then_penalty():
    kists = [
        KistAllocationState(kist_number=1, amount_due=to_paise(2600), principal_due=to_paise(2000), markup_due=to_paise(600))
    ]
    # ₹2,600 instalment + ₹500 penalty. Pay ₹3,100.
    result = allocate_payment(AllocationInput(payment_amount=to_paise(3100), kists=kists, outstanding_penalty=to_paise(500)))

    assert result.updated_kists[0].status == 'PAID'
    assert result.remaining_penalty == 0
    penalty_alloc = next(a for a in result.allocations if a.allocated_to_penalty > 0)
    assert penalty_alloc.allocated_to_penalty == to_paise(500)
    assert result.unallocated_funds == 0

def test_allocation_marks_instalment_paid_and_keeps_penalty_outstanding():
    kists = [
        KistAllocationState(kist_number=1, amount_due=to_paise(2600), principal_due=to_paise(2000), markup_due=to_paise(600))
    ]
    # ₹2,600 instalment + ₹500 penalty. Pay ₹2,600.
    result = allocate_payment(AllocationInput(payment_amount=to_paise(2600), kists=kists, outstanding_penalty=to_paise(500)))

    assert result.updated_kists[0].status == 'PAID'
    assert result.updated_kists[0].amount_paid == to_paise(2600)
    assert result.remaining_penalty == to_paise(500)
    assert result.unallocated_funds == 0

def test_allocation_excess_to_next_unpaid_instalment():
    kists = [
        KistAllocationState(kist_number=1, amount_due=to_paise(2600), principal_due=to_paise(2000), markup_due=to_paise(600)),
        KistAllocationState(kist_number=2, amount_due=to_paise(2600), principal_due=to_paise(2000), markup_due=to_paise(600)),
    ]
    # Pay ₹2,700 with 0 penalty
    result = allocate_payment(AllocationInput(payment_amount=to_paise(2700), kists=kists, outstanding_penalty=0))

    assert result.updated_kists[0].status == 'PAID'
    assert result.updated_kists[1].amount_paid == to_paise(100)
    assert result.updated_kists[1].status == 'PARTIALLY_PAID'
    second_alloc = next(a for a in result.allocations if a.allocated_to_kist == 2)
    assert second_alloc.amount == to_paise(100)

def test_allocation_cascades_large_payment():
    # Pay ₹6,000. Penalty ₹500.
    kists = [
        KistAllocationState(kist_number=1, amount_due=to_paise(2600), principal_due=to_paise(2000), markup_due=to_paise(600), is_due=True),
        KistAllocationState(kist_number=2, amount_due=to_paise(2600), principal_due=to_paise(2000), markup_due=to_paise(600), is_due=True),
        KistAllocationState(kist_number=3, amount_due=to_paise(2600), principal_due=to_paise(2000), markup_due=to_paise(600), is_due=False),
    ]
    result = allocate_payment(AllocationInput(payment_amount=to_paise(6000), kists=kists, outstanding_penalty=to_paise(500)))

    # Pay K1 (2600) -> Pay K2 (2600) -> Pay Penalty (500) -> Pay K3 (300)
    assert result.updated_kists[0].status == 'PAID'
    assert result.updated_kists[1].status == 'PAID'
    assert result.remaining_penalty == 0
    assert result.updated_kists[2].amount_paid == to_paise(300)
    assert result.updated_kists[2].status == 'PARTIALLY_PAID'

def test_allocation_resolves_pending_status_if_fully_paid():
    kists = [
        KistAllocationState(kist_number=1, amount_due=to_paise(2600), principal_due=to_paise(2000), markup_due=to_paise(600), amount_paid=to_paise(2600), status='PENDING')
    ]
    result = allocate_payment(AllocationInput(payment_amount=0, kists=kists, outstanding_penalty=0))
    assert result.updated_kists[0].status == 'PAID'

def test_allocation_preserves_overpaid_kist():
    kists = [
        KistAllocationState(kist_number=1, amount_due=to_paise(2600), principal_due=to_paise(2000), markup_due=to_paise(600), amount_paid=to_paise(3000), status='PENDING')
    ]
    result = allocate_payment(AllocationInput(payment_amount=to_paise(100), kists=kists, outstanding_penalty=0))
    assert result.updated_kists[0].amount_paid == to_paise(3000)
    assert result.updated_kists[0].status == 'PAID'


# --- Penalty Engine V1 Fixture Tests ---

def test_penalty_single_kist_5_days_overdue():
    state = LoanPenaltyState(
        loan_id='1',
        rule=PenaltyRule(daily_rate_paise=to_paise(100)),
        kists=[
            OverdueKist(kist_number=1, due_date='2026-10-01', amount_due=to_paise(2600), amount_paid=0, is_fully_paid=False)
        ],
        assessed_dates=set()
    )
    # 5 days overdue (Oct 2, 3, 4, 5, 6)
    new_penalty, new_dates = calculate_new_penalties(state, '2026-10-06')
    assert new_penalty == to_paise(500)
    assert len(new_dates) == 5
    assert '2026-10-02' in new_dates
    assert '2026-10-06' in new_dates

def test_penalty_multiple_overdue_kists_do_not_duplicate():
    state = LoanPenaltyState(
        loan_id='1',
        rule=PenaltyRule(daily_rate_paise=to_paise(100)),
        kists=[
            OverdueKist(kist_number=1, due_date='2026-09-01', amount_due=to_paise(2600), amount_paid=0, is_fully_paid=False),
            OverdueKist(kist_number=2, due_date='2026-10-01', amount_due=to_paise(2600), amount_paid=0, is_fully_paid=False),
        ],
        assessed_dates={f"2026-09-{d:02d}" for d in range(2, 31)} | {'2026-10-01'}
    )
    new_penalty, new_dates = calculate_new_penalties(state, '2026-10-06')
    assert new_penalty == to_paise(500)
    assert len(new_dates) == 5

def test_penalty_stops_when_kists_fully_paid():
    state = LoanPenaltyState(
        loan_id='1',
        rule=PenaltyRule(daily_rate_paise=to_paise(100)),
        kists=[
            OverdueKist(kist_number=1, due_date='2026-10-01', amount_due=to_paise(2600), amount_paid=to_paise(2600), is_fully_paid=True)
        ],
        assessed_dates=set()
    )
    new_penalty, new_dates = calculate_new_penalties(state, '2026-10-06')
    assert new_penalty == 0
    assert len(new_dates) == 0


# --- Schedule Engine Tests ---

def test_schedule_divide_paise_conservation():
    # 260001 paise divided across 12 installments
    parts = divide_paise(260001, 12)
    assert len(parts) == 12
    assert sum(parts) == 260001

def test_schedule_month_end_due_date_calculation():
    # Adding 1 month to Jan 31 gives Feb 28 (or 29)
    d1 = calculate_next_due_date('2026-01-31', 1, 31)
    assert d1 == '2026-02-28'
    # Adding 2 months to Jan 31 gives Mar 31
    d2 = calculate_next_due_date('2026-01-31', 2, 31)
    assert d2 == '2026-03-31'
    # Adding 3 months gives Apr 30
    d3 = calculate_next_due_date('2026-01-31', 3, 31)
    assert d3 == '2026-04-30'

def test_schedule_generation_instalment_and_bullet():
    instalment_sched = generate_schedule(
        principal_paise=2400000,
        markup_factor=Decimal('0.3000'),
        term_months=12,
        start_date_str='2026-01-01',
        due_day=1,
        product_type='instalment'
    )
    assert len(instalment_sched) == 12
    assert sum(k.principal_due for k in instalment_sched) == 2400000
    assert sum(k.markup_due for k in instalment_sched) == 720000

    bullet_sched = generate_schedule(
        principal_paise=3000000,
        markup_factor=Decimal('0.1000'),
        term_months=1,
        start_date_str='2026-01-01',
        due_day=1,
        product_type='bullet'
    )
    assert len(bullet_sched) == 1
    assert bullet_sched[0].principal_due == 0
    assert bullet_sched[0].markup_due == 300000


# --- Ledger Service Integration Tests ---

@pytest.mark.django_db(transaction=True)
def test_ledger_service_record_collection_instalment(tenant_fixture, borrower_fixture):
    loan = LoanAccount.objects.create(
        tenant=tenant_fixture,
        borrower=borrower_fixture,
        principal_paise=200000,  # ₹2,000
        markup_factor=Decimal('0.3000'),  # ₹600
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment'
    )
    Kist.objects.create(
        tenant=tenant_fixture,
        loan=loan,
        installment_number=1,
        original_due_date='2026-01-01',
        effective_due_date='2026-01-01',
        principal_component_paise=200000,
        markup_component_paise=60000,
        total_due_paise=260000,
        status='PENDING'
    )

    op_id = uuid.uuid4()
    # Pay on due date (no penalty)
    result = record_collection(loan, 260000, op_id, '2026-01-01')
    assert result['status'] == 'SUCCESS'
    
    # Verify loan transitioned to SETTLED
    loan.refresh_from_db()
    assert loan.status == 'SETTLED'
    
    # Idempotency check: replay same op_id
    repeat = record_collection(loan, 260000, op_id, '2026-01-01')
    assert repeat['status'] == 'ALREADY_EXISTS'

@pytest.mark.django_db(transaction=True)
def test_ledger_service_record_collection_bullet_loan_settlement(tenant_fixture, borrower_fixture):
    bullet_loan = LoanAccount.objects.create(
        tenant=tenant_fixture,
        borrower=borrower_fixture,
        principal_paise=300000,  # ₹3,000 principal
        markup_factor=Decimal('0.1000'),  # ₹300 markup
        term_months=1,
        start_date='2026-01-01',
        due_day=1,
        product_type='bullet'
    )
    Kist.objects.create(
        tenant=tenant_fixture,
        loan=bullet_loan,
        installment_number=1,
        original_due_date='2026-01-01',
        effective_due_date='2026-01-01',
        principal_component_paise=0,
        markup_component_paise=30000,
        total_due_paise=30000,
        status='PENDING'
    )

    op_id = uuid.uuid4()
    # Pay ₹3,300 on due date (300 markup + 3000 principal)
    result = record_collection(bullet_loan, 330000, op_id, '2026-01-01')
    assert result['status'] == 'SUCCESS'

    bullet_loan.refresh_from_db()
    assert bullet_loan.status == 'SETTLED'

    # Verify transaction conservation
    tx = result['transaction']
    assert tx.amount_paise == 330000
    assert tx.allocated_markup_paise == 30000
    assert tx.allocated_principal_paise == 300000
    assert tx.allocated_penalty_paise == 0
    assert tx.unallocated_surplus_paise == 0
    assert tx.allocated_principal_paise + tx.allocated_markup_paise + tx.allocated_penalty_paise + tx.unallocated_surplus_paise == tx.amount_paise

