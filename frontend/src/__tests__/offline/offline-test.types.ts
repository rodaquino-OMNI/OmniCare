// Offline Test Type Definitions

// Service Worker Sync Manager
export interface SyncManager {
  getTags(): Promise<string[]>;
  register(tag: string): Promise<void>;
}

// Extendable Event for Service Workers
export interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<any>): void;
}

// Fetch Event for Service Workers
export interface FetchEvent extends ExtendableEvent {
  request: Request;
  clientId: string;
  resultingClientId: string;
  replacesClientId: string;
  handled: Promise<undefined>;
  preloadResponse: Promise<any | undefined>;
  respondWith(response: Response | Promise<Response>): void;
}

// Message Event for Service Workers
export interface ExtendableMessageEvent extends ExtendableEvent {
  data: any;
  origin: string;
  lastEventId: string;
  source: Client | ServiceWorker | MessagePort | null;
  ports: readonly MessagePort[];
}

// Service Worker Client
export interface Client {
  id: string;
  type: ClientTypes;
  url: string;
  postMessage(message: any, transfer?: Transferable[]): void;
}

export type ClientTypes = 'window' | 'worker' | 'sharedworker';

// Test utilities for offline functionality
export interface NetworkSimulator {
  mockFetch(): void;
  goOffline(): void;
  goOnline(): void;
  setConditions(conditions: Partial<NetworkConditions>): void;
  intercept(pattern: string | RegExp, options: MockFetchOptions): void;
  restore(): void;
}

export interface NetworkConditions {
  isOnline: boolean;
  latency: number;
  bandwidth: number;
  packetLoss: number;
  errorRate: number;
}

export interface MockFetchOptions {
  delay?: number;
  shouldFail?: boolean;
  failureRate?: number;
  response?: any;
  status?: number;
  headers?: HeadersInit;
}

// Sync conflict types for testing
export interface SyncConflictSimulator {
  createPatientConflict(patientId: string): any;
  createEncounterConflict(encounterId: string): any;
  createVitalSignsConflict(vitalId: string): any;
  createDeleteConflict(resourceType: string, resourceId: string): any;
  resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<any>;
  getConflicts(): any[];
  clear(): void;
}

export type ConflictResolution = 'local' | 'server' | 'merge' | 'manual';

// Service Worker test utilities
export interface ServiceWorkerTestUtils {
  mockNavigatorServiceWorker(): void;
  mockCacheAPI(): void;
  mockBackgroundSync(): SyncManager;
  simulateUpdate(): void;
  simulateActivation(): void;
  simulateMessage(data: any, source?: ServiceWorker): void;
  cleanup(): void;
}

// Cache API types for testing
export interface CacheStorage {
  open(cacheName: string): Promise<Cache>;
  has(cacheName: string): Promise<boolean>;
  delete(cacheName: string): Promise<boolean>;
  keys(): Promise<string[]>;
  match(request: RequestInfo, options?: CacheQueryOptions): Promise<Response | undefined>;
}

export interface Cache {
  match(request: RequestInfo, options?: CacheQueryOptions): Promise<Response | undefined>;
  matchAll(request?: RequestInfo, options?: CacheQueryOptions): Promise<Response[]>;
  add(request: RequestInfo): Promise<void>;
  addAll(requests: RequestInfo[]): Promise<void>;
  put(request: RequestInfo, response: Response): Promise<void>;
  delete(request: RequestInfo, options?: CacheQueryOptions): Promise<boolean>;
  keys(request?: RequestInfo, options?: CacheQueryOptions): Promise<Request[]>;
}

export interface CacheQueryOptions {
  ignoreSearch?: boolean;
  ignoreMethod?: boolean;
  ignoreVary?: boolean;
}

// Note: Global declarations removed to avoid conflicts with TypeScript DOM types

export {};