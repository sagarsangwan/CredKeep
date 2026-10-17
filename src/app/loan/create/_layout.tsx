import React from 'react';
import { Stack } from 'expo-router';
import { LoanWizardProvider } from './LoanWizardContext';
import { theme } from '../../../ui/theme';

export default function LoanCreateLayout() {
  return (
    <LoanWizardProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="documents" />
        <Stack.Screen name="review" />
      </Stack>
    </LoanWizardProvider>
  );
}
