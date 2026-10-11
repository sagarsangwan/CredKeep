import { AuthStore } from '../auth/authStore';

export async function getDatabaseName(tenantId?: string | null): Promise<string> {
  const resolvedTenantId = tenantId !== undefined ? tenantId : await AuthStore.getTenantId();
  if (resolvedTenantId) {
    const cleanId = resolvedTenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `credkeep_${cleanId}.db`;
  }
  return 'credkeep.db';
}
