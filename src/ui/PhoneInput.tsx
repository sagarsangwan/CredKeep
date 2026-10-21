import React, { useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Typography } from './Typography';
import { theme } from './theme';

export interface PhoneInputProps extends Omit<TextInputProps, 'onChangeText' | 'value'> {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  required?: boolean;
}

export function validateIndianMobile(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(cleaned);
}

export function PhoneInput({
  label = 'Mobile Number',
  value,
  onChangeText,
  error,
  helperText = 'Used as device owner identifier. Not visually labeled as verified.',
  containerStyle,
  required = false,
  style,
  onFocus,
  onBlur,
  ...rest
}: PhoneInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleTextChange = (text: string) => {
    // Keep only numeric characters and max 10 digits
    const numericOnly = text.replace(/\D/g, '').slice(0, 10);
    onChangeText(numericOnly);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Typography variant="labelMd" color={theme.colors.textPrimary} style={styles.label}>
            {label}
            {required ? <Typography variant="labelMd" color={theme.colors.danger}> *</Typography> : null}
          </Typography>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        {/* Country Code Prefix Box */}
        <View style={styles.prefixContainer}>
          <Typography variant="labelLg" color={theme.colors.textPrimary} style={styles.prefixText}>
            +91
          </Typography>
        </View>

        {/* 10-Digit Mobile Text Input */}
        <View
          style={[
            styles.inputContainer,
            isFocused && styles.inputFocused,
            error ? styles.inputError : null,
          ]}
        >
          <TextInput
            style={[styles.input, style]}
            value={value}
            onChangeText={handleTextChange}
            placeholder="98765 00000"
            placeholderTextColor={theme.colors.textDisabled}
            keyboardType="numeric"
            maxLength={10}
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
        </View>
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  label: {
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prefixContainer: {
    height: 48,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prefixText: {
    fontWeight: '600',
  },
  inputContainer: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
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
    height: '100%',
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontFamily: 'Inter',
  },
  message: {
    marginTop: theme.spacing.xs,
    fontSize: 12,
    lineHeight: 16,
  },
});
