import React from 'react';
import { View, StyleSheet, Modal, TouchableWithoutFeedback } from 'react-native';
import { theme } from './theme';
import { Typography } from './Typography';
import { Button } from './Button';

export interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  impactDetails?: { label: string; value: string }[];
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  loading = false,
  onConfirm,
  onCancel,
  impactDetails,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.scrim}>
          <TouchableWithoutFeedback>
            <View style={styles.dialogCard}>
              <Typography variant="headlineSm" color={theme.colors.textPrimary}>
                {title}
              </Typography>

              <Typography variant="bodyMd" color={theme.colors.textSecondary} style={{ marginTop: 8 }}>
                {message}
              </Typography>

              {impactDetails && impactDetails.length > 0 && (
                <View style={styles.impactBox}>
                  {impactDetails.map((detail, index) => (
                    <View key={index} style={styles.impactRow}>
                      <Typography variant="bodySm" color={theme.colors.textSecondary}>
                        {detail.label}
                      </Typography>
                      <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                        {detail.value}
                      </Typography>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.actionRow}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={cancelLabel}
                    variant="secondary"
                    onPress={onCancel}
                    disabled={loading}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={confirmLabel}
                    variant={isDestructive ? 'destructive' : 'primary'}
                    onPress={onConfirm}
                    loading={loading}
                    disabled={loading}
                  />
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  impactBox: {
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    padding: 12,
    marginTop: 14,
    gap: 8,
  },
  impactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
});
