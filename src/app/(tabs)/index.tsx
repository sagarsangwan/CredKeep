import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { formatINR, Paise } from '../../core/domain/money';
import { AuthStore } from '../../core/auth/authStore';
import { SyncCoordinator, SyncState } from '../../core/sync/syncCoordinator';

export default function HomeScreen() {
  const router = useRouter();
  const { db, error, loans, transactions, refreshVersion } = useDatabase();
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [totalOut, setTotalOut] = useState<Paise>(0 as Paise);
  const [dueToday, setDueToday] = useState<Paise>(0 as Paise);
  const [collected, setCollected] = useState<Paise>(0 as Paise);
  const [overdue, setOverdue] = useState<Paise>(0 as Paise);
  const [overdueCount, setOverdueCount] = useState<number>(0);
  const [tenantName, setTenantName] = useState<string>('My Ledger');
  const [syncState, setSyncState] = useState<SyncState>(SyncCoordinator.getState());

  useEffect(() => {
    AuthStore.getTenantName().then((name) => {
      if (name) setTenantName(name);
    });

    const unsubscribe = SyncCoordinator.subscribe((state) => {
      setSyncState(state);
    });
    return () => unsubscribe();
  }, []);

  const loadDashboard = useCallback(async () => {
    if (loans && db) {
      try {
        const allLoans = await loans.getAll();
        const active = allLoans.filter((l) => l.status === 'ACTIVE');
        setActiveLoans(active);

        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Calculate net remaining receivables (FIN-001)
        const netReceivablesRow = await db.getFirstAsync<{ remainingDue: number }>(
          `SELECT COALESCE(SUM(total_due_paise - (principal_paid_paise + markup_paid_paise)), 0) as remainingDue
           FROM repayment_schedules
           JOIN loans ON repayment_schedules.loan_id = loans.id
           WHERE loans.status = 'ACTIVE' AND repayment_schedules.status != 'PAID'`
        );
        const netReceivables = (netReceivablesRow?.remainingDue || 0) as Paise;
        setTotalOut(netReceivables);

        // 2. Calculate Due Today (UX-001)
        const dueTodayRow = await db.getFirstAsync<{ dueToday: number }>(
          `SELECT COALESCE(SUM(total_due_paise - (principal_paid_paise + markup_paid_paise)), 0) as dueToday
           FROM repayment_schedules
           JOIN loans ON repayment_schedules.loan_id = loans.id
           WHERE loans.status = 'ACTIVE' AND repayment_schedules.effective_due_date = ? AND repayment_schedules.status != 'PAID'`,
          [todayStr]
        );
        setDueToday((dueTodayRow?.dueToday || 0) as Paise);

        // 3. Overdue follow-up count
        const overdueLoansRow = await db.getFirstAsync<{ overdueCount: number; overdueSum: number }>(
          `SELECT 
             COUNT(DISTINCT loan_id) as overdueCount,
             COALESCE(SUM(total_due_paise - (principal_paid_paise + markup_paid_paise)), 0) as overdueSum
           FROM repayment_schedules
           JOIN loans ON repayment_schedules.loan_id = loans.id
           WHERE loans.status = 'ACTIVE' AND repayment_schedules.effective_due_date < ? AND repayment_schedules.status != 'PAID'`,
          [todayStr]
        );
        setOverdueCount(overdueLoansRow?.overdueCount || 0);

        if (transactions) {
          const summary = await transactions.getEarningsSummary();
          const totalCollected = summary.principalReturned + summary.markupReceived + summary.penaltyReceived;
          setCollected(totalCollected as Paise);

          const totalOverdue = (overdueLoansRow?.overdueSum || 0) + summary.outstandingPenalty;
          setOverdue(totalOverdue as Paise);
        }
      } catch {
        // Suppress read errors during schema migrations
      }
    }
  }, [loans, db, transactions]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const getSyncBadge = () => {
    switch (syncState.status) {
      case 'SYNCING':
        return { text: 'SYNCING...', color: theme.colors.secondaryFixed };
      case 'PENDING':
        return { text: `${syncState.pendingCount} PENDING`, color: theme.colors.warningContainer };
      case 'OFFLINE':
        return { text: 'OFFLINE LEDGER', color: theme.colors.secondaryFixed };
      case 'ERROR':
        return { text: 'SYNC WARNING', color: theme.colors.errorContainer };
      case 'IDLE':
      default:
        return { text: 'CLOUD SYNCED', color: theme.colors.successContainer };
    }
  };

  const syncBadge = getSyncBadge();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Typography variant="headlineSm" color={theme.colors.onPrimary} style={styles.brand}>
            CredKeep • {tenantName}
          </Typography>
          <View style={styles.badgeRow}>
            <View style={styles.dot} />
            <Typography variant="labelSm" color={syncBadge.color}>
              {syncBadge.text}
            </Typography>
          </View>
        </View>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => router.push('/(tabs)/more')}
          activeOpacity={0.8}
        >
          <Typography variant="labelLg" color={theme.colors.onSecondary}>
            {tenantName.substring(0, 1).toUpperCase()}
          </Typography>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.localModeStrip}>
          <Typography variant="labelLg" color={theme.colors.surfaceContainerHighest}>
            Offline-First Ledger
          </Typography>
          <Typography variant="labelLg" color={theme.colors.secondaryFixed}>
            100% Encrypted
          </Typography>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Typography variant="labelLg" color={theme.colors.secondaryFixed}>
              TOTAL OUTSTANDING
            </Typography>
            <View style={styles.heroBadge}>
              <Typography variant="labelLg" color={theme.colors.surfaceContainerHighest}>
                {activeLoans.length} active
              </Typography>
            </View>
          </View>
          <Typography variant="rupeeDisplay" color={theme.colors.onPrimary} style={styles.heroValue}>
            {formatINR(totalOut)}
          </Typography>
          <Typography variant="bodyLg" color={theme.colors.onPrimaryContainer}>
            Net remaining receivables
          </Typography>

          <View style={styles.metricGrid}>
            <View style={styles.metricItem}>
              <Typography variant="labelLg" color={theme.colors.onPrimaryContainer}>
                Due Today
              </Typography>
              <Typography variant="headlineSm" color={theme.colors.onPrimary}>
                {formatINR(dueToday)}
              </Typography>
            </View>
            <View style={[styles.metricItem, styles.metricBorder]}>
              <Typography variant="labelLg" color={theme.colors.onPrimaryContainer}>
                Collected
              </Typography>
              <Typography variant="headlineSm" color={theme.colors.successContainer}>
                {formatINR(collected)}
              </Typography>
            </View>
            <View style={[styles.metricItem, styles.metricBorder]}>
              <Typography variant="labelLg" color={theme.colors.onPrimaryContainer}>
                Overdue
              </Typography>
              <Typography variant="headlineSm" color={theme.colors.error}>
                {formatINR(overdue)}
              </Typography>
            </View>
          </View>
        </View>

        {error && (
          <View style={styles.errorCard}>
            <Typography variant="headlineSm" color={theme.colors.error}>
              Database Error
            </Typography>
            <Typography variant="bodyMd" color={theme.colors.error}>
              {error.message}
            </Typography>
          </View>
        )}

        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionBtn1} onPress={() => router.push('/loans')}>
            <View style={styles.actionIcon1} />
            <View>
              <Typography variant="headlineSm" color={theme.colors.onPrimary}>
                + New Loan
              </Typography>
              <Typography variant="bodyMd" color={theme.colors.onPrimaryContainer}>
                Create borrower entry
              </Typography>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn2} onPress={() => router.push('/collections')}>
            <View style={styles.actionIcon2} />
            <View>
              <Typography variant="headlineSm" color={theme.colors.onSecondary}>
                ✓ Record Payment
              </Typography>
              <Typography variant="bodyMd" color={theme.colors.secondaryFixed}>
                Update ledger passbook
              </Typography>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.followUpHeader}>
          <Typography variant="headlineSm" color={theme.colors.textPrimary}>
            Follow-ups Required
          </Typography>
          <View style={styles.followUpBadge}>
            <Typography variant="labelLg" color={overdueCount > 0 ? theme.colors.error : theme.colors.textSecondary}>
              {overdueCount} Overdue
            </Typography>
          </View>
        </View>

        <View style={styles.footer}>
          <Typography variant="bodyMd" color={theme.colors.textSecondary}>
            All financial operations committed locally before synchronization
          </Typography>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.primaryContainer },
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryContainer,
  },
  brand: { fontWeight: 'bold' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.secondaryFixed, marginRight: 6 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localModeStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    backgroundColor: theme.colors.primaryContainer,
  },
  heroCard: {
    backgroundColor: theme.colors.primaryContainer,
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  heroValue: { marginBottom: 4 },
  metricGrid: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
  },
  metricItem: { flex: 1 },
  metricBorder: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 8 },
  errorCard: {
    backgroundColor: theme.colors.errorContainer,
    padding: theme.spacing.md,
    margin: theme.spacing.md,
    borderRadius: 8,
  },
  actionGrid: { flexDirection: 'row', paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm },
  actionBtn1: {
    flex: 1,
    backgroundColor: theme.colors.primaryContainer,
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'space-between',
    minHeight: 110,
  },
  actionBtn2: {
    flex: 1,
    backgroundColor: theme.colors.secondary,
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'space-between',
    minHeight: 110,
  },
  actionIcon1: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.secondary, marginBottom: 16 },
  actionIcon2: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceContainerLowest,
    marginBottom: 16,
  },
  followUpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    marginTop: 8,
  },
  followUpBadge: {
    backgroundColor: theme.colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  footer: { padding: theme.spacing.xl, alignItems: 'center' },
});
