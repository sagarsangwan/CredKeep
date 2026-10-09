import { Stack } from 'expo-router';
import { DatabaseProvider } from '../core/database/DatabaseProvider';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </DatabaseProvider>
  );
}
