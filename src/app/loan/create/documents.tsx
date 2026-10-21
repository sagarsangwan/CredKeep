import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AlertCircle, ShieldCheck } from 'lucide-react-native';
import { StepIndicator } from '../../../ui/StepIndicator';
import { Typography } from '../../../ui/Typography';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { AttachmentGrid, DocType } from '../../../ui/AttachmentGrid';
import { theme } from '../../../ui/theme';
import { toPaise } from '../../../core/domain/money';
import { useLoanWizard } from './LoanWizardContext';

const HIGH_VALUE_THRESHOLD = toPaise(30000);
const COMPLIANT_DOC_TYPES: DocType[] = ['promissory_note', 'property_paper', 'aadhaar'];

export default function Step3DocumentsScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useLoanWizard();

  const isHighValue = draft.principalPaise > HIGH_VALUE_THRESHOLD;

  const hasCompliantDoc = draft.attachments.some((att) =>
    COMPLIANT_DOC_TYPES.includes(att.docType)
  );

  const isBlocked = isHighValue && !hasCompliantDoc;

  const handleNext = () => {
    if (isBlocked) {
      Alert.alert(
        'Legal Document Required',
        'Loans above ₹30,000 require at least one verified security document (Promissory Note, Property Papers, or Aadhaar Card) before proceeding.'
      );
      return;
    }
    router.push('/loan/create/review');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* 4-Step Indicator Header */}
      <StepIndicator
        currentStep={3}
        totalSteps={4}
        stepTitle="Documents & Collateral"
        onBack={() => router.back()}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Collateral Description Input */}
        <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.sectionHeader}>
          PHYSICAL COLLATERAL / SECURITY
        </Typography>

        <Input
          label="Collateral Description (Optional)"
          placeholder="e.g. 15g Gold Ring, RC Book, Land Deed"
          value={draft.collateral}
          onChangeText={(text) => updateDraft({ collateral: text })}
        />

        {/* High-Value Compliance Banner */}
        {isHighValue && (
          <View style={[styles.complianceBanner, hasCompliantDoc ? styles.complianceSuccess : styles.complianceWarning]}>
            {hasCompliantDoc ? (
              <ShieldCheck size={20} color={theme.colors.success} />
            ) : (
              <AlertCircle size={20} color={theme.colors.warningText} />
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Typography
                variant="labelMd"
                color={hasCompliantDoc ? theme.colors.successText : theme.colors.warningText}
                style={{ fontWeight: '600' }}
              >
                {hasCompliantDoc ? 'Security Requirement Satisfied' : 'High-Value Loan Requirement'}
              </Typography>
              <Typography
                variant="bodySm"
                color={hasCompliantDoc ? theme.colors.successText : theme.colors.warningText}
                style={{ marginTop: 2 }}
              >
                {hasCompliantDoc
                  ? 'Mandatory legal document attached for loans exceeding ₹30,000.'
                  : 'Loans above ₹30,000 require at least one Promissory Note, Property Paper, or Aadhaar Card.'}
              </Typography>
            </View>
          </View>
        )}

        {/* Document Attachments */}
        <Typography variant="labelSm" color={theme.colors.textSecondary} style={[styles.sectionHeader, { marginTop: 16 }]}>
          DOCUMENT ATTACHMENTS ({draft.attachments.length})
        </Typography>

        <AttachmentGrid
          attachments={draft.attachments}
          onChangeAttachments={(next) => updateDraft({ attachments: next })}
          mandatoryDocTypes={isHighValue && !hasCompliantDoc ? ['promissory_note', 'property_paper', 'aadhaar'] : []}
        />
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.bottomBar}>
        <Button
          title={isBlocked ? 'Attach Document to Continue' : 'Continue to Review'}
          onPress={handleNext}
          disabled={isBlocked}
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
  sectionHeader: {
    marginBottom: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  complianceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: theme.borderRadius.md,
    marginVertical: 12,
    borderWidth: 1,
  },
  complianceWarning: {
    backgroundColor: theme.colors.warningContainer,
    borderColor: '#FDE68A',
  },
  complianceSuccess: {
    backgroundColor: theme.colors.successContainer,
    borderColor: '#A7F3D0',
  },
  bottomBar: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
});
