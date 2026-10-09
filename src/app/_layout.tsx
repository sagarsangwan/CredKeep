import { Stack } from 'expo-router';
import { DatabaseProvider } from '../core/database/DatabaseProvider';
import { PinLock } from '../ui/PinLock';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <PinLock>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </PinLock>
    </DatabaseProvider>
  );
}
