import React, { useState, useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronRight, Calendar } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { EmptyState } from '../../ui/Feedback';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { Borrower } from '../../core/database/borrowerRepository';
import { formatINR, Paise } from '../../core/domain/money';

export default function LoansScreen() {
  const router = useRouter();
  const { loans, borrowers, refreshVersion } = useDatabase();

  const [data, setData] = useState<Loan[]>([]);
  const [borrowersList, setBorrowersList] = useState<Borrower[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SETTLED'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (loans && borrowers) {
      try {
        const lns = await loans.getAll();
        const bws = await borrowers.getAll();
        setData(lns);
        setBorrowersList(bws);
      } catch (err) {
        console.error(err);
      }
    }
  }, [loans, borrowers, refreshVersion]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const borrowerMap = useMemo(() => {
    const map = new Map<string, Borrower>();
    for (const b of borrowersList) {
      map.set(b.id, b);
    }
    return map;
  }, [borrowersList]);

  const filteredLoans = useMemo(() => {
    return data.filter((item) => {
      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const borrower = borrowerMap.get(item.borrower_id);
        const nameMatch = borrower?.name.toLowerCase().includes(q) || false;
        const productMatch = item.product_type.toLowerCase().includes(q);
        return nameMatch || productMatch;
      }
      return true;
    });
  }, [data, statusFilter, searchQuery, borrowerMap]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
            Loans
          </Typography>
          <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
            {data.length} total • {data.filter((l) => l.status === 'ACTIVE').length} active
          </Typography>
        </View>
        <Button
          title="+ New Loan"
          onPress={() => router.push('/loan/create')}
          variant="primary"
          size="small"
        />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search by borrower name or loan type..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {(['ALL', 'ACTIVE', 'SETTLED'] as const).map((filter) => {
            const isSelected = statusFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setStatusFilter(filter)}
                activeOpacity={0.7}
              >
                <Typography
                  variant="labelSm"
                  color={isSelected ? theme.colors.actionPrimary : theme.colors.textSecondary}
                  style={{ fontWeight: isSelected ? '700' : '500' }}
                >
                  {filter === 'ALL' ? 'All Loans' : filter === 'ACTIVE' ? 'Active' : 'Settled'}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Loans List */}
      <FlatList
        data={filteredLoans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const borrower = borrowerMap.get(item.borrower_id);
          const isInstalment = item.product_type === 'instalment';

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push(`/loan/${item.id}` as any)}
            >
              <Card style={styles.loanCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.borrowerInfo}>
                    <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
                      {borrower?.name || 'Unknown Borrower'}
                    </Typography>
                    <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
                      {isInstalment ? 'Monthly Instalment (Kist)' : 'Bullet Loan'}
                    </Typography>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      item.status === 'ACTIVE'
                        ? styles.pillActive
                        : item.status === 'SETTLED'
                        ? styles.pillSettled
                        : styles.pillDefault,
                    ]}
                  >
                    <Typography
                      variant="labelSm"
                      color={
                        item.status === 'ACTIVE'
                          ? theme.colors.success
                          : item.status === 'SETTLED'
                          ? theme.colors.textSecondary
                          : theme.colors.danger
                      }
                    >
                      {item.status}
                    </Typography>
                  </View>
                </View>

                {/* Amount & Term Row */}
                <View style={styles.amountRow}>
                  <View>
                    <Typography variant="labelSm" color={theme.colors.textSecondary}>
                      PRINCIPAL
                    </Typography>
                    <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '700', marginTop: 2 }}>
                      {formatINR(item.principal_paise as Paise)}
                    </Typography>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Typography variant="labelSm" color={theme.colors.textSecondary}>
                      RATE & DURATION
                    </Typography>
                    <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
                      {item.annual_rate}% • {item.term_months} mo
                    </Typography>
                  </View>
                </View>

                {/* Footer Row */}
                <View style={styles.cardFooter}>
                  <View style={styles.dateInfo}>
                    <Calendar size={13} color={theme.colors.textDisabled} />
                    <Typography variant="bodySm" color={theme.colors.textDisabled} style={{ marginLeft: 4 }}>
                      Disbursed {item.start_date}
                    </Typography>
                  </View>
                  <ChevronRight size={16} color={theme.colors.textDisabled} />
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          <EmptyState
            title={searchQuery ? 'No matching loans' : 'No loans registered'}
            description={
              searchQuery
                ? 'Try a different borrower name or filter.'
                : 'Issue your first loan to start tracking repayment schedules.'
            }
            actionTitle={searchQuery ? undefined : '+ New Loan'}
            onAction={searchQuery ? undefined : () => router.push('/loan/create')}
          />
        )}
      />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  list: {
    padding: theme.spacing.md,
    gap: 10,
  },
  loanCard: {
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  borrowerInfo: {
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.xs,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: theme.colors.successContainer,
    borderColor: '#86EFAC',
  },
  pillSettled: {
    backgroundColor: theme.colors.surfaceSoft,
    borderColor: theme.colors.borderDefault,
  },
  pillDefault: {
    backgroundColor: theme.colors.dangerContainer,
    borderColor: '#FECACA',
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
