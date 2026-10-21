import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { theme } from './theme';
import { Typography } from './Typography';

export interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepTitle?: string;
  stepSubtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  totalSteps,
  stepTitle,
  stepSubtitle,
  onBack,
  showBack = true,
}) => {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
      {/* Header Row: Back button + Step text */}
      <View style={styles.headerRow}>
        {showBack && onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back to previous step"
          >
            <ArrowLeft size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        <View style={styles.titleContainer}>
          <Typography variant="labelMd" color={theme.colors.textSecondary}>
            STEP {currentStep} OF {totalSteps}
          </Typography>
          {stepTitle ? (
            <Typography variant="titleMd" color={theme.colors.textPrimary} numberOfLines={1}>
              {stepTitle}
            </Typography>
          ) : null}
        </View>

        <View style={styles.backPlaceholder} />
      </View>

      {/* Segmented Progress Track */}
      <View style={styles.trackContainer}>
        {steps.map((step) => {
          const isCompleted = step < currentStep;
          const isActive = step === currentStep;
          return (
            <View
              key={step}
              style={[
                styles.segment,
                (isCompleted || isActive) ? styles.segmentActive : styles.segmentInactive,
              ]}
            />
          );
        })}
      </View>

      {stepSubtitle ? (
        <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.subtitle}>
          {stepSubtitle}
        </Typography>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 36,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  trackContainer: {
    flexDirection: 'row',
    gap: 4,
    height: 4,
    width: '100%',
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  segmentActive: {
    backgroundColor: theme.colors.actionPrimary,
  },
  segmentInactive: {
    backgroundColor: theme.colors.borderDefault,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
});
