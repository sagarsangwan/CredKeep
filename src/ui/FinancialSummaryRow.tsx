import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { theme } from './theme';
import { Typography } from './Typography';

export interface FinancialSummaryRowProps {
  label: string;
  sublabel?: string;
  value: string;
  valueSubtext?: string;
  variant?: 'standard' | 'highlight' | 'success' | 'warning' | 'danger';
  pillLabel?: string;
  style?: ViewStyle;
}

export const FinancialSummaryRow: React.FC<FinancialSummaryRowProps> = ({
  label,
  sublabel,
  value,
  valueSubtext,
  variant = 'standard',
  pillLabel,
  style,
}) => {
  const getValueColor = () => {
    switch (variant) {
      case 'success':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      case 'danger':
        return theme.colors.danger;
      case 'highlight':
        return theme.colors.textPrimary;
      default:
        return theme.colors.textPrimary;
    }
  };

  const isHighlight = variant === 'highlight';

  return (
    <View style={[styles.container, isHighlight && styles.highlightContainer, style]}>
      <View style={styles.labelCol}>
        <Typography
          variant={isHighlight ? 'titleMd' : 'bodyMd'}
          color={isHighlight ? theme.colors.textPrimary : theme.colors.textSecondary}
          style={isHighlight ? { fontWeight: '600' } : undefined}
        >
          {label}
        </Typography>
        {sublabel ? (
          <Typography variant="bodySm" color={theme.colors.textDisabled} style={{ marginTop: 2 }}>
            {sublabel}
          </Typography>
        ) : null}
      </View>

      <View style={styles.valueCol}>
        <View style={styles.valueRow}>
          {pillLabel ? (
            <View style={styles.pill}>
              <Typography variant="labelSm" color={theme.colors.textSecondary}>
                {pillLabel}
              </Typography>
            </View>
          ) : null}
          <Typography
            variant={isHighlight ? 'titleMd' : 'bodyMd'}
            tabularNums
            color={getValueColor()}
            style={{ fontWeight: isHighlight ? '700' : '500' }}
          >
            {value}
          </Typography>
        </View>
        {valueSubtext ? (
          <Typography variant="bodySm" tabularNums color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
            {valueSubtext}
          </Typography>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  highlightContainer: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
    marginTop: 4,
  },
  labelCol: {
    flex: 1,
    paddingRight: 12,
  },
  valueCol: {
    alignItems: 'flex-end',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.xs,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
});
