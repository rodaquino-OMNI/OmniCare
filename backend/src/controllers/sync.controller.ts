import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { SyncRequest, syncService } from '@/services/sync.service';
import { ConflictResolutionData, SyncResourceData } from '@/types/database.types';
import { AppError } from '@/utils/error.utils';
import logger from '@/utils/logger';

// ===============================
// VALIDATION SCHEMAS
// ===============================

const syncResourceSchema = z.object({
  id: z.string(),
  resourceType: z.string(),
  meta: z.object({
    versionId: z.string().optional(),
    lastUpdated: z.string().optional()
  }).optional()
}).passthrough();

const syncOperationSchema = z.object({
  id: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  operation: z.enum(['create', 'update', 'delete']),
  resource: syncResourceSchema.optional() as z.ZodOptional<z.ZodType<SyncResourceData>>,
  version: z.number().optional(),
  timestamp: z.string(),
  checksum: z.string().optional()
});

const syncRequestSchema = z.object({
  operations: z.array(syncOperationSchema),
  lastSyncTimestamp: z.string().optional(),
  syncToken: z.string().optional(),
  clientId: z.string()
});

const conflictResolutionSchema = z.object({
  conflictId: z.string(),
  strategy: z.enum(['local-wins', 'remote-wins', 'last-write-wins', 'merge', 'manual']),
  winningResource: syncResourceSchema as z.ZodType<ConflictResolutionData>,
  reason: z.string().optional()
});

/**
 * Sync Controller
 * Handles offline synchronization endpoints
 */
export class SyncController {
  /**
   * Process sync request
   * POST /api/sync
   */
  async sync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request body
      const validatedData = syncRequestSchema.parse(req.body);
      const userId = req.user?.id || 'anonymous';

      logger.info('Processing sync request', {
        userId,
        clientId: validatedData.clientId,
        operationCount: validatedData.operations.length
      });

      // Process sync
      const result = await syncService.processSync(validatedData as SyncRequest, userId);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new AppError('Invalid sync request data', 400, true, 'VALIDATION_ERROR'));
      } else {
        next(error);
      }
    }
  }

  /**
   * Get sync status
   * GET /api/sync/status/:clientId
   */
  async getSyncStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clientId } = req.params;
      if (!clientId) {
        return next(new AppError('Client ID is required', 400, true, 'MISSING_PARAM'));
      }
      const userId = req.user?.id || 'anonymous';

      const status = await syncService.getSyncStatus(clientId, userId);

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate sync token
   * POST /api/sync/validate-token
   */
  validateToken(req: Request, res: Response, next: NextFunction): void {
    try {
      const { token } = req.body;

      if (!token) {
        throw new AppError('Sync token required', 400);
      }

      const isValid = syncService.validateSyncToken(token);

      res.json({
        success: true,
        data: { valid: isValid }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Resolve conflict
   * POST /api/sync/resolve-conflict
   */
  resolveConflict(req: Request, res: Response, next: NextFunction): void {
    try {
      // Validate request body
      const validatedData = conflictResolutionSchema.parse(req.body);
      const userId = req.user?.id || 'anonymous';

      logger.info('Resolving sync conflict', {
        userId,
        conflictId: validatedData.conflictId,
        strategy: validatedData.strategy
      });

      // TODO: Implement conflict resolution logic
      // For now, just return success
      res.json({
        success: true,
        data: {
          conflictId: validatedData.conflictId,
          resolved: true,
          strategy: validatedData.strategy
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new AppError('Invalid conflict resolution data', 400, true, 'VALIDATION_ERROR'));
      } else {
        next(error);
      }
    }
  }

  /**
   * Get pending conflicts
   * GET /api/sync/conflicts
   */
  getConflicts(req: Request, res: Response, next: NextFunction): void {
    try {
      const _userId = req.user?.id || 'anonymous';
      const { resolved: _resolved = 'false' } = req.query;

      // TODO: Implement conflict retrieval logic
      // For now, return empty array
      res.json({
        success: true,
        data: {
          conflicts: [],
          total: 0
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Batch sync operation
   * POST /api/sync/batch
   */
  async batchSync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { requests } = req.body;
      const userId = req.user?.id || 'anonymous';

      if (!Array.isArray(requests)) {
        throw new AppError('Batch requests must be an array', 400);
      }

      logger.info('Processing batch sync request', {
        userId,
        batchSize: requests.length
      });

      // Process each sync request
      const results = await Promise.all(
        requests.map(async (request) => {
          try {
            const validatedData = syncRequestSchema.parse(request);
            return await syncService.processSync(validatedData as SyncRequest, userId);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error occurred',
              clientId: request.clientId
            };
          }
        })
      );

      res.json({
        success: true,
        data: {
          results,
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sync configuration
   * GET /api/sync/config
   */
  getConfig(_req: Request, res: Response, next: NextFunction): void {
    try {
      // Return sync configuration
      res.json({
        success: true,
        data: {
          maxBatchSize: 100,
          maxOperationsPerSync: 500,
          conflictResolutionStrategies: [
            'local-wins',
            'remote-wins',
            'last-write-wins',
            'merge',
            'manual'
          ],
          supportedResourceTypes: [
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
          ],
          syncInterval: 30000, // 30 seconds
          tokenExpiry: 86400000 // 24 hours
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check for sync service
   * GET /api/sync/health
   */
  healthCheck(_req: Request, res: Response, next: NextFunction): void {
    try {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const syncController = new SyncController();