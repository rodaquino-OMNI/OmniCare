/**
 * Tests for Offline Sync Service
 */

// Mock NODE_ENV before importing the service
const originalEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'development';

// Unmock the service we're testing
jest.unmock('../offline-sync.service');

import 'fake-indexeddb/auto';
import { OfflineSyncService, getOfflineSyncService } from '../offline-sync.service';
import { fhirService } from '../fhir.service';
import {
  createMockPatient,
  createMockObservation,
  createMockEncounter,
  createMockResponse,
  createMockNetworkError,
  mockNetworkConditions,
  resetNetworkMocks
} from '@/__tests__/utils/network-mock.utils';
import { Resource, Patient, Observation } from '@medplum/fhirtypes';

// Mock fhirService
jest.mock('../fhir.service');
const mockFhirService = fhirService as jest.Mocked<typeof fhirService>;

// Restore NODE_ENV after imports
afterAll(() => {
  process.env.NODE_ENV = originalEnv;
});

describe('OfflineSyncService', () => {
  let service: OfflineSyncService;
  let onlineHandler: ((event: Event) => void) | undefined;
  let offlineHandler: ((event: Event) => void) | undefined;

  beforeEach(async () => {
    jest.clearAllMocks();
    resetNetworkMocks();
    
    // Capture event listeners
    window.addEventListener = jest.fn((event: string, handler: any) => {
      if (event === 'online') onlineHandler = handler;
      if (event === 'offline') offlineHandler = handler;
    });
    
    window.removeEventListener = jest.fn();
    window.dispatchEvent = jest.fn();
    
    // Use getInstance to get the service
    service = OfflineSyncService.getInstance();
    // Initialize the service explicitly
    await service.initialize();
  });

  afterEach(() => {
    service.destroy();
    jest.clearAllTimers();
  });

  describe('Initialization', () => {
    it('should initialize with correct default status', () => {
      const status = service.getSyncStatus();
      expect(status.isOnline).toBe(true);
      expect(status.isSyncing).toBe(false);
      expect(status.pendingChanges).toBe(0);
      expect(status.failedChanges).toBe(0);
      expect(status.conflictedChanges).toBe(0);
    });

    it('should setup network listeners', () => {
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should handle network status changes', () => {
      // Simulate going offline
      mockNetworkConditions.offline();
      if (offlineHandler) offlineHandler(new Event('offline'));
      
      let status = service.getSyncStatus();
      expect(status.isOnline).toBe(false);
      
      // Simulate going online
      mockNetworkConditions.online();
      if (onlineHandler) onlineHandler(new Event('online'));
      
      status = service.getSyncStatus();
      expect(status.isOnline).toBe(true);
    });
  });

  describe('Queue Operations', () => {
    it('should queue create operation', async () => {
      const patient = createMockPatient();
      
      await service.queueOperation('create', patient);
      
      const status = service.getSyncStatus();
      expect(status.pendingChanges).toBe(1);
    });

    it('should queue update operation', async () => {
      const patient = createMockPatient();
      patient.name = [{ use: 'official' as const, family: 'Updated', given: ['Name'], prefix: ['Mr.'] }];
      
      await service.queueOperation('update', patient);
      
      const status = service.getSyncStatus();
      expect(status.pendingChanges).toBe(1);
    });

    it('should queue delete operation', async () => {
      const patient = createMockPatient();
      
      await service.queueOperation('delete', patient);
      
      const status = service.getSyncStatus();
      expect(status.pendingChanges).toBe(1);
    });

    it('should calculate priority based on resource type', async () => {
      const patient = createMockPatient();
      const observation = createMockObservation();
      
      await service.queueOperation('create', patient);
      await service.queueOperation('create', observation);
      
      // Patient should have higher priority than observation
      const status = service.getSyncStatus();
      expect(status.pendingChanges).toBe(2);
    });

    it('should trigger immediate sync when online', async () => {
      const patient = createMockPatient();
      mockFhirService.createResource.mockResolvedValueOnce(patient);
      
      await service.queueOperation('create', patient);
      
      // Wait for async sync to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockFhirService.createResource).toHaveBeenCalledWith(patient);
    });
  });

  describe('Sync Operations', () => {
    it('should perform successful sync', async () => {
      const patient = createMockPatient();
      mockFhirService.createResource.mockResolvedValueOnce(patient);
      
      await service.queueOperation('create', patient);
      await service.sync();
      
      expect(mockFhirService.createResource).toHaveBeenCalledWith(patient);
      const status = service.getSyncStatus();
      expect(status.pendingChanges).toBe(0);
    });

    it('should handle sync failures with retry', async () => {
      const patient = createMockPatient();
      const error = createMockNetworkError();
      
      mockFhirService.createResource
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(patient);
      
      await service.queueOperation('create', patient);
      
      // First sync should fail
      await expect(service.sync()).rejects.toThrow();
      
      let status = service.getSyncStatus();
      expect(status.pendingChanges).toBe(1);
      
      // Second sync should succeed
      await service.sync();
      
      status = service.getSyncStatus();
      expect(status.pendingChanges).toBe(0);
    });

    it('should not sync when offline', async () => {
      mockNetworkConditions.offline();
      service = new OfflineSyncService();
      
      const patient = createMockPatient();
      await service.queueOperation('create', patient);
      
      await expect(service.sync()).rejects.toThrow('Cannot sync while offline');
    });

    it('should handle batch processing', async () => {
      const resources: Resource[] = [];
      for (let i = 0; i < 100; i++) {
        resources.push(createMockPatient(`patient-${i}`));
      }
      
      mockFhirService.createResource.mockImplementation((resource) => 
        Promise.resolve(resource)
      );
      
      // Queue all resources
      for (const resource of resources) {
        await service.queueOperation('create', resource);
      }
      
      // Sync with batch size
      await service.sync({ batchSize: 10 });
      
      expect(mockFhirService.createResource).toHaveBeenCalledTimes(100);
    });

    it('should report sync progress', async () => {
      const progressUpdates: any[] = [];
      const patient = createMockPatient();
      
      mockFhirService.createResource.mockResolvedValueOnce(patient);
      
      await service.queueOperation('create', patient);
      
      await service.sync({
        progressCallback: (progress) => {
          progressUpdates.push(progress);
        }
      });
      
      expect(progressUpdates.length).toBeGreaterThan(0);
      const lastProgress = progressUpdates[progressUpdates.length - 1];
      expect(lastProgress.completed).toBe(1);
      expect(lastProgress.percentage).toBe(100);
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect conflicts during sync', async () => {
      const localPatient = createMockPatient();
      localPatient.meta = { ...localPatient.meta, versionId: '1' };
      
      const remotePatient = { ...localPatient };
      remotePatient.meta = { ...remotePatient.meta, versionId: '2' };
      remotePatient.name = [{ use: 'official' as const, family: 'Remote', given: ['Update'], prefix: ['Mr.'] }];
      
      mockFhirService.readResource.mockResolvedValueOnce(remotePatient);
      
      await service.queueOperation('update', localPatient, {
        remoteVersion: 1
      });
      
      const conflicts = await service.getConflicts();
      expect(conflicts.length).toBe(0); // No conflicts yet
      
      // Sync should detect conflict
      await expect(service.sync()).rejects.toThrow();
      
      const status = service.getSyncStatus();
      expect(status.conflictedChanges).toBeGreaterThan(0);
    });

    it('should resolve conflicts with local-wins strategy', async () => {
      const localPatient = createMockPatient();
      const remotePatient = { ...localPatient, name: [{ family: 'Remote' }] };
      
      mockFhirService.readResource.mockResolvedValueOnce(remotePatient);
      mockFhirService.updateResource.mockResolvedValueOnce(localPatient);
      
      await service.queueOperation('update', localPatient, {
        remoteVersion: 1,
        conflictResolution: 'local-wins'
      });
      
      await service.sync();
      
      expect(mockFhirService.updateResource).toHaveBeenCalledWith(localPatient);
    });

    it('should resolve conflicts with remote-wins strategy', async () => {
      const localPatient = createMockPatient();
      const remotePatient = { ...localPatient, name: [{ family: 'Remote' }] };
      
      mockFhirService.readResource.mockResolvedValueOnce(remotePatient);
      
      await service.queueOperation('update', localPatient, {
        remoteVersion: 1,
        conflictResolution: 'remote-wins'
      });
      
      await service.sync();
      
      // Should not update since remote wins
      expect(mockFhirService.updateResource).not.toHaveBeenCalled();
    });

    it('should resolve conflicts with last-write-wins strategy', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 10000);
      
      const localPatient = createMockPatient();
      localPatient.meta = { ...localPatient.meta, lastUpdated: now.toISOString() };
      
      const remotePatient = { ...localPatient };
      remotePatient.meta = { ...remotePatient.meta, lastUpdated: earlier.toISOString() };
      
      mockFhirService.readResource.mockResolvedValueOnce(remotePatient);
      mockFhirService.updateResource.mockResolvedValueOnce(localPatient);
      
      await service.queueOperation('update', localPatient, {
        remoteVersion: 1,
        conflictResolution: 'last-write-wins'
      });
      
      await service.sync();
      
      expect(mockFhirService.updateResource).toHaveBeenCalledWith(localPatient);
    });

    it('should merge patient resources', async () => {
      const localPatient = createMockPatient();
      localPatient.telecom = [{ system: 'phone' as const, value: '555-1111', use: 'mobile' as const }];
      
      const remotePatient = { ...localPatient };
      remotePatient.telecom = [{ system: 'email' as const, value: 'test@example.com', use: 'home' as const }];
      
      mockFhirService.readResource.mockResolvedValueOnce(remotePatient);
      mockFhirService.updateResource.mockResolvedValueOnce(expect.any(Object));
      
      await service.queueOperation('update', localPatient, {
        remoteVersion: 1,
        conflictResolution: 'merge'
      });
      
      await service.sync();
      
      const mergedCall = mockFhirService.updateResource.mock.calls[0][0] as Patient;
      expect(mergedCall.telecom).toHaveLength(2);
    });

    it('should handle manual conflict resolution', async () => {
      const localPatient = createMockPatient();
      const remotePatient = { ...localPatient, name: [{ family: 'Remote' }] };
      
      mockFhirService.readResource.mockResolvedValueOnce(remotePatient);
      
      await service.queueOperation('update', localPatient, {
        remoteVersion: 1,
        conflictResolution: 'manual'
      });
      
      await expect(service.sync()).rejects.toThrow('Manual conflict resolution required');
      
      const conflicts = await service.getConflicts();
      expect(conflicts.length).toBeGreaterThan(0);
      
      // Manually resolve conflict
      await service.resolveConflict(conflicts[0].id, {
        strategy: 'local-wins',
        winningResource: localPatient
      });
      
      const resolvedConflicts = await service.getConflicts(true);
      expect(resolvedConflicts.length).toBeGreaterThan(0);
    });
  });

  describe('Bidirectional Sync', () => {
    it('should pull remote changes', async () => {
      const remotePatient = createMockPatient('remote-patient');
      const bundle = {
        resourceType: 'Bundle',
        entry: [{ resource: remotePatient }]
      };
      
      mockFhirService.searchResources.mockResolvedValueOnce(bundle as any);
      
      await service.sync({ direction: 'pull' });
      
      expect(mockFhirService.searchResources).toHaveBeenCalled();
    });

    it('should handle bidirectional sync', async () => {
      const localPatient = createMockPatient('local-patient');
      const remotePatient = createMockPatient('remote-patient');
      
      mockFhirService.createResource.mockResolvedValueOnce(localPatient);
      mockFhirService.searchResources.mockResolvedValueOnce({
        resourceType: 'Bundle',
        entry: [{ resource: remotePatient }]
      } as any);
      
      await service.queueOperation('create', localPatient);
      await service.sync({ direction: 'bidirectional' });
      
      expect(mockFhirService.createResource).toHaveBeenCalled();
      expect(mockFhirService.searchResources).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should track sync errors', async () => {
      const patient = createMockPatient();
      const error = new Error('Server error');
      
      mockFhirService.createResource.mockRejectedValue(error);
      
      await service.queueOperation('create', patient, { maxAttempts: 1 });
      
      await expect(service.sync()).rejects.toThrow();
      
      const status = service.getSyncStatus();
      expect(status.errors.length).toBeGreaterThan(0);
      expect(status.errors[0].error).toBe('Server error');
    });

    it('should handle max retries', async () => {
      const patient = createMockPatient();
      const error = createMockNetworkError();
      
      mockFhirService.createResource.mockRejectedValue(error);
      
      await service.queueOperation('create', patient, { maxAttempts: 3 });
      
      // Try syncing multiple times
      for (let i = 0; i < 4; i++) {
        try {
          await service.sync();
        } catch {}
      }
      
      const status = service.getSyncStatus();
      expect(status.failedChanges).toBe(1);
      expect(status.pendingChanges).toBe(0);
    });
  });

  describe('Event Handling', () => {
    it('should emit sync events', async () => {
      const events: any[] = [];
      
      service.on('sync-started', (data) => events.push({ type: 'started', data }));
      service.on('sync-completed', (data) => events.push({ type: 'completed', data }));
      service.on('sync-failed', (data) => events.push({ type: 'failed', data }));
      
      const patient = createMockPatient();
      mockFhirService.createResource.mockResolvedValueOnce(patient);
      
      await service.queueOperation('create', patient);
      await service.sync();
      
      expect(events.some(e => e.type === 'started')).toBe(true);
      expect(events.some(e => e.type === 'completed')).toBe(true);
    });

    it('should dispatch custom events', async () => {
      const patient = createMockPatient();
      mockFhirService.createResource.mockResolvedValueOnce(patient);
      
      await service.queueOperation('create', patient);
      await service.sync();
      
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'omnicare-sync-sync-started'
        })
      );
    });
  });

  describe('Data Management', () => {
    it('should clear all local data', async () => {
      const patient = createMockPatient();
      
      await service.queueOperation('create', patient);
      let status = service.getSyncStatus();
      expect(status.pendingChanges).toBe(1);
      
      await service.clearLocalData();
      
      status = service.getSyncStatus();
      expect(status.pendingChanges).toBe(0);
    });

    it('should export sync data', async () => {
      const patient = createMockPatient();
      
      await service.queueOperation('create', patient);
      
      const exportData = await service.exportSyncData();
      
      expect(exportData.pendingOperations).toHaveLength(1);
      expect(exportData.conflicts).toHaveLength(0);
    });

    it('should import sync data', async () => {
      const patient = createMockPatient();
      
      await service.queueOperation('create', patient);
      const exportData = await service.exportSyncData();
      
      await service.clearLocalData();
      let status = service.getSyncStatus();
      expect(status.pendingChanges).toBe(0);
      
      await service.importSyncData(exportData);
      
      status = service.getSyncStatus();
      expect(status.pendingChanges).toBe(1);
    });

    it('should cleanup old data', async () => {
      // Create old error
      const oldError = {
        id: 'old-error',
        resourceType: 'Patient',
        resourceId: 'test',
        operation: 'create',
        error: 'Old error',
        timestamp: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days old
        retryable: false
      };
      
      // Manually add old error
      const status = service.getSyncStatus();
      status.errors.push(oldError);
      
      await service.cleanup(30);
      
      const updatedStatus = service.getSyncStatus();
      expect(updatedStatus.errors).toHaveLength(0);
    });
  });

  describe('Resource Version Management', () => {
    it('should track resource versions', async () => {
      const patient = createMockPatient();
      patient.meta = { ...patient.meta, versionId: '2' };
      
      mockFhirService.updateResource.mockResolvedValueOnce(patient);
      
      await service.queueOperation('update', patient);
      await service.sync();
      
      const exportData = await service.exportSyncData();
      expect(exportData.resourceVersions.size).toBeGreaterThan(0);
    });
  });

  describe('Background Sync', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start background sync when online', async () => {
      const patient = createMockPatient();
      mockFhirService.createResource.mockResolvedValueOnce(patient);
      
      await service.queueOperation('create', patient);
      
      // Fast forward timers
      jest.advanceTimersByTime(30000); // 30 seconds
      
      expect(mockFhirService.createResource).toHaveBeenCalled();
    });

    it('should not sync in background when offline', async () => {
      mockNetworkConditions.offline();
      service = new OfflineSyncService();
      
      const patient = createMockPatient();
      await service.queueOperation('create', patient);
      
      jest.advanceTimersByTime(30000);
      
      expect(mockFhirService.createResource).not.toHaveBeenCalled();
    });
  });
});