import { notifications } from '@mantine/notifications';
import { getOfflineSyncService } from '@/services/offline-sync.service';
/// <reference path="../types/service-worker.d.ts" />

interface ServiceWorkerConfig {
  onUpdate?: () => void;
  onOffline?: () => void;
  onOnline?: () => void;
  onBackgroundSync?: () => void;
  onInstalled?: (registration: ServiceWorkerRegistration) => void;
  onActivated?: (registration: ServiceWorkerRegistration) => void;
  onControllerChange?: () => void;
  enablePeriodSync?: boolean;
  immediate?: boolean;
}

interface QueuedRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  resource?: string;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig = {};
  private isOnline = navigator.onLine;
  private syncQueue: Map<string, any> = new Map();
  private sessionRestored = false;
  private resumeHandlers: Map<string, () => void> = new Map();
  private messageHandlers = new Map<string, (data: any) => void>();
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private offlineSyncService = typeof window !== 'undefined' ? getOfflineSyncService() : null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupEventListeners();
      this.restoreSession();
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
    
    notifications.show({
      title: 'Back Online',
      message: 'Your connection has been restored. Syncing data...',
      color: 'green',
    });

    // Resume any interrupted operations
    this.resumeInterruptedOperations();
    
    // Trigger background sync
    this.triggerSync('sync-clinical-data');
  }

  private handleOffline() {
    this.isOnline = false;
    this.config.onOffline?.();
    
    notifications.show({
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
    
    notifications.show({
      title: 'Data Synced',
      message: `${data.resource} has been synchronized`,
      color: 'green',
    });
    
    this.config.onBackgroundSync?.();
  }

  private handleUpdateAvailable() {
    notifications.show({
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
      // Only register in production or with explicit flag
      if (process.env.NODE_ENV !== 'production' && !process.env.NEXT_PUBLIC_ENABLE_SW) {
        console.log('Service Worker registration skipped in development');
        return false;
      }

      // Wait for window load unless immediate registration requested
      if (!config.immediate && typeof window !== 'undefined') {
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve(undefined);
          } else {
            window.addEventListener('load', () => resolve(undefined));
          }
        });
      }

      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // Always check for updates
      });

      console.log('[ServiceWorker] Registration successful');

      // Enhanced event listeners
      this.setupEnhancedEventListeners();

      // Check for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New update available
                console.log('New Service Worker update available');
                this.handleUpdateAvailable();
              } else {
                // First install
                console.log('Service Worker installed for the first time');
                config.onInstalled?.(this.registration!);
              }
            } else if (newWorker.state === 'activated') {
              console.log('Service Worker activated');
              config.onActivated?.(this.registration!);
            }
          });
        }
      });

      // Check if service worker was updated
      if (this.registration.waiting) {
        this.handleUpdateAvailable();
      }

      // Request persistent storage for offline data
      await this.requestPersistentStorage();

      // Enable periodic background sync if supported and requested
      if (config.enablePeriodSync) {
        await this.enablePeriodicSync();
      }

      // Start update check interval
      this.startUpdateCheck();

      // Initialize offline sync service
      if (this.offlineSyncService) {
        await this.offlineSyncService.initialize();
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
    
    // Save session data for recovery
    this.saveSessionData();

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
  
  /**
   * Restore session from previous browser session
   */
  private async restoreSession(): Promise<void> {
    if (this.sessionRestored) return;
    
    try {
      const sessionData = localStorage.getItem('sw_session_data');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        
        // Restore sync queue
        if (session.syncQueue) {
          session.syncQueue.forEach((item: any) => {
            this.syncQueue.set(item.id, item);
          });
        }
        
        // Resume operations if interrupted recently
        if (session.lastActivity) {
          const timeSinceActivity = Date.now() - session.lastActivity;
          const maxResumeTime = 10 * 60 * 1000; // 10 minutes
          
          if (timeSinceActivity < maxResumeTime && this.isOnline) {
            await this.resumeInterruptedOperations();
          }
        }
      }
      
      this.sessionRestored = true;
    } catch (error) {
      console.error('Failed to restore service worker session:', error);
    }
  }
  
  /**
   * Resume interrupted operations
   */
  private async resumeInterruptedOperations(): Promise<void> {
    try {
      // Resume sync operations
      if (this.syncQueue.size > 0) {
        await this.triggerSync('sync-clinical-data');
      }
      
      // Trigger resume handlers
      this.resumeHandlers.forEach(handler => {
        try {
          handler();
        } catch (error) {
          console.error('Resume handler error:', error);
        }
      });
      
      // Notify about resumption
      if (this.syncQueue.size > 0) {
        notifications.show({
          title: 'Session Resumed',
          message: 'Continuing previous sync operations...',
          color: 'blue',
        });
      }
    } catch (error) {
      console.error('Failed to resume interrupted operations:', error);
    }
  }
  
  /**
   * Save session data for recovery
   */
  private saveSessionData(): void {
    try {
      const sessionData = {
        syncQueue: Array.from(this.syncQueue.values()),
        lastActivity: Date.now(),
        isOnline: this.isOnline
      };
      
      localStorage.setItem('sw_session_data', JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save session data:', error);
    }
  }
  
  /**
   * Register resume handler
   */
  onResume(id: string, handler: () => void): void {
    this.resumeHandlers.set(id, handler);
  }
  
  /**
   * Unregister resume handler
   */
  offResume(id: string): void {
    this.resumeHandlers.delete(id);
  }

  /**
   * Set up enhanced event listeners
   */
  private setupEnhancedEventListeners(): void {
    // Handle controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service Worker controller changed');
      this.config.onControllerChange?.();
    });

    // Enhanced message handling
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, data } = event.data;
      
      // Handle specific message types
      if (type.startsWith('sw-')) {
        const handlerType = type.substring(3);
        const handler = this.messageHandlers.get(handlerType);
        if (handler) {
          handler(data);
        }
      }
      
      // Continue with existing message handling
      this.handleMessage(event);
    });
  }

  /**
   * Request persistent storage
   */
  private async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const granted = await navigator.storage.persist();
        
        if (granted) {
          console.log('Persistent storage granted');
        } else {
          console.log('Persistent storage denied');
        }
        
        return granted;
      } catch (error) {
        console.error('Failed to request persistent storage:', error);
        return false;
      }
    }
    
    return false;
  }

  /**
   * Enable periodic background sync
   */
  private async enablePeriodicSync(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }
    
    // Check if periodic sync is supported
    if ('periodicSync' in ServiceWorkerRegistration.prototype) {
      try {
        // Request permission
        const status = await navigator.permissions.query({
          name: 'periodic-background-sync' as any
        });
        
        if (status.state === 'granted') {
          // Register periodic sync
          await (this.registration as any).periodicSync.register('omnicare-periodic-sync', {
            minInterval: 24 * 60 * 60 * 1000 // 24 hours
          });
          
          console.log('Periodic background sync enabled');
          return true;
        } else {
          console.log('Periodic background sync permission denied');
        }
      } catch (error) {
        console.error('Failed to enable periodic sync:', error);
      }
    } else {
      console.log('Periodic background sync not supported');
    }
    
    return false;
  }

  /**
   * Start periodic update checks
   */
  private startUpdateCheck(): void {
    // Check for updates every hour
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, 60 * 60 * 1000);
  }

  /**
   * Stop periodic update checks
   */
  private stopUpdateCheck(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdates(): Promise<void> {
    if (!this.registration) {
      return;
    }
    
    try {
      await this.registration.update();
      console.log('Checked for Service Worker updates');
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  }

  /**
   * Send message to service worker with enhanced error handling
   */
  async sendMessage(type: string, payload?: any): Promise<any> {
    if (!navigator.serviceWorker.controller) {
      throw new Error('No active Service Worker');
    }
    
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve(event.data.data);
        } else {
          reject(new Error(event.data.error || 'Service Worker operation failed'));
        }
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type, payload },
        [messageChannel.port2]
      );
    });
  }

  /**
   * Queue a request for offline sync with enhanced priority handling
   */
  async queueRequest(request: QueuedRequest): Promise<void> {
    // Send to service worker for queuing
    await this.sendMessage('QUEUE_REQUEST', request);
    
    // Also queue in offline sync service if available
    if (this.offlineSyncService && request.resource) {
      // Create a minimal resource for queuing
      const resource = {
        resourceType: request.resource,
        id: `pending-${Date.now()}`,
      };
      
      await this.offlineSyncService.queueOperation(
        request.method === 'DELETE' ? 'delete' : request.method === 'PUT' ? 'update' : 'create',
        resource as any,
        { priority: request.priority }
      );
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    return this.sendMessage('GET_CACHE_STATS');
  }

  /**
   * Clear specific caches
   */
  async clearCaches(cacheNames?: string[]): Promise<void> {
    await this.sendMessage('CLEAR_CACHE', { cacheNames });
  }

  /**
   * Register a message handler for service worker events
   */
  onServiceWorkerMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Unregister a message handler
   */
  offServiceWorkerMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  /**
   * Skip waiting and activate new service worker
   */
  async skipWaiting(): Promise<void> {
    if (!this.registration?.waiting) {
      return;
    }
    
    // Send skip waiting message to waiting service worker
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    
    // Wait for controller to change
    await new Promise<void>(resolve => {
      const onControllerChange = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        resolve();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    });
    
    // Reload to use new service worker
    window.location.reload();
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