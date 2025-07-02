/**
 * Clinical IndexedDB Service for Enhanced Offline Clinical Workflows
 * Extends base IndexedDB service with clinical-specific operations
 */

import { Resource } from '@medplum/fhirtypes';
import { indexedDBService, IndexedDBError } from './indexeddb.service';
import { encryptionService } from './encryption.service';
import {
  ClinicalNoteOfflineData,
  AppointmentOfflineData,
  OfflineAttachment,
  ClinicalWorkflowQueue,
  ClinicalTemplate,
  VoiceRecording
} from './indexeddb.clinical-schemas';
import { getErrorMessage } from '@/utils/error.utils';

/**
 * Clinical-specific IndexedDB operations
 */
export class ClinicalIndexedDBService {
  private static instance: ClinicalIndexedDBService;
  
  private constructor() {}

  static getInstance(): ClinicalIndexedDBService {
    if (!ClinicalIndexedDBService.instance) {
      ClinicalIndexedDBService.instance = new ClinicalIndexedDBService();
    }
    return ClinicalIndexedDBService.instance;
  }

  // ===================================
  // Clinical Notes Operations
  // ===================================

  /**
   * Create a new clinical note
   */
  async createClinicalNote(noteData: Omit<ClinicalNoteOfflineData, 'noteId' | 'createdAt' | 'updatedAt'>): Promise<ClinicalNoteOfflineData> {
    try {
      const now = Date.now();
      const noteId = `note-${now}-${Math.random().toString(36).substr(2, 9)}`;
      
      const note: ClinicalNoteOfflineData = {
        ...noteData,
        noteId,
        createdAt: now,
        updatedAt: now,
        lastAccessedAt: now,
        offlineCreated: true,
        localVersion: 1,
        deviceId: await this.getDeviceId()
      };

      // Store as a custom resource
      await indexedDBService.createResource({
        resourceType: 'ClinicalNote',
        id: noteId,
        ...note
      } as any);

      return note;
    } catch (error) {
      throw new IndexedDBError(
        `Failed to create clinical note: ${getErrorMessage(error)}`,
        'CREATE_NOTE_FAILED'
      );
    }
  }

  /**
   * Update an existing clinical note
   */
  async updateClinicalNote(noteId: string, updates: Partial<ClinicalNoteOfflineData>): Promise<ClinicalNoteOfflineData> {
    try {
      const existing = await this.getClinicalNote(noteId);
      if (!existing) {
        throw new IndexedDBError('Clinical note not found', 'NOTE_NOT_FOUND');
      }

      const now = Date.now();
      const updatedNote: ClinicalNoteOfflineData = {
        ...existing,
        ...updates,
        updatedAt: now,
        lastAccessedAt: now,
        offlineModified: true,
        localVersion: existing.localVersion + 1
      };

      await indexedDBService.updateResource({
        resourceType: 'ClinicalNote',
        id: noteId,
        ...updatedNote
      } as any);

      return updatedNote;
    } catch (error) {
      throw new IndexedDBError(
        `Failed to update clinical note: ${getErrorMessage(error)}`,
        'UPDATE_NOTE_FAILED'
      );
    }
  }

  /**
   * Get a clinical note by ID
   */
  async getClinicalNote(noteId: string): Promise<ClinicalNoteOfflineData | null> {
    try {
      const resource = await indexedDBService.readResource<any>('ClinicalNote', noteId);
      if (!resource) return null;

      // Update last accessed time
      await this.updateLastAccessed('clinicalNotes', noteId);
      
      return resource as ClinicalNoteOfflineData;
    } catch (error) {
      throw new IndexedDBError(
        `Failed to get clinical note: ${getErrorMessage(error)}`,
        'GET_NOTE_FAILED'
      );
    }
  }

  /**
   * Search clinical notes with advanced filtering
   */
  async searchClinicalNotes(params: {
    patientId?: string;
    practitionerId?: string;
    noteType?: string[];
    status?: string[];
    startDate?: number;
    endDate?: number;
    limit?: number;
    offset?: number;
  }): Promise<{
    notes: ClinicalNoteOfflineData[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // Convert to search params format
      const searchParams: any = {
        _count: params.limit || 20,
        _offset: params.offset || 0
      };

      if (params.patientId) searchParams.patientId = params.patientId;
      if (params.practitionerId) searchParams.practitionerId = params.practitionerId;
      if (params.noteType) searchParams.noteType = params.noteType;
      if (params.status) searchParams.status = params.status;

      const bundle = await indexedDBService.searchResources<any>('ClinicalNote', searchParams);
      
      const notes = bundle.entry?.map(entry => entry.resource as ClinicalNoteOfflineData) || [];
      
      // Filter by date range if provided
      let filteredNotes = notes;
      if (params.startDate || params.endDate) {
        filteredNotes = notes.filter(note => {
          if (params.startDate && note.createdAt < params.startDate) return false;
          if (params.endDate && note.createdAt > params.endDate) return false;
          return true;
        });
      }

      const total = bundle.total || 0;
      const hasMore = (params.offset || 0) + filteredNotes.length < total;

      return { notes: filteredNotes, total, hasMore };
    } catch (error) {
      throw new IndexedDBError(
        `Failed to search clinical notes: ${getErrorMessage(error)}`,
        'SEARCH_NOTES_FAILED'
      );
    }
  }

  // ===================================
  // Appointment Operations
  // ===================================

  /**
   * Cache appointment data for offline access
   */
  async cacheAppointment(appointment: AppointmentOfflineData): Promise<void> {
    try {
      await indexedDBService.createResource({
        resourceType: 'Appointment',
        id: appointment.appointmentId,
        ...appointment
      } as any);
    } catch (error) {
      throw new IndexedDBError(
        `Failed to cache appointment: ${getErrorMessage(error)}`,
        'CACHE_APPOINTMENT_FAILED'
      );
    }
  }

  /**
   * Get cached appointment
   */
  async getCachedAppointment(appointmentId: string): Promise<AppointmentOfflineData | null> {
    try {
      const resource = await indexedDBService.readResource<any>('Appointment', appointmentId);
      return resource as AppointmentOfflineData | null;
    } catch (error) {
      throw new IndexedDBError(
        `Failed to get cached appointment: ${getErrorMessage(error)}`,
        'GET_APPOINTMENT_FAILED'
      );
    }
  }

  /**
   * Update appointment offline (check-in, status changes)
   */
  async updateAppointmentOffline(appointmentId: string, updates: Partial<AppointmentOfflineData>): Promise<void> {
    try {
      const existing = await this.getCachedAppointment(appointmentId);
      if (!existing) {
        throw new IndexedDBError('Appointment not found', 'APPOINTMENT_NOT_FOUND');
      }

      const updatedAppointment: AppointmentOfflineData = {
        ...existing,
        ...updates,
        offlineModified: true,
        updatedAt: Date.now(),
        localVersion: existing.localVersion + 1
      };

      await indexedDBService.updateResource({
        resourceType: 'Appointment',
        id: appointmentId,
        ...updatedAppointment
      } as any);
    } catch (error) {
      throw new IndexedDBError(
        `Failed to update appointment offline: ${getErrorMessage(error)}`,
        'UPDATE_APPOINTMENT_FAILED'
      );
    }
  }

  // ===================================
  // Attachment Operations
  // ===================================

  /**
   * Store attachment for offline access
   */
  async storeAttachment(attachment: Omit<OfflineAttachment, 'id' | 'createdAt' | 'lastAccessedAt'>): Promise<string> {
    try {
      const attachmentId = `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = Date.now();

      const fullAttachment: OfflineAttachment = {
        ...attachment,
        id: attachmentId,
        createdAt: now,
        lastAccessedAt: now
      };

      await indexedDBService.createResource({
        resourceType: 'OfflineAttachment',
        ...fullAttachment
      } as any);

      return attachmentId;
    } catch (error) {
      throw new IndexedDBError(
        `Failed to store attachment: ${getErrorMessage(error)}`,
        'STORE_ATTACHMENT_FAILED'
      );
    }
  }

  /**
   * Get attachment by ID
   */
  async getAttachment(attachmentId: string): Promise<OfflineAttachment | null> {
    try {
      const resource = await indexedDBService.readResource<any>('OfflineAttachment', attachmentId);
      
      if (resource) {
        // Update last accessed time
        await this.updateLastAccessed('offlineAttachments', attachmentId);
      }
      
      return resource as OfflineAttachment | null;
    } catch (error) {
      throw new IndexedDBError(
        `Failed to get attachment: ${getErrorMessage(error)}`,
        'GET_ATTACHMENT_FAILED'
      );
    }
  }

  /**
   * Get attachments for a note
   */
  async getAttachmentsForNote(noteId: string): Promise<OfflineAttachment[]> {
    try {
      const bundle = await indexedDBService.searchResources<any>('OfflineAttachment', {
        noteId
      });
      
      return bundle.entry?.map(entry => entry.resource as OfflineAttachment) || [];
    } catch (error) {
      throw new IndexedDBError(
        `Failed to get note attachments: ${getErrorMessage(error)}`,
        'GET_NOTE_ATTACHMENTS_FAILED'
      );
    }
  }

  // ===================================
  // Workflow Queue Operations
  // ===================================

  /**
   * Add item to clinical workflow queue
   */
  async addToWorkflowQueue(workflow: Omit<ClinicalWorkflowQueue, 'id' | 'createdAt'>): Promise<number> {
    try {
      const now = Date.now();
      const workflowEntry: ClinicalWorkflowQueue = {
        ...workflow,
        createdAt: now
      };

      const workflowId = `workflow-${now}-${Math.random().toString(36).substr(2, 9)}`;
      const result = await indexedDBService.createResource({
        resourceType: 'ClinicalWorkflow',
        id: workflowId,
        ...workflowEntry
      } as any);

      return now; // Return a unique identifier
    } catch (error) {
      throw new IndexedDBError(
        `Failed to add to workflow queue: ${getErrorMessage(error)}`,
        'ADD_WORKFLOW_FAILED'
      );
    }
  }

  /**
   * Get pending workflow items
   */
  async getPendingWorkflows(): Promise<ClinicalWorkflowQueue[]> {
    try {
      const bundle = await indexedDBService.searchResources<any>('ClinicalWorkflow', {
        status: 'pending'
      });
      
      return bundle.entry?.map(entry => entry.resource as ClinicalWorkflowQueue) || [];
    } catch (error) {
      throw new IndexedDBError(
        `Failed to get pending workflows: ${getErrorMessage(error)}`,
        'GET_WORKFLOWS_FAILED'
      );
    }
  }

  // ===================================
  // Template Operations
  // ===================================

  /**
   * Cache clinical template
   */
  async cacheTemplate(template: ClinicalTemplate): Promise<void> {
    try {
      await indexedDBService.createResource({
        resourceType: 'ClinicalTemplate',
        ...template
      } as any);
    } catch (error) {
      throw new IndexedDBError(
        `Failed to cache template: ${getErrorMessage(error)}`,
        'CACHE_TEMPLATE_FAILED'
      );
    }
  }

  /**
   * Get available templates for category
   */
  async getTemplatesForCategory(category: string): Promise<ClinicalTemplate[]> {
    try {
      const bundle = await indexedDBService.searchResources<any>('ClinicalTemplate', {
        category,
        active: true
      });
      
      return bundle.entry?.map(entry => entry.resource as ClinicalTemplate) || [];
    } catch (error) {
      throw new IndexedDBError(
        `Failed to get templates: ${getErrorMessage(error)}`,
        'GET_TEMPLATES_FAILED'
      );
    }
  }

  // ===================================
  // Voice Recording Operations
  // ===================================

  /**
   * Store voice recording
   */
  async storeVoiceRecording(recording: Omit<VoiceRecording, 'id'>): Promise<string> {
    try {
      const recordingId = `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const fullRecording: VoiceRecording = {
        ...recording,
        id: recordingId
      };

      await indexedDBService.createResource({
        resourceType: 'VoiceRecording',
        ...fullRecording
      } as any);

      return recordingId;
    } catch (error) {
      throw new IndexedDBError(
        `Failed to store voice recording: ${getErrorMessage(error)}`,
        'STORE_VOICE_FAILED'
      );
    }
  }

  // ===================================
  // Utility Methods
  // ===================================

  /**
   * Get device ID for offline tracking
   */
  private async getDeviceId(): Promise<string> {
    const stored = localStorage.getItem('omnicare-device-id');
    if (stored) return stored;

    const deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('omnicare-device-id', deviceId);
    return deviceId;
  }

  /**
   * Update last accessed timestamp
   */
  private async updateLastAccessed(storeName: string, id: string): Promise<void> {
    // This would be a direct IndexedDB operation to avoid recursive calls
    try {
      if (!indexedDBService.isInitialized()) return;
      
      // Use a lightweight update that doesn't trigger full resource processing
      const db = (indexedDBService as any).db;
      if (!db) return;

      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          record.lastAccessedAt = Date.now();
          store.put(record);
        }
      };
    } catch (error) {
      // Silently fail for non-critical operation
      console.warn('Failed to update last accessed time:', error);
    }
  }

  /**
   * Clear all clinical data (for logout)
   */
  async clearClinicalData(): Promise<void> {
    try {
      // This would typically be handled by the main service's clearAllData
      await indexedDBService.clearAllData();
    } catch (error) {
      throw new IndexedDBError(
        `Failed to clear clinical data: ${getErrorMessage(error)}`,
        'CLEAR_DATA_FAILED'
      );
    }
  }

  /**
   * Get clinical data statistics
   */
  async getClinicalStats(): Promise<{
    totalNotes: number;
    totalAttachments: number;
    attachmentSize: number;
    pendingWorkflows: number;
    recentActivity: number;
  }> {
    try {
      const stats = await indexedDBService.getStorageStats();
      
      const totalNotes = stats.recordsByType['clinicalNotes'] || 0;
      const totalAttachments = stats.recordsByType['offlineAttachments'] || 0;
      const pendingWorkflows = stats.recordsByType['clinicalWorkflowQueue'] || 0;
      
      // Calculate recent activity (last 24 hours)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const recentNotes = await this.searchClinicalNotes({
        startDate: oneDayAgo,
        limit: 1000
      });
      
      return {
        totalNotes,
        totalAttachments,
        attachmentSize: 0, // Would need to calculate from attachment data
        pendingWorkflows,
        recentActivity: recentNotes.notes.length
      };
    } catch (error) {
      throw new IndexedDBError(
        `Failed to get clinical stats: ${getErrorMessage(error)}`,
        'GET_STATS_FAILED'
      );
    }
  }
}

// Export singleton instance
export const clinicalIndexedDBService = ClinicalIndexedDBService.getInstance();