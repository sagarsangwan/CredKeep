from django.db import migrations

def forward_rls(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute("""
            ALTER TABLE tenants_device ENABLE ROW LEVEL SECURITY;
            ALTER TABLE tenants_device FORCE ROW LEVEL SECURITY;
            CREATE POLICY tenant_isolation_policy ON tenants_device
                USING (tenant_id = NULLIF(current_setting('credkeep.current_tenant', true), '')::uuid);
        """)

def reverse_rls(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute("""
            DROP POLICY IF EXISTS tenant_isolation_policy ON tenants_device;
            ALTER TABLE tenants_device NO FORCE ROW LEVEL SECURITY;
            ALTER TABLE tenants_device DISABLE ROW LEVEL SECURITY;
        """)

class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0002_device'),
    ]

    operations = [
        migrations.RunPython(forward_rls, reverse_code=reverse_rls),
    ]
