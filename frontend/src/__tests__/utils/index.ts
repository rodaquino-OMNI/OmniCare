// Test utilities index
export * from './network-mock.utils';

// Re-export common testing utilities
export { act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
export { userEvent };
export { waitFor, screen, within, fireEvent } from '@testing-library/react';

// Common test helpers
export const createTestId = (component: string, element?: string) => {
  return element ? `${component}-${element}` : component;
};

export const getTestId = (testId: string) => {
  return (screen as any).getByTestId(testId);
};

export const queryTestId = (testId: string) => {
  return (screen as any).queryByTestId(testId);
};

export const findTestId = (testId: string) => {
  return (screen as any).findByTestId(testId);
};

// Mock data generators
export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const generateDate = (daysFromNow: number = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
};

// Test environment helpers
export const mockConsoleMethod = (method: 'log' | 'warn' | 'error' | 'info') => {
  const originalMethod = console[method];
  console[method] = jest.fn();
  
  return () => {
    console[method] = originalMethod;
  };
};

export const mockLocalStorage = () => {
  const mockStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };
  
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
  });
  
  return mockStorage;
};

export const mockSessionStorage = () => {
  const mockStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };
  
  Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage,
    writable: true,
  });
  
  return mockStorage;
};

// Async test helpers
export const waitForNextTick = () => {
  return new Promise(resolve => process.nextTick(resolve));
};

export const waitForTimeout = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Form testing helpers
export const fillForm = async (formData: Record<string, string>) => {
  const user = userEvent.setup();
  
  for (const [name, value] of Object.entries(formData)) {
    const input = (screen as any).getByLabelText(name) || (screen as any).getByPlaceholderText(name) || (screen as any).getByDisplayValue(name);
    await user.clear(input);
    await user.type(input, value);
  }
};

export const submitForm = async (submitButtonText: string = 'Submit') => {
  const user = userEvent.setup();
  const submitButton = (screen as any).getByRole('button', { name: submitButtonText });
  await user.click(submitButton);
};

// Component testing helpers
export const expectElementToBeVisible = (testId: string) => {
  expect(getTestId(testId)).toBeInTheDocument();
  expect(getTestId(testId)).toBeVisible();
};

export const expectElementToBeHidden = (testId: string) => {
  const element = queryTestId(testId);
  if (element) {
    expect(element).not.toBeVisible();
  } else {
    expect(element).not.toBeInTheDocument();
  }
};

export const expectElementToHaveText = (testId: string, text: string) => {
  expect(getTestId(testId)).toHaveTextContent(text);
};

export const expectElementToHaveValue = (testId: string, value: string) => {
  expect(getTestId(testId)).toHaveValue(value);
};

// Default export
export default {
  createTestId,
  getTestId,
  queryTestId,
  findTestId,
  generateId,
  generateDate,
  mockConsoleMethod,
  mockLocalStorage,
  mockSessionStorage,
  waitForNextTick,
  waitForTimeout,
  fillForm,
  submitForm,
  expectElementToBeVisible,
  expectElementToBeHidden,
  expectElementToHaveText,
  expectElementToHaveValue
};