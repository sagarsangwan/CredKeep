import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { Borrower } from '../../core/database/borrowerRepository';
import { Paise, toPaise, formatINR } from '../../core/domain/money';
import {
  generateSchedule,
  calculateContractInterest,
  calculateMaturityDate,
} from '../../core/domain/schedule';

interface AttachmentDraft {
  uri: string;
  docType: string;
  notes?: string;
}

export default function LoansScreen() {
  const router = useRouter();
  const { borrowerId, openWizard } = useLocalSearchParams();
  const { loans, borrowers, refreshVersion, triggerRefresh } = useDatabase();

  const [data, setData] = useState<Loan[]>([]);
  const [borrowersList, setBorrowersList] = useState<Borrower[]>([]);
  const [error, setError] = useState<string | null>(null);

  // New Loan Wizard State
  const [isModalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Borrower & Product
  const [selectedBorrowerId, setSelectedBorrowerId] = useState('');
  const [productType, setProductType] = useState<'instalment' | 'bullet'>('instalment');
  const [showAddBorrowerModal, setShowAddBorrowerModal] = useState(false);
  const [newBorrowerName, setNewBorrowerName] = useState('');
  const [newBorrowerPhone, setNewBorrowerPhone] = useState('');

  // Step 2: Terms & Live Calculations
  const [principalInr, setPrincipalInr] = useState('50000');
  const [annualRatePercent, setAnnualRatePercent] = useState('24');
  const [termMonths, setTermMonths] = useState('10');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDay, setDueDay] = useState('5');

  // Step 3: Security & Documents
  const [collateral, setCollateral] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [selectedDocType, setSelectedDocType] = useState('Security cheque');
  const [attachmentNote, setAttachmentNote] = useState('');

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
    loadData();
  }, [loadData, refreshVersion]);

  useEffect(() => {
    if (openWizard === 'true' && borrowerId && borrowersList.length > 0) {
      setTimeout(() => {
        setModalVisible(true);
        setSelectedBorrowerId(borrowerId as string);
        setStep(2);
        router.setParams({ openWizard: '', borrowerId: '' });
      }, 0);
    }
  }, [openWizard, borrowerId, borrowersList, router]);

  const filteredBorrowers = useMemo(() => {
    if (!searchQuery.trim()) return borrowersList;
    const lower = searchQuery.toLowerCase().trim();
    return borrowersList.filter(
      b => b.name.toLowerCase().includes(lower) || b.phone.includes(lower)
    );
  }, [borrowersList, searchQuery]);

  const getBorrowerName = (id: string) => {
    return borrowersList.find(b => b.id === id)?.name || 'Unknown Borrower';
  };

  // Live calculation metrics
  const liveCalculation = useMemo(() => {
    const pInr = parseInt(principalInr, 10) || 0;
    const rate = parseFloat(annualRatePercent) || 0;
    const months = parseInt(termMonths, 10) || 1;
    const dDay = parseInt(dueDay, 10) || 5;

    const principalPaise = toPaise(pInr);
    const contractInterestPaise = calculateContractInterest(principalPaise, rate, months);
    const totalRepaymentPaise = (principalPaise + contractInterestPaise) as Paise;

    const monthlyKistPaise = Math.round(totalRepaymentPaise / months);
    const maturityDate = calculateMaturityDate(startDate, months, dDay);

    return {
      principalPaise,
      contractInterestPaise,
      totalRepaymentPaise,
      monthlyKistPaise,
      maturityDate,
    };
  }, [principalInr, annualRatePercent, termMonths, startDate, dueDay]);

  // Preview schedule for Step 4
  const previewSchedule = useMemo(() => {
    if (step !== 4 || productType === 'bullet') return [];
    try {
      return generateSchedule({
        principal: liveCalculation.principalPaise,
        annualRate: parseFloat(annualRatePercent) || 0,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: parseInt(termMonths, 10) || 1,
        startDate,
        dueDay: parseInt(dueDay, 10) || 5,
        productType: 'instalment',
      });
    } catch {
      return [];
    }
  }, [step, productType, liveCalculation.principalPaise, annualRatePercent, termMonths, startDate, dueDay]);

  // Inline Borrower Creation
  const handleCreateBorrowerInline = async () => {
    if (!newBorrowerName.trim() || !newBorrowerPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter borrower name and phone.');
      return;
    }
    try {
      const b = await borrowers!.create(newBorrowerName.trim(), newBorrowerPhone.trim());
      setBorrowersList(prev => [b, ...prev]);
      setSelectedBorrowerId(b.id);
      setShowAddBorrowerModal(false);
      setNewBorrowerName('');
      setNewBorrowerPhone('');
      triggerRefresh();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create borrower');
    }
  };

  // Document capture handlers
  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Camera access is required to take photos of documents.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      await savePersistentAttachment(result.assets[0].uri);
    }
  };

  const handlePickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      await savePersistentAttachment(result.assets[0].uri);
    }
  };

  const savePersistentAttachment = async (pickerUri: string) => {
    try {
      const filename = `doc_${Date.now()}_${Math.random().toString(36).substring(2)}.jpg`;
      const baseDir = FileSystem.documentDirectory || '';
      const targetDir = `${baseDir}attachments/`;
      const dirInfo = await FileSystem.getInfoAsync(targetDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
      }
      const destPath = `${targetDir}${filename}`;
      await FileSystem.copyAsync({ from: pickerUri, to: destPath });
      setAttachments(prev => [
        ...prev,
        {
          uri: destPath,
          docType: selectedDocType,
          notes: attachmentNote.trim() || undefined,
        },
      ]);
      setAttachmentNote('');
    } catch {
      // Fallback
      setAttachments(prev => [
        ...prev,
        {
          uri: pickerUri,
          docType: selectedDocType,
          notes: attachmentNote.trim() || undefined,
        },
      ]);
      setAttachmentNote('');
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // High-value security enforcement: > ₹30,000 requires 2 blank security cheques + collateral description
  const isHighValue = (parseInt(principalInr, 10) || 0) > 30000;
  const securityChequesCount = attachments.filter(a => a.docType === 'Security cheque').length;
  const hasCollateralDescription = collateral.trim().length > 0;
  const satisfiesSecurityRule = !isHighValue || (securityChequesCount >= 2 && hasCollateralDescription);

  // Form Reset
  const resetForm = () => {
    setStep(1);
    setSelectedBorrowerId('');
    setProductType('instalment');
    setPrincipalInr('50000');
    setAnnualRatePercent('24');
    setTermMonths('10');
    setStartDate(new Date().toISOString().split('T')[0]);
    setDueDay('5');
    setCollateral('');
    setAttachments([]);
    setSearchQuery('');
    setIsSubmitting(false);
  };

  // Final submission
  const handleCreate = async () => {
    if (!selectedBorrowerId || !loans) return;
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const principalPaise = liveCalculation.principalPaise;
      const rate = parseFloat(annualRatePercent);
      const months = parseInt(termMonths, 10);
      const dDay = parseInt(dueDay, 10);

      const createdLoan = await loans.createLoanWithSchedule(selectedBorrowerId, {
        principal: principalPaise,
        annualRate: rate,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: months,
        startDate,
        dueDay: dDay,
        productType,
        collateral: collateral.trim() || undefined,
      });

      // Save attachments
      for (const att of attachments) {
        await loans.addAttachment({
          loan_id: createdLoan.id,
          file_path: att.uri,
          doc_type: att.docType,
          notes: att.notes,
        });
      }

      setModalVisible(false);
      resetForm();
      triggerRefresh();
      Alert.alert(
        'Loan Disbursed',
        `Successfully created ${productType === 'bullet' ? 'One-Time Repayment' : 'Monthly Kist'} loan for ${getBorrowerName(selectedBorrowerId)}!`
      );
    } catch (e: any) {
      Alert.alert('Creation Failed', e.message || 'An error occurred during loan creation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Borrower & Product
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Typography variant="headlineMd" style={styles.modalTitle}>
        Step 1: Borrower & Product
      </Typography>

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, { flex: 1, marginRight: 8 }]}
          placeholder="Search borrower by name or phone..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Button
          title="+ Add"
          variant="outline"
          onPress={() => setShowAddBorrowerModal(true)}
          style={{ height: 44, paddingHorizontal: 12 }}
        />
      </View>

      <FlatList
        style={styles.borrowerList}
        data={filteredBorrowers}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.borrowerCard,
              selectedBorrowerId === item.id && styles.borrowerCardSelected,
            ]}
            onPress={() => setSelectedBorrowerId(item.id)}
          >
            <Typography variant="headlineSm">{item.name}</Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary}>
              {item.phone}
            </Typography>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Typography variant="bodyMd" color={theme.colors.textSecondary}>
              No borrower found. Tap "+ Add" to create.
            </Typography>
          </View>
        }
      />

      <Typography variant="labelLg" style={{ marginTop: theme.spacing.md, marginBottom: 8 }}>
        Select Lending Product
      </Typography>

      {/* Two Visually Distinct Product Cards */}
      <View style={styles.productCardsContainer}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.productChoiceCard,
            productType === 'instalment' && styles.productChoiceCardSelected,
          ]}
          onPress={() => {
            setProductType('instalment');
            setPrincipalInr('50000');
            setAnnualRatePercent('24');
            setTermMonths('10');
          }}
        >
          <View style={styles.choiceCardHeader}>
            <Typography variant="headlineSm" color={productType === 'instalment' ? theme.colors.primary : theme.colors.textPrimary}>
              Monthly Kist
            </Typography>
            {productType === 'instalment' && (
              <View style={styles.selectedDot} />
            )}
          </View>
          <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 4 }}>
            Fixed monthly installments. Simple flat interest spread evenly across every month.
          </Typography>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.productChoiceCard,
            productType === 'bullet' && styles.productChoiceCardSelected,
          ]}
          onPress={() => {
            setProductType('bullet');
            setPrincipalInr('10000');
            setAnnualRatePercent('30');
            setTermMonths('3');
          }}
        >
          <View style={styles.choiceCardHeader}>
            <Typography variant="headlineSm" color={productType === 'bullet' ? theme.colors.primary : theme.colors.textPrimary}>
              One-Time Repayment
            </Typography>
            {productType === 'bullet' && (
              <View style={styles.selectedDot} />
            )}
          </View>
          <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 4 }}>
            Single maturity obligation. Principal and contracted interest due together at maturity. NO monthly kists.
          </Typography>
        </TouchableOpacity>
      </View>

      <Button
        title="Next: Terms & Calculations"
        onPress={() => setStep(2)}
        disabled={!selectedBorrowerId}
        style={styles.nextBtn}
      />
    </View>
  );

  // Step 2: Terms & Live Calculations
  const renderStep2 = () => (
    <ScrollView style={styles.stepContainer}>
      <Typography variant="headlineMd" style={styles.modalTitle}>
        Step 2: Terms & Live Calculations
      </Typography>

      <Typography variant="labelMd" style={styles.inputLabel}>Principal Amount (₹)</Typography>
      <TextInput
        style={styles.formInput}
        keyboardType="numeric"
        placeholder="e.g. 50000"
        value={principalInr}
        onChangeText={setPrincipalInr}
      />

      <Typography variant="labelMd" style={styles.inputLabel}>Annual Interest Rate (% p.a.)</Typography>
      <TextInput
        style={styles.formInput}
        keyboardType="numeric"
        placeholder="e.g. 24"
        value={annualRatePercent}
        onChangeText={setAnnualRatePercent}
      />

      <Typography variant="labelMd" style={styles.inputLabel}>Tenure / Duration (Months)</Typography>
      <TextInput
        style={styles.formInput}
        keyboardType="numeric"
        placeholder="e.g. 10"
        value={termMonths}
        onChangeText={setTermMonths}
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Typography variant="labelMd" style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Typography>
          <TextInput
            style={styles.formInput}
            value={startDate}
            onChangeText={setStartDate}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Typography variant="labelMd" style={styles.inputLabel}>Due Day of Month (1-31)</Typography>
          <TextInput
            style={styles.formInput}
            keyboardType="numeric"
            value={dueDay}
            onChangeText={setDueDay}
          />
        </View>
      </View>

      {/* Live Calculation Preview Card */}
      <Card elevated style={styles.liveCalcCard}>
        <Typography variant="labelLg" color={theme.colors.primary} style={{ marginBottom: 6 }}>
          Live Financial Preview ({productType === 'bullet' ? 'One-Time Repayment' : 'Monthly Kist'})
        </Typography>

        <View style={styles.metricRow}>
          <Typography variant="bodySm">Principal:</Typography>
          <Typography variant="labelMd">{formatINR(liveCalculation.principalPaise)}</Typography>
        </View>
        <View style={styles.metricRow}>
          <Typography variant="bodySm">Contracted Interest ({annualRatePercent}% p.a.):</Typography>
          <Typography variant="labelMd">{formatINR(liveCalculation.contractInterestPaise)}</Typography>
        </View>
        <View style={styles.metricRow}>
          <Typography variant="bodySm">Total Contractual Amount:</Typography>
          <Typography variant="labelLg" color={theme.colors.primary}>
            {formatINR(liveCalculation.totalRepaymentPaise)}
          </Typography>
        </View>

        <View style={styles.heroDivider} />

        {productType === 'instalment' ? (
          <View style={styles.metricRow}>
            <Typography variant="headlineSm" color={theme.colors.secondary}>
              Monthly Kist:
            </Typography>
            <Typography variant="headlineSm" color={theme.colors.secondary}>
              {formatINR(liveCalculation.monthlyKistPaise as Paise)} / mo ({termMonths} kists)
            </Typography>
          </View>
        ) : (
          <View style={styles.metricRow}>
            <Typography variant="headlineSm" color={theme.colors.secondary}>
              Single Maturity Due:
            </Typography>
            <Typography variant="headlineSm" color={theme.colors.secondary}>
              {formatINR(liveCalculation.totalRepaymentPaise)} on {liveCalculation.maturityDate}
            </Typography>
          </View>
        )}
      </Card>

      <View style={[styles.row, { marginTop: theme.spacing.lg, marginBottom: 40 }]}>
        <Button
          title="Back"
          variant="outline"
          onPress={() => setStep(1)}
          style={{ flex: 1, marginRight: 8 }}
        />
        <Button
          title="Next: Security"
          onPress={() => {
            if ((parseInt(principalInr, 10) || 0) <= 0) {
              Alert.alert('Invalid Principal', 'Please enter a valid principal amount.');
              return;
            }
            setStep(3);
          }}
          style={{ flex: 1 }}
        />
      </View>
    </ScrollView>
  );

  // Step 3: Security & Documents
  const renderStep3 = () => (
    <ScrollView style={styles.stepContainer}>
      <Typography variant="headlineMd" style={styles.modalTitle}>
        Step 3: Security & Documents
      </Typography>

      {/* High-Value Security Alert */}
      {isHighValue && (
        <Card style={styles.securityWarningCard}>
          <Typography variant="labelMd" color={theme.colors.error}>
            🛡️ Security Requirement (Disbursed &gt; ₹30,000)
          </Typography>
          <Typography variant="bodySm" color={theme.colors.error} style={{ marginTop: 2 }}>
            Requires at least 2 blank security cheques and collateral description before disbursement.
          </Typography>
          <Typography variant="labelSm" color={satisfiesSecurityRule ? theme.colors.success : theme.colors.error} style={{ marginTop: 4 }}>
            Status: {securityChequesCount} / 2 cheques attached • Collateral: {hasCollateralDescription ? 'Provided' : 'Missing'}
          </Typography>
        </Card>
      )}

      <Typography variant="labelMd" style={styles.inputLabel}>
        Collateral Description / Security Notes:
      </Typography>
      <TextInput
        style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
        multiline
        placeholder="e.g. Hero Splendor Plus (DL 5S AB 1234) RC book deposited"
        value={collateral}
        onChangeText={setCollateral}
      />

      <Typography variant="labelMd" style={[styles.inputLabel, { marginTop: 12 }]}>
        Attach Document Photos:
      </Typography>

      <View style={styles.docTypeRow}>
        {['Security cheque', 'Affidavit / stamp paper', 'Collateral', 'Other'].map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.docTypeChip, selectedDocType === type && styles.docTypeChipActive]}
            onPress={() => setSelectedDocType(type)}
          >
            <Typography variant="labelSm" color={selectedDocType === type ? '#fff' : theme.colors.primary}>
              {type}
            </Typography>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
        <Button
          title="📷 Take Photo"
          variant="outline"
          onPress={handleTakePhoto}
          style={{ flex: 1 }}
        />
        <Button
          title="🖼️ Gallery"
          variant="outline"
          onPress={handlePickFromGallery}
          style={{ flex: 1 }}
        />
      </View>

      {/* Thumbnails of attached documents */}
      {attachments.length > 0 && (
        <View style={styles.attachmentsList}>
          <Typography variant="labelMd" style={{ marginBottom: 8 }}>
            Attached Documents ({attachments.length}):
          </Typography>
          {attachments.map((att, idx) => (
            <View key={idx} style={styles.attachmentItem}>
              <Image source={{ uri: att.uri }} style={styles.thumbnail} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Typography variant="labelMd">{att.docType}</Typography>
                {att.notes ? (
                  <Typography variant="bodySm" color={theme.colors.textSecondary}>{att.notes}</Typography>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveAttachment(idx)}
                style={styles.removeBtn}
              >
                <Typography variant="labelSm" color={theme.colors.error}>Remove</Typography>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.row, { marginTop: theme.spacing.xl, marginBottom: 40 }]}>
        <Button
          title="Back"
          variant="outline"
          onPress={() => setStep(2)}
          style={{ flex: 1, marginRight: 8 }}
        />
        <Button
          title="Next: Review"
          onPress={() => {
            if (isHighValue && !satisfiesSecurityRule) {
              Alert.alert(
                'Security Check Required',
                'Loans exceeding ₹30,000 require at least two blank security cheques and a collateral description.'
              );
              return;
            }
            setStep(4);
          }}
          style={{ flex: 1 }}
        />
      </View>
    </ScrollView>
  );

  // Step 4: Review & Confirm
  const renderStep4 = () => (
    <ScrollView style={styles.stepContainer}>
      <Typography variant="headlineMd" style={styles.modalTitle}>
        Step 4: Review & Confirm
      </Typography>

      <Card elevated style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <Typography variant="headlineSm">{getBorrowerName(selectedBorrowerId)}</Typography>
          <View style={styles.productBadge}>
            <Typography variant="labelSm" color="#fff">
              {productType === 'bullet' ? 'One-Time Repayment' : 'Monthly Kist'}
            </Typography>
          </View>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.metricRow}>
          <Typography variant="bodySm">Principal Disbursed:</Typography>
          <Typography variant="labelLg">{formatINR(liveCalculation.principalPaise)}</Typography>
        </View>

        <View style={styles.metricRow}>
          <Typography variant="bodySm">Interest Rate & Basis:</Typography>
          <Typography variant="bodyMd">{annualRatePercent}% p.a. (Annual Simple Flat)</Typography>
        </View>

        <View style={styles.metricRow}>
          <Typography variant="bodySm">Duration:</Typography>
          <Typography variant="bodyMd">{termMonths} Months</Typography>
        </View>

        <View style={styles.metricRow}>
          <Typography variant="bodySm">Total Contractual Amount:</Typography>
          <Typography variant="labelLg" color={theme.colors.primary}>
            {formatINR(liveCalculation.totalRepaymentPaise)}
          </Typography>
        </View>

        {productType === 'instalment' ? (
          <View style={styles.metricRow}>
            <Typography variant="bodySm">Monthly Installment:</Typography>
            <Typography variant="labelMd" color={theme.colors.secondary}>
              {formatINR(liveCalculation.monthlyKistPaise as Paise)} / month
            </Typography>
          </View>
        ) : (
          <View style={styles.metricRow}>
            <Typography variant="bodySm">Single Maturity Obligation:</Typography>
            <Typography variant="labelMd" color={theme.colors.secondary}>
              {formatINR(liveCalculation.totalRepaymentPaise)} due on {liveCalculation.maturityDate}
            </Typography>
          </View>
        )}

        {collateral.trim() ? (
          <View style={{ marginTop: 8 }}>
            <Typography variant="bodySm" color={theme.colors.textSecondary}>Collateral Notes:</Typography>
            <Typography variant="bodySm">{collateral}</Typography>
          </View>
        ) : null}

        {attachments.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <Typography variant="bodySm" color={theme.colors.textSecondary}>
              Attached Security Documents: {attachments.length} files
            </Typography>
          </View>
        )}
      </Card>

      {/* Monthly Kist Schedule preview */}
      {productType === 'instalment' && previewSchedule.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Typography variant="labelLg" style={{ marginBottom: 8 }}>
            Repayment Schedule ({previewSchedule.length} Months):
          </Typography>
          {previewSchedule.map((kist, idx) => (
            <View key={idx} style={styles.scheduleRow}>
              <Typography variant="bodySm">
                Kist #{kist.kistNumber} • {kist.dueDate}
              </Typography>
              <Typography variant="labelMd">{formatINR(kist.amountDue)}</Typography>
            </View>
          ))}
        </View>
      )}

      {/* One-Time Repayment Single Maturity Note */}
      {productType === 'bullet' && (
        <Card style={[styles.previewBox, { marginTop: 16 }]}>
          <Typography variant="labelMd" color={theme.colors.primary}>
            📌 Single Maturity Contract:
          </Typography>
          <Typography variant="bodySm" style={{ marginTop: 2 }}>
            No monthly kists are generated. Full principal ({formatINR(liveCalculation.principalPaise)}) and contracted interest ({formatINR(liveCalculation.contractInterestPaise)}) are due together on {liveCalculation.maturityDate}.
          </Typography>
        </Card>
      )}

      <View style={[styles.row, { marginTop: theme.spacing.xl, marginBottom: 40 }]}>
        <Button
          title="Back"
          variant="outline"
          onPress={() => setStep(3)}
          style={{ flex: 1, marginRight: 8 }}
          disabled={isSubmitting}
        />
        <Button
          title={isSubmitting ? 'Disbursing...' : 'Confirm & Disburse'}
          onPress={handleCreate}
          style={{ flex: 1 }}
          disabled={isSubmitting}
        />
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Typography variant="headlineMd" color={theme.colors.onPrimary}>
          Loans
        </Typography>
        <Button
          title="+ New Loan"
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
          style={styles.headerBtn}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isItemBullet = item.product_type === 'bullet';
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push(`/loan/${item.id}`)}
            >
              <Card elevated style={styles.card}>
                <View style={styles.cardHeader}>
                  <Typography variant="headlineSm">{getBorrowerName(item.borrower_id)}</Typography>
                  <View style={[styles.badge, item.status === 'ACTIVE' ? styles.badgeActive : styles.badgeSettled]}>
                    <Typography variant="labelSm" color={item.status === 'ACTIVE' ? '#fff' : theme.colors.primary}>
                      {item.status}
                    </Typography>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Typography variant="bodySm" color={theme.colors.textSecondary}>Product</Typography>
                    <Typography variant="labelMd">{isItemBullet ? 'One-Time Repayment' : 'Monthly Kist'}</Typography>
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Typography variant="bodySm" color={theme.colors.textSecondary}>Principal</Typography>
                    <Typography variant="labelLg">{formatINR(item.principal_paise as Paise)}</Typography>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            {error ? (
              <Typography variant="bodyLg" color={theme.colors.error}>{error}</Typography>
            ) : (
              <Typography variant="bodyLg" color={theme.colors.textSecondary}>No loans found</Typography>
            )}
          </View>
        )}
      />

      {/* New Loan Wizard Modal */}
      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Typography color={theme.colors.primary}>Cancel</Typography>
                </TouchableOpacity>
                <Typography variant="labelLg">New Loan - Step {step}/4</Typography>
                <View style={{ width: 40 }} />
              </View>

              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
            </KeyboardAvoidingView>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>

      {/* Inline Add Borrower Modal */}
      <Modal visible={showAddBorrowerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.addBorrowerContent}>
            <Typography variant="headlineSm" style={{ marginBottom: 12 }}>
              Add New Borrower
            </Typography>
            <TextInput
              style={styles.formInput}
              placeholder="Borrower Full Name"
              value={newBorrowerName}
              onChangeText={setNewBorrowerName}
            />
            <TextInput
              style={[styles.formInput, { marginTop: 8 }]}
              placeholder="Phone Number (e.g. 9876543210)"
              keyboardType="phone-pad"
              value={newBorrowerPhone}
              onChangeText={setNewBorrowerPhone}
            />
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowAddBorrowerModal(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Create & Select"
                onPress={handleCreateBorrowerInline}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingTop: 16,
  },
  headerBtn: {
    backgroundColor: theme.colors.secondary,
    borderRadius: 8,
  },
  list: { padding: theme.spacing.md, gap: theme.spacing.md },
  card: { padding: theme.spacing.md, borderRadius: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeActive: { backgroundColor: theme.colors.secondary },
  badgeSettled: { backgroundColor: theme.colors.surfaceTint },
  divider: { height: 1, backgroundColor: theme.colors.outlineVariant, marginVertical: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  empty: { padding: theme.spacing.xl, alignItems: 'center' },

  // Wizard Styles
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
  },
  stepContainer: { flex: 1, padding: theme.spacing.lg },
  modalTitle: { marginBottom: theme.spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  borrowerList: {
    maxHeight: 180,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    borderRadius: 8,
  },
  borrowerCard: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
  },
  borrowerCardSelected: {
    backgroundColor: theme.colors.successContainer,
  },
  productCardsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  productChoiceCard: {
    borderWidth: 1.5,
    borderColor: theme.colors.outlineVariant,
    borderRadius: 12,
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  productChoiceCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceTint + '15',
  },
  choiceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  nextBtn: { marginTop: 'auto', marginBottom: 30 },
  row: { flexDirection: 'row' },
  inputLabel: { marginBottom: 4, marginTop: 8 },
  formInput: {
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  liveCalcCard: {
    marginTop: 16,
    padding: 14,
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  heroDivider: {
    height: 1,
    backgroundColor: theme.colors.outlineVariant,
    marginVertical: 8,
  },
  securityWarningCard: {
    backgroundColor: theme.colors.errorContainer,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  docTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  docTypeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: 6,
  },
  docTypeChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  attachmentsList: {
    marginTop: 14,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    borderRadius: 8,
    marginBottom: 8,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#ccc',
  },
  removeBtn: {
    padding: 8,
  },
  reviewCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
  },
  previewBox: {
    padding: 12,
    backgroundColor: theme.colors.surfaceContainerLow,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  addBorrowerContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: theme.spacing.lg,
  },
});
