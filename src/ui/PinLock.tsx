import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Typography } from './Typography';
import { theme } from './theme';

export const PIN_KEY = 'credkeep_app_pin';
export const BIO_ENABLED_KEY = 'credkeep_bio_enabled';

export function PinLock({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const appState = React.useRef(AppState.currentState);

  const checkPinSetup = async () => {
    try {
      const pin = await SecureStore.getItemAsync(PIN_KEY);
      if (pin) {
        setHasPin(true);
        setStoredPin(pin);
        
        // Check biometrics
        const bioEnabled = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
        if (bioEnabled === 'true') {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            const auth = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Unlock CredKeep',
              fallbackLabel: 'Use PIN',
            });
            if (auth.success) {
              setIsLocked(false);
            }
          }
        }
      } else {
        setIsLocked(false);
      }
    } catch (e) {
      console.error('SecureStore error', e);
      setIsLocked(false);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        if (storedPin) {
          setIsLocked(true);
          setPinEntry('');
          checkPinSetup();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [storedPin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        } else {
          setError(true);
          setTimeout(() => setPinEntry(''), 500);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinEntry(prev => prev.slice(0, -1));
    setError(false);
  };

  if (!isLocked) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Typography variant="headlineMd" color={theme.colors.primary} style={styles.title}>
        Enter PIN
      </Typography>
      
      <View style={styles.dotsContainer}>
        {[1, 2, 3, 4].map(i => (
          <View 
            key={i} 
            style={[
              styles.dot, 
              pinEntry.length >= i ? styles.dotFilled : null,
              error ? styles.dotError : null
            ]} 
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, i) => (
          <TouchableOpacity
            key={i}
            style={styles.key}
            onPress={() => key === 'del' ? handleBackspace() : key ? handleKeyPress(key) : null}
            disabled={!key}
          >
            {key === 'del' ? (
              <Typography variant="headlineSm" color={theme.colors.onSurface}>⌫</Typography>
            ) : key ? (
              <Typography variant="headlineLg" color={theme.colors.onSurface}>{key}</Typography>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 80,
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
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'space-between',
  },
  key: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderRadius: 40,
  }
});
