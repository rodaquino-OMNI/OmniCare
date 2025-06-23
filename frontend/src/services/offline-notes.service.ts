'use client';

import { DocumentReference, Bundle, Attachment } from '@medplum/fhirtypes';
import { fhirService } from './fhir.service';
import { notifications } from '@mantine/notifications';
import { getErrorMessage } from '@/utils/error.utils';

// Utility function to generate unique IDs
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export interface OfflineNote {
  id: string;
  tempId: string;
  noteType: string;
  title: string;
  content: string;
  status: 'draft' | 'signed' | 'syncing' | 'synced' | 'conflict';
  patientId: string;
  encounterId?: string;
  practitionerId: string;
  practitionerName: string;
  createdAt: string;
  updatedAt: string;
  lastSyncAttempt?: string;
  syncErrors?: string[];
  attachments?: OfflineAttachment[];
  tags?: string[];
  version: number;
  serverVersion?: number;
  conflictData?: {
    serverNote: DocumentReference;
    localChanges: Partial<OfflineNote>;
    conflictedAt: string;
  };
}

export interface OfflineAttachment {
  id: string;
  contentType: string;
  data: string; // Base64 encoded
  title?: string;
  size: number;
  createdAt: string;
}

export interface NoteDraft {
  patientId: string;
  encounterId?: string;
  noteType: string;
  title: string;
  content: string;
  tags?: string[];
  attachments?: OfflineAttachment[];
}

export interface ConflictResolution {
  noteId: string;
  resolution: 'keepLocal' | 'keepServer' | 'merge';
  mergedContent?: string;
  mergedTitle?: string;
}

const DB_NAME = 'OmniCareOffline';
const DB_VERSION = 1;
const NOTES_STORE = 'clinical_notes';
const SYNC_QUEUE_STORE = 'sync_queue';
const TEMPLATES_STORE = 'note_templates';

export class OfflineNotesService {
  private db: IDBDatabase | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private isOnline: boolean = navigator.onLine;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeDB();
      this.setupEventListeners();
      this.startAutoSync();
    }
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Clinical notes store
        if (!db.objectStoreNames.contains(NOTES_STORE)) {
          const notesStore = db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
          notesStore.createIndex('patientId', 'patientId', { unique: false });
          notesStore.createIndex('status', 'status', { unique: false });
          notesStore.createIndex('createdAt', 'createdAt', { unique: false });
          notesStore.createIndex('syncStatus', ['status', 'lastSyncAttempt'], { unique: false });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          const syncStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('status', 'status', { unique: false });
        }

        // Templates store for offline SmartText
        if (!db.objectStoreNames.contains(TEMPLATES_STORE)) {
          const templatesStore = db.createObjectStore(TEMPLATES_STORE, { keyPath: 'id' });
          templatesStore.createIndex('type', 'type', { unique: false });
          templatesStore.createIndex('specialty', 'specialty', { unique: false });
        }
      };
    });
  }

  private setupEventListeners(): void {
    // Online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      notifications.show({
        title: 'Connection Restored',
        message: 'Syncing offline notes...',
        color: 'green'
      });
      this.syncOfflineNotes();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      notifications.show({
        title: 'Working Offline',
        message: 'Your notes will be saved locally and synced when connection is restored',
        color: 'orange'
      });
    });

    // Visibility change - sync when app becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.syncOfflineNotes();
      }
    });
  }

  private startAutoSync(): void {
    // Auto-sync every 5 minutes when online
    this.syncTimer = setInterval(() => {
      if (this.isOnline) {
        this.syncOfflineNotes();
      }
    }, 5 * 6 * 1000);
  }

  public stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // ===============================
  // DRAFT MANAGEMENT
  // ===============================

  public async saveDraft(draft: NoteDraft): Promise<OfflineNote> {
    if (!this.db) await this.initializeDB();

    const note: OfflineNote = {
      id: generateId(),
      tempId: `temp_${generateId()}`,
      noteType: draft.noteType,
      title: draft.title,
      content: draft.content,
      status: 'draft',
      patientId: draft.patientId,
      encounterId: draft.encounterId,
      practitionerId: this.getCurrentPractitionerId(),
      practitionerName: this.getCurrentPractitionerName(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: draft.tags,
      attachments: draft.attachments,
      version: 1
    };

    const transaction = this.db!.transaction([NOTES_STORE], 'readwrite');
    const store = transaction.objectStore(NOTES_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(note);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Add to sync queue if online
    if (this.isOnline) {
      await this.addToSyncQueue(note.id, 'create');
    }

    return note;
  }

  public async updateDraft(noteId: string, updates: Partial<NoteDraft>): Promise<OfflineNote> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction([NOTES_STORE], 'readwrite');
    const store = transaction.objectStore(NOTES_STORE);
    
    const existingNote = await new Promise<OfflineNote>((resolve, reject) => {
      const request = store.get(noteId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!existingNote) {
      throw new Error('Note not found');
    }

    const updatedNote: OfflineNote = {
      ...existingNote,
      ...updates,
      updatedAt: new Date().toISOString(),
      version: existingNote.version + 1
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(updatedNote);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Add to sync queue
    if (this.isOnline && existingNote.status !== 'draft') {
      await this.addToSyncQueue(noteId, 'update');
    }

    return updatedNote;
  }

  public async autoSaveDraft(noteId: string, content: string, title?: string): Promise<void> {
    try {
      await this.updateDraft(noteId, { content, title });
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }

  // ===============================
  // RECOVERY MECHANISMS
  // ===============================

  public async recoverDrafts(patientId: string): Promise<OfflineNote[]> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction([NOTES_STORE], 'readonly');
    const store = transaction.objectStore(NOTES_STORE);
    const index = store.index('patientId');
    
    const drafts = await new Promise<OfflineNote[]>((resolve, reject) => {
      const request = index.getAll(patientId);
      request.onsuccess = () => {
        const notes = request.result.filter(note => 
          note.status === 'draft' || note.status === 'conflict'
        );
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });

    return drafts.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public async getRecentDrafts(limit: number = 10): Promise<OfflineNote[]> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction([NOTES_STORE], 'readonly');
    const store = transaction.objectStore(NOTES_STORE);
    const index = store.index('createdAt');
    
    const allNotes = await new Promise<OfflineNote[]>((resolve, reject) => {
      const request = index.openCursor(null, 'prev');
      const results: OfflineNote[] = [];
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && results.length < limit) {
          const note = cursor.value;
          if (note.status === 'draft') {
            results.push(note);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });

    return allNotes;
  }

  // ===============================
  // SYNC QUEUE MANAGEMENT
  // ===============================

  private async addToSyncQueue(noteId: string, action: 'create' | 'update' | 'delete'): Promise<void> {
    if (!this.db) await this.initializeDB();

    const syncItem = {
      id: generateId(),
      noteId,
      action,
      timestamp: new Date().toISOString(),
      status: 'pending',
      attempts: ResourceHistoryTable,
      lastAttempt: null,
      error: null
    };

    const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(syncItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async syncOfflineNotes(): Promise<void> {
    if (!this.isOnline || !this.db) return;

    const transaction = this.db.transaction([SYNC_QUEUE_STORE, NOTES_STORE], 'readwrite');
    const queueStore = transaction.objectStore(SYNC_QUEUE_STORE);
    const notesStore = transaction.objectStore(NOTES_STORE);
    
    // Get pending sync items
    const pendingItems = await new Promise<any[]>((resolve, reject) => {
      const request = queueStore.index('status').getAll('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const item of pendingItems) {
      try {
        const note = await new Promise<OfflineNote>((resolve, reject) => {
          const request = notesStore.get(item.noteId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        if (!note) continue;

        // Update note status
        note.status = 'syncing';
        await this.updateNoteInDB(note);

        // Sync based on action
        let syncResult;
        switch (item.action) {
          case 'create':
            syncResult = await this.syncCreateNote(note);
            break;
          case 'update':
            syncResult = await this.syncUpdateNote(note);
            break;
          case 'delete':
            syncResult = await this.syncDeleteNote(note);
            break;
        }

        if (syncResult.success) {
          // Update note with server data
          note.id = syncResult.serverId || note.id;
          note.status = 'synced';
          note.serverVersion = syncResult.serverVersion;
          await this.updateNoteInDB(note);

          // Remove from sync queue
          await this.removeSyncQueueItem(item.id);
        } else if (syncResult.conflict) {
          // Handle conflict
          note.status = 'conflict';
          note.conflictData = syncResult.conflictData;
          await this.updateNoteInDB(note);
          
          notifications.show({
            title: 'Sync Conflict',
            message: `Note "${note.title}" has conflicting changes`,
            color: 'yellow'
          });
        } else {
          // Update sync item with error
          item.attempts++;
          item.lastAttempt = new Date().toISOString();
          item.error = syncResult.error;
          await this.updateSyncQueueItem(item);
        }
      } catch (error) {
        console.error('Sync error for item:', item, error);
        item.attempts++;
        item.lastAttempt = new Date().toISOString();
        item.error = getErrorMessage(error);
        await this.updateSyncQueueItem(item);
      }
    }
  }

  public async syncCreateNote(note: OfflineNote): Promise<any> {
    try {
      const docRef: DocumentReference = {
        resourceType: 'DocumentReference',
        status: note.status === 'signed' ? 'current' : 'draft',
        docStatus: note.status === 'signed' ? 'final' : 'preliminary',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: this.getNoteTypeCode(note.noteType),
            display: note.noteType
          }]
        },
        subject: { reference: `Patient/${note.patientId}` },
        date: note.createdAt,
        author: [{
          reference: `Practitioner/${note.practitionerId}`,
          display: note.practitionerName
        }],
        description: note.title,
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa(note.content),
            creation: note.createdAt
          }
        }],
        context: note.encounterId ? {
          encounter: [{ reference: `Encounter/${note.encounterId}` }]
        } : undefined
      };

      // Add attachments if any
      if (note.attachments && note.attachments.length > ResourceHistoryTable) {
        docRef.content = [
          ...docRef.content,
          ...note.attachments.map(att => ({
            attachment: {
              contentType: att.contentType,
              data: att.data,
              title: att.title,
              size: att.size,
              creation: att.createdAt
            } as Attachment
          }))
        ];
      }

      const created = await fhirService.createResource(docRef);
      
      return {
        success: true,
        serverId: created.id,
        serverVersion: created.meta?.versionId
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error)
      };
    }
  }

  public async syncUpdateNote(note: OfflineNote): Promise<any> {
    try {
      // First, check if note exists on server and get latest version
      const serverNote = await fhirService.readResource<DocumentReference>('DocumentReference', note.id);
      
      // Check for conflicts
      if (serverNote.meta?.versionId && note.serverVersion && 
          serverNote.meta.versionId !== note.serverVersion) {
        return {
          success: false,
          conflict: true,
          conflictData: {
            serverNote,
            localChanges: {
              title: note.title,
              content: note.content,
              updatedAt: note.updatedAt
            },
            conflictedAt: new Date().toISOString()
          }
        };
      }

      // Update server note
      serverNote.description = note.title;
      serverNote.content[ResourceHistoryTable].attachment.data = btoa(note.content);
      serverNote.meta = {
        ...serverNote.meta,
        lastUpdated: note.updatedAt
      };

      const updated = await fhirService.updateResource(serverNote);
      
      return {
        success: true,
        serverId: updated.id,
        serverVersion: updated.meta?.versionId
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error)
      };
    }
  }

  public async syncDeleteNote(note: OfflineNote): Promise<any> {
    try {
      await fhirService.deleteResource('DocumentReference', note.id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error)
      };
    }
  }

  // ===============================
  // CONFLICT RESOLUTION
  // ===============================

  public async getConflictedNotes(): Promise<OfflineNote[]> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction([NOTES_STORE], 'readonly');
    const store = transaction.objectStore(NOTES_STORE);
    const index = store.index('status');
    
    const conflicts = await new Promise<OfflineNote[]>((resolve, reject) => {
      const request = index.getAll('conflict');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return conflicts;
  }

  public async resolveConflict(resolution: ConflictResolution): Promise<void> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction([NOTES_STORE], 'readwrite');
    const store = transaction.objectStore(NOTES_STORE);
    
    const note = await new Promise<OfflineNote>((resolve, reject) => {
      const request = store.get(resolution.noteId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!note || !note.conflictData) {
      throw new Error('Note not found or not in conflict');
    }

    switch (resolution.resolution) {
      case 'keepLocal':
        // Keep local version, override server
        note.status = 'draft';
        note.conflictData = undefined;
        await this.updateNoteInDB(note);
        await this.addToSyncQueue(note.id, 'update');
        break;

      case 'keepServer':
        // Discard local changes, use server version
        const serverNote = note.conflictData.serverNote;
        note.title = serverNote.description || '';
        note.content = serverNote.content[ResourceHistoryTable]?.attachment?.data ? 
          atob(serverNote.content[ResourceHistoryTable].attachment.data) : '';
        note.status = 'synced';
        note.serverVersion = serverNote.meta?.versionId;
        note.conflictData = undefined;
        await this.updateNoteInDB(note);
        break;

      case 'merge':
        // Merge changes
        if (resolution.mergedContent) {
          note.content = resolution.mergedContent;
        }
        if (resolution.mergedTitle) {
          note.title = resolution.mergedTitle;
        }
        note.status = 'draft';
        note.conflictData = undefined;
        await this.updateNoteInDB(note);
        await this.addToSyncQueue(note.id, 'update');
        break;
    }

    notifications.show({
      title: 'Conflict Resolved',
      message: 'Note has been updated successfully',
      color: 'green'
    });
  }

  // ===============================
  // ATTACHMENT HANDLING
  // ===============================

  public async addAttachment(noteId: string, file: File): Promise<OfflineAttachment> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const attachment: OfflineAttachment = {
          id: generateId(),
          contentType: file.type,
          data: (e.target?.result as string).split(',')[1], // Remove data URL prefix
          title: file.name,
          size: file.size,
          createdAt: new Date().toISOString()
        };

        try {
          const note = await this.getNote(noteId);
          if (!note) throw new Error('Note not found');

          note.attachments = [...(note.attachments || []), attachment];
          await this.updateNoteInDB(note);
          
          resolve(attachment);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  public async removeAttachment(noteId: string, attachmentId: string): Promise<void> {
    const note = await this.getNote(noteId);
    if (!note) throw new Error('Note not found');

    note.attachments = (note.attachments || []).filter(att => att.id !== attachmentId);
    await this.updateNoteInDB(note);
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  public async getNote(noteId: string): Promise<OfflineNote | null> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction([NOTES_STORE], 'readonly');
    const store = transaction.objectStore(NOTES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(noteId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async updateNoteInDB(note: OfflineNote): Promise<void> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction([NOTES_STORE], 'readwrite');
    const store = transaction.objectStore(NOTES_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(note);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async removeSyncQueueItem(id: string): Promise<void> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async updateSyncQueueItem(item: any): Promise<void> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private getCurrentPractitionerId(): string {
    // Get from auth store or session
    return localStorage.getItem('practitioner_id') || 'unknown';
  }

  private getCurrentPractitionerName(): string {
    // Get from auth store or session
    return localStorage.getItem('practitioner_name') || 'Unknown Practitioner';
  }

  private getNoteTypeCode(noteType: string): string {
    const noteTypeCodes: Record<string, string> = {
      'progress': '11506-3',
      'admission': '18842-5',
      'discharge': '18842-5',
      'procedure': '2857-ResourceHistoryTable',
      'consultation': '11488-4',
      'nursing': '34815-3'
    };
    return noteTypeCodes[noteType] || '11506-3';
  }

  // ===============================
  // CLEANUP
  // ===============================

  public async cleanup(): Promise<void> {
    this.stopAutoSync();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Export singleton instance
export const offlineNotesService = new OfflineNotesService();