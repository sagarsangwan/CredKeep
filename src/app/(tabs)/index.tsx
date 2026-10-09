import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { formatINR, Paise } from '../../core/domain/money';

export default function HomeScreen() {
  const router = useRouter();
  const { error, loans, transactions } = useDatabase();
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [totalOut, setTotalOut] = useState<Paise>(0 as Paise);
  const [collected, setCollected] = useState<Paise>(0 as Paise);

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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Typography variant="headlineSm" color={theme.colors.onPrimary} style={styles.brand}>CredKeep</Typography>
          <View style={styles.badgeRow}>
            <View style={styles.dot} />
            <Typography variant="labelSm" color={theme.colors.secondaryFixed}>OFFLINE LEDGER</Typography>
          </View>
        </View>
        <View style={styles.avatar} />
      </View>
      
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.localModeStrip}>
          <Typography variant="labelLg" color={theme.colors.surfaceContainerHighest}>Local Ledger Mode</Typography>
          <Typography variant="labelLg" color={theme.colors.secondaryFixed}>100% On-Device</Typography>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Typography variant="labelLg" color={theme.colors.secondaryFixed}>TOTAL OUTSTANDING</Typography>
            <View style={styles.heroBadge}>
              <Typography variant="labelLg" color={theme.colors.surfaceContainerHighest}>{activeLoans.length} active</Typography>
            </View>
          </View>
          <Typography variant="rupeeDisplay" color={theme.colors.onPrimary} style={styles.heroValue}>
            {formatINR(totalOut)}
          </Typography>
          <Typography variant="bodyLg" color={theme.colors.onPrimaryContainer}>
            Total principal deployed
          </Typography>

          <View style={styles.metricGrid}>
            <View style={styles.metricItem}>
              <Typography variant="labelLg" color={theme.colors.onPrimaryContainer}>Due Today</Typography>
              <Typography variant="headlineSm" color={theme.colors.onPrimary}>₹0</Typography>
            </View>
            <View style={[styles.metricItem, styles.metricBorder]}>
              <Typography variant="labelLg" color={theme.colors.onPrimaryContainer}>Collected</Typography>
              <Typography variant="headlineSm" color={theme.colors.successContainer}>{formatINR(collected)}</Typography>
            </View>
            <View style={[styles.metricItem, styles.metricBorder]}>
              <Typography variant="labelLg" color={theme.colors.onPrimaryContainer}>Overdue</Typography>
              <Typography variant="headlineSm" color={theme.colors.error}>₹0</Typography>
            </View>
          </View>
        </View>

        {error && (
          <View style={styles.errorCard}>
            <Typography variant="headlineSm" color={theme.colors.error}>Database Error</Typography>
            <Typography variant="bodyMd" color={theme.colors.error}>{error.message}</Typography>
          </View>
        )}

        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionBtn1} onPress={() => router.push('/loans')}>
            <View style={styles.actionIcon1} />
            <View>
              <Typography variant="headlineSm" color={theme.colors.onPrimary}>+ New Loan</Typography>
              <Typography variant="bodyMd" color={theme.colors.onPrimaryContainer}>Create borrower entry</Typography>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn2} onPress={() => router.push('/collections')}>
            <View style={styles.actionIcon2} />
            <View>
              <Typography variant="headlineSm" color={theme.colors.onSecondary}>✓ Record Payment</Typography>
              <Typography variant="bodyMd" color={theme.colors.secondaryFixed}>Update ledger passbook</Typography>
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={styles.followUpHeader}>
          <Typography variant="headlineSm" color={theme.colors.textPrimary}>Follow-ups Required</Typography>
          <View style={styles.followUpBadge}>
            <Typography variant="labelLg" color={theme.colors.textSecondary}>0 Active</Typography>
          </View>
        </View>

        <View style={styles.footer}>
          <Typography variant="bodyMd" color={theme.colors.textSecondary}>All ledger data stored locally on device • Offline mode</Typography>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: theme.spacing.md, backgroundColor: theme.colors.primaryContainer,
  },
  brand: { fontWeight: 'bold' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.secondaryFixed, marginRight: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.secondary },
  localModeStrip: {
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md,
    paddingVertical: 10, backgroundColor: theme.colors.primaryContainer
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
    flexDirection: 'row', marginTop: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8, padding: 12
  },
  metricItem: { flex: 1 },
  metricBorder: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 8 },
  errorCard: { backgroundColor: theme.colors.errorContainer, padding: theme.spacing.md, margin: theme.spacing.md, borderRadius: 8 },
  actionGrid: { flexDirection: 'row', paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm },
  actionBtn1: {
    flex: 1, backgroundColor: theme.colors.primaryContainer, padding: 16, borderRadius: theme.borderRadius.lg,
    justifyContent: 'space-between', minHeight: 110
  },
  actionBtn2: {
    flex: 1, backgroundColor: theme.colors.secondary, padding: 16, borderRadius: theme.borderRadius.lg,
    justifyContent: 'space-between', minHeight: 110
  },
  actionIcon1: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.secondary, marginBottom: 16 },
  actionIcon2: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceContainerLowest, marginBottom: 16 },
  followUpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.md, marginTop: 8 },
  followUpBadge: { backgroundColor: theme.colors.surfaceContainerHigh, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  footer: { padding: theme.spacing.xl, alignItems: 'center' }
});
