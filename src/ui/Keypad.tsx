import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from './Typography';
import { theme } from './theme';
import { Delete } from 'lucide-react-native';

interface KeypadProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

export function Keypad({ onKeyPress, onBackspace, disabled }: KeypadProps) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <View style={styles.keypad}>
      {keys.map((key, i) => (
        <TouchableOpacity
          key={i}
          style={styles.key}
          onPress={() => {
            if (key === 'del') onBackspace();
            else if (key) onKeyPress(key);
          }}
          disabled={disabled || !key}
        >
          {key === 'del' ? (
            <Delete size={28} color={theme.colors.onSurface} />
          ) : key ? (
            <Typography variant="headlineLg" color={theme.colors.onSurface}>{key}</Typography>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'space-between',
    alignSelf: 'center',
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
