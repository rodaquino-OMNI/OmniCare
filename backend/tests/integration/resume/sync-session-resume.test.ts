/**
 * Backend Sync Session Resume Integration Tests
 * Tests server-side resume functionality with checkpoints and session management
 */

// jest is globally available in test environment
import { auditService } from '../../../src/services/audit.service';
import { databaseService } from '../../../src/services/database.service';
import { medplumService } from '../../../src/services/medplum.service';
import { syncService, SyncService } from '../../../src/services/sync.service';
import type { 
  SyncRequest, 
  SyncResponse, 
  SyncOperation, 
  SyncCheckpoint, 
  SyncSession 
} from '../../../src/services/sync.service';

// Mock dependencies
jest.mock('../../../src/services/audit.service');
jest.mock('../../../src/services/medplum.service');
jest.mock('../../../src/services/database.service');

describe('Backend Sync Session Resume Integration', () => {
  let testSyncService: SyncService;
  let mockUserId: string;
  let mockClientId: string;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create fresh service instance for each test
    testSyncService = new SyncService();
    mockUserId = 'test-user-123';
    mockClientId = 'test-client-456';

    // Setup default mock implementations
    (auditService.logAccess as any).mockResolvedValue(undefined);
    (medplumService.createResource as any).mockImplementation((resource: any) => 
      Promise.resolve({ ...resource, id: `${resource.resourceType}-${Date.now()}` })
    );
    (medplumService.updateResource as any).mockImplementation((resource: any) => 
      Promise.resolve({ ...resource, meta: { ...resource.meta, versionId: '2' } })
    );
    (medplumService.deleteResource as any).mockResolvedValue(undefined);
    (medplumService.readResource as any).mockImplementation((type: string, id: string) => 
      Promise.resolve({ resourceType: type, id, meta: { versionId: '1' } })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Session Creation and Resume', () => {
    it('should create new sync session and generate resume token', async () => {
      const syncRequest: SyncRequest = {
        operations: [
          {
            id: 'op-1',
            resourceType: 'Patient',
            resourceId: 'patient-1',
            operation: 'create',
            resource: {
              resourceType: 'Patient',
              name: [{ given: ['Test'], family: 'Patient' }]
            },
            timestamp: new Date().toISOString()
          },
          {
            id: 'op-2',
            resourceType: 'Encounter',
            resourceId: 'encounter-1',
            operation: 'update',
            resource: {
              resourceType: 'Encounter',
              id: 'encounter-1',
              status: 'finished'
            },
            version: 1,
            timestamp: new Date().toISOString()
          }
        ],
        clientId: mockClientId,
        batchSize: 10
      };

      const result = await testSyncService.processSync(syncRequest, mockUserId);

      expect(result.success).toBe(true);
      expect(result.resumeToken).toBeDefined();
      expect(result.totalOperations).toBe(2);
      expect(result.completedOperations).toBe(2);
      expect(result.hasMore).toBe(false);
      expect(result.checkpointData).toBeDefined();
      
      // Verify audit logging
      expect(auditService.logAccess).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'sync_start',
        resource: 'Bundle',
        resourceId: mockClientId,
        metadata: expect.objectContaining({
          operationCount: 2,
          resuming: false
        })
      });
    });

    it('should resume sync session from checkpoint', async () => {
      // First, create a large sync session that gets interrupted
      const largeSyncRequest: SyncRequest = {
        operations: Array.from({ length: 100 }, (_, i) => ({
          id: `op-${i}`,
          resourceType: 'Observation',
          resourceId: `obs-${i}`,
          operation: 'create',
          resource: {
            resourceType: 'Observation',
            status: 'final',
            code: { text: `Test ${i}` }
          },
          timestamp: new Date().toISOString()
        })),
        clientId: mockClientId,
        batchSize: 20
      };

      // Start sync but simulate interruption after 40 operations
      let processedCount = 0;
      (medplumService.createResource as jest.Mock).mockImplementation((resource) => {
        processedCount++;
        if (processedCount > 40) {
          throw new Error('Network interruption');
        }
        return Promise.resolve({ ...resource, id: `${resource.resourceType}-${Date.now()}` });
      });

      let initialResult: SyncResponse;
      try {
        initialResult = await testSyncService.processSync(largeSyncRequest, mockUserId);
      } catch (error) {
        // Expected interruption
        expect(processedCount).toBeGreaterThan(40);
      }

      // Reset mock to allow successful processing
      (medplumService.createResource as jest.Mock).mockImplementation((resource) => 
        Promise.resolve({ ...resource, id: `${resource.resourceType}-${Date.now()}` })
      );

      // Create resume request with the resume token
      const resumeRequest: SyncRequest = {
        operations: [], // Empty for resume
        clientId: mockClientId,
        resumeToken: initialResult!.resumeToken,
        batchSize: 20
      };

      const resumeResult = await testSyncService.processSync(resumeRequest, mockUserId);

      expect(resumeResult.success).toBe(true);
      expect(resumeResult.completedOperations).toBeGreaterThan(40);
      expect(resumeResult.totalOperations).toBe(100);
      
      // Verify audit logging for resume
      expect(auditService.logAccess).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'sync_resume',
        resource: 'Bundle',
        resourceId: mockClientId,
        metadata: expect.objectContaining({
          resuming: true
        })
      });
    });

    it('should handle multiple resume attempts for same session', async () => {
      const syncRequest: SyncRequest = {
        operations: Array.from({ length: 50 }, (_, i) => ({
          id: `multi-resume-${i}`,
          resourceType: 'Patient',
          resourceId: `patient-${i}`,
          operation: 'create',
          resource: {
            resourceType: 'Patient',
            name: [{ given: ['Patient'], family: `${i}` }]
          },
          timestamp: new Date().toISOString()
        })),
        clientId: mockClientId,
        batchSize: 10
      };

      // First attempt - process 20 then fail
      let callCount = 0;
      (medplumService.createResource as jest.Mock).mockImplementation((resource) => {
        callCount++;
        if (callCount > 20) {
          throw new Error('First interruption');
        }
        return Promise.resolve({ ...resource, id: `${resource.resourceType}-${callCount}` });
      });

      let firstResult: SyncResponse;
      try {
        firstResult = await testSyncService.processSync(syncRequest, mockUserId);
      } catch (error) {
        // Expected first interruption
      }

      // Second attempt - process 15 more then fail
      callCount = 20; // Reset to continue from where we left off
      (medplumService.createResource as jest.Mock).mockImplementation((resource) => {
        callCount++;
        if (callCount > 35) {
          throw new Error('Second interruption');
        }
        return Promise.resolve({ ...resource, id: `${resource.resourceType}-${callCount}` });
      });

      const secondResumeRequest: SyncRequest = {
        operations: [],
        clientId: mockClientId,
        resumeToken: firstResult!.resumeToken,
        batchSize: 10
      };

      let secondResult: SyncResponse;
      try {
        secondResult = await testSyncService.processSync(secondResumeRequest, mockUserId);
      } catch (error) {
        // Expected second interruption
      }

      // Third attempt - complete successfully
      (medplumService.createResource as jest.Mock).mockImplementation((resource) => 
        Promise.resolve({ ...resource, id: `${resource.resourceType}-${Date.now()}` })
      );

      const finalResumeRequest: SyncRequest = {
        operations: [],
        clientId: mockClientId,
        resumeToken: secondResult!.resumeToken,
        batchSize: 10
      };

      const finalResult = await testSyncService.processSync(finalResumeRequest, mockUserId);

      expect(finalResult.success).toBe(true);
      expect(finalResult.hasMore).toBe(false);
      expect(finalResult.completedOperations).toBe(50);
      expect(finalResult.totalOperations).toBe(50);
    });
  });

  describe('Checkpoint Management', () => {
    it('should create checkpoints at regular intervals', async () => {
      const largeSync: SyncRequest = {
        operations: Array.from({ length: 100 }, (_, i) => ({
          id: `checkpoint-${i}`,
          resourceType: 'Observation',
          resourceId: `obs-${i}`,
          operation: 'create',
          resource: {
            resourceType: 'Observation',
            status: 'final',
            code: { text: `Checkpoint Test ${i}` }
          },
          timestamp: new Date().toISOString()
        })),
        clientId: mockClientId,
        batchSize: 5 // Small batch size to trigger more checkpoints
      };

      const result = await testSyncService.processSync(largeSync, mockUserId);

      expect(result.checkpointData).toBeDefined();
      expect(result.checkpointData!.totalOperations).toBe(100);
      expect(result.checkpointData!.completedOperations).toBe(100);
      expect(result.checkpointData!.status).toBe('completed');
    });

    it('should restore from checkpoint after system failure', async () => {
      const syncRequest: SyncRequest = {
        operations: Array.from({ length: 30 }, (_, i) => ({
          id: `recovery-${i}`,
          resourceType: 'Patient',
          resourceId: `patient-${i}`,
          operation: 'create',
          resource: {
            resourceType: 'Patient',
            name: [{ given: ['Recovery'], family: `${i}` }]
          },
          timestamp: new Date().toISOString()
        })),
        clientId: mockClientId,
        batchSize: 10
      };

      // Simulate system failure after 20 operations
      let operationCount = 0;
      (medplumService.createResource as jest.Mock).mockImplementation((resource) => {
        operationCount++;
        if (operationCount > 20) {
          throw new Error('System failure');
        }
        return Promise.resolve({ ...resource, id: `${resource.resourceType}-${operationCount}` });
      });

      let initialResult: SyncResponse;
      try {
        initialResult = await testSyncService.processSync(syncRequest, mockUserId);
      } catch (error) {
        // Expected system failure
      }

      // Simulate service restart - should be able to resume from checkpoint
      const newSyncService = new SyncService();
      
      // Reset mock for successful completion
      (medplumService.createResource as jest.Mock).mockImplementation((resource) => 
        Promise.resolve({ ...resource, id: `${resource.resourceType}-${Date.now()}` })
      );

      const resumeRequest: SyncRequest = {
        operations: [],
        clientId: mockClientId,
        resumeToken: initialResult!.resumeToken,
        batchSize: 10
      };

      const resumeResult = await newSyncService.processSync(resumeRequest, mockUserId);

      expect(resumeResult.success).toBe(true);
      expect(resumeResult.completedOperations).toBeGreaterThan(20);
      expect(resumeResult.totalOperations).toBe(30);
    });

    it('should handle checkpoint corruption gracefully', async () => {
      const syncRequest: SyncRequest = {
        operations: [
          {
            id: 'corrupt-checkpoint-test',
            resourceType: 'Patient',
            resourceId: 'patient-corrupt',
            operation: 'create',
            resource: {
              resourceType: 'Patient',
              name: [{ given: ['Corrupt'], family: 'Test' }]
            },
            timestamp: new Date().toISOString()
          }
        ],
        clientId: mockClientId,
        resumeToken: 'invalid-corrupted-token'
      };

      // Should handle gracefully and start new session
      const result = await testSyncService.processSync(syncRequest, mockUserId);

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].success).toBe(true);
    });
  });

  describe('Conflict Resolution During Resume', () => {
    it('should handle conflicts that occur during resume operations', async () => {
      const conflictSyncRequest: SyncRequest = {
        operations: [
          {
            id: 'conflict-resume-1',
            resourceType: 'Patient',
            resourceId: 'patient-conflict',
            operation: 'update',
            resource: {
              resourceType: 'Patient',
              id: 'patient-conflict',
              name: [{ given: ['Updated'], family: 'Client' }],
              meta: { versionId: '1' }
            },
            version: 1,
            timestamp: new Date().toISOString()
          }
        ],
        clientId: mockClientId
      };

      // Mock server to return different version (conflict)
      (medplumService.readResource as jest.Mock).mockResolvedValue({
        resourceType: 'Patient',
        id: 'patient-conflict',
        name: [{ given: ['Updated'], family: 'Server' }],
        meta: { versionId: '2' }
      });

      const result = await testSyncService.processSync(conflictSyncRequest, mockUserId);

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].success).toBe(false);
      expect(result.operations[0].conflict).toBeDefined();
      expect(result.conflicts).toHaveLength(1);
      
      const conflict = result.operations[0].conflict!;
      expect(conflict.clientVersion).toBe(1);
      expect(conflict.serverVersion).toBe(2);
    });

    it('should retry failed operations with exponential backoff during resume', async () => {
      const retryRequest: SyncRequest = {
        operations: [
          {
            id: 'retry-test',
            resourceType: 'Observation',
            resourceId: 'obs-retry',
            operation: 'create',
            resource: {
              resourceType: 'Observation',
              status: 'final',
              code: { text: 'Retry Test' }
            },
            timestamp: new Date().toISOString()
          }
        ],
        clientId: mockClientId
      };

      // Mock to fail first few attempts then succeed
      let attemptCount = 0;
      (medplumService.createResource as jest.Mock).mockImplementation((resource) => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary server error');
        }
        return Promise.resolve({ ...resource, id: `${resource.resourceType}-success` });
      });

      // First attempt - should fail and create resume token
      let firstResult: SyncResponse;
      try {
        firstResult = await testSyncService.processSync(retryRequest, mockUserId);
      } catch (error) {
        // Expected failure
      }

      // Reset attempt count for next call
      attemptCount = 2; // Set to succeed on next attempt

      // Resume - should succeed
      const resumeRequest: SyncRequest = {
        operations: [],
        clientId: mockClientId,
        resumeToken: firstResult!.resumeToken
      };

      const resumeResult = await testSyncService.processSync(resumeRequest, mockUserId);

      expect(resumeResult.success).toBe(true);
      expect(resumeResult.operations[0].success).toBe(true);
    });
  });

  describe('Session Timeout and Cleanup', () => {
    it('should handle expired resume tokens gracefully', async () => {
      const expiredTokenRequest: SyncRequest = {
        operations: [
          {
            id: 'expired-token-test',
            resourceType: 'Patient',
            resourceId: 'patient-expired',
            operation: 'create',
            resource: {
              resourceType: 'Patient',
              name: [{ given: ['Expired'], family: 'Token' }]
            },
            timestamp: new Date().toISOString()
          }
        ],
        clientId: mockClientId,
        resumeToken: 'expired-token-from-old-session'
      };

      // Should handle expired token and start new session
      const result = await testSyncService.processSync(expiredTokenRequest, mockUserId);

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].success).toBe(true);
      // Should generate new resume token since old one was expired
      expect(result.resumeToken).toBeDefined();
    });

    it('should cleanup old sessions and checkpoints', async () => {
      // Create multiple old sessions
      const oldSessions = Array.from({ length: 5 }, (_, i) => ({
        operations: [{
          id: `old-session-${i}`,
          resourceType: 'Patient',
          resourceId: `patient-old-${i}`,
          operation: 'create',
          resource: {
            resourceType: 'Patient',
            name: [{ given: ['Old'], family: `${i}` }]
          },
          timestamp: new Date().toISOString()
        }],
        clientId: `old-client-${i}`
      }));

      // Process each old session
      const resumeTokens: string[] = [];
      for (const sessionRequest of oldSessions) {
        const result = await testSyncService.processSync(sessionRequest, mockUserId);
        if (result.resumeToken) {
          resumeTokens.push(result.resumeToken);
        }
      }

      // Simulate time passing (beyond session timeout)
      jest.useFakeTimers();
      jest.advanceTimersByTime(35 * 60 * 1000); // 35 minutes

      // Create new session - should trigger cleanup
      const newSessionRequest: SyncRequest = {
        operations: [{
          id: 'cleanup-trigger',
          resourceType: 'Patient',
          resourceId: 'patient-new',
          operation: 'create',
          resource: {
            resourceType: 'Patient',
            name: [{ given: ['New'], family: 'Session' }]
          },
          timestamp: new Date().toISOString()
        }],
        clientId: 'new-client'
      };

      const result = await testSyncService.processSync(newSessionRequest, mockUserId);
      expect(result.success).toBe(true);

      // Try to resume old sessions - should fail gracefully
      for (const token of resumeTokens) {
        const expiredResumeRequest: SyncRequest = {
          operations: [],
          clientId: 'old-client-0',
          resumeToken: token
        };

        const expiredResult = await testSyncService.processSync(expiredResumeRequest, mockUserId);
        // Should handle gracefully, possibly starting new session
        expect(expiredResult.success).toBe(true);
      }

      jest.useRealTimers();
    });
  });

  describe('Performance During Resume', () => {
    it('should maintain performance with large resume operations', async () => {
      const largeResumeRequest: SyncRequest = {
        operations: Array.from({ length: 1000 }, (_, i) => ({
          id: `perf-${i}`,
          resourceType: 'Observation',
          resourceId: `obs-perf-${i}`,
          operation: 'create',
          resource: {
            resourceType: 'Observation',
            status: 'final',
            code: { text: `Performance Test ${i}` }
          },
          timestamp: new Date().toISOString()
        })),
        clientId: mockClientId,
        batchSize: 50
      };

      const startTime = performance.now();
      
      // Process large sync with potential interruptions
      let result: SyncResponse;
      let attempts = 0;
      
      do {
        attempts++;
        try {
          const currentRequest = attempts === 1 ? largeResumeRequest : {
            operations: [],
            clientId: mockClientId,
            resumeToken: result!.resumeToken,
            batchSize: 50
          };
          
          result = await testSyncService.processSync(currentRequest, mockUserId);
          
          // Simulate occasional interruptions
          if (attempts < 3 && Math.random() > 0.7) {
            throw new Error('Simulated interruption');
          }
        } catch (error) {
          // Continue with resume on next iteration
          continue;
        }
      } while (result.hasMore && attempts < 10);

      const totalTime = performance.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.completedOperations).toBe(1000);
      expect(totalTime).toBeLessThan(30000); // Should complete in under 30 seconds
      expect(attempts).toBeLessThan(10); // Should not require too many attempts
    });

    it('should handle concurrent resume requests efficiently', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) => ({
        operations: Array.from({ length: 20 }, (_, j) => ({
          id: `concurrent-${i}-${j}`,
          resourceType: 'Patient',
          resourceId: `patient-concurrent-${i}-${j}`,
          operation: 'create',
          resource: {
            resourceType: 'Patient',
            name: [{ given: ['Concurrent'], family: `${i}-${j}` }]
          },
          timestamp: new Date().toISOString()
        })),
        clientId: `concurrent-client-${i}`
      }));

      const startTime = performance.now();
      
      // Process all requests concurrently
      const results = await Promise.all(
        concurrentRequests.map(request => 
          testSyncService.processSync(request, `user-${Math.floor(Math.random() * 3)}`)
        )
      );

      const totalTime = performance.now() - startTime;
      
      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.completedOperations).toBe(20);
      });
      
      // Should handle concurrency efficiently
      expect(totalTime).toBeLessThan(10000); // Under 10 seconds for 100 operations across 5 clients
    });
  });
});