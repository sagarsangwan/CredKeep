import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { theme } from './theme';

export interface CardProps extends ViewProps {
  variant?: 'surface' | 'soft' | 'outline';
  padding?: keyof typeof theme.spacing;
  elevated?: boolean;
}

export function Card({
  variant = 'surface',
  padding = 'md',
  style,
  children,
  ...rest
}: CardProps) {
  const getVariantStyle = () => {
    switch (variant) {
      case 'soft':
        return styles.soft;
      case 'outline':
        return styles.outline;
      case 'surface':
      default:
        return styles.surface;
    }
  };

  return (
    <View
      style={[
        styles.card,
        getVariantStyle(),
        { padding: theme.spacing[padding] },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

export const AppCard = Card;

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
  },
  surface: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderDefault,
  },
  soft: {
    backgroundColor: theme.colors.surfaceSoft,
    borderColor: theme.colors.borderDefault,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.borderDefault,
  },
});
