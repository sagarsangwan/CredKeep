from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Verify that the live database is PostgreSQL and its role cannot bypass RLS."

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            raise CommandError("The staging database must use PostgreSQL.")

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT rolsuper, rolbypassrls
                FROM pg_roles
                WHERE rolname = current_user
                """
            )
            role = cursor.fetchone()

        if role is None:
            raise CommandError("Unable to inspect the current PostgreSQL role.")

        is_superuser, bypasses_rls = role
        if is_superuser or bypasses_rls:
            raise CommandError(
                "The application database role must not have SUPERUSER or BYPASSRLS privileges."
            )

        self.stdout.write(self.style.SUCCESS("Database role is restricted and RLS-capable."))
