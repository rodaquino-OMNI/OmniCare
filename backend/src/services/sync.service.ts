import { 
  Resource
} from '@medplum/fhirtypes';

import { auditService } from './audit.service';
import { databaseService } from './database.service';
import { medplumService } from './medplum.service';

import { validateResourceType } from '@/utils/fhir-validation.utils';
import logger from '@/utils/logger';

// ===============================
// TYPES AND INTERFACES
// ===============================

export interface SyncRequest {
  operations: SyncOperation[];
  lastSyncTimestamp?: string;
  syncToken?: string;
  clientId: string;
  resumeToken?: string;
  batchSize?: number;
  offset?: number;
}

export interface SyncOperation {
  id: string;
  resourceType: string;
  resourceId: string;
  operation: 'create' | 'update' | 'delete';
  resource?: Resource;
  version?: number;
  timestamp: string;
  checksum?: string;
}

export interface SyncResponse {
  success: boolean;
  operations: SyncOperationResult[];
  serverChanges?: Resource[];
  conflicts?: SyncConflict[];
  syncToken?: string;
  serverTimestamp: string;
  resumeToken?: string;
  completedOperations: number;
  totalOperations: number;
  hasMore: boolean;
  checkpointData?: SyncCheckpoint;
}

export interface SyncOperationResult {
  id: string;
  success: boolean;
  resourceType: string;
  resourceId: string;
  operation: string;
  serverVersion?: number;
  error?: string;
  conflict?: SyncConflict;
}

export interface SyncConflict {
  resourceType: string;
  resourceId: string;
  clientVersion: number;
  serverVersion: number;
  clientResource: Resource;
  serverResource: Resource;
  detectedAt: string;
}

export interface ResourceVersionInfo {
  resourceType: string;
  resourceId: string;
  version: number;
  lastModified: Date;
  checksum: string;
  lastModifiedBy?: string;
}

export interface SyncCheckpoint {
  id: string;
  clientId: string;
  userId: string;
  totalOperations: number;
  completedOperations: number;
  lastProcessedIndex: number;
  operationIds: string[];
  createdAt: Date;
  updatedAt: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused';
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface SyncSession {
  id: string;
  clientId: string;
  userId: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  operations: SyncOperation[];
  completedOperations: SyncOperationResult[];
  currentIndex: number;
  startedAt: Date;
  lastActivityAt: Date;
  resumeToken: string;
  metadata?: Record<string, any>;
}

/**
 * Synchronization Service
 * Handles bidirectional sync for FHIR resources with conflict detection
 */
export class SyncService {
  private versionCache: Map<string, ResourceVersionInfo> = new Map();
  private syncSessions: Map<string, SyncSession> = new Map();
  private checkpoints: Map<string, SyncCheckpoint> = new Map();
  private readonly BATCH_SIZE = 50;
  private readonly CHECKPOINT_INTERVAL = 10;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_RETRIES = 3;

  /**
   * Process sync request from client with resume capability
   */
  async processSync(syncRequest: SyncRequest, userId: string): Promise<SyncResponse> {
    const startTime = Date.now();
    let session: SyncSession | undefined;
    let checkpoint: SyncCheckpoint | undefined;

    try {
      // Check if this is a resume operation
      if (syncRequest.resumeToken) {
        session = await this.resumeSyncSession(syncRequest.resumeToken, userId);
        checkpoint = this.checkpoints.get(session.id);
        logger.info('Resuming sync session', {
          sessionId: session.id,
          currentIndex: session.currentIndex,
          totalOperations: session.operations.length
        });
      } else {
        // Create new sync session
        session = await this.createSyncSession(syncRequest, userId);
        checkpoint = await this.createCheckpoint(session);
        logger.info('Starting new sync session', {
          sessionId: session.id,
          operationCount: session.operations.length
        });
      }

      // Log sync attempt
      await auditService.logAccess({
        userId,
        action: syncRequest.resumeToken ? 'sync_resume' : 'sync_start',
        resource: 'Bundle',
        resourceId: syncRequest.clientId,
        metadata: {
          sessionId: session.id,
          operationCount: session.operations.length,
          resuming: !!syncRequest.resumeToken
        }
      });

      // Process operations with resume capability
      const result = await this.processSyncWithResume(session, checkpoint!, userId);

      // Get server changes since last sync (only for new syncs)
      let serverChanges: Resource[] = [];
      if (!syncRequest.resumeToken && syncRequest.lastSyncTimestamp) {
        serverChanges = await this.getServerChangesSince(
          new Date(syncRequest.lastSyncTimestamp),
          userId
        );
      }

      // Update session and checkpoint status
      if (result.completed) {
        await this.completeSyncSession(session.id);
        await this.completeCheckpoint(checkpoint!.id);
      } else {
        await this.pauseSyncSession(session.id);
      }

      logger.info('Sync processed', {
        userId,
        clientId: syncRequest.clientId,
        sessionId: session.id,
        operationsProcessed: result.results.length,
        conflicts: result.conflicts.length,
        completed: result.completed,
        duration: Date.now() - startTime
      });

      return {
        success: true,
        operations: result.results,
        serverChanges,
        conflicts: result.conflicts.length > 0 ? result.conflicts : undefined,
        syncToken: this.generateSyncToken(userId),
        serverTimestamp: new Date().toISOString(),
        resumeToken: result.completed ? undefined : session.resumeToken,
        completedOperations: session.completedOperations.length,
        totalOperations: session.operations.length,
        hasMore: !result.completed,
        checkpointData: checkpoint
      };

    } catch (error) {
      logger.error('Sync failed', {
        userId,
        clientId: syncRequest.clientId,
        sessionId: session?.id,
        error
      });

      // Mark session as failed if it exists
      if (session) {
        await this.failSyncSession(session.id, error as Error);
      }

      throw error;
    }
  }

  /**
   * Process a single sync operation
   */
  private async processSyncOperation(
    operation: SyncOperation, 
    userId: string
  ): Promise<SyncOperationResult> {
    try {
      switch (operation.operation) {
        case 'create':
          return await this.processCreate(operation, userId);
        
        case 'update':
          return await this.processUpdate(operation, userId);
        
        case 'delete':
          return await this.processDelete(operation, userId);
        
        default:
          throw new Error(`Unknown operation: ${String(operation.operation)}`);
      }
    } catch (error: any) {
      return {
        id: operation.id,
        success: false,
        resourceType: operation.resourceType,
        resourceId: operation.resourceId,
        operation: operation.operation,
        error: error.message
      };
    }
  }

  /**
   * Process create operation
   */
  private async processCreate(
    operation: SyncOperation,
    userId: string
  ): Promise<SyncOperationResult> {
    if (!operation.resource) {
      throw new Error('Resource data required for create operation');
    }

    try {
      // Add sync metadata
      const resourceWithMetadata = this.addSyncMetadata(operation.resource, userId);
      
      // Create resource
      const created = await medplumService.createResource(resourceWithMetadata);
      
      // Update version cache
      this.updateVersionCache(created);

      // Log audit
      await auditService.logAccess({
        userId,
        action: 'create',
        resource: created.resourceType,
        resourceId: created.id!,
        metadata: { syncOperation: true }
      });

      return {
        id: operation.id,
        success: true,
        resourceType: created.resourceType,
        resourceId: created.id!,
        operation: 'create',
        serverVersion: this.extractVersion(created)
      };

    } catch (error: any) {
      throw new Error(`Failed to create ${operation.resourceType}: ${error.message}`);
    }
  }

  /**
   * Process update operation
   */
  private async processUpdate(
    operation: SyncOperation,
    userId: string
  ): Promise<SyncOperationResult> {
    if (!operation.resource) {
      throw new Error('Resource data required for update operation');
    }

    try {
      // Get current server version
      const validatedResourceType = validateResourceType(operation.resourceType);
      const serverResource = await medplumService.readResource(
        validatedResourceType,
        operation.resourceId
      );

      if (!serverResource) {
        throw new Error('Resource not found on server');
      }

      // Check for conflicts
      const serverVersion = this.extractVersion(serverResource);
      const expectedVersion = operation.version || 0;

      if (serverVersion !== expectedVersion) {
        // Conflict detected
        return {
          id: operation.id,
          success: false,
          resourceType: operation.resourceType,
          resourceId: operation.resourceId,
          operation: 'update',
          serverVersion,
          conflict: {
            resourceType: operation.resourceType,
            resourceId: operation.resourceId,
            clientVersion: expectedVersion,
            serverVersion,
            clientResource: operation.resource,
            serverResource,
            detectedAt: new Date().toISOString()
          }
        };
      }

      // No conflict, proceed with update
      const resourceWithMetadata = this.addSyncMetadata(operation.resource, userId);
      const updated = await medplumService.updateResource(resourceWithMetadata);
      
      // Update version cache
      this.updateVersionCache(updated);

      // Log audit
      await auditService.logAccess({
        userId,
        action: 'update',
        resource: updated.resourceType,
        resourceId: updated.id!,
        metadata: { syncOperation: true }
      });

      return {
        id: operation.id,
        success: true,
        resourceType: updated.resourceType,
        resourceId: updated.id!,
        operation: 'update',
        serverVersion: this.extractVersion(updated)
      };

    } catch (error: any) {
      throw new Error(`Failed to update ${operation.resourceType}/${operation.resourceId}: ${error.message}`);
    }
  }

  /**
   * Process delete operation
   */
  private async processDelete(
    operation: SyncOperation,
    userId: string
  ): Promise<SyncOperationResult> {
    try {
      // Check if resource exists
      const validatedResourceType = validateResourceType(operation.resourceType);
      const exists = await medplumService.readResource(
        validatedResourceType,
        operation.resourceId
      );

      if (!exists) {
        // Already deleted
        return {
          id: operation.id,
          success: true,
          resourceType: operation.resourceType,
          resourceId: operation.resourceId,
          operation: 'delete'
        };
      }

      // Delete resource
      await medplumService.deleteResource(validatedResourceType, operation.resourceId);
      
      // Remove from version cache
      this.removeFromVersionCache(operation.resourceType, operation.resourceId);

      // Log audit
      await auditService.logAccess({
        userId,
        action: 'delete',
        resource: operation.resourceType,
        resourceId: operation.resourceId,
        metadata: { syncOperation: true }
      });

      return {
        id: operation.id,
        success: true,
        resourceType: operation.resourceType,
        resourceId: operation.resourceId,
        operation: 'delete'
      };

    } catch (error: any) {
      throw new Error(`Failed to delete ${operation.resourceType}/${operation.resourceId}: ${error.message}`);
    }
  }

  /**
   * Get server changes since a specific timestamp
   */
  private async getServerChangesSince(since: Date, userId: string): Promise<Resource[]> {
    const changes: Resource[] = [];
    
    // Resource types to sync
    const resourceTypes = [
      'Patient',
      'Practitioner',
      'Organization',
      'Encounter',
      'Observation',
      'MedicationRequest',
      'ServiceRequest',
      'DiagnosticReport',
      'CarePlan',
      'Condition',
      'AllergyIntolerance',
      'Procedure',
      'Immunization'
    ];

    for (const resourceType of resourceTypes) {
      try {
        const validatedResourceType = validateResourceType(resourceType);
        const bundle = await medplumService.searchResources(validatedResourceType, {
          _lastUpdated: `gt${since.toISOString()}`,
          _count: 1000 // Limit to prevent overwhelming response
        });

        if (bundle.entry) {
          for (const entry of bundle.entry) {
            if (entry.resource) {
              // Check if user has access to this resource
              const hasAccess = this.checkUserAccess(
                userId,
                entry.resource.resourceType,
                entry.resource.id!
              );

              if (hasAccess) {
                changes.push(entry.resource);
              }
            }
          }
        }
      } catch (error) {
        logger.error(`Failed to get ${resourceType} changes since ${String(since)}`, { error });
      }
    }

    return changes;
  }

  /**
   * Check if user has access to a resource
   */
  private checkUserAccess(
    _userId: string,
    _resourceType: string,
    _resourceId: string
  ): boolean {
    // TODO: Implement proper access control
    // For now, return true for all resources
    return true;
  }

  /**
   * Add sync metadata to resource
   */
  private addSyncMetadata(resource: Resource, userId: string): Resource {
    const now = new Date().toISOString();
    
    // Ensure meta exists
    resource.meta = resource.meta || {};
    
    // Update lastUpdated
    resource.meta.lastUpdated = now;
    
    // Add sync extensions
    resource.meta.extension = resource.meta.extension || [];
    
    // Remove existing sync extensions
    resource.meta.extension = resource.meta.extension.filter(ext => 
      !ext.url?.startsWith('http://omnicare.com/fhir/StructureDefinition/sync-')
    );
    
    // Add new sync extensions
    resource.meta.extension.push(
      {
        url: 'http://omnicare.com/fhir/StructureDefinition/sync-timestamp',
        valueDateTime: now
      },
      {
        url: 'http://omnicare.com/fhir/StructureDefinition/sync-user',
        valueString: userId
      }
    );

    return resource;
  }

  /**
   * Extract version from resource
   */
  private extractVersion(resource: Resource): number {
    return parseInt(resource.meta?.versionId || '1', 10);
  }

  /**
   * Calculate checksum for resource
   */
  private calculateChecksum(resource: Resource): string {
    // Simple checksum implementation
    // In production, use a proper hashing algorithm
    const str = JSON.stringify(resource);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Update version cache
   */
  private updateVersionCache(resource: Resource): void {
    if (!resource.id) return;

    const key = `${resource.resourceType}/${resource.id}`;
    const versionInfo: ResourceVersionInfo = {
      resourceType: resource.resourceType,
      resourceId: resource.id,
      version: this.extractVersion(resource),
      lastModified: new Date(resource.meta?.lastUpdated || new Date()),
      checksum: this.calculateChecksum(resource)
    };

    this.versionCache.set(key, versionInfo);
  }

  /**
   * Remove from version cache
   */
  private removeFromVersionCache(resourceType: string, resourceId: string): void {
    const key = `${resourceType}/${resourceId}`;
    this.versionCache.delete(key);
  }

  /**
   * Generate sync token
   */
  private generateSyncToken(userId: string): string {
    // Simple token generation
    // In production, use a proper token generation method
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${userId}-${timestamp}-${random}`;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `sync-session-${timestamp}-${random}`;
  }

  /**
   * Generate resume token
   */
  private generateResumeToken(sessionId: string, userId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `resume-${sessionId}-${userId}-${timestamp}-${random}`;
  }

  /**
   * Generate checkpoint ID
   */
  private generateCheckpointId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `checkpoint-${timestamp}-${random}`;
  }

  /**
   * Validate sync token
   */
  validateSyncToken(token: string): boolean {
    // Simple validation
    // In production, implement proper token validation
    const parts = token.split('-');
    if (parts.length !== 3) return false;
    
    const timestamp = parseInt(parts[1] ?? '0', 10);
    const age = Date.now() - timestamp;
    
    // Token expires after 24 hours
    return age < 24 * 60 * 60 * 1000;
  }

  /**
   * Create a new sync session
   */
  private async createSyncSession(syncRequest: SyncRequest, userId: string): Promise<SyncSession> {
    const sessionId = this.generateSessionId();
    const resumeToken = this.generateResumeToken(sessionId, userId);
    
    const session: SyncSession = {
      id: sessionId,
      clientId: syncRequest.clientId,
      userId,
      status: 'active',
      operations: syncRequest.operations,
      completedOperations: [],
      currentIndex: syncRequest.offset || 0,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      resumeToken,
      metadata: {
        batchSize: syncRequest.batchSize || this.BATCH_SIZE,
        originalRequestSize: syncRequest.operations.length
      }
    };

    // Store session in memory and persist to database
    this.syncSessions.set(sessionId, session);
    await this.persistSyncSession(session);

    return session;
  }

  /**
   * Resume an existing sync session
   */
  private async resumeSyncSession(resumeToken: string, userId: string): Promise<SyncSession> {
    const session = await this.loadSyncSessionByToken(resumeToken, userId);
    
    if (!session) {
      throw new Error('Invalid or expired resume token');
    }

    if (session.status === 'completed') {
      throw new Error('Sync session already completed');
    }

    if (session.status === 'failed') {
      throw new Error('Cannot resume failed sync session');
    }

    // Check session timeout
    const timeSinceLastActivity = new Date().getTime() - session.lastActivityAt.getTime();
    
    if (timeSinceLastActivity > this.SESSION_TIMEOUT) {
      throw new Error('Sync session has expired');
    }

    // Update session status and activity
    session.status = 'active';
    session.lastActivityAt = new Date();
    
    this.syncSessions.set(session.id, session);
    await this.persistSyncSession(session);

    return session;
  }

  /**
   * Create a checkpoint for the sync session
   */
  private async createCheckpoint(session: SyncSession): Promise<SyncCheckpoint> {
    const checkpoint: SyncCheckpoint = {
      id: this.generateCheckpointId(),
      clientId: session.clientId,
      userId: session.userId,
      totalOperations: session.operations.length,
      completedOperations: session.completedOperations.length,
      lastProcessedIndex: session.currentIndex,
      operationIds: session.operations.map(op => op.id),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending',
      metadata: {
        sessionId: session.id,
        resumeToken: session.resumeToken
      }
    };

    this.checkpoints.set(checkpoint.id, checkpoint);
    await this.persistCheckpoint(checkpoint);

    return checkpoint;
  }

  /**
   * Process sync operations with resume capability
   */
  private async processSyncWithResume(
    session: SyncSession, 
    checkpoint: SyncCheckpoint, 
    userId: string
  ): Promise<{ results: SyncOperationResult[], conflicts: SyncConflict[], completed: boolean }> {
    const results: SyncOperationResult[] = [...session.completedOperations];
    const conflicts: SyncConflict[] = [];
    const batchSize = session.metadata?.batchSize || this.BATCH_SIZE;
    
    let currentIndex = session.currentIndex;
    let operationsProcessed = 0;
    
    try {
      // Process operations in batches with checkpointing
      while (currentIndex < session.operations.length && operationsProcessed < batchSize) {
        const operation = session.operations[currentIndex];
        if (!operation) {
          logger.error('Operation not found at index', { currentIndex, sessionId: session.id });
          currentIndex++;
          continue;
        }
        
        // Ensure database connection is available
        await this.ensureDatabaseConnection();
        
        // Process the operation with retry logic
        const result = await this.processSyncOperationWithRetry(operation, userId);
        results.push(result);
        
        if (result.conflict) {
          conflicts.push(result.conflict);
        }
        
        currentIndex++;
        operationsProcessed++;
        
        // Create checkpoint every CHECKPOINT_INTERVAL operations
        if (operationsProcessed % this.CHECKPOINT_INTERVAL === 0) {
          await this.updateCheckpoint(checkpoint.id, currentIndex, results);
          this.updateSessionProgress(session.id, currentIndex, result);
        }
      }
      
      // Final checkpoint update
      await this.updateCheckpoint(checkpoint.id, currentIndex, results);
      this.updateSessionProgress(session.id, currentIndex, results[results.length - 1]!);
      
      const completed = currentIndex >= session.operations.length;
      
      return {
        results,
        conflicts,
        completed
      };
      
    } catch (error) {
      logger.error('Sync processing failed', {
        sessionId: session.id,
        currentIndex,
        error
      });
      
      // Update checkpoint with error state
      await this.updateCheckpoint(checkpoint.id, currentIndex, results, error as Error);
      
      throw error;
    }
  }

  /**
   * Process sync operation with retry logic
   */
  private async processSyncOperationWithRetry(
    operation: SyncOperation,
    userId: string,
    retryCount = 0
  ): Promise<SyncOperationResult> {
    try {
      return await this.processSyncOperation(operation, userId);
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        logger.warn('Sync operation failed, retrying', {
          operationId: operation.id,
          retryCount: retryCount + 1,
          error
        });
        
        // Exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.processSyncOperationWithRetry(operation, userId, retryCount + 1);
      }
      
      throw error;
    }
  }

  /**
   * Ensure database connection is available
   */
  private async ensureDatabaseConnection(): Promise<void> {
    try {
      const health = await databaseService.checkHealth();
      if (health.status === 'unhealthy') {
        logger.warn('Database connection unhealthy, attempting reconnection');
        
        // Attempt to reinitialize database connection
        await databaseService.initialize();
        
        // Verify connection is restored
        const newHealth = await databaseService.checkHealth();
        if (newHealth.status === 'unhealthy') {
          throw new Error('Failed to restore database connection');
        }
        
        logger.info('Database connection restored successfully');
      }
    } catch (error) {
      logger.error('Database connection check failed', { error });
      throw new Error('Database connection unavailable');
    }
  }

  /**
   * Complete a sync session
   */
  private async completeSyncSession(sessionId: string): Promise<void> {
    const session = this.syncSessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.lastActivityAt = new Date();
      await this.persistSyncSession(session);
    }
  }

  /**
   * Complete a checkpoint
   */
  private async completeCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (checkpoint) {
      checkpoint.status = 'completed';
      checkpoint.updatedAt = new Date();
      await this.persistCheckpoint(checkpoint);
    }
  }

  /**
   * Pause a sync session
   */
  private async pauseSyncSession(sessionId: string): Promise<void> {
    const session = this.syncSessions.get(sessionId);
    if (session) {
      session.status = 'paused';
      session.lastActivityAt = new Date();
      await this.persistSyncSession(session);
    }
  }

  /**
   * Mark a sync session as failed
   */
  private async failSyncSession(sessionId: string, error: Error): Promise<void> {
    const session = this.syncSessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.lastActivityAt = new Date();
      session.metadata = {
        ...session.metadata,
        errorMessage: error.message,
        errorStack: error.stack
      };
      await this.persistSyncSession(session);
    }
  }

  /**
   * Persist sync session to database
   */
  private async persistSyncSession(session: SyncSession): Promise<void> {
    try {
      await databaseService.query(
        `INSERT INTO sync_sessions (id, client_id, user_id, status, operations, completed_operations, 
         current_index, started_at, last_activity_at, resume_token, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
         status = $4, completed_operations = $6, current_index = $7,
         last_activity_at = $9, metadata = $11`,
        [
          session.id,
          session.clientId,
          session.userId,
          session.status,
          JSON.stringify(session.operations),
          JSON.stringify(session.completedOperations),
          session.currentIndex,
          session.startedAt,
          session.lastActivityAt,
          session.resumeToken,
          JSON.stringify(session.metadata)
        ]
      );
    } catch (error) {
      logger.error('Failed to persist sync session', { sessionId: session.id, error });
    }
  }

  /**
   * Load sync session by resume token
   */
  private async loadSyncSessionByToken(resumeToken: string, userId: string): Promise<SyncSession | null> {
    try {
      const result = await databaseService.query(
        `SELECT * FROM sync_sessions WHERE resume_token = $1 AND user_id = $2`,
        [resumeToken, userId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      if (!row) {
        return null;
      }
      
      const session: SyncSession = {
        id: row.id,
        clientId: row.client_id,
        userId: row.user_id,
        status: row.status,
        operations: JSON.parse(row.operations),
        completedOperations: JSON.parse(row.completed_operations),
        currentIndex: row.current_index,
        startedAt: new Date(row.started_at),
        lastActivityAt: new Date(row.last_activity_at),
        resumeToken: row.resume_token,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      };
      
      return session;
    } catch (error) {
      logger.error('Failed to load sync session', { resumeToken, error });
      return null;
    }
  }

  /**
   * Persist checkpoint to database
   */
  private async persistCheckpoint(checkpoint: SyncCheckpoint): Promise<void> {
    try {
      await databaseService.query(
        `INSERT INTO sync_checkpoints (id, client_id, user_id, total_operations, completed_operations,
         last_processed_index, operation_ids, created_at, updated_at, status, error_message, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
         completed_operations = $5, last_processed_index = $6, updated_at = $9,
         status = $10, error_message = $11, metadata = $12`,
        [
          checkpoint.id,
          checkpoint.clientId,
          checkpoint.userId,
          checkpoint.totalOperations,
          checkpoint.completedOperations,
          checkpoint.lastProcessedIndex,
          JSON.stringify(checkpoint.operationIds),
          checkpoint.createdAt,
          checkpoint.updatedAt,
          checkpoint.status,
          checkpoint.errorMessage,
          JSON.stringify(checkpoint.metadata)
        ]
      );
    } catch (error) {
      logger.error('Failed to persist checkpoint', { checkpointId: checkpoint.id, error });
    }
  }

  /**
   * Update checkpoint progress
   */
  private async updateCheckpoint(
    checkpointId: string,
    currentIndex: number,
    results: SyncOperationResult[],
    error?: Error
  ): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (checkpoint) {
      checkpoint.lastProcessedIndex = currentIndex;
      checkpoint.completedOperations = results.length;
      checkpoint.updatedAt = new Date();
      checkpoint.status = error ? 'failed' : currentIndex >= checkpoint.totalOperations ? 'completed' : 'in_progress';
      checkpoint.errorMessage = error?.message;
      
      await this.persistCheckpoint(checkpoint);
    }
  }

  /**
   * Update session progress
   */
  private updateSessionProgress(
    sessionId: string,
    currentIndex: number,
    lastResult: SyncOperationResult
  ): void {
    const session = this.syncSessions.get(sessionId);
    if (session) {
      session.currentIndex = currentIndex;
      session.completedOperations.push(lastResult);
      session.lastActivityAt = new Date();
      
      // Don't persist on every update for performance, only in memory
      // Persistence happens on pause/complete/fail
    }
  }

  /**
   * Get active sync sessions
   */
  private async getActiveSyncSessions(clientId: string, userId?: string): Promise<SyncSession[]> {
    try {
      let query = `SELECT * FROM sync_sessions WHERE client_id = $1 AND status IN ('active', 'paused')`;
      const params: any[] = [clientId];
      
      if (userId) {
        query += ` AND user_id = $2`;
        params.push(userId);
      }
      
      const result = await databaseService.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        clientId: row.client_id,
        userId: row.user_id,
        status: row.status,
        operations: JSON.parse(row.operations),
        completedOperations: JSON.parse(row.completed_operations),
        currentIndex: row.current_index,
        startedAt: new Date(row.started_at),
        lastActivityAt: new Date(row.last_activity_at),
        resumeToken: row.resume_token,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      }));
    } catch (error) {
      logger.error('Failed to get active sync sessions', { clientId, error });
      return [];
    }
  }

  /**
   * Get recent checkpoints
   */
  private async getRecentCheckpoints(clientId: string, userId?: string): Promise<SyncCheckpoint[]> {
    try {
      let query = `SELECT * FROM sync_checkpoints WHERE client_id = $1`;
      const params: any[] = [clientId];
      
      if (userId) {
        query += ` AND user_id = $2`;
        params.push(userId);
      }
      
      query += ` ORDER BY created_at DESC LIMIT 10`;
      
      const result = await databaseService.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        clientId: row.client_id,
        userId: row.user_id,
        totalOperations: row.total_operations,
        completedOperations: row.completed_operations,
        lastProcessedIndex: row.last_processed_index,
        operationIds: JSON.parse(row.operation_ids),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        status: row.status,
        errorMessage: row.error_message,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      }));
    } catch (error) {
      logger.error('Failed to get recent checkpoints', { clientId, error });
      return [];
    }
  }

  /**
   * Calculate sync statistics
   */
  private async calculateSyncStats(
    clientId: string,
    userId?: string
  ): Promise<{
    pendingOperations: number;
    completedOperations: number;
    conflicts: number;
    lastSyncTimestamp?: string;
    lastSuccessfulSyncTimestamp?: string;
  }> {
    try {
      // Get stats from database
      let query = `
        SELECT 
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_operations,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_operations,
          MAX(created_at) as last_sync,
          MAX(CASE WHEN status = 'completed' THEN created_at END) as last_successful_sync
        FROM sync_checkpoints
        WHERE client_id = $1
      `;
      const params: any[] = [clientId];
      
      if (userId) {
        query += ` AND user_id = $2`;
        params.push(userId);
      }
      
      const result = await databaseService.query(query, params);
      const row = result.rows[0];
      
      // Count conflicts from recent sessions
      const sessions = await this.getActiveSyncSessions(clientId, userId);
      let conflictCount = 0;
      
      for (const session of sessions) {
        conflictCount += session.completedOperations.filter(op => op.conflict).length;
      }
      
      return {
        pendingOperations: parseInt(row?.pending_operations || '0'),
        completedOperations: parseInt(row?.completed_operations || '0'),
        conflicts: conflictCount,
        lastSyncTimestamp: row?.last_sync ? new Date(row.last_sync).toISOString() : undefined,
        lastSuccessfulSyncTimestamp: row?.last_successful_sync ? new Date(row.last_successful_sync).toISOString() : undefined
      };
    } catch (error) {
      logger.error('Failed to calculate sync stats', { clientId, error });
      return {
        pendingOperations: 0,
        completedOperations: 0,
        conflicts: 0
      };
    }
  }

  /**
   * Get sync service health status
   */
  private async getSyncServiceHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeSessions: number;
    queuedOperations: number;
    lastCheckpoint?: string;
  }> {
    try {
      // Check database health
      const dbHealth = await databaseService.checkHealth();
      
      // Count active sessions
      const activeSessions = Array.from(this.syncSessions.values())
        .filter(s => s.status === 'active').length;
      
      // Count queued operations
      let queuedOperations = 0;
      for (const session of this.syncSessions.values()) {
        if (session.status === 'active' || session.status === 'paused') {
          queuedOperations += session.operations.length - session.completedOperations.length;
        }
      }
      
      // Get last checkpoint time
      const checkpoints = Array.from(this.checkpoints.values())
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const lastCheckpoint = checkpoints[0]?.updatedAt.toISOString();
      
      return {
        status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
        activeSessions,
        queuedOperations,
        lastCheckpoint
      };
    } catch (error) {
      logger.error('Failed to get sync service health', { error });
      return {
        status: 'unhealthy',
        activeSessions: 0,
        queuedOperations: 0
      };
    }
  }

  /**
   * Get sync status for a client with enhanced tracking
   */
  async getSyncStatus(clientId: string, userId?: string): Promise<any> {
    try {
      // Get active sessions for client
      const activeSessions = await this.getActiveSyncSessions(clientId, userId);
      
      // Get recent checkpoints
      const recentCheckpoints = await this.getRecentCheckpoints(clientId, userId);
      
      // Calculate sync statistics
      const stats = await this.calculateSyncStats(clientId, userId);
      
      return {
        clientId,
        userId,
        activeSessions: activeSessions.length,
        pendingOperations: stats.pendingOperations,
        completedOperations: stats.completedOperations,
        conflicts: stats.conflicts,
        lastSync: stats.lastSyncTimestamp,
        lastSuccessfulSync: stats.lastSuccessfulSyncTimestamp,
        syncSessions: activeSessions.map(session => ({
          id: session.id,
          status: session.status,
          progress: {
            completed: session.completedOperations.length,
            total: session.operations.length,
            percentage: Math.round((session.completedOperations.length / session.operations.length) * 100)
          },
          resumeToken: session.resumeToken,
          startedAt: session.startedAt,
          lastActivityAt: session.lastActivityAt
        })),
        recentCheckpoints: recentCheckpoints.slice(0, 5), // Last 5 checkpoints
        healthStatus: await this.getSyncServiceHealth()
      };
    } catch (error) {
      logger.error('Failed to get sync status', { clientId, userId, error });
      
      return {
        clientId,
        userId,
        error: 'Failed to retrieve sync status',
        lastSync: new Date().toISOString(),
        pendingOperations: 0,
        conflicts: 0
      };
    }
  }
}

// Export singleton instance
export const syncService = new SyncService();