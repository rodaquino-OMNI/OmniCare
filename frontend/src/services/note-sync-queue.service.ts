'use client';

import { notifications } from '@mantine/notifications';
import { offlineNotesService, OfflineNote } from './offline-notes.service';
import { fhirService } from './fhir.service';
import { getErrorMessage } from '@/utils/error.utils';

// Utility function to generate unique IDs
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export interface SyncQueueItem {
  id: string;
  noteId: string;
  action: 'create' | 'update' | 'delete';
  priority: 'low' | 'normal' | 'high';
  timestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  lastAttempt?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SyncStatistics {
  pendingItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  lastSyncTime?: string;
  nextSyncTime?: string;
}

export interface SyncOptions {
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  priority?: 'low' | 'normal' | 'high';
  silent?: boolean;
}

const DB_NAME = 'OmniCareOffline';
const SYNC_QUEUE_STORE = 'sync_queue';
const SYNC_LOG_STORE = 'sync_log';

export class NoteSyncQueueService {
  private db: IDBDatabase | null = null;
  private isProcessing: boolean = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private onlineListener: (() => void) | null = null;
  private syncStatusCallbacks: Set<(status: SyncStatistics) => void> = new Set();
  private isInitialized: boolean = false;

  constructor() {
    // Don't initialize in constructor - wait for explicit initialization
    // This prevents module-level initialization in test environments
  }

  /**
   * Initialize the note sync queue service
   * Must be called explicitly to avoid module-level initialization
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Extra check for server/test environments
    if (typeof window === 'undefined' || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
      return;
    }

    try {
      await this.initializeDB();
      this.setupEventListeners();
      this.startAutoSync();
      this.isInitialized = true;
      console.log('Note sync queue service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize note sync queue service:', error);
      throw error;
    }
  }

  /**
   * Ensure the service is initialized before use
   */
  public async ensureInitialized(): Promise<void> {
    if (!this.isInitialized && typeof window !== 'undefined') {
      await this.initialize();
    }
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 3); // Increment version

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Sync queue store (might already exist from offline-notes service)
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          const syncStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('priority', 'priority', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('noteId', 'noteId', { unique: false });
        }

        // Sync log store for history
        if (!db.objectStoreNames.contains(SYNC_LOG_STORE)) {
          const logStore = db.createObjectStore(SYNC_LOG_STORE, { 
            keyPath: 'id',
            autoIncrement: true 
          });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
          logStore.createIndex('action', 'action', { unique: false });
          logStore.createIndex('status', 'status', { unique: false });
        }
      };
    });
  }

  private setupEventListeners(): void {
    this.onlineListener = () => {
      if (navigator.onLine) {
        this.processSyncQueue({ silent: false });
      }
    };
    
    window.addEventListener('online', this.onlineListener);

    // Process queue when visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && navigator.onLine) {
        this.processSyncQueue({ silent: true });
      }
    });
  }

  private startAutoSync(): void {
    // Auto-sync every 5 minutes when online
    this.syncTimer = setInterval(() => {
      if (navigator.onLine && !this.isProcessing) {
        this.processSyncQueue({ silent: true });
      }
    }, 5 * 6 * 1000);

    // Retry failed items every 15 minutes
    this.retryTimer = setInterval(() => {
      if (navigator.onLine && !this.isProcessing) {
        this.retryFailedItems();
      }
    }, 15 * 6 * 1000);
  }

  // ===============================
  // QUEUE MANAGEMENT
  // ===============================

  public async addToQueue(
    noteId: string, 
    action: 'create' | 'update' | 'delete',
    options: SyncOptions = {}
  ): Promise<SyncQueueItem> {
    await this.ensureInitialized();

    const item: SyncQueueItem = {
      id: generateId(),
      noteId,
      action,
      priority: options.priority || 'normal',
      timestamp: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
      maxAttempts: options.maxRetries || 3,
      metadata: {}
    };

    const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.add(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Trigger immediate sync if online and high priority
    if (navigator.onLine && item.priority === 'high') {
      this.processSyncQueue({ silent: true });
    }

    this.notifyStatusChange();
    return item;
  }

  public async removeFromQueue(itemId: string): Promise<void> {
    await this.ensureInitialized();

    const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(itemId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    this.notifyStatusChange();
  }

  public async getQueueStatus(): Promise<SyncStatistics> {
    await this.ensureInitialized();

    const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readonly');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const index = store.index('status');
    
    const counts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    const statuses: Array<keyof typeof counts> = ['pending', 'processing', 'completed', 'failed'];
    
    for (const status of statuses) {
      const count = await new Promise<number>((resolve, reject) => {
        const request = index.count(status);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      counts[status] = count;
    }

    // Get last sync time from log
    const logTransaction = this.db!.transaction([SYNC_LOG_STORE], 'readonly');
    const logStore = logTransaction.objectStore(SYNC_LOG_STORE);
    const logIndex = logStore.index('timestamp');
    
    const lastSync = await new Promise<string | undefined>((resolve, reject) => {
      const request = logIndex.openCursor(null, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        resolve(cursor ? cursor.value.timestamp : undefined);
      };
      request.onerror = () => reject(request.error);
    });

    return {
      pendingItems: counts.pending,
      processingItems: counts.processing,
      completedItems: counts.completed,
      failedItems: counts.failed,
      lastSyncTime: lastSync,
      nextSyncTime: this.getNextSyncTime()
    };
  }

  // ===============================
  // SYNC PROCESSING
  // ===============================

  public async processSyncQueue(options: SyncOptions = {}): Promise<void> {
    if (!navigator.onLine || this.isProcessing) return;

    this.isProcessing = true;
    const batchSize = options.batchSize || 10;

    try {
      if (!options.silent) {
        notifications.show({
          title: 'Syncing Notes',
          message: 'Synchronizing offline changes...',
          color: 'blue',
          loading: true,
          id: 'sync-progress'
        });
      }

      // Get pending items sorted by priority and timestamp
      const pendingItems = await this.getPendingItems(batchSize);
      
      let successCount = 0;
      let failureCount = 0;

      for (const item of pendingItems) {
        try {
          await this.processItem(item);
          successCount++;
        } catch (error) {
          failureCount++;
          await this.handleItemFailure(item, error);
        }
      }

      // Log sync operation
      await this.logSyncOperation({
        timestamp: new Date().toISOString(),
        action: 'batch_sync',
        status: 'completed',
        itemsProcessed: successCount + failureCount,
        successCount,
        failureCount
      });

      if (!options.silent) {
        notifications.update({
          id: 'sync-progress',
          title: 'Sync Complete',
          message: `${successCount} items synced successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
          color: failureCount > 0 ? 'yellow' : 'green',
          loading: false,
          autoClose: 300
        });
      }

    } catch (error) {
      console.error('Sync queue processing error:', error);
      if (!options.silent) {
        notifications.update({
          id: 'sync-progress',
          title: 'Sync Error',
          message: getErrorMessage(error),
          color: 'red',
          loading: false
        });
      }
    } finally {
      this.isProcessing = false;
      this.notifyStatusChange();
    }
  }

  private async processItem(item: SyncQueueItem): Promise<void> {
    await this.ensureInitialized();

    // Update status to processing
    item.status = 'processing';
    await this.updateQueueItem(item);

    try {
      // Get the note
      const note = await offlineNotesService.getNote(item.noteId);
      if (!note && item.action !== 'delete') {
        throw new Error('Note not found');
      }

      // Process based on action
      switch (item.action) {
        case 'create':
          if (note) {
            await this.syncCreateNote(note);
          }
          break;
        case 'update':
          if (note) {
            await this.syncUpdateNote(note);
          }
          break;
        case 'delete':
          await this.syncDeleteNote(item.noteId);
          break;
      }

      // Mark as completed and remove from queue
      item.status = 'completed';
      await this.removeFromQueue(item.id);

    } catch (error) {
      throw error;
    }
  }

  private async syncCreateNote(note: OfflineNote): Promise<void> {
    const docRef = await offlineNotesService.syncCreateNote(note);
    if (!docRef.success) {
      throw new Error(docRef.error || 'Failed to create note on server');
    }
  }

  private async syncUpdateNote(note: OfflineNote): Promise<void> {
    const result = await offlineNotesService.syncUpdateNote(note);
    if (!result.success) {
      if (result.conflict) {
        // Handle conflict - don't throw error, let offline service handle it
        notifications.show({
          title: 'Sync Conflict',
          message: `Note "${note.title}" has conflicting changes`,
          color: 'yellow'
        });
      } else {
        throw new Error(result.error || 'Failed to update note on server');
      }
    }
  }

  private async syncDeleteNote(noteId: string): Promise<void> {
    const result = await offlineNotesService.syncDeleteNote({ id: noteId } as OfflineNote);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete note on server');
    }
  }

  private async handleItemFailure(item: SyncQueueItem, error: unknown): Promise<void> {
    item.attempts++;
    item.lastAttempt = new Date().toISOString();
    item.error = getErrorMessage(error);

    if (item.attempts >= item.maxAttempts) {
      item.status = 'failed';
    } else {
      item.status = 'pending'; // Will retry later
    }

    await this.updateQueueItem(item);
  }

  // ===============================
  // RETRY MECHANISM
  // ===============================

  public async retryFailedItems(): Promise<void> {
    await this.ensureInitialized();

    const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const index = store.index('status');
    
    const failedItems = await new Promise<SyncQueueItem[]>((resolve, reject) => {
      const request = index.getAll('failed');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Reset failed items for retry
    for (const item of failedItems) {
      if (item.attempts < item.maxAttempts) {
        item.status = 'pending';
        item.attempts = 0; // Reset attempts
        await this.updateQueueItem(item);
      }
    }

    if (failedItems.length > 0) {
      this.processSyncQueue({ silent: true });
    }
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  private async getPendingItems(limit: number): Promise<SyncQueueItem[]> {
    await this.ensureInitialized();

    const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readonly');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const index = store.index('status');
    
    const items = await new Promise<SyncQueueItem[]>((resolve, reject) => {
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Sort by priority (high -> normal -> low) and timestamp
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    items.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    return items.slice(0, limit);
  }

  private async updateQueueItem(item: SyncQueueItem): Promise<void> {
    await this.ensureInitialized();

    const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async logSyncOperation(log: any): Promise<void> {
    await this.ensureInitialized();

    const transaction = this.db!.transaction([SYNC_LOG_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_LOG_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.add(log);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private getNextSyncTime(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // Next sync in 5 minutes
    return now.toISOString();
  }

  private notifyStatusChange(): void {
    this.getQueueStatus().then(status => {
      this.syncStatusCallbacks.forEach(callback => callback(status));
    });
  }

  // ===============================
  // PUBLIC API
  // ===============================

  public onStatusChange(callback: (status: SyncStatistics) => void): () => void {
    this.syncStatusCallbacks.add(callback);
    // Initial call
    this.getQueueStatus().then(callback);
    
    // Return unsubscribe function
    return () => {
      this.syncStatusCallbacks.delete(callback);
    };
  }

  public async clearCompletedItems(): Promise<void> {
    await this.ensureInitialized();

    const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const index = store.index('status');
    
    const completedItems = await new Promise<SyncQueueItem[]>((resolve, reject) => {
      const request = index.getAll('completed');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const item of completedItems) {
      await this.removeFromQueue(item.id);
    }
  }

  public async forceSyncNow(): Promise<void> {
    await this.processSyncQueue({ silent: false, priority: 'high' });
  }

  // ===============================
  // CLEANUP
  // ===============================

  public cleanup(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
    
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
      this.onlineListener = null;
    }
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    this.syncStatusCallbacks.clear();
  }
}

// Create singleton instance with lazy initialization
let instance: NoteSyncQueueService | null = null;

export const getNoteSyncQueueService = (): NoteSyncQueueService => {
  if (!instance) {
    instance = new NoteSyncQueueService();
  }
  return instance;
};

// Export a wrapper to maintain backward compatibility
export const noteSyncQueueService = {
  async initialize() {
    return getNoteSyncQueueService().initialize();
  },
  async addToQueue(noteId: string, action: SyncQueueItem['action'], options?: SyncOptions) {
    const service = getNoteSyncQueueService();
    await service.ensureInitialized();
    return service.addToQueue(noteId, action, options);
  },
  async processQueue(options?: SyncOptions) {
    const service = getNoteSyncQueueService();
    await service.ensureInitialized();
    return service.processSyncQueue(options);
  },
  async getQueueStatus() {
    const service = getNoteSyncQueueService();
    await service.ensureInitialized();
    return service.getQueueStatus();
  },
  async clearQueue() {
    const service = getNoteSyncQueueService();
    await service.ensureInitialized();
    return service.clearCompletedItems();
  },
  async retryFailed() {
    const service = getNoteSyncQueueService();
    await service.ensureInitialized();
    return service.retryFailedItems();
  },
  subscribeToStatus(callback: (status: SyncStatistics) => void) {
    const service = getNoteSyncQueueService();
    return service.onStatusChange(callback);
  },
  unsubscribeFromStatus(callback: (status: SyncStatistics) => void) {
    const service = getNoteSyncQueueService();
    // Return a no-op function since onStatusChange returns an unsubscribe function
    return () => {};
  },
  async cleanup() {
    const service = getNoteSyncQueueService();
    return service.cleanup();
  }
};