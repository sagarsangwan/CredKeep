import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { formatINR, Paise } from '../../core/domain/money';

export default function HomeScreen() {
  const { error, loans } = useDatabase();
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [totalOut, setTotalOut] = useState<Paise>(0 as Paise);

  const loadDashboard = useCallback(async () => {
    if (loans) {
      const allLoans = await loans.getAll();
      const active = allLoans.filter(l => l.status === 'ACTIVE');
      setActiveLoans(active);
      
      const total = active.reduce((sum, l) => sum + l.principal_paise, 0) as Paise;
      setTotalOut(total);
    }
  }, [loans]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
  }, [loadDashboard]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Typography variant="bodyLg" color={theme.colors.onPrimary}>Bharat Ledger</Typography>
        <View style={styles.badge}>
          <Typography variant="labelSm" color={theme.colors.textSecondary}>Saved on Phone</Typography>
        </View>
      </View>

      <Card style={styles.heroCard}>
        <Typography variant="bodyMd" color={theme.colors.onPrimary} style={{opacity: 0.8}}>Total Out (Given)</Typography>
        <Typography variant="rupeeDisplay" color={theme.colors.onPrimary} style={{marginTop: 4, marginBottom: 16}}>
          {formatINR(totalOut)}
        </Typography>
        
        <Typography variant="bodyMd" color={theme.colors.onPrimary} style={{opacity: 0.8}}>Total Collected</Typography>
        <Typography variant="headlineMd" color={theme.colors.onPrimary} style={{marginTop: 4}}>
          {formatINR(0 as Paise)} {/* Pending Transactions Aggregate */}
        </Typography>
      </Card>

      {error && (
        <Card style={styles.errorCard}>
          <Typography variant="headlineSm" color={theme.colors.error}>Database Error</Typography>
          <Typography variant="bodyMd" color={theme.colors.error}>{error.message}</Typography>
        </Card>
      )}

      <Typography variant="headlineSm" style={{marginTop: theme.spacing.xl, marginBottom: theme.spacing.md}}>Quick Actions</Typography>
      
      <View style={styles.grid}>
        <Card style={styles.gridCard}>
          <Typography variant="headlineSm">{activeLoans.length}</Typography>
          <Typography variant="bodySm" color={theme.colors.textSecondary}>Active Loans</Typography>
        </Card>
        <Card style={styles.gridCard}>
          <Typography variant="headlineSm">0</Typography>
          <Typography variant="bodySm" color={theme.colors.textSecondary}>Due Today</Typography>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xl },
  badge: { backgroundColor: theme.colors.outline, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  heroCard: { backgroundColor: theme.colors.primary, padding: theme.spacing.xl, borderRadius: theme.borderRadius.lg },
  errorCard: { backgroundColor: theme.colors.errorContainer, borderColor: theme.colors.error, marginTop: theme.spacing.lg },
  grid: { flexDirection: 'row', gap: theme.spacing.md },
  gridCard: { flex: 1, padding: theme.spacing.lg, alignItems: 'center', backgroundColor: theme.colors.surface }
});
