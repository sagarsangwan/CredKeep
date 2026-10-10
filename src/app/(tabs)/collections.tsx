import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Alert, ScrollView, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as crypto from 'expo-crypto';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { Borrower } from '../../core/database/borrowerRepository';
import { Paise, formatINR } from '../../core/domain/money';

export default function CollectionsScreen() {
  const { loans, transactions, borrowers, refreshVersion, triggerRefresh } = useDatabase();
  const [loansList, setLoansList] = useState<Loan[]>([]);
  const [borrowersList, setBorrowersList] = useState<Borrower[]>([]);
  
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [amountInr, setAmountInr] = useState('');
  const [result, setResult] = useState<any>(null);

  const [previewPenalty, setPreviewPenalty] = useState<number>(0);
  const [outstandingPenalty, setOutstandingPenalty] = useState<number>(0);

  const loadData = useCallback(async () => {
    if (loans && borrowers) {
      setLoansList(await loans.getAll());
      setBorrowersList(await borrowers.getAll());
    }
  }, [loans, borrowers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData, refreshVersion]);

  useEffect(() => {
    async function fetchPenalty() {
      if (selectedLoanId && transactions) {
        const currentDate = new Date().toISOString().split('T')[0];
        const newPen = await transactions.previewPenalties(selectedLoanId, currentDate);
        setPreviewPenalty(newPen);
        
        const summary = await transactions.getEarningsSummary({ loanId: selectedLoanId });
        setOutstandingPenalty(summary.outstandingPenalty);
      }
    }
    fetchPenalty();
  }, [selectedLoanId, transactions, refreshVersion]);

  const activeLoans = useMemo(() => loansList.filter(l => l.status === 'ACTIVE'), [loansList]);

  const getBorrowerName = (id: string) => {
    return borrowersList.find(b => b.id === id)?.name || 'Unknown Borrower';
  };

  const handlePayment = async () => {
    if (!selectedLoanId || !amountInr) {
      Alert.alert('Error', 'Please enter an amount');
      return;
    }
    
    try {
      const amountPaise = (parseInt(amountInr) * 100) as Paise;
      const effectiveDate = new Date().toISOString().split('T')[0];
      const operationId = crypto.randomUUID();
      
      const res = await transactions!.recordCashPayment(
        selectedLoanId,
        amountPaise,
        operationId,
        effectiveDate
      );
      
      setResult(res);
      setAmountInr('');
      Alert.alert('Success', 'Payment recorded successfully!');
      triggerRefresh();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (!selectedLoanId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Typography variant="headlineMd" color={theme.colors.onPrimary}>Select Loan for Collection</Typography>
        </View>
        <FlatList
          data={activeLoans}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setSelectedLoanId(item.id)}>
              <Card elevated style={styles.loanCard}>
                <Typography variant="headlineSm">{getBorrowerName(item.borrower_id)}</Typography>
                <Typography variant="bodyMd">Principal: {formatINR(item.principal_paise as Paise)}</Typography>
                <Typography variant="bodySm" color={theme.colors.textSecondary}>Loan ID: {item.id.substring(0, 8)}</Typography>
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Typography variant="bodyLg" color={theme.colors.textSecondary}>No active loans found</Typography>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  const selectedLoan = loansList.find(l => l.id === selectedLoanId);
  const totalPenalty = previewPenalty + outstandingPenalty;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => { setSelectedLoanId(null); setResult(null); }}>
          <Typography color={theme.colors.primary}>← Back</Typography>
        </TouchableOpacity>
      </View>
      
      <Typography variant="headlineMd" style={styles.title}>Record Collection</Typography>
      
      {selectedLoan && (
        <Card style={styles.selectedLoanCard}>
          <Typography variant="labelLg">Borrower</Typography>
          <Typography variant="headlineSm">{getBorrowerName(selectedLoan.borrower_id)}</Typography>
          <Typography variant="bodyMd" style={{marginTop: 8}}>Principal: {formatINR(selectedLoan.principal_paise as Paise)}</Typography>
          
          <View style={{marginTop: 12, padding: 8, backgroundColor: theme.colors.errorContainer, borderRadius: 8}}>
            <Typography variant="labelMd" color={theme.colors.error}>Penalty Preview</Typography>
            <Typography variant="bodySm" color={theme.colors.error}>
              Outstanding: {formatINR(outstandingPenalty as Paise)}
            </Typography>
            <Typography variant="bodySm" color={theme.colors.error}>
              New (Unassessed): {formatINR(previewPenalty as Paise)}
            </Typography>
            <Typography variant="labelLg" color={theme.colors.error} style={{marginTop: 4}}>
              Total Penalty Due: {formatINR(totalPenalty as Paise)}
            </Typography>
          </View>
        </Card>
      )}

      <Card elevated style={styles.card}>
        <Input
          label="Amount Received (INR)"
          keyboardType="numeric"
          placeholder="e.g. 2600"
          value={amountInr}
          onChangeText={setAmountInr}
        />

        <Button title="Record Payment" onPress={handlePayment} style={styles.button} />
      </Card>

      {result && (
        <Card style={styles.resultCard}>
          <Typography variant="headlineSm">Payment Allocated</Typography>
          <Typography variant="bodySm">Transaction ID: {result.transactionId.substring(0,8)}</Typography>
          <Typography variant="bodySm">Unallocated: {formatINR((result.result?.unallocatedFunds || 0) as Paise)}</Typography>
          <Typography variant="bodySm" color={theme.colors.error}>
             Remaining Penalty: {formatINR((result.result?.remainingPenalty || 0) as Paise)}
          </Typography>
          {result.result?.allocations?.map((a: any, i: number) => (
            <Typography key={i} variant="bodySm" color={theme.colors.success}>
              {a.allocatedToKist > 0 
                ? `Kist #${a.allocatedToKist}: ${formatINR((a.allocatedToPrincipal + a.allocatedToMarkup) as Paise)}`
                : `Penalty: ${formatINR(a.allocatedToPenalty as Paise)}`
              }
            </Typography>
          ))}
        </Card>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.lg, backgroundColor: theme.colors.primary, paddingTop: 16 },
  listContent: { padding: theme.spacing.md, gap: theme.spacing.md },
  content: { padding: theme.spacing.lg },
  row: { flexDirection: 'row', marginBottom: theme.spacing.md },
  title: { marginBottom: theme.spacing.lg },
  card: { padding: theme.spacing.lg, marginBottom: theme.spacing.lg },
  loanCard: { marginBottom: theme.spacing.sm },
  selectedLoanCard: { backgroundColor: theme.colors.surfaceTint, padding: theme.spacing.md, marginBottom: theme.spacing.lg },
  empty: { padding: theme.spacing.xl, alignItems: 'center' },
  button: { marginTop: theme.spacing.md },
  resultCard: { backgroundColor: theme.colors.successContainer, borderColor: theme.colors.success, marginTop: theme.spacing.md }
});
