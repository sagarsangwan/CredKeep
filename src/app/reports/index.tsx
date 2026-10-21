import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { FinancialSummaryRow } from '../../ui/FinancialSummaryRow';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { formatINR, Paise } from '../../core/domain/money';

export default function ReportsScreen() {
  const router = useRouter();
  const { transactions } = useDatabase();
  const [globalEarnings, setGlobalEarnings] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        if (transactions) {
          const summary = await transactions.getEarningsSummary();
          setGlobalEarnings(summary);
        }
      }
      load();
    }, [transactions])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
          Earnings & Reports
        </Typography>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {globalEarnings && (
          <>
            {/* Total Collected Hero Card */}
            <Card style={styles.heroCard}>
              <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ letterSpacing: 0.5 }}>
                TOTAL ACTUAL EARNINGS
              </Typography>
              <Typography variant="rupeeDisplay" tabularNums color={theme.colors.success} style={{ marginVertical: 4 }}>
                {formatINR(globalEarnings.totalEarnings as Paise)}
              </Typography>
              <Typography variant="bodySm" color={theme.colors.textSecondary}>
                Net cash realized from markups & penalties
              </Typography>
            </Card>

            {/* Inflow Breakdown */}
            <Typography variant="labelLg" color={theme.colors.textPrimary} style={styles.sectionHeader}>
              Cash Inflow Breakdown
            </Typography>

            <Card style={styles.breakdownCard}>
              <FinancialSummaryRow
                label="Principal Capital Returned"
                sublabel="Capital recovery credited back"
                value={formatINR(globalEarnings.principalReturned as Paise)}
              />
              <FinancialSummaryRow
                label="Contractual Markup / Interest"
                sublabel="Profit realized from repaid loans"
                value={formatINR(globalEarnings.markupReceived as Paise)}
                variant="success"
              />
              <FinancialSummaryRow
                label="Late Penalties Collected"
                sublabel="Fees collected on overdue payments"
                value={formatINR(globalEarnings.penaltyReceived as Paise)}
              />
              <FinancialSummaryRow
                label="Total Cash Inflow"
                sublabel="Principal returned + earnings"
                value={formatINR((globalEarnings.principalReturned + globalEarnings.totalEarnings) as Paise)}
                variant="highlight"
              />
            </Card>

            {/* Outstanding Receivables */}
            <Typography variant="labelLg" color={theme.colors.textPrimary} style={styles.sectionHeader}>
              Outstanding / Uncollected
            </Typography>

            <Card style={styles.breakdownCard}>
              <FinancialSummaryRow
                label="Accrued / Outstanding Penalties"
                sublabel="Late fees assessed but unpaid"
                value={formatINR(globalEarnings.outstandingPenalty as Paise)}
                variant={globalEarnings.outstandingPenalty > 0 ? 'danger' : 'standard'}
              />
            </Card>
          </>
        )}
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.background,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSoft,
  },
  content: {
    padding: theme.spacing.md,
    gap: 12,
  },
  heroCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  sectionHeader: {
    marginTop: 8,
    fontWeight: '600',
  },
  breakdownCard: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
});
