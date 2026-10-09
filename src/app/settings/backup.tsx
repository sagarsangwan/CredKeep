import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { createEncryptedBackupPayload, decryptBackupPayload } from '../../core/domain/backupUtil';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { getDatabaseKey } from '../../core/database/db';

export default function BackupScreen() {
  const { db } = useDatabase();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');

  const dbPath = `${FileSystem.documentDirectory}SQLite/credkeep.db`;

  const handleBackup = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter a password to encrypt your backup.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      
      // 1. Checkpoint SQLite WAL so the .db file contains all data
      if (db) {
        await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
      }

      const exists = await FileSystem.getInfoAsync(dbPath);
      if (!exists.exists) {
        Alert.alert('Error', 'Database file not found.');
        return;
      }
      
      // 2. Read DB Key from SecureStore
      const masterKey = await getDatabaseKey();
      
      // 3. Read DB file as Base64
      const dbBase64 = await FileSystem.readAsStringAsync(dbPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 4 & 5. Create payload and encrypt
      const encrypted = createEncryptedBackupPayload(masterKey, dbBase64, password);

      // 6. Save to temp file
      const backupUri = `${FileSystem.cacheDirectory}credkeep_backup_${Date.now()}.ckb`;
      await FileSystem.writeAsStringAsync(backupUri, encrypted, {
        encoding: FileSystem.EncodingType.UTF8
      });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(backupUri, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Save CredKeep Backup',
      });
      
      setPassword('');
    } catch (e: any) {
      Alert.alert('Backup Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter the password to decrypt the backup.');
      return;
    }

    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        if (!file.name.endsWith('.ckb')) {
          Alert.alert('Warning', 'File does not appear to be a CredKeep Backup (.ckb). Restore anyway?', [
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
      // 1. Read encrypted file
      const encrypted = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8
      });

      // 2 & 3. Decrypt and Parse JSON
      const payload = decryptBackupPayload(encrypted, password);

      // 4. Write to temp DB to verify integrity
      const tempDbName = `temp_restore_${Date.now()}.db`;
      const tempDbPath = `${FileSystem.documentDirectory}SQLite/${tempDbName}`;
      
      // Ensure SQLite dir exists
      const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      }

      await FileSystem.writeAsStringAsync(tempDbPath, payload.dbBase64, {
        encoding: FileSystem.EncodingType.Base64
      });

      // 5. Verify Temp DB
      try {
        const testDb = await SQLite.openDatabaseAsync(tempDbName);
        await testDb.execAsync(`PRAGMA key = "x'${payload.key}'"; PRAGMA journal_mode = WAL;`);
        // Test query
        await testDb.getFirstAsync('SELECT count(*) FROM loans');
        await testDb.getFirstAsync('PRAGMA integrity_check');
        // If we reach here, it's valid
        // NOTE: expo-sqlite doesn't have an explicit close() in the standard API for SDK 50+, 
        // but it's fine, we will overwrite the main DB.
      } catch (e: any) {
        // Delete temp DB
        await FileSystem.deleteAsync(tempDbPath, { idempotent: true });
        throw new Error('Backup integrity check failed. The file is corrupt or incompatible.');
      }

      // 6. It's valid. Swap DBs and set key
      // Close main DB? We can't explicitly close it, but overwriting works if we restart.
      await FileSystem.copyAsync({
        from: tempDbPath,
        to: dbPath,
      });
      await FileSystem.deleteAsync(tempDbPath, { idempotent: true });

      // Update SecureStore with the imported key
      await SecureStore.setItemAsync('credkeep_db_master_key', payload.key, {
        requireAuthentication: false,
      });

      setPassword('');
      Alert.alert('Success', 'Database restored successfully. Please force-close and restart the app immediately to apply changes.');
    } catch (e: any) {
      Alert.alert('Restore Failed', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
          Backup & Restore
        </Typography>
        
        <Typography variant="bodyMd" color={theme.colors.onSurfaceVariant} style={styles.description}>
          Export your SQLite database securely. The backup will be encrypted with the password you provide. 
          To restore on a new device, you must enter the exact same password.
        </Typography>

        <Input 
          label="Encryption Password" 
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Enter a strong password"
        />

        <View style={styles.actions}>
          <Button 
            title="Export Secure Backup (.ckb)" 
            onPress={handleBackup} 
            disabled={loading}
          />
          <View style={{ height: 20 }} />
          <Button 
            variant="outline" 
            title="Restore from Backup (.ckb)" 
            onPress={handleRestore}
            disabled={loading}
          />
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />}
      </ScrollView>
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
