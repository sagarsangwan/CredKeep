import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';

export default function MoreScreen() {
  const router = useRouter();

  const menuItems = [
    { title: 'Earnings & Reports', route: '/reports' },
    { title: 'App Security (PIN Lock)', route: '/settings/security' },
    { title: 'Backup & Restore', route: '/settings/backup' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
          More Settings
        </Typography>

        <View style={styles.list}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.listItem}
              onPress={() => router.push(item.route as any)}
            >
              <Typography variant="titleMd" color={theme.colors.onSurface}>{item.title}</Typography>
              <Typography variant="titleMd" color={theme.colors.onSurfaceVariant}>›</Typography>
            </TouchableOpacity>
          ))}
        </View>

        <Typography variant="bodySm" color={theme.colors.onSurfaceVariant} align="center" style={{marginTop: 40}}>
          CredKeep V1 — Local First
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
    padding: theme.spacing.xl,
  },
  title: {
    marginBottom: theme.spacing.xl,
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
  }
});
