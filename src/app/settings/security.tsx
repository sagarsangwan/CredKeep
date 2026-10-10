import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Switch } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { Button } from '../../ui/Button';
import { PIN_KEY, BIO_ENABLED_KEY } from '../../ui/PinLock';

export default function SecuritySettingsScreen() {
  const [hasPin, setHasPin] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);

  const loadStatus = async () => {
    const pin = await SecureStore.getItemAsync(PIN_KEY);
    setHasPin(!!pin);
    const bio = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
    setBioEnabled(bio === 'true');
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus();
  }, []);

  const handleToggleBio = async (val: boolean) => {
    if (!hasPin) {
      Alert.alert('Error', 'Please set a PIN first.');
      return;
    }
    await SecureStore.setItemAsync(BIO_ENABLED_KEY, val ? 'true' : 'false');
    setBioEnabled(val);
  };

  const handleSetPin = async () => {
    if (pinEntry.length !== 4) {
      Alert.alert('Error', 'PIN must be 4 digits');
      return;
    }
    await SecureStore.setItemAsync(PIN_KEY, pinEntry);
    setHasPin(true);
    setIsSettingPin(false);
    setPinEntry('');
    Alert.alert('Success', 'PIN set successfully.');
  };

  const handleRemovePin = async () => {
    await SecureStore.deleteItemAsync(PIN_KEY);
    await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
    setHasPin(false);
    setBioEnabled(false);
    Alert.alert('Success', 'App Lock removed.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
          App Security
        </Typography>

        <View style={styles.card}>
          <View style={styles.row}>
            <Typography variant="titleMd" color={theme.colors.onSurface}>App Lock (PIN)</Typography>
            <Typography variant="labelLg" color={hasPin ? theme.colors.primary : theme.colors.error}>
              {hasPin ? 'Enabled' : 'Disabled'}
            </Typography>
          </View>
          
          {hasPin && (
            <View style={[styles.row, { marginTop: 20 }]}>
              <Typography variant="titleMd" color={theme.colors.onSurface}>Biometric Unlock</Typography>
              <Switch value={bioEnabled} onValueChange={handleToggleBio} />
            </View>
          )}
        </View>

        {!hasPin && !isSettingPin && (
          <Button title="Set up PIN" onPress={() => setIsSettingPin(true)} style={{ marginTop: 20 }} />
        )}

        {!hasPin && isSettingPin && (
          <View style={{ marginTop: 20 }}>
            <Typography variant="labelLg" color={theme.colors.onSurface}>Enter 4-digit PIN</Typography>
            {/* Extremely simple input for settings, relying on custom keypad is better but a TextInput or styled View works here */}
            {/* In a real app we'd use the same Keypad, but for brevity we'll just allow setting it directly or with a keypad */}
            <Typography variant="headlineLg" style={{ marginVertical: 20 }}>{pinEntry.padEnd(4, '-')}</Typography>
            <View style={styles.keypad}>
              {['1','2','3','4','5','6','7','8','9','C','0','OK'].map(k => (
                <Button 
                  key={k} 
                  title={k} 
                  variant="outline" 
                  style={{ width: 80, marginBottom: 10 }} 
                  onPress={() => {
                    if (k === 'C') setPinEntry('');
                    else if (k === 'OK') handleSetPin();
                    else if (pinEntry.length < 4) setPinEntry(pinEntry + k);
                  }} 
                />
              ))}
            </View>
          </View>
        )}

        {hasPin && (
          <Button variant="outline" title="Remove App Lock" onPress={handleRemovePin} style={{ marginTop: 20 }} />
        )}
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
  title: {
    marginBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: 260,
  }
});
