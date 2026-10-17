import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, Edit3, ChevronRight } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Borrower } from '../../core/database/borrowerRepository';
import { Loan } from '../../core/database/loanRepository';
import { formatINR, Paise } from '../../core/domain/money';

type BorrowerSummary = {
  activeLoanCount: number;
  totalPrincipalRemaining: number;
  totalMarkupRemaining: number;
  totalPenaltyRemaining: number;
  totalOutstanding: number;
};

export default function BorrowerDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { borrowers, loans, transactions, refreshVersion, triggerRefresh } = useDatabase();

  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [borrowerLoans, setBorrowerLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<BorrowerSummary | null>(null);

  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (borrowers && loans && transactions && id) {
      try {
        const b = await borrowers.getById(id as string);
        setBorrower(b);
        const lns = await loans.getByBorrowerId(id as string);
        setBorrowerLoans(lns);

        const sum = await transactions.getBorrowerSummary(id as string);
        setSummary(sum);
      } catch (e) {
        console.error(e);
      }
    }
  }, [id, borrowers, loans, transactions, refreshVersion]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (!borrower) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <Stack.Screen options={{ title: 'Borrower Profile', headerShown: true }} />
        <View style={[styles.container, styles.centered]}>
          <Typography variant="bodyMd" color={theme.colors.textSecondary}>Loading profile...</Typography>
        </View>
      </SafeAreaView>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join('');
  };

  const handleCall = () => {
    if (borrower.phone) {
      Linking.openURL(`tel:${borrower.phone}`).catch(() => {
        Alert.alert('Error', 'Unable to initiate phone call on this device.');
      });
    }
  };

  const openEditModal = () => {
    setEditName(borrower.name);
    setEditPhone(borrower.phone);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      Alert.alert('Required Fields', 'Please provide both name and phone number.');
      return;
    }

    if (!borrowers) {
      Alert.alert('Error', 'Database not ready');
      return;
    }

    try {
      setSaving(true);
      const updated = await borrowers.update(borrower.id, editName.trim(), editPhone.trim());
      setBorrower(updated);
      setEditModalVisible(false);
      triggerRefresh();
      Alert.alert('Success', 'Borrower details updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update borrower details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          title: borrower.name,
          headerShown: true,
          headerTintColor: theme.colors.textPrimary,
          headerStyle: { backgroundColor: theme.colors.background },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
                {getInitials(borrower.name)}
              </Typography>
            </View>
            <View style={styles.profileInfo}>
              <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
                {borrower.name}
              </Typography>
              <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
                {borrower.phone}
              </Typography>
            </View>
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={handleCall} style={styles.actionPill}>
              <Phone size={14} color={theme.colors.actionPrimary} />
              <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ marginLeft: 6 }}>
                Call
              </Typography>
            </TouchableOpacity>

            <TouchableOpacity onPress={openEditModal} style={styles.actionPill}>
              <Edit3 size={14} color={theme.colors.textSecondary} />
              <Typography variant="labelMd" color={theme.colors.textSecondary} style={{ marginLeft: 6 }}>
                Edit
              </Typography>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Total Outstanding Hero Card */}
        <Card style={styles.summaryCard}>
          <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ letterSpacing: 0.5 }}>
            TOTAL OUTSTANDING
          </Typography>
          <Typography variant="rupeeDisplay" tabularNums color={theme.colors.textPrimary} style={{ marginVertical: 6 }}>
            {summary ? formatINR(summary.totalOutstanding as Paise) : '₹0.00'}
          </Typography>

          <View style={styles.summaryBreakdownRow}>
            <View style={styles.breakdownCol}>
              <Typography variant="labelSm" color={theme.colors.textSecondary}>
                PRINCIPAL
              </Typography>
              <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
                {summary ? formatINR(summary.totalPrincipalRemaining as Paise) : '₹0'}
              </Typography>
            </View>
            <View style={styles.breakdownCol}>
              <Typography variant="labelSm" color={theme.colors.textSecondary}>
                MARKUP
              </Typography>
              <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
                {summary ? formatINR(summary.totalMarkupRemaining as Paise) : '₹0'}
              </Typography>
            </View>
            <View style={styles.breakdownCol}>
              <Typography variant="labelSm" color={theme.colors.textSecondary}>
                PENALTY
              </Typography>
              <Typography
                variant="titleMd"
                tabularNums
                color={(summary?.totalPenaltyRemaining || 0) > 0 ? theme.colors.warningText : theme.colors.textSecondary}
                style={{ fontWeight: '600', marginTop: 2 }}
              >
                {summary ? formatINR(summary.totalPenaltyRemaining as Paise) : '₹0'}
              </Typography>
            </View>
          </View>
        </Card>

        {/* Quick Action Buttons */}
        <View style={styles.btnRow}>
          <View style={{ flex: 1 }}>
            <Button
              title="Record Payment"
              variant="primary"
              onPress={() => router.push({ pathname: '/collections', params: { borrowerId: borrower.id } } as any)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="+ New Loan"
              variant="outline"
              onPress={() => router.push({ pathname: '/loan/create', params: { borrowerId: borrower.id } } as any)}
            />
          </View>
        </View>

        {/* Associated Loans Section */}
        <Typography variant="labelLg" color={theme.colors.textPrimary} style={styles.sectionTitle}>
          Associated Loans ({borrowerLoans.length})
        </Typography>

        {borrowerLoans.map((loan) => (
          <TouchableOpacity key={loan.id} onPress={() => router.push(`/loan/${loan.id}` as any)} activeOpacity={0.7}>
            <Card style={styles.loanCard}>
              <View style={styles.loanCardHeader}>
                <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                  {loan.product_type === 'instalment' ? 'Monthly Instalment' : 'Bullet Loan'}
                </Typography>
                <View
                  style={[
                    styles.statusBadge,
                    loan.status === 'ACTIVE'
                      ? styles.badgeActive
                      : loan.status === 'SETTLED'
                      ? styles.badgeSettled
                      : styles.badgeDefault,
                  ]}
                >
                  <Typography
                    variant="labelSm"
                    color={
                      loan.status === 'ACTIVE'
                        ? theme.colors.success
                        : loan.status === 'SETTLED'
                        ? theme.colors.textSecondary
                        : theme.colors.danger
                    }
                  >
                    {loan.status}
                  </Typography>
                </View>
              </View>

              <Typography variant="headlineSm" tabularNums color={theme.colors.textPrimary} style={{ marginVertical: 4 }}>
                {formatINR(loan.principal_paise as Paise)}
              </Typography>

              {loan.collateral ? (
                <Typography variant="bodySm" color={theme.colors.textSecondary}>
                  Collateral: {loan.collateral}
                </Typography>
              ) : null}

              <View style={styles.cardFooter}>
                <Typography variant="bodySm" color={theme.colors.textDisabled}>
                  Disbursed {loan.start_date}
                </Typography>
                <ChevronRight size={16} color={theme.colors.textDisabled} />
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Typography variant="bodyMd" color={theme.colors.textSecondary}>
                  Cancel
                </Typography>
              </TouchableOpacity>
              <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                Edit Borrower
              </Typography>
              <View style={{ width: 44 }} />
            </View>

            <View style={styles.modalBody}>
              <Input
                label="Full Name *"
                value={editName}
                onChangeText={setEditName}
              />
              <Input
                label="Phone Number *"
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
              />

              <View style={{ marginTop: 24 }}>
                <Button
                  title="Save Changes"
                  onPress={handleSaveEdit}
                  loading={saving}
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
    backgroundColor: theme.colors.surfaceSoft,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    gap: 12,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  summaryCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  summaryBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
  breakdownCol: {
    flex: 1,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 4,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '600',
  },
  loanCard: {
    padding: 14,
    backgroundColor: theme.colors.surface,
    marginBottom: 8,
  },
  loanCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.xs,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: theme.colors.successContainer,
    borderColor: '#86EFAC',
  },
  badgeSettled: {
    backgroundColor: theme.colors.surfaceSoft,
    borderColor: theme.colors.borderDefault,
  },
  badgeDefault: {
    backgroundColor: theme.colors.dangerContainer,
    borderColor: '#FECACA',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  modalBody: {
    padding: theme.spacing.lg,
  },
});
