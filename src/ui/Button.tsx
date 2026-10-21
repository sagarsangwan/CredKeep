import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Typography } from './Typography';
import { theme } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: 'small' | 'medium' | 'large';
  title: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  title,
  loading = false,
  disabled = false,
  style,
  icon,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const getVariantStyles = (pressed: boolean) => {
    switch (variant) {
      case 'primary':
        return {
          container: [
            styles.base,
            styles.primary,
            pressed && styles.primaryPressed,
            isDisabled && styles.disabled,
          ],
          textColor: isDisabled ? theme.colors.textDisabled : theme.colors.actionOnPrimary,
          spinnerColor: theme.colors.actionOnPrimary,
        };
      case 'secondary':
        return {
          container: [
            styles.base,
            styles.secondary,
            pressed && styles.secondaryPressed,
            isDisabled && styles.disabled,
          ],
          textColor: isDisabled ? theme.colors.textDisabled : theme.colors.textPrimary,
          spinnerColor: theme.colors.textPrimary,
        };
      case 'destructive':
        return {
          container: [
            styles.base,
            styles.destructive,
            pressed && styles.destructivePressed,
            isDisabled && styles.disabled,
          ],
          textColor: isDisabled ? theme.colors.textDisabled : '#FFFFFF',
          spinnerColor: '#FFFFFF',
        };
      case 'ghost':
        return {
          container: [
            styles.base,
            styles.ghost,
            pressed && styles.ghostPressed,
            isDisabled && styles.disabledGhost,
          ],
          textColor: isDisabled ? theme.colors.textDisabled : theme.colors.textSecondary,
          spinnerColor: theme.colors.textSecondary,
        };
      case 'outline':
      default:
        return {
          container: [
            styles.base,
            styles.outline,
            pressed && styles.outlinePressed,
            isDisabled && styles.disabledOutline,
          ],
          textColor: isDisabled ? theme.colors.textDisabled : theme.colors.textPrimary,
          spinnerColor: theme.colors.textPrimary,
        };
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [getVariantStyles(pressed).container, style]}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...rest}
    >
      {({ pressed }) => {
        const { textColor, spinnerColor } = getVariantStyles(pressed);
        return loading ? (
          <ActivityIndicator color={spinnerColor} size="small" />
        ) : (
          <>
            {icon ? <>{icon}</> : null}
            <Typography
              variant="labelLg"
              color={textColor}
              style={icon ? { marginLeft: theme.spacing.sm } : undefined}
            >
              {title}
            </Typography>
          </>
        );
      }}
    </Pressable>
  );
}

// Export alias for AppButton
export const AppButton = Button;

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  primary: {
    backgroundColor: theme.colors.actionPrimary,
  },
  primaryPressed: {
    backgroundColor: '#383838',
  },
  secondary: {
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  secondaryPressed: {
    backgroundColor: theme.colors.surfacePressed,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  outlinePressed: {
    backgroundColor: theme.colors.surfaceSoft,
  },
  destructive: {
    backgroundColor: theme.colors.danger,
  },
  destructivePressed: {
    backgroundColor: '#991B1B',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostPressed: {
    backgroundColor: theme.colors.surfaceSoft,
  },
  disabled: {
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    opacity: 0.6,
  },
  disabledOutline: {
    borderColor: theme.colors.borderDefault,
    opacity: 0.5,
  },
  disabledGhost: {
    opacity: 0.5,
  },
});
