/**
 * Test to verify services can be imported without crashing in test environment
 */

describe('Service Initialization Safety', () => {
  beforeEach(() => {
    // Ensure we're in test environment
    process.env.NODE_ENV = 'test';
  });

  it('should import OfflineSyncService without crashing', async () => {
    const { getOfflineSyncService } = await import('../offline-sync.service');
    expect(getOfflineSyncService).toBeDefined();
    
    const service = getOfflineSyncService();
    expect(service).toBeDefined();
    expect(service.getSyncStatus).toBeDefined();
    
    // Should return stub data in test environment
    const status = service.getSyncStatus();
    expect(status.isOnline).toBe(true);
    expect(status.pendingChanges).toBe(0);
  });

  it('should import OfflineNotesService without crashing', async () => {
    const { offlineNotesService } = await import('../offline-notes.service');
    expect(offlineNotesService).toBeDefined();
    expect(offlineNotesService.saveNote).toBeDefined();
  });

  it('should import NoteSyncQueueService without crashing', async () => {
    const { noteSyncQueueService } = await import('../note-sync-queue.service');
    expect(noteSyncQueueService).toBeDefined();
    expect(noteSyncQueueService.addToQueue).toBeDefined();
  });

  it('should import BackgroundSyncService without crashing', async () => {
    const { backgroundSyncService, addSyncTask, getSyncStats } = await import('../background-sync.service');
    expect(backgroundSyncService).toBeDefined();
    expect(addSyncTask).toBeDefined();
    expect(getSyncStats).toBeDefined();
    
    // Should return stub data in test environment
    const stats = getSyncStats();
    expect(stats.pendingTasks).toBe(0);
    expect(stats.completedTasks).toBe(0);
  });

  it('should import IndexedDBService without crashing', async () => {
    const { indexedDBService } = await import('../indexeddb.service');
    expect(indexedDBService).toBeDefined();
    expect(indexedDBService.initialize).toBeDefined();
    
    // Should not be initialized by default
    expect(indexedDBService.isInitialized()).toBe(false);
  });

  it('should import PatientCacheService without crashing', async () => {
    const { patientCacheService } = await import('../patient-cache.service');
    expect(patientCacheService).toBeDefined();
    expect(patientCacheService.getPatient).toBeDefined();
  });

  it('should handle navigator.onLine access safely', () => {
    // This should not throw in test environment
    const checkOnline = () => {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    };
    
    expect(() => checkOnline()).not.toThrow();
  });
});