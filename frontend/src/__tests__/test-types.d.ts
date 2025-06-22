/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

// Test-specific type declarations for corrupted numeric values
declare global {
  // Numeric constants that have been corrupted in test files
  const ResourceHistoryTable: 0;

  // Fix for test environment
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveStyle(style: string | object): R;
      toHaveClass(className: string): R;
      toHaveAttribute(attr: string, value?: string): R;
      toBeDisabled(): R;
      toBeVisible(): R;
      toHaveValue(value: string | number | string[]): R;
      toHaveDisplayValue(value: string | number): R;
      toBeChecked(): R;
      toBePartiallyChecked(): R;
      toHaveDescription(text?: string | RegExp): R;
      toHaveErrorMessage(text?: string | RegExp): R;
      toBeInvalid(): R;
      toBeRequired(): R;
      toBeValid(): R;
      toHaveAccessibleDescription(text?: string | RegExp): R;
      toHaveAccessibleName(text?: string | RegExp): R;
    }
  }
}

export {};