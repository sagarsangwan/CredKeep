import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { Borrower } from '../../core/database/borrowerRepository';
import { Paise } from '../../core/domain/money';

export default function LoansScreen() {
  const router = useRouter();
  const { loans, borrowers } = useDatabase();
  const [data, setData] = useState<Loan[]>([]);
  const [borrowersList, setBorrowersList] = useState<Borrower[]>([]);
  
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState('');
  const [principal, setPrincipal] = useState('10000');
  const [markupFactor, setMarkupFactor] = useState('0.1');
  const [termMonths, setTermMonths] = useState('6');
  const [dueDay, setDueDay] = useState('5');
  const [productType] = useState<'instalment' | 'bullet'>('instalment');
  const loadData = useCallback(async () => {
    if (loans && borrowers) {
      setData(await loans.getAll());
      setBorrowersList(await borrowers.getAll());
    }
  }, [loans, borrowers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!selectedBorrowerId || !principal || !markupFactor || !termMonths || !dueDay) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    try {
      await loans!.createLoanWithSchedule(selectedBorrowerId, {
        principal: (parseInt(principal) * 100) as Paise, // naive rupees to paise
        markupFactor: parseFloat(markupFactor),
        termMonths: parseInt(termMonths),
        startDate: new Date().toISOString().split('T')[0],
        dueDay: parseInt(dueDay),
        productType,
      });
      setModalVisible(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="headlineMd">Loans</Typography>
        <Button title="New Loan" onPress={() => setModalVisible(true)} />
      </View>

      <FlatList
        data={data}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/loan/${item.id}`)}>
            <Card elevated style={styles.card}>
              <Typography variant="headlineSm">{(item.principal_paise / 100).toFixed(2)} INR</Typography>
              <Typography variant="bodyMd" color={theme.colors.textSecondary}>Status: {item.status}</Typography>
              <Typography variant="bodyMd" color={theme.colors.textSecondary}>Borrower ID: {item.borrower_id.substring(0,8)}</Typography>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Typography variant="bodyLg" color={theme.colors.textSecondary}>No loans found</Typography>
          </View>
        )}
      />

      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView style={styles.modalContainer}>
            <Typography variant="headlineMd" style={styles.modalTitle}>New Loan</Typography>
            
            <Typography variant="labelLg" style={styles.label}>Borrower (Pick ID for now)</Typography>
            <Input
              label="Borrower ID"
              placeholder="UUID"
              value={selectedBorrowerId}
              onChangeText={setSelectedBorrowerId}
            />
            {/* Real app would use a Picker or Select component */}
            <View style={styles.borrowerHints}>
              {borrowersList.map(b => (
                <Typography key={b.id} variant="bodySm" color={theme.colors.textSecondary}>
                  {b.name} - {b.id}
                </Typography>
              ))}
            </View>
            
            <Input
              label="Principal (INR)"
              keyboardType="numeric"
              value={principal}
              onChangeText={setPrincipal}
            />
            <Input
              label="Markup Factor (e.g. 0.1 for 10%)"
              keyboardType="numeric"
              value={markupFactor}
              onChangeText={setMarkupFactor}
            />
            <Input
              label="Term (Months)"
              keyboardType="numeric"
              value={termMonths}
              onChangeText={setTermMonths}
            />
            <Input
              label="Due Day (1-31)"
              keyboardType="numeric"
              value={dueDay}
              onChangeText={setDueDay}
            />
            
            <View style={styles.modalActions}>
              <Button 
                title="Cancel" 
                variant="outline" 
                style={styles.modalButton} 
                onPress={() => setModalVisible(false)} 
              />
              <Button 
                title="Create" 
                style={styles.modalButton} 
                onPress={handleCreate} 
              />
            </View>
            <View style={{height: 100}} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  list: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  card: {
    marginBottom: theme.spacing.sm,
  },
  empty: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  modalTitle: {
    marginBottom: theme.spacing.xl,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  modalButton: {
    flex: 1,
  },
  label: {
    marginBottom: theme.spacing.xs,
  },
  borrowerHints: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: theme.borderRadius.sm,
  }
});
