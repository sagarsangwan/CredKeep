import { ApiClient } from '../api/client';
import { AuthStore, AuthSession } from './authStore';

export interface LoginParams {
  username: string;
  password: string;
}

export interface RegisterParams {
  username: string;
  password: string;
  workspaceName?: string;
  email?: string;
}

export class AuthService {
  static async login(params: LoginParams): Promise<AuthSession> {
    const res = await ApiClient.post<AuthSession>(
      '/auth/login/',
      {
        username: params.username.trim(),
        password: params.password,
      },
      false
    );

    await AuthStore.setAuth(res);

    // Automatically register device
    try {
      await this.registerDevice();
    } catch {
      // Non-fatal device registration failure
    }

    return res;
  }

  static async register(params: RegisterParams): Promise<AuthSession> {
    const res = await ApiClient.post<AuthSession>(
      '/auth/register/',
      {
        username: params.username.trim(),
        password: params.password,
        workspace_name: params.workspaceName?.trim() || undefined,
        email: params.email?.trim() || undefined,
      },
      false
    );

    await AuthStore.setAuth(res);

    try {
      await this.registerDevice();
    } catch {
      // Non-fatal
    }

    return res;
  }

  static async registerDevice(pushToken: string = ''): Promise<void> {
    const deviceId = await AuthStore.getDeviceId();
    await ApiClient.post('/auth/device/', {
      device_id: deviceId,
      push_token: pushToken,
    });
  }

  static async logout(): Promise<void> {
    await AuthStore.clearAuth();
  }
}
