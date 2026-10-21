import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Check, Plus, User, Calendar, CircleDollarSign } from 'lucide-react-native';
import { StepIndicator } from '../../../ui/StepIndicator';
import { Typography } from '../../../ui/Typography';
import { Card } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { EmptyState } from '../../../ui/Feedback';
import { theme } from '../../../ui/theme';
import { useDatabase } from '../../../core/database/DatabaseProvider';
import { Borrower } from '../../../core/database/borrowerRepository';
import { useLoanWizard } from './LoanWizardContext';

export default function Step1BorrowerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { borrowers, refreshVersion, triggerRefresh } = useDatabase();
  const { draft, updateDraft } = useLoanWizard();

  const [borrowersList, setBorrowersList] = useState<Borrower[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  useEffect(() => {
    async function load() {
      if (borrowers) {
        const list = await borrowers.getAll();
        setBorrowersList(list);

        // If borrowerId passed in query params, pre-select it
        if (params.borrowerId) {
          const match = list.find((b) => b.id === params.borrowerId);
          if (match) {
            updateDraft({ borrowerId: match.id, borrower: match });
          }
        }
      }
    }
    load();
  }, [borrowers, refreshVersion, params.borrowerId, updateDraft]);

  const filteredBorrowers = useMemo(() => {
    if (!searchQuery.trim()) return borrowersList;
    const q = searchQuery.toLowerCase().trim();
    return borrowersList.filter(
      (b) => b.name.toLowerCase().includes(q) || b.phone.includes(q)
    );
  }, [borrowersList, searchQuery]);

  const handleSelectBorrower = (b: Borrower) => {
    updateDraft({ borrowerId: b.id, borrower: b });
  };

  const handleCreateBorrower = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter both name and phone number.');
      return;
    }
    if (!borrowers) return;

    try {
      setSavingNew(true);
      const created = await borrowers.create(newName.trim(), newPhone.trim());
      setAddModalVisible(false);
      setNewName('');
      setNewPhone('');
      triggerRefresh();
      updateDraft({ borrowerId: created.id, borrower: created });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create borrower');
    } finally {
      setSavingNew(false);
    }
  };

  const handleNext = () => {
    if (!draft.borrowerId) {
      Alert.alert('Select Borrower', 'Please select a borrower to continue.');
      return;
    }
    router.push('/loan/create/terms');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* 4-Step Indicator Header */}
      <StepIndicator
        currentStep={1}
        totalSteps={4}
        stepTitle="Borrower & Product"
        onBack={() => router.replace('/(tabs)/loans')}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Section 1: Product Type Selector */}
        <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionHeader}>
          Select Product Type
        </Typography>

        <View style={styles.productRow}>
          {/* Monthly Instalment */}
          <TouchableOpacity
            style={[
              styles.productCard,
              draft.productType === 'instalment' && styles.productCardSelected,
            ]}
            onPress={() => updateDraft({ productType: 'instalment' })}
            activeOpacity={0.8}
          >
            <View style={styles.productTop}>
              <Calendar size={20} color={draft.productType === 'instalment' ? theme.colors.actionPrimary : theme.colors.textSecondary} />
              {draft.productType === 'instalment' && (
                <View style={styles.selectedDot}>
                  <Check size={12} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ marginTop: 8, fontWeight: '600' }}>
              Monthly Kist
            </Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
              Equal monthly instalments of principal + interest
            </Typography>
          </TouchableOpacity>

          {/* Bullet / Interest-Only */}
          <TouchableOpacity
            style={[
              styles.productCard,
              draft.productType === 'bullet' && styles.productCardSelected,
            ]}
            onPress={() => updateDraft({ productType: 'bullet' })}
            activeOpacity={0.8}
          >
            <View style={styles.productTop}>
              <CircleDollarSign size={20} color={draft.productType === 'bullet' ? theme.colors.actionPrimary : theme.colors.textSecondary} />
              {draft.productType === 'bullet' && (
                <View style={styles.selectedDot}>
                  <Check size={12} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ marginTop: 8, fontWeight: '600' }}>
              Bullet Loan
            </Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
              Monthly interest only, full principal at maturity
            </Typography>
          </TouchableOpacity>
        </View>

        {/* Section 2: Borrower Selection */}
        <View style={styles.borrowerHeaderRow}>
          <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
            Select Borrower
          </Typography>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            style={styles.addBorrowerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Plus size={16} color={theme.colors.actionPrimary} />
            <Typography variant="labelMd" color={theme.colors.actionPrimary} style={{ marginLeft: 4 }}>
              Add New
            </Typography>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <Input
          placeholder="Search borrower by name or phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />

        {/* Selected Borrower Pill (if selected) */}
        {draft.borrower && (
          <View style={styles.selectedBanner}>
            <View style={styles.selectedLeft}>
              <View style={styles.avatarMini}>
                <Typography variant="labelSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
                  {draft.borrower.name.substring(0, 2).toUpperCase()}
                </Typography>
              </View>
              <View>
                <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                  {draft.borrower.name}
                </Typography>
                <Typography variant="bodySm" color={theme.colors.textSecondary}>
                  {draft.borrower.phone}
                </Typography>
              </View>
            </View>
            <View style={styles.checkedPill}>
              <Check size={14} color={theme.colors.success} />
              <Typography variant="labelSm" color={theme.colors.successText} style={{ marginLeft: 4 }}>
                Selected
              </Typography>
            </View>
          </View>
        )}

        {/* Borrower Cards List */}
        <View style={styles.borrowerList}>
          {filteredBorrowers.map((b) => {
            const isSelected = draft.borrowerId === b.id;
            return (
              <TouchableOpacity
                key={b.id}
                onPress={() => handleSelectBorrower(b)}
                activeOpacity={0.7}
              >
                <Card style={[styles.borrowerRow, isSelected && styles.borrowerRowSelected]}>
                  <View style={styles.borrowerRowLeft}>
                    <View style={styles.avatar}>
                      <User size={16} color={theme.colors.textSecondary} />
                    </View>
                    <View>
                      <Typography variant="titleMd" color={theme.colors.textPrimary}>
                        {b.name}
                      </Typography>
                      <Typography variant="bodySm" color={theme.colors.textSecondary}>
                        {b.phone}
                      </Typography>
                    </View>
                  </View>

                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}

          {filteredBorrowers.length === 0 && (
            <EmptyState
              title={searchQuery ? 'No matching borrowers' : 'No borrowers yet'}
              description="Tap 'Add New' above to create a borrower profile."
            />
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <Button
          title="Continue to Terms"
          onPress={handleNext}
          disabled={!draft.borrowerId}
          variant="primary"
        />
      </View>

      {/* Add Borrower Modal */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Typography variant="bodyMd" color={theme.colors.textSecondary}>
                  Cancel
                </Typography>
              </TouchableOpacity>
              <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                New Borrower
              </Typography>
              <View style={{ width: 44 }} />
            </View>

            <View style={{ padding: theme.spacing.lg }}>
              <Input
                label="Full Name *"
                placeholder="e.g. Suresh Patel"
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />
              <Input
                label="Phone Number *"
                placeholder="e.g. 9876543210"
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
              />

              <View style={{ marginTop: 24 }}>
                <Button
                  title="Create & Select"
                  onPress={handleCreateBorrower}
                  loading={savingNew}
                  variant="primary"
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
    fontWeight: '600',
    marginBottom: 8,
  },
  productRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  productCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 14,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDefault,
  },
  productCardSelected: {
    borderColor: theme.colors.actionPrimary,
    backgroundColor: '#FFFFFF',
  },
  productTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.actionPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  borrowerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  addBorrowerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.actionPrimary,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginVertical: 10,
  },
  selectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarMini: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  checkedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.successContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  borrowerList: {
    marginTop: 8,
    gap: 8,
  },
  borrowerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.colors.surface,
  },
  borrowerRowSelected: {
    borderColor: theme.colors.actionPrimary,
  },
  borrowerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: theme.colors.actionPrimary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.actionPrimary,
  },
  bottomBar: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
});
