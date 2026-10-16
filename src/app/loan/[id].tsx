import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan, LoanTerm, LoanAttachment } from '../../core/database/loanRepository';
import { Borrower } from '../../core/database/borrowerRepository';
import { formatINR, Paise, toPaise } from '../../core/domain/money';
import { calculateContractInterest, calculateMaturityDate } from '../../core/domain/schedule';

export default function LoanDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { loans, transactions, borrowers, refreshVersion, triggerRefresh } = useDatabase();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [terms, setTerms] = useState<LoanTerm[]>([]);
  const [attachments, setAttachments] = useState<LoanAttachment[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [previewPenalty, setPreviewPenalty] = useState(0);

  // Modals state
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmountInr, setPaymentAmountInr] = useState('');

  const [extendModalVisible, setExtendModalVisible] = useState(false);
  const [extendMonths, setExtendMonths] = useState(3);
  const [extendInterestCollectedInr, setExtendInterestCollectedInr] = useState('');

  const [correctModalVisible, setCorrectModalVisible] = useState(false);
  const [targetTx, setTargetTx] = useState<any | null>(null);
  const [correctedAmountInr, setCorrectedAmountInr] = useState('');
  const [correctionReason, setCorrectionReason] = useState('Data Entry Error');
  const [customReason, setCustomReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!loans || typeof id !== 'string') return;
    const l = await loans.getById(id);
    setLoan(l);
    if (!l) return;

    if (borrowers) {
      const b = await borrowers.getById(l.borrower_id);
      setBorrower(b);
    }

    const atts = await loans.getAttachments(l.id);
    setAttachments(atts);

    if (l.product_type === 'bullet') {
      const t = await loans.getLoanTerms(l.id);
      setTerms(t);
    } else {
      const s = await loans.getSchedule(l.id);
      setSchedule(s);
    }

    if (transactions) {
      const summary = await transactions.getEarningsSummary({ loanId: l.id });
      setEarnings(summary);

      const today = new Date().toISOString().split('T')[0];
      const pen = await transactions.previewPenalties(l.id, today);
      setPreviewPenalty(pen);

      const allTx = await (loans as any).db.getAllAsync(
        `SELECT * FROM transactions WHERE loan_id = ? ORDER BY effective_date DESC, created_at DESC`,
        [l.id]
      );
      setHistory(allTx || []);
    }
  }, [id, loans, borrowers, transactions]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshVersion]);

  const isBullet = loan?.product_type === 'bullet';
  const productTitle = isBullet ? 'One-Time Repayment' : 'Monthly Kist';

  // Derived financial figures
  const totalInterestContractedPaise = useMemo(() => {
    if (!loan) return 0;
    if (isBullet) {
      return terms.reduce((acc, t) => acc + (t.interest_paise || 0), 0) || (loan.interest_paise || 0);
    }
    return loan.interest_paise || 0;
  }, [loan, isBullet, terms]);

  const interestReceivedPaise = earnings?.markupReceived || 0;
  const interestUnpaidPaise = Math.max(0, totalInterestContractedPaise - interestReceivedPaise);
  const principalOutstandingPaise = Math.max(0, (loan?.principal_paise || 0) - (earnings?.principalReturned || 0));
  const outstandingPenaltyPaise = earnings?.outstandingPenalty || 0;
  const totalDueNowPaise = principalOutstandingPaise + interestUnpaidPaise + outstandingPenaltyPaise + previewPenalty;

  // Monthly Kist specific metrics
  const kistAmountPaise = useMemo(() => {
    if (schedule.length > 0) {
      return schedule[0].total_due_paise || 0;
    }
    if (loan && loan.term_months > 0) {
      const total = loan.total_paise || (loan.principal_paise + (loan.interest_paise || 0));
      return Math.round(total / loan.term_months);
    }
    return 0;
  }, [schedule, loan]);

  const installmentsPaid = schedule.filter(k => k.status === 'PAID').length;
  const installmentsPending = schedule.length - installmentsPaid;
  const nextDueKist = schedule.find(k => k.status !== 'PAID');
  const nextDueDate = nextDueKist ? nextDueKist.effective_due_date : (loan?.maturity_date || '-');
  const remainingContractualReceivablesPaise = useMemo(() => {
    return schedule.reduce((acc, k) => {
      const due = k.total_due_paise || 0;
      const paid = (k.principal_paid_paise || 0) + (k.markup_paid_paise || 0);
      return acc + Math.max(0, due - paid);
    }, 0);
  }, [schedule]);

  // Record Payment
  const handleRecordPayment = async () => {
    const val = parseInt(paymentAmountInr, 10);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount in Rupees.');
      return;
    }
    try {
      setIsSubmitting(true);
      const effectiveDate = new Date().toISOString().split('T')[0];
      const opId = 'col-' + Date.now() + '-' + Math.random().toString(36).substring(2);
      await transactions!.recordCashPayment(loan!.id, toPaise(val), opId, effectiveDate);
      setPaymentModalVisible(false);
      setPaymentAmountInr('');
      triggerRefresh();
      Alert.alert('Success', `Payment of ₹${val.toLocaleString()} recorded successfully!`);
    } catch (err: any) {
      Alert.alert('Payment Error', err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Extend Modal
  const openExtendModal = () => {
    setExtendMonths(3);
    setExtendInterestCollectedInr(String(Math.round(interestUnpaidPaise / 100)));
    setExtendModalVisible(true);
  };

  // Preview extension math
  const extensionPreview = useMemo(() => {
    if (!loan) return { additionalInterestPaise: 0, newMaturityDate: '', newCumulativeMonths: 0 };
    const annualRate = loan.annual_rate || 0;
    const additionalInterestPaise = calculateContractInterest(loan.principal_paise as Paise, annualRate, extendMonths);
    const startDate = loan.maturity_date || loan.start_date;
    const newMaturityDate = calculateMaturityDate(startDate, extendMonths, loan.due_day);
    const newCumulativeMonths = loan.term_months + extendMonths;
    return { additionalInterestPaise, newMaturityDate, newCumulativeMonths };
  }, [loan, extendMonths]);

  // Confirm Extension
  const handleConfirmExtension = async () => {
    const collectedInr = parseInt(extendInterestCollectedInr || '0', 10);
    if (isNaN(collectedInr) || collectedInr < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid interest collection amount.');
      return;
    }
    try {
      setIsSubmitting(true);
      const opId = 'ext-' + Date.now() + '-' + Math.random().toString(36).substring(2);
      await loans!.extendBulletLoan(loan!.id, extendMonths, toPaise(collectedInr), opId);
      setExtendModalVisible(false);
      triggerRefresh();
      Alert.alert('Loan Extended', `Loan term extended by ${extendMonths} months to ${extensionPreview.newMaturityDate}!`);
    } catch (err: any) {
      Alert.alert('Extension Error', err.message || 'Failed to extend loan');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close Loan
  const handleCloseLoan = () => {
    Alert.alert(
      'Close Loan',
      `Outstanding Principal: ${formatINR(principalOutstandingPaise as Paise)}\nUnpaid Interest: ${formatINR(interestUnpaidPaise as Paise)}\nPenalties: ${formatINR(outstandingPenaltyPaise as Paise)}\n\nTotal Settlement Amount: ${formatINR(totalDueNowPaise as Paise)}\n\nAre you sure you want to close this loan?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Close',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              const opId = 'close-' + Date.now() + '-' + Math.random().toString(36).substring(2);
              await loans!.closeLoan(loan!.id, opId);
              triggerRefresh();
              Alert.alert('Success', 'Loan marked as settled/closed.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to close loan');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // Open Correction Modal
  const openCorrectionModal = (txItem: any) => {
    setTargetTx(txItem);
    setCorrectedAmountInr(String(Math.round((txItem.amount_paise || 0) / 100)));
    setCorrectionReason('Data Entry Error');
    setCustomReason('');
    setCorrectModalVisible(true);
  };

  // Confirm Payment Correction
  const handleConfirmCorrection = async () => {
    if (!targetTx) return;
    const correctedPaise = toPaise(parseInt(correctedAmountInr || '0', 10));
    if (isNaN(correctedPaise) || correctedPaise < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid non-negative corrected amount.');
      return;
    }
    const finalReason = correctionReason === 'Other' ? customReason.trim() : correctionReason;
    if (!finalReason) {
      Alert.alert('Reason Required', 'Please select or provide a mandatory reason for the correction.');
      return;
    }
    try {
      setIsSubmitting(true);
      const opId = 'corr-' + Date.now() + '-' + Math.random().toString(36).substring(2);
      await transactions!.correctPayment(targetTx.id, correctedPaise as Paise, finalReason, opId);
      setCorrectModalVisible(false);
      setTargetTx(null);
      triggerRefresh();
      Alert.alert('Correction Recorded', 'Payment corrected and balances recomputed cleanly.');
    } catch (err: any) {
      Alert.alert('Correction Failed', err.message || 'Failed to correct payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!loan) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom', 'left', 'right']}>
        <Stack.Screen options={{ title: 'Loan Details', headerShown: true }} />
        <Typography>Loading loan details...</Typography>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          title: `${productTitle}`,
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Loan Header Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <View>
              <Typography variant="headlineMd" color={theme.colors.onPrimary}>
                {borrower?.name || 'Borrower'}
              </Typography>
              <Typography variant="bodySm" color={theme.colors.onPrimaryContainer}>
                {borrower?.phone || ''}
              </Typography>
            </View>
            <View style={[styles.statusBadge, loan.status === 'ACTIVE' ? styles.statusActive : styles.statusSettled]}>
              <Typography variant="labelSm" color={loan.status === 'ACTIVE' ? '#fff' : theme.colors.primary}>
                {loan.status}
              </Typography>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroGrid}>
            <View style={styles.heroCol}>
              <Typography variant="bodySm" color={theme.colors.onPrimaryContainer}>Product</Typography>
              <Typography variant="labelMd" color={theme.colors.onPrimary}>{productTitle}</Typography>
            </View>
            <View style={styles.heroCol}>
              <Typography variant="bodySm" color={theme.colors.onPrimaryContainer}>Principal</Typography>
              <Typography variant="labelLg" color={theme.colors.onPrimary}>
                {formatINR(loan.principal_paise as Paise)}
              </Typography>
            </View>
            <View style={styles.heroCol}>
              <Typography variant="bodySm" color={theme.colors.onPrimaryContainer}>Annual Rate</Typography>
              <Typography variant="labelMd" color={theme.colors.onPrimary}>
                {loan.annual_rate || 0}% p.a.
              </Typography>
            </View>
          </View>
        </Card>

        {/* Product-Specific Metrics Section */}
        {isBullet ? (
          /* One-Time Repayment Section */
          <Card elevated style={styles.metricsCard}>
            <Typography variant="titleMd" style={styles.sectionHeader}>
              One-Time Repayment Overview
            </Typography>

            <View style={styles.metricRow}>
              <Typography variant="bodyMd">Principal Outstanding:</Typography>
              <Typography variant="labelLg">{formatINR(principalOutstandingPaise as Paise)}</Typography>
            </View>

            <View style={styles.metricRow}>
              <Typography variant="bodyMd">Contracted Interest:</Typography>
              <Typography variant="bodyMd">{formatINR(totalInterestContractedPaise as Paise)}</Typography>
            </View>

            <View style={styles.metricRow}>
              <Typography variant="bodyMd">Interest Received:</Typography>
              <Typography variant="bodyMd" color={theme.colors.success}>
                {formatINR(interestReceivedPaise as Paise)}
              </Typography>
            </View>

            <View style={styles.metricRow}>
              <Typography variant="bodyMd">Interest Still Unpaid:</Typography>
              <Typography variant="labelMd" color={interestUnpaidPaise > 0 ? theme.colors.error : theme.colors.success}>
                {formatINR(interestUnpaidPaise as Paise)}
              </Typography>
            </View>

            <View style={styles.metricRow}>
              <Typography variant="bodyMd">Cumulative Duration:</Typography>
              <Typography variant="bodyMd">{loan.term_months} Months</Typography>
            </View>

            <View style={styles.metricRow}>
              <Typography variant="bodyMd">Current Maturity Date:</Typography>
              <Typography variant="labelMd">{loan.maturity_date || '-'}</Typography>
            </View>

            {outstandingPenaltyPaise > 0 && (
              <View style={styles.metricRow}>
                <Typography variant="bodyMd" color={theme.colors.error}>Penalties Outstanding:</Typography>
                <Typography variant="labelMd" color={theme.colors.error}>
                  {formatINR(outstandingPenaltyPaise as Paise)}
                </Typography>
              </View>
            )}

            <View style={[styles.metricRow, styles.totalRow]}>
              <Typography variant="headlineSm">Current Total Due:</Typography>
              <Typography variant="headlineSm" color={theme.colors.primary}>
                {formatINR(totalDueNowPaise as Paise)}
              </Typography>
            </View>

            {/* Action Buttons for One-Time Repayment */}
            {loan.status === 'ACTIVE' && (
              <View style={styles.actionButtonsRow}>
                <Button
                  title="Extend Loan"
                  variant="outline"
                  onPress={openExtendModal}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Record Payment"
                  onPress={() => {
                    setPaymentAmountInr(String(Math.round(totalDueNowPaise / 100)));
                    setPaymentModalVisible(true);
                  }}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Close Loan"
                  variant="secondary"
                  onPress={handleCloseLoan}
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </Card>
        ) : (
          /* Monthly Kist Section */
          <Card elevated style={styles.metricsCard}>
            <Typography variant="titleMd" style={styles.sectionHeader}>
              Monthly Kist Summary
            </Typography>

            <View style={styles.metricRow}>
              <Typography variant="bodyMd">Monthly Installment (Kist):</Typography>
              <Typography variant="labelLg" color={theme.colors.primary}>
                {formatINR(kistAmountPaise as Paise)}
              </Typography>
            </View>

            <View style={styles.metricRow}>
              <Typography variant="bodyMd">Installments Status:</Typography>
              <Typography variant="labelMd">
                {installmentsPaid} Paid • {installmentsPending} Pending
              </Typography>
            </View>

            <View style={styles.metricRow}>
              <Typography variant="bodyMd">Next Due Date:</Typography>
              <Typography variant="labelMd">{nextDueDate}</Typography>
            </View>

            <View style={styles.metricRow}>
              <Typography variant="bodyMd">Remaining Receivables:</Typography>
              <Typography variant="labelMd">{formatINR(remainingContractualReceivablesPaise as Paise)}</Typography>
            </View>

            {outstandingPenaltyPaise > 0 && (
              <View style={styles.metricRow}>
                <Typography variant="bodyMd" color={theme.colors.error}>Penalties Outstanding:</Typography>
                <Typography variant="labelMd" color={theme.colors.error}>
                  {formatINR(outstandingPenaltyPaise as Paise)}
                </Typography>
              </View>
            )}

            {/* Record Payment Button for Monthly Kist */}
            {loan.status === 'ACTIVE' && (
              <Button
                title="Record Payment"
                onPress={() => {
                  setPaymentAmountInr(String(Math.round(kistAmountPaise / 100)));
                  setPaymentModalVisible(true);
                }}
                style={{ marginTop: theme.spacing.md }}
              />
            )}
          </Card>
        )}

        {/* Historical Terms Timeline for One-Time Repayment */}
        {isBullet && terms.length > 0 && (
          <View style={styles.sectionContainer}>
            <Typography variant="headlineSm" style={styles.sectionTitle}>
              Historical Term Timeline ({terms.length} {terms.length === 1 ? 'Term' : 'Terms'})
            </Typography>
            {terms.map((t, idx) => (
              <Card key={t.id} style={styles.termCard}>
                <View style={styles.termHeader}>
                  <Typography variant="labelLg">Term #{t.term_number}</Typography>
                  <View style={[styles.termBadge, t.interest_settled ? styles.badgeSuccess : styles.badgePending]}>
                    <Typography variant="labelSm" color={t.interest_settled ? theme.colors.success : theme.colors.warning}>
                      {t.interest_settled ? 'INTEREST SETTLED' : 'INTEREST PENDING'}
                    </Typography>
                  </View>
                </View>
                <View style={styles.metricRow}>
                  <Typography variant="bodySm">Duration:</Typography>
                  <Typography variant="bodySm">{t.duration_months} Months (@ {t.annual_rate}% p.a.)</Typography>
                </View>
                <View style={styles.metricRow}>
                  <Typography variant="bodySm">Term Interest:</Typography>
                  <Typography variant="labelMd">{formatINR(t.interest_paise as Paise)}</Typography>
                </View>
                <View style={styles.metricRow}>
                  <Typography variant="bodySm">Period:</Typography>
                  <Typography variant="bodySm">{t.start_date} → {t.maturity_date}</Typography>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Repayment Schedule for Monthly Kist */}
        {!isBullet && schedule.length > 0 && (
          <View style={styles.sectionContainer}>
            <Typography variant="headlineSm" style={styles.sectionTitle}>
              Repayment Schedule ({schedule.length} Installments)
            </Typography>
            {schedule.map((kist) => {
              const paid = (kist.principal_paid_paise || 0) + (kist.markup_paid_paise || 0);
              const isPaid = kist.status === 'PAID';
              return (
                <Card key={kist.id} style={styles.kistCard}>
                  <View style={styles.kistHeader}>
                    <Typography variant="labelLg">Kist #{kist.installment_number}</Typography>
                    <Typography
                      variant="labelMd"
                      color={isPaid ? theme.colors.success : theme.colors.warning}
                    >
                      {kist.status}
                    </Typography>
                  </View>
                  <View style={styles.kistRow}>
                    <Typography variant="bodySm" color={theme.colors.textSecondary}>Due Date:</Typography>
                    <Typography variant="bodySm">{kist.effective_due_date}</Typography>
                  </View>
                  <View style={styles.kistRow}>
                    <Typography variant="bodySm" color={theme.colors.textSecondary}>Amount Due:</Typography>
                    <Typography variant="labelMd">{formatINR(kist.total_due_paise as Paise)}</Typography>
                  </View>
                  <View style={styles.kistRow}>
                    <Typography variant="bodySm" color={theme.colors.textSecondary}>Amount Paid:</Typography>
                    <Typography variant="bodySm">{formatINR(paid as Paise)}</Typography>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Security Documents & Collateral */}
        {(loan.collateral || attachments.length > 0) && (
          <View style={styles.sectionContainer}>
            <Typography variant="headlineSm" style={styles.sectionTitle}>
              Security & Documents
            </Typography>
            <Card style={styles.collateralCard}>
              {loan.collateral ? (
                <View style={{ marginBottom: 8 }}>
                  <Typography variant="labelMd" color={theme.colors.textSecondary}>Collateral Notes</Typography>
                  <Typography variant="bodyMd" style={{ marginTop: 2 }}>{loan.collateral}</Typography>
                </View>
              ) : null}

              {attachments.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Typography variant="labelMd" color={theme.colors.textSecondary}>
                    Attached Documents ({attachments.length})
                  </Typography>
                  {attachments.map((att, i) => (
                    <View key={att.id || i} style={styles.attachmentRow}>
                      <Typography variant="bodyMd">📄 {att.doc_type}</Typography>
                      {att.notes ? (
                        <Typography variant="bodySm" color={theme.colors.textSecondary}>{att.notes}</Typography>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </View>
        )}

        {/* Payment History & Correction */}
        <View style={styles.sectionContainer}>
          <Typography variant="headlineSm" style={styles.sectionTitle}>
            Payment History & Ledger
          </Typography>
          {history.length === 0 ? (
            <Card style={{ padding: 16 }}>
              <Typography variant="bodyMd" color={theme.colors.textSecondary}>
                No transactions recorded yet.
              </Typography>
            </Card>
          ) : (
            history.map((txItem) => {
              const isCollection = txItem.transaction_type === 'COLLECTION';
              const isReversal = txItem.transaction_type === 'REVERSAL';
              const isCorrectionReplacement = isCollection && Boolean(txItem.reversal_of_id);
              const hasBeenReversed = isCollection && history.some(r => r.transaction_type === 'REVERSAL' && r.reversal_of_id === txItem.id);

              return (
                <Card key={txItem.id} style={[styles.txCard, isReversal && styles.txReversalCard]}>
                  <View style={styles.txHeader}>
                    <View style={{ flex: 1 }}>
                      <Typography variant="labelLg">
                        {isReversal ? 'REVERSAL' : isCorrectionReplacement ? 'REPLACEMENT COLLECTION' : txItem.transaction_type}
                      </Typography>
                      <Typography variant="bodySm" color={theme.colors.textSecondary}>
                        Date: {txItem.effective_date}
                      </Typography>
                    </View>
                    <Typography
                      variant="headlineSm"
                      color={isReversal ? theme.colors.error : theme.colors.success}
                    >
                      {isReversal ? '₹0' : formatINR(txItem.amount_paise as Paise)}
                    </Typography>
                  </View>

                  <View style={styles.txDetailsRow}>
                    <Typography variant="bodySm">
                      Prin: {formatINR(txItem.allocated_principal_paise as Paise)} • Mkp: {formatINR(txItem.allocated_markup_paise as Paise)}
                      {txItem.allocated_penalty_paise ? ` • Pen: ${formatINR(txItem.allocated_penalty_paise as Paise)}` : ''}
                    </Typography>
                  </View>

                  {txItem.correction_reason ? (
                    <Typography variant="bodySm" color={theme.colors.warning} style={{ marginTop: 4 }}>
                      Reason: {txItem.correction_reason}
                    </Typography>
                  ) : null}

                  {/* Correct Payment Button: only active collections that have not been reversed */}
                  {isCollection && !hasBeenReversed && loan.status !== 'WRITTEN_OFF' && (
                    <View style={{ marginTop: 10, alignItems: 'flex-end' }}>
                      <TouchableOpacity
                        style={styles.correctPaymentBtn}
                        onPress={() => openCorrectionModal(txItem)}
                      >
                        <Typography variant="labelSm" color={theme.colors.primary}>
                          Correct Payment
                        </Typography>
                      </TouchableOpacity>
                    </View>
                  )}
                  {hasBeenReversed && (
                    <View style={{ marginTop: 6 }}>
                      <Typography variant="labelSm" color={theme.colors.error}>
                        [CORRECTED / REVERSED]
                      </Typography>
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Record Payment Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
            <Typography variant="headlineSm" style={{ marginBottom: 12 }}>
              Record Payment Collection
            </Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginBottom: 16 }}>
              Borrower: {borrower?.name} • {productTitle}
            </Typography>

            <TextInput
              style={styles.modalInput}
              placeholder="Amount Received (₹)"
              keyboardType="numeric"
              value={paymentAmountInr}
              onChangeText={setPaymentAmountInr}
            />

            <View style={styles.modalButtonsRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setPaymentModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
                disabled={isSubmitting}
              />
              <Button
                title={isSubmitting ? 'Recording...' : 'Confirm Payment'}
                onPress={handleRecordPayment}
                style={{ flex: 1 }}
                disabled={isSubmitting}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Extend Loan Modal */}
      <Modal visible={extendModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
            <Typography variant="headlineSm" style={{ marginBottom: 8 }}>
              Extend One-Time Repayment Loan
            </Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginBottom: 16 }}>
              Current Term Unpaid Interest: {formatINR(interestUnpaidPaise as Paise)}
            </Typography>

            <Typography variant="labelMd" style={{ marginBottom: 4 }}>
              Interest Collected Now (₹):
            </Typography>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder="e.g. 750"
              value={extendInterestCollectedInr}
              onChangeText={setExtendInterestCollectedInr}
            />

            <Typography variant="labelMd" style={{ marginTop: 8, marginBottom: 8 }}>
              Select Additional Duration:
            </Typography>
            <View style={styles.durationsRow}>
              {[1, 2, 3, 6, 9, 12, 18, 24].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.durationChip, extendMonths === m && styles.durationChipActive]}
                  onPress={() => setExtendMonths(m)}
                >
                  <Typography
                    variant="labelSm"
                    color={extendMonths === m ? '#fff' : theme.colors.primary}
                  >
                    {m}m
                  </Typography>
                </TouchableOpacity>
              ))}
            </View>

            <Card style={styles.previewBox}>
              <Typography variant="labelMd" color={theme.colors.primary}>
                Extension Preview:
              </Typography>
              <Typography variant="bodySm">
                Additional Interest: {formatINR(extensionPreview.additionalInterestPaise as Paise)}
              </Typography>
              <Typography variant="bodySm">
                New Maturity Date: {extensionPreview.newMaturityDate}
              </Typography>
              <Typography variant="bodySm">
                Total Cumulative Duration: {extensionPreview.newCumulativeMonths} Months
              </Typography>
            </Card>

            <View style={[styles.modalButtonsRow, { marginTop: 16 }]}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setExtendModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
                disabled={isSubmitting}
              />
              <Button
                title={isSubmitting ? 'Extending...' : 'Confirm Extension'}
                onPress={handleConfirmExtension}
                style={{ flex: 1 }}
                disabled={isSubmitting}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Correct Payment Modal */}
      <Modal visible={correctModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
            <Typography variant="headlineSm" style={{ marginBottom: 8 }}>
              Correct Payment Entry
            </Typography>
            {targetTx && (
              <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginBottom: 12 }}>
                Originally Recorded: {formatINR(targetTx.amount_paise as Paise)} on {targetTx.effective_date}
              </Typography>
            )}

            <Typography variant="labelMd" style={{ marginBottom: 4 }}>
              Actual Received Amount (₹):
            </Typography>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder="e.g. 2500"
              value={correctedAmountInr}
              onChangeText={setCorrectedAmountInr}
            />

            <Typography variant="labelMd" style={{ marginTop: 8, marginBottom: 8 }}>
              Mandatory Correction Reason:
            </Typography>
            <View style={styles.reasonsList}>
              {['Data Entry Error', 'Partial Receipt', 'Cheque Bounce', 'Other'].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonChip, correctionReason === r && styles.reasonChipActive]}
                  onPress={() => setCorrectionReason(r)}
                >
                  <Typography variant="labelSm" color={correctionReason === r ? '#fff' : theme.colors.primary}>
                    {r}
                  </Typography>
                </TouchableOpacity>
              ))}
            </View>

            {correctionReason === 'Other' && (
              <TextInput
                style={[styles.modalInput, { marginTop: 8 }]}
                placeholder="Enter specific reason..."
                value={customReason}
                onChangeText={setCustomReason}
              />
            )}

            <Card style={styles.previewBox}>
              <Typography variant="labelMd" color={theme.colors.error}>
                Audit Impact:
              </Typography>
              <Typography variant="bodySm">
                • Original transaction will be marked as reversed.
              </Typography>
              <Typography variant="bodySm">
                • New effective amount: ₹{correctedAmountInr || 0}
              </Typography>
              <Typography variant="bodySm">
                • All loan balances and schedules will recompute cleanly.
              </Typography>
            </Card>

            <View style={[styles.modalButtonsRow, { marginTop: 16 }]}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setCorrectModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
                disabled={isSubmitting}
              />
              <Button
                title={isSubmitting ? 'Correcting...' : 'Confirm Correction'}
                variant="primary"
                onPress={handleConfirmCorrection}
                style={{ flex: 1 }}
                disabled={isSubmitting}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: theme.spacing.md, paddingBottom: 60 },
  heroCard: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: 16,
    marginBottom: theme.spacing.md,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroDivider: {
    height: 1,
    backgroundColor: theme.colors.primaryContainer,
    marginVertical: 12,
  },
  heroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCol: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: theme.colors.secondary,
  },
  statusSettled: {
    backgroundColor: theme.colors.surfaceTint,
  },
  metricsCard: {
    padding: theme.spacing.lg,
    borderRadius: 16,
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
    paddingBottom: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outlineVariant,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
  },
  sectionContainer: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
  },
  termCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: 10,
  },
  termHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  termBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeSuccess: {
    backgroundColor: theme.colors.successContainer,
  },
  badgePending: {
    backgroundColor: theme.colors.warningContainer,
  },
  kistCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: 10,
  },
  kistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  kistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  collateralCard: {
    padding: theme.spacing.md,
    borderRadius: 10,
  },
  attachmentRow: {
    paddingVertical: 4,
  },
  txCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: 10,
  },
  txReversalCard: {
    backgroundColor: theme.colors.surfaceContainerHigh,
    borderColor: theme.colors.outlineVariant,
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  txDetailsRow: {
    marginTop: 4,
  },
  correctPaymentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: theme.spacing.lg,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
  },
  durationsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 6,
  },
  durationChipActive: {
    backgroundColor: theme.colors.primary,
  },
  reasonsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: 6,
  },
  reasonChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  previewBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: theme.colors.surfaceContainerLow,
    borderRadius: 8,
  },
});
