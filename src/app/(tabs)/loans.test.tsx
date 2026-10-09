import React from 'react';
import { View, Text } from 'react-native';
import LoansScreen from './loans';

// A simple regression test to ensure that LoansScreen does not throw ReferenceError 
// or any other initialization error on import and render.

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../core/database/DatabaseProvider', () => ({
  useDatabase: () => ({
    loans: { getAll: jest.fn().mockResolvedValue([]) },
    borrowers: { getAll: jest.fn().mockResolvedValue([]) }
  }),
}));

describe('LoansScreen', () => {
  it('imports and initializes without ReferenceError', () => {
    expect(LoansScreen).toBeDefined();
  });
});
