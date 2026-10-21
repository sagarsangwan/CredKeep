import { Platform } from 'react-native';
import { AuthStore } from '../auth/authStore';

export function resolveDefaultServerUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    const trimmed = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
    return trimmed.endsWith('/api/v2') ? trimmed : `${trimmed}/api/v2`;
  }

  // Development-only fallback for local testing (Android emulator loopback vs localhost)
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/v2' : 'http://localhost:8000/api/v2';
  }

  throw new Error(
    'EXPO_PUBLIC_API_URL environment variable is required in production and staging builds.'
  );
}

const DEFAULT_SERVER_URL = resolveDefaultServerUrl();

export class ApiClient {
  private static baseUrl: string = DEFAULT_SERVER_URL;

  static setBaseUrl(url: string) {
    this.baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  }

  static getBaseUrl(): string {
    return this.baseUrl;
  }

  static async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<T> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (requireAuth) {
      const token = await AuthStore.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorMsg =
        (typeof data === 'object' && data !== null && (data.error || data.detail || JSON.stringify(data))) ||
        `HTTP request failed with status ${response.status}`;
      const error: any = new Error(errorMsg);
      error.status = response.status;
      error.data = data;
      if (typeof data === 'object' && data !== null && data.code) {
        error.code = data.code;
      }
      throw error;
    }

    return data as T;
  }

  static async get<T = any>(endpoint: string, requireAuth: boolean = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, requireAuth);
  }

  static async post<T = any>(endpoint: string, body: any, requireAuth: boolean = true): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      requireAuth
    );
  }
}
