from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from django.core.management.base import CommandError

from tenants.management.commands.verify_database_role import Command as VerifyRoleCommand
from tenants.management.commands.verify_rls import EXPECTED_RLS_TABLES
from tenants.management.commands.verify_rls import Command as VerifyRlsCommand


RENDER_START_SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "render-start.sh"


def postgres_connection(fetchall=None, fetchone=None):
    connection = MagicMock(vendor="postgresql")
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchone.return_value = fetchone
    cursor.fetchall.return_value = fetchall
    return connection


def test_database_role_check_rejects_rls_bypass_role():
    connection = postgres_connection(fetchone=(False, True))

    with patch("tenants.management.commands.verify_database_role.connection", connection):
        with pytest.raises(CommandError, match="BYPASSRLS"):
            VerifyRoleCommand().handle()


def test_database_role_check_accepts_restricted_postgres_role():
    connection = postgres_connection(fetchone=(False, False))

    with patch("tenants.management.commands.verify_database_role.connection", connection):
        VerifyRoleCommand().handle()


def test_rls_check_rejects_a_table_without_forced_rls():
    rows = [(table, True, True, 1) for table in EXPECTED_RLS_TABLES]
    rows[0] = (rows[0][0], True, False, 1)
    connection = postgres_connection(fetchall=rows)

    with patch("tenants.management.commands.verify_rls.connection", connection):
        with pytest.raises(CommandError, match="RLS is not enabled"):
            VerifyRlsCommand().handle()


def test_rls_check_accepts_all_expected_tables():
    rows = [(table, True, True, 1) for table in EXPECTED_RLS_TABLES]
    connection = postgres_connection(fetchall=rows)

    with patch("tenants.management.commands.verify_rls.connection", connection):
        VerifyRlsCommand().handle()


def test_render_startup_validates_runtime_database_without_running_migrations():
    script = RENDER_START_SCRIPT.read_text(encoding="utf-8")

    assert "manage.py migrate" not in script
    assert script.index("manage.py verify_database_role") < script.index("manage.py verify_rls")
    assert script.index("manage.py verify_rls") < script.index("exec gunicorn")
