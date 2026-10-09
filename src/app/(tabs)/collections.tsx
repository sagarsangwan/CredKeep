import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import * as crypto from 'expo-crypto';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { Paise } from '../../core/domain/money';

export default function CollectionsScreen() {
  const { loans, transactions } = useDatabase();
  const [loansList, setLoansList] = useState<Loan[]>([]);
  
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [amountInr, setAmountInr] = useState('');
  const [result, setResult] = useState<any>(null);

  const loadData = async () => {
    if (loans) {
      setLoansList(await loans.getAll());
    }
  };

  useEffect(() => {
    loadData();
  }, [loans]);

  const handlePayment = async () => {
    if (!selectedLoanId || !amountInr) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    try {
      const amountPaise = parseInt(amountInr) * 100 as Paise;
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
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Typography variant="headlineMd" style={styles.title}>Record Collection</Typography>
      
      <Card elevated style={styles.card}>
        <Typography variant="labelLg" style={styles.label}>Select Loan (Copy ID)</Typography>
        <Input
          label="Loan ID"
          placeholder="UUID"
          value={selectedLoanId}
          onChangeText={setSelectedLoanId}
        />
        <View style={styles.hints}>
          {loansList.slice(0, 5).map(l => (
            <Typography key={l.id} variant="bodySm" color={theme.colors.textSecondary}>
              {l.id} - {(l.principal_paise / 100)} INR
            </Typography>
          ))}
        </View>

        <Input
          label="Amount (INR)"
          keyboardType="numeric"
          placeholder="e.g. 500"
          value={amountInr}
          onChangeText={setAmountInr}
        />

        <Button title="Record Payment" onPress={handlePayment} style={styles.button} />
      </Card>

      {result && (
        <Card style={styles.resultCard}>
          <Typography variant="headlineSm">Last Allocation Result</Typography>
          <Typography variant="bodySm">
            Transaction ID: {result.transactionId}
          </Typography>
          <Typography variant="bodySm">
            Unallocated: {(result.result?.unallocatedFunds || 0) / 100} INR
          </Typography>
          {result.result?.allocations?.map((a: any, i: number) => (
            <Typography key={i} variant="bodySm" color={theme.colors.secondary}>
              Kist {a.kistNumber}: {(a.allocatedToPrincipal + a.allocatedToMarkup) / 100} INR
            </Typography>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
  },
  title: {
    marginBottom: theme.spacing.lg,
  },
  card: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  label: {
    marginBottom: theme.spacing.xs,
  },
  hints: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: theme.borderRadius.sm,
  },
  button: {
    marginTop: theme.spacing.md,
  },
  resultCard: {
    backgroundColor: theme.colors.successContainer,
    borderColor: theme.colors.success,
  }
});
