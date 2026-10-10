import { Stack } from 'expo-router';
import { DatabaseProvider } from '../core/database/DatabaseProvider';
import { PinLock } from '../ui/PinLock';

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <PinLock>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="borrower" options={{ headerShown: false }} />
            <Stack.Screen name="loan" options={{ headerShown: false }} />
          </Stack>
        </PinLock>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
