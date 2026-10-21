import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan, LoanTerm, LoanAttachment } from '../../core/database/loanRepository';
import { Borrower } from '../../core/database/borrowerRepository';
import { Paise, toPaise, formatINR } from '../../core/domain/money';
import { MonthlyKistView } from './components/MonthlyKistView';
import { OneTimeLoanView } from './components/OneTimeLoanView';

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

  // Payment correction modal state
  const [correctModalVisible, setCorrectModalVisible] = useState(false);
  const [targetTx, setTargetTx] = useState<any | null>(null);
  const [correctedAmountInr, setCorrectedAmountInr] = useState('');
  const [correctionReason, setCorrectionReason] = useState('Data Entry Error');
  const [isCorrecting, setIsCorrecting] = useState(false);

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
  }, [id, loans, borrowers, transactions, refreshVersion]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (!loan) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <Stack.Screen options={{ title: 'Loan Details', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <Typography variant="bodyMd" color={theme.colors.textSecondary}>Loading contract details...</Typography>
        </View>
      </SafeAreaView>
    );
  }

  const handleRecordPayment = () => {
    router.push({
      pathname: '/collections',
      params: { borrowerId: loan.borrower_id, loanId: loan.id },
    } as any);
  };

  const handleExtendLoan = async (months: number, interestCollectedPaise: Paise) => {
    if (!loans) return;
    await loans.extendBulletLoan(loan.id, months, interestCollectedPaise);
    triggerRefresh();
    await loadData();
  };

  const handleOpenCorrect = (tx: any) => {
    setTargetTx(tx);
    setCorrectedAmountInr((tx.amount_paise / 100).toString());
    setCorrectModalVisible(true);
  };

  const handleConfirmCorrect = async () => {
    if (!targetTx || !transactions) return;
    const newPaise = toPaise(parseFloat(correctedAmountInr) || 0);
    if (newPaise <= 0) {
      Alert.alert('Invalid Amount', 'Corrected amount must be greater than zero.');
      return;
    }

    try {
      setIsCorrecting(true);
      await transactions.correctPayment(
        targetTx.id,
        newPaise,
        correctionReason
      );
      setCorrectModalVisible(false);
      triggerRefresh();
      await loadData();
      Alert.alert('Payment Corrected', 'Transaction safely reversed and re-allocated in append-only ledger.');
    } catch (e: any) {
      Alert.alert('Correction Error', e.message || 'Failed to correct payment');
    } finally {
      setIsCorrecting(false);
    }
  };

  const productTitle = loan.product_type === 'bullet' ? 'Bullet Loan' : 'Monthly Kist';

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          title: `${productTitle} • ${borrower?.name || ''}`,
          headerShown: true,
          headerTintColor: theme.colors.textPrimary,
          headerStyle: { backgroundColor: theme.colors.background },
        }}
      />

      {loan.product_type === 'bullet' ? (
        <OneTimeLoanView
          loan={loan}
          borrower={borrower}
          terms={terms}
          earnings={earnings}
          history={history}
          attachments={attachments}
          previewPenalty={previewPenalty}
          onRecordPayment={handleRecordPayment}
          onExtendLoan={handleExtendLoan}
          onCorrectPayment={handleOpenCorrect}
        />
      ) : (
        <MonthlyKistView
          loan={loan}
          borrower={borrower}
          schedule={schedule}
          earnings={earnings}
          history={history}
          attachments={attachments}
          onRecordPayment={handleRecordPayment}
          onCorrectPayment={handleOpenCorrect}
        />
      )}

      {/* Payment Correction Modal */}
      <Modal
        visible={correctModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCorrectModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCorrectModalVisible(false)}>
                <Typography variant="bodyMd" color={theme.colors.textSecondary}>
                  Cancel
                </Typography>
              </TouchableOpacity>
              <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                Payment Correction
              </Typography>
              <View style={{ width: 44 }} />
            </View>

            <View style={{ padding: theme.spacing.lg }}>
              <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700', marginBottom: 6 }}>
                Append-Only Correction
              </Typography>
              <Typography variant="bodyMd" color={theme.colors.textSecondary} style={{ marginBottom: 20 }}>
                This will append a reversal transaction for the original amount ({targetTx ? formatINR(targetTx.amount_paise) : ''}) and post a corrected payment with recalculated waterfall allocations.
              </Typography>

              <Input
                label="Corrected Amount (₹) *"
                placeholder="Enter exact amount"
                value={correctedAmountInr}
                onChangeText={setCorrectedAmountInr}
                keyboardType="numeric"
              />

              <Input
                label="Audit Reason *"
                placeholder="e.g. Data entry error, miscalculated cash"
                value={correctionReason}
                onChangeText={setCorrectionReason}
              />

              <View style={{ marginTop: 24 }}>
                <Button
                  title="Confirm & Append Correction"
                  onPress={handleConfirmCorrect}
                  loading={isCorrecting}
                  variant="primary"
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
});
