from django.core.management.base import BaseCommand, CommandError
from django.db import connection


EXPECTED_RLS_TABLES = {
    "tenants_device",
    "ledger_borrower",
    "ledger_loanaccount",
    "ledger_kist",
    "ledger_transaction",
    "ledger_schedulemodification",
    "ledger_synclog",
    "ledger_syncoutbox",
}


class Command(BaseCommand):
    help = "Verify that all tenant-owned PostgreSQL tables force RLS."

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            raise CommandError("RLS verification requires PostgreSQL.")

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
                       COUNT(p.policyname)
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                LEFT JOIN pg_policies p
                  ON p.schemaname = n.nspname AND p.tablename = c.relname
                WHERE n.nspname = 'public' AND c.relname = ANY(%s)
                GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
                """,
                [list(EXPECTED_RLS_TABLES)],
            )
            rows = cursor.fetchall()

        secured_tables = {
            table
            for table, rls_enabled, rls_forced, policy_count in rows
            if rls_enabled and rls_forced and policy_count > 0
        }
        missing = sorted(EXPECTED_RLS_TABLES - secured_tables)
        if missing:
            raise CommandError(
                "RLS is not enabled, forced, and policy-backed for: " + ", ".join(missing)
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"RLS is enabled, forced, and policy-backed on {len(secured_tables)} tables."
            )
        )
