export const theme = {
  colors: {
    primary: '#14283F',
    primaryContainer: '#1E3A5F',
    onPrimary: '#FFFFFF',
    secondary: '#0C8278',
    secondaryContainer: '#E6F4F2',
    onSecondary: '#FFFFFF',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceTint: '#F7F9FB',
    outline: '#E2E8F0',
    outlineVariant: '#CBD5E1',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    success: '#16A34A',
    successContainer: '#DCFCE7',
    warning: '#EA580C',
    warningContainer: '#FFEDD5',
    error: '#DC2626',
    errorContainer: '#FEE2E2',
  },
  typography: {
    rupeeDisplay: {
      fontFamily: 'Inter',
      fontSize: 30,
      fontWeight: '700' as const,
      letterSpacing: -0.03 * 30,
    },
    headlineMd: {
      fontFamily: 'Inter',
      fontSize: 22,
      fontWeight: '600' as const,
      letterSpacing: -0.01 * 22,
    },
    headlineSm: {
      fontFamily: 'Inter',
      fontSize: 18,
      fontWeight: '600' as const,
    },
    bodyLg: {
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: '400' as const,
    },
    bodyMd: {
      fontFamily: 'Inter',
      fontSize: 14,
      fontWeight: '400' as const,
    },
    bodySm: {
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: '400' as const,
    },
    labelLg: {
      fontFamily: 'Inter',
      fontSize: 14,
      fontWeight: '600' as const,
      letterSpacing: 0.01 * 14,
    },
    labelSm: {
      fontFamily: 'Inter',
      fontSize: 10,
      fontWeight: '700' as const,
      letterSpacing: 0.04 * 10,
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 6,
    md: 8,
    lg: 16,
    xl: 24,
    full: 9999,
  }
};
