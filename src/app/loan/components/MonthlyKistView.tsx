import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Typography } from '../../../ui/Typography';
import { Card } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { AttachmentGrid } from '../../../ui/AttachmentGrid';
import { AuditTimeline, AuditEvent } from '../../../ui/AuditTimeline';
import { theme } from '../../../ui/theme';
import { Loan, LoanAttachment } from '../../../core/database/loanRepository';
import { Borrower } from '../../../core/database/borrowerRepository';
import { formatINR, Paise } from '../../../core/domain/money';

export interface MonthlyKistViewProps {
  loan: Loan;
  borrower: Borrower | null;
  schedule: any[];
  earnings: any;
  history: any[];
  attachments: LoanAttachment[];
  onRecordPayment: () => void;
  onCorrectPayment: (tx: any) => void;
}

export const MonthlyKistView: React.FC<MonthlyKistViewProps> = ({
  loan,
  borrower,
  schedule,
  earnings,
  history,
  attachments,
  onRecordPayment,
  onCorrectPayment,
}) => {

  // Financial calculations
  const totalPrincipal = loan.principal_paise as Paise;
  const totalInterest = (loan.interest_paise || 0) as Paise;
  const totalContract = (loan.total_paise || totalPrincipal + totalInterest) as Paise;

  const principalReturned = (earnings?.principalReturned || 0) as Paise;
  const markupReceived = (earnings?.markupReceived || 0) as Paise;
  const totalCollected = (principalReturned + markupReceived) as Paise;
  const remainingTotal = Math.max(0, totalContract - totalCollected) as Paise;

  const paidKistsCount = schedule.filter((s) => s.status === 'PAID').length;
  const totalKistsCount = schedule.length;

  // Format ledger history events for AuditTimeline
  const auditEvents: AuditEvent[] = history.map((tx) => {
    let type: AuditEvent['type'] = 'COLLECTION';
    if (tx.transaction_type === 'DISBURSEMENT') type = 'DISBURSEMENT';
    else if (tx.transaction_type === 'PENALTY_ASSESSMENT') type = 'PENALTY_ASSESSMENT';
    else if (tx.transaction_type === 'REVERSAL') type = 'REVERSAL';
    else if (tx.transaction_type === 'CORRECTION_REPLACEMENT') type = 'REPLACEMENT';

    return {
      id: tx.id,
      type,
      title: tx.notes || undefined,
      amountPaise: tx.amount_paise as Paise,
      effectiveDate: tx.effective_date,
      principalPaise: tx.allocated_principal_paise !== undefined ? (tx.allocated_principal_paise as Paise) : undefined,
      interestPaise: tx.allocated_markup_paise !== undefined ? (tx.allocated_markup_paise as Paise) : undefined,
      penaltyPaise: tx.allocated_penalty_paise !== undefined ? (tx.allocated_penalty_paise as Paise) : undefined,
      paymentMethod: tx.payment_method || undefined,
      reason: tx.reason || undefined,
    };
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return { bg: theme.colors.successContainer, text: theme.colors.successText, label: 'Paid' };
      case 'PARTIAL':
      case 'PARTIALLY_PAID':
        return { bg: theme.colors.warningContainer, text: theme.colors.warningText, label: 'Partial' };
      case 'OVERDUE':
        return { bg: theme.colors.dangerContainer, text: theme.colors.dangerText, label: 'Overdue' };
      case 'DUE':
      default:
        return { bg: theme.colors.surfaceSoft, text: theme.colors.textSecondary, label: 'Due' };
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Borrower Header Row */}
      <View style={styles.borrowerCard}>
        <View style={styles.borrowerLeft}>
          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
            {borrower?.name || 'Borrower'}
          </Typography>
          <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
            {borrower?.phone} • Monthly Instalment
          </Typography>
        </View>

        <View
          style={[
            styles.statusPill,
            loan.status === 'ACTIVE'
              ? styles.pillActive
              : loan.status === 'SETTLED'
              ? styles.pillSettled
              : styles.pillDefault,
          ]}
        >
          <Typography
            variant="labelSm"
            color={
              loan.status === 'ACTIVE'
                ? theme.colors.success
                : loan.status === 'SETTLED'
                ? theme.colors.textSecondary
                : theme.colors.danger
            }
          >
            {loan.status}
          </Typography>
        </View>
      </View>

      {/* Hero Financial Summary */}
      <Card style={styles.heroCard}>
        <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ letterSpacing: 0.5 }}>
          OUTSTANDING BALANCE
        </Typography>
        <Typography variant="rupeeDisplay" tabularNums color={theme.colors.textPrimary} style={{ marginVertical: 4 }}>
          {formatINR(remainingTotal)}
        </Typography>

        <View style={styles.progressRow}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: totalKistsCount > 0 ? `${(paidKistsCount / totalKistsCount) * 100}%` : '0%' },
              ]}
            />
          </View>
          <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ marginLeft: 8 }}>
            {paidKistsCount} of {totalKistsCount} paid
          </Typography>
        </View>

        {/* 3 Metrics Sub-Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCol}>
            <Typography variant="labelSm" color={theme.colors.textSecondary}>
              Principal
            </Typography>
            <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
              {formatINR(totalPrincipal)}
            </Typography>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <Typography variant="labelSm" color={theme.colors.textSecondary}>
              Total Markup
            </Typography>
            <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
              {formatINR(totalInterest)}
            </Typography>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <Typography variant="labelSm" color={theme.colors.textSecondary}>
              Collected
            </Typography>
            <Typography variant="titleMd" tabularNums color={theme.colors.success} style={{ fontWeight: '600', marginTop: 2 }}>
              {formatINR(totalCollected)}
            </Typography>
          </View>
        </View>
      </Card>

      {/* Action Buttons */}
      <View style={styles.btnRow}>
        <View style={{ flex: 1 }}>
          <Button
            title="Record Collection"
            variant="primary"
            onPress={onRecordPayment}
          />
        </View>
      </View>

      {/* Repayment Schedule Table */}
      <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
        Repayment Schedule ({schedule.length} Kists)
      </Typography>

      <Card style={styles.scheduleCard}>
        {schedule.map((item, index) => {
          const badge = getStatusBadge(item.status);
          const totalPaid = ((item.principal_paid_paise || 0) + (item.markup_paid_paise || 0)) as Paise;

          return (
            <View
              key={item.id || item.period_number}
              style={[
                styles.scheduleItem,
                index === schedule.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.scheduleItemLeft}>
                <View style={styles.kistBadge}>
                  <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ fontWeight: '700' }}>
                    #{item.period_number}
                  </Typography>
                </View>
                <View>
                  <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                    {formatINR(item.total_due_paise as Paise)}
                  </Typography>
                  <Typography variant="bodySm" color={theme.colors.textSecondary}>
                    Due {item.effective_due_date || item.due_date}
                  </Typography>
                </View>
              </View>

              <View style={styles.scheduleItemRight}>
                <View style={[styles.kistStatusPill, { backgroundColor: badge.bg }]}>
                  <Typography variant="labelSm" color={badge.text} style={{ fontWeight: '600' }}>
                    {badge.label}
                  </Typography>
                </View>
                {totalPaid > 0 && item.status !== 'PAID' && (
                  <Typography variant="bodySm" tabularNums color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
                    Paid {formatINR(totalPaid)} • Due {formatINR(Math.max(0, (item.total_due_paise || 0) - totalPaid) as Paise)}
                  </Typography>
                )}
              </View>
            </View>
          );
        })}
      </Card>

      {/* Verified Attachments */}
      {attachments.length > 0 && (
        <>
          <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
            Attached Documents ({attachments.length})
          </Typography>
          <AttachmentGrid
            attachments={attachments.map((a) => ({
              id: a.id,
              filePath: a.file_path,
              docType: (a.doc_type || 'other') as any,
              fileName: a.file_name,
            }))}
            readOnly
          />
        </>
      )}

      {/* Transaction & Audit History */}
      <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
        Financial Audit Trail
      </Typography>

      <AuditTimeline events={auditEvents} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSoft,
  },
  content: {
    padding: theme.spacing.md,
    gap: 12,
    paddingBottom: 40,
  },
  borrowerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  borrowerLeft: {
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.xs,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: theme.colors.successContainer,
    borderColor: '#86EFAC',
  },
  pillSettled: {
    backgroundColor: theme.colors.surfaceSoft,
    borderColor: theme.colors.borderDefault,
  },
  pillDefault: {
    backgroundColor: theme.colors.dangerContainer,
    borderColor: '#FECACA',
  },
  heroCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.borderDefault,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.actionPrimary,
    borderRadius: 3,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
  metricCol: {
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.colors.borderDefault,
    marginHorizontal: 8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 4,
  },
  sectionTitle: {
    marginTop: 12,
    fontWeight: '600',
  },
  scheduleCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  scheduleItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kistBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleItemRight: {
    alignItems: 'flex-end',
  },
  kistStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.xs,
  },
});
