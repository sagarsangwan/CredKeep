import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Typography } from './Typography';
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
    } catch (e) {
      console.error('SecureStore error', e);
      // Fail-safe: if PIN exists or error, keep unlocked unless stored pin is verified
      setIsLocked(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const prevAppState = appState.current;
      appState.current = nextAppState;

      // Do NOT lock if we are currently presenting a native biometric dialog
      if (isAuthenticatingBioRef.current) {
        return;
      }

      if (nextAppState === 'background') {
        backgroundTimestampRef.current = Date.now();
      } else if (nextAppState === 'active') {
        // Only trigger lock when returning from genuine background (NOT inactive)
        // AND when the background elapsed time exceeds the grace period
        if (prevAppState === 'background' && backgroundTimestampRef.current !== null) {
          const elapsed = Date.now() - backgroundTimestampRef.current;
          backgroundTimestampRef.current = null;

          if (hasPin && elapsed >= BACKGROUND_LOCK_GRACE_PERIOD_MS) {
            setIsLocked(true);
            setPinEntry('');
            if (bioEnabled) {
              promptBiometricsIfEligible();
            }
          }
        }
      }
    });

    return () => subscription.remove();
  }, [hasPin, bioEnabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    checkPinSetup();
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
        {/* Navigation children are ALWAYS mounted to preserve navigation state and form input */}
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

        {/* PIN lock full-screen overlay when locked */}
        {isLocked && !loading && (
          <View style={[StyleSheet.absoluteFill, styles.overlay]}>
            <Typography variant="headlineMd" color={theme.colors.primary} style={styles.title}>
              Enter PIN
            </Typography>

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
          </View>
        )}
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
});
