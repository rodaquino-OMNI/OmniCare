/**
 * Global type definitions for OmniCare
 * This file contains shared type definitions used across frontend and backend
 */

// Extend global namespace
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      NEXT_PUBLIC_API_URL: string;
      NEXT_PUBLIC_MEDPLUM_BASE_URL: string;
      DATABASE_URL: string;
      REDIS_URL: string;
      JWT_SECRET: string;
      [key: string]: string | undefined;
    }
  }

  // Window extensions for service worker and PWA features
  interface Window {
    workbox?: any;
    __NEXT_DATA__?: any;
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    navigator: Navigator & {
      standalone?: boolean;
      storage?: {
        persist?: () => Promise<boolean>;
        estimate?: () => Promise<StorageEstimate>;
      };
    };
    indexedDB: IDBFactory;
  }

  // Jest matchers for testing
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveAccessibleName(name?: string): R;
      toHaveAccessibleDescription(description?: string): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveClass(...classNames: string[]): R;
      toHaveStyle(css: string | Record<string, any>): R;
      toBeVisible(): R;
      toBeEmptyDOMElement(): R;
      toContainElement(element: HTMLElement | null): R;
    }
  }
}

// Common utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

// API Response types
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  stack?: string;
}

// Loading states
export type LoadingState = 'idle' | 'loading' | 'succeeded' | 'failed';

// Generic form field types
export interface FormField<T = any> {
  value: T;
  error?: string;
  touched: boolean;
  disabled?: boolean;
}

// Audit and logging types
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

// Performance monitoring types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags?: Record<string, string>;
}

export {};