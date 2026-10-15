import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseProvider } from '../core/database/DatabaseProvider';
import { PinLock } from '../ui/PinLock';
import { AuthStore } from '../core/auth/authStore';
import { theme } from '../ui/theme';

function RootNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    console.log('[LIFECYCLE] APP_START: RootLayout mounted');
    console.log('[LIFECYCLE] AUTH_HYDRATING: Checking authentication session');

    async function checkAuth() {
      const auth = await AuthStore.isAuthenticated();
      console.log(`[LIFECYCLE] ${auth ? 'AUTHENTICATED' : 'UNAUTHENTICATED'}: session checked`);
      setIsAuthenticated(auth);
    }
    checkAuth();

    const unsubscribe = AuthStore.onAuthChange((tenantId) => {
      console.log(`[LIFECYCLE] AUTH_CHANGED: tenantId=${tenantId}`);
      setIsAuthenticated(Boolean(tenantId));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated === null) return;

    const inAuthGroup = segments[0] === 'auth';
    const isSecuritySetup = (segments as string[])[1] === 'security-setup';

    if (!isAuthenticated && !inAuthGroup) {
      // Unauthenticated cold start or logged out: Gate immediately to Welcome/Auth
      router.replace('/auth');
    } else if (isAuthenticated && inAuthGroup && !isSecuritySetup) {
      // Authenticated session: ensure user is redirected to dashboard unless completing PIN onboarding
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, router]);

  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="borrower/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="loan/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="reports/index" options={{ headerShown: false }} />
      <Stack.Screen name="settings/security" options={{ headerShown: false }} />
      <Stack.Screen name="settings/backup" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <PinLock>
          <RootNavigator />
        </PinLock>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
