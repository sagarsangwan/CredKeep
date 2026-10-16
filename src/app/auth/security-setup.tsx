import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Switch, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Shield, Fingerprint, Lock } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useSecurity } from '../../ui/PinLock';
import { Keypad } from '../../ui/Keypad';

export default function SecuritySetupScreen() {
  const router = useRouter();
  const { hasPin, bioEnabled, setPin, setBioEnabled } = useSecurity();

  const [hasBioHardware, setHasBioHardware] = useState(false);
  const [isBioEnrolled, setIsBioEnrolled] = useState(false);
  const [bioTypeNames, setBioTypeNames] = useState<string>('Biometrics');

  const [isSettingPin, setIsSettingPin] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [firstPin, setFirstPin] = useState('');
  const [pinEntry, setPinEntry] = useState('');

  useEffect(() => {
    async function checkBiometrics() {
      try {
        const hardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setHasBioHardware(hardware);
        setIsBioEnrolled(enrolled);

        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const names: string[] = [];
        if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          names.push('Fingerprint');
        }
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          names.push('Face Unlock');
        }
        if (names.length > 0) {
          setBioTypeNames(names.join(' / '));
        }
      } catch {
        // Non-fatal detection failure
      }
    }
    checkBiometrics();
  }, []);

  const handleToggleBio = async (val: boolean) => {
    if (val) {
      if (!hasPin) {
        Alert.alert(
          'PIN Required First',
          'Please set a 4-digit PIN as a backup before enabling biometrics.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Set PIN', onPress: () => startPinSetup() },
          ]
        );
        return;
      }

      try {
        const auth = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm Biometrics for CredKeep',
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: true,
        });

        if (auth.success) {
          await setBioEnabled(true);
          Alert.alert('Enabled', `${bioTypeNames} unlock is active.`);
        }
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Biometric verification failed.');
      }
    } else {
      await setBioEnabled(false);
    }
  };

  const startPinSetup = () => {
    setIsSettingPin(true);
    setStep(1);
    setPinEntry('');
    setFirstPin('');
  };

  const handleKeyPress = (num: string) => {
    if (pinEntry.length < 4) {
      const newPin = pinEntry + num;
      setPinEntry(newPin);

      if (newPin.length === 4) {
        setTimeout(async () => {
          if (step === 1) {
            setFirstPin(newPin);
            setPinEntry('');
            setStep(2);
          } else {
            if (newPin === firstPin) {
              await setPin(newPin);
              setIsSettingPin(false);
              setPinEntry('');
              setFirstPin('');
              setStep(1);
              Alert.alert('Success', '4-digit PIN created successfully.');
            } else {
              Alert.alert('Error', 'PINs do not match. Please try again.');
              setPinEntry('');
              setFirstPin('');
              setStep(1);
            }
          }
        }, 150);
      }
    }
  };

  const handleBackspace = () => {
    setPinEntry((prev) => prev.slice(0, -1));
  };

  const handleFinish = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Shield size={44} color={theme.colors.primary} />
          <Typography variant="headlineLg" color={theme.colors.onBackground} style={styles.title}>
            Protect Your Ledger
          </Typography>
          <Typography variant="bodyMd" color={theme.colors.textSecondary} style={styles.subtitle}>
            Choose how to unlock CredKeep when reopening the app offline.
          </Typography>
        </View>

        <Card style={styles.optionsCard}>
          {/* Biometrics Option */}
          <View style={styles.optionRow}>
            <View style={styles.optionIconContainer}>
              <Fingerprint size={28} color={hasBioHardware && isBioEnrolled ? theme.colors.primary : theme.colors.outline} />
            </View>
            <View style={styles.optionTextContainer}>
              <Typography variant="headlineSm" color={theme.colors.onBackground}>
                {bioTypeNames}
              </Typography>
              <Typography variant="bodySm" color={theme.colors.textSecondary}>
                {hasBioHardware && isBioEnrolled
                  ? 'Unlock quickly with sensor'
                  : 'Not available or not enrolled'}
              </Typography>
            </View>
            <Switch
              value={bioEnabled}
              onValueChange={handleToggleBio}
              disabled={!hasBioHardware || !isBioEnrolled}
              trackColor={{ false: theme.colors.outlineVariant, true: theme.colors.secondary }}
              thumbColor={theme.colors.surfaceContainerLowest}
            />
          </View>

          <View style={styles.divider} />

          {/* App PIN Option */}
          <View style={styles.optionRow}>
            <View style={styles.optionIconContainer}>
              <Lock size={28} color={theme.colors.primary} />
            </View>
            <View style={styles.optionTextContainer}>
              <Typography variant="headlineSm" color={theme.colors.onBackground}>
                4-Digit App PIN
              </Typography>
              <Typography variant="bodySm" color={theme.colors.textSecondary}>
                {hasPin ? 'PIN is configured' : 'Separate CredKeep offline PIN'}
              </Typography>
            </View>
            <Button
              title={hasPin ? 'Change' : 'Set PIN'}
              variant={hasPin ? 'outline' : 'primary'}
              onPress={startPinSetup}
              style={styles.pinBtn}
            />
          </View>
        </Card>

        <View style={styles.actions}>
          <Button
            title={hasPin || bioEnabled ? 'Continue to Dashboard' : 'Skip for now'}
            variant={hasPin || bioEnabled ? 'primary' : 'outline'}
            onPress={handleFinish}
            style={styles.finishBtn}
          />

          <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.footerNote}>
            You can also adjust security settings anytime from More &rarr; App Security.
          </Typography>
        </View>

        {/* Modal for setting PIN */}
        <Modal visible={isSettingPin} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setIsSettingPin(false)}
              />
              <Typography variant="headlineSm">
                {step === 1 ? 'Enter New PIN' : 'Confirm PIN'}
              </Typography>
              <View style={{ width: 60 }} />
            </View>

            <View style={styles.modalBody}>
              <View style={styles.dotsContainer}>
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      pinEntry.length >= i ? styles.dotFilled : null,
                    ]}
                  />
                ))}
              </View>

              <Keypad onKeyPress={handleKeyPress} onBackspace={handleBackspace} />
            </View>
          </SafeAreaView>
        </Modal>
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
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  title: {
    fontWeight: '800',
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  optionsCard: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginVertical: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  optionIconContainer: {
    width: 44,
    alignItems: 'center',
  },
  optionTextContainer: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  pinBtn: {
    minWidth: 90,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.outlineVariant,
    marginVertical: theme.spacing.xs,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
  },
  finishBtn: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  footerNote: {
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
  },
  modalBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 50,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  dotFilled: {
    backgroundColor: theme.colors.primary,
  },
});
