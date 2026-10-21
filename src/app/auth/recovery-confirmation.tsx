import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MailCheck,
  Mail,
  Lock,
  Clock,
  HelpCircle,
  RotateCw,
} from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { AuthService } from '../../core/auth/authService';

export default function RecoveryConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email || '';

  const [secondsRemaining, setSecondsRemaining] = useState(45);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining]);

  const handleOpenEmailApp = async () => {
    try {
      const url = 'mailto:';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch {
      // Non-fatal if device has no default mail client registered
    }
  };

  const handleResend = async () => {
    if (secondsRemaining > 0 || !email) return;

    try {
      setResending(true);
      await AuthService.requestPasswordReset(email);
      setSecondsRemaining(45);
      setResendMessage('Reset instructions re-dispatched.');
    } catch {
      setResendMessage('Could not re-send instructions. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
            AUTH-05
          </Typography>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Mail Icon & Headings */}
        <View style={styles.header}>
          <View style={styles.mailIconBadge}>
            <MailCheck size={22} color={theme.colors.textPrimary} />
          </View>
          <Typography variant="headlineMd" color={theme.colors.textPrimary} style={styles.title}>
            Check your email
          </Typography>
          <Typography variant="bodyMd" color={theme.colors.textSecondary} style={styles.subtitle}>
            If an account matches this email, password reset instructions will be sent.
          </Typography>
        </View>

        {/* Actions & Cooldown Card */}
        <View style={styles.actionsCard}>
          <Button
            title="Open Email App"
            variant="outline"
            onPress={handleOpenEmailApp}
            icon={<Mail size={18} color={theme.colors.textPrimary} />}
            style={styles.openMailBtn}
          />

          <View style={styles.resendRow}>
            <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ fontSize: 12 }}>
              {"Didn't receive an email?"}
            </Typography>

            {secondsRemaining > 0 ? (
              <View style={styles.cooldownBadge}>
                <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.cooldownText}>
                  Resend available in {secondsRemaining}s
                </Typography>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.resendActionBtn}
                onPress={handleResend}
                disabled={resending}
              >
                <RotateCw size={12} color={theme.colors.textPrimary} style={{ marginRight: 4 }} />
                <Typography variant="labelSm" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                  {resending ? 'Sending...' : 'Resend Link'}
                </Typography>
              </TouchableOpacity>
            )}
          </View>

          {resendMessage && (
            <Typography variant="bodySm" color={theme.colors.success} style={{ fontSize: 11, textAlign: 'center' }}>
              {resendMessage}
            </Typography>
          )}
        </View>

        {/* Zero-Knowledge Neutral Privacy Statement */}
        <View style={styles.neutralCard}>
          <Lock size={16} color={theme.colors.textSecondary} style={{ marginTop: 2, marginRight: 8 }} />
          <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.neutralText}>
            <Typography variant="bodySm" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
              Zero-Knowledge Protection:{' '}
            </Typography>
            To protect account privacy, CredKeep does not confirm or disclose whether an email address is associated with an active ledger.
          </Typography>
        </View>

        {/* Expired or Invalid Link Card */}
        <View style={styles.expiredCard}>
          <Clock size={18} color={theme.colors.textSecondary} style={{ marginTop: 2, marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
              Link expired or invalid?
            </Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.expiredText}>
              Reset links expire after 15 minutes. If your token expires or fails, submit a new request.
            </Typography>
          </View>
        </View>

        {/* Help & Support Card */}
        <View style={styles.helpCard}>
          <View style={styles.helpLeft}>
            <HelpCircle size={18} color={theme.colors.textSecondary} />
            <Typography variant="bodySm" color={theme.colors.textSecondary}>
              Still having trouble?
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
      </ScrollView>

      {/* Sticky Bottom Area */}
      <View style={styles.bottomArea}>
        <Button
          title="Back to Login"
          onPress={() => router.replace('/auth/login')}
          style={styles.loginBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  mailIconBadge: {
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
  actionsCard: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: 12,
    marginBottom: theme.spacing.md,
  },
  openMailBtn: {
    width: '100%',
    minHeight: 48,
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.borderDefault,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  cooldownBadge: {
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  cooldownText: {
    fontSize: 11,
    fontFamily: 'Inter',
  },
  resendActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  neutralCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: theme.spacing.md,
  },
  neutralText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  expiredCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    marginBottom: theme.spacing.md,
  },
  expiredText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
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
  loginBtn: {
    backgroundColor: theme.colors.actionPrimary,
    minHeight: 48,
  },
});
