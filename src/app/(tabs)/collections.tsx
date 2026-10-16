import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
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
  const { loans, borrowers, transactions, refreshVersion } = useDatabase();
  const [collectionItems, setCollectionItems] = useState<CollectionLoanItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadCollections = useCallback(async () => {
    if (!loans || !borrowers || !transactions) return;
    try {
      setLoading(true);
      const allLoans = await loans.getAll();
      const allBorrowers = await borrowers.getAll();
      const borrowerMap = new Map<string, Borrower>();
      allBorrowers.forEach(b => borrowerMap.set(b.id, b));

      const activeLoans = allLoans.filter(l => l.status === 'ACTIVE');
      const today = new Date().toISOString().split('T')[0];

      const items: CollectionLoanItem[] = [];

      for (const loan of activeLoans) {
        const borrower = borrowerMap.get(loan.borrower_id);
        const borrowerName = borrower?.name || 'Unknown Borrower';
        const borrowerPhone = borrower?.phone || '';

        const isBullet = loan.product_type === 'bullet';
        const productLabel = isBullet ? 'One-Time Repayment' : 'Monthly Kist';

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
            // Due on maturity
            amountCurrentlyDuePaise = unpaidInterest;
          }
        } else {
          // Monthly Kist
          const schedule = await loans.getSchedule(loan.id);
          const earnings = await transactions.getEarningsSummary({ loanId: loan.id });
          const unpaidPrincipal = Math.max(0, loan.principal_paise - earnings.principalReturned);
          remainingBalancePaise = unpaidPrincipal;

          // Find earliest unpaid kist
          const unpaidKists = (schedule as any[]).filter((k: any) => k.status !== 'PAID');
          if (unpaidKists.length > 0) {
            nextDueOrMaturityDate = unpaidKists[0].effective_due_date;
            isOverdue = unpaidKists.some((k: any) => k.effective_due_date < today);

            // Amount currently due = all due kists past or on today + penalties
            const dueKists = unpaidKists.filter((k: any) => k.effective_due_date <= today);
            if (dueKists.length > 0) {
              const duePaise = dueKists.reduce((acc: number, k: any) => acc + ((k.total_due_paise || 0) - ((k.principal_paid_paise || 0) + (k.markup_paid_paise || 0))), 0);
              amountCurrentlyDuePaise = duePaise + earnings.outstandingPenalty;
            } else {
              // Next upcoming kist amount
              const nextKist = unpaidKists[0];
              amountCurrentlyDuePaise = ((nextKist.total_due_paise || 0) - ((nextKist.principal_paid_paise || 0) + (nextKist.markup_paid_paise || 0)));
            }
          } else {
            nextDueOrMaturityDate = '-';
            amountCurrentlyDuePaise = 0;
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
    } finally {
      setLoading(false);
    }
  }, [loans, borrowers, transactions]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections, refreshVersion]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return collectionItems;
    const q = searchQuery.toLowerCase().trim();
    return collectionItems.filter(item =>
      item.borrowerName.toLowerCase().includes(q) ||
      item.borrowerPhone.includes(q) ||
      item.productLabel.toLowerCase().includes(q) ||
      item.loan.id.toLowerCase().includes(q)
    );
  }, [collectionItems, searchQuery]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Typography variant="headlineMd" color={theme.colors.onPrimary}>
          Collections
        </Typography>
        <Typography variant="bodySm" color={theme.colors.onPrimaryContainer} style={{ marginTop: 2 }}>
          {filteredItems.length} active loans for collection
        </Typography>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search borrower by name or phone..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={item => item.loan.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/loan/${item.loan.id}`)}
          >
            <Card elevated style={[styles.loanCard, item.isOverdue && styles.overdueCard]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Typography variant="headlineSm">{item.borrowerName}</Typography>
                  <Typography variant="bodySm" color={theme.colors.textSecondary}>
                    {item.borrowerPhone}
                  </Typography>
                </View>
                <View style={[styles.badge, item.isOverdue ? styles.badgeOverdue : styles.badgeActive]}>
                  <Typography variant="labelSm" color={item.isOverdue ? '#fff' : theme.colors.primary}>
                    {item.isOverdue ? 'OVERDUE' : 'CURRENT'}
                  </Typography>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Typography variant="bodySm" color={theme.colors.textSecondary}>Product</Typography>
                  <Typography variant="labelMd">{item.productLabel}</Typography>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Typography variant="bodySm" color={theme.colors.textSecondary}>Remaining Principal</Typography>
                  <Typography variant="labelLg">{formatINR(item.remainingBalancePaise as Paise)}</Typography>
                </View>
              </View>

              <View style={[styles.cardRow, { marginTop: 8 }]}>
                <View style={{ flex: 1 }}>
                  <Typography variant="bodySm" color={theme.colors.textSecondary}>
                    {item.loan.product_type === 'bullet' ? 'Maturity Date' : 'Next Due Date'}
                  </Typography>
                  <Typography variant="bodyMd" color={item.isOverdue ? theme.colors.error : theme.colors.textPrimary}>
                    {item.nextDueOrMaturityDate}
                  </Typography>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Typography variant="bodySm" color={theme.colors.textSecondary}>Amount Currently Due</Typography>
                  <Typography variant="headlineSm" color={item.isOverdue ? theme.colors.error : theme.colors.primary}>
                    {formatINR(item.amountCurrentlyDuePaise as Paise)}
                  </Typography>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Typography variant="bodyLg" color={theme.colors.textSecondary}>
              {loading ? 'Loading active loans...' : 'No active loans match your search.'}
            </Typography>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingTop: 16,
    paddingBottom: 16,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
  },
  searchInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  listContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  loanCard: {
    padding: theme.spacing.md,
    borderRadius: 12,
  },
  overdueCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeActive: {
    backgroundColor: theme.colors.surfaceTint,
  },
  badgeOverdue: {
    backgroundColor: theme.colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.outlineVariant,
    marginVertical: 10,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  empty: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
});
