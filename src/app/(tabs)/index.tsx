import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, ArrowDownLeft, UserPlus, AlertTriangle, ChevronRight } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { SyncBadge, SyncStatus } from '../../ui/SyncBadge';
import { OfflineBanner } from '../../ui/Feedback';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { formatINR, Paise } from '../../core/domain/money';
import { AuthStore } from '../../core/auth/authStore';
import { SyncCoordinator, SyncState } from '../../core/sync/syncCoordinator';

export default function HomeScreen() {
  const router = useRouter();
  const { db, loans, transactions, refreshVersion } = useDatabase();
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [totalOut, setTotalOut] = useState<Paise>(0 as Paise);
  const [dueToday, setDueToday] = useState<Paise>(0 as Paise);
  const [collected, setCollected] = useState<Paise>(0 as Paise);
  const [overdue, setOverdue] = useState<Paise>(0 as Paise);
  const [overdueCount, setOverdueCount] = useState<number>(0);
  const [tenantName, setTenantName] = useState<string>('My Ledger');
  const [syncState, setSyncState] = useState<SyncState>(SyncCoordinator.getState());
  const [refreshing, setRefreshing] = useState(false);

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

        // 1. Calculate net remaining receivables (Schedule remaining + Bullet remaining)
        const netReceivablesRow = await db.getFirstAsync<{ remainingDue: number }>(
          `SELECT COALESCE(SUM(total_due_paise - (principal_paid_paise + markup_paid_paise)), 0) as remainingDue
           FROM repayment_schedules
           JOIN loans ON repayment_schedules.loan_id = loans.id
           WHERE loans.status = 'ACTIVE' AND repayment_schedules.status != 'PAID'`
        );
        const scheduleRemaining = netReceivablesRow?.remainingDue || 0;

        const bulletPrincipalRow = await db.getFirstAsync<{ bulletRemaining: number }>(
          `SELECT COALESCE(SUM(
             loans.principal_paise - COALESCE((
               SELECT SUM(t.allocated_principal_paise)
               FROM transactions t
               WHERE t.loan_id = loans.id
             ), 0)
           ), 0) as bulletRemaining
           FROM loans
           WHERE loans.status = 'ACTIVE' AND loans.product_type = 'bullet'`
        );
        const bulletRemaining = bulletPrincipalRow?.bulletRemaining || 0;

        const netReceivables = (scheduleRemaining + bulletRemaining) as Paise;
        setTotalOut(netReceivables);

        // 2. Calculate Due Today
        const dueTodayRow = await db.getFirstAsync<{ dueToday: number }>(
          `SELECT COALESCE(SUM(total_due_paise - (principal_paid_paise + markup_paid_paise)), 0) as dueToday
           FROM repayment_schedules
           JOIN loans ON repayment_schedules.loan_id = loans.id
           WHERE loans.status = 'ACTIVE' AND repayment_schedules.effective_due_date = ? AND repayment_schedules.status != 'PAID'`,
          [todayStr]
        );
        setDueToday((dueTodayRow?.dueToday || 0) as Paise);

        // 3. Overdue count and sum
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
        // Suppress read errors during schema transitions
      }
    }
  }, [loans, db, transactions]);

  useFocusEffect(
    useCallback(() => {
      if (refreshVersion >= 0) {
        loadDashboard();
      }
    }, [loadDashboard, refreshVersion])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    SyncCoordinator.triggerSync('manual_refresh');
    setRefreshing(false);
  };

  const getSyncBadgeStatus = (): SyncStatus => {
    switch (syncState.status) {
      case 'SYNCING':
        return 'SYNCING';
      case 'PENDING':
        return syncState.pendingCount > 0 ? 'SAVED_ON_PHONE' : 'SYNCED';
      case 'OFFLINE':
        return 'SAVED_ON_PHONE';
      case 'ERROR':
        return 'NEEDS_REVIEW';
      case 'IDLE':
      default:
        return 'SYNCED';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
            {tenantName}
          </Typography>
          <View style={styles.syncRow}>
            <SyncBadge
              status={getSyncBadgeStatus()}
              needsReviewCount={syncState.pendingCount}
              onPress={() => {
                SyncCoordinator.triggerSync('user_badge_tap');
              }}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.avatar}
          onPress={() => router.push('/(tabs)/more')}
          activeOpacity={0.8}
        >
          <Typography variant="labelMd" color={theme.colors.actionOnPrimary} style={{ fontWeight: '700' }}>
            {tenantName.substring(0, 1).toUpperCase()}
          </Typography>
        </TouchableOpacity>
      </View>

      {/* Hairline Offline Banner */}
      <OfflineBanner visible={syncState.status === 'OFFLINE' || syncState.pendingCount > 0} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Total Outstanding Hero Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ letterSpacing: 0.5 }}>
              TOTAL OUTSTANDING
            </Typography>
            <View style={styles.activePill}>
              <Typography variant="labelSm" color={theme.colors.textPrimary}>
                {activeLoans.length} active {activeLoans.length === 1 ? 'loan' : 'loans'}
              </Typography>
            </View>
          </View>

          <Typography variant="rupeeDisplay" tabularNums color={theme.colors.textPrimary} style={styles.heroRupee}>
            {formatINR(totalOut)}
          </Typography>
          <Typography variant="bodySm" color={theme.colors.textSecondary}>
            Net remaining principal & markups
          </Typography>

          {/* 3 Metrics Sub-Row */}
          <View style={styles.metricRow}>
            <View style={styles.metricCol}>
              <Typography variant="labelSm" color={theme.colors.textSecondary}>
                Due Today
              </Typography>
              <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '700', marginTop: 2 }}>
                {formatINR(dueToday)}
              </Typography>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricCol}>
              <Typography variant="labelSm" color={theme.colors.textSecondary}>
                Collected
              </Typography>
              <Typography variant="titleMd" tabularNums color={theme.colors.success} style={{ fontWeight: '700', marginTop: 2 }}>
                {formatINR(collected)}
              </Typography>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricCol}>
              <Typography variant="labelSm" color={theme.colors.textSecondary}>
                Overdue
              </Typography>
              <Typography variant="titleMd" tabularNums color={overdue > 0 ? theme.colors.danger : theme.colors.textPrimary} style={{ fontWeight: '700', marginTop: 2 }}>
                {formatINR(overdue)}
              </Typography>
            </View>
          </View>
        </Card>

        {/* Overdue Alert Strip (if any overdue loans) */}
        {overdueCount > 0 && (
          <TouchableOpacity
            style={styles.overdueAlert}
            onPress={() => router.push('/(tabs)/loans')}
            activeOpacity={0.8}
          >
            <View style={styles.overdueLeft}>
              <AlertTriangle size={18} color={theme.colors.danger} />
              <Typography variant="labelMd" color={theme.colors.dangerText} style={{ marginLeft: 8, fontWeight: '600' }}>
                {overdueCount} {overdueCount === 1 ? 'loan requires' : 'loans require'} follow-up
              </Typography>
            </View>
            <ChevronRight size={18} color={theme.colors.dangerText} />
          </TouchableOpacity>
        )}

        {/* Quick Actions Title */}
        <Typography variant="labelLg" color={theme.colors.textPrimary} style={styles.sectionTitle}>
          Quick Actions
        </Typography>

        {/* Action Grid (3 Neutral Precision action tiles) */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/loans')}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconContainer}>
              <Plus size={20} color={theme.colors.actionPrimary} />
            </View>
            <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ marginTop: 8, fontWeight: '600' }}>
              New Loan
            </Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary}>
              Create loan entry
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/collections')}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconContainer}>
              <ArrowDownLeft size={20} color={theme.colors.success} />
            </View>
            <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ marginTop: 8, fontWeight: '600' }}>
              Collection
            </Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary}>
              Record payment
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/borrowers')}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconContainer}>
              <UserPlus size={20} color={theme.colors.actionPrimary} />
            </View>
            <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ marginTop: 8, fontWeight: '600' }}>
              Borrower
            </Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary}>
              Add borrower profile
            </Typography>
          </TouchableOpacity>
        </View>

        {/* Footer Note */}
        <View style={styles.footer}>
          <Typography variant="bodySm" color={theme.colors.textDisabled} style={{ textAlign: 'center' }}>
            Offline-first SQLite ledger • Hardware encrypted
          </Typography>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  headerLeft: {
    flex: 1,
  },
  syncRow: {
    marginTop: 4,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.actionPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSoft,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  heroCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activePill: {
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  heroRupee: {
    marginVertical: 4,
  },
  metricRow: {
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
  overdueAlert: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.dangerContainer,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
  },
  overdueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    fontWeight: '600',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    padding: 14,
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
});
