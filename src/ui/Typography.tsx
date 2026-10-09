import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { theme } from './theme';

type TypographyVariant = keyof typeof theme.typography;

interface TypographyProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  weight?: '400' | '500' | '600' | '700';
}

export function Typography({
  variant = 'bodyMd',
  color = theme.colors.textPrimary,
  align = 'left',
  weight,
  style,
  children,
  ...rest
}: TypographyProps) {
  const variantStyle = theme.typography[variant];
  
  return (
    <RNText
      style={[
        variantStyle,
        { color, textAlign: align },
        weight && { fontWeight: weight },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
