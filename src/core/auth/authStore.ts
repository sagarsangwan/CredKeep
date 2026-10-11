import * as SecureStore from 'expo-secure-store';
import * as crypto from 'expo-crypto';

const KEY_AUTH_TOKEN = 'credkeep_auth_token';
const KEY_TENANT_ID = 'credkeep_tenant_id';
const KEY_TENANT_NAME = 'credkeep_tenant_name';
const KEY_USER_INFO = 'credkeep_user_info';
const KEY_DEVICE_ID = 'credkeep_device_id';

export interface UserInfo {
  id: number;
  username: string;
}

export interface TenantInfo {
  id: string;
  name: string;
}

export interface AuthSession {
  token: string;
  user: UserInfo;
  tenant: TenantInfo | null;
}

export class AuthStore {
  static async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEY_AUTH_TOKEN);
    } catch {
      return null;
    }
  }

  static async getTenantId(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEY_TENANT_ID);
    } catch {
      return null;
    }
  }

  static async getTenantName(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEY_TENANT_NAME);
    } catch {
      return null;
    }
  }

  static async getUserInfo(): Promise<UserInfo | null> {
    try {
      const raw = await SecureStore.getItemAsync(KEY_USER_INFO);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static async getDeviceId(): Promise<string> {
    try {
      let deviceId = await SecureStore.getItemAsync(KEY_DEVICE_ID);
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        await SecureStore.setItemAsync(KEY_DEVICE_ID, deviceId);
      }
      return deviceId;
    } catch {
      return crypto.randomUUID();
    }
  }

  static async setAuth(session: AuthSession): Promise<void> {
    await SecureStore.setItemAsync(KEY_AUTH_TOKEN, session.token);
    await SecureStore.setItemAsync(KEY_USER_INFO, JSON.stringify(session.user));
    if (session.tenant) {
      await SecureStore.setItemAsync(KEY_TENANT_ID, session.tenant.id);
      await SecureStore.setItemAsync(KEY_TENANT_NAME, session.tenant.name);
    }
  }

  static async clearAuth(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY_AUTH_TOKEN);
      await SecureStore.deleteItemAsync(KEY_TENANT_ID);
      await SecureStore.deleteItemAsync(KEY_TENANT_NAME);
      await SecureStore.deleteItemAsync(KEY_USER_INFO);
    } catch {
      // Ignore clear errors on missing keys
    }
  }

  static async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return Boolean(token && token.trim().length > 0);
  }
}
