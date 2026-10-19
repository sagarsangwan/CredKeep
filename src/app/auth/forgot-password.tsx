import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  Key,
  Mail,
  Lock,
  HelpCircle,
  AlertCircle,
} from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { AuthService } from '../../core/auth/authService';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendResetLink = async () => {
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid recovery email address.');
      return;
    }

    try {
      setLoading(true);
      await AuthService.requestPasswordReset(email.trim());

      // Transition to recovery confirmation state
      router.push({
        pathname: '/auth/recovery-confirmation',
        params: { email: email.trim() },
      });
    } catch (err: any) {
      // Even on network error, maintain neutral recovery contract if request completed
      setError(err?.message || 'Could not dispatch recovery instructions. Please try again.');
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
            onPress={() => router.replace('/auth/login')}
            accessibilityRole="button"
            accessibilityLabel="Back to Login"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
            Password Reset
          </Typography>
          <View style={styles.badgePill}>
            <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ fontSize: 10, fontWeight: '600' }}>
              AUTH-04
            </Typography>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section with Key Icon */}
          <View style={styles.header}>
            <View style={styles.keyIconBadge}>
              <Key size={20} color={theme.colors.textPrimary} />
            </View>
            <Typography variant="headlineMd" color={theme.colors.textPrimary} style={styles.title}>
              Reset your password
            </Typography>
            <Typography variant="bodyMd" color={theme.colors.textSecondary} style={styles.subtitle}>
              Enter your registered recovery email to receive a secure reset link.
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

          {/* Form Section */}
          <View style={styles.form}>
            <View style={styles.labelRow}>
              <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.inputHeader}>
                RECOVERY EMAIL ADDRESS
              </Typography>
              <View style={styles.requiredBadge}>
                <Typography variant="labelSm" color={theme.colors.warningText} style={{ fontSize: 10, fontWeight: '600' }}>
                  Required
                </Typography>
              </View>
            </View>

            <Input
              placeholder="name@domain.com"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<Mail size={18} color={theme.colors.textSecondary} />}
              helperText="We will send an encrypted single-use recovery link to this address."
            />

            {/* Zero-Knowledge Security Note */}
            <View style={styles.securityNote}>
              <Lock size={16} color={theme.colors.textSecondary} style={{ marginTop: 2, marginRight: 8 }} />
              <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.securityText}>
                <Typography variant="bodySm" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                  Zero-Knowledge Protection:{' '}
                </Typography>
                For security, recovery requests use neutral rate-limiting and never reveal whether an account exists in the ledger.
              </Typography>
            </View>

            {/* Help & Support Line */}
            <View style={styles.helpCard}>
              <View style={styles.helpLeft}>
                <HelpCircle size={18} color={theme.colors.textSecondary} />
                <Typography variant="bodySm" color={theme.colors.textSecondary}>
                  Having trouble receiving emails?
                </Typography>
              </View>
              <TouchableOpacity
                onPress={() => Linking.openURL('mailto:support@credkeep.app').catch(() => {})}
                accessibilityRole="button"
              >
                <Typography variant="labelSm" color={theme.colors.textPrimary} style={{ fontWeight: '600', textDecorationLine: 'underline' }}>
                  Contact Help
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Persistent Sticky Bottom Area */}
        <View style={styles.bottomArea}>
          <Button
            title="Send Reset Link"
            onPress={handleSendResetLink}
            loading={loading}
            icon={<ArrowRight size={18} color="#FFFFFF" />}
            style={styles.sendBtn}
          />
          <TouchableOpacity
            style={styles.backToLoginBtn}
            onPress={() => router.replace('/auth/login')}
            accessibilityRole="button"
          >
            <Typography variant="bodyMd" color={theme.colors.textSecondary} style={{ fontWeight: '500' }}>
              Back to Login
            </Typography>
          </TouchableOpacity>
        </View>
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
    paddingTop: theme.spacing.lg,
    paddingBottom: 100,
  },
  header: {
    marginBottom: theme.spacing.lg,
    gap: 8,
  },
  keyIconBadge: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  subtitle: {
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
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  inputHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  requiredBadge: {
    backgroundColor: theme.colors.warningContainer,
    borderWidth: 1,
    borderColor: '#F3DFC1',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.xs,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginVertical: theme.spacing.sm,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginTop: theme.spacing.xs,
  },
  helpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomArea: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.background,
  },
  sendBtn: {
    backgroundColor: theme.colors.actionPrimary,
    minHeight: 48,
  },
  backToLoginBtn: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
});
