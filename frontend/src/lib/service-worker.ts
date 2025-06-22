import { showNotification } from '@mantine/notifications';
import '@/types/service-worker';

interface ServiceWorkerConfig {
  onUpdate?: () => void;
  onOffline?: () => void;
  onOnline?: () => void;
  onBackgroundSync?: () => void;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig = {};
  private isOnline = navigator.onLine;
  private syncQueue: Map<string, any> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupEventListeners();
    }
  }

  private setupEventListeners() {
    // Online/offline event listeners
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Service worker message handler
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', this.handleMessage.bind(this));
    }
  }

  private handleOnline() {
    this.isOnline = true;
    this.config.onOnline?.();
    
    showNotification({
      title: 'Back Online',
      message: 'Your connection has been restored. Syncing data...',
      color: 'green',
    });

    // Trigger background sync
    this.triggerSync('sync-clinical-data');
  }

  private handleOffline() {
    this.isOnline = false;
    this.config.onOffline?.();
    
    showNotification({
      title: 'You\'re Offline',
      message: 'Don\'t worry, you can continue working. Changes will sync when you\'re back online.',
      color: 'orange',
    });
  }

  private handleMessage(event: MessageEvent) {
    const { type, data } = event.data;

    switch (type) {
      case 'sync-complete':
        this.handleSyncComplete(data);
        break;
      case 'update-available':
        this.handleUpdateAvailable();
        break;
      case 'cache-updated':
        this.handleCacheUpdated(data);
        break;
    }
  }

  private handleSyncComplete(data: any) {
    this.syncQueue.delete(data.id);
    
    showNotification({
      title: 'Data Synced',
      message: `${data.resource} has been synchronized`,
      color: 'green',
    });
    
    this.config.onBackgroundSync?.();
  }

  private handleUpdateAvailable() {
    showNotification({
      title: 'Update Available',
      message: 'A new version of OmniCare is available. Click to update.',
      color: 'blue',
      onClick: () => this.updateServiceWorker(),
    });
    
    this.config.onUpdate?.();
  }

  private handleCacheUpdated(data: any) {
    console.log('[ServiceWorker] Cache updated:', data);
  }

  async register(config: ServiceWorkerConfig = {}): Promise<boolean> {
    this.config = config;

    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers are not supported in this browser');
      return false;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[ServiceWorker] Registration successful');

      // Check for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              this.handleUpdateAvailable();
            }
          });
        }
      });

      // Check if service worker was updated
      if (this.registration.waiting) {
        this.handleUpdateAvailable();
      }

      return true;
    } catch (error) {
      console.error('[ServiceWorker] Registration failed:', error);
      return false;
    }
  }

  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const success = await this.registration.unregister();
      this.registration = null;
      return success;
    } catch (error) {
      console.error('[ServiceWorker] Unregistration failed:', error);
      return false;
    }
  }

  async updateServiceWorker() {
    if (!this.registration?.waiting) {
      return;
    }

    // Tell waiting service worker to take control
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload page when new service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  async triggerSync(tag: string) {
    if (!this.registration || !('sync' in this.registration)) {
      console.warn('Background sync is not supported');
      return;
    }

    try {
      // Check if registration has sync property and call register
      const syncRegistration = this.registration.sync;
      if (syncRegistration && typeof syncRegistration.register === 'function') {
        await syncRegistration.register(tag);
        console.log(`[ServiceWorker] Sync registered: ${tag}`);
      } else {
        console.warn('Sync registration method not available');
      }
    } catch (error) {
      console.error('[ServiceWorker] Sync registration failed:', error);
    }
  }

  async queueForSync(data: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
    resource: string;
  }) {
    if (!this.registration) {
      throw new Error('Service Worker not registered');
    }

    const id = `${Date.now()}-${Math.random()}`;
    this.syncQueue.set(id, data);

    // Send to service worker
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'queue-sync',
        data: { id, ...data },
      });
    }

    // Request background sync
    await this.triggerSync('sync-clinical-data');

    return id;
  }

  async cachePatientData(patientId: string) {
    if (!navigator.serviceWorker.controller) {
      return;
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'cache-patient-data',
      data: { patientId },
    });
  }

  async clearCache(cacheName?: string) {
    if (!navigator.serviceWorker.controller) {
      return;
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'clear-cache',
      data: { cacheName },
    });
  }

  async getCacheStatus(): Promise<any> {
    if (!navigator.serviceWorker.controller) {
      return null;
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      navigator.serviceWorker.controller!.postMessage(
        { type: 'get-cache-status' },
        [channel.port2]
      );
    });
  }

  isOffline(): boolean {
    return !this.isOnline;
  }

  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

// Export types
export type { ServiceWorkerConfig };

// Helper hooks for React components
export function useServiceWorker() {
  return {
    isOffline: serviceWorkerManager.isOffline(),
    queueForSync: serviceWorkerManager.queueForSync.bind(serviceWorkerManager),
    cachePatientData: serviceWorkerManager.cachePatientData.bind(serviceWorkerManager),
    clearCache: serviceWorkerManager.clearCache.bind(serviceWorkerManager),
    getCacheStatus: serviceWorkerManager.getCacheStatus.bind(serviceWorkerManager),
  };
}

// Utility function to handle offline API calls
export async function offlineApiCall<T>(
  call: () => Promise<T>,
  fallback: () => T | Promise<T>,
  options?: {
    cacheKey?: string;
    syncOnReconnect?: boolean;
    resource?: string;
  }
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!navigator.onLine || (error as any).code === 'NETWORK_ERROR') {
      console.log('[OfflineAPI] Falling back to offline mode');
      
      // Queue for sync if requested
      if (options?.syncOnReconnect) {
        const request = (error as any).request;
        if (request) {
          await serviceWorkerManager.queueForSync({
            url: request.url,
            method: request.method,
            headers: request.headers,
            body: request.body,
            resource: options.resource || 'unknown',
          });
        }
      }
      
      return await fallback();
    }
    throw error;
  }
}