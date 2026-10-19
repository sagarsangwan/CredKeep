import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Input } from '../../ui/Input';
import { PasswordInput } from '../../ui/PasswordInput';
import { Button } from '../../ui/Button';
import { GoogleSignInButton } from '../../ui/GoogleSignInButton';
import { theme } from '../../ui/theme';
import { AuthService } from '../../core/auth/authService';
import { triggerBackendWarmup } from '../../core/api/backendWarmup';
import { useSecurity } from '../../ui/PinLock';

import { promptGoogleSignIn } from '../../core/auth/googleAuth';

export default function LoginScreen() {
  const router = useRouter();
  const { hasPin, bioEnabled } = useSecurity();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);

  useEffect(() => {
    // Non-blocking backend wake-up
    triggerBackendWarmup();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await AuthService.login({ username, password });

      if (!hasPin && !bioEnabled) {
        router.replace('/auth/security-setup');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials or network connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLinkNotice(null);

    const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      setError(
        'Google OAuth requires EXPO_PUBLIC_GOOGLE_CLIENT_ID configured in your environment. Username/password login is active.'
      );
      return;
    }

    try {
      setGoogleLoading(true);
      const promptResult = await promptGoogleSignIn();

      if (!promptResult.success) {
        if ('cancelled' in promptResult) {
          // User dismissed or cancelled the Google account picker
          return;
        }
        setError(promptResult.error || 'Google authentication was cancelled.');
        return;
      }

      const res = await AuthService.loginWithGoogle(promptResult.idToken);

      if (res.status === 'needs_profile') {
        router.push({
          pathname: '/auth/google-onboarding',
          params: {
            tempToken: res.tempToken,
            profileName: res.profileName,
            email: res.email,
          },
        });
      } else {
        if (!hasPin && !bioEnabled) {
          router.replace('/auth/security-setup');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (err: any) {
      if (
        err?.code === 'ACCOUNT_EXISTS_LINK_REQUIRED' ||
        err?.message?.includes('link your Google account')
      ) {
        setLinkNotice(
          'An existing CredKeep account uses this email. Please log in with your username and password below, then connect your Google account in App Security settings.'
        );
      } else {
        setError(err?.message || 'Google authentication failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top App Bar with CredKeep Mark and Version Tag */}
        <View style={styles.topBar}>
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Typography variant="labelSm" color="#FFFFFF" style={styles.logoText}>
                CK
              </Typography>
            </View>
            <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.brandTitle}>
              CredKeep
            </Typography>
          </View>
          <View style={styles.versionPill}>
            <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.versionText}>
              v2.4
            </Typography>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.header}>
            <Typography variant="headlineLg" color={theme.colors.textPrimary} style={styles.title}>
              Welcome back
            </Typography>
            <Typography variant="bodyMd" color={theme.colors.textSecondary} style={styles.subtitle}>
              Sign in to your CredKeep workspace.
            </Typography>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color={theme.colors.danger} style={{ marginTop: 2, marginRight: 8 }} />
              <Typography variant="bodySm" color={theme.colors.danger} style={{ flex: 1 }}>
                {error}
              </Typography>
            </View>
          )}

          {/* Account Exists / Link Notice Banner */}
          {linkNotice && (
            <View style={styles.linkNoticeBanner}>
              <ShieldCheck size={18} color={theme.colors.textPrimary} style={{ marginTop: 2, marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                  Existing Account Detected
                </Typography>
                <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 4, lineHeight: 18 }}>
                  {linkNotice}
                </Typography>
              </View>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.form}>
            <Input
              label="Username"
              placeholder="e.g. ramesh_financier"
              value={username}
              onChangeText={(t) => {
                setUsername(t);
                if (error) setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <PasswordInput
              label="Password"
              placeholder="••••••••••••"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError(null);
              }}
              headerRight={
                <TouchableOpacity
                  onPress={() => router.push('/auth/forgot-password')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot password"
                >
                  <Typography variant="labelSm" color={theme.colors.textSecondary}>
                    Forgot password?
                  </Typography>
                </TouchableOpacity>
              }
            />

            {/* Primary Action Button */}
            <Button
              title="Log In"
              onPress={handleLogin}
              loading={loading}
              icon={<ArrowRight size={18} color="#FFFFFF" />}
              style={styles.loginBtn}
            />

            {/* OR Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <View style={styles.dividerBadge}>
                <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.dividerText}>
                  OR
                </Typography>
              </View>
            </View>

            {/* Google Authentication */}
            <GoogleSignInButton
              onPress={handleGoogleSignIn}
              loading={googleLoading}
              style={styles.googleBtn}
            />
          </View>

          {/* Bottom Switch Link */}
          <View style={styles.bottomLinkContainer}>
            <Typography variant="bodySm" color={theme.colors.textSecondary}>
              {"Don't have an account? "}
            </Typography>
            <TouchableOpacity onPress={() => router.push('/auth/register')}>
              <Typography variant="bodySm" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                Create account
              </Typography>
            </TouchableOpacity>
          </View>

          {/* Local Keystore Security Information Card */}
          <View style={styles.securityCard}>
            <ShieldCheck size={18} color={theme.colors.textSecondary} style={{ marginTop: 2, marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                Local Keystore Security (AES-256)
              </Typography>
              <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.securityText}>
                Session keys and local ledger state are hardware-isolated. Account credentials verify on-device cryptographic nodes.
              </Typography>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  topBar: {
    height: 56,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  brandTitle: {
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  versionPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  versionText: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.dangerContainer,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  linkNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceSoft,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  form: {
    gap: 4,
  },
  loginBtn: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.actionPrimary,
  },
  dividerContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.md,
  },
  dividerLine: {
    width: '100%',
    height: 1,
    backgroundColor: theme.colors.borderDefault,
  },
  dividerBadge: {
    position: 'absolute',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  googleBtn: {
    width: '100%',
  },
  bottomLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  securityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  securityText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
});
