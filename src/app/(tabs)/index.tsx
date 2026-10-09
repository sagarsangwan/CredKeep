import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';

export default function HomeScreen() {
  const { error } = useDatabase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Typography variant="headlineMd">Dashboard</Typography>
        <Typography variant="bodyLg" color={theme.colors.textSecondary}>
          Welcome to CredKeep
        </Typography>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Typography variant="headlineSm" color={theme.colors.error}>Database Error</Typography>
          <Typography variant="bodyMd" color={theme.colors.error}>{error.message}</Typography>
        </Card>
      ) : (
        <Card elevated style={styles.statsCard}>
          <Typography variant="headlineSm">System Status</Typography>
          <Typography variant="bodyMd" color={theme.colors.success}>
            Database encrypted & connected
          </Typography>
        </Card>
      )}

      <Card style={styles.infoCard}>
        <Typography variant="headlineSm">Quick Start</Typography>
        <View style={styles.bulletList}>
          <Typography variant="bodyMd">• Go to Borrowers to add a client</Typography>
          <Typography variant="bodyMd">• Go to Loans to create a loan schedule</Typography>
          <Typography variant="bodyMd">• Go to Collections to record payments</Typography>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  errorCard: {
    backgroundColor: theme.colors.errorContainer,
    borderColor: theme.colors.error,
    marginBottom: theme.spacing.lg,
  },
  statsCard: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  infoCard: {
    backgroundColor: theme.colors.surfaceTint,
  },
  bulletList: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  }
});
