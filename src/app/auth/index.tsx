import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { triggerBackendWarmup } from '../../core/api/backendWarmup';

export default function WelcomeScreen() {
  const router = useRouter();

  useEffect(() => {
    // Non-blocking, single-flight Render backend wake-up ping
    triggerBackendWarmup();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroSection}>
          <View style={styles.iconCircle}>
            <Shield size={44} color={theme.colors.onPrimary} />
          </View>

          <Typography variant="headlineLg" color={theme.colors.onBackground} style={styles.title}>
            Welcome to CredKeep
          </Typography>
          <Typography variant="bodyLg" color={theme.colors.textSecondary} style={styles.subtitle}>
            Field Lending & Portfolio Management
          </Typography>
        </View>

        <Card style={styles.featureCard}>
          <Typography variant="headlineSm" color={theme.colors.onPrimary} style={styles.featureTitle}>
            Secure Offline-First Ledger
          </Typography>
          <Typography variant="bodyMd" color={theme.colors.onPrimaryContainer} style={styles.featureBody}>
            • Hardware-backed SQLCipher 256-bit encryption{'\n'}
            • Full lending passbook, kist collection & schedule engine{'\n'}
            • Continuous cloud synchronization across your devices
          </Typography>
        </Card>

        <View style={styles.actionContainer}>
          <Button
            title="Create Account"
            onPress={() => router.push('/auth/register')}
            style={styles.primaryBtn}
          />

          <Button
            title="Log In"
            variant="outline"
            onPress={() => router.push('/auth/login')}
            style={styles.secondaryBtn}
          />
        </View>

        <View style={styles.footer}>
          <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.footerText}>
            CredKeep V2 • Build 2 (Release Candidate)
          </Typography>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  featureCard: {
    backgroundColor: theme.colors.primaryContainer,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginVertical: theme.spacing.xl,
  },
  featureTitle: {
    marginBottom: theme.spacing.sm,
    fontWeight: '700',
  },
  featureBody: {
    lineHeight: 22,
  },
  actionContainer: {
    width: '100%',
    gap: theme.spacing.md,
  },
  primaryBtn: {
    width: '100%',
  },
  secondaryBtn: {
    width: '100%',
    borderColor: theme.colors.outline,
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  footerText: {
    textAlign: 'center',
  },
});
