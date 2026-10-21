import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Switch, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Shield, ArrowLeft } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { Button } from '../../ui/Button';
import { useSecurity } from '../../ui/PinLock';
import { Keypad } from '../../ui/Keypad';
import { Card } from '../../ui/Card';
import { GoogleLogo } from '../../ui/GoogleSignInButton';
import { AuthStore } from '../../core/auth/authStore';
import { AuthService } from '../../core/auth/authService';
import { promptGoogleSignIn } from '../../core/auth/googleAuth';

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const { hasPin, bioEnabled, setPin, removePin, setBioEnabled } = useSecurity();
  const [pinEntry, setPinEntry] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1 = Enter, 2 = Confirm
  const [firstPin, setFirstPin] = useState('');
  const [linkedGoogleEmail, setLinkedGoogleEmail] = useState<string | null>(null);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);

  useEffect(() => {
    AuthStore.getGoogleLinkedEmail().then(setLinkedGoogleEmail);
  }, []);

  const handleConnectGoogle = async () => {
    try {
      setIsLinkingGoogle(true);
      const promptResult = await promptGoogleSignIn();
      if (!promptResult.success) {
        if ('cancelled' in promptResult) {
          return;
        }
        Alert.alert('Google Sign-In', promptResult.error || 'Authentication cancelled.');
        return;
      }

      const linkRes = await AuthService.linkGoogleAccount(promptResult.idToken);
      setLinkedGoogleEmail(linkRes.email);
      Alert.alert(
        'Google Account Connected',
        `Successfully linked ${linkRes.email}. You can now sign in to your CredKeep workspace using Continue with Google.`
      );
    } catch (err: any) {
      Alert.alert(
        'Unable to Link Account',
        err?.message || 'Failed to connect Google account. Please try again.'
      );
    } finally {
      setIsLinkingGoogle(false);
    }
  };

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
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.onBackground} />
        </TouchableOpacity>
        <Typography variant="headlineSm" style={styles.topNavTitle}>
          App Security
        </Typography>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.container}>
        <View style={styles.header}>
          <Shield size={32} color={theme.colors.primary} />
          <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
            PIN & Biometrics
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

        {/* Connected Accounts Card */}
        <View style={[styles.card, { marginTop: theme.spacing.xl }]}>
          <Typography variant="titleMd" color={theme.colors.onSurface} style={{ marginBottom: 4, fontWeight: '600' }}>
            Connected Accounts
          </Typography>
          <Typography variant="bodySm" color={theme.colors.onSurfaceVariant} style={{ marginBottom: theme.spacing.md }}>
            Link your Google account for secure sign-in to this workspace.
          </Typography>

          <View style={[styles.row, { alignItems: 'center' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <GoogleLogo size={20} />
              <View style={{ marginLeft: 12 }}>
                <Typography variant="labelMd" color={theme.colors.onSurface} style={{ fontWeight: '500' }}>
                  Google Account
                </Typography>
                <Typography variant="bodySm" color={theme.colors.onSurfaceVariant}>
                  {linkedGoogleEmail ? linkedGoogleEmail : 'Not connected'}
                </Typography>
              </View>
            </View>

            {linkedGoogleEmail ? (
              <Typography variant="labelSm" color={theme.colors.primary} style={{ fontWeight: '600' }}>
                Connected
              </Typography>
            ) : (
              <Button
                title={isLinkingGoogle ? 'Connecting...' : 'Connect'}
                variant="outline"
                loading={isLinkingGoogle}
                onPress={handleConnectGoogle}
                style={{ minHeight: 38, paddingHorizontal: 16 }}
              />
            )}
          </View>
        </View>

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
