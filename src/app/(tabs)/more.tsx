import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Shield, Database, FileText } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { AuthStore, UserInfo } from '../../core/auth/authStore';
import { AuthService } from '../../core/auth/authService';
import { SyncCoordinator, SyncState } from '../../core/sync/syncCoordinator';
import { OutboxManager } from '../../core/sync/outbox';

export default function MoreScreen() {
  const router = useRouter();
  const { db, triggerRefresh, closeCurrentDatabase } = useDatabase();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(SyncCoordinator.getState());
  const [needsReviewCount, setNeedsReviewCount] = useState(0);

  const loadAuthAndSyncState = useCallback(async () => {
    const userInfo = await AuthStore.getUserInfo();
    const tName = await AuthStore.getTenantName();
    setUser(userInfo);
    setTenantName(tName);

    if (db) {
      const reviewItems = await OutboxManager.getNeedsReview(db).catch(() => []);
      setNeedsReviewCount(reviewItems.length);
    }
  }, [db]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAuthAndSyncState();

    const unsubscribeSync = SyncCoordinator.subscribe((state) => {
      setSyncState(state);
    });

    return () => {
      unsubscribeSync();
    };
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
            triggerRefresh();
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
      const res = await SyncCoordinator.triggerSync('manual');
      if (res && res.success) {
        triggerRefresh();
        await loadAuthAndSyncState();
        Alert.alert(
          'Sync Complete',
          `Successfully pushed ${res.pushedCount} operations and pulled ${res.pulledCount} server updates.`
        );
      } else if (res && res.needsReviewCount && res.needsReviewCount > 0) {
        triggerRefresh();
        await loadAuthAndSyncState();
        promptResolveConflicts(res.needsReviewCount);
      } else if (res && !res.success) {
        Alert.alert('Sync Incomplete', res.errors?.[0] || 'Sync completed with warnings.');
      }
    } catch (err: any) {
      Alert.alert('Sync Error', err?.message || 'Network connection failed.');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of your lender account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await AuthService.logout();
          await closeCurrentDatabase();
          SyncCoordinator.reset();
          setUser(null);
          setTenantName(null);
          router.replace('/auth');
        },
      },
    ]);
  };

  const menuItems = [
    { title: 'Earnings & Reports', route: '/reports/index', icon: FileText },
    { title: 'App Security (PIN / Biometrics)', route: '/settings/security', icon: Shield },
    { title: 'Backup & Restore', route: '/settings/backup', icon: Database },
  ];

  const getSyncStatusBadge = () => {
    switch (syncState.status) {
      case 'SYNCING':
        return { label: 'Syncing...', color: theme.colors.primary, bg: theme.colors.primaryContainer };
      case 'PENDING':
        return {
          label: `${syncState.pendingCount} Pending Sync`,
          color: theme.colors.warning,
          bg: theme.colors.warningContainer,
        };
      case 'OFFLINE':
        return { label: 'Offline Mode', color: theme.colors.error, bg: theme.colors.errorContainer };
      case 'ERROR':
        return { label: 'Sync Error', color: theme.colors.error, bg: theme.colors.errorContainer };
      case 'IDLE':
      default:
        return { label: 'Up to Date', color: theme.colors.success, bg: theme.colors.successContainer };
    }
  };

  const badge = getSyncStatusBadge();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
          More & Settings
        </Typography>

        {/* Cloud Sync & Account Status Card */}
        <Card style={styles.syncCard}>
          <View style={styles.syncHeader}>
            <View style={{ flex: 1 }}>
              <Typography variant="titleMd" color={theme.colors.textPrimary}>
                {user ? `Workspace: ${tenantName || 'Private'}` : 'Not Signed In'}
              </Typography>
              <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
                {user ? `Logged in as @${user.username}` : 'Sign in to access your ledger'}
              </Typography>
            </View>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Typography variant="labelSm" color={badge.color}>
                {badge.label}
              </Typography>
            </View>
          </View>

          {syncState.lastSyncedAt && (
            <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 8 }}>
              Last Synced: {new Date(syncState.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          )}

          {syncState.errorMessage && (
            <Typography variant="bodySm" color={theme.colors.error} style={{ marginTop: 4 }}>
              {syncState.errorMessage}
            </Typography>
          )}

          <View style={styles.syncActions}>
            <Button
              title={syncState.status === 'SYNCING' ? 'Syncing...' : 'Sync Now'}
              variant="primary"
              onPress={handleSyncNow}
              loading={syncState.status === 'SYNCING'}
              style={styles.actionBtn}
            />
            <Button
              title="Log Out"
              variant="outline"
              onPress={handleLogout}
              style={[styles.actionBtn, { borderColor: theme.colors.error }]}
            />
          </View>
        </Card>

        {/* Conflict Resolution Prompt */}
        {needsReviewCount > 0 && (
          <Card style={[styles.syncCard, { borderColor: theme.colors.error, borderWidth: 1 }]}>
            <Typography variant="titleMd" color={theme.colors.error}>
              ⚠️ Action Required: {needsReviewCount} Conflict(s)
            </Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 4 }}>
              Offline updates clashed with changes from another device.
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

        {/* Navigation Menu */}
        <View style={styles.menuContainer}>
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <TouchableOpacity
                key={item.title}
                style={styles.menuItem}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                <View style={styles.menuLeft}>
                  <IconComponent size={20} color={theme.colors.primary} />
                  <Typography variant="headlineSm" color={theme.colors.textPrimary} style={styles.menuText}>
                    {item.title}
                  </Typography>
                </View>
                <ChevronRight size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Typography variant="bodySm" color={theme.colors.textSecondary}>
            CredKeep V2 • Build 2
          </Typography>
          <Typography variant="labelSm" color={theme.colors.outline} style={{ marginTop: 2 }}>
            Encrypted SQLite • SQLCipher 256-bit
          </Typography>
        </View>
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
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  title: {
    marginBottom: theme.spacing.lg,
    fontWeight: '700',
  },
  syncCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceContainerLowest,
  },
  syncHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  syncActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
  menuContainer: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceContainerHigh,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuText: {
    marginLeft: theme.spacing.md,
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
});
