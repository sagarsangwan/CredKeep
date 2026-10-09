import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';

export default function MoreScreen() {
  const { error } = useDatabase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Typography variant="headlineMd" style={styles.title}>Settings</Typography>
      
      <Card elevated style={styles.card}>
        <TouchableOpacity style={styles.item}>
          <Typography variant="bodyLg">Data & Backup</Typography>
          <Typography variant="bodySm" color={theme.colors.textSecondary}>Manage your encrypted local database</Typography>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.item}>
          <Typography variant="bodyLg">Security</Typography>
          <Typography variant="bodySm" color={theme.colors.textSecondary}>App lock and PIN settings</Typography>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.item}>
          <Typography variant="bodyLg">About Bharat Ledger</Typography>
          <Typography variant="bodySm" color={theme.colors.textSecondary}>Version 1.0.0 (Local First)</Typography>
        </TouchableOpacity>
      </Card>

      <Typography variant="bodySm" color={theme.colors.textSecondary} align="center" style={{marginTop: 40}}>
        Your data is fully encrypted and stored locally.
      </Typography>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  title: { marginBottom: theme.spacing.xl },
  card: { padding: 0, overflow: 'hidden' },
  item: { padding: theme.spacing.lg },
  divider: { height: 1, backgroundColor: theme.colors.outline, marginLeft: theme.spacing.lg }
});
