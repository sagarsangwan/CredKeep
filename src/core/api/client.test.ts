import { Platform } from 'react-native';
import { ApiClient, resolveDefaultServerUrl } from './client';

describe('ApiClient URL resolution', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;
  const originalDev = (globalThis as any).__DEV__;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
    (globalThis as any).__DEV__ = originalDev;
  });

  describe('resolveDefaultServerUrl in development mode (__DEV__ = true)', () => {
    beforeEach(() => {
      (globalThis as any).__DEV__ = true;
    });

    it('falls back to Android emulator loopback when EXPO_PUBLIC_API_URL is unset on Android', () => {
      delete process.env.EXPO_PUBLIC_API_URL;
      Platform.OS = 'android';

      expect(resolveDefaultServerUrl()).toBe('http://10.0.2.2:8000/api/v2');
    });

    it('falls back to localhost when EXPO_PUBLIC_API_URL is unset on iOS/other', () => {
      delete process.env.EXPO_PUBLIC_API_URL;
      Platform.OS = 'ios';

      expect(resolveDefaultServerUrl()).toBe('http://localhost:8000/api/v2');
    });

    it('appends /api/v2 when EXPO_PUBLIC_API_URL lacks the suffix', () => {
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.50:8000';
      expect(resolveDefaultServerUrl()).toBe('http://192.168.1.50:8000/api/v2');
    });

    it('trims trailing slashes before appending /api/v2', () => {
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.50:8000/';
      expect(resolveDefaultServerUrl()).toBe('http://192.168.1.50:8000/api/v2');
    });

    it('does not duplicate /api/v2 when already present in EXPO_PUBLIC_API_URL', () => {
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.50:8000/api/v2';
      expect(resolveDefaultServerUrl()).toBe('http://192.168.1.50:8000/api/v2');
    });

    it('handles staging Render HTTPS URL correctly', () => {
      process.env.EXPO_PUBLIC_API_URL = 'https://credkeep-backend.onrender.com';
      expect(resolveDefaultServerUrl()).toBe('https://credkeep-backend.onrender.com/api/v2');
    });
  });

  describe('resolveDefaultServerUrl in production mode (__DEV__ = false)', () => {
    beforeEach(() => {
      (globalThis as any).__DEV__ = false;
    });

    it('throws an error if EXPO_PUBLIC_API_URL is missing in production/staging', () => {
      delete process.env.EXPO_PUBLIC_API_URL;

      expect(() => resolveDefaultServerUrl()).toThrow(
        'EXPO_PUBLIC_API_URL environment variable is required in production and staging builds.'
      );
    });

    it('resolves configured URL normally in production/staging when provided', () => {
      process.env.EXPO_PUBLIC_API_URL = 'https://credkeep-prod.onrender.com';
      expect(resolveDefaultServerUrl()).toBe('https://credkeep-prod.onrender.com/api/v2');
    });
  });

  describe('ApiClient.setBaseUrl', () => {
    it('sets and retrieves custom base URL trimming trailing slash', () => {
      ApiClient.setBaseUrl('http://127.0.0.1:8000/api/v2/');
      expect(ApiClient.getBaseUrl()).toBe('http://127.0.0.1:8000/api/v2');
    });
  });
});
