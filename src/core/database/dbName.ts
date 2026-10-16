import { AuthStore } from '../auth/authStore';

export async function getDatabaseName(tenantId?: string | null): Promise<string | null> {
  const resolvedTenantId = tenantId !== undefined ? tenantId : await AuthStore.getTenantId();
  if (resolvedTenantId && resolvedTenantId.trim().length > 0) {
    const cleanId = resolvedTenantId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `credkeep_${cleanId}.db`;
  }
  return null;
}
