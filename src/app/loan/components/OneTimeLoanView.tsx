import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../../ui/Typography';
import { Card } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { AttachmentGrid } from '../../../ui/AttachmentGrid';
import { AuditTimeline, AuditEvent } from '../../../ui/AuditTimeline';
import { theme } from '../../../ui/theme';
import { Loan, LoanTerm, LoanAttachment } from '../../../core/database/loanRepository';
import { Borrower } from '../../../core/database/borrowerRepository';
import { formatINR, Paise, toPaise } from '../../../core/domain/money';

export interface OneTimeLoanViewProps {
  loan: Loan;
  borrower: Borrower | null;
  terms: LoanTerm[];
  earnings: any;
  history: any[];
  attachments: LoanAttachment[];
  previewPenalty: number;
  onRecordPayment: () => void;
  onExtendLoan: (months: number, interestCollectedPaise: Paise) => Promise<void>;
  onCorrectPayment: (tx: any) => void;
}

export const OneTimeLoanView: React.FC<OneTimeLoanViewProps> = ({
  loan,
  borrower,
  terms,
  earnings,
  history,
  attachments,
  previewPenalty,
  onRecordPayment,
  onExtendLoan,
  onCorrectPayment,
}) => {
  const [extendModalVisible, setExtendModalVisible] = useState(false);
  const [extendMonths, setExtendMonths] = useState('3');
  const [interestCollectedInr, setInterestCollectedInr] = useState('');
  const [isExtending, setIsExtending] = useState(false);

  // Financial figures
  const principalPaise = loan.principal_paise as Paise;
  const principalReturned = (earnings?.principalReturned || 0) as Paise;
  const remainingPrincipal = Math.max(0, principalPaise - principalReturned) as Paise;

  const totalMarkupReceived = (earnings?.markupReceived || 0) as Paise;
  const outstandingPenalty = ((earnings?.outstandingPenalty || 0) + previewPenalty) as Paise;

  // Active term is the latest term
  const activeTerm = terms.length > 0 ? terms[terms.length - 1] : null;

  // Calculate monthly interest for active term
  const activeAnnualRate = activeTerm?.annual_rate ?? loan.annual_rate ?? 24;
  const monthlyRate = activeAnnualRate / 12 / 100;
  const monthlyInterestPaise = Math.round(remainingPrincipal * monthlyRate) as Paise;

  const handleConfirmExtend = async () => {
    const months = parseInt(extendMonths, 10);
    if (isNaN(months) || months <= 0) {
      Alert.alert('Invalid Duration', 'Extension duration must be at least 1 month.');
      return;
    }
    const collectedPaise = toPaise(parseFloat(interestCollectedInr) || 0);

    try {
      setIsExtending(true);
      await onExtendLoan(months, collectedPaise);
      setExtendModalVisible(false);
      setInterestCollectedInr('');
      Alert.alert('Success', `Bullet loan extended for ${months} additional months.`);
    } catch (e: any) {
      Alert.alert('Extension Error', e.message || 'Failed to extend loan');
    } finally {
      setIsExtending(false);
    }
  };

  // Format ledger history for AuditTimeline
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Borrower Header */}
      <View style={styles.borrowerCard}>
        <View style={styles.borrowerLeft}>
          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
            {borrower?.name || 'Borrower'}
          </Typography>
          <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
            {borrower?.phone} • Bullet Loan (Interest-Only)
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
          PRINCIPAL REPAYABLE AT MATURITY
        </Typography>
        <Typography variant="rupeeDisplay" tabularNums color={theme.colors.textPrimary} style={{ marginVertical: 4 }}>
          {formatINR(remainingPrincipal)}
        </Typography>

        <Typography variant="bodySm" color={theme.colors.textSecondary}>
          Matures on {activeTerm?.maturity_date || loan.maturity_date || 'N/A'}
        </Typography>

        {/* 3 Metrics Sub-Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCol}>
            <Typography variant="labelSm" color={theme.colors.textSecondary}>
              Monthly Interest
            </Typography>
            <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
              {formatINR(monthlyInterestPaise)}
            </Typography>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <Typography variant="labelSm" color={theme.colors.textSecondary}>
              Interest Collected
            </Typography>
            <Typography variant="titleMd" tabularNums color={theme.colors.success} style={{ fontWeight: '600', marginTop: 2 }}>
              {formatINR(totalMarkupReceived)}
            </Typography>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <Typography variant="labelSm" color={theme.colors.textSecondary}>
              Penalties Due
            </Typography>
            <Typography
              variant="titleMd"
              tabularNums
              color={outstandingPenalty > 0 ? theme.colors.danger : theme.colors.textSecondary}
              style={{ fontWeight: '600', marginTop: 2 }}
            >
              {formatINR(outstandingPenalty)}
            </Typography>
          </View>
        </View>
      </Card>

      {/* Action Buttons: Record Payment & Extend Loan */}
      <View style={styles.btnRow}>
        <View style={{ flex: 1 }}>
          <Button
            title="Record Collection"
            variant="primary"
            onPress={onRecordPayment}
          />
        </View>
        {loan.status === 'ACTIVE' && (
          <View style={{ flex: 1 }}>
            <Button
              title="Extend Loan"
              variant="outline"
              onPress={() => setExtendModalVisible(true)}
            />
          </View>
        )}
      </View>

      {/* Contract Terms History */}
      <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
        Terms History ({terms.length} {terms.length === 1 ? 'Term' : 'Terms'})
      </Typography>

      <Card style={styles.termsCard}>
        {terms.map((term, index) => {
          const isSettled = term.interest_settled === 1 || term.settled === 1;

          return (
            <View
              key={term.id}
              style={[
                styles.termRow,
                index === terms.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.termLeft}>
                <View style={styles.termBadge}>
                  <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ fontWeight: '700' }}>
                    T{term.term_number}
                  </Typography>
                </View>
                <View>
                  <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                    {term.duration_months} Months @ {term.annual_rate}% p.a.
                  </Typography>
                  <Typography variant="bodySm" color={theme.colors.textSecondary}>
                    {term.start_date} to {term.maturity_date}
                  </Typography>
                </View>
              </View>

              <View style={styles.termRight}>
                <View style={[styles.settledBadge, isSettled ? styles.settledTrue : styles.settledFalse]}>
                  <Typography
                    variant="labelSm"
                    color={isSettled ? theme.colors.successText : theme.colors.warningText}
                    style={{ fontWeight: '600' }}
                  >
                    {isSettled ? 'Settled' : 'Active'}
                  </Typography>
                </View>
                <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
                  {formatINR(term.interest_paise as Paise)}
                </Typography>
              </View>
            </View>
          );
        })}
      </Card>

      {/* Physical Collateral Card */}
      {loan.collateral ? (
        <Card style={styles.collateralCard}>
          <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ letterSpacing: 0.5, marginBottom: 4 }}>
            COLLATERAL / SECURITY HELD
          </Typography>
          <Typography variant="bodyMd" color={theme.colors.textPrimary}>
            {loan.collateral}
          </Typography>
        </Card>
      ) : null}

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

      {/* Financial Audit Trail */}
      <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
        Financial Audit Trail
      </Typography>

      <AuditTimeline events={auditEvents} />

      {/* Extend Loan Modal */}
      <Modal
        visible={extendModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setExtendModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setExtendModalVisible(false)}>
                <Typography variant="bodyMd" color={theme.colors.textSecondary}>
                  Cancel
                </Typography>
              </TouchableOpacity>
              <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                Extend Bullet Loan
              </Typography>
              <View style={{ width: 44 }} />
            </View>

            <View style={{ padding: theme.spacing.lg }}>
              <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700', marginBottom: 6 }}>
                New Term Extension
              </Typography>
              <Typography variant="bodyMd" color={theme.colors.textSecondary} style={{ marginBottom: 20 }}>
                Extending creates a new consecutive contract term and marks previous interest as settled.
              </Typography>

              <Input
                label="Extension Duration (Months) *"
                placeholder="e.g. 3"
                value={extendMonths}
                onChangeText={setExtendMonths}
                keyboardType="number-pad"
              />

              <Input
                label="Interest Collected to Settle Current Term (₹)"
                placeholder="0"
                value={interestCollectedInr}
                onChangeText={setInterestCollectedInr}
                keyboardType="numeric"
              />

              <View style={{ marginTop: 24 }}>
                <Button
                  title="Confirm Extension"
                  onPress={handleConfirmExtend}
                  loading={isExtending}
                  variant="primary"
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
  termsCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  termRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  termLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  termBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termRight: {
    alignItems: 'flex-end',
  },
  settledBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.xs,
  },
  settledTrue: {
    backgroundColor: theme.colors.successContainer,
  },
  settledFalse: {
    backgroundColor: theme.colors.warningContainer,
  },
  collateralCard: {
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
});
