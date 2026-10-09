import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Borrower } from '../../core/database/borrowerRepository';

export default function BorrowersScreen() {
  const { borrowers } = useDatabase();
  const [data, setData] = useState<Borrower[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const loadBorrowers = async () => {
    if (borrowers) {
      const result = await borrowers.getAll();
      setData(result);
    }
  };

  useEffect(() => {
    loadBorrowers();
  }, [borrowers]);

  const handleAdd = async () => {
    if (!name || !phone) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    try {
      await borrowers!.create(name, phone);
      setModalVisible(false);
      setName('');
      setPhone('');
      loadBorrowers();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="headlineMd">Borrowers</Typography>
        <Button title="Add New" onPress={() => setModalVisible(true)} />
      </View>

      <FlatList
        data={data}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card elevated style={styles.card}>
            <Typography variant="headlineSm">{item.name}</Typography>
            <Typography variant="bodyMd" color={theme.colors.textSecondary}>{item.phone}</Typography>
          </Card>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Typography variant="bodyLg" color={theme.colors.textSecondary}>No borrowers found</Typography>
          </View>
        )}
      />

      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <Typography variant="headlineMd" style={styles.modalTitle}>New Borrower</Typography>
            
            <Input
              label="Name"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChangeText={setName}
            />
            <Input
              label="Phone Number"
              placeholder="e.g. 9876543210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            
            <View style={styles.modalActions}>
              <Button 
                title="Cancel" 
                variant="outline" 
                style={styles.modalButton} 
                onPress={() => setModalVisible(false)} 
              />
              <Button 
                title="Save" 
                style={styles.modalButton} 
                onPress={handleAdd} 
              />
            </View>
          </View>
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
  }
});
