import { 
  Resource, 
  Bundle, 
  BundleEntry, 
  OperationOutcome,
  Meta,
  Extension
} from '@medplum/fhirtypes';
import { medplumService } from './medplum.service';
import { auditService } from './audit.service';
import logger from '@/utils/logger';
import { validateResourceType } from '@/utils/fhir-validation.utils';

// ===============================
// TYPES AND INTERFACES
// ===============================

export interface SyncRequest {
  operations: SyncOperation[];
  lastSyncTimestamp?: string;
  syncToken?: string;
  clientId: string;
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

/**
 * Synchronization Service
 * Handles bidirectional sync for FHIR resources with conflict detection
 */
export class SyncService {
  private versionCache: Map<string, ResourceVersionInfo> = new Map();

  /**
   * Process sync request from client
   */
  async processSync(syncRequest: SyncRequest, userId: string): Promise<SyncResponse> {
    const startTime = Date.now();
    const results: SyncOperationResult[] = [];
    const conflicts: SyncConflict[] = [];
    const serverChanges: Resource[] = [];

    try {
      // Log sync attempt
      await auditService.logAccess({
        userId,
        action: 'sync',
        resourceType: 'Bundle',
        resourceId: syncRequest.clientId,
        metadata: {
          operationCount: syncRequest.operations.length,
          lastSyncTimestamp: syncRequest.lastSyncTimestamp
        }
      });

      // Process each operation
      for (const operation of syncRequest.operations) {
        const result = await this.processSyncOperation(operation, userId);
        results.push(result);

        if (result.conflict) {
          conflicts.push(result.conflict);
        }
      }

      // Get server changes since last sync
      if (syncRequest.lastSyncTimestamp) {
        const changes = await this.getServerChangesSince(
          new Date(syncRequest.lastSyncTimestamp),
          userId
        );
        serverChanges.push(...changes);
      }

      // Generate new sync token
      const syncToken = this.generateSyncToken(userId);

      logger.info('Sync completed', {
        userId,
        clientId: syncRequest.clientId,
        operationsProcessed: results.length,
        conflicts: conflicts.length,
        serverChanges: serverChanges.length,
        duration: Date.now() - startTime
      });

      return {
        success: true,
        operations: results,
        serverChanges,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
        syncToken,
        serverTimestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Sync failed', {
        userId,
        clientId: syncRequest.clientId,
        error
      });

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
          throw new Error(`Unknown operation: ${operation.operation}`);
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
        resourceType: created.resourceType,
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
        resourceType: updated.resourceType,
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
        resourceType: operation.resourceType,
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
              const hasAccess = await this.checkUserAccess(
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
        logger.error(`Failed to get ${resourceType} changes since ${since}`, { error });
      }
    }

    return changes;
  }

  /**
   * Check if user has access to a resource
   */
  private async checkUserAccess(
    userId: string,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
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
   * Validate sync token
   */
  async validateSyncToken(token: string): Promise<boolean> {
    // Simple validation
    // In production, implement proper token validation
    const parts = token.split('-');
    if (parts.length !== 3) return false;
    
    const timestamp = parseInt(parts[1], 10);
    const age = Date.now() - timestamp;
    
    // Token expires after 24 hours
    return age < 24 * 60 * 60 * 1000;
  }

  /**
   * Get sync status for a client
   */
  async getSyncStatus(clientId: string, userId: string): Promise<any> {
    // TODO: Implement sync status tracking
    return {
      clientId,
      lastSync: new Date().toISOString(),
      pendingOperations: 0,
      conflicts: 0
    };
  }
}

// Export singleton instance
export const syncService = new SyncService();