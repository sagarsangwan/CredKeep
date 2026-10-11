import { AuthStore } from './authStore';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn(async (key: string) => store[key] || null),
    setItemAsync: jest.fn(async (key: string, val: string) => {
      store[key] = val;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      delete store[key];
    }),
  };
});

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '11111111-2222-3333-4444-555555555555'),
}));

describe('AuthStore', () => {
  beforeEach(async () => {
    await AuthStore.clearAuth();
    jest.clearAllMocks();
  });

  it('stores and retrieves session token and tenant information', async () => {
    expect(await AuthStore.isAuthenticated()).toBe(false);

    await AuthStore.setAuth({
      token: 'test-token-xyz',
      user: { id: 1, username: 'testuser' },
      tenant: { id: 'tenant-uuid-123', name: 'Test Workspace' },
    });

    expect(await AuthStore.getToken()).toBe('test-token-xyz');
    expect(await AuthStore.getTenantId()).toBe('tenant-uuid-123');
    expect(await AuthStore.getTenantName()).toBe('Test Workspace');
    expect(await AuthStore.getUserInfo()).toEqual({ id: 1, username: 'testuser' });
    expect(await AuthStore.isAuthenticated()).toBe(true);
  });

  it('clears authentication completely on logout', async () => {
    await AuthStore.setAuth({
      token: 'token-to-delete',
      user: { id: 2, username: 'user2' },
      tenant: { id: 'tenant-2', name: 'Workspace 2' },
    });

    expect(await AuthStore.isAuthenticated()).toBe(true);

    await AuthStore.clearAuth();

    expect(await AuthStore.getToken()).toBeNull();
    expect(await AuthStore.getTenantId()).toBeNull();
    expect(await AuthStore.isAuthenticated()).toBe(false);
  });

  it('generates and persists device ID', async () => {
    const deviceId = await AuthStore.getDeviceId();
    expect(deviceId).toBe('11111111-2222-3333-4444-555555555555');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'credkeep_device_id',
      '11111111-2222-3333-4444-555555555555'
    );
  });
});
