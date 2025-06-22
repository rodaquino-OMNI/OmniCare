/**
 * Type Guards Utility Module
 * 
 * This module provides a comprehensive set of type guards for runtime type checking
 * and TypeScript type narrowing. These utilities help eliminate type errors and
 * provide type-safe runtime validation.
 */

/**
 * Primitive Type Guards
 */

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

export function isSymbol(value: unknown): value is symbol {
  return typeof value === 'symbol';
}

export function isBigInt(value: unknown): value is bigint {
  return typeof value === 'bigint';
}

/**
 * Null/Undefined Guards
 */

export function isNull(value: unknown): value is null {
  return value === null;
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Object Type Guards
 */

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

export function hasProperty<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

export function hasProperties<K extends PropertyKey>(
  obj: unknown,
  ...keys: K[]
): obj is Record<K, unknown> {
  return isObject(obj) && keys.every(key => key in obj);
}

export function hasDefinedProperty<K extends PropertyKey, T>(
  obj: unknown,
  key: K,
  typeGuard?: (value: unknown) => value is T
): obj is Record<K, T> {
  if (!hasProperty(obj, key)) return false;
  const value = obj[key];
  if (!isDefined(value)) return false;
  return typeGuard ? typeGuard(value) : true;
}

/**
 * Array Type Guards
 */

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isArrayOf<T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): value is T[] {
  return isArray(value) && value.every(itemGuard);
}

export function isNonEmptyArray<T>(value: T[]): value is [T, ...T[]] {
  return value.length > 0;
}

export function isStringArray(value: unknown): value is string[] {
  return isArrayOf(value, isString);
}

export function isNumberArray(value: unknown): value is number[] {
  return isArrayOf(value, isNumber);
}

/**
 * FHIR Resource Type Guards
 */

interface FHIRResource {
  resourceType: string;
  id?: string;
}

export function isFHIRResource(value: unknown): value is FHIRResource {
  return hasProperty(value, 'resourceType') && isString(value.resourceType);
}

export function isFHIRResourceType<T extends FHIRResource>(
  value: unknown,
  resourceType: T['resourceType']
): value is T {
  return isFHIRResource(value) && value.resourceType === resourceType;
}

export function isPatientResource(value: unknown): value is { resourceType: 'Patient' } {
  return isFHIRResourceType(value, 'Patient');
}

export function isPractitionerResource(value: unknown): value is { resourceType: 'Practitioner' } {
  return isFHIRResourceType(value, 'Practitioner');
}

export function isOrganizationResource(value: unknown): value is { resourceType: 'Organization' } {
  return isFHIRResourceType(value, 'Organization');
}

/**
 * Reference Type Guards
 */

interface Reference<T = unknown> {
  reference?: string;
  type?: string;
  display?: string;
}

export function isReference(value: unknown): value is Reference {
  return hasProperty(value, 'reference') || hasProperty(value, 'type');
}

export function isReferenceToType<T extends string>(
  value: unknown,
  type: T
): value is Reference {
  if (!isReference(value)) return false;
  if (value.type === type) return true;
  if (value.reference && value.reference.startsWith(`${type}/`)) return true;
  return false;
}

/**
 * User and Auth Type Guards
 */

interface UserWithPassword {
  id: string;
  passwordHash: string;
}

export function hasPasswordHash(user: unknown): user is UserWithPassword {
  return hasDefinedProperty(user, 'passwordHash', isString) &&
         hasDefinedProperty(user, 'id', isString);
}

interface AuthTokenWithSession {
  sessionId: string;
}

export function hasSessionId(token: unknown): token is AuthTokenWithSession {
  return hasDefinedProperty(token, 'sessionId', isString);
}

interface UserWithMFA {
  mfaSecretEncrypted?: string;
  isMfaEnabled?: boolean;
}

export function hasMFAProperties(user: unknown): user is UserWithMFA {
  return hasProperty(user, 'mfaSecretEncrypted') || hasProperty(user, 'isMfaEnabled');
}

/**
 * Error Type Guards
 */

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function isErrorWithCode(error: unknown): error is Error & { code: string } {
  return isError(error) && hasProperty(error, 'code') && isString(error.code);
}

export function isErrorWithStatus(error: unknown): error is Error & { status: number } {
  return isError(error) && hasProperty(error, 'status') && isNumber(error.status);
}

/**
 * Date Type Guards
 */

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

export function isValidDateString(value: unknown): value is string {
  return isString(value) && !isNaN(Date.parse(value));
}

/**
 * Functional Type Guards
 */

export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return isObject(value) && isFunction((value as any).then) && isFunction((value as any).catch);
}

export function isAsyncFunction(value: unknown): value is (...args: any[]) => Promise<any> {
  return isFunction(value) && value.constructor.name === 'AsyncFunction';
}

/**
 * Record Type Guards with Index Signature
 */

export function isRecordWithIndexSignature(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  
  // Check if it's a plain object that can have index signature
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype || proto.constructor === Object;
}

export function toRecordWithIndexSignature<T extends Record<string, any>>(
  value: T
): Record<string, unknown> {
  return { ...value } as Record<string, unknown>;
}

/**
 * Complex Type Guards
 */

export function isOneOf<T>(
  value: unknown,
  guards: Array<(value: unknown) => value is T>
): value is T {
  return guards.some(guard => guard(value));
}

export function isAllOf<T extends readonly unknown[]>(
  value: unknown,
  guards: { [K in keyof T]: (value: unknown) => value is T[K] }
): value is T[number] {
  return guards.every(guard => guard(value));
}

/**
 * Safe Type Narrowing Utilities
 */

export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (!isDefined(value)) {
    throw new Error(message || 'Value is null or undefined');
  }
}

export function assertString(value: unknown, message?: string): asserts value is string {
  if (!isString(value)) {
    throw new TypeError(message || `Expected string, got ${typeof value}`);
  }
}

export function assertNumber(value: unknown, message?: string): asserts value is number {
  if (!isNumber(value)) {
    throw new TypeError(message || `Expected number, got ${typeof value}`);
  }
}

export function assertObject(value: unknown, message?: string): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new TypeError(message || `Expected object, got ${typeof value}`);
  }
}

/**
 * Safe Property Access
 */

export function getProperty<T, K extends keyof T>(
  obj: T,
  key: K,
  defaultValue?: T[K]
): T[K] | undefined {
  return isDefined(obj) && hasProperty(obj, key) ? obj[key] : defaultValue;
}

export function getDefinedProperty<T, K extends keyof T>(
  obj: T,
  key: K,
  defaultValue: T[K]
): T[K] {
  const value = getProperty(obj, key);
  return isDefined(value) ? value : defaultValue;
}

/**
 * Type Coercion Utilities
 */

export function ensureArray<T>(value: T | T[]): T[] {
  return isArray(value) ? value : [value];
}

export function ensureString(value: unknown, defaultValue = ''): string {
  return isString(value) ? value : defaultValue;
}

export function ensureNumber(value: unknown, defaultValue = 0): number {
  return isNumber(value) ? value : defaultValue;
}

export function ensureBoolean(value: unknown, defaultValue = false): boolean {
  return isBoolean(value) ? value : defaultValue;
}

/**
 * Export all type guards as a namespace for convenience
 */
export const TypeGuards = {
  // Primitives
  isString,
  isNumber,
  isBoolean,
  isFunction,
  isSymbol,
  isBigInt,
  
  // Null/Undefined
  isNull,
  isUndefined,
  isNullOrUndefined,
  isDefined,
  isNotNull,
  isNotUndefined,
  
  // Objects
  isObject,
  isPlainObject,
  hasProperty,
  hasProperties,
  hasDefinedProperty,
  
  // Arrays
  isArray,
  isArrayOf,
  isNonEmptyArray,
  isStringArray,
  isNumberArray,
  
  // FHIR
  isFHIRResource,
  isFHIRResourceType,
  isPatientResource,
  isPractitionerResource,
  isOrganizationResource,
  isReference,
  isReferenceToType,
  
  // Auth
  hasPasswordHash,
  hasSessionId,
  hasMFAProperties,
  
  // Errors
  isError,
  isErrorWithCode,
  isErrorWithStatus,
  
  // Dates
  isDate,
  isValidDateString,
  
  // Functional
  isPromise,
  isAsyncFunction,
  
  // Records
  isRecordWithIndexSignature,
  toRecordWithIndexSignature,
  
  // Complex
  isOneOf,
  isAllOf,
  
  // Assertions
  assertDefined,
  assertString,
  assertNumber,
  assertObject,
  
  // Safe Access
  getProperty,
  getDefinedProperty,
  
  // Coercion
  ensureArray,
  ensureString,
  ensureNumber,
  ensureBoolean
};