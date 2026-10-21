import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
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
import { getDatabaseKey, getDatabaseName } from '../../core/database/db';

export default function BackupScreen() {
  const router = useRouter();
  const { db } = useDatabase();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');

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

      const dbName = await getDatabaseName();
      if (!dbName) {
        Alert.alert('Error', 'No active tenant database found.');
        return;
      }
      const dbPath = `${FileSystem.documentDirectory}SQLite/${dbName}`;

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
        encoding: FileSystem.EncodingType.UTF8,
      });

      // 7. Share
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backupUri, {
          mimeType: 'application/octet-stream',
          dialogTitle: 'Export CredKeep Backup',
          UTI: 'public.database',
        });
      } else {
        Alert.alert('Success', `Backup saved to: ${backupUri}`);
      }

      setPassword('');
    } catch (e: any) {
      Alert.alert('Backup Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter the encryption password used when this backup was created.');
      return;
    }

    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        return;
      }

      const file = res.assets[0];
      setLoading(true);

      // 1. Read file
      const encrypted = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // 2 & 3. Decrypt and Parse JSON
      const payload = decryptBackupPayload(encrypted, password);

      // 4. Write to temp DB to verify integrity
      const tempDbName = `temp_restore_${Date.now()}.db`;
      const tempDbPath = `${FileSystem.documentDirectory}SQLite/${tempDbName}`;

      const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      }

      await FileSystem.writeAsStringAsync(tempDbPath, payload.dbBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 5. Verify Temp DB
      try {
        const testDb = await SQLite.openDatabaseAsync(tempDbName);
        await testDb.execAsync(`PRAGMA key = '${payload.key}';`);
        await testDb.execAsync('PRAGMA journal_mode = WAL;');
        await testDb.getFirstAsync('SELECT count(*) FROM loans');
        await testDb.getFirstAsync('PRAGMA integrity_check');
      } catch {
        await FileSystem.deleteAsync(tempDbPath, { idempotent: true });
        throw new Error('Backup integrity check failed. The file is corrupt or incompatible.');
      }

      const dbName = await getDatabaseName();
      if (!dbName) {
        throw new Error('No active database to restore into.');
      }
      const dbPath = `${FileSystem.documentDirectory}SQLite/${dbName}`;

      await FileSystem.copyAsync({
        from: tempDbPath,
        to: dbPath,
      });

      await SecureStore.setItemAsync('credkeep_db_master_key', payload.key);
      await FileSystem.deleteAsync(tempDbPath, { idempotent: true });

      setPassword('');
      Alert.alert(
        'Success',
        'Database restored successfully. Please force-close and restart the app immediately to apply changes.'
      );
    } catch (e: any) {
      Alert.alert('Restore Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.onBackground} />
        </TouchableOpacity>
        <Typography variant="headlineSm" style={styles.topNavTitle}>
          Backup & Restore
        </Typography>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
          Secure Ledger Backup
        </Typography>

        <Typography variant="bodyMd" color={theme.colors.onSurfaceVariant} style={styles.description}>
          Export your tenant SQLite database securely. The backup will be encrypted with the password you provide.
          To restore on a new device, you must enter the exact same password.
        </Typography>

        <Input
          label="Encryption Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Enter a strong password"
          editable={false}
        />

        <View style={styles.actions}>
          <Typography variant="bodySm" color={theme.colors.error} style={{ marginBottom: 16 }}>
            Note: Portable backup is currently disabled pending a cryptographic security audit for AES key derivation
            and integrity protection.
          </Typography>
          <Button title="Export Secure Backup (.ckb)" onPress={handleBackup} disabled={true} />
          <View style={{ height: 20 }} />
          <Button
            variant="outline"
            title="Restore from Backup (.ckb)"
            onPress={handleRestore}
            disabled={true}
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
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceVariant,
    backgroundColor: theme.colors.surface,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  topNavTitle: {
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.xl,
  },
  title: {
    marginBottom: theme.spacing.md,
    fontWeight: '700',
  },
  description: {
    marginBottom: theme.spacing.xl,
    lineHeight: 22,
  },
  actions: {
    marginTop: theme.spacing.xl,
  },
});
