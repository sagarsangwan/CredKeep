import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { formatINR } from '../../core/domain/money';

export default function LoanDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { loans, transactions } = useDatabase();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);

  useEffect(() => {
    async function load() {
      if (loans && typeof id === 'string') {
        const l = await loans.getById(id);
        setLoan(l);
        if (l) {
          const s = await loans.getSchedule(id);
          setSchedule(s);
          if (transactions) {
            const summary = await transactions.getEarningsSummary({ loanId: l.id });
            setEarnings(summary);
          }
        }
      }
    }
    load();
  }, [id, loans, transactions]);

  if (!loan) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom', 'left', 'right']}>
        <Stack.Screen options={{ title: 'Loan Details', headerShown: true }} />
        <Typography>Loading...</Typography>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}>
        <Stack.Screen options={{ title: 'Loan Details', headerShown: true }} />
        
        <Card style={styles.headerCard}>
        <Typography variant="headlineMd">Principal: {loan.principal_paise / 100} INR</Typography>
        <Typography variant="bodyLg">Status: {loan.status}</Typography>
        <Typography variant="bodyMd" color={theme.colors.textSecondary}>
          Created: {new Date(loan.created_at).toLocaleDateString()}
        </Typography>
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

      <Typography variant="headlineSm" style={styles.sectionTitle}>Repayment Schedule</Typography>
      
      {schedule.map((kist) => (
        <Card key={kist.id} style={styles.kistCard}>
          <View style={styles.kistHeader}>
            <Typography variant="labelLg">Kist {kist.installment_number}</Typography>
            <Typography variant="labelLg" color={kist.status === 'PAID' ? theme.colors.success : theme.colors.warning}>
              {kist.status}
            </Typography>
          </View>
          
          <View style={styles.kistRow}>
            <Typography variant="bodyMd">Due Date:</Typography>
            <Typography variant="bodyMd">{kist.effective_due_date}</Typography>
          </View>
          
          <View style={styles.kistRow}>
            <Typography variant="bodyMd">Total Due:</Typography>
            <Typography variant="bodyMd">{kist.total_due_paise / 100} INR</Typography>
          </View>
          
          <View style={styles.kistRow}>
            <Typography variant="bodyMd">Paid:</Typography>
            <Typography variant="bodyMd">{(kist.principal_paid_paise + kist.markup_paid_paise) / 100} INR</Typography>
          </View>
        </Card>
      ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    marginBottom: theme.spacing.xl,
    backgroundColor: theme.colors.primaryContainer,
  },
  earningsCard: {
    marginBottom: theme.spacing.xl,
    backgroundColor: theme.colors.surfaceTint,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
  },
  kistCard: {
    marginBottom: theme.spacing.sm,
  },
  kistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    paddingBottom: theme.spacing.xs,
  },
  kistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  }
});
