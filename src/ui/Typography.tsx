import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { theme } from './theme';

export type TypographyVariant = keyof typeof theme.typography;

export interface TypographyProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  weight?: '400' | '500' | '600' | '700';
  tabularNums?: boolean;
}

export function Typography({
  variant = 'bodyMd',
  color = theme.colors.textPrimary,
  align = 'left',
  weight,
  tabularNums = false,
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
        tabularNums && { fontVariant: ['tabular-nums'] },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
