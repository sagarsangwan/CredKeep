import * as SecureStore from 'expo-secure-store';
import * as crypto from 'expo-crypto';

const KEY_AUTH_TOKEN = 'credkeep_auth_token';
const KEY_TENANT_ID = 'credkeep_tenant_id';
const KEY_TENANT_NAME = 'credkeep_tenant_name';
const KEY_USER_INFO = 'credkeep_user_info';
const KEY_DEVICE_ID = 'credkeep_device_id';
const KEY_GOOGLE_LINKED_EMAIL = 'credkeep_google_linked_email';

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

export type AuthChangeListener = (tenantId: string | null) => void;

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
    const gen = () => {
      try {
        if (crypto && typeof crypto.randomUUID === 'function') {
          const id = crypto.randomUUID();
          if (id) return id;
        }
      } catch {}
      try {
        if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
          const id = globalThis.crypto.randomUUID();
          if (id) return id;
        }
      } catch {}
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    try {
      let deviceId = await SecureStore.getItemAsync(KEY_DEVICE_ID);
      if (!deviceId) {
        deviceId = gen();
        await SecureStore.setItemAsync(KEY_DEVICE_ID, deviceId);
      }
      return deviceId;
    } catch {
      return gen();
    }
  }

  private static listeners = new Set<AuthChangeListener>();

  static onAuthChange(listener: AuthChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(tenantId: string | null): void {
    for (const listener of this.listeners) {
      try {
        listener(tenantId);
      } catch {
        // Ignore listener exceptions
      }
    }
  }

  static async setAuth(session: AuthSession): Promise<void> {
    await SecureStore.setItemAsync(KEY_AUTH_TOKEN, session.token);
    await SecureStore.setItemAsync(KEY_USER_INFO, JSON.stringify(session.user));
    if (session.tenant) {
      await SecureStore.setItemAsync(KEY_TENANT_ID, session.tenant.id);
      await SecureStore.setItemAsync(KEY_TENANT_NAME, session.tenant.name);
    }
    this.notifyListeners(session.tenant ? session.tenant.id : null);
  }

  static async clearAuth(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY_AUTH_TOKEN);
      await SecureStore.deleteItemAsync(KEY_TENANT_ID);
      await SecureStore.deleteItemAsync(KEY_TENANT_NAME);
      await SecureStore.deleteItemAsync(KEY_USER_INFO);
      await SecureStore.deleteItemAsync(KEY_GOOGLE_LINKED_EMAIL);
    } catch {
      // Ignore clear errors on missing keys
    }
    this.notifyListeners(null);
  }

  static async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return Boolean(token && token.trim().length > 0);
  }

  static async getGoogleLinkedEmail(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEY_GOOGLE_LINKED_EMAIL);
    } catch {
      return null;
    }
  }

  static async setGoogleLinkedEmail(email: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEY_GOOGLE_LINKED_EMAIL, email);
    } catch {
      // Non-fatal
    }
  }
}

