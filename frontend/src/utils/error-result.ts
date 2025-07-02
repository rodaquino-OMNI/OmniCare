/**
 * Frontend Result Pattern Implementation
 * Provides type-safe error handling for React applications
 */

/**
 * Result type that represents either a success or failure
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Success type
 */
export class Ok<T> {
  readonly kind = 'ok' as const;
  constructor(public readonly value: T) {}

  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Ok(fn(this.value));
  }

  flatMap<U, F>(fn: (value: T) => Result<U, F>): Result<U, F> {
    return fn(this.value);
  }

  mapError<F>(_fn: (error: never) => F): Result<T, F> {
    return this as unknown as Result<T, F>;
  }

  unwrap(): T {
    return this.value;
  }

  unwrapOr(_defaultValue: T): T {
    return this.value;
  }

  isOk(): this is Ok<T> {
    return true;
  }

  isErr(): this is Err<never> {
    return false;
  }

  match<U>(patterns: { ok: (value: T) => U; err: (error: never) => U }): U {
    return patterns.ok(this.value);
  }
}

/**
 * Failure type
 */
export class Err<E> {
  readonly kind = 'err' as const;
  constructor(public readonly error: E) {}

  map<U>(_fn: (value: never) => U): Result<U, E> {
    return this as unknown as Result<U, E>;
  }

  flatMap<U, F>(_fn: (value: never) => Result<U, F>): Result<U, E | F> {
    return this as unknown as Result<U, E | F>;
  }

  mapError<F>(fn: (error: E) => F): Result<never, F> {
    return new Err(fn(this.error));
  }

  unwrap(): never {
    if (this.error instanceof Error) {
      throw this.error;
    }
    throw new Error(String(this.error));
  }

  unwrapOr<T>(defaultValue: T): T {
    return defaultValue;
  }

  isOk(): this is Ok<never> {
    return false;
  }

  isErr(): this is Err<E> {
    return true;
  }

  match<U>(patterns: { ok: (value: never) => U; err: (error: E) => U }): U {
    return patterns.err(this.error);
  }
}

/**
 * Constructor functions
 */
export const ok = <T>(value: T): Ok<T> => new Ok(value);
export const err = <E>(error: E): Err<E> => new Err(error);

/**
 * Type guards
 */
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.isOk();
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => result.isErr();

/**
 * Utility functions for React/Frontend
 */

/**
 * Try to execute a function and return Result
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  onError?: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    if (onError) {
      return err(onError(error));
    }
    return err(error as E);
  }
}

/**
 * Async version of tryCatch
 */
export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T>,
  onError?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (onError) {
      return err(onError(error));
    }
    return err(error as E);
  }
}

/**
 * Convert fetch response to Result
 */
export async function fetchResult<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Result<T, Error>> {
  try {
    const response = await fetch(input, init);
    
    if (!response.ok) {
      return err(new Error(`HTTP ${response.status}: ${response.statusText}`));
    }
    
    const data = await response.json();
    return ok(data);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Convert Promise to Result
 */
export async function promiseToResult<T, E = Error>(
  promise: Promise<T>,
  onError?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    if (onError) {
      return err(onError(error));
    }
    return err(error as E);
  }
}

/**
 * React hook for handling Results
 */
import { useState, useCallback } from 'react';

export function useResult<T, E = Error>() {
  const [result, setResult] = useState<Result<T, E> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(async (fn: () => Promise<Result<T, E>>) => {
    setIsLoading(true);
    try {
      const result = await fn();
      setResult(result);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const executeSync = useCallback((fn: () => Result<T, E>) => {
    const result = fn();
    setResult(result);
    return result;
  }, []);

  const clear = useCallback(() => {
    setResult(null);
  }, []);

  return {
    result,
    isLoading,
    isSuccess: result?.isOk() ?? false,
    isError: result?.isErr() ?? false,
    data: result?.isOk() ? result.value : undefined,
    error: result?.isErr() ? result.error : undefined,
    execute,
    executeSync,
    clear
  };
}

/**
 * React hook for async operations with Result
 */
export function useAsync<T, E = Error>(
  asyncFn: () => Promise<T>,
  deps: React.DependencyList = []
) {
  const [result, setResult] = useState<Result<T, E> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(async () => {
    setIsLoading(true);
    const result = await tryCatchAsync(asyncFn);
    setResult(result as Result<T, E>);
    setIsLoading(false);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asyncFn, ...deps]);

  return {
    result,
    isLoading,
    isSuccess: result?.isOk() ?? false,
    isError: result?.isErr() ?? false,
    data: result?.isOk() ? result.value : undefined,
    error: result?.isErr() ? result.error : undefined,
    execute
  };
}

/**
 * Result-based API client
 */
export class ResultApiClient {
  constructor(
    private baseUrl: string = '',
    private defaultHeaders: Record<string, string> = {}
  ) {}

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Result<T, Error>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.defaultHeaders,
      ...options.headers
    };

    return fetchResult<T>(url, {
      ...options,
      headers
    });
  }

  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<Result<T, Error>> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<Result<T, Error>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers
    });
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<Result<T, Error>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers
    });
  }

  async delete<T>(
    endpoint: string,
    headers?: Record<string, string>
  ): Promise<Result<T, Error>> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }

  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  removeAuthToken(): void {
    delete this.defaultHeaders['Authorization'];
  }
}

/**
 * Type aliases for common Result types
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
export type VoidResult<E = Error> = Result<void, E>;
export type AsyncVoidResult<E = Error> = Promise<VoidResult<E>>;