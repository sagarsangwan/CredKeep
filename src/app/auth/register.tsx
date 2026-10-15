import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { AuthService } from '../../core/auth/authService';
import { triggerBackendWarmup } from '../../core/api/backendWarmup';

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Non-blocking Render staging server wake-up ping
    triggerBackendWarmup();
  }, []);

  const handleRegister = async () => {
    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await AuthService.register({
        username,
        password,
        workspaceName: workspaceName.trim() || undefined,
        email: email.trim() || undefined,
      });

      // Onboarding step: offer optional offline security setup (biometric/PIN)
      router.replace('/auth/security-setup');
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please check your network or try a different username.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/auth')}>
          <ArrowLeft size={24} color={theme.colors.onBackground} />
          <Typography variant="labelLg" color={theme.colors.onBackground} style={{ marginLeft: 8 }}>
            Welcome
          </Typography>
        </TouchableOpacity>

        <View style={styles.header}>
          <Typography variant="headlineLg" color={theme.colors.primary} style={styles.title}>
            CredKeep
          </Typography>
          <Typography variant="bodyMd" color={theme.colors.textSecondary} style={styles.subtitle}>
            Register Lender Account & Workspace
          </Typography>
        </View>

        <View style={styles.formCard}>
          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={styles.formTitle}>
            Create Account
          </Typography>

          {error && (
            <View style={styles.errorContainer}>
              <Typography variant="bodySm" color={theme.colors.error}>
                {error}
              </Typography>
            </View>
          )}

          <Input
            label="Username *"
            placeholder="Choose username"
            value={username}
            onChangeText={(t) => {
              setUsername(t);
              if (error) setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Password *"
            placeholder="Choose secure password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (error) setError(null);
            }}
            secureTextEntry
            autoCapitalize="none"
          />

          <Input
            label="Workspace / Business Name"
            placeholder="e.g. Shyam Microfinance"
            value={workspaceName}
            onChangeText={setWorkspaceName}
          />

          <Input
            label="Email (Optional)"
            placeholder="lender@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            style={styles.registerBtn}
          />

          <Button
            title="Already have an account? Log In"
            variant="ghost"
            onPress={() => router.push('/auth/login')}
            style={styles.backBtn}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingVertical: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
  },
  formCard: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  formTitle: {
    marginBottom: theme.spacing.lg,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FDE8E8',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  registerBtn: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  backBtn: {
    marginTop: theme.spacing.xs,
  },
});
