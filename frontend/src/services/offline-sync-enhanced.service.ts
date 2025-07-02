/**
 * Enhanced Offline Sync Service for Clinical Workflows
 * Extends base sync service with clinical-specific synchronization patterns
 */

import { Resource } from '@medplum/fhirtypes';
import { OfflineSyncService, SyncOptions, SyncQueueItem, SyncConflict } from './offline-sync.service';
import { clinicalIndexedDBService } from './indexeddb.clinical.service';
import { indexedDBService } from './indexeddb.service';
import { encryptionService } from './encryption.service';
import {
  ClinicalNoteOfflineData,
  AppointmentOfflineData,
  OfflineAttachment,
  ClinicalWorkflowQueue,
  VoiceRecording
} from './indexeddb.clinical-schemas';
import { getErrorMessage } from '@/utils/error.utils';

// Enhanced sync types for clinical workflows
export interface ClinicalSyncOptions extends SyncOptions {
  // Clinical-specific options
  syncPatientData?: boolean;
  syncClinicalNotes?: boolean;
  syncAttachments?: boolean;
  syncVoiceRecordings?: boolean;
  prioritizeActivePatient?: boolean;
  
  // Patient context
  activePatientId?: string;
  currentEncounterId?: string;
  
  // Clinical workflow priorities
  urgentWorkflows?: string[];
  
  // Attachment handling
  maxAttachmentSize?: number;
  compressAttachments?: boolean;
  
  // Voice recording options
  transcribeOffline?: boolean;
  compressVoice?: boolean;
}

export interface ClinicalSyncStatus {
  // Base sync status
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt?: Date;
  
  // Clinical-specific status
  clinicalNotesSynced: number;
  attachmentsSynced: number;
  voiceRecordingsSynced: number;
  workflowItemsSynced: number;
  
  // Patient context
  activePatientId?: string;
  patientDataCacheStatus: 'cold' | 'warming' | 'warm' | 'stale';
  
  // Sync progress
  clinicalSyncProgress?: {
    notes: { pending: number; synced: number; failed: number };
    attachments: { pending: number; synced: number; failed: number };
    workflows: { pending: number; synced: number; failed: number };
  };
  
  // Performance metrics
  averageNoteSync: number;
  averageAttachmentSync: number;
  offlineTimeSpent: number;
}

export interface ClinicalConflictData {
  // Standard conflict data
  conflictType: 'note' | 'attachment' | 'workflow' | 'patient' | 'fhir';
  
  // Clinical-specific conflict metadata
  clinicalImportance: 'low' | 'medium' | 'high' | 'critical';
  patientSafety: boolean;
  
  // Note-specific conflict data
  noteMetadata?: {
    practitionerId: string;
    noteType: string;
    status: string;
    lastEditedBy: string;
    lastEditedAt: Date;
  };
  
  // Workflow context
  workflowContext?: {
    workflowType: string;
    urgency: 'routine' | 'urgent' | 'stat';
    blocksOtherOperations: boolean;
  };
}

/**
 * Enhanced Clinical Offline Sync Service
 * Provides clinical workflow-optimized synchronization
 */
export class ClinicalOfflineSyncService extends OfflineSyncService {
  private static clinicalInstance: ClinicalOfflineSyncService;
  private clinicalStatus: ClinicalSyncStatus;
  private serviceWorkerRegistration?: ServiceWorkerRegistration;
  private backgroundSyncSupported = false;
  private activeClinicalSync?: Promise<void>;

  constructor() {
    super();
    
    this.clinicalStatus = {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: false,
      clinicalNotesSynced: 0,
      attachmentsSynced: 0,
      voiceRecordingsSynced: 0,
      workflowItemsSynced: 0,
      patientDataCacheStatus: 'cold',
      averageNoteSync: 0,
      averageAttachmentSync: 0,
      offlineTimeSpent: 0
    };
  }

  /**
   * Get enhanced clinical sync service instance
   */
  static getClinicalInstance(): ClinicalOfflineSyncService {
    if (typeof window === 'undefined' || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
      // Return stub for SSR/tests
      return {
        getClinicalSyncStatus: () => ({
          isOnline: true,
          isSyncing: false,
          clinicalNotesSynced: 0,
          attachmentsSynced: 0,
          voiceRecordingsSynced: 0,
          workflowItemsSynced: 0,
          patientDataCacheStatus: 'cold',
          averageNoteSync: 0,
          averageAttachmentSync: 0,
          offlineTimeSpent: 0
        }),
        syncClinicalData: () => Promise.resolve(),
        syncPatientData: () => Promise.resolve(),
        syncClinicalNotes: () => Promise.resolve(),
        syncAttachments: () => Promise.resolve(),
        syncVoiceRecordings: () => Promise.resolve(),
        syncWorkflowQueue: () => Promise.resolve(),
        queueClinicalNote: () => Promise.resolve(),
        queueAttachment: () => Promise.resolve(),
        queueWorkflowItem: () => Promise.resolve(),
        setActivePatient: () => Promise.resolve(),
        preloadPatientData: () => Promise.resolve(),
        handleClinicalConflict: () => Promise.resolve(),
        getClinicalConflicts: () => Promise.resolve([]),
        enableBackgroundSync: () => Promise.resolve(),
        disableBackgroundSync: () => Promise.resolve()
      } as any;
    }

    if (!ClinicalOfflineSyncService.clinicalInstance) {
      ClinicalOfflineSyncService.clinicalInstance = new ClinicalOfflineSyncService();
    }
    return ClinicalOfflineSyncService.clinicalInstance;
  }

  /**
   * Initialize clinical sync with service worker integration
   */
  async initializeClinical(): Promise<void> {
    // Initialize base sync service
    await this.initialize();
    
    // Setup service worker integration
    await this.setupServiceWorkerIntegration();
    
    // Initialize clinical sync metrics
    await this.initializeClinicalMetrics();
    
    console.log('Clinical offline sync service initialized');
  }

  /**
   * Setup service worker integration for background sync
   */
  private async setupServiceWorkerIntegration(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
        
        // Check for background sync support
        this.backgroundSyncSupported = 'sync' in window.ServiceWorkerRegistration.prototype;
        
        // Listen for sync events from service worker
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
        
        // Register clinical sync tags
        if (this.backgroundSyncSupported) {
          await this.registerClinicalSyncTags();
        }
        
      } catch (error) {
        console.warn('Service worker integration failed:', error);
      }
    }
  }

  /**
   * Register clinical-specific sync tags with service worker
   */
  private async registerClinicalSyncTags(): Promise<void> {
    const tags = [
      'clinical-notes-sync',
      'attachments-sync',
      'voice-recordings-sync',
      'workflow-queue-sync',
      'urgent-clinical-sync'
    ];

    for (const tag of tags) {
      try {
        if (this.serviceWorkerRegistration?.sync) {
          await this.serviceWorkerRegistration.sync.register(tag);
        }
      } catch (error) {
        console.warn(`Failed to register sync tag ${tag}:`, error);
      }
    }
  }

  /**
   * Handle messages from service worker
   */
  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, data } = event.data;
    
    switch (type) {
      case 'clinical-sync-completed':
        this.updateClinicalMetrics(data);
        break;
      case 'clinical-sync-failed':
        this.handleClinicalSyncFailure(data);
        break;
      case 'offline-access':
        this.trackOfflineAccess(data);
        break;
      case 'attachment-sync-progress':
        this.updateAttachmentProgress(data);
        break;
    }
  }

  // ===============================
  // CLINICAL DATA SYNCHRONIZATION
  // ===============================

  /**
   * Perform comprehensive clinical data synchronization
   */
  async syncClinicalData(options: ClinicalSyncOptions = {}): Promise<void> {
    if (this.activeClinicalSync) {
      console.log('Clinical sync already in progress');
      return this.activeClinicalSync;
    }

    this.activeClinicalSync = this.performClinicalSync(options);
    
    try {
      await this.activeClinicalSync;
    } finally {
      this.activeClinicalSync = undefined;
    }
  }

  /**
   * Perform clinical synchronization
   */
  private async performClinicalSync(options: ClinicalSyncOptions): Promise<void> {
    console.log('Starting clinical data sync...');
    this.clinicalStatus.isSyncing = true;
    
    const startTime = Date.now();
    
    try {
      // Prioritize active patient data if specified
      if (options.prioritizeActivePatient && options.activePatientId) {
        await this.syncPatientData(options.activePatientId, options);
      }
      
      // Sync clinical workflows first (highest priority)
      if (options.urgentWorkflows?.length) {
        await this.syncUrgentWorkflows(options.urgentWorkflows, options);
      }
      
      // Sync clinical notes
      if (options.syncClinicalNotes !== false) {
        await this.syncClinicalNotes(options);
      }
      
      // Sync attachments (bandwidth-dependent)
      if (options.syncAttachments !== false) {
        await this.syncAttachments(options);
      }
      
      // Sync voice recordings (large data)
      if (options.syncVoiceRecordings !== false) {
        await this.syncVoiceRecordings(options);
      }
      
      // Sync workflow queue
      await this.syncWorkflowQueue(options);
      
      // Sync base FHIR resources
      await super.sync(options);
      
      // Update clinical metrics
      this.clinicalStatus.lastSyncAt = new Date();
      
      console.log(`Clinical sync completed in ${Date.now() - startTime}ms`);
      
    } catch (error) {
      console.error('Clinical sync failed:', error);
      throw error;
    } finally {
      this.clinicalStatus.isSyncing = false;
    }
  }

  /**
   * Sync patient-specific data
   */
  async syncPatientData(patientId: string, options: ClinicalSyncOptions = {}): Promise<void> {
    try {
      console.log(`Syncing data for patient ${patientId}`);
      
      // Notify service worker about active patient
      await this.notifyServiceWorker('SET_ACTIVE_PATIENT', { patientId });
      
      // Preload patient data in service worker cache
      await this.notifyServiceWorker('PRELOAD_PATIENT', { patientId });
      
      // Sync patient's clinical notes
      const patientNotes = await clinicalIndexedDBService.searchClinicalNotes({
        patientId,
        limit: 50
      });
      
      for (const note of patientNotes.notes) {
        if (note.offlineModified || note.offlineCreated) {
          await this.queueClinicalNote(note, 'high');
        }
      }
      
      // Update cache status
      this.clinicalStatus.activePatientId = patientId;
      this.clinicalStatus.patientDataCacheStatus = 'warm';
      
    } catch (error) {
      console.error(`Failed to sync patient ${patientId} data:`, error);
      this.clinicalStatus.patientDataCacheStatus = 'stale';
    }
  }

  /**
   * Sync clinical notes
   */
  async syncClinicalNotes(options: ClinicalSyncOptions = {}): Promise<void> {
    try {
      console.log('Syncing clinical notes...');
      
      const pendingNotes = await this.getPendingClinicalNotes();
      
      for (const note of pendingNotes) {
        try {
          await this.syncClinicalNote(note, options);
          this.clinicalStatus.clinicalNotesSynced++;
        } catch (error) {
          console.error(`Failed to sync note ${note.noteId}:`, error);
          await this.handleClinicalNoteSyncFailure(note, error);
        }
      }
      
    } catch (error) {
      console.error('Clinical notes sync failed:', error);
    }
  }

  /**
   * Sync individual clinical note
   */
  private async syncClinicalNote(note: ClinicalNoteOfflineData, options: ClinicalSyncOptions): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Convert to FHIR DocumentReference for sync
      const documentReference = this.convertNoteToFHIR(note);
      
      if (note.offlineCreated) {
        await this.queueOperation('create', documentReference, {
          priority: this.calculateNotePriority(note),
          metadata: {
            clinicalNoteId: note.noteId,
            offlineCreated: true
          }
        });
      } else if (note.offlineModified) {
        await this.queueOperation('update', documentReference, {
          priority: this.calculateNotePriority(note),
          metadata: {
            clinicalNoteId: note.noteId,
            offlineModified: true
          }
        });
      }
      
      // Update note sync status
      await clinicalIndexedDBService.updateClinicalNote(note.noteId, {
        offlineCreated: false,
        offlineModified: false
      });
      
      // Track performance
      const syncTime = Date.now() - startTime;
      this.updateNoteSyncMetrics(syncTime);
      
    } catch (error) {
      console.error(`Failed to sync clinical note ${note.noteId}:`, error);
      throw error;
    }
  }

  /**
   * Sync attachments with progressive loading
   */
  async syncAttachments(options: ClinicalSyncOptions = {}): Promise<void> {
    try {
      console.log('Syncing attachments...');
      
      const pendingAttachments = await this.getPendingAttachments();
      const maxSize = options.maxAttachmentSize || 10 * 1024 * 1024; // 10MB default
      
      for (const attachment of pendingAttachments) {
        try {
          // Skip large attachments if specified
          if (attachment.size > maxSize) {
            console.log(`Skipping large attachment ${attachment.id} (${attachment.size} bytes)`);
            continue;
          }
          
          await this.syncAttachment(attachment, options);
          this.clinicalStatus.attachmentsSynced++;
          
        } catch (error) {
          console.error(`Failed to sync attachment ${attachment.id}:`, error);
        }
      }
      
    } catch (error) {
      console.error('Attachment sync failed:', error);
    }
  }

  /**
   * Sync individual attachment
   */
  private async syncAttachment(attachment: OfflineAttachment, options: ClinicalSyncOptions): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Compress attachment data if requested
      let attachmentData = attachment.data;
      if (options.compressAttachments && attachment.category === 'image') {
        attachmentData = await this.compressImageData(attachmentData);
      }
      
      // Upload via API
      const uploadResult = await this.uploadAttachment(attachment, attachmentData);
      
      // Update attachment with remote URL
      await this.updateAttachmentSync(attachment.id, {
        uploadStatus: 'uploaded',
        remoteUrl: uploadResult.url,
        uploadedAt: Date.now()
      });
      
      // Track performance
      const syncTime = Date.now() - startTime;
      this.updateAttachmentSyncMetrics(syncTime);
      
    } catch (error) {
      await this.updateAttachmentSync(attachment.id, {
        uploadStatus: 'failed',
        uploadError: getErrorMessage(error)
      });
      throw error;
    }
  }

  /**
   * Sync voice recordings with transcription
   */
  async syncVoiceRecordings(options: ClinicalSyncOptions = {}): Promise<void> {
    try {
      console.log('Syncing voice recordings...');
      
      const pendingRecordings = await this.getPendingVoiceRecordings();
      
      for (const recording of pendingRecordings) {
        try {
          await this.syncVoiceRecording(recording, options);
          this.clinicalStatus.voiceRecordingsSynced++;
        } catch (error) {
          console.error(`Failed to sync voice recording ${recording.id}:`, error);
        }
      }
      
    } catch (error) {
      console.error('Voice recordings sync failed:', error);
    }
  }

  /**
   * Sync clinical workflow queue
   */
  async syncWorkflowQueue(options: ClinicalSyncOptions = {}): Promise<void> {
    try {
      console.log('Syncing workflow queue...');
      
      const pendingWorkflows = await clinicalIndexedDBService.getPendingWorkflows();
      
      // Sort by priority and execute
      const sortedWorkflows = pendingWorkflows.sort((a, b) => {
        const priorityOrder = { stat: 3, urgent: 2, routine: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
      for (const workflow of sortedWorkflows) {
        try {
          await this.syncWorkflowItem(workflow, options);
          this.clinicalStatus.workflowItemsSynced++;
        } catch (error) {
          console.error(`Failed to sync workflow ${workflow.id}:`, error);
        }
      }
      
    } catch (error) {
      console.error('Workflow queue sync failed:', error);
    }
  }

  // ===============================
  // QUEUE MANAGEMENT FOR CLINICAL DATA
  // ===============================

  /**
   * Queue clinical note for synchronization
   */
  async queueClinicalNote(note: ClinicalNoteOfflineData, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<void> {
    const documentReference = this.convertNoteToFHIR(note);
    
    const operation = note.offlineCreated ? 'create' : 'update';
    
    await this.queueOperation(operation, documentReference, {
      priority,
      metadata: {
        clinicalNoteId: note.noteId,
        noteType: note.noteType,
        patientId: note.patientId,
        practitionerId: note.practitionerId
      }
    });
  }

  /**
   * Queue attachment for upload
   */
  async queueAttachment(attachment: OfflineAttachment, priority: 'low' | 'medium' | 'high' | 'critical' = 'low'): Promise<void> {
    // Create a pseudo-resource for the attachment
    const attachmentResource = {
      resourceType: 'DocumentReference',
      id: attachment.id,
      status: 'current',
      subject: { reference: `Patient/${attachment.patientId}` },
      content: [{
        attachment: {
          contentType: attachment.mimeType,
          size: attachment.size,
          title: attachment.filename
        }
      }]
    } as Resource;

    await this.queueOperation('create', attachmentResource, {
      priority,
      metadata: {
        attachmentId: attachment.id,
        category: attachment.category,
        size: attachment.size
      }
    });
  }

  /**
   * Queue workflow item for execution
   */
  async queueWorkflowItem(workflow: ClinicalWorkflowQueue, priority?: 'low' | 'medium' | 'high' | 'critical'): Promise<void> {
    // Convert workflow to resource for queue
    const workflowResource = {
      resourceType: 'Task',
      id: workflow.id?.toString() || `workflow-${Date.now()}`,
      status: 'requested',
      intent: 'order',
      for: { reference: `Patient/${workflow.patientId}` },
      requester: { reference: `Practitioner/${workflow.practitionerId}` }
    } as Resource;

    await this.queueOperation('create', workflowResource, {
      priority: priority || this.mapWorkflowPriority(workflow.priority),
      metadata: {
        workflowType: workflow.workflowType,
        workflowId: workflow.id,
        workflowPriority: workflow.priority
      }
    });
  }

  // ===============================
  // CLINICAL CONFLICT RESOLUTION
  // ===============================

  /**
   * Handle clinical-specific conflicts
   */
  async handleClinicalConflict(
    conflict: SyncConflict,
    clinicalData: ClinicalConflictData,
    resolution: 'local' | 'remote' | 'merge' | 'manual'
  ): Promise<void> {
    // Add clinical importance to conflict resolution logic
    if (clinicalData.patientSafety && resolution === 'remote') {
      // For patient safety issues, prefer local if it's more recent
      const localResource = conflict.localResource;
      const remoteResource = conflict.remoteResource;
      
      const localTime = new Date(localResource.meta?.lastUpdated || 0);
      const remoteTime = new Date(remoteResource.meta?.lastUpdated || 0);
      
      if (localTime > remoteTime) {
        console.warn('Overriding remote resolution for patient safety');
        await this.resolveConflict(conflict.id, {
          strategy: 'local-wins',
          winningResource: localResource,
          reason: 'Patient safety override - local version preferred'
        });
        return;
      }
    }
    
    // Handle note-specific conflicts
    if (clinicalData.conflictType === 'note' && clinicalData.noteMetadata) {
      await this.resolveClinicalNoteConflict(conflict, clinicalData);
      return;
    }
    
    // Default conflict resolution
    await this.resolveConflict(conflict.id, {
      strategy: resolution === 'manual' ? 'manual' : resolution,
      winningResource: resolution === 'local' ? conflict.localResource : conflict.remoteResource,
      reason: `Clinical conflict resolved: ${resolution}`
    });
  }

  /**
   * Resolve clinical note specific conflicts
   */
  private async resolveClinicalNoteConflict(
    conflict: SyncConflict,
    clinicalData: ClinicalConflictData
  ): Promise<void> {
    const noteMetadata = clinicalData.noteMetadata!;
    
    // Check if the note is currently being edited
    if (noteMetadata.status === 'draft' || noteMetadata.status === 'in-progress') {
      // Prefer the version being actively edited
      await this.resolveConflict(conflict.id, {
        strategy: 'local-wins',
        winningResource: conflict.localResource,
        reason: 'Note is being actively edited'
      });
      return;
    }
    
    // For signed notes, prefer the signed version
    if (noteMetadata.status === 'signed') {
      await this.resolveConflict(conflict.id, {
        strategy: 'remote-wins',
        winningResource: conflict.remoteResource,
        reason: 'Remote note is signed'
      });
      return;
    }
    
    // Default to last writer wins
    const localTime = new Date(noteMetadata.lastEditedAt);
    const remoteTime = new Date(conflict.remoteResource.meta?.lastUpdated || 0);
    
    await this.resolveConflict(conflict.id, {
      strategy: 'last-write-wins',
      winningResource: localTime > remoteTime ? conflict.localResource : conflict.remoteResource,
      reason: 'Last writer wins for clinical note'
    });
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Convert clinical note to FHIR DocumentReference
   */
  private convertNoteToFHIR(note: ClinicalNoteOfflineData): Resource {
    return {
      resourceType: 'DocumentReference',
      id: note.noteId,
      status: 'current',
      type: {
        coding: [{
          system: 'http://loinc.org',
          code: this.getNoteTypeCode(note.noteType),
          display: note.noteType
        }]
      },
      subject: { reference: `Patient/${note.patientId}` },
      author: [{ reference: `Practitioner/${note.practitionerId}` }],
      content: [{
        attachment: {
          contentType: 'text/plain',
          data: btoa(note.content)
        }
      }],
      context: note.encounterId ? {
        encounter: [{ reference: `Encounter/${note.encounterId}` }]
      } : undefined,
      meta: {
        lastUpdated: new Date(note.updatedAt).toISOString(),
        versionId: note.localVersion.toString()
      }
    };
  }

  /**
   * Get LOINC code for note type
   */
  private getNoteTypeCode(noteType: string): string {
    const codes: Record<string, string> = {
      'progress': '11506-3',
      'consultation': '11488-4',
      'discharge': '18842-5',
      'nursing': '46209-3',
      'procedure': '28570-0'
    };
    return codes[noteType] || '11506-3';
  }

  /**
   * Calculate note sync priority based on clinical importance
   */
  private calculateNotePriority(note: ClinicalNoteOfflineData): 'low' | 'medium' | 'high' | 'critical' {
    if (note.priority === 'stat') return 'critical';
    if (note.priority === 'urgent') return 'high';
    if (note.status === 'signed') return 'high';
    if (note.noteType === 'discharge') return 'high';
    return 'medium';
  }

  /**
   * Map workflow priority to sync priority
   */
  private mapWorkflowPriority(workflowPriority: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (workflowPriority) {
      case 'stat': return 'critical';
      case 'urgent': return 'high';
      case 'routine': return 'medium';
      default: return 'low';
    }
  }

  /**
   * Notify service worker of clinical events
   */
  private async notifyServiceWorker(type: string, payload: any): Promise<void> {
    if (this.serviceWorkerRegistration?.active) {
      this.serviceWorkerRegistration.active.postMessage({ type, payload });
    }
  }

  /**
   * Enable background sync for clinical data
   */
  async enableBackgroundSync(): Promise<void> {
    if (this.backgroundSyncSupported && this.serviceWorkerRegistration?.sync) {
      try {
        await this.serviceWorkerRegistration.sync.register('clinical-background-sync');
        console.log('Clinical background sync enabled');
      } catch (error) {
        console.error('Failed to enable clinical background sync:', error);
      }
    }
  }

  /**
   * Disable background sync
   */
  async disableBackgroundSync(): Promise<void> {
    // Note: There's no standard way to unregister sync tags
    console.log('Background sync disabled (note: cannot unregister existing tags)');
  }

  // ===============================
  // STATUS AND METRICS
  // ===============================

  /**
   * Get clinical sync status
   */
  getClinicalSyncStatus(): ClinicalSyncStatus {
    return { ...this.clinicalStatus };
  }

  /**
   * Get clinical conflicts
   */
  async getClinicalConflicts(): Promise<Array<SyncConflict & { clinicalData?: ClinicalConflictData }>> {
    const conflicts = await this.getConflicts();
    
    // Enhance with clinical data
    return conflicts.map(conflict => ({
      ...conflict,
      clinicalData: this.extractClinicalConflictData(conflict)
    }));
  }

  /**
   * Set active patient for prioritized sync
   */
  async setActivePatient(patientId: string): Promise<void> {
    this.clinicalStatus.activePatientId = patientId;
    this.clinicalStatus.patientDataCacheStatus = 'warming';
    
    // Notify service worker
    await this.notifyServiceWorker('SET_ACTIVE_PATIENT', { patientId });
    
    // Preload patient data
    await this.preloadPatientData(patientId);
  }

  /**
   * Preload patient data for offline access
   */
  async preloadPatientData(patientId: string): Promise<void> {
    try {
      console.log(`Preloading data for patient ${patientId}`);
      
      // Notify service worker to preload
      await this.notifyServiceWorker('PRELOAD_PATIENT', { patientId });
      
      // Update cache status
      this.clinicalStatus.patientDataCacheStatus = 'warm';
      
    } catch (error) {
      console.error('Failed to preload patient data:', error);
      this.clinicalStatus.patientDataCacheStatus = 'stale';
    }
  }

  // ===============================
  // PRIVATE HELPER METHODS
  // ===============================

  private async initializeClinicalMetrics(): Promise<void> {
    // Initialize metrics from stored data
    try {
      const stats = await clinicalIndexedDBService.getClinicalStats();
      this.clinicalStatus.clinicalNotesSynced = stats.totalNotes;
      this.clinicalStatus.attachmentsSynced = stats.totalAttachments;
      this.clinicalStatus.workflowItemsSynced = stats.pendingWorkflows;
    } catch (error) {
      console.warn('Failed to initialize clinical metrics:', error);
    }
  }

  private async getPendingClinicalNotes(): Promise<ClinicalNoteOfflineData[]> {
    const searchResult = await clinicalIndexedDBService.searchClinicalNotes({
      limit: 100
    });
    
    return searchResult.notes.filter(note => 
      note.offlineCreated || note.offlineModified
    );
  }

  private async getPendingAttachments(): Promise<OfflineAttachment[]> {
    // This would query the attachment store for pending uploads
    // Implementation depends on attachment storage structure
    return [];
  }

  private async getPendingVoiceRecordings(): Promise<VoiceRecording[]> {
    // This would query voice recordings for pending sync
    return [];
  }

  private async handleClinicalNoteSyncFailure(note: ClinicalNoteOfflineData, error: unknown): Promise<void> {
    console.error(`Clinical note sync failed for ${note.noteId}:`, error);
    
    // Mark note with sync error
    await clinicalIndexedDBService.updateClinicalNote(note.noteId, {
      // Add error metadata
    });
  }

  private updateClinicalMetrics(data: any): void {
    if (data.operationsCount) {
      this.clinicalStatus.clinicalNotesSynced += data.operationsCount;
    }
  }

  private handleClinicalSyncFailure(data: any): void {
    console.error('Clinical sync failure reported by service worker:', data);
  }

  private trackOfflineAccess(data: any): void {
    // Track offline access patterns for metrics
    this.clinicalStatus.offlineTimeSpent += 1; // Simplified tracking
  }

  private updateAttachmentProgress(data: any): void {
    // Update attachment sync progress
    console.log('Attachment sync progress:', data);
  }

  private updateNoteSyncMetrics(syncTime: number): void {
    const count = this.clinicalStatus.clinicalNotesSynced;
    this.clinicalStatus.averageNoteSync = 
      (this.clinicalStatus.averageNoteSync * (count - 1) + syncTime) / count;
  }

  private updateAttachmentSyncMetrics(syncTime: number): void {
    const count = this.clinicalStatus.attachmentsSynced;
    this.clinicalStatus.averageAttachmentSync = 
      (this.clinicalStatus.averageAttachmentSync * (count - 1) + syncTime) / count;
  }

  private async compressImageData(data: ArrayBuffer | string): Promise<ArrayBuffer | string> {
    // Implement image compression logic
    return data;
  }

  private async uploadAttachment(attachment: OfflineAttachment, data: ArrayBuffer | string): Promise<{ url: string }> {
    // Implement attachment upload
    return { url: `https://example.com/attachments/${attachment.id}` };
  }

  private async updateAttachmentSync(attachmentId: string, updates: Partial<OfflineAttachment>): Promise<void> {
    // Update attachment sync status
  }

  private async syncVoiceRecording(recording: VoiceRecording, options: ClinicalSyncOptions): Promise<void> {
    // Implement voice recording sync
  }

  private async syncUrgentWorkflows(workflowIds: string[], options: ClinicalSyncOptions): Promise<void> {
    // Implement urgent workflow sync
  }

  private async syncWorkflowItem(workflow: ClinicalWorkflowQueue, options: ClinicalSyncOptions): Promise<void> {
    // Implement individual workflow item sync
  }

  private extractClinicalConflictData(conflict: SyncConflict): ClinicalConflictData | undefined {
    // Extract clinical-specific conflict data from resource metadata
    return {
      conflictType: 'fhir',
      clinicalImportance: 'medium',
      patientSafety: false
    };
  }
}

// Export clinical instance getter
export const getClinicalOfflineSyncService = () => ClinicalOfflineSyncService.getClinicalInstance();