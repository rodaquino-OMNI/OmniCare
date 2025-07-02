/**
 * Main type definitions index file
 * Re-exports all shared types for easy importing
 */

// Re-export all shared types
export * from './global';
export * from './shared';
export * from './modules';
export * from './missing-packages';

// Type utility helpers
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type NonNullable<T> = T extends null | undefined ? never : T;

export type ValueOf<T> = T[keyof T];

export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

// Common branded types for type safety
export type UserId = string & { __brand: 'UserId' };
export type PatientId = string & { __brand: 'PatientId' };
export type EncounterId = string & { __brand: 'EncounterId' };
export type PractitionerId = string & { __brand: 'PractitionerId' };

// Helper functions for branded types
export const createUserId = (id: string): UserId => id as UserId;
export const createPatientId = (id: string): PatientId => id as PatientId;
export const createEncounterId = (id: string): EncounterId => id as EncounterId;
export const createPractitionerId = (id: string): PractitionerId => id as PractitionerId;

// Environment-specific type guards
export const isProduction = (): boolean => process.env.NODE_ENV === 'production';
export const isDevelopment = (): boolean => process.env.NODE_ENV === 'development';
export const isTest = (): boolean => process.env.NODE_ENV === 'test';

// Type assertion helpers
export const assertNever = (value: never): never => {
  throw new Error(`Unexpected value: ${value}`);
};

export const isNotNull = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined;
};

export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value);
};

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const isArray = <T>(value: unknown): value is T[] => {
  return Array.isArray(value);
};

// Result type for better error handling
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export const Ok = <T>(data: T): Result<T, never> => ({ success: true, data });
export const Err = <E>(error: E): Result<never, E> => ({ success: false, error });

// Promise utilities
export type PromiseResult<T> = Promise<Result<T, Error>>;

export const tryAsync = async <T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> => {
  try {
    const data = await fn();
    return Ok(data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
};

// Event emitter types
export interface TypedEventEmitter<T extends Record<string, any[]>> {
  on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): this;
  off<K extends keyof T>(event: K, listener: (...args: T[K]) => void): this;
  emit<K extends keyof T>(event: K, ...args: T[K]): boolean;
  once<K extends keyof T>(event: K, listener: (...args: T[K]) => void): this;
  removeAllListeners<K extends keyof T>(event?: K): this;
  listenerCount<K extends keyof T>(event: K): number;
  listeners<K extends keyof T>(event: K): Array<(...args: T[K]) => void>;
}

// Common application events
export interface AppEvents {
  'user:login': [UserId];
  'user:logout': [UserId];
  'patient:created': [PatientId];
  'patient:updated': [PatientId];
  'patient:deleted': [PatientId];
  'encounter:created': [EncounterId];
  'encounter:updated': [EncounterId];
  'sync:started': [];
  'sync:completed': [{ success: boolean; errors?: string[] }];
  'error': [Error];
  'network:online': [];
  'network:offline': [];
}

// Configuration type
export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  database: {
    url: string;
    ssl: boolean;
    pool: {
      min: number;
      max: number;
    };
  };
  redis: {
    url: string;
    keyPrefix: string;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    refreshTokenExpiresIn: string;
  };
  medplum: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
  };
  features: {
    offline: boolean;
    caching: boolean;
    analytics: boolean;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    format: 'json' | 'simple';
  };
}