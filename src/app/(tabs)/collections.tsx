import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ChevronRight, Phone } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { MoneyInput } from '../../ui/MoneyInput';
import { EmptyState } from '../../ui/Feedback';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { Borrower } from '../../core/database/borrowerRepository';
import { Paise, formatINR } from '../../core/domain/money';

interface CollectionLoanItem {
  loan: Loan;
  borrowerName: string;
  borrowerPhone: string;
  productLabel: string;
  remainingBalancePaise: number;
  amountCurrentlyDuePaise: number;
  nextDueOrMaturityDate: string;
  isOverdue: boolean;
}

export default function CollectionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { loans, borrowers, transactions, refreshVersion, triggerRefresh } = useDatabase();

  const [collectionItems, setCollectionItems] = useState<CollectionLoanItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'OVERDUE' | 'TODAY'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // Quick Payment Modal
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [activeItem, setActiveItem] = useState<CollectionLoanItem | null>(null);
  const [collectAmountPaise, setCollectAmountPaise] = useState<Paise>(0 as Paise);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'BANK'>('CASH');
  const [isRecording, setIsRecording] = useState(false);

  const openPaymentModal = useCallback((item: CollectionLoanItem) => {
    setActiveItem(item);
    setCollectAmountPaise((item.amountCurrentlyDuePaise || item.remainingBalancePaise) as Paise);
    setPaymentModalVisible(true);
  }, []);

  const loadCollections = useCallback(async () => {
    if (!loans || !borrowers || !transactions) return;
    try {
      const allLoans = await loans.getAll();
      const allBorrowers = await borrowers.getAll();
      const borrowerMap = new Map<string, Borrower>();
      allBorrowers.forEach((b) => borrowerMap.set(b.id, b));

      const activeLoans = allLoans.filter((l) => l.status === 'ACTIVE');
      const today = new Date().toISOString().split('T')[0];

      const items: CollectionLoanItem[] = [];

      for (const loan of activeLoans) {
        const borrower = borrowerMap.get(loan.borrower_id);
        const borrowerName = borrower?.name || 'Unknown Borrower';
        const borrowerPhone = borrower?.phone || '';

        const isBullet = loan.product_type === 'bullet';
        const productLabel = isBullet ? 'Bullet Loan' : 'Monthly Kist';

        let remainingBalancePaise = loan.principal_paise;
        let amountCurrentlyDuePaise = 0;
        let nextDueOrMaturityDate = '';
        let isOverdue = false;

        if (isBullet) {
          nextDueOrMaturityDate = loan.maturity_date || loan.start_date;
          isOverdue = Boolean(nextDueOrMaturityDate && nextDueOrMaturityDate < today);

          const terms = await loans.getLoanTerms(loan.id);
          const totalContractInterest = terms.reduce((acc, t) => acc + (t.interest_paise || 0), 0) || (loan.interest_paise || 0);

          const earnings = await transactions.getEarningsSummary({ loanId: loan.id });
          const unpaidInterest = Math.max(0, totalContractInterest - earnings.markupReceived);
          const unpaidPrincipal = Math.max(0, loan.principal_paise - earnings.principalReturned);
          const penalties = earnings.outstandingPenalty;

          remainingBalancePaise = unpaidPrincipal;

          if (isOverdue) {
            amountCurrentlyDuePaise = unpaidPrincipal + unpaidInterest + penalties;
          } else {
            // Due monthly interest
            const activeRate = (terms.length > 0 ? terms[terms.length - 1].annual_rate : loan.annual_rate) || 24;
            amountCurrentlyDuePaise = Math.round(unpaidPrincipal * (activeRate / 12 / 100));
          }
        } else {
          // Monthly Kist
          const schedule = await loans.getSchedule(loan.id);
          const earnings = await transactions.getEarningsSummary({ loanId: loan.id });
          const unpaidPrincipal = Math.max(0, loan.principal_paise - earnings.principalReturned);
          remainingBalancePaise = unpaidPrincipal;

          const unpaidKists = (schedule as any[]).filter((k: any) => k.status !== 'PAID');
          if (unpaidKists.length > 0) {
            nextDueOrMaturityDate = unpaidKists[0].effective_due_date;
            isOverdue = unpaidKists.some((k: any) => k.effective_due_date < today);

            const dueKists = unpaidKists.filter((k: any) => k.effective_due_date <= today);
            if (dueKists.length > 0) {
              const duePaise = dueKists.reduce(
                (acc: number, k: any) =>
                  acc +
                  ((k.total_due_paise || 0) -
                    ((k.principal_paid_paise || 0) + (k.markup_paid_paise || 0))),
                0
              );
              amountCurrentlyDuePaise = duePaise + earnings.outstandingPenalty;
            } else {
              const nextKist = unpaidKists[0];
              amountCurrentlyDuePaise =
                (nextKist.total_due_paise || 0) -
                ((nextKist.principal_paid_paise || 0) + (nextKist.markup_paid_paise || 0));
            }
          }
        }

        items.push({
          loan,
          borrowerName,
          borrowerPhone,
          productLabel,
          remainingBalancePaise,
          amountCurrentlyDuePaise,
          nextDueOrMaturityDate,
          isOverdue,
        });
      }

      setCollectionItems(items);

      // Auto-open modal if loanId / borrowerId passed in params
      if (params.loanId) {
        const target = items.find((it) => it.loan.id === params.loanId);
        if (target) {
          openPaymentModal(target);
        }
      }
    } catch {
      // Suppress read errors
    }
  }, [loans, borrowers, transactions, params.loanId, openPaymentModal, refreshVersion]);

  useFocusEffect(
    useCallback(() => {
      loadCollections();
    }, [loadCollections])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCollections();
    setRefreshing(false);
  };

  const handleRecordPayment = async () => {
    if (!activeItem || !transactions) return;
    if (collectAmountPaise <= 0) {
      Alert.alert('Invalid Amount', 'Payment amount must be greater than zero.');
      return;
    }

    try {
      setIsRecording(true);
      const opId = 'col_' + Date.now();
      const today = new Date().toISOString().split('T')[0];

      await transactions.recordCashPayment(
        activeItem.loan.id,
        collectAmountPaise,
        opId,
        today
      );

      setPaymentModalVisible(false);
      triggerRefresh();
      await loadCollections();
      Alert.alert('Payment Recorded', `Successfully recorded ${formatINR(collectAmountPaise)} collection.`);
    } catch (e: any) {
      Alert.alert('Payment Failed', e.message || 'Failed to record collection');
    } finally {
      setIsRecording(false);
    }
  };

  const filteredItems = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return collectionItems.filter((item) => {
      // Filter tab
      if (filterType === 'OVERDUE' && !item.isOverdue) return false;
      if (filterType === 'TODAY' && item.nextDueOrMaturityDate !== today) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.borrowerName.toLowerCase().includes(q) ||
          item.borrowerPhone.includes(q) ||
          item.productLabel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [collectionItems, filterType, searchQuery]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
            Collections
          </Typography>
          <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
            {collectionItems.length} active loans • Passbook collection
          </Typography>
        </View>
      </View>

      {/* Search & Filter Tabs */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search by borrower name or phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />

        <View style={styles.filterRow}>
          {(['ALL', 'OVERDUE', 'TODAY'] as const).map((filter) => {
            const isSelected = filterType === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setFilterType(filter)}
                activeOpacity={0.7}
              >
                <Typography
                  variant="labelSm"
                  color={isSelected ? theme.colors.actionPrimary : theme.colors.textSecondary}
                  style={{ fontWeight: isSelected ? '700' : '500' }}
                >
                  {filter === 'ALL' ? 'All Loans' : filter === 'OVERDUE' ? 'Overdue' : 'Due Today'}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Collection Cards List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.loan.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Card style={[styles.loanCard, item.isOverdue && styles.cardOverdue]}>
            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
                  {item.borrowerName}
                </Typography>
                <View style={styles.phoneRow}>
                  <Phone size={12} color={theme.colors.textSecondary} />
                  <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginLeft: 4 }}>
                    {item.borrowerPhone} • {item.productLabel}
                  </Typography>
                </View>
              </View>

              <View style={[styles.statusPill, item.isOverdue ? styles.pillOverdue : styles.pillCurrent]}>
                <Typography
                  variant="labelSm"
                  color={item.isOverdue ? theme.colors.dangerText : theme.colors.successText}
                  style={{ fontWeight: '600' }}
                >
                  {item.isOverdue ? 'OVERDUE' : 'CURRENT'}
                </Typography>
              </View>
            </View>

            {/* Financial Details Row */}
            <View style={styles.amountRow}>
              <View>
                <Typography variant="labelSm" color={theme.colors.textSecondary}>
                  AMOUNT DUE
                </Typography>
                <Typography
                  variant="titleMd"
                  tabularNums
                  color={item.isOverdue ? theme.colors.danger : theme.colors.textPrimary}
                  style={{ fontWeight: '700', marginTop: 2 }}
                >
                  {formatINR(item.amountCurrentlyDuePaise as Paise)}
                </Typography>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Typography variant="labelSm" color={theme.colors.textSecondary}>
                  DUE DATE
                </Typography>
                <Typography variant="bodyMd" color={theme.colors.textPrimary} style={{ marginTop: 2 }}>
                  {item.nextDueOrMaturityDate}
                </Typography>
              </View>
            </View>

            {/* Actions Row */}
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.detailsBtn}
                onPress={() => router.push(`/loan/${item.loan.id}` as any)}
                activeOpacity={0.7}
              >
                <Typography variant="labelMd" color={theme.colors.textSecondary}>
                  View Loan
                </Typography>
                <ChevronRight size={14} color={theme.colors.textSecondary} style={{ marginLeft: 2 }} />
              </TouchableOpacity>

              <Button
                title="Record Payment"
                onPress={() => openPaymentModal(item)}
                variant="primary"
                size="small"
              />
            </View>
          </Card>
        )}
        ListEmptyComponent={() => (
          <EmptyState
            title={searchQuery ? 'No matching loans' : 'No collections due'}
            description="All scheduled payments are up to date."
          />
        )}
      />

      {/* Collect Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <Typography variant="bodyMd" color={theme.colors.textSecondary}>
                  Cancel
                </Typography>
              </TouchableOpacity>
              <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                Record Collection
              </Typography>
              <View style={{ width: 44 }} />
            </View>

            <View style={{ padding: theme.spacing.lg }}>
              {activeItem && (
                <Card style={styles.modalTargetCard}>
                  <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
                    {activeItem.borrowerName}
                  </Typography>
                  <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
                    {activeItem.productLabel} • Remaining Principal: {formatINR(activeItem.remainingBalancePaise as Paise)}
                  </Typography>
                </Card>
              )}

              <View style={{ marginVertical: 14 }}>
                <MoneyInput
                  label="Collection Amount *"
                  valuePaise={collectAmountPaise}
                  onChangePaise={setCollectAmountPaise}
                  helperText="Payment will be allocated via waterfall: penalties first, then interest, then principal."
                />
              </View>

              {/* Payment Method Selector */}
              <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ marginBottom: 8, fontWeight: '600' }}>
                PAYMENT METHOD
              </Typography>
              <View style={styles.methodRow}>
                {(['CASH', 'UPI', 'BANK'] as const).map((method) => {
                  const isSelected = paymentMethod === method;
                  return (
                    <TouchableOpacity
                      key={method}
                      style={[styles.methodBtn, isSelected && styles.methodBtnSelected]}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Typography
                        variant="labelMd"
                        color={isSelected ? theme.colors.actionPrimary : theme.colors.textSecondary}
                        style={{ fontWeight: isSelected ? '700' : '500' }}
                      >
                        {method}
                      </Typography>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ marginTop: 28 }}>
                <Button
                  title="Confirm & Post Collection"
                  onPress={handleRecordPayment}
                  loading={isRecording}
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
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSoft,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  filterChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: theme.colors.actionPrimary,
  },
  listContent: {
    padding: theme.spacing.md,
    gap: 10,
  },
  loanCard: {
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  cardOverdue: {
    borderColor: '#FCA5A5',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.xs,
  },
  pillOverdue: {
    backgroundColor: theme.colors.dangerContainer,
  },
  pillCurrent: {
    backgroundColor: theme.colors.successContainer,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
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
  modalTargetCard: {
    padding: 12,
    backgroundColor: theme.colors.surfaceSoft,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodBtnSelected: {
    borderColor: theme.colors.actionPrimary,
    backgroundColor: '#FFFFFF',
  },
});
