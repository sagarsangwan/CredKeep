import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthStore } from '../core/auth/authStore';
import { theme } from '../ui/theme';

export default function RootIndex() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    async function determineRoute() {
      const isAuth = await AuthStore.isAuthenticated();
      if (!isMounted) return;
      if (isAuth) {
        router.replace('/(tabs)');
      } else {
        router.replace('/auth');
      }
    }
    determineRoute();
    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
