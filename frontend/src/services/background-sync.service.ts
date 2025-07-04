import { v4 as uuidv4 } from 'uuid';

export interface SyncTask {
  id: string;
  type: 'create' | 'update' | 'delete' | 'custom';
  resource: string;
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, any>;
  conflictResolution?: 'client-wins' | 'server-wins' | 'merge' | 'manual';
}

export interface SyncResult {
  taskId: string;
  success: boolean;
  error?: Error;
  conflictDetected?: boolean;
  mergedData?: any;
  serverVersion?: any;
}

export interface SyncQueueOptions {
  maxQueueSize?: number;
  syncInterval?: number;
  batchSize?: number;
  enableCompression?: boolean;
  enableEncryption?: boolean;
  persistQueue?: boolean;
  storageKey?: string;
}

export interface SyncStats {
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
  lastSyncTime: number | null;
  nextSyncTime: number | null;
  averageSyncDuration: number;
}

class BackgroundSyncService {
  private syncQueue: Map<string, SyncTask> = new Map();
  private processingTasks: Set<string> = new Set();
  private syncInterval: NodeJS.Timeout | null = null;
  private stats: SyncStats = {
    pendingTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    lastSyncTime: null,
    nextSyncTime: null,
    averageSyncDuration: 0,
  };
  
  private options: Required<SyncQueueOptions> = {
    maxQueueSize: 1000,
    syncInterval: 30000, // 3 seconds
    batchSize: 10,
    enableCompression: true,
    enableEncryption: true,
    persistQueue: true,
    storageKey: 'omnicare-sync-queue',
  };

  private syncHandlers: Map<string, (task: SyncTask) => Promise<any>> = new Map();
  private conflictResolvers: Map<string, (task: SyncTask, serverData: any) => Promise<any>> = new Map();

  private isInitialized = false;
  private networkStatusCheck: (() => boolean) | null = null;

  constructor(options?: SyncQueueOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
    
    // Don't initialize in constructor - wait for explicit initialization
    // This prevents module-level initialization in test environments
  }

  /**
   * Initialize the background sync service
   */
  initialize(networkStatusCheck: () => boolean): void {
    if (this.isInitialized) return;

    // Extra check for server/test environments
    if (typeof window === 'undefined' || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
      return;
    }

    // Store the network status check function
    this.networkStatusCheck = networkStatusCheck;

    // Load persisted queue
    if (this.options.persistQueue) {
      this.loadQueueFromStorage();
      this.restoreInterruptedSession();
    }

    // Register default handlers
    this.registerDefaultHandlers();
    
    // Set up session monitoring
    this.setupSessionMonitoring();

    // Set up periodic sync
    this.startPeriodicSync(networkStatusCheck);

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (networkStatusCheck()) {
          this.syncNow();
        }
      });
    }
    
    this.isInitialized = true;
    console.log('Background sync service initialized successfully');
  }

  /**
   * Ensure the service is initialized before use
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('BackgroundSyncService not initialized. Call initialize() first.');
    }
  }

  /**
   * Add a task to the sync queue
   */
  addTask(task: Omit<SyncTask, 'id' | 'timestamp' | 'retryCount'>): string {
    if (this.syncQueue.size >= this.options.maxQueueSize) {
      // Remove oldest low-priority tasks to make room
      this.pruneQueue();
    }

    const syncTask: SyncTask = {
      ...task,
      id: uuidv4(),
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: task.maxRetries || 3,
    };

    this.syncQueue.set(syncTask.id, syncTask);
    this.stats.pendingTasks = this.syncQueue.size;
    
    if (this.options.persistQueue) {
      this.saveQueueToStorage();
    }

    return syncTask.id;
  }

  /**
   * Remove a task from the sync queue
   */
  removeTask(taskId: string): boolean {
    const removed = this.syncQueue.delete(taskId);
    
    if (removed) {
      this.stats.pendingTasks = this.syncQueue.size;
      
      if (this.options.persistQueue) {
        this.saveQueueToStorage();
      }
    }

    return removed;
  }

  /**
   * Get all pending tasks
   */
  getPendingTasks(): SyncTask[] {
    return Array.from(this.syncQueue.values()).sort((a, b) => {
      // Sort by priority then timestamp
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Register a sync handler for a specific resource type
   */
  registerSyncHandler(resource: string, handler: (task: SyncTask) => Promise<any>): void {
    this.syncHandlers.set(resource, handler);
  }

  /**
   * Register a conflict resolver for a specific resource type
   */
  registerConflictResolver(
    resource: string,
    resolver: (task: SyncTask, serverData: any) => Promise<any>
  ): void {
    this.conflictResolvers.set(resource, resolver);
  }

  /**
   * Alias for registerSyncHandler for backwards compatibility
   */
  registerHandler(resource: string, handler: (task: SyncTask) => Promise<any>): void {
    this.registerSyncHandler(resource, handler);
  }

  /**
   * Pause the sync service
   */
  pauseSync(): void {
    this.stopPeriodicSync();
  }

  /**
   * Resume the sync service
   */
  resumeSync(): void {
    if (!this.isInitialized || !this.networkStatusCheck) {
      throw new Error('BackgroundSyncService not initialized. Call initialize() first.');
    }
    
    this.startPeriodicSync(this.networkStatusCheck);
  }

  /**
   * Destroy the service and clean up resources
   */
  destroy(): void {
    // Stop periodic sync
    this.stopPeriodicSync();
    
    // Clear all pending tasks
    this.clearQueue();
    
    // Clear handlers and resolvers
    this.syncHandlers.clear();
    this.conflictResolvers.clear();
    
    // Clear processing tasks
    this.processingTasks.clear();
    
    // Clear stats
    this.stats = {
      pendingTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      lastSyncTime: null,
      nextSyncTime: null,
      averageSyncDuration: 0,
    };
    
    // Clear session state
    if (typeof window !== 'undefined' && this.options.storageKey) {
      localStorage.removeItem(`${this.options.storageKey}_session`);
    }
    
    // Reset initialization flag
    this.isInitialized = false;
    this.networkStatusCheck = null;
  }

  /**
   * Manually trigger sync
   */
  async syncNow(): Promise<SyncResult[]> {
    if (this.processingTasks.size > 0) {
      console.log('Sync already in progress');
      return [];
    }

    const startTime = Date.now();
    const tasks = this.getPendingTasks().slice(0, this.options.batchSize);
    const results: SyncResult[] = [];
    
    // Update session state to indicate processing
    this.saveSessionState();

    for (const task of tasks) {
      if (this.processingTasks.has(task.id)) {
        continue;
      }

      this.processingTasks.add(task.id);
      
      // Save session state with current processing task
      this.saveSessionState();

      try {
        const result = await this.processTask(task);
        results.push(result);

        if (result.success) {
          this.syncQueue.delete(task.id);
          this.stats.completedTasks++;
        } else {
          // Update retry count
          task.retryCount++;
          
          if (task.retryCount >= task.maxRetries) {
            this.syncQueue.delete(task.id);
            this.stats.failedTasks++;
          }
        }
      } catch (error) {
        results.push({
          taskId: task.id,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });

        task.retryCount++;
        
        if (task.retryCount >= task.maxRetries) {
          this.syncQueue.delete(task.id);
          this.stats.failedTasks++;
        }
      } finally {
        this.processingTasks.delete(task.id);
      }
    }

    // Update stats
    const duration = Date.now() - startTime;
    this.stats.lastSyncTime = Date.now();
    this.stats.pendingTasks = this.syncQueue.size;
    this.stats.averageSyncDuration = 
      (this.stats.averageSyncDuration + duration) / 2;

    if (this.options.persistQueue) {
      this.saveQueueToStorage();
    }
    
    // Clear session processing state
    this.saveSessionState();

    return results;
  }

  /**
   * Process a single sync task
   */
  private async processTask(task: SyncTask): Promise<SyncResult> {
    const handler = this.syncHandlers.get(task.resource);
    
    if (!handler) {
      throw new Error(`No sync handler registered for resource: ${task.resource}`);
    }

    try {
      const result = await handler(task);
      
      return {
        taskId: task.id,
        success: true,
        serverVersion: result,
      };
    } catch (error: any) {
      // Check if it's a conflict error
      if (error.status === 409 || error.code === 'CONFLICT') {
        const resolver = this.conflictResolvers.get(task.resource);
        
        if (resolver && task.conflictResolution !== 'manual') {
          try {
            const mergedData = await resolver(task, error.serverData);
            
            // Retry with merged data
            task.data = mergedData;
            return this.processTask(task);
          } catch (resolveError) {
            return {
              taskId: task.id,
              success: false,
              error: resolveError instanceof Error ? resolveError : new Error(String(resolveError)),
              conflictDetected: true,
            };
          }
        }

        return {
          taskId: task.id,
          success: false,
          error: error,
          conflictDetected: true,
          serverVersion: error.serverData,
        };
      }

      throw error;
    }
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(networkStatusCheck: () => boolean): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (networkStatusCheck() && this.syncQueue.size > 0) {
        await this.syncNow();
      }
      
      this.stats.nextSyncTime = Date.now() + this.options.syncInterval;
    }, this.options.syncInterval);

    this.stats.nextSyncTime = Date.now() + this.options.syncInterval;
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.stats.nextSyncTime = null;
  }

  /**
   * Get sync statistics
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Clear all pending tasks
   */
  clearQueue(): void {
    this.syncQueue.clear();
    this.stats.pendingTasks = 0;
    
    if (this.options.persistQueue) {
      this.saveQueueToStorage();
    }
  }

  /**
   * Prune old tasks from queue
   */
  private pruneQueue(): void {
    const tasks = this.getPendingTasks();
    const tasksToRemove = tasks
      .filter(t => t.priority === 'low')
      .slice(0, Math.floor(this.options.maxQueueSize * 0.1));

    tasksToRemove.forEach(task => {
      this.syncQueue.delete(task.id);
    });
  }

  /**
   * Load queue from storage
   */
  private loadQueueFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.options.storageKey);
      
      if (stored) {
        const tasks: SyncTask[] = JSON.parse(stored);
        
        tasks.forEach(task => {
          this.syncQueue.set(task.id, task);
        });

        this.stats.pendingTasks = this.syncQueue.size;
      }
    } catch (error) {
      console.error('Failed to load sync queue from storage:', error);
    }
  }
  
  /**
   * Restore interrupted session
   */
  private restoreInterruptedSession(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const sessionData = localStorage.getItem(`${this.options.storageKey}_session`);
      
      if (sessionData) {
        const session = JSON.parse(sessionData);
        
        // Check if session was interrupted recently
        const timeSinceLastActivity = Date.now() - session.lastActivity;
        const maxResumeTime = 15 * 60 * 1000; // 15 minutes
        
        if (timeSinceLastActivity < maxResumeTime && session.wasProcessing) {
          console.log('Resuming interrupted sync session');
          
          // Restore processing state
          if (session.processingTasks && session.processingTasks.length > 0) {
            session.processingTasks.forEach((taskId: string) => {
              const task = this.syncQueue.get(taskId);
              if (task) {
                // Reset task status to retry
                task.retryCount = Math.max(0, task.retryCount - 1);
                task.timestamp = Date.now();
              }
            });
          }
          
          // Auto-resume after a short delay
          setTimeout(() => {
            this.syncNow().catch(console.error);
          }, 2000);
        } else {
          // Clean up stale session data
          localStorage.removeItem(`${this.options.storageKey}_session`);
        }
      }
    } catch (error) {
      console.error('Failed to restore interrupted session:', error);
    }
  }
  
  /**
   * Setup session monitoring for interruption detection
   */
  private setupSessionMonitoring(): void {
    if (typeof window === 'undefined') return;
    
    // Save session state periodically
    setInterval(() => {
      this.saveSessionState();
    }, 10000); // Every 10 seconds
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.saveSessionState(true);
    });
    
    // Handle visibility change (tab switching, minimizing)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.saveSessionState();
      }
    });
  }
  
  /**
   * Save current session state
   */
  private saveSessionState(isUnloading = false): void {
    if (typeof window === 'undefined') return;
    
    try {
      const sessionData = {
        lastActivity: Date.now(),
        wasProcessing: this.processingTasks.size > 0,
        processingTasks: Array.from(this.processingTasks),
        pendingTasks: this.syncQueue.size,
        isUnloading
      };
      
      localStorage.setItem(`${this.options.storageKey}_session`, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save session state:', error);
    }
  }

  /**
   * Save queue to storage
   */
  private saveQueueToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const tasks = Array.from(this.syncQueue.values());
      localStorage.setItem(this.options.storageKey, JSON.stringify(tasks));
    } catch (error) {
      console.error('Failed to save sync queue to storage:', error);
    }
  }

  /**
   * Register default sync handlers
   */
  private registerDefaultHandlers(): void {
    // Default FHIR resource handler
    this.registerSyncHandler('fhir', async (task) => {
      const method = task.type === 'create' ? 'POST' : 
                     task.type === 'update' ? 'PUT' : 
                     task.type === 'delete' ? 'DELETE' : 'POST';

      const response = await fetch(`/api/fhir/${task.data.resourceType}${task.data.id ? `/${task.data.id}` : ''}`, {
        method,
        headers: {
          'Content-Type': 'application/fhir+json',
        },
        body: task.type !== 'delete' ? JSON.stringify(task.data) : undefined,
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        (error as any).status = response.status;
        
        if (response.status === 409) {
          (error as any).serverData = await response.json();
        }
        
        throw error;
      }

      return response.json();
    });

    // Default conflict resolver
    this.registerConflictResolver('fhir', async (task, serverData) => {
      // Simple last-write-wins strategy
      if (task.conflictResolution === 'client-wins') {
        return task.data;
      } else if (task.conflictResolution === 'server-wins') {
        return serverData;
      } else {
        // Merge strategy - combine non-conflicting fields
        return { ...serverData, ...task.data };
      }
    });
  }
}

// Create singleton instance with lazy initialization
let instance: BackgroundSyncService | null = null;

export const getBackgroundSyncService = (): BackgroundSyncService => {
  if (!instance) {
    instance = new BackgroundSyncService();
  }
  return instance;
};

// Export a stub for SSR/test environments
const createStub = () => ({
  initialize: () => {},
  addTask: () => 'stub-task-id',
  getStats: () => ({
    pendingTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    lastSyncTime: null,
    nextSyncTime: null,
    averageSyncDuration: 0,
  }),
  syncNow: () => Promise.resolve(),
  clearQueue: () => Promise.resolve(),
  pauseSync: () => {},
  resumeSync: () => {},
  registerHandler: () => {},
  registerConflictResolver: () => {},
  destroy: () => {},
});

// Export singleton with environment check
export const backgroundSyncService = (typeof window === 'undefined' || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test'))
  ? createStub()
  : getBackgroundSyncService();

// Export convenience functions
export const addSyncTask = (task: Omit<SyncTask, 'id' | 'timestamp' | 'retryCount'>) => 
  backgroundSyncService.addTask(task);

export const getSyncStats = () => backgroundSyncService.getStats();
export const syncNow = () => backgroundSyncService.syncNow();