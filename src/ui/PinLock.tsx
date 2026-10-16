import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState, AppStateStatus, Modal } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Typography } from './Typography';
import { Button } from './Button';
import { theme } from './theme';
import { Keypad } from './Keypad';

export const PIN_KEY = 'credkeep_app_pin';
export const BIO_ENABLED_KEY = 'credkeep_bio_enabled';

// Grace period before re-locking when app is backgrounded (30 seconds)
const BACKGROUND_LOCK_GRACE_PERIOD_MS = 30000;

interface SecurityContextValue {
  hasPin: boolean;
  bioEnabled: boolean;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  setBioEnabled: (enabled: boolean) => Promise<void>;
  lockApp: () => void;
}

const SecurityContext = createContext<SecurityContextValue | null>(null);

export const useSecurity = () => {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurity must be used within PinLock');
  return ctx;
};

export function PinLock({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [hasPin, setHasPinState] = useState(false);
  const [bioEnabled, setBioEnabledState] = useState(false);

  const [pinEntry, setPinEntry] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const backgroundTimestampRef = useRef<number | null>(null);
  const isAuthenticatingBioRef = useRef<boolean>(false);

  const promptBiometricsIfEligible = async () => {
    if (isAuthenticatingBioRef.current) return;
    try {
      isAuthenticatingBioRef.current = true;
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const auth = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock CredKeep',
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: true,
        });
        if (auth.success) {
          setIsLocked(false);
          setPinEntry('');
          setStorageError(null);
        }
      }
    } catch (e) {
      console.warn('Biometric auth error', e);
    } finally {
      isAuthenticatingBioRef.current = false;
    }
  };

  const checkPinSetup = async () => {
    try {
      setStorageError(null);
      const pin = await SecureStore.getItemAsync(PIN_KEY);
      const bio = await SecureStore.getItemAsync(BIO_ENABLED_KEY);

      const pinExists = Boolean(pin && pin.trim().length === 4);
      setHasPinState(pinExists);
      setStoredPin(pinExists ? pin : null);
      const bioActive = bio === 'true';
      setBioEnabledState(bioActive);

      if (pinExists) {
        setIsLocked(true);
        if (bioActive) {
          await promptBiometricsIfEligible();
        }
      } else {
        setIsLocked(false);
      }
    } catch (e: any) {
      console.error('SecureStore error', e);
      // Fail-secure: If SecureStore fails, stay locked and allow the user to retry
      setIsLocked(true);
      setStorageError('Failed to access secure storage. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appState.current = nextAppState;

      // Do NOT lock if native biometric prompt dialog is currently active
      if (isAuthenticatingBioRef.current) {
        return;
      }

      if (nextAppState === 'background') {
        // Record timestamp when the app enters background
        backgroundTimestampRef.current = Date.now();
      } else if (nextAppState === 'active') {
        // When returning to active, check if the app was previously backgrounded
        if (backgroundTimestampRef.current !== null) {
          const elapsed = Date.now() - backgroundTimestampRef.current;
          backgroundTimestampRef.current = null;

          // Only lock if genuine background duration met or exceeded grace period
          if (hasPin && elapsed >= BACKGROUND_LOCK_GRACE_PERIOD_MS) {
            setIsLocked(true);
            setPinEntry('');
            if (bioEnabled) {
              promptBiometricsIfEligible();
            }
          }
        }
      }
      // Note: Transitions to 'inactive' do NOT clear backgroundTimestampRef or trigger lock
    });

    return () => subscription.remove();
  }, [hasPin, bioEnabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkPinSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyPress = (num: string) => {
    if (pinEntry.length < 4) {
      setError(false);
      const newPin = pinEntry + num;
      setPinEntry(newPin);

      if (newPin.length === 4) {
        if (newPin === storedPin) {
          setIsLocked(false);
          setPinEntry('');
          setStorageError(null);
        } else {
          setError(true);
          setTimeout(() => setPinEntry(''), 500);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinEntry((prev) => prev.slice(0, -1));
    setError(false);
  };

  const setPin = async (pin: string) => {
    await SecureStore.setItemAsync(PIN_KEY, pin);
    setStoredPin(pin);
    setHasPinState(true);
  };

  const removePin = async () => {
    await SecureStore.deleteItemAsync(PIN_KEY);
    await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
    setStoredPin(null);
    setHasPinState(false);
    setBioEnabledState(false);
    setIsLocked(false);
  };

  const setBioEnabled = async (enabled: boolean) => {
    await SecureStore.setItemAsync(BIO_ENABLED_KEY, enabled ? 'true' : 'false');
    setBioEnabledState(enabled);
  };

  const lockApp = () => {
    if (hasPin) {
      setIsLocked(true);
      setPinEntry('');
    }
  };

  const handleRetryBio = async () => {
    await promptBiometricsIfEligible();
  };

  const contextValue: SecurityContextValue = {
    hasPin,
    bioEnabled,
    setPin,
    removePin,
    setBioEnabled,
    lockApp,
  };

  return (
    <SecurityContext.Provider value={contextValue}>
      <View style={styles.root}>
        {/* Navigation children are ALWAYS kept mounted underneath to preserve navigation and form state */}
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={isLocked || loading ? 'none' : 'auto'}
          importantForAccessibility={isLocked || loading ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>

        {/* Loading overlay during initial PIN check */}
        {loading && (
          <View style={[StyleSheet.absoluteFill, styles.overlay]}>
            <Typography variant="headlineMd">Loading...</Typography>
          </View>
        )}

        {/* Top-level Modal overlay when locked: covers all screens including native Android Modals */}
        <Modal
          visible={isLocked && !loading}
          animationType="fade"
          transparent={false}
          statusBarTranslucent
          onRequestClose={() => {
            // Android back button cannot dismiss PIN lock
          }}
        >
          <View style={styles.container}>
            <Typography variant="headlineMd" color={theme.colors.primary} style={styles.title}>
              Enter PIN
            </Typography>

            {storageError ? (
              <View style={styles.errorContainer}>
                <Typography variant="bodyMd" color={theme.colors.error} style={{ marginBottom: 16 }}>
                  {storageError}
                </Typography>
                <Button title="Retry Security Check" onPress={() => checkPinSetup()} />
              </View>
            ) : (
              <>
                <View style={styles.dotsContainer}>
                  {[1, 2, 3, 4].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        pinEntry.length >= i ? styles.dotFilled : null,
                        error ? styles.dotError : null,
                      ]}
                    />
                  ))}
                </View>

                <Keypad onKeyPress={handleKeyPress} onBackspace={handleBackspace} />

                {bioEnabled && (
                  <TouchableOpacity onPress={handleRetryBio} style={styles.bioButton}>
                    <Typography variant="labelLg" color={theme.colors.primary}>
                      Use Biometrics
                    </Typography>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </Modal>
      </View>
    </SecurityContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  overlay: {
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 40,
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
  dotError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error,
  },
  bioButton: {
    marginTop: 40,
    padding: 16,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
  },
});
