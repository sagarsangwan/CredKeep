import React, { useState, useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronRight, Phone } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { EmptyState } from '../../ui/Feedback';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Borrower } from '../../core/database/borrowerRepository';

export default function BorrowersScreen() {
  const router = useRouter();
  const { borrowers, status, error, refreshVersion, triggerRefresh, retryInitDatabase } = useDatabase();
  const [data, setData] = useState<Borrower[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBorrowers = useCallback(async () => {
    if (borrowers) {
      try {
        const result = await borrowers.getAll();
        setData(result);
      } catch {
        // Suppress transient read errors
      }
    }
  }, [borrowers, refreshVersion]);

  useFocusEffect(
    useCallback(() => {
      loadBorrowers();
    }, [loadBorrowers])
  );

  const filteredData = useMemo(() => {
    let result = data;
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (b) => b.name.toLowerCase().includes(query) || b.phone.includes(query)
      );
    }
    return result;
  }, [data, searchQuery]);

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Required Fields', 'Please enter both borrower name and phone number.');
      return;
    }

    if (!borrowers || status !== 'READY') {
      if (status === 'ERROR') {
        Alert.alert(
          'Database Error',
          `Database initialization failed: ${error?.message || 'Unknown error'}. Retry?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => retryInitDatabase() },
          ]
        );
      } else {
        Alert.alert('Initializing', 'Please wait for database initialization to finish.');
      }
      return;
    }

    try {
      setSaving(true);
      await borrowers.create(name.trim(), phone.trim());
      setModalVisible(false);
      setName('');
      setPhone('');
      triggerRefresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save borrower');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
            Borrowers
          </Typography>
          <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
            {data.length} registered {data.length === 1 ? 'borrower' : 'borrowers'}
          </Typography>
        </View>
        <Button
          title="+ Add"
          onPress={() => setModalVisible(true)}
          variant="primary"
          size="small"
        />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Borrower List */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/borrower/${item.id}` as any)}
          >
            <Card style={styles.borrowerCard}>
              <View style={styles.cardLeft}>
                <View style={styles.avatar}>
                  <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
                    {getInitials(item.name)}
                  </Typography>
                </View>
                <View style={styles.nameBlock}>
                  <Typography variant="titleMd" color={theme.colors.textPrimary}>
                    {item.name}
                  </Typography>
                  <View style={styles.phoneRow}>
                    <Phone size={12} color={theme.colors.textSecondary} />
                    <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginLeft: 4 }}>
                      {item.phone}
                    </Typography>
                  </View>
                </View>
              </View>

              <ChevronRight size={18} color={theme.colors.textDisabled} />
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <EmptyState
            title={searchQuery ? 'No matching borrowers' : 'No borrowers yet'}
            description={
              searchQuery
                ? 'Try a different name or phone number'
                : 'Add your first borrower profile to start issuing loans and tracking repayments.'
            }
            actionTitle={searchQuery ? undefined : 'Add First Borrower'}
            onAction={searchQuery ? undefined : () => setModalVisible(true)}
          />
        )}
      />

      {/* Add Borrower Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Typography variant="bodyMd" color={theme.colors.textSecondary}>
                  Cancel
                </Typography>
              </TouchableOpacity>
              <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                New Borrower
              </Typography>
              <View style={{ width: 44 }} />
            </View>

            <View style={styles.modalBody}>
              <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700', marginBottom: 6 }}>
                Borrower Information
              </Typography>
              <Typography variant="bodyMd" color={theme.colors.textSecondary} style={{ marginBottom: 20 }}>
                Enter the primary contact information for this borrower.
              </Typography>

              <Input
                label="Full Legal Name *"
                placeholder="e.g. Ramesh Kumar"
                value={name}
                onChangeText={setName}
                autoFocus
              />

              <Input
                label="Mobile Phone Number *"
                placeholder="e.g. 9876543210"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <View style={{ marginTop: 24 }}>
                <Button
                  title="Save Borrower Profile"
                  onPress={handleAdd}
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
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  list: {
    padding: theme.spacing.md,
    gap: 8,
  },
  borrowerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBlock: {
    gap: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
