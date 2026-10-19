import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  Info,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Input } from '../../ui/Input';
import { PhoneInput, validateIndianMobile } from '../../ui/PhoneInput';
import { Button } from '../../ui/Button';
import { GoogleLogo } from '../../ui/GoogleSignInButton';
import { theme } from '../../ui/theme';
import { AuthService } from '../../core/auth/authService';

export default function GoogleOnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    tempToken?: string;
    profileName?: string;
    email?: string;
  }>();

  const profileName = params.profileName || 'Lender Account';
  const email = params.email || 'lender@gmail.com';
  const tempToken = params.tempToken || '';

  const [mobileNumber, setMobileNumber] = useState('');
  const [firmAlias, setFirmAlias] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPhoneValid = mobileNumber.length === 0 || validateIndianMobile(mobileNumber);

  const handleContinue = async () => {
    setError(null);

    if (!mobileNumber.trim()) {
      setError('Please provide your 10-digit mobile number.');
      return;
    }

    if (!validateIndianMobile(mobileNumber)) {
      setError('Please enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9).');
      return;
    }

    try {
      setLoading(true);
      await AuthService.completeGoogleOnboarding({
        tempToken,
        phone: mobileNumber.trim(),
        fullName: profileName,
        workspaceName: firmAlias.trim() || undefined,
      });

      router.replace('/auth/security-setup');
    } catch (err: any) {
      setError(err?.message || 'Failed to complete profile. Please verify your details.');
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
            <ArrowLeft size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.titleWithBadge}>
            <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
              Google Setup
            </Typography>
            <View style={styles.badgePill}>
              <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ fontSize: 10, fontWeight: '600' }}>
                AUTH-02
              </Typography>
            </View>
          </View>
          <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ fontFamily: 'Inter' }}>
            Step 2 of 2
          </Typography>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Section Heading & Telemetry Step Badge */}
          <View style={styles.header}>
            <View style={styles.stepBadgeRow}>
              <View style={styles.identityBadge}>
                <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ fontSize: 11, fontWeight: '500' }}>
                  Step 2 of 2 • Google Identity
                </Typography>
              </View>
              <View style={styles.dotIndicatorRow}>
                <View style={styles.dot} />
                <View style={styles.dot} />
              </View>
            </View>
            <Typography variant="headlineLg" color={theme.colors.textPrimary} style={styles.title}>
              Complete your profile
            </Typography>
            <Typography variant="bodyMd" color={theme.colors.textSecondary} style={styles.subtitle}>
              Finish setting up your CredKeep ledger following Google sign-in.
            </Typography>
          </View>

          {/* Google Account Connected Card */}
          <View style={styles.connectedCard}>
            <View style={styles.connectedHeader}>
              <View style={styles.googleBrandRow}>
                <View style={styles.googleLogoContainer}>
                  <GoogleLogo size={16} />
                </View>
                <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                  Google Authenticated
                </Typography>
              </View>
              <View style={styles.verifiedBadge}>
                <View style={styles.verifiedDot} />
                <Typography variant="labelSm" color={theme.colors.success} style={{ fontSize: 11, fontWeight: '500' }}>
                  Verified by Google
                </Typography>
              </View>
            </View>

            <View style={styles.profileDetailsBox}>
              <View style={styles.profileRow}>
                <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.detailLabel}>
                  Profile Name
                </Typography>
                <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                  {profileName}
                </Typography>
              </View>
              <View style={[styles.profileRow, styles.profileRowDivider]}>
                <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.detailLabel}>
                  Account Email
                </Typography>
                <Typography variant="labelMd" color={theme.colors.textPrimary} numberOfLines={1} style={styles.emailText}>
                  {email}
                </Typography>
              </View>
            </View>
          </View>

          {/* Explanatory Callout */}
          <View style={styles.infoCallout}>
            <Info size={16} color={theme.colors.textSecondary} style={{ marginTop: 2, marginRight: 8 }} />
            <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.infoText}>
              Your number helps keep your account details up to date and links offline transaction slips.
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

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Mobile Number (+91) */}
            <PhoneInput
              label="Mobile Number"
              required
              value={mobileNumber}
              onChangeText={setMobileNumber}
              error={!isPhoneValid ? 'Please enter a valid 10-digit Indian number' : undefined}
              helperText="10-digit mobile number for local receipts"
            />

            {/* Optional Lender / Firm Alias */}
            <Input
              label="Lender / Firm Alias (Optional)"
              placeholder="e.g. RC Kirana & Finance"
              value={firmAlias}
              onChangeText={setFirmAlias}
              helperText="Appears atop customer credit reports and WhatsApp ledgers"
            />

            {/* Offline Keystore Encryption Note Card */}
            <View style={styles.keystoreCard}>
              <ShieldCheck size={18} color={theme.colors.textSecondary} style={{ marginTop: 2, marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                  Hardware-Isolated Ledger
                </Typography>
                <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.keystoreText}>
                  {"Financial records are stored exclusively in your device's encrypted SQLite database. Google credentials are only used for account identity verification."}
                </Typography>
              </View>
            </View>

            {/* Primary Action Button */}
            <Button
              title="Continue to CredKeep"
              onPress={handleContinue}
              loading={loading}
              icon={<ArrowRight size={18} color="#FFFFFF" />}
              style={styles.continueBtn}
            />
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
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.md,
  },
  stepBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  identityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  dotIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.actionPrimary,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  connectedCard: {
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: 12,
  },
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  googleBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  googleLogoContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(23, 128, 90, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(23, 128, 90, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  verifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  profileDetailsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    padding: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileRowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
    paddingTop: 8,
    marginTop: 8,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emailText: {
    fontWeight: '500',
    maxWidth: 180,
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(247, 247, 245, 0.6)',
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: theme.spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
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
  keystoreCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
  },
  keystoreText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  continueBtn: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.actionPrimary,
  },
});
