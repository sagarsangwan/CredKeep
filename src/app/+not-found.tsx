import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HelpCircle } from 'lucide-react-native';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { theme } from '../ui/theme';
import { AuthStore } from '../core/auth/authStore';

export default function NotFoundScreen() {
  const router = useRouter();

  const handleReturnHome = async () => {
    const isAuth = await AuthStore.isAuthenticated();
    if (isAuth) {
      router.replace('/(tabs)');
    } else {
      router.replace('/auth');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <HelpCircle size={64} color={theme.colors.primary} />
        </View>
        <Typography variant="headlineMd" style={styles.title}>
          Page Not Found
        </Typography>
        <Typography variant="bodyMd" color={theme.colors.textSecondary} style={styles.subtitle}>
          The screen you are looking for does not exist or has been moved.
        </Typography>
        <Button
          title="Return to Dashboard"
          variant="primary"
          onPress={handleReturnHome}
          style={styles.button}
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
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  iconContainer: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    marginBottom: theme.spacing.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  button: {
    minWidth: 200,
  },
});
