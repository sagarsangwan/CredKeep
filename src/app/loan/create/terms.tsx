import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StepIndicator } from '../../../ui/StepIndicator';
import { Typography } from '../../../ui/Typography';
import { Card } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { MoneyInput } from '../../../ui/MoneyInput';
import { FinancialSummaryRow } from '../../../ui/FinancialSummaryRow';
import { theme } from '../../../ui/theme';
import { formatINR } from '../../../core/domain/money';
import { useLoanWizard } from './LoanWizardContext';

export default function Step2TermsScreen() {
  const router = useRouter();
  const { draft, updateDraft, calculated } = useLoanWizard();

  const [rateText, setRateText] = useState(draft.annualRate.toString());
  const [termText, setTermText] = useState(draft.termMonths.toString());
  const [dueDayText, setDueDayText] = useState(draft.dueDay.toString());

  const isBullet = draft.productType === 'bullet';

  const handleRateChange = (text: string) => {
    setRateText(text);
    const num = parseFloat(text);
    if (!isNaN(num) && num >= 0) {
      updateDraft({ annualRate: num });
    }
  };

  const handleTermChange = (text: string) => {
    setTermText(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num > 0) {
      updateDraft({ termMonths: num });
    }
  };

  const handleDueDayChange = (text: string) => {
    setDueDayText(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 1 && num <= 31) {
      updateDraft({ dueDay: num });
    }
  };

  const handleNext = () => {
    if (draft.principalPaise <= 0) {
      Alert.alert('Invalid Principal', 'Principal amount must be greater than zero.');
      return;
    }
    if (draft.annualRate < 0) {
      Alert.alert('Invalid Rate', 'Interest rate cannot be negative.');
      return;
    }
    if (draft.termMonths <= 0) {
      Alert.alert('Invalid Duration', 'Duration must be at least 1 month.');
      return;
    }
    router.push('/loan/create/documents');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* 4-Step Indicator Header */}
      <StepIndicator
        currentStep={2}
        totalSteps={4}
        stepTitle="Loan Terms"
        onBack={() => router.back()}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Principal Amount via MoneyInput */}
        <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.inputSectionLabel}>
          LOAN PRINCIPAL
        </Typography>
        <MoneyInput
          label="Principal Amount *"
          valuePaise={draft.principalPaise}
          onChangePaise={(paise) => updateDraft({ principalPaise: paise })}
          helperText="Enter the cash disbursed to borrower"
        />

        {/* Term & Rate Inputs */}
        <Typography variant="labelSm" color={theme.colors.textSecondary} style={[styles.inputSectionLabel, { marginTop: 16 }]}>
          INTEREST & DURATION
        </Typography>

        <View style={styles.inputRow}>
          <View style={{ flex: 1 }}>
            <Input
              label="Annual Rate (% p.a.) *"
              value={rateText}
              onChangeText={handleRateChange}
              keyboardType="numeric"
              placeholder="24"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Duration (Months) *"
              value={termText}
              onChangeText={handleTermChange}
              keyboardType="number-pad"
              placeholder="10"
            />
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={{ flex: 1 }}>
            <Input
              label="Monthly Due Day (1-31)"
              value={dueDayText}
              onChangeText={handleDueDayChange}
              keyboardType="number-pad"
              placeholder="5"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Start Date (YYYY-MM-DD)"
              value={draft.startDate}
              onChangeText={(text) => updateDraft({ startDate: text })}
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>

        {/* Live Calculation Card */}
        <Card style={styles.calculationCard}>
          <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ letterSpacing: 0.5, marginBottom: 8 }}>
            CALCULATED TERMS ({isBullet ? 'BULLET LOAN' : 'MONTHLY KIST'})
          </Typography>

          {isBullet ? (
            <>
              <FinancialSummaryRow
                label="Monthly Interest Payment"
                sublabel={`Due on day ${draft.dueDay} each month`}
                value={formatINR(calculated.monthlyAmountPaise)}
                variant="highlight"
              />
              <FinancialSummaryRow
                label="Principal Due at Maturity"
                sublabel={`Due on ${calculated.maturityDate}`}
                value={formatINR(draft.principalPaise)}
              />
              <FinancialSummaryRow
                label="Total Contract Interest"
                sublabel={`${draft.termMonths} months @ ${draft.annualRate}% p.a.`}
                value={formatINR(calculated.totalInterestPaise)}
              />
              <FinancialSummaryRow
                label="Total Contract Value"
                sublabel="Principal + all monthly interest"
                value={formatINR(calculated.totalPayablePaise)}
                variant="highlight"
              />
            </>
          ) : (
            <>
              <FinancialSummaryRow
                label="Monthly Instalment (Kist)"
                sublabel={`Equal monthly payment across ${draft.termMonths} months`}
                value={formatINR(calculated.monthlyAmountPaise)}
                variant="highlight"
              />
              <FinancialSummaryRow
                label="Total Contract Markup / Interest"
                sublabel={`Flat ${draft.annualRate}% p.a. over ${draft.termMonths} mos`}
                value={formatINR(calculated.totalInterestPaise)}
              />
              <FinancialSummaryRow
                label="Total Repayment Amount"
                sublabel="Principal + total markup"
                value={formatINR(calculated.totalPayablePaise)}
                variant="highlight"
              />
              <FinancialSummaryRow
                label="Maturity Date"
                sublabel="Final installment due"
                value={calculated.maturityDate}
              />
            </>
          )}
        </Card>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.bottomBar}>
        <Button
          title="Continue to Documents"
          onPress={handleNext}
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
    paddingBottom: 24,
  },
  inputSectionLabel: {
    marginBottom: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  calculationCard: {
    marginTop: 16,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  bottomBar: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
});
