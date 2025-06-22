/**
 * Extended Service Worker types for background sync and PWA features
 */

/// <reference lib="webworker" />

// Extend the ServiceWorkerRegistration interface to include sync
declare global {
  interface ServiceWorkerRegistration {
    sync?: ServiceWorkerSync;
    periodicSync?: ServiceWorkerPeriodicSync;
  }

  interface ServiceWorkerSync {
    register(tag: string): Promise<void>;
    getTags(): Promise<string[]>;
  }

  interface ServiceWorkerPeriodicSync {
    register(tag: string, options?: { minInterval?: number }): Promise<void>;
    getTags(): Promise<string[]>;
    unregister(tag: string): Promise<void>;
  }

  // Background Sync Event
  interface SyncEvent extends ExtendableEvent {
    tag: string;
    lastChance: boolean;
  }

  // Periodic Sync Event
  interface PeriodicSyncEvent extends ExtendableEvent {
    tag: string;
  }

  // Service Worker Global Scope extensions
  interface ServiceWorkerGlobalScope {
    addEventListener(type: 'sync', listener: (event: SyncEvent) => void): void;
    addEventListener(type: 'periodicsync', listener: (event: PeriodicSyncEvent) => void): void;
    addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  }

  // For Service Worker context
  declare var self: ServiceWorkerGlobalScope;
}

// PWA Manifest types
export interface PWAManifest {
  name: string;
  short_name: string;
  description?: string;
  start_url: string;
  display: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser';
  orientation?: 'portrait' | 'landscape' | 'any';
  theme_color: string;
  background_color: string;
  icons: PWAIcon[];
  scope?: string;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  categories?: string[];
  screenshots?: PWAScreenshot[];
}

export interface PWAIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: 'maskable' | 'any' | 'badge';
}

export interface PWAScreenshot {
  src: string;
  sizes: string;
  type: string;
  label?: string;
}

// Cache API extensions
export interface CacheStorage {
  open(cacheName: string): Promise<Cache>;
  match(request: RequestInfo, options?: CacheQueryOptions): Promise<Response | undefined>;
  has(cacheName: string): Promise<boolean>;
  delete(cacheName: string): Promise<boolean>;
  keys(): Promise<string[]>;
}

// Notification API extensions for PWA
export interface NotificationOptions {
  actions?: NotificationAction[];
  badge?: string;
  body?: string;
  data?: any;
  dir?: 'auto' | 'ltr' | 'rtl';
  icon?: string;
  image?: string;
  lang?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  silent?: boolean;
  tag?: string;
  timestamp?: number;
  vibrate?: number[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

// Background Fetch API (experimental)
export interface ServiceWorkerRegistration {
  backgroundFetch?: BackgroundFetch;
}

export interface BackgroundFetch {
  fetch(id: string, request: RequestInfo, options?: { icons?: PWAIcon[]; title?: string; downloadTotal?: number }): Promise<BackgroundFetchRegistration>;
  get(id: string): Promise<BackgroundFetchRegistration | undefined>;
  getIds(): Promise<string[]>;
}

export interface BackgroundFetchRegistration {
  id: string;
  uploadTotal: number;
  uploaded: number;
  downloadTotal: number;
  downloaded: number;
  result: '' | 'success' | 'failure';
  failureReason: '' | 'aborted' | 'bad-status' | 'fetch-error' | 'quota-exceeded' | 'download-total-exceeded';
  recordsAvailable: boolean;
  abort(): Promise<boolean>;
  match(request: RequestInfo, options?: CacheQueryOptions): Promise<BackgroundFetchRecord | undefined>;
  matchAll(request?: RequestInfo, options?: CacheQueryOptions): Promise<BackgroundFetchRecord[]>;
}

export interface BackgroundFetchRecord {
  request: Request;
  responseReady: Promise<Response>;
}

// Web Share API
export interface Navigator {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
}

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

// Workbox types (if using Workbox)
export interface WorkboxConfig {
  globDirectory?: string;
  globPatterns?: string[];
  swDest?: string;
  clientsClaim?: boolean;
  skipWaiting?: boolean;
  runtimeCaching?: RuntimeCachingEntry[];
}

export interface RuntimeCachingEntry {
  urlPattern: RegExp | string;
  handler: 'CacheFirst' | 'CacheOnly' | 'NetworkFirst' | 'NetworkOnly' | 'StaleWhileRevalidate';
  options?: {
    cacheName?: string;
    expiration?: {
      maxEntries?: number;
      maxAgeSeconds?: number;
    };
    cacheKeyWillBeUsed?: (request: Request) => Promise<string>;
    cacheWillUpdate?: (response: Response) => Promise<Response | undefined>;
  };
}