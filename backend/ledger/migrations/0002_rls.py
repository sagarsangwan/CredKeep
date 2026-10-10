from django.db import migrations

TABLES = [
    'ledger_borrower',
    'ledger_loanaccount',
    'ledger_kist',
    'ledger_transaction',
    'ledger_schedulemodification',
    'ledger_synclog',
    'ledger_syncoutbox',
]

def forward_rls(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        for table in TABLES:
            schema_editor.execute(f"""
                ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
                ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
                CREATE POLICY tenant_isolation_policy ON {table}
                    USING (tenant_id = NULLIF(current_setting('credkeep.current_tenant', true), '')::uuid);
            """)

def reverse_rls(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        for table in TABLES:
            schema_editor.execute(f"""
                DROP POLICY IF EXISTS tenant_isolation_policy ON {table};
                ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;
            """)

class Migration(migrations.Migration):

    dependencies = [
        ('ledger', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(forward_rls, reverse_code=reverse_rls),
    ]
