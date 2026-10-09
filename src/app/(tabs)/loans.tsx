import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { Borrower } from '../../core/database/borrowerRepository';
import { Paise, toPaise, formatINR } from '../../core/domain/money';
import { generateSchedule } from '../../core/domain/schedule';

export default function LoansScreen() {
  const router = useRouter();
  const { loans, borrowers, refreshVersion, triggerRefresh } = useDatabase();
  const [data, setData] = useState<Loan[]>([]);
  const [borrowersList, setBorrowersList] = useState<Borrower[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // New Loan Wizard State
  const [isModalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [selectedBorrowerId, setSelectedBorrowerId] = useState('');
  const [productType, setProductType] = useState<'instalment' | 'bullet'>('instalment');
  const [principal, setPrincipal] = useState('10000');
  const [markupPercent, setMarkupPercent] = useState('30');
  const [termMonths, setTermMonths] = useState('6');
  const [dueDay, setDueDay] = useState('5');
  const [collateral, setCollateral] = useState('');

  const loadData = useCallback(async () => {
    if (loans && borrowers) {
      try {
        setError(null);
        setData(await loans.getAll());
        setBorrowersList(await borrowers.getAll());
      } catch (err: any) {
        setError(err.message || 'Failed to load loans');
      }
    }
  }, [loans, borrowers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData, refreshVersion]);

  const filteredBorrowers = useMemo(() => {
    if (!searchQuery) return borrowersList;
    const lower = searchQuery.toLowerCase();
    return borrowersList.filter(b => 
      b.name.toLowerCase().includes(lower) || 
      b.phone.includes(lower)
    );
  }, [borrowersList, searchQuery]);

  const previewSchedule = useMemo(() => {
    if (step === 4) {
      try {
        return generateSchedule({
          principal: toPaise(parseInt(principal) || 0),
          markupFactor: (parseFloat(markupPercent) || 0) / 100,
          termMonths: parseInt(termMonths) || 1,
          startDate: new Date().toISOString().split('T')[0],
          dueDay: parseInt(dueDay) || 1,
          productType
        });
      } catch (e) {
        return [];
      }
    }
    return [];
  }, [step, principal, markupPercent, termMonths, dueDay, productType]);

  const totalRepayment = useMemo(() => {
    const sum = previewSchedule.reduce((acc, kist) => acc + (kist.amountDue as unknown as number), 0);
    return sum as unknown as Paise;
  }, [previewSchedule]);

  const handleCreate = async () => {
    if (!selectedBorrowerId) return;
    try {
      await loans!.createLoanWithSchedule(selectedBorrowerId, {
        principal: toPaise(parseInt(principal)),
        markupFactor: parseFloat(markupPercent) / 100,
        termMonths: parseInt(termMonths),
        startDate: new Date().toISOString().split('T')[0],
        dueDay: parseInt(dueDay),
        productType,
      });
      setModalVisible(false);
      resetForm();
      triggerRefresh(); // Automatically triggers re-fetch via useEffect
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedBorrowerId('');
    setProductType('instalment');
    setPrincipal('10000');
    setMarkupPercent('30');
    setTermMonths('6');
    setDueDay('5');
    setCollateral('');
    setSearchQuery('');
  };

  const getBorrowerName = (id: string) => {
    return borrowersList.find(b => b.id === id)?.name || 'Unknown Borrower';
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Typography variant="headlineMd" style={styles.modalTitle}>Step 1: Borrower & Product</Typography>
      <Input
        label="Search Borrower"
        placeholder="Search borrowers by name or phone..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <FlatList
        style={styles.borrowerList}
        data={filteredBorrowers}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.borrowerCard, selectedBorrowerId === item.id && styles.borrowerCardSelected]}
            onPress={() => setSelectedBorrowerId(item.id)}
          >
            <Typography variant="headlineSm">{item.name}</Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary}>{item.phone}</Typography>
          </TouchableOpacity>
        )}
      />
      
      <Typography variant="labelLg" style={{marginTop: theme.spacing.lg}}>Select Product</Typography>
      <View style={styles.productToggle}>
        <TouchableOpacity 
          style={[styles.productBtn, productType === 'instalment' && styles.productBtnActive]}
          onPress={() => setProductType('instalment')}
        >
          <Typography color={productType === 'instalment' ? '#fff' : theme.colors.primary}>Upfront Markup</Typography>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.productBtn, productType === 'bullet' && styles.productBtnActive]}
          onPress={() => setProductType('bullet')}
        >
          <Typography color={productType === 'bullet' ? '#fff' : theme.colors.primary}>Monthly Bullet</Typography>
        </TouchableOpacity>
      </View>

      <Button title="Next: Terms" onPress={() => setStep(2)} disabled={!selectedBorrowerId} style={styles.nextBtn} />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Typography variant="headlineMd" style={styles.modalTitle}>Step 2: Terms & Calculation</Typography>
      <Input label="Principal (₹)" keyboardType="numeric" value={principal} onChangeText={setPrincipal} />
      <Input label="Markup Percentage (%) (e.g. 30 for 30%)" keyboardType="numeric" value={markupPercent} onChangeText={setMarkupPercent} />
      <Input label="Tenure (Months)" keyboardType="numeric" value={termMonths} onChangeText={setTermMonths} />
      <Input label="Due Day (1-31)" keyboardType="numeric" value={dueDay} onChangeText={setDueDay} />
      
      <View style={styles.row}>
        <Button title="Back" variant="outline" onPress={() => setStep(1)} style={{flex: 1, marginRight: 8}} />
        <Button title="Next: Security" onPress={() => setStep(3)} style={{flex: 1}} />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Typography variant="headlineMd" style={styles.modalTitle}>Step 3: Security & Collateral</Typography>
      <Input label="Collateral Details (Optional)" value={collateral} onChangeText={setCollateral} />
      
      <View style={styles.row}>
        <Button title="Back" variant="outline" onPress={() => setStep(2)} style={{flex: 1, marginRight: 8}} />
        <Button title="Next: Review" onPress={() => setStep(4)} style={{flex: 1}} />
      </View>
    </View>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.stepContainer}>
      <Typography variant="headlineMd" style={styles.modalTitle}>Step 4: Review & Confirm</Typography>
      <Card style={styles.reviewCard}>
        <Typography variant="headlineSm">Borrower: {getBorrowerName(selectedBorrowerId)}</Typography>
        <Typography variant="bodyMd">Product: {productType === 'instalment' ? 'Upfront Markup' : 'Monthly Bullet'}</Typography>
        <Typography variant="bodyMd">Principal: {formatINR(toPaise(parseInt(principal) || 0))}</Typography>
        <Typography variant="bodyMd">Total Repayment: {formatINR(totalRepayment)}</Typography>
      </Card>
      
      <Typography variant="labelLg" style={{marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm}}>Repayment Schedule</Typography>
      {previewSchedule.map((kist, index) => (
        <View key={index} style={styles.scheduleRow}>
          <Typography variant="bodySm">#{kist.kistNumber} - {kist.dueDate}</Typography>
          <Typography variant="labelLg">{formatINR(kist.amountDue)}</Typography>
        </View>
      ))}

      <View style={[styles.row, {marginTop: theme.spacing.xl, marginBottom: 40}]}>
        <Button title="Back" variant="outline" onPress={() => setStep(3)} style={{flex: 1, marginRight: 8}} />
        <Button title="Confirm & Disburse" onPress={handleCreate} style={{flex: 1}} />
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="headlineMd" color={theme.colors.onPrimary}>Active Loans</Typography>
        <Button title="New Loan" onPress={() => { resetForm(); setModalVisible(true); }} style={styles.headerBtn} />
      </View>

      <FlatList
        data={data}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/loan/${item.id}`)}>
            <Card elevated style={styles.card}>
              <Typography variant="headlineSm">{formatINR(item.principal_paise as unknown as Paise)}</Typography>
              <Typography variant="bodyMd" color={theme.colors.textSecondary}>Borrower: {getBorrowerName(item.borrower_id)}</Typography>
              <Typography variant="bodySm" color={item.status === 'ACTIVE' ? theme.colors.success : theme.colors.textSecondary}>
                Status: {item.status}
              </Typography>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            {error ? (
              <Typography variant="bodyLg" color={theme.colors.error}>{error}</Typography>
            ) : (
              <Typography variant="bodyLg" color={theme.colors.textSecondary}>No active loans</Typography>
            )}
          </View>
        )}
      />

      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}><Typography color={theme.colors.primary}>Cancel</Typography></TouchableOpacity>
            <Typography variant="labelLg">New Loan - Step {step}/4</Typography>
            <View style={{width: 40}} />
          </View>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: theme.spacing.lg, backgroundColor: theme.colors.primary, paddingTop: 60
  },
  headerBtn: { backgroundColor: theme.colors.secondary, borderRadius: 8 },
  list: { padding: theme.spacing.md, gap: theme.spacing.md },
  card: { marginBottom: theme.spacing.sm },
  empty: { padding: theme.spacing.xl, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.outline },
  stepContainer: { flex: 1, padding: theme.spacing.lg },
  modalTitle: { marginBottom: theme.spacing.lg },
  borrowerList: { maxHeight: 200, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.outline, borderRadius: 8 },
  borrowerCard: { padding: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.outline },
  borrowerCardSelected: { backgroundColor: theme.colors.successContainer },
  productToggle: { flexDirection: 'row', marginTop: 8, marginBottom: 20 },
  productBtn: { flex: 1, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.primary, borderRadius: 8, marginHorizontal: 4 },
  productBtnActive: { backgroundColor: theme.colors.primary },
  nextBtn: { marginTop: 'auto', marginBottom: 40 },
  row: { flexDirection: 'row', marginTop: theme.spacing.lg },
  reviewCard: { backgroundColor: theme.colors.surfaceTint, padding: 16, borderRadius: 8 },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.outline }
});
