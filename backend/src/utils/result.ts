/**
 * Result/Either Monad Pattern Implementation for TypeScript
 * Provides a type-safe way to handle operations that can fail
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

  /**
   * Map the success value
   */
  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Ok(fn(this.value));
  }

  /**
   * FlatMap (bind) the success value
   */
  flatMap<U, F>(fn: (value: T) => Result<U, F>): Result<U, F> {
    return fn(this.value);
  }

  /**
   * Map the error (no-op for Ok)
   */
  mapError<F>(_fn: (error: never) => F): Result<T, F> {
    return this as unknown as Result<T, F>;
  }

  /**
   * Provide alternative value (returns current value)
   */
  orElse<U>(_fn: () => Result<U, never>): Result<T | U, never> {
    return this;
  }

  /**
   * Extract value or throw
   */
  unwrap(): T {
    return this.value;
  }

  /**
   * Extract value or provide default
   */
  unwrapOr(_defaultValue: T): T {
    return this.value;
  }

  /**
   * Check if result is Ok
   */
  isOk(): this is Ok<T> {
    return true;
  }

  /**
   * Check if result is Err
   */
  isErr(): this is Err<never> {
    return false;
  }

  /**
   * Match pattern
   */
  match<U>(patterns: {
    ok: (value: T) => U;
    err: (error: never) => U;
  }): U {
    return patterns.ok(this.value);
  }

  /**
   * Convert to Promise
   */
  toPromise(): Promise<T> {
    return Promise.resolve(this.value);
  }
}

/**
 * Failure type
 */
export class Err<E> {
  readonly kind = 'err' as const;
  constructor(public readonly error: E) {}

  /**
   * Map the success value (no-op for Err)
   */
  map<U>(_fn: (value: never) => U): Result<U, E> {
    return this as unknown as Result<U, E>;
  }

  /**
   * FlatMap (bind) the success value (no-op for Err)
   */
  flatMap<U, F>(_fn: (value: never) => Result<U, F>): Result<U, E | F> {
    return this as unknown as Result<U, E | F>;
  }

  /**
   * Map the error
   */
  mapError<F>(fn: (error: E) => F): Result<never, F> {
    return new Err(fn(this.error));
  }

  /**
   * Provide alternative value
   */
  orElse<U, F>(fn: () => Result<U, F>): Result<U, F> {
    return fn();
  }

  /**
   * Extract value or throw
   */
  unwrap(): never {
    if (this.error instanceof Error) {
      throw this.error;
    }
    throw new Error(String(this.error));
  }

  /**
   * Extract value or provide default
   */
  unwrapOr<T>(defaultValue: T): T {
    return defaultValue;
  }

  /**
   * Check if result is Ok
   */
  isOk(): this is Ok<never> {
    return false;
  }

  /**
   * Check if result is Err
   */
  isErr(): this is Err<E> {
    return true;
  }

  /**
   * Match pattern
   */
  match<U>(patterns: {
    ok: (value: never) => U;
    err: (error: E) => U;
  }): U {
    return patterns.err(this.error);
  }

  /**
   * Convert to Promise
   */
  toPromise(): Promise<never> {
    if (this.error instanceof Error) {
      return Promise.reject(this.error);
    }
    return Promise.reject(new Error(String(this.error)));
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
 * Utility functions
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
 * Convert Result array to array Result
 */
export function sequence<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  
  for (const result of results) {
    if (result.isErr()) {
      return result as unknown as Err<E>;
    }
    values.push(result.value);
  }
  
  return ok(values);
}

/**
 * Combine multiple Results
 */
export function combine<T extends readonly Result<unknown, unknown>[]>(
  ...results: T
): Result<
  { [K in keyof T]: T[K] extends Result<infer U, unknown> ? U : never },
  T[number] extends Result<unknown, infer E> ? E : never
> {
  const values: unknown[] = [];
  
  for (const result of results) {
    if (result.isErr()) {
      return result as any;
    }
    values.push(result.unwrap());
  }
  
  return ok(values as any);
}

/**
 * Map over an array with a Result-returning function
 */
export async function traverse<T, U, E>(
  items: T[],
  fn: (item: T) => Promise<Result<U, E>>
): Promise<Result<U[], E>> {
  const results: U[] = [];
  
  for (const item of items) {
    const result = await fn(item);
    if (result.isErr()) {
      return result as unknown as Err<E>;
    }
    results.push(result.value);
  }
  
  return ok(results);
}

/**
 * Retry a Result-returning function
 */
export async function retry<T, E>(
  fn: () => Promise<Result<T, E>>,
  options: {
    times: number;
    delay?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number, error: E) => void;
  }
): Promise<Result<T, E>> {
  let lastError: E | undefined;
  
  for (let attempt = 1; attempt <= options.times; attempt++) {
    const result = await fn();
    
    if (result.isOk()) {
      return result;
    }
    
    lastError = result.error;
    
    if (options.onRetry) {
      options.onRetry(attempt, lastError);
    }
    
    if (attempt < options.times && options.delay) {
      const delay = options.backoff === 'exponential' 
        ? options.delay * Math.pow(2, attempt - 1)
        : options.delay;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return err(lastError!);
}

/**
 * Type alias for common Result types
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
export type VoidResult<E = Error> = Result<void, E>;
export type AsyncVoidResult<E = Error> = Promise<VoidResult<E>>;