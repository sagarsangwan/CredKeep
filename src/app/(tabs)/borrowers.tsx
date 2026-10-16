import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { useRouter } from 'expo-router';
import { Borrower } from '../../core/database/borrowerRepository';

export default function BorrowersScreen() {
  const router = useRouter();
  const { borrowers, status, error, refreshVersion, triggerRefresh, retryInitDatabase } = useDatabase();
  const [data, setData] = useState<Borrower[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const loadBorrowers = useCallback(async () => {
    if (borrowers) {
      try {
        const result = await borrowers.getAll();
        setData(result);
      } catch {
        // Suppress transient read errors
      }
    }
  }, [borrowers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBorrowers();
  }, [loadBorrowers, refreshVersion]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const query = searchQuery.trim().toLowerCase();
    return data.filter(
      (b) => b.name.toLowerCase().includes(query) || b.phone.includes(query)
    );
  }, [data, searchQuery]);

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please fill in both name and phone number');
      return;
    }

    if (!borrowers || status !== 'READY') {
      if (status === 'ERROR') {
        Alert.alert(
          'Database Error',
          `Database initialization failed: ${error?.message || 'Unknown error'}. Would you like to retry?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => retryInitDatabase() },
          ]
        );
      } else {
        Alert.alert('Database Initializing', 'Please wait for database initialization to complete.');
      }
      return;
    }

    try {
      await borrowers.create(name.trim(), phone.trim());
      setModalVisible(false);
      setName('');
      setPhone('');
      triggerRefresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save customer');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Typography variant="headlineMd" color={theme.colors.onPrimary}>
          Customers
        </Typography>
        <Button title="+ Add New" onPress={() => setModalVisible(true)} style={styles.headerBtn} />
      </View>

      <View style={styles.searchContainer}>
        <Input
          placeholder="Search by name or phone number..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/borrower/${item.id}` as any)}>
            <Card elevated style={styles.card}>
              <Typography variant="headlineSm">{item.name}</Typography>
              <Typography variant="bodyMd" color={theme.colors.textSecondary}>
                {item.phone}
              </Typography>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Typography variant="bodyLg" color={theme.colors.textSecondary}>
              {searchQuery ? 'No matching customers found' : 'No customers found'}
            </Typography>
          </View>
        )}
      />

      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Typography color={theme.colors.primary}>Cancel</Typography>
                </TouchableOpacity>
                <Typography variant="labelLg">New Customer</Typography>
                <View style={{ width: 40 }} />
              </View>
              <View style={styles.modalContainer}>
                <Typography variant="headlineMd" style={styles.modalTitle}>
                  Borrower Details
                </Typography>

                <Input
                  label="Full Name"
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChangeText={setName}
                />
                <Input
                  label="Phone Number"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />

                <Button title="Save Customer" onPress={handleAdd} style={{ marginTop: 24 }} />
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBtn: {
    backgroundColor: theme.colors.secondary,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  list: { padding: theme.spacing.lg, gap: theme.spacing.md },
  card: { padding: theme.spacing.md },
  empty: { padding: 40, alignItems: 'center' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: theme.colors.surfaceVariant,
  },
  modalContainer: { padding: theme.spacing.xl },
  modalTitle: { marginBottom: theme.spacing.xl },
});
