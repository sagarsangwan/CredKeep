import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { AuthStore, UserInfo } from '../../core/auth/authStore';
import { AuthService } from '../../core/auth/authService';
import { SyncService } from '../../core/sync/syncService';
import { OutboxManager } from '../../core/sync/outbox';

export default function MoreScreen() {
  const router = useRouter();
  const { db, triggerRefresh } = useDatabase();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [needsReviewCount, setNeedsReviewCount] = useState(0);

  const loadAuthAndSyncState = useCallback(async () => {
    const userInfo = await AuthStore.getUserInfo();
    const tName = await AuthStore.getTenantName();
    setUser(userInfo);
    setTenantName(tName);

    if (db) {
      const syncMeta = await OutboxManager.getMeta(db, 'last_synced_at');
      if (syncMeta) {
        const d = new Date(syncMeta);
        setLastSyncTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
      const reviewItems = await OutboxManager.getNeedsReview(db);
      setNeedsReviewCount(reviewItems.length);
    }
  }, [db]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAuthAndSyncState();
  }, [loadAuthAndSyncState]);

  const promptResolveConflicts = (count: number) => {
    if (!db) return;
    Alert.alert(
      'Conflicts Require Review',
      `${count} operation(s) require review due to server conflicts (e.g. actions on settled loans). Would you like to discard them?`,
      [
        { text: 'Review Later', style: 'cancel' },
        {
          text: 'Discard Conflicts',
          style: 'destructive',
          onPress: async () => {
            const items = await OutboxManager.getNeedsReview(db);
            for (const item of items) {
              await OutboxManager.resolveNeedsReview(db, item.operation_id, 'DISCARD');
            }
            Alert.alert('Resolved', 'Conflicting operations have been discarded.');
            await loadAuthAndSyncState();
          },
        },
      ]
    );
  };

  const handleSyncNow = async () => {
    if (!db) return;
    const token = await AuthStore.getToken();
    if (!token) {
      Alert.alert(
        'Cloud Login Required',
        'Please log in to your CredKeep account before syncing with the cloud.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }

    try {
      setIsSyncing(true);
      const res = await SyncService.syncAll(db);
      if (res.success) {
        triggerRefresh();
        await loadAuthAndSyncState();
        Alert.alert(
          'Sync Complete',
          `Successfully pushed ${res.pushedCount} operations and pulled ${res.pulledCount} server updates.`
        );
      } else if (res.needsReviewCount && res.needsReviewCount > 0) {
        triggerRefresh();
        await loadAuthAndSyncState();
        promptResolveConflicts(res.needsReviewCount);
      } else {
        Alert.alert('Sync Incomplete', res.errors?.[0] || 'Sync completed with warnings.');
      }
    } catch (err: any) {
      Alert.alert('Sync Error', err?.message || 'Network connection failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of cloud sync?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await AuthService.logout();
          setUser(null);
          setTenantName(null);
        },
      },
    ]);
  };

  const menuItems = [
    { title: 'Earnings & Reports', route: '/reports' },
    { title: 'App Security (PIN Lock)', route: '/settings/security' },
    { title: 'Backup & Restore', route: '/settings/backup' },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
          More & Settings
        </Typography>

        {/* Cloud Sync & Account Status Card */}
        <Card style={styles.syncCard}>
          <View style={styles.syncHeader}>
            <View>
              <Typography variant="titleMd" color={theme.colors.textPrimary}>
                {user ? `Workspace: ${tenantName || 'Active'}` : 'Offline Mode (Local Only)'}
              </Typography>
              <Typography variant="bodySm" color={theme.colors.textSecondary}>
                {user
                  ? `Logged in as @${user.username}${lastSyncTime ? ` • Synced at ${lastSyncTime}` : ''}`
                  : 'Connect to cloud for multi-device sync and backups'}
              </Typography>
            </View>
          </View>

          <View style={styles.syncActions}>
            {user ? (
              <>
                <Button
                  title={isSyncing ? 'Syncing...' : 'Sync Now'}
                  variant="primary"
                  onPress={handleSyncNow}
                  loading={isSyncing}
                  style={styles.actionBtn}
                />
                <Button
                  title="Log Out"
                  variant="ghost"
                  onPress={handleLogout}
                  style={styles.actionBtn}
                />
              </>
            ) : (
              <Button
                title="Connect Cloud / Log In"
                variant="primary"
                onPress={() => router.push('/auth/login')}
                style={styles.actionBtn}
              />
            )}
          </View>
        </Card>

        {/* Conflict Resolution Prompt */}
        {needsReviewCount > 0 && (
          <Card style={[styles.syncCard, { borderColor: theme.colors.error, borderWidth: 1 }]}>
            <Typography variant="titleMd" color={theme.colors.error}>
              ⚠️ Action Required: {needsReviewCount} Conflict(s)
            </Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 4 }}>
              Offline updates clashed with changes from another device (e.g. actions on settled loans).
            </Typography>
            <View style={styles.syncActions}>
              <Button
                title="Resolve Conflicts"
                variant="secondary"
                onPress={() => promptResolveConflicts(needsReviewCount)}
                style={styles.actionBtn}
              />
            </View>
          </Card>
        )}

        {/* Existing Navigation Menu */}
        <View style={styles.list}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.listItem}
              onPress={() => router.push(item.route as any)}
            >
              <Typography variant="titleMd" color={theme.colors.onSurface}>
                {item.title}
              </Typography>
              <Typography variant="titleMd" color={theme.colors.onSurfaceVariant}>
                ›
              </Typography>
            </TouchableOpacity>
          ))}
        </View>

        <Typography
          variant="bodySm"
          color={theme.colors.onSurfaceVariant}
          align="center"
          style={{ marginTop: 32 }}
        >
          CredKeep V2 — Offline-First Architecture
        </Typography>
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
    padding: theme.spacing.lg,
  },
  title: {
    marginBottom: theme.spacing.lg,
  },
  syncCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.outlineVariant,
  },
  syncHeader: {
    marginBottom: theme.spacing.md,
  },
  syncActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  list: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
});
