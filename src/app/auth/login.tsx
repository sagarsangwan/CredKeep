import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Typography } from '../../ui/Typography';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { AuthService } from '../../core/auth/authService';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await AuthService.login({ username, password });
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueOffline = () => {
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Typography variant="headlineLg" color={theme.colors.primary} style={styles.title}>
            CredKeep
          </Typography>
          <Typography variant="bodyMd" color={theme.colors.textSecondary} style={styles.subtitle}>
            Field Lending & Portfolio Management
          </Typography>
        </View>

        <View style={styles.formCard}>
          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={styles.formTitle}>
            Log In
          </Typography>

          {error && (
            <View style={styles.errorContainer}>
              <Typography variant="bodySm" color={theme.colors.error}>
                {error}
              </Typography>
            </View>
          )}

          <Input
            label="Username"
            placeholder="Enter username"
            value={username}
            onChangeText={(t) => {
              setUsername(t);
              if (error) setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Password"
            placeholder="Enter password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (error) setError(null);
            }}
            secureTextEntry
            autoCapitalize="none"
          />

          <Button
            title="Log In"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginBtn}
          />

          <Button
            title="Create New Account"
            variant="outline"
            onPress={() => router.push('/auth/register')}
            style={styles.registerBtn}
          />

          <Button
            title="Continue Offline (Local Mode)"
            variant="ghost"
            onPress={handleContinueOffline}
            style={styles.offlineBtn}
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
    backgroundColor: theme.colors.surface,
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
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
  },
  loginBtn: {
    marginTop: theme.spacing.sm,
  },
  registerBtn: {
    marginTop: theme.spacing.md,
  },
  offlineBtn: {
    marginTop: theme.spacing.sm,
  },
});
