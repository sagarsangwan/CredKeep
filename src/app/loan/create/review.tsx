import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StepIndicator } from '../../../ui/StepIndicator';
import { Typography } from '../../../ui/Typography';
import { Card } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { FinancialSummaryRow } from '../../../ui/FinancialSummaryRow';
import { InlineErrorCard } from '../../../ui/Feedback';
import { theme } from '../../../ui/theme';
import { formatINR } from '../../../core/domain/money';
import { useLoanWizard } from './LoanWizardContext';

export default function Step4ReviewScreen() {
  const router = useRouter();
  const { draft, calculated, commitLoan, isSubmitting, submitError } = useLoanWizard();

  const isBullet = draft.productType === 'bullet';

  const handleCreate = async () => {
    try {
      const loanId = await commitLoan();
      Alert.alert(
        'Loan Created Successfully',
        `Contract committed to local encrypted ledger.`,
        [
          {
            text: 'View Loan Details',
            onPress: () => router.replace(`/loan/${loanId}` as any),
          },
        ]
      );
    } catch {
      // Error handled by submitError state
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* 4-Step Indicator Header */}
      <StepIndicator
        currentStep={4}
        totalSteps={4}
        stepTitle="Review & Confirm"
        onBack={() => router.back()}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Borrower Card */}
        <Card style={styles.sectionCard}>
          <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.cardHeaderLabel}>
            BORROWER
          </Typography>
          <View style={styles.borrowerRow}>
            <View>
              <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
                {draft.borrower?.name || 'Unknown Borrower'}
              </Typography>
              <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
                {draft.borrower?.phone}
              </Typography>
            </View>
            <View style={styles.badgePill}>
              <Typography variant="labelSm" color={theme.colors.textPrimary}>
                {isBullet ? 'Bullet Loan' : 'Monthly Kist'}
              </Typography>
            </View>
          </View>
        </Card>

        {/* Financial Terms Breakdown */}
        <Card style={styles.sectionCard}>
          <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.cardHeaderLabel}>
            FINANCIAL CONTRACT BREAKDOWN
          </Typography>

          <FinancialSummaryRow
            label="Disbursed Principal"
            value={formatINR(draft.principalPaise)}
            variant="highlight"
          />
          <FinancialSummaryRow
            label="Interest Rate"
            value={`${draft.annualRate}% p.a.`}
          />
          <FinancialSummaryRow
            label="Term Duration"
            value={`${draft.termMonths} Months`}
          />
          <FinancialSummaryRow
            label="First Payment Due"
            value={calculated.firstDueDate || calculated.schedule[0]?.dueDate || draft.startDate}
          />
          <FinancialSummaryRow
            label="Maturity Date"
            value={calculated.maturityDate}
          />
          <FinancialSummaryRow
            label={isBullet ? 'Total Contract Interest' : 'Total Contract Markup'}
            value={formatINR(calculated.totalInterestPaise)}
          />
          <FinancialSummaryRow
            label={isBullet ? 'Monthly Interest Due' : 'Monthly Instalment (Kist)'}
            value={formatINR(calculated.monthlyAmountPaise)}
            variant="highlight"
          />
          <FinancialSummaryRow
            label="Total Amount Payable"
            value={formatINR(calculated.totalPayablePaise)}
            variant="highlight"
          />
        </Card>

        {/* Collateral & Documents Summary */}
        <Card style={styles.sectionCard}>
          <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.cardHeaderLabel}>
            SECURITY & ATTACHMENTS
          </Typography>

          <FinancialSummaryRow
            label="Physical Collateral"
            value={draft.collateral || 'None declared'}
          />
          <FinancialSummaryRow
            label="Verified Documents"
            value={`${draft.attachments.length} attached`}
          />
        </Card>

        {/* Schedule Preview (Instalment) */}
        {!isBullet && calculated.schedule.length > 0 && (
          <Card style={styles.sectionCard}>
            <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.cardHeaderLabel}>
              REPAYMENT SCHEDULE PREVIEW ({calculated.schedule.length} KISTS)
            </Typography>

            {calculated.schedule.slice(0, 5).map((item) => (
              <View key={item.periodNumber} style={styles.scheduleRow}>
                <View style={styles.scheduleLeft}>
                  <View style={styles.scheduleNumber}>
                    <Typography variant="labelSm" color={theme.colors.textSecondary}>
                      #{item.periodNumber}
                    </Typography>
                  </View>
                  <Typography variant="bodyMd" color={theme.colors.textPrimary}>
                    {item.dueDate}
                  </Typography>
                </View>

                <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                  {formatINR(item.totalDuePaise)}
                </Typography>
              </View>
            ))}

            {calculated.schedule.length > 5 && (
              <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ textAlign: 'center', marginTop: 8 }}>
                + {calculated.schedule.length - 5} more installments
              </Typography>
            )}
          </Card>
        )}

        {/* Error Card */}
        {submitError && (
          <InlineErrorCard
            title="Loan Creation Error"
            message={submitError}
            retryLabel="Try Again"
            onRetry={handleCreate}
          />
        )}
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.bottomBar}>
        <Button
          title="Disburse & Create Loan"
          onPress={handleCreate}
          loading={isSubmitting}
          variant="primary"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSoft,
  },
  content: {
    padding: theme.spacing.md,
    gap: 12,
    paddingBottom: 24,
  },
  sectionCard: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  cardHeaderLabel: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  borrowerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  badgePill: {
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  scheduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scheduleNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
});
