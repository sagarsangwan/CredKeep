import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, StyleSheet, ActivityIndicator } from 'react-native';
import { Typography } from './Typography';
import { theme } from './theme';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  title: string;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  title,
  loading = false,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const getStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          container: [styles.container, styles.primaryContainer, disabled && styles.disabledContainer],
          text: theme.colors.onPrimary,
        };
      case 'secondary':
        return {
          container: [styles.container, styles.secondaryContainer, disabled && styles.disabledContainer],
          text: theme.colors.onSecondary,
        };
      case 'outline':
        return {
          container: [styles.container, styles.outlineContainer, disabled && styles.disabledOutlineContainer],
          text: theme.colors.primary,
        };
      case 'ghost':
        return {
          container: [styles.container, styles.ghostContainer],
          text: theme.colors.primary,
        };
    }
  };

  const currentStyles = getStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[currentStyles.container, style]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={currentStyles.text} />
      ) : (
        <Typography variant="labelLg" color={currentStyles.text}>
          {title}
        </Typography>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  primaryContainer: {
    backgroundColor: theme.colors.primary,
  },
  secondaryContainer: {
    backgroundColor: theme.colors.secondary,
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  disabledContainer: {
    backgroundColor: theme.colors.outlineVariant,
  },
  disabledOutlineContainer: {
    borderColor: theme.colors.outlineVariant,
    opacity: 0.5,
  },
});
