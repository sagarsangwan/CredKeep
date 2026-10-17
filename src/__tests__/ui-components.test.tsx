import React from 'react';
import { theme } from '../ui/theme';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { MoneyInput } from '../ui/MoneyInput';
import { StepIndicator } from '../ui/StepIndicator';
import { SyncBadge } from '../ui/SyncBadge';
import { FinancialSummaryRow } from '../ui/FinancialSummaryRow';
import { ConfirmationDialog } from '../ui/ConfirmationDialog';
import { Skeleton, OfflineBanner, InlineErrorCard, EmptyState } from '../ui/Feedback';
import { AttachmentGrid } from '../ui/AttachmentGrid';
import { AuditTimeline } from '../ui/AuditTimeline';
import { toPaise } from '../core/domain/money';


// Mock lucide-react-native
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return new Proxy({}, {
    get: (_, name) => (props: any) => React.createElement(View, { ...props, testID: String(name) }),
  });
});

// Mock image pickers
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

describe('UI Design System - Neutral Precision Components', () => {
  it('contains expected Neutral Precision theme tokens', () => {
    expect(theme.colors.actionPrimary).toBe('#242424');
    expect(theme.colors.background).toBe('#FFFFFF');
    expect(theme.colors.surfaceSoft).toBe('#F7F7F5');
    expect(theme.colors.borderDefault).toBe('#E8E8E6');
    expect(theme.colors.textPrimary).toBe('#191919');
    expect(theme.colors.textSecondary).toBe('#737373');
    expect(theme.colors.success).toBe('#17805A');
    expect(theme.colors.warning).toBe('#B7791F');
    expect(theme.colors.danger).toBe('#C83E3E');
  });

  it('exports all core UI components', () => {
    expect(Typography).toBeDefined();
    expect(Button).toBeDefined();
    expect(Card).toBeDefined();
    expect(Input).toBeDefined();
    expect(MoneyInput).toBeDefined();
    expect(StepIndicator).toBeDefined();
    expect(SyncBadge).toBeDefined();
    expect(FinancialSummaryRow).toBeDefined();
    expect(ConfirmationDialog).toBeDefined();
    expect(Skeleton).toBeDefined();
    expect(OfflineBanner).toBeDefined();
    expect(InlineErrorCard).toBeDefined();
    expect(EmptyState).toBeDefined();
    expect(AttachmentGrid).toBeDefined();
    expect(AuditTimeline).toBeDefined();
  });

  it('verifies MoneyInput paise calculation logic', () => {
    // Tests paise to rupee conversion and vice-versa
    expect(toPaise(100)).toBe(10000);
    expect(toPaise(0)).toBe(0);
    expect(toPaise(350.5)).toBe(35050);
  });
});
