import { ApiClient } from '../api/client';
import { AuthStore, AuthSession } from './authStore';

export interface LoginParams {
  username: string;
  password: string;
}

export interface RegisterParams {
  username: string;
  password: string;
  fullName?: string;
  phone?: string;
  workspaceName?: string;
  email?: string;
}

export type GoogleAuthResponse =
  | { status: 'success'; session: AuthSession }
  | { status: 'needs_profile'; tempToken: string; profileName: string; email: string };

export interface GoogleCompleteParams {
  tempToken: string;
  phone: string;
  fullName?: string;
  workspaceName?: string;
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
        full_name: params.fullName?.trim() || undefined,
        phone: params.phone?.trim() || undefined,
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

  static async loginWithGoogle(idToken: string): Promise<GoogleAuthResponse> {
    const res = await ApiClient.post<any>(
      '/auth/google/',
      {
        id_token: idToken,
      },
      false
    );

    if (res.status === 'needs_profile') {
      return {
        status: 'needs_profile',
        tempToken: res.temp_token,
        profileName: res.profile_name || '',
        email: res.email || '',
      };
    }

    const session: AuthSession = {
      token: res.token,
      user: res.user,
      tenant: res.tenant,
    };

    await AuthStore.setAuth(session);

    try {
      await this.registerDevice();
    } catch {
      // Non-fatal
    }

    return {
      status: 'success',
      session,
    };
  }

  static async completeGoogleOnboarding(params: GoogleCompleteParams): Promise<AuthSession> {
    const res = await ApiClient.post<AuthSession>(
      '/auth/google/complete/',
      {
        temp_token: params.tempToken,
        phone: params.phone.trim(),
        full_name: params.fullName?.trim() || undefined,
        workspace_name: params.workspaceName?.trim() || undefined,
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

  static async requestPasswordReset(email: string): Promise<{ message: string }> {
    const res = await ApiClient.post<{ message: string }>(
      '/auth/password-reset/',
      {
        email: email.trim(),
      },
      false
    );
    return res;
  }

  static async registerDevice(pushToken: string = ''): Promise<void> {
    const deviceId = await AuthStore.getDeviceId();
    await ApiClient.post('/auth/device/', {
      device_id: deviceId,
      push_token: pushToken,
    });
  }

  static async linkGoogleAccount(idToken: string): Promise<{ status: string; message: string; google_sub: string; email: string }> {
    const res = await ApiClient.post<{ status: string; message: string; google_sub: string; email: string }>(
      '/auth/google/link/',
      { id_token: idToken },
      true
    );
    if (res.email) {
      await AuthStore.setGoogleLinkedEmail(res.email);
    }
    return res;
  }

  static async logout(): Promise<void> {
    await AuthStore.clearAuth();
  }
}

