import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CheckCircle2, CloudOff, AlertCircle, LucideIcon } from 'lucide-react-native';
import { theme } from './theme';
import { Typography } from './Typography';

export type SyncStatus = 'SYNCED' | 'SYNCING' | 'SAVED_ON_PHONE' | 'NEEDS_REVIEW';

export interface SyncBadgeProps {
  status: SyncStatus;
  needsReviewCount?: number;
  onPress?: () => void;
}

interface StatusConfig {
  icon: LucideIcon | null;
  color: string;
  bg: string;
  label: string;
}

export const SyncBadge: React.FC<SyncBadgeProps> = ({
  status,
  needsReviewCount = 0,
  onPress,
}) => {
  const getConfig = (): StatusConfig => {
    switch (status) {
      case 'SYNCED':
        return {
          icon: CheckCircle2,
          color: theme.colors.success,
          bg: theme.colors.successContainer,
          label: 'Synced',
        };
      case 'SYNCING':
        return {
          icon: null,
          color: theme.colors.warning,
          bg: theme.colors.warningContainer,
          label: 'Syncing...',
        };
      case 'NEEDS_REVIEW':
        return {
          icon: AlertCircle,
          color: theme.colors.warningText,
          bg: theme.colors.warningContainer,
          label: needsReviewCount > 0 ? `${needsReviewCount} Needs Review` : 'Needs Review',
        };
      case 'SAVED_ON_PHONE':
      default:
        return {
          icon: CloudOff,
          color: theme.colors.textSecondary,
          bg: theme.colors.surfaceSoft,
          label: 'Saved on Phone',
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;

  const content = (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      {status === 'SYNCING' ? (
        <ActivityIndicator size="small" color={config.color} style={styles.spinner} />
      ) : IconComponent ? (
        <IconComponent size={13} color={config.color} style={{ marginRight: 4 }} />
      ) : null}
      <Typography variant="labelSm" color={config.color}>
        {config.label}
      </Typography>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  spinner: {
    marginRight: 4,
    transform: [{ scale: 0.7 }],
  },
});
