import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { Button } from '../../ui/Button';

export default function BackupScreen() {
  const [loading, setLoading] = useState(false);

  const dbPath = `${FileSystem.documentDirectory}SQLite/credkeep.db`;

  const handleBackup = async () => {
    try {
      setLoading(true);
      const exists = await FileSystem.getInfoAsync(dbPath);
      if (!exists.exists) {
        Alert.alert('Error', 'Database file not found.');
        return;
      }
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(dbPath, {
        mimeType: 'application/x-sqlite3',
        dialogTitle: 'Backup CredKeep Database',
      });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Before replacing, verify it's a valid SQLite? (Just simple extension check for now)
        if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite')) {
          Alert.alert('Warning', 'File does not appear to be a SQLite database. Restore anyway?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Restore', onPress: () => performRestore(file.uri) }
          ]);
          return;
        }
        
        await performRestore(file.uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const performRestore = async (uri: string) => {
    try {
      await FileSystem.copyAsync({
        from: uri,
        to: dbPath,
      });
      Alert.alert('Success', 'Database restored successfully. Please restart the app.');
    } catch (e: any) {
      Alert.alert('Restore Failed', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
          Backup & Restore
        </Typography>
        
        <Typography variant="bodyMd" color={theme.colors.onSurfaceVariant} style={styles.description}>
          Export your SQLite database securely to your phone&apos;s storage or a cloud drive. To restore, select a previously exported .db file.
        </Typography>

        <View style={styles.actions}>
          <Button 
            title="Export Database (Backup)" 
            onPress={handleBackup} 
            disabled={loading}
          />
          <View style={{ height: 20 }} />
          <Button 
            variant="outline" 
            title="Import Database (Restore)" 
            onPress={handleRestore}
            disabled={loading}
          />
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    padding: theme.spacing.xl,
  },
  title: {
    marginBottom: theme.spacing.md,
  },
  description: {
    marginBottom: theme.spacing.xl,
  },
  actions: {
    marginTop: theme.spacing.xl,
  }
});
