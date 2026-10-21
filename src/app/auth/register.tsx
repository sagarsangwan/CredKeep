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
import {
  ArrowLeft,
  ArrowRight,
  User,
  AtSign,
  Mail,
  Shield,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Check,
} from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Input } from '../../ui/Input';
import { PhoneInput, validateIndianMobile } from '../../ui/PhoneInput';
import { PasswordInput } from '../../ui/PasswordInput';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { AuthService } from '../../core/auth/authService';
import { triggerBackendWarmup } from '../../core/api/backendWarmup';

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    triggerBackendWarmup();
  }, []);

  const isPasswordMatched = password.length > 0 && password === confirmPassword;
  const isPhoneValid = mobileNumber.length === 0 || validateIndianMobile(mobileNumber);

  const handleRegister = async () => {
    setError(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!username.trim()) {
      setError('Please choose a username.');
      return;
    }

    if (!mobileNumber.trim()) {
      setError('Please enter your 10-digit mobile number.');
      return;
    }

    if (!validateIndianMobile(mobileNumber)) {
      setError('Please enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9).');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid recovery email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!agreeTerms) {
      setError('You must accept the offline ledger terms to continue.');
      return;
    }

    try {
      setLoading(true);
      await AuthService.register({
        username: username.trim(),
        password,
        fullName: fullName.trim(),
        phone: mobileNumber.trim(),
        email: email.trim(),
      });

      // Navigate to security setup for biometric/PIN lock configuration
      router.replace('/auth/security-setup');
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please check network or try another username.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.topBarTitle}>
            Register
          </Typography>
          <View style={styles.profileBadge}>
            <User size={16} color="#FFFFFF" />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Secondary Telemetry Bar */}
          <View style={styles.subBar}>
            <View style={styles.engineBadge}>
              <View style={styles.engineDot} />
              <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ fontWeight: '500' }}>
                Offline-First Engine
              </Typography>
            </View>
            <TouchableOpacity
              style={styles.signInLink}
              onPress={() => router.push('/auth/login')}
              accessibilityRole="button"
            >
              <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                Sign In
              </Typography>
              <ChevronRight size={14} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Hero Header */}
          <View style={styles.header}>
            <View style={styles.stepBadgeRow}>
              <Typography variant="labelSm" color={theme.colors.success} style={styles.stepText}>
                Step 1 of 3
              </Typography>
              <Typography variant="labelSm" color={theme.colors.textDisabled}> • </Typography>
              <Typography variant="labelSm" color={theme.colors.textSecondary}>
                Private Ledger Workspace
              </Typography>
            </View>
            <Typography variant="headlineLg" color={theme.colors.textPrimary} style={styles.title}>
              Create your account
            </Typography>
            <Typography variant="bodyMd" color={theme.colors.textSecondary} style={styles.subtitle}>
              Set up your private single-lender workspace on this device.
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

          {/* Form Zone */}
          <View style={styles.form}>
            {/* Field 1: Full Name */}
            <Input
              label="Full Name *"
              placeholder="e.g. Ramesh Kumar"
              value={fullName}
              onChangeText={setFullName}
              rightIcon={<User size={18} color={theme.colors.textSecondary} />}
            />

            {/* Field 2: Username */}
            <Input
              label="Username *"
              placeholder="e.g. ramesh_finance"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              rightIcon={<AtSign size={18} color={theme.colors.textSecondary} />}
              helperText="Unique ID for workspace tenancy"
            />

            {/* Field 3: Indian Mobile Number (+91 prefix) */}
            <PhoneInput
              label="Mobile Number"
              required
              value={mobileNumber}
              onChangeText={setMobileNumber}
              error={!isPhoneValid ? 'Please enter a valid 10-digit Indian number' : undefined}
              helperText="Used as device owner identifier. Not visually labeled as verified."
            />

            {/* Field 4: Recovery Email */}
            <Input
              label="Recovery Email *"
              placeholder="recovery@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              rightIcon={<Mail size={18} color={theme.colors.textSecondary} />}
              helperText="Used exclusively for zero-knowledge encrypted recovery tokens."
            />

            {/* Field 5: Password */}
            <PasswordInput
              label="Password"
              required
              badge="AES-256 GCM"
              placeholder="Enter secret password or PIN"
              value={password}
              onChangeText={setPassword}
              helperText="Min 6 characters. Encrypts local SQLite vault."
            />

            {/* Field 6: Confirm Password with Match Indicator */}
            <PasswordInput
              label="Confirm Password"
              required
              placeholder="Re-enter password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              headerRight={
                confirmPassword.length > 0 ? (
                  <View style={styles.matchIndicator}>
                    {isPasswordMatched ? (
                      <>
                        <CheckCircle size={14} color={theme.colors.success} />
                        <Typography variant="labelSm" color={theme.colors.success} style={styles.matchText}>
                          Passwords match
                        </Typography>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={14} color={theme.colors.danger} />
                        <Typography variant="labelSm" color={theme.colors.danger} style={styles.matchText}>
                          Does not match
                        </Typography>
                      </>
                    )}
                  </View>
                ) : null
              }
            />

            {/* Zero Cloud Reliance Spec Card */}
            <View style={styles.specCard}>
              <View style={styles.specIconBadge}>
                <Shield size={18} color={theme.colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                  Zero Cloud Reliance
                </Typography>
                <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.specText}>
                  Your records never leave internal sandboxed flash memory. Data export is manual via encrypted SQLite archives.
                </Typography>
              </View>
            </View>

            {/* Offline Terms Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAgreeTerms(!agreeTerms)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkboxBox, agreeTerms && styles.checkboxChecked]}>
                {agreeTerms && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.termsText}>
                I agree to the{' '}
                <Typography variant="bodySm" color={theme.colors.textPrimary} style={{ fontWeight: '600', textDecorationLine: 'underline' }}>
                  Offline Ledger Terms
                </Typography>{' '}
                and acknowledge that loan records, collection timestamps, and borrower collateral files are stored locally on this phone under my exclusive custody.
              </Typography>
            </TouchableOpacity>

            {/* Submit Action Zone */}
            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              disabled={!agreeTerms}
              icon={<ArrowRight size={18} color="#FFFFFF" />}
              style={styles.createBtn}
            />

            {/* Switch to Login */}
            <View style={styles.bottomLinkContainer}>
              <Typography variant="bodySm" color={theme.colors.textSecondary}>
                Already have an account?{' '}
              </Typography>
              <TouchableOpacity onPress={() => router.push('/auth/login')}>
                <Typography variant="bodySm" color={theme.colors.textPrimary} style={{ fontWeight: '600', textDecorationLine: 'underline' }}>
                  Log In
                </Typography>
              </TouchableOpacity>
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
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topBarTitle: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  profileBadge: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  engineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  engineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  signInLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  stepBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepText: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  form: {
    gap: 4,
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchText: {
    fontSize: 11,
    fontWeight: '500',
  },
  specCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
  },
  specIconBadge: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  specText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
    gap: 10,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.xs,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.actionPrimary,
    borderColor: theme.colors.actionPrimary,
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  createBtn: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.actionPrimary,
  },
  bottomLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
});
