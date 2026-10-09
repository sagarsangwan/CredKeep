import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../../ui/Typography';
import { Card } from '../../../ui/Card';
import { theme } from '../../../ui/theme';
import { useDatabase } from '../../../core/database/DatabaseProvider';
import { Loan } from '../../../core/database/loanRepository';
import { formatINR, Paise } from '../../../core/domain/money';

export default function LoanDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { loans, transactions, refreshVersion } = useDatabase();
  
  const [loan, setLoan] = useState<Loan | null>(null);
  const [earnings, setEarnings] = useState<any>(null);

  useEffect(() => {
    async function load() {
      if (loans && transactions && id) {
        const lns = await loans.getAll();
        const l = lns.find(x => x.id === id);
        if (l) {
          setLoan(l);
          const summary = await transactions.getEarningsSummary({ loanId: l.id });
          setEarnings(summary);
        }
      }
    }
    load();
  }, [id, loans, transactions, refreshVersion]);

  if (!loan) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Typography variant="headlineMd" color={theme.colors.onPrimary}>Loan Details</Typography>
        </View>
        
        <Card elevated style={styles.card}>
          <Typography variant="labelLg">Principal</Typography>
          <Typography variant="headlineMd" color={theme.colors.primary}>{formatINR(loan.principal_paise as Paise)}</Typography>
          <Typography variant="bodyMd">Status: {loan.status}</Typography>
        </Card>

        {earnings && (
          <Card style={styles.earningsCard}>
            <Typography variant="titleMd" style={{marginBottom: 10}}>Earnings & Collection Summary</Typography>
            <View style={styles.row}>
              <Typography variant="bodyMd">Principal Returned:</Typography>
              <Typography variant="bodyMd">{formatINR(earnings.principalReturned)}</Typography>
            </View>
            <View style={styles.row}>
              <Typography variant="bodyMd">Markup Received:</Typography>
              <Typography variant="bodyMd">{formatINR(earnings.markupReceived)}</Typography>
            </View>
            <View style={styles.row}>
              <Typography variant="bodyMd">Penalty Received:</Typography>
              <Typography variant="bodyMd">{formatINR(earnings.penaltyReceived)}</Typography>
            </View>
            <View style={[styles.row, {marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: theme.colors.outlineVariant}]}>
              <Typography variant="labelLg">Total Actual Earnings:</Typography>
              <Typography variant="labelLg" color={theme.colors.success}>{formatINR(earnings.totalEarnings)}</Typography>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1 },
  header: { padding: theme.spacing.lg, backgroundColor: theme.colors.primary, paddingTop: 40 },
  content: { padding: theme.spacing.lg },
  card: { padding: theme.spacing.lg, marginBottom: theme.spacing.xl },
  earningsCard: { padding: theme.spacing.md, backgroundColor: theme.colors.surfaceTint },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }
});
