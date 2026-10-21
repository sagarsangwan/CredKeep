import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Typography } from './Typography';
import { theme } from './theme';
import { Paise, toPaise } from '../core/domain/money';

export interface MoneyInputProps {
  label?: string;
  value?: string; // rupees string like "50000"
  onChangeValue?: (val: string) => void;
  valuePaise?: Paise;
  onChangePaise?: (paise: Paise) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
  editable?: boolean;
}

export function MoneyInput({
  label,
  value,
  onChangeValue,
  valuePaise,
  onChangePaise,
  error,
  helperText,
  placeholder = '0',
  containerStyle,
  editable = true,
}: MoneyInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const displayValue = valuePaise !== undefined 
    ? (valuePaise > 0 ? Math.round(valuePaise / 100).toString() : '')
    : (value || '');

  const handleChangeText = (text: string) => {
    // Only allow digits
    const cleaned = text.replace(/[^0-9]/g, '');
    if (onChangeValue) {
      onChangeValue(cleaned);
    }
    if (onChangePaise) {
      const rupees = parseInt(cleaned, 10) || 0;
      onChangePaise(toPaise(rupees));
    }
  };

  const getInWords = (numStr: string) => {
    const val = parseInt(numStr, 10);
    if (!val || isNaN(val)) return null;
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Crore`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
    return null;
  };

  const words = getInWords(displayValue);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Typography variant="labelMd" color={theme.colors.textSecondary}>
            {label}
          </Typography>
          {words ? (
            <Typography variant="labelSm" color={theme.colors.textSecondary}>
              {words}
            </Typography>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error ? styles.inputError : null,
          !editable && styles.inputDisabled,
        ]}
      >
        <Typography
          variant="headlineMd"
          color={value ? theme.colors.textPrimary : theme.colors.textDisabled}
          style={styles.currencyPrefix}
        >
          ₹
        </Typography>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textDisabled}
          keyboardType="number-pad"
          inputMode="numeric"
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.md,
    minHeight: 56,
    paddingHorizontal: theme.spacing.md,
  },
  inputFocused: {
    borderColor: theme.colors.borderStrong,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  inputDisabled: {
    backgroundColor: theme.colors.surfaceSoft,
  },
  currencyPrefix: {
    marginRight: theme.spacing.sm,
    fontWeight: '600',
  },
  textInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
    paddingVertical: theme.spacing.sm,
  },
  message: {
    marginTop: theme.spacing.xs,
  },
});
