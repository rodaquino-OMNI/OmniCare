/**
 * Optimized Sync Transaction Coordination Service
 * Implements high-performance coordination for distributed sync operations
 */

import { EventEmitter } from 'events';

import { databaseService } from './database.service';
import { redisCacheService } from './redis-cache.service';

import logger from '@/utils/logger';

interface SyncTransaction {
  id: string;
  type: 'patient' | 'encounter' | 'observation' | 'medication' | 'batch';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'conflicted';
  priority: number; // 0-10, higher is more important
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  data: any;
  dependencies?: string[]; // Other transaction IDs this depends on
  conflictResolution?: 'client' | 'server' | 'merge';
  error?: string;
}

interface SyncBatch {
  id: string;
  transactions: string[];
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  successCount: number;
  failureCount: number;
}

interface SyncMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  conflictedTransactions: number;
  averageProcessingTime: number;
  currentQueueSize: number;
  throughputPerSecond: number;
}

interface ConflictResolutionStrategy {
  type: 'timestamp' | 'version' | 'custom';
  resolver?: (clientData: any, serverData: any) => any;
}

export class OptimizedSyncCoordinationService extends EventEmitter {
  private readonly SYNC_QUEUE_KEY = 'sync:queue';
  private readonly SYNC_PROCESSING_KEY = 'sync:processing';
  private readonly SYNC_LOCK_KEY = 'sync:lock';
  private readonly BATCH_SIZE = 100;
  private readonly WORKER_COUNT = 4;
  
  private isProcessing = false;
  private workers: Map<string, NodeJS.Timeout> = new Map();
  private metrics: SyncMetrics = {
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    conflictedTransactions: 0,
    averageProcessingTime: 0,
    currentQueueSize: 0,
    throughputPerSecond: 0,
  };

  private conflictStrategies: Map<string, ConflictResolutionStrategy> = new Map([
    ['patient', { type: 'timestamp' }],
    ['encounter', { type: 'version' }],
    ['observation', { type: 'timestamp' }],
    ['medication', { type: 'custom', resolver: this.medicationConflictResolver }],
  ]);

  constructor() {
    super();
    this.initializeWorkers();
  }

  /**
   * Initialize background workers for parallel processing
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.WORKER_COUNT; i++) {
      this.startWorker(`worker-${i}`);
    }
  }

  /**
   * Start a sync worker
   */
  private startWorker(workerId: string): void {
    const worker = setInterval(async () => {
      await this.processNextTransaction(workerId);
    }, 100); // Check for work every 100ms

    this.workers.set(workerId, worker);
    logger.info(`Sync worker ${workerId} started`);
  }

  /**
   * Queue a sync transaction
   */
  async queueTransaction(transaction: Omit<SyncTransaction, 'id' | 'createdAt'>): Promise<string> {
    const id = this.generateTransactionId();
    const fullTransaction: SyncTransaction = {
      ...transaction,
      id,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: transaction.maxRetries || 3,
    };

    // Add to priority queue
    await this.addToQueue(fullTransaction);

    // Update metrics
    this.metrics.totalTransactions++;
    this.metrics.currentQueueSize++;

    this.emit('transaction-queued', { id, type: transaction.type });
    
    return id;
  }

  /**
   * Queue multiple transactions as a batch
   */
  async queueBatch(transactions: Array<Omit<SyncTransaction, 'id' | 'createdAt'>>): Promise<string> {
    const batchId = this.generateBatchId();
    const batch: SyncBatch = {
      id: batchId,
      transactions: [],
      status: 'queued',
      createdAt: new Date(),
      successCount: 0,
      failureCount: 0,
    };

    // Queue individual transactions and collect IDs
    for (const transaction of transactions) {
      const id = await this.queueTransaction({
        ...transaction,
        type: 'batch',
        data: { ...transaction.data, batchId },
      });
      batch.transactions.push(id);
    }

    // Store batch metadata
    await redisCacheService.set(`sync:batch:${batchId}`, batch, { ttl: 86400 });

    this.emit('batch-queued', { batchId, transactionCount: transactions.length });

    return batchId;
  }

  /**
   * Process next transaction from queue
   */
  private async processNextTransaction(workerId: string): Promise<void> {
    if (!await this.acquireProcessingLock(workerId)) {
      return;
    }

    try {
      // Get next transaction from priority queue
      const transaction = await this.getNextTransaction();
      if (!transaction) {
        return;
      }

      const startTime = Date.now();
      transaction.startedAt = new Date();
      transaction.status = 'processing';

      // Move to processing set
      await this.moveToProcessing(transaction);

      this.emit('transaction-started', { id: transaction.id, workerId });

      try {
        // Check dependencies
        if (transaction.dependencies && transaction.dependencies.length > 0) {
          const ready = await this.checkDependencies(transaction.dependencies);
          if (!ready) {
            // Re-queue transaction
            await this.requeueTransaction(transaction, 'Dependencies not met');
            return;
          }
        }

        // Process based on type
        const result = await this.processByType(transaction);

        // Handle conflicts
        if (result.conflict) {
          await this.handleConflict(transaction, result.conflictData);
          return;
        }

        // Mark as completed
        transaction.status = 'completed';
        transaction.completedAt = new Date();

        await this.completeTransaction(transaction);

        // Update metrics
        const processingTime = Date.now() - startTime;
        this.updateMetrics('success', processingTime);

        this.emit('transaction-completed', { 
          id: transaction.id, 
          type: transaction.type,
          processingTime 
        });

      } catch (error) {
        await this.handleTransactionError(transaction, error as Error);
      }

    } finally {
      await this.releaseProcessingLock(workerId);
    }
  }

  /**
   * Process transaction by type
   */
  private async processByType(transaction: SyncTransaction): Promise<any> {
    switch (transaction.type) {
      case 'patient':
        return this.syncPatient(transaction.data);
      case 'encounter':
        return this.syncEncounter(transaction.data);
      case 'observation':
        return this.syncObservation(transaction.data);
      case 'medication':
        return this.syncMedication(transaction.data);
      case 'batch':
        return this.processBatchItem(transaction.data);
      default:
        throw new Error(`Unknown transaction type: ${transaction.type}`);
    }
  }

  /**
   * Sync patient data with conflict detection
   */
  private async syncPatient(data: any): Promise<any> {
    const existingQuery = `
      SELECT id, version, last_updated, data 
      FROM patients 
      WHERE id = $1
    `;
    
    const existing = await databaseService.query(existingQuery, [data.id]);
    
    if (existing.rows.length > 0) {
      const serverData = existing.rows[0];
      
      // Check for conflicts
      if (new Date(serverData.last_updated) > new Date(data.lastUpdated)) {
        return {
          conflict: true,
          conflictData: {
            client: data,
            server: serverData,
          },
        };
      }
    }

    // Perform upsert
    const upsertQuery = `
      INSERT INTO patients (id, data, version, last_updated)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE
      SET data = $2, version = $3, last_updated = $4
      WHERE patients.version < $3
    `;

    await databaseService.query(upsertQuery, [
      data.id,
      JSON.stringify(data),
      data.version || 1,
      new Date(),
    ]);

    return { success: true };
  }

  /**
   * Handle sync conflicts
   */
  private async handleConflict(transaction: SyncTransaction, conflictData: any): Promise<void> {
    transaction.status = 'conflicted';
    this.metrics.conflictedTransactions++;

    const strategy = this.conflictStrategies.get(transaction.type) || { type: 'timestamp' };
    
    let resolved = false;
    let resolvedData: any;

    switch (strategy.type) {
      case 'timestamp':
        // Most recent wins
        resolvedData = conflictData.client.lastUpdated > conflictData.server.last_updated
          ? conflictData.client
          : conflictData.server.data;
        resolved = true;
        break;
        
      case 'version':
        // Higher version wins
        resolvedData = (conflictData.client.version || 0) > (conflictData.server.version || 0)
          ? conflictData.client
          : conflictData.server.data;
        resolved = true;
        break;
        
      case 'custom':
        if (strategy.resolver) {
          resolvedData = await strategy.resolver(conflictData.client, conflictData.server);
          resolved = true;
        }
        break;
    }

    if (resolved && resolvedData) {
      // Re-queue with resolved data
      await this.queueTransaction({
        type: transaction.type,
        status: 'pending',
        priority: transaction.priority + 1, // Higher priority for conflict resolution
        data: resolvedData,
        conflictResolution: strategy.type as any,
        retryCount: 0,
        maxRetries: 1,
      });
    } else {
      // Store conflict for manual resolution
      await this.storeConflict(transaction, conflictData);
    }

    this.emit('conflict-detected', {
      transactionId: transaction.id,
      type: transaction.type,
      resolved,
    });
  }

  /**
   * Custom conflict resolver for medications
   */
  private medicationConflictResolver(clientData: any, serverData: any): any {
    // Merge medication lists, keeping active medications from both
    const merged = {
      ...serverData.data,
      medications: [
        ...serverData.data.medications.filter((m: any) => m.status === 'active'),
        ...clientData.medications.filter((m: any) => 
          m.status === 'active' && 
          !serverData.data.medications.find((sm: any) => sm.id === m.id)
        ),
      ],
      lastUpdated: new Date(),
      version: Math.max(clientData.version || 0, serverData.version || 0) + 1,
    };
    
    return merged;
  }

  /**
   * Get sync queue status
   */
  async getQueueStatus(): Promise<{
    queueSize: number;
    processingCount: number;
    metrics: SyncMetrics;
    workerStatus: Array<{ id: string; active: boolean }>;
  }> {
    const queueSize = await redisCacheService.get<number>(`${this.SYNC_QUEUE_KEY}:size`) || 0;
    const processingCount = await redisCacheService.get<number>(`${this.SYNC_PROCESSING_KEY}:count`) || 0;

    const workerStatus = Array.from(this.workers.keys()).map(id => ({
      id,
      active: this.workers.has(id),
    }));

    return {
      queueSize,
      processingCount,
      metrics: { ...this.metrics },
      workerStatus,
    };
  }

  /**
   * Optimize sync performance based on current metrics
   */
  async optimizePerformance(): Promise<void> {
    const queueSize = this.metrics.currentQueueSize;
    const throughput = this.metrics.throughputPerSecond;

    // Scale workers based on queue size
    if (queueSize > 1000 && this.workers.size < 8) {
      // Add more workers
      for (let i = this.workers.size; i < Math.min(8, this.workers.size + 2); i++) {
        this.startWorker(`worker-${i}`);
      }
      logger.info('Scaled up sync workers due to high queue size');
    } else if (queueSize < 100 && this.workers.size > this.WORKER_COUNT) {
      // Remove excess workers
      const workersToRemove = Array.from(this.workers.keys()).slice(this.WORKER_COUNT);
      for (const workerId of workersToRemove) {
        const worker = this.workers.get(workerId);
        if (worker) {
          clearInterval(worker);
          this.workers.delete(workerId);
        }
      }
      logger.info('Scaled down sync workers due to low queue size');
    }

    // Adjust batch size based on throughput
    if (throughput < 10 && this.BATCH_SIZE > 50) {
      (this as any).BATCH_SIZE = 50;
    } else if (throughput > 100 && this.BATCH_SIZE < 200) {
      (this as any).BATCH_SIZE = 200;
    }
  }

  /**
   * Clear completed transactions older than specified days
   */
  async cleanupOldTransactions(daysOld = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const cleanupQuery = `
      DELETE FROM sync_transactions
      WHERE status = 'completed' 
      AND completed_at < $1
    `;

    const result = await databaseService.query(cleanupQuery, [cutoffDate]);
    
    logger.info(`Cleaned up ${result.rowCount} old sync transactions`);
    return result.rowCount || 0;
  }

  // Private helper methods

  private generateTransactionId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async addToQueue(transaction: SyncTransaction): Promise<void> {
    const queueKey = `${this.SYNC_QUEUE_KEY}:${transaction.priority}`;
    await redisCacheService.set(
      `sync:transaction:${transaction.id}`,
      transaction,
      { ttl: 86400 }
    );
    await redisCacheService.incr(`${this.SYNC_QUEUE_KEY}:size`);
  }

  private async getNextTransaction(): Promise<SyncTransaction | null> {
    // Check priority queues from high to low
    for (let priority = 10; priority >= 0; priority--) {
      const queueKey = `${this.SYNC_QUEUE_KEY}:${priority}`;
      const transactionIds = await redisCacheService.keys(`sync:transaction:*`);
      
      for (const id of transactionIds) {
        const transaction = await redisCacheService.get<SyncTransaction>(id);
        if (transaction && transaction.status === 'pending' && transaction.priority === priority) {
          return transaction;
        }
      }
    }
    
    return null;
  }

  private async moveToProcessing(transaction: SyncTransaction): Promise<void> {
    await redisCacheService.set(
      `${this.SYNC_PROCESSING_KEY}:${transaction.id}`,
      transaction,
      { ttl: 3600 }
    );
    await redisCacheService.incr(`${this.SYNC_PROCESSING_KEY}:count`);
    await redisCacheService.decr(`${this.SYNC_QUEUE_KEY}:size`);
  }

  private async completeTransaction(transaction: SyncTransaction): Promise<void> {
    await redisCacheService.del(`${this.SYNC_PROCESSING_KEY}:${transaction.id}`);
    await redisCacheService.del(`sync:transaction:${transaction.id}`);
    await redisCacheService.decr(`${this.SYNC_PROCESSING_KEY}:count`);
    
    // Store completion record
    const completionQuery = `
      INSERT INTO sync_transaction_history 
      (id, type, status, created_at, completed_at, processing_time_ms)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    const processingTime = transaction.completedAt!.getTime() - transaction.createdAt.getTime();
    await databaseService.query(completionQuery, [
      transaction.id,
      transaction.type,
      transaction.status,
      transaction.createdAt,
      transaction.completedAt,
      processingTime,
    ]);
  }

  private async requeueTransaction(transaction: SyncTransaction, reason: string): Promise<void> {
    transaction.status = 'pending';
    transaction.retryCount++;
    
    if (transaction.retryCount > transaction.maxRetries) {
      await this.handleTransactionError(
        transaction,
        new Error(`Max retries exceeded: ${reason}`)
      );
      return;
    }
    
    // Lower priority for retries
    transaction.priority = Math.max(0, transaction.priority - 1);
    
    await redisCacheService.del(`${this.SYNC_PROCESSING_KEY}:${transaction.id}`);
    await this.addToQueue(transaction);
  }

  private async handleTransactionError(transaction: SyncTransaction, error: Error): Promise<void> {
    transaction.status = 'failed';
    transaction.error = error.message;
    transaction.completedAt = new Date();
    
    this.metrics.failedTransactions++;
    
    await this.completeTransaction(transaction);
    
    this.emit('transaction-failed', {
      id: transaction.id,
      type: transaction.type,
      error: error.message,
      retryCount: transaction.retryCount,
    });
    
    logger.error(`Sync transaction failed: ${transaction.id}`, error);
  }

  private async checkDependencies(dependencies: string[]): Promise<boolean> {
    for (const depId of dependencies) {
      const dep = await redisCacheService.get<SyncTransaction>(`sync:transaction:${depId}`);
      if (!dep || dep.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  private async storeConflict(transaction: SyncTransaction, conflictData: any): Promise<void> {
    const conflictQuery = `
      INSERT INTO sync_conflicts 
      (transaction_id, type, client_data, server_data, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    await databaseService.query(conflictQuery, [
      transaction.id,
      transaction.type,
      JSON.stringify(conflictData.client),
      JSON.stringify(conflictData.server),
      new Date(),
    ]);
  }

  private updateMetrics(result: 'success' | 'failure', processingTime: number): void {
    if (result === 'success') {
      this.metrics.successfulTransactions++;
    } else {
      this.metrics.failedTransactions++;
    }
    
    const totalProcessed = this.metrics.successfulTransactions + this.metrics.failedTransactions;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (totalProcessed - 1) + processingTime) / totalProcessed;
    
    this.metrics.currentQueueSize = Math.max(0, this.metrics.currentQueueSize - 1);
    
    // Calculate throughput
    this.calculateThroughput();
  }

  private calculateThroughput(): void {
    // Simple throughput calculation - would be more sophisticated in production
    const totalProcessed = this.metrics.successfulTransactions + this.metrics.failedTransactions;
    const timeElapsed = Date.now() / 1000; // Simplified - would track actual start time
    this.metrics.throughputPerSecond = totalProcessed / Math.max(1, timeElapsed);
  }

  private async acquireProcessingLock(workerId: string): Promise<boolean> {
    const lockKey = `${this.SYNC_LOCK_KEY}:${workerId}`;
    return await redisCacheService.set(lockKey, true, { ttl: 10, nx: true });
  }

  private async releaseProcessingLock(workerId: string): Promise<void> {
    const lockKey = `${this.SYNC_LOCK_KEY}:${workerId}`;
    await redisCacheService.del(lockKey);
  }

  // Stub implementations for sync operations
  private async syncEncounter(data: any): Promise<any> {
    // Implementation would sync encounter data
    return { success: true };
  }

  private async syncObservation(data: any): Promise<any> {
    // Implementation would sync observation data
    return { success: true };
  }

  private async syncMedication(data: any): Promise<any> {
    // Implementation would sync medication data
    return { success: true };
  }

  private async processBatchItem(data: any): Promise<any> {
    // Implementation would process batch item
    return { success: true };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down sync coordination service...');
    
    // Stop all workers
    for (const [workerId, worker] of this.workers) {
      clearInterval(worker);
      logger.debug(`Stopped sync worker ${workerId}`);
    }
    
    this.workers.clear();
    this.removeAllListeners();
    
    logger.info('Sync coordination service shut down');
  }
}

// Export singleton instance
export const optimizedSyncCoordinationService = new OptimizedSyncCoordinationService();