import os
import sys
import django
import psycopg

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'credkeep_backend.settings')
django.setup()

from django.db import connection, transaction
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from tenants.models import Tenant, Device
from ledger.models import Borrower, LoanAccount, Kist, Transaction as LedgerTx, SyncOutbox
from ledger.engine.ledger_service import record_collection
from decimal import Decimal

def run_step2_verification():
    print("=== STEP 2 VERIFICATION: REAL POSTGRESQL BACKEND ===")
    
    # 1. Verify tables
    with connection.cursor() as cursor:
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"[OK] Total tables found: {len(tables)}")
        required_tables = [
            'ledger_borrower', 'ledger_loanaccount', 'ledger_kist',
            'ledger_transaction', 'ledger_schedulemodification', 'ledger_synclog',
            'ledger_syncoutbox', 'tenants_device', 'tenants_tenant', 'authtoken_token'
        ]
        for t in required_tables:
            assert t in tables, f"Missing required table {t}"
        print(f"[OK] All required domain, ledger, tenant, and auth tables exist.")

    # 2. Verify RLS policies
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT tablename, policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' 
            ORDER BY tablename;
        """)
        policies = cursor.fetchall()
        print(f"[OK] Total RLS policies: {len(policies)}")
        assert len(policies) >= 8, f"Expected at least 8 RLS policies, found {len(policies)}"
        for table, pol in policies:
            print(f"     Table {table}: {pol}")

    # 3. Verify normal application role (credkeep_app) tenant isolation
    print("\n--- Verifying RLS Enforcement under normal application role (credkeep_app) ---")
    app_conn = psycopg.connect("postgres://credkeep_app:restrictedpassword@localhost:5435/credkeep_v2_disposable")
    try:
        # Create 2 synthetic tenants and borrowers via Django (superuser connection)
        u1, _ = User.objects.get_or_create(username='lender_a', defaults={'email': 'a@example.com'})
        u1.set_password('pass123')
        u1.save()
        t1, _ = Tenant.objects.get_or_create(owner=u1, defaults={'name': 'Lender A Tenant'})

        u2, _ = User.objects.get_or_create(username='lender_b', defaults={'email': 'b@example.com'})
        u2.set_password('pass123')
        u2.save()
        t2, _ = Tenant.objects.get_or_create(owner=u2, defaults={'name': 'Lender B Tenant'})

        b1, _ = Borrower.objects.get_or_create(tenant=t1, phone='9000000001', defaults={'name': 'Borrower A'})
        b2, _ = Borrower.objects.get_or_create(tenant=t2, phone='9000000002', defaults={'name': 'Borrower B'})

        with app_conn.cursor() as cur:
            # A: without setting credkeep.current_tenant
            cur.execute("SELECT id, name FROM ledger_borrower;")
            rows_unscoped = cur.fetchall()
            print(f"[OK] Unscoped query returns {len(rows_unscoped)} rows (RLS blocks all access when tenant unset).")
            assert len(rows_unscoped) == 0, "Unscoped query should return 0 rows"

            # B: Set tenant to t1
            cur.execute(f"SET credkeep.current_tenant = '{t1.id}';")
            cur.execute("SELECT id, name FROM ledger_borrower;")
            rows_t1 = cur.fetchall()
            print(f"[OK] Scoped query for Tenant A returns {len(rows_t1)} row(s): {[r[1] for r in rows_t1]}")
            assert len(rows_t1) == 1 and rows_t1[0][1] == 'Borrower A', "Tenant A should only see Borrower A"

            # C: Set tenant to t2
            cur.execute(f"SET credkeep.current_tenant = '{t2.id}';")
            cur.execute("SELECT id, name FROM ledger_borrower;")
            rows_t2 = cur.fetchall()
            print(f"[OK] Scoped query for Tenant B returns {len(rows_t2)} row(s): {[r[1] for r in rows_t2]}")
            assert len(rows_t2) == 1 and rows_t2[0][1] == 'Borrower B', "Tenant B should only see Borrower B"

            # D: Cross-tenant access attempt: Tenant B querying Tenant A's borrower by ID
            cur.execute(f"SELECT * FROM ledger_borrower WHERE id = '{b1.id}';")
            cross_rows = cur.fetchall()
            print(f"[OK] Cross-tenant query by Tenant B for Tenant A's record returned {len(cross_rows)} rows (Blocked by RLS).")
            assert len(cross_rows) == 0, "Tenant B must not access Tenant A record even by direct ID query"
    finally:
        app_conn.close()

    # 4. Django authentication verification
    print("\n--- Verifying Django Authentication ---")
    from django.contrib.auth import authenticate
    auth_user = authenticate(username='lender_a', password='pass123')
    assert auth_user is not None, "Authentication failed for lender_a"
    token, _ = Token.objects.get_or_create(user=auth_user)
    print(f"[OK] Authentication succeeded for lender_a. Generated Auth Token: {token.key[:8]}...")

    # 5. Atomic Payment Transactions & Rollback Verification
    print("\n--- Verifying Atomic Payment Transactions & Rollback Invariants ---")
    loan = LoanAccount.objects.create(
        tenant=t1,
        borrower=b1,
        principal_paise=2400000,
        markup_factor=Decimal('0.3000'),
        term_months=12,
        start_date='2026-01-01',
        due_day=1,
        product_type='instalment',
        status='ACTIVE'
    )
    kist1 = Kist.objects.create(
        tenant=t1,
        loan=loan,
        installment_number=1,
        original_due_date='2026-02-01',
        effective_due_date='2026-02-01',
        principal_component_paise=200000,
        markup_component_paise=60000,
        total_due_paise=260000,
        status='PENDING'
    )

    # Test Atomicity: Successful payment
    import uuid
    op_id_success = str(uuid.uuid4())
    initial_tx_count = LedgerTx.objects.filter(loan=loan).count()
    rec_result = record_collection(loan, 260000, op_id_success, '2026-02-01')
    assert rec_result['status'] == 'SUCCESS'
    assert LedgerTx.objects.filter(loan=loan).count() == initial_tx_count + 1
    kist1.refresh_from_db()
    assert kist1.status == 'PAID'
    assert kist1.principal_paid_paise == 200000
    assert kist1.markup_paid_paise == 60000
    print(f"[OK] Payment committed atomically: Kist marked PAID, allocations (P={kist1.principal_paid_paise}, M={kist1.markup_paid_paise}) match ledger.")

    # Test Rollback: Simulated failure during transaction
    op_id_failing = str(uuid.uuid4())
    try:
        with transaction.atomic():
            LedgerTx.objects.create(
                tenant=t1,
                operation_id=op_id_failing,
                loan=loan,
                transaction_type='COLLECTION',
                amount_paise=100000,
                allocated_principal_paise=100000,
                effective_date='2026-02-02'
            )
            # Simulate failure
            raise RuntimeError("Forced simulation failure mid-transaction")
    except RuntimeError:
        pass

    assert not LedgerTx.objects.filter(operation_id=op_id_failing).exists()
    print("[OK] Atomic rollback confirmed: Aborted transaction left zero partial records in PostgreSQL.")

    print("\n=== STEP 2 VERIFICATION PASSED COMPLETELY ===")

if __name__ == '__main__':
    run_step2_verification()
