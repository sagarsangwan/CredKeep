import React, { useState } from 'react';
import { View, StyleSheet, Alert, Switch, Modal } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Shield } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { Button } from '../../ui/Button';
import { useSecurity } from '../../ui/PinLock';
import { Keypad } from '../../ui/Keypad';
import { Card } from '../../ui/Card';

export default function SecuritySettingsScreen() {
  const { hasPin, bioEnabled, setPin, removePin, setBioEnabled } = useSecurity();
  const [pinEntry, setPinEntry] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1 = Enter, 2 = Confirm
  const [firstPin, setFirstPin] = useState('');

  const handleToggleBio = async (val: boolean) => {
    if (!hasPin) {
      Alert.alert('Error', 'Please set a PIN first.');
      return;
    }
    await setBioEnabled(val);
  };

  const handleKeyPress = (num: string) => {
    if (pinEntry.length < 4) {
      const newPin = pinEntry + num;
      setPinEntry(newPin);
      
      if (newPin.length === 4) {
        setTimeout(() => {
          if (step === 1) {
            setFirstPin(newPin);
            setPinEntry('');
            setStep(2);
          } else {
            if (newPin === firstPin) {
              setPin(newPin);
              setIsSettingPin(false);
              setPinEntry('');
              setFirstPin('');
              setStep(1);
              Alert.alert('Success', 'PIN set successfully.');
            } else {
              Alert.alert('Error', 'PINs do not match. Try again.');
              setPinEntry('');
              setFirstPin('');
              setStep(1);
            }
          }
        }, 200); // small delay for visual feedback
      }
    }
  };

  const handleBackspace = () => {
    setPinEntry(prev => prev.slice(0, -1));
  };

  const handleRemovePin = async () => {
    Alert.alert(
      'Remove App Lock', 
      'Are you sure you want to disable the PIN and biometric lock?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          await removePin();
          Alert.alert('Success', 'App Lock removed.');
        }}
      ]
    );
  };

  const startPinSetup = () => {
    setIsSettingPin(true);
    setStep(1);
    setPinEntry('');
    setFirstPin('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Shield size={32} color={theme.colors.primary} />
          <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
            App Security
          </Typography>
        </View>

        <Card style={styles.summaryCard}>
          <Typography variant="bodyMd" color={theme.colors.onPrimaryContainer}>
            Protect your financial data by requiring a PIN or biometrics to open the app.
          </Typography>
        </Card>

        <View style={styles.card}>
          <View style={styles.row}>
            <Typography variant="titleMd" color={theme.colors.onSurface}>App Lock (PIN)</Typography>
            <Typography variant="labelLg" color={hasPin ? theme.colors.primary : theme.colors.onSurfaceVariant}>
              {hasPin ? 'Enabled' : 'Disabled'}
            </Typography>
          </View>
          
          {hasPin && (
            <View style={[styles.row, { marginTop: theme.spacing.lg }]}>
              <Typography variant="titleMd" color={theme.colors.onSurface}>Biometric Unlock</Typography>
              <Switch value={bioEnabled} onValueChange={handleToggleBio} />
            </View>
          )}
        </View>

        {!hasPin && (
          <Button title="Set up PIN" onPress={startPinSetup} style={{ marginTop: theme.spacing.xl }} />
        )}

        {hasPin && (
          <Button variant="outline" title="Remove App Lock" onPress={handleRemovePin} style={{ marginTop: theme.spacing.xl }} />
        )}

        <Modal visible={isSettingPin} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaProvider>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Typography variant="headlineMd" color={theme.colors.primary}>
                {step === 1 ? 'Create PIN' : 'Confirm PIN'}
              </Typography>
              <Typography variant="bodyMd" color={theme.colors.onSurfaceVariant} style={{ marginTop: 8 }}>
                {step === 1 ? 'Enter a 4-digit PIN' : 'Re-enter your PIN'}
              </Typography>
            </View>

            <View style={styles.dotsContainer}>
              {[1, 2, 3, 4].map(i => (
                <View 
                  key={i} 
                  style={[
                    styles.dot, 
                    pinEntry.length >= i ? styles.dotFilled : null
                  ]} 
                />
              ))}
            </View>

            <Keypad onKeyPress={handleKeyPress} onBackspace={handleBackspace} />

            <Button 
              variant="ghost" 
              title="Cancel" 
              onPress={() => setIsSettingPin(false)} 
              style={{ marginTop: 40 }} 
            />
          </SafeAreaView>
          </SafeAreaProvider>
        </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    marginLeft: theme.spacing.md,
  },
  summaryCard: {
    backgroundColor: theme.colors.surfaceVariant,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 60,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 60,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  dotFilled: {
    backgroundColor: theme.colors.primary,
  },
});
