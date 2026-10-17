import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  ArrowUpRight,
  ArrowDownLeft,
  XCircle,
  ArrowLeftRight,
  AlertCircle,
  Clock,
  LucideIcon,
} from 'lucide-react-native';
import { theme } from './theme';
import { Typography } from './Typography';
import { formatRupees, Paise } from '../core/domain/money';

export interface AuditEvent {
  id: string;
  type: 'DISBURSEMENT' | 'COLLECTION' | 'REVERSAL' | 'REPLACEMENT' | 'PENALTY_ASSESSMENT' | 'EXTENSION';
  title?: string;
  amountPaise: Paise;
  effectiveDate: string;
  principalPaise?: Paise;
  interestPaise?: Paise;
  penaltyPaise?: Paise;
  reason?: string;
  paymentMethod?: string;
  isCorrection?: boolean;
  notes?: string;
}

export interface AuditTimelineProps {
  events: AuditEvent[];
  emptyMessage?: string;
}

interface EventConfig {
  icon: LucideIcon;
  iconColor: string;
  badgeBg: string;
  defaultTitle: string;
  isNegative: boolean;
}

const getEventConfig = (type: AuditEvent['type']): EventConfig => {
  switch (type) {
    case 'DISBURSEMENT':
      return {
        icon: ArrowUpRight,
        iconColor: theme.colors.actionPrimary,
        badgeBg: theme.colors.surfaceSoft,
        defaultTitle: 'Loan Disbursed',
        isNegative: false,
      };
    case 'COLLECTION':
      return {
        icon: ArrowDownLeft,
        iconColor: theme.colors.success,
        badgeBg: theme.colors.successContainer,
        defaultTitle: 'Payment Received',
        isNegative: false,
      };
    case 'REVERSAL':
      return {
        icon: XCircle,
        iconColor: theme.colors.danger,
        badgeBg: theme.colors.dangerContainer,
        defaultTitle: 'Payment Reversed',
        isNegative: true,
      };
    case 'REPLACEMENT':
      return {
        icon: ArrowLeftRight,
        iconColor: theme.colors.warning,
        badgeBg: theme.colors.warningContainer,
        defaultTitle: 'Corrected Payment',
        isNegative: false,
      };
    case 'PENALTY_ASSESSMENT':
      return {
        icon: AlertCircle,
        iconColor: theme.colors.warning,
        badgeBg: theme.colors.warningContainer,
        defaultTitle: 'Penalty Assessed',
        isNegative: false,
      };
    case 'EXTENSION':
      return {
        icon: Clock,
        iconColor: theme.colors.textPrimary,
        badgeBg: theme.colors.surfaceSoft,
        defaultTitle: 'Loan Extended',
        isNegative: false,
      };
  }
};

export const AuditTimeline: React.FC<AuditTimelineProps> = ({
  events,
  emptyMessage = 'No financial transactions recorded yet.',
}) => {
  if (events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Typography variant="bodyMd" color={theme.colors.textSecondary}>
          {emptyMessage}
        </Typography>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const config = getEventConfig(event.type);
        const IconComponent = config.icon;

        return (
          <View key={event.id || `${event.type}_${index}`} style={styles.eventRow}>
            {/* Timeline Track & Node */}
            <View style={styles.trackColumn}>
              <View style={[styles.nodeCircle, { backgroundColor: config.badgeBg }]}>
                <IconComponent size={14} color={config.iconColor} />
              </View>
              {!isLast && <View style={styles.connectingLine} />}
            </View>

            {/* Event Content Card */}
            <View style={[styles.contentColumn, !isLast && styles.contentSpacing]}>
              <View style={styles.headerRow}>
                <Typography variant="titleMd" color={theme.colors.textPrimary}>
                  {event.title || config.defaultTitle}
                </Typography>
                <Typography
                  variant="titleMd"
                  tabularNums
                  color={event.type === 'REVERSAL' ? theme.colors.danger : theme.colors.textPrimary}
                  style={{ fontWeight: '700' }}
                >
                  {event.type === 'REVERSAL' ? '-' : '+'}
                  {formatRupees(event.amountPaise)}
                </Typography>
              </View>

              <View style={styles.dateRow}>
                <Typography variant="labelSm" color={theme.colors.textSecondary}>
                  {event.effectiveDate}
                </Typography>
                {event.paymentMethod ? (
                  <View style={styles.pillBadge}>
                    <Typography variant="labelSm" color={theme.colors.textSecondary}>
                      {event.paymentMethod}
                    </Typography>
                  </View>
                ) : null}
              </View>

              {/* Allocations Breakdown */}
              {(event.principalPaise !== undefined || event.interestPaise !== undefined) && (
                <View style={styles.breakdownBox}>
                  {event.principalPaise !== undefined && (
                    <Typography variant="bodySm" color={theme.colors.textSecondary}>
                      Principal: {formatRupees(event.principalPaise)}
                    </Typography>
                  )}
                  {event.interestPaise !== undefined && (
                    <Typography variant="bodySm" color={theme.colors.textSecondary}>
                      Interest: {formatRupees(event.interestPaise)}
                    </Typography>
                  )}
                  {event.penaltyPaise !== undefined && event.penaltyPaise > 0 && (
                    <Typography variant="bodySm" color={theme.colors.warningText}>
                      Penalty: {formatRupees(event.penaltyPaise)}
                    </Typography>
                  )}
                </View>
              )}

              {/* Reason / Correction Details */}
              {event.reason ? (
                <View style={styles.reasonBox}>
                  <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ fontStyle: 'italic' }}>
                    Reason: &quot;{event.reason}&quot;
                  </Typography>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.spacing.sm,
  },
  emptyContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventRow: {
    flexDirection: 'row',
  },
  trackColumn: {
    alignItems: 'center',
    width: 32,
  },
  nodeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  connectingLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.borderDefault,
    marginVertical: 4,
  },
  contentColumn: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  contentSpacing: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  pillBadge: {
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.xs,
  },
  breakdownBox: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
  reasonBox: {
    marginTop: 6,
  },
});
