import { v4 as uuidv4 } from 'uuid';

// Types from original service
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

export class MockBackgroundSyncService {
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
    syncInterval: 30000,
    batchSize: 10,
    enableCompression: true,
    enableEncryption: true,
    persistQueue: true,
    storageKey: 'omnicare-sync-queue-mock',
  };

  private syncHandlers: Map<string, (task: SyncTask) => Promise<any>> = new Map();
  private conflictResolvers: Map<string, (task: SyncTask, serverData: any) => Promise<any>> = new Map();
  private networkStatus = true;
  private simulateConflicts = false;
  private simulateFailures = false;

  constructor(options?: SyncQueueOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
    
    // Register default handlers
    this.registerDefaultHandlers();
  }

  // Test helpers
  setNetworkStatus(online: boolean): void {
    this.networkStatus = online;
  }

  setSimulateConflicts(simulate: boolean): void {
    this.simulateConflicts = simulate;
  }

  setSimulateFailures(simulate: boolean): void {
    this.simulateFailures = simulate;
  }

  initialize(networkStatusCheck: () => boolean): void {
    // Mock implementation - use internal network status
    this.startPeriodicSync(() => this.networkStatus);
  }

  addTask(task: Omit<SyncTask, 'id' | 'timestamp' | 'retryCount'>): string {
    if (this.syncQueue.size >= this.options.maxQueueSize) {
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
    
    return syncTask.id;
  }

  removeTask(taskId: string): boolean {
    const removed = this.syncQueue.delete(taskId);
    
    if (removed) {
      this.stats.pendingTasks = this.syncQueue.size;
    }

    return removed;
  }

  getPendingTasks(): SyncTask[] {
    return Array.from(this.syncQueue.values()).sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      return a.timestamp - b.timestamp;
    });
  }

  registerSyncHandler(resource: string, handler: (task: SyncTask) => Promise<any>): void {
    this.syncHandlers.set(resource, handler);
  }

  registerConflictResolver(
    resource: string,
    resolver: (task: SyncTask, serverData: any) => Promise<any>
  ): void {
    this.conflictResolvers.set(resource, resolver);
  }

  async syncNow(): Promise<SyncResult[]> {
    if (!this.networkStatus) {
      return [];
    }

    if (this.processingTasks.size > 0) {
      console.log('Mock sync already in progress');
      return [];
    }

    const startTime = Date.now();
    const tasks = this.getPendingTasks().slice(0, this.options.batchSize);
    const results: SyncResult[] = [];

    for (const task of tasks) {
      if (this.processingTasks.has(task.id)) {
        continue;
      }

      this.processingTasks.add(task.id);

      try {
        const result = await this.processTask(task);
        results.push(result);

        if (result.success) {
          this.syncQueue.delete(task.id);
          this.stats.completedTasks++;
        } else {
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

    return results;
  }

  private async processTask(task: SyncTask): Promise<SyncResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate failures if enabled
    if (this.simulateFailures && Math.random() < 0.3) {
      throw new Error('Simulated network failure');
    }

    // Simulate conflicts if enabled
    if (this.simulateConflicts && task.type === 'update' && Math.random() < 0.3) {
      const error: any = new Error('Simulated conflict');
      error.status = 409;
      error.code = 'CONFLICT';
      error.serverData = { ...task.data, _rev: 'server-version' };
      
      const resolver = this.conflictResolvers.get(task.resource);
      
      if (resolver && task.conflictResolution !== 'manual') {
        try {
          const mergedData = await resolver(task, error.serverData);
          
          return {
            taskId: task.id,
            success: true,
            conflictDetected: true,
            mergedData,
            serverVersion: error.serverData,
          };
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
        error,
        conflictDetected: true,
        serverVersion: error.serverData,
      };
    }

    const handler = this.syncHandlers.get(task.resource);
    
    if (!handler) {
      // Use default handler
      return {
        taskId: task.id,
        success: true,
        serverVersion: { ...task.data, id: task.data.id || uuidv4() },
      };
    }

    try {
      const result = await handler(task);
      
      return {
        taskId: task.id,
        success: true,
        serverVersion: result,
      };
    } catch (error) {
      throw error;
    }
  }

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

  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.stats.nextSyncTime = null;
  }

  getStats(): SyncStats {
    return { ...this.stats };
  }

  clearQueue(): void {
    this.syncQueue.clear();
    this.stats.pendingTasks = 0;
  }

  private pruneQueue(): void {
    const tasks = this.getPendingTasks();
    const tasksToRemove = tasks
      .filter(t => t.priority === 'low')
      .slice(0, Math.floor(this.options.maxQueueSize * 0.1));

    tasksToRemove.forEach(task => {
      this.syncQueue.delete(task.id);
    });
  }

  private registerDefaultHandlers(): void {
    // Default FHIR resource handler
    this.registerSyncHandler('fhir', async (task) => {
      // Mock successful sync
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        ...task.data,
        id: task.data.id || uuidv4(),
        meta: {
          ...task.data.meta,
          versionId: String(Date.now()),
          lastUpdated: new Date().toISOString()
        }
      };
    });

    // Default conflict resolver
    this.registerConflictResolver('fhir', async (task, serverData) => {
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

// Export singleton instance
export const backgroundSyncService = new MockBackgroundSyncService();

// Export convenience functions
export const addSyncTask = (task: Omit<SyncTask, 'id' | 'timestamp' | 'retryCount'>) => 
  backgroundSyncService.addTask(task);

export const getSyncStats = () => backgroundSyncService.getStats();
export const syncNow = () => backgroundSyncService.syncNow();