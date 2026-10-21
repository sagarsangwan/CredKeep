import { Platform } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
  SignInResponse,
} from '@react-native-google-signin/google-signin';

export interface GoogleAuthResult {
  idToken: string;
  email?: string;
  name?: string;
}

export type GooglePromptResult =
  | { success: true; idToken: string; email?: string; name?: string }
  | { success: false; cancelled: true }
  | { success: false; error: string; code?: string };

let isConfigured = false;

export function configureGoogleAuth(webClientId?: string): void {
  const clientId = webClientId || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_CLIENT_ID is not configured in the environment. Google Sign-In requires a configured Web OAuth Client ID.'
    );
  }

  try {
    GoogleSignin.configure({
      webClientId: clientId,
      offlineAccess: false,
    });
    isConfigured = true;
  } catch (err: any) {
    // Graceful fallback for non-native environments or unit tests
    console.warn('[GoogleAuth] Failed to configure GoogleSignin:', err?.message || err);
  }
}

export async function promptGoogleSignIn(): Promise<GooglePromptResult> {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return {
      success: false,
      error:
        'Google OAuth requires EXPO_PUBLIC_GOOGLE_CLIENT_ID configured in your environment. Username/password login is active.',
    };
  }

  if (!isConfigured) {
    configureGoogleAuth(clientId);
  }

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const response: SignInResponse = await GoogleSignin.signIn();

    if (response.type === 'cancelled') {
      return { success: false, cancelled: true };
    }

    if (response.type === 'success' && response.data) {
      let idToken = response.data.idToken;
      if (!idToken) {
        // Fallback: fetch tokens explicitly if idToken was not in initial payload
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }

      if (!idToken) {
        return {
          success: false,
          error:
            'Google Sign-In did not return an identity token. Please ensure your Web Client ID is properly configured.',
        };
      }

      return {
        success: true,
        idToken,
        email: response.data.user?.email,
        name: response.data.user?.name || undefined,
      };
    }

    return { success: false, cancelled: true };
  } catch (error: any) {
    if (error?.code === statusCodes?.SIGN_IN_CANCELLED) {
      return { success: false, cancelled: true };
    } else if (error?.code === statusCodes?.IN_PROGRESS) {
      return {
        success: false,
        error: 'Sign in is already in progress. Please wait.',
        code: error.code,
      };
    } else if (error?.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
      return {
        success: false,
        error: 'Google Play Services is not available or outdated on this device.',
        code: error.code,
      };
    }

    return {
      success: false,
      error:
        error?.message ||
        'Google authentication failed. Please try again or use your password.',
      code: error?.code,
    };
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Non-fatal
  }
}
