import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { formatINR } from '../../core/domain/money';

export default function ReportsScreen() {
  const router = useRouter();
  const { transactions } = useDatabase();
  const [globalEarnings, setGlobalEarnings] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        if (transactions) {
          const summary = await transactions.getEarningsSummary();
          setGlobalEarnings(summary);
        }
      }
      load();
    }, [transactions])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.onBackground} />
        </TouchableOpacity>
        <Typography variant="headlineMd" style={styles.title}>
          Earnings & Reports
        </Typography>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {globalEarnings && (
          <Card elevated style={styles.card}>
            <Typography variant="titleMd" style={{ marginBottom: 10 }}>
              Global Actual Cash Earnings
            </Typography>
            <View style={styles.row}>
              <Typography variant="bodyMd">Principal Returned:</Typography>
              <Typography variant="bodyMd">{formatINR(globalEarnings.principalReturned)}</Typography>
            </View>
            <View style={styles.row}>
              <Typography variant="bodyMd">Contractual Markup Received:</Typography>
              <Typography variant="bodyMd">{formatINR(globalEarnings.markupReceived)}</Typography>
            </View>
            <View style={styles.row}>
              <Typography variant="bodyMd">Late Penalties Received:</Typography>
              <Typography variant="bodyMd">{formatINR(globalEarnings.penaltyReceived)}</Typography>
            </View>
            <View
              style={[
                styles.row,
                {
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
            >
              <Typography variant="labelLg">Total Actual Earnings:</Typography>
              <Typography variant="labelLg" color={theme.colors.success}>
                {formatINR(globalEarnings.totalEarnings)}
              </Typography>
            </View>

            <View style={{ marginTop: 20 }}>
              <Typography variant="labelMd" color={theme.colors.error}>
                Outstanding / Uncollected
              </Typography>
              <View style={styles.row}>
                <Typography variant="bodySm" color={theme.colors.error}>
                  Outstanding Penalties:
                </Typography>
                <Typography variant="bodySm" color={theme.colors.error}>
                  {formatINR(globalEarnings.outstandingPenalty)}
                </Typography>
              </View>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
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
  title: {
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  card: {
    padding: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
});
