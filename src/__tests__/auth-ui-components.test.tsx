import {
  GoogleSignInButton,
  PhoneInput,
  validateIndianMobile,
  PasswordInput,
} from '../ui';

// Mock lucide-react-native
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return new Proxy({}, {
    get: (_, name) => (props: any) => React.createElement(View, { ...props, testID: String(name) }),
  });
});

describe('Authentication UI Components & Mobile Validation', () => {
  describe('Indian Mobile Number Validation (+91)', () => {
    it('accepts valid 10-digit Indian mobile numbers starting with 6, 7, 8, 9', () => {
      expect(validateIndianMobile('9876543210')).toBe(true);
      expect(validateIndianMobile('8123456789')).toBe(true);
      expect(validateIndianMobile('7012345678')).toBe(true);
      expect(validateIndianMobile('6999999999')).toBe(true);
    });

    it('handles formatted numbers by stripping non-numeric characters', () => {
      expect(validateIndianMobile('98765 43210')).toBe(true);
      expect(validateIndianMobile('98765-43210')).toBe(true);
      expect(validateIndianMobile('(98765) 43210')).toBe(true);
    });

    it('rejects invalid numbers', () => {
      // Starts with invalid digit (< 6)
      expect(validateIndianMobile('5876543210')).toBe(false);
      expect(validateIndianMobile('1234567890')).toBe(false);
      expect(validateIndianMobile('0123456789')).toBe(false);

      // Too short
      expect(validateIndianMobile('98765')).toBe(false);
      expect(validateIndianMobile('987654321')).toBe(false);

      // Too long
      expect(validateIndianMobile('98765432109')).toBe(false);

      // Empty or non-numeric
      expect(validateIndianMobile('')).toBe(false);
      expect(validateIndianMobile('abcdefghij')).toBe(false);
    });
  });

  describe('Component Definitions & Instantiation', () => {
    it('defines GoogleSignInButton component', () => {
      expect(GoogleSignInButton).toBeDefined();
    });

    it('defines PhoneInput component', () => {
      expect(PhoneInput).toBeDefined();
    });

    it('defines PasswordInput component', () => {
      expect(PasswordInput).toBeDefined();
    });
  });
});
