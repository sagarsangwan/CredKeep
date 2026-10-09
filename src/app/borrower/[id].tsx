import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Borrower } from '../../core/database/borrowerRepository';
import { Loan } from '../../core/database/loanRepository';
import { formatINR, Paise } from '../../core/domain/money';

export default function BorrowerDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { borrowers, loans, refreshVersion } = useDatabase();
  
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [borrowerLoans, setBorrowerLoans] = useState<Loan[]>([]);

  useEffect(() => {
    async function load() {
      if (borrowers && loans && id) {
        const b = await borrowers.getById(id as string);
        setBorrower(b);
        const lns = await loans.getAll();
        setBorrowerLoans(lns.filter((l: Loan) => l.borrower_id === id));
      }
    }
    load();
  }, [id, borrowers, loans, refreshVersion]);

  if (!borrower) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Typography variant="headlineMd" color={theme.colors.onPrimary}>Borrower Profile</Typography>
        </View>
        
        <Card elevated style={styles.card}>
          <Typography variant="headlineSm">{borrower.name}</Typography>
          <Typography variant="bodyMd" color={theme.colors.onSurfaceVariant}>{borrower.phone}</Typography>
        </Card>
        
        <Typography variant="titleMd" style={styles.sectionTitle}>Associated Loans</Typography>
        
        {borrowerLoans.map(loan => (
          <TouchableOpacity key={loan.id} onPress={() => router.push(`/loan/${loan.id}` as any)}>
            <Card style={styles.loanCard}>
              <Typography variant="bodyLg">{loan.product_type === 'instalment' ? 'Monthly Kist' : 'Interest Only'}</Typography>
              <Typography variant="headlineSm" color={theme.colors.primary}>{formatINR(loan.principal_paise as Paise)}</Typography>
              <Typography variant="bodySm" color={loan.status === 'ACTIVE' ? theme.colors.success : theme.colors.textSecondary}>
                {loan.status}
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
  header: { padding: theme.spacing.lg, backgroundColor: theme.colors.primary, paddingTop: 40 },
  content: { padding: theme.spacing.lg },
  card: { padding: theme.spacing.lg, marginBottom: theme.spacing.xl },
  sectionTitle: { marginBottom: theme.spacing.md },
  loanCard: { marginBottom: theme.spacing.md, padding: theme.spacing.md }
});
