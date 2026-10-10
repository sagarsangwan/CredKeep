import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, Plus, CreditCard } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
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
  const { borrowers, loans, transactions, refreshVersion } = useDatabase();
  
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [borrowerLoans, setBorrowerLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<BorrowerSummary | null>(null);

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
  }, [id, borrowers, loans, transactions]);

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      await loadData();
    };
    fetch();
    return () => { mounted = false; };
  }, [loadData, refreshVersion]);

  if (!borrower) return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, styles.centered]}>
        <Typography variant="bodyLg">Loading...</Typography>
      </View>
    </SafeAreaView>
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleCall = () => {
    if (borrower.phone) {
      Linking.openURL(`tel:${borrower.phone}`).catch(() => {
        Alert.alert('Error', 'Unable to make a call');
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* Profile Card */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Typography variant="headlineMd" color={theme.colors.onPrimary}>{getInitials(borrower.name)}</Typography>
          </View>
          <View style={styles.profileInfo}>
            <Typography variant="headlineMd" color={theme.colors.onBackground}>{borrower.name}</Typography>
            <View style={styles.phoneRow}>
              <Typography variant="bodyMd" color={theme.colors.onSurfaceVariant}>{borrower.phone}</Typography>
              <TouchableOpacity onPress={handleCall} style={styles.callButton}>
                <Phone size={16} color={theme.colors.primary} />
                <Typography variant="labelMd" color={theme.colors.primary} style={{marginLeft: 4}}>Call</Typography>
              </TouchableOpacity>
            </View>
            <Typography variant="bodySm" color={theme.colors.onSurfaceVariant}>
              Customer since {new Date(borrower.created_at).toLocaleDateString()}
            </Typography>
          </View>
        </View>
        
        {/* Navy Summary Card */}
        <Card style={styles.summaryCard}>
          <Typography variant="bodyMd" color={theme.colors.onPrimaryContainer}>Total Outstanding</Typography>
          <Typography variant="rupeeDisplay" color={theme.colors.onPrimary} style={{ marginVertical: theme.spacing.sm }}>
            {summary ? formatINR(summary.totalOutstanding as Paise) : '₹0'}
          </Typography>
          
          <View style={styles.summaryBreakdownRow}>
            <View>
              <Typography variant="labelSm" color={theme.colors.onPrimaryContainer}>PRINCIPAL</Typography>
              <Typography variant="bodyMd" color={theme.colors.onPrimary}>
                {summary ? formatINR(summary.totalPrincipalRemaining as Paise) : '₹0'}
              </Typography>
            </View>
            <View>
              <Typography variant="labelSm" color={theme.colors.onPrimaryContainer}>MARKUP</Typography>
              <Typography variant="bodyMd" color={theme.colors.onPrimary}>
                {summary ? formatINR(summary.totalMarkupRemaining as Paise) : '₹0'}
              </Typography>
            </View>
            <View>
              <Typography variant="labelSm" color={theme.colors.onPrimaryContainer}>PENALTY</Typography>
              <Typography variant="bodyMd" color={theme.colors.warningContainer}>
                {summary ? formatINR(summary.totalPenaltyRemaining as Paise) : '₹0'}
              </Typography>
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.primaryAction]} 
            onPress={() => router.push({ pathname: '/collections', params: { borrowerId: borrower.id } } as any)}
          >
            <CreditCard size={20} color={theme.colors.onPrimary} />
            <Typography variant="labelLg" color={theme.colors.onPrimary} style={styles.actionText}>Record Payment</Typography>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryAction]} 
            onPress={() => router.push({ pathname: '/loans', params: { borrowerId: borrower.id, openWizard: 'true' } } as any)}
          >
            <Plus size={20} color={theme.colors.primary} />
            <Typography variant="labelLg" color={theme.colors.primary} style={styles.actionText}>New Loan</Typography>
          </TouchableOpacity>
        </View>
        
        {/* Associated Loans */}
        <Typography variant="titleMd" style={styles.sectionTitle}>
          Associated Loans ({summary?.activeLoanCount || 0} active)
        </Typography>
        
        {borrowerLoans.map(loan => (
          <TouchableOpacity key={loan.id} onPress={() => router.push(`/loan/${loan.id}` as any)}>
            <Card elevated style={styles.loanCard}>
              <View style={styles.loanCardHeader}>
                <Typography variant="labelLg" color={theme.colors.onSurfaceVariant}>
                  {loan.product_type === 'instalment' ? 'Monthly Instalment' : 'Bullet (Interest Only)'}
                </Typography>
                <View style={[styles.statusBadge, { backgroundColor: loan.status === 'ACTIVE' ? theme.colors.successContainer : theme.colors.surfaceVariant }]}>
                  <Typography variant="labelSm" color={loan.status === 'ACTIVE' ? theme.colors.success : theme.colors.onSurfaceVariant}>
                    {loan.status}
                  </Typography>
                </View>
              </View>
              <Typography variant="headlineSm" color={theme.colors.primary} style={{ marginTop: 8 }}>
                {formatINR(loan.principal_paise as Paise)}
              </Typography>
              <Typography variant="bodySm" color={theme.colors.onSurfaceVariant}>
                Start Date: {new Date(loan.start_date).toLocaleDateString()}
              </Typography>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: theme.spacing.lg },
  
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xl },
  avatar: { 
    width: 64, height: 64, borderRadius: 32, 
    backgroundColor: theme.colors.primary, 
    justifyContent: 'center', alignItems: 'center',
    marginRight: theme.spacing.md
  },
  profileInfo: { flex: 1 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  callButton: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: 8, paddingVertical: 4, 
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.md
  },
  
  summaryCard: { 
    backgroundColor: theme.colors.primary, 
    padding: theme.spacing.lg, 
    marginBottom: theme.spacing.xl 
  },
  summaryBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.md },
  
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xl },
  actionButton: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: theme.spacing.md, borderRadius: theme.borderRadius.md 
  },
  primaryAction: { backgroundColor: theme.colors.primary, marginRight: theme.spacing.sm },
  secondaryAction: { backgroundColor: theme.colors.surfaceContainerHighest, marginLeft: theme.spacing.sm },
  actionText: { marginLeft: 8 },
  
  sectionTitle: { marginBottom: theme.spacing.md },
  loanCard: { marginBottom: theme.spacing.md, padding: theme.spacing.md },
  loanCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.borderRadius.full },
});
