/**
 * Type definitions for test utilities and test providers
 */

import { ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { MedplumClient } from '@medplum/core';
import { Patient, Practitioner, Organization } from '@medplum/fhirtypes';
import { User, MockData, TestContext } from '../../../types/shared';

// Test Provider Props
export interface TestProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
  medplumClient?: MedplumClient;
  medplum?: MedplumClient; // Legacy prop support
  withErrorBoundary?: boolean;
  withSuspense?: boolean;
  withRouter?: boolean;
  initialEntries?: string[];
  mockData?: MockData;
  user?: User;
}

// Mock Context Types
export interface MockAuthContext {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: jest.MockedFunction<(email: string, password: string) => Promise<void>>;
  logout: jest.MockedFunction<() => void>;
  refreshToken: jest.MockedFunction<() => Promise<void>>;
  checkAuth: jest.MockedFunction<() => Promise<boolean>>;
}

export interface MockNotificationContext {
  showNotification: jest.MockedFunction<(message: string, type?: 'success' | 'error' | 'warning' | 'info') => void>;
  showSuccess: jest.MockedFunction<(message: string) => void>;
  showError: jest.MockedFunction<(message: string) => void>;
  showWarning: jest.MockedFunction<(message: string) => void>;
  showInfo: jest.MockedFunction<(message: string) => void>;
  hideNotification: jest.MockedFunction<(id: string) => void>;
  cleanNotifications: jest.MockedFunction<() => void>;
}

export interface MockOfflineContext {
  isOffline: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  pendingOperations: number;
  lastSyncAt: string | null;
  syncNow: jest.MockedFunction<() => Promise<void>>;
  clearCache: jest.MockedFunction<() => Promise<void>>;
}

// Test Data Factory Types
export interface PatientFactory {
  createMockPatient(overrides?: Partial<Patient>): Patient;
  createMockPatients(count: number, overrides?: Partial<Patient>): Patient[];
  createPatientWithEncounters(patientOverrides?: Partial<Patient>, encounterCount?: number): {
    patient: Patient;
    encounters: any[];
  };
}

export interface PractitionerFactory {
  createMockPractitioner(overrides?: Partial<Practitioner>): Practitioner;
  createMockPractitioners(count: number, overrides?: Partial<Practitioner>): Practitioner[];
}

export interface OrganizationFactory {
  createMockOrganization(overrides?: Partial<Organization>): Organization;
  createMockOrganizations(count: number, overrides?: Partial<Organization>): Organization[];
}

// Test Render Options
export interface RenderWithProvidersOptions {
  queryClient?: QueryClient;
  medplumClient?: MedplumClient;
  withErrorBoundary?: boolean;
  withSuspense?: boolean;
  withRouter?: boolean;
  initialEntries?: string[];
  mockData?: MockData;
  user?: User;
  isOffline?: boolean;
}

// Accessibility Testing Types
export interface AccessibilityTestOptions {
  rules?: {
    [rule: string]: { enabled: boolean };
  };
  tags?: string[];
  include?: string[][];
  exclude?: string[][];
  disableColorContrast?: boolean;
}

export interface AccessibilityResult {
  violations: {
    id: string;
    impact: 'minor' | 'moderate' | 'serious' | 'critical';
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{
      html: string;
      target: string[];
      failureSummary: string;
    }>;
  }[];
  passes: Array<{
    id: string;
    description: string;
    help: string;
  }>;
  incomplete: Array<{
    id: string;
    description: string;
    help: string;
  }>;
}

// Mock Service Worker Types
export interface MockServiceWorkerRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
}

export interface MockServiceWorkerResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  delay?: number;
}

export interface MockServiceWorkerHandler {
  method: string;
  path: string | RegExp;
  handler: (req: MockServiceWorkerRequest) => MockServiceWorkerResponse | Promise<MockServiceWorkerResponse>;
}

// Performance Testing Types
export interface PerformanceTestMetrics {
  renderTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  totalBlockingTime: number;
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export interface PerformanceTestOptions {
  timeout?: number;
  samples?: number;
  warmupRuns?: number;
  collectMemoryMetrics?: boolean;
}

// Integration Test Types
export interface IntegrationTestContext extends TestContext {
  apiBaseUrl: string;
  databaseUrl?: string;
  redisUrl?: string;
  cleanup: () => Promise<void>;
}

export interface DatabaseTestUtils {
  seedDatabase: (data: MockData) => Promise<void>;
  clearDatabase: () => Promise<void>;
  createTransaction: () => Promise<any>;
  rollbackTransaction: (transaction: any) => Promise<void>;
}

// E2E Test Types
export interface E2ETestPage {
  goto: (url: string) => Promise<void>;
  waitForSelector: (selector: string, options?: { timeout?: number }) => Promise<void>;
  click: (selector: string) => Promise<void>;
  fill: (selector: string, value: string) => Promise<void>;
  screenshot: (options?: { path?: string; fullPage?: boolean }) => Promise<void>;
  evaluate: (fn: Function, ...args: any[]) => Promise<any>;
}

export interface E2ETestContext {
  page: E2ETestPage;
  baseUrl: string;
  testUser: User;
  cleanup: () => Promise<void>;
}

// Snapshot Testing Types
export interface SnapshotTestOptions {
  threshold?: number;
  includeDOM?: boolean;
  includeStyles?: boolean;
  customSerializer?: (val: any) => string;
}

// Component Testing Utilities
export interface ComponentTestProps {
  [key: string]: any;
}

export interface ComponentTestWrapper {
  rerender: (props: ComponentTestProps) => void;
  unmount: () => void;
  debug: (element?: HTMLElement) => void;
  getByTestId: (testId: string) => HTMLElement;
  queryByTestId: (testId: string) => HTMLElement | null;
  findByTestId: (testId: string) => Promise<HTMLElement>;
  container: HTMLElement;
}

// Mock Store Types
export interface MockStoreState {
  auth: {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
  };
  patients: {
    list: Patient[];
    selected: Patient | null;
    isLoading: boolean;
    error: string | null;
  };
  offline: {
    isOffline: boolean;
    syncStatus: 'idle' | 'syncing' | 'error';
    pendingOperations: number;
    lastSyncAt: string | null;
  };
  ui: {
    sidebarOpen: boolean;
    theme: 'light' | 'dark';
    notifications: Array<{
      id: string;
      message: string;
      type: 'success' | 'error' | 'warning' | 'info';
      timestamp: string;
    }>;
  };
}

// Test Environment Setup
export interface TestEnvironmentConfig {
  testDatabaseUrl: string;
  testRedisUrl: string;
  testApiUrl: string;
  mockExternalAPIs: boolean;
  enableLogging: boolean;
  cleanup: {
    afterEach: boolean;
    afterAll: boolean;
  };
}

// Export all test utility types
export * from '@testing-library/react';
export * from '@testing-library/jest-dom';
export * from '@testing-library/user-event';