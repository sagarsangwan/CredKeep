import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { CloudOff, AlertCircle, FolderArchive } from 'lucide-react-native';
import { theme } from './theme';
import { Typography } from './Typography';
import { Card } from './Card';
import { Button } from './Button';

// ---------------------------------------------------------
// Skeleton Loader (COMP-09)
// ---------------------------------------------------------

export interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = theme.borderRadius.sm,
  style,
}) => {
  const [opacity] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeletonBase,
        {
          width: width as any,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const SkeletonCard: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <Card style={[styles.skeletonCard, style]}>
    <View style={styles.skeletonRow}>
      <Skeleton width={44} height={44} borderRadius={theme.borderRadius.md} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
    <View style={{ marginTop: 12, gap: 6 }}>
      <Skeleton width="100%" height={10} />
      <Skeleton width="80%" height={10} />
    </View>
  </Card>
);

// ---------------------------------------------------------
// Offline Hairline Banner (COMP-15)
// ---------------------------------------------------------

export interface OfflineBannerProps {
  visible?: boolean;
  message?: string;
  style?: ViewStyle;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  visible = true,
  message = 'Working Offline — changes saved on phone',
  style,
}) => {
  if (!visible) return null;

  return (
    <View style={[styles.offlineBanner, style]}>
      <CloudOff size={14} color={theme.colors.textSecondary} />
      <Typography variant="labelMd" color={theme.colors.textSecondary} style={{ marginLeft: 6 }}>
        {message}
      </Typography>
    </View>
  );
};

// ---------------------------------------------------------
// Inline Error Card (COMP-10)
// ---------------------------------------------------------

export interface InlineErrorCardProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
}

export const InlineErrorCard: React.FC<InlineErrorCardProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Retry',
  style,
}) => {
  return (
    <View style={[styles.errorCard, style]}>
      <View style={styles.errorContent}>
        <AlertCircle size={20} color={theme.colors.danger} />
        <View style={styles.errorTextContainer}>
          <Typography variant="titleMd" color={theme.colors.dangerText}>
            {title}
          </Typography>
          <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
            {message}
          </Typography>
        </View>
      </View>
      {onRetry ? (
        <View style={styles.errorAction}>
          <Button
            title={retryLabel}
            onPress={onRetry}
            variant="outline"
            size="small"
          />
        </View>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------
// Empty State View (SYS-01 / SYS-02)
// ---------------------------------------------------------

export interface EmptyStateProps {
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionTitle,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.emptyContainer, style]}>
      <View style={styles.iconCircle}>
        <FolderArchive size={32} color={theme.colors.textSecondary} />
      </View>
      <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ marginTop: 16 }}>
        {title}
      </Typography>
      <Typography
        variant="bodyMd"
        color={theme.colors.textSecondary}
        style={{ marginTop: 6, textAlign: 'center', maxWidth: 280 }}
      >
        {description}
      </Typography>
      {actionTitle && onAction ? (
        <View style={{ marginTop: 20 }}>
          <Button title={actionTitle} onPress={onAction} variant="primary" />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: theme.colors.borderDefault,
  },
  skeletonCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceSoft,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md,
  },
  errorCard: {
    backgroundColor: theme.colors.dangerContainer,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  errorTextContainer: {
    flex: 1,
  },
  errorAction: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
