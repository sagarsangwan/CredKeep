import React, { useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { Typography } from './Typography';
import { theme } from './theme';

export interface PasswordInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  badge?: string;
  containerStyle?: StyleProp<ViewStyle>;
  headerRight?: React.ReactNode;
  required?: boolean;
}

export function PasswordInput({
  label = 'Password',
  error,
  helperText,
  badge,
  containerStyle,
  headerRight,
  required = false,
  style,
  onFocus,
  onBlur,
  ...rest
}: PasswordInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {(label || headerRight) && (
        <View style={styles.headerRow}>
          <View style={styles.labelContainer}>
            {label ? (
              <Typography variant="labelMd" color={theme.colors.textPrimary} style={styles.label}>
                {label}
                {required ? <Typography variant="labelMd" color={theme.colors.danger}> *</Typography> : null}
              </Typography>
            ) : null}
            {badge ? (
              <View style={styles.badge}>
                <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.badgeText}>
                  {badge}
                </Typography>
              </View>
            ) : null}
          </View>
          {headerRight}
        </View>
      )}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
      >
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={theme.colors.textDisabled}
          secureTextEntry={!isVisible}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setIsVisible((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isVisible ? (
            <EyeOff size={18} color={theme.colors.textSecondary} />
          ) : (
            <Eye size={18} color={theme.colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>

      {error ? (
        <Typography variant="bodySm" color={theme.colors.danger} style={styles.message}>
          {error}
        </Typography>
      ) : helperText ? (
        <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.message}>
          {helperText}
        </Typography>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontWeight: '500',
  },
  badge: {
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.md,
    minHeight: 48,
    paddingLeft: theme.spacing.md,
    paddingRight: 4,
  },
  inputFocused: {
    borderColor: theme.colors.actionPrimary,
    borderWidth: 1.5,
  },
  inputError: {
    borderColor: theme.colors.danger,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    height: 48,
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: 'Inter',
  },
  eyeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    marginTop: theme.spacing.xs,
    fontSize: 12,
    lineHeight: 16,
  },
});
