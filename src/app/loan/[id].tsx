import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';

export default function LoanDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { loans } = useDatabase();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [schedule, setSchedule] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (loans && typeof id === 'string') {
        const l = await loans.getById(id);
        setLoan(l);
        if (l) {
          const s = await loans.getSchedule(id);
          setSchedule(s);
        }
      }
    }
    load();
  }, [id, loans]);

  if (!loan) {
    return (
      <View style={styles.center}>
        <Typography>Loading...</Typography>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: 'Loan Details' }} />
      
      <Card style={styles.headerCard}>
        <Typography variant="headlineMd">Principal: {loan.principal_paise / 100} INR</Typography>
        <Typography variant="bodyLg">Status: {loan.status}</Typography>
        <Typography variant="bodyMd" color={theme.colors.textSecondary}>
          Created: {new Date(loan.created_at).toLocaleDateString()}
        </Typography>
      </Card>

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
