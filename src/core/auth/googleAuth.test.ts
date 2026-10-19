import { promptGoogleSignIn, signOutGoogle } from './googleAuth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    getTokens: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
  },
}));

describe('Google Authentication Service', () => {
  const originalClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'test-web-client-id.apps.googleusercontent.com';
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = originalClientId;
  });

  it('fails gracefully when EXPO_PUBLIC_GOOGLE_CLIENT_ID is unset', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    const res = await promptGoogleSignIn();
    expect(res.success).toBe(false);
    if (!res.success && 'error' in res) {
      expect(res.error).toContain('EXPO_PUBLIC_GOOGLE_CLIENT_ID');
    }
  });

  it('handles user cancellation via cancelled response type', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      type: 'cancelled',
      data: null,
    });

    const res = await promptGoogleSignIn();
    expect(res.success).toBe(false);
    if (!res.success && 'cancelled' in res) {
      expect(res.cancelled).toBe(true);
    }
  });

  it('handles user cancellation via SIGN_IN_CANCELLED exception code', async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce({
      code: statusCodes.SIGN_IN_CANCELLED,
    });

    const res = await promptGoogleSignIn();
    expect(res.success).toBe(false);
    if (!res.success && 'cancelled' in res) {
      expect(res.cancelled).toBe(true);
    }
  });

  it('handles PLAY_SERVICES_NOT_AVAILABLE error', async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce({
      code: statusCodes.PLAY_SERVICES_NOT_AVAILABLE,
      message: 'Play services not available',
    });

    const res = await promptGoogleSignIn();
    expect(res.success).toBe(false);
    if (!res.success && 'error' in res) {
      expect(res.error).toContain('Google Play Services is not available');
    }
  });

  it('handles IN_PROGRESS error', async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce({
      code: statusCodes.IN_PROGRESS,
    });

    const res = await promptGoogleSignIn();
    expect(res.success).toBe(false);
    if (!res.success && 'error' in res) {
      expect(res.error).toContain('already in progress');
    }
  });

  it('successfully returns idToken on valid sign-in', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      type: 'success',
      data: {
        idToken: 'mock-google-id-token',
        user: {
          email: 'lender@example.com',
          name: 'CredKeep Lender',
        },
      },
    });

    const res = await promptGoogleSignIn();
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.idToken).toBe('mock-google-id-token');
      expect(res.email).toBe('lender@example.com');
      expect(res.name).toBe('CredKeep Lender');
    }
  });

  it('falls back to getTokens() if idToken is omitted in initial data payload', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      type: 'success',
      data: {
        idToken: null,
        user: { email: 'fallback@example.com' },
      },
    });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValueOnce({
      idToken: 'fallback-fetched-token',
    });

    const res = await promptGoogleSignIn();
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.idToken).toBe('fallback-fetched-token');
    }
  });

  it('calls GoogleSignin.signOut() without throwing', async () => {
    await expect(signOutGoogle()).resolves.toBeUndefined();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
  });
});
