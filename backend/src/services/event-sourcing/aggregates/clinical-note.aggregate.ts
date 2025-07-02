/**
 * OmniCare EMR - Clinical Note Aggregate
 * Clinical documentation aggregate with event sourcing
 */

import {
  ClinicalNoteCreatedEvent,
  ClinicalNoteUpdatedEvent,
  ClinicalNoteFinalizedEvent,
  createHealthcareEvent
} from '../domain-events/healthcare-events';
import { DomainEvent } from '../types/event-sourcing.types';

import { HealthcareAggregateRoot, BaseAggregateRepository } from './aggregate-root';

export interface ClinicalNoteSnapshot {
  id: string;
  patientId: string;
  providerId: string;
  encounterId?: string;
  noteType: string;
  content: string;
  templateId?: string;
  isDraft: boolean;
  isFinalized: boolean;
  finalizedBy?: string;
  finalizedAt?: string;
  electronicSignature?: string;
  reviewers: string[];
  addendums: Array<{
    id: string;
    content: string;
    addedBy: string;
    addedAt: string;
    reason: string;
  }>;
  isAmended: boolean;
  originalContent?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export enum ClinicalNoteStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  FINALIZED = 'finalized',
  AMENDED = 'amended'
}

export enum ClinicalNoteType {
  PROGRESS_NOTE = 'progress_note',
  CONSULTATION = 'consultation',
  DISCHARGE_SUMMARY = 'discharge_summary',
  HISTORY_PHYSICAL = 'history_physical',
  OPERATIVE_NOTE = 'operative_note',
  NURSING_NOTE = 'nursing_note',
  THERAPY_NOTE = 'therapy_note'
}

export class ClinicalNoteAggregate extends HealthcareAggregateRoot {
  protected patientId: string = '';
  private providerId: string = '';
  // encounterId is inherited from base class
  private noteType: string = '';
  private content: string = '';
  private templateId?: string;
  private isDraft: boolean = true;
  private isFinalized: boolean = false;
  private finalizedBy?: string;
  private finalizedAt?: string;
  private electronicSignature?: string;
  private reviewers: string[] = [];
  private addendums: Array<{
    id: string;
    content: string;
    addedBy: string;
    addedAt: string;
    reason: string;
  }> = [];
  private isAmended: boolean = false;
  private originalContent?: string;
  private createdAt: string = '';
  private updatedAt: string = '';

  constructor(id?: string, patientId?: string) {
    super(id, patientId);
  }

  /**
   * Create new clinical note
   */
  static createClinicalNote(
    data: {
      patientId: string;
      providerId: string;
      encounterId?: string;
      noteType: string;
      content: string;
      templateId?: string;
      isDraft?: boolean;
    },
    userId: string,
    correlationId?: string
  ): ClinicalNoteAggregate {
    const note = new ClinicalNoteAggregate();
    
    // Validate required fields
    if (!data.patientId || !data.providerId || !data.noteType || !data.content) {
      throw new Error('Required clinical note fields missing');
    }

    // Validate note type
    if (!Object.values(ClinicalNoteType).includes(data.noteType as ClinicalNoteType)) {
      throw new Error('Invalid clinical note type');
    }

    // Create and apply event
    const event = createHealthcareEvent(
      ClinicalNoteCreatedEvent,
      note.id,
      {
        ...data,
        isDraft: data.isDraft !== false // Default to true unless explicitly set to false
      },
      note.createHealthcareEventMetadata(userId, 'clinical_note_creation', correlationId)
    );

    note.addEvent(event);
    note.validateInvariants();
    
    return note;
  }

  /**
   * Update clinical note content
   */
  updateContent(
    newContent: string,
    reason: string,
    userId: string,
    correlationId?: string
  ): void {
    if (this.isFinalized) {
      throw new Error('Cannot update finalized clinical note - use addendum instead');
    }

    if (!this.isDraft) {
      throw new Error('Cannot update non-draft clinical note');
    }

    if (newContent === this.content) {
      return; // No change
    }

    // Create and apply event
    const event = createHealthcareEvent(
      ClinicalNoteUpdatedEvent,
      this.id,
      {
        previousContent: this.content,
        newContent,
        reason,
        isAddendum: false
      },
      this.createHealthcareEventMetadata(userId, 'clinical_note_update', correlationId)
    );

    this.addEvent(event);
    this.validateInvariants();
  }

  /**
   * Add addendum to finalized note
   */
  addAddendum(
    addendumContent: string,
    reason: string,
    userId: string,
    correlationId?: string
  ): void {
    if (!this.isFinalized) {
      throw new Error('Can only add addendum to finalized notes');
    }

    if (!addendumContent.trim()) {
      throw new Error('Addendum content cannot be empty');
    }

    // Create and apply event
    const event = createHealthcareEvent(
      ClinicalNoteUpdatedEvent,
      this.id,
      {
        previousContent: this.content,
        newContent: addendumContent,
        reason,
        isAddendum: true
      },
      this.createHealthcareEventMetadata(userId, 'clinical_note_addendum', correlationId)
    );

    this.addEvent(event);
    this.validateInvariants();
  }

  /**
   * Finalize clinical note
   */
  finalizeNote(
    userId: string,
    electronicSignature: string,
    reviewers?: string[],
    correlationId?: string
  ): void {
    if (this.isFinalized) {
      throw new Error('Clinical note is already finalized');
    }

    if (!this.content.trim()) {
      throw new Error('Cannot finalize empty clinical note');
    }

    if (!electronicSignature) {
      throw new Error('Electronic signature required for finalization');
    }

    // Create and apply event
    const event = createHealthcareEvent(
      ClinicalNoteFinalizedEvent,
      this.id,
      {
        finalizedBy: userId,
        finalizedAt: new Date(),
        electronicSignature,
        reviewers: reviewers || []
      },
      this.createHealthcareEventMetadata(userId, 'clinical_note_finalization', correlationId)
    );

    this.addEvent(event);
    this.validateInvariants();
  }

  /**
   * Get current status
   */
  getStatus(): ClinicalNoteStatus {
    if (this.isFinalized) {
      return this.isAmended ? ClinicalNoteStatus.AMENDED : ClinicalNoteStatus.FINALIZED;
    }
    if (this.reviewers.length > 0) {
      return ClinicalNoteStatus.IN_REVIEW;
    }
    return ClinicalNoteStatus.DRAFT;
  }

  /**
   * Check if user can edit note
   */
  canUserEdit(userId: string): boolean {
    if (this.isFinalized) {
      return false; // Finalized notes can only have addendums
    }
    
    // Only the original provider or authorized users can edit
    return this.providerId === userId;
  }

  /**
   * Apply domain event to aggregate state
   */
  applyEvent(event: DomainEvent): void {
    switch (event.eventType) {
      case 'ClinicalNoteCreated':
        this.applyClinicalNoteCreatedEvent(event);
        break;
      case 'ClinicalNoteUpdated':
        this.applyClinicalNoteUpdatedEvent(event);
        break;
      case 'ClinicalNoteFinalized':
        this.applyClinicalNoteFinalizedEvent(event);
        break;
      default:
        // Unknown event type - ignore or log warning
        break;
    }
  }

  private applyClinicalNoteCreatedEvent(event: DomainEvent): void {
    const data = event.data;
    this.patientId = data.patientId;
    this.providerId = data.providerId;
    this.encounterId = data.encounterId;
    this.noteType = data.noteType;
    this.content = data.content;
    this.templateId = data.templateId;
    this.isDraft = data.isDraft;
    this.isFinalized = false;
    this.isAmended = false;
    this.createdAt = event.timestamp?.toISOString() || new Date().toISOString();
    this.updatedAt = this.createdAt;
  }

  private applyClinicalNoteUpdatedEvent(event: DomainEvent): void {
    const { newContent, reason, isAddendum } = event.data;
    
    if (isAddendum) {
      // Add to addendums
      this.addendums.push({
        id: require('uuid').v4(),
        content: newContent,
        addedBy: event.metadata?.userId || 'unknown',
        addedAt: event.timestamp?.toISOString() || new Date().toISOString(),
        reason
      });
      this.isAmended = true;
    } else {
      // Update main content
      if (!this.originalContent) {
        this.originalContent = this.content;
      }
      this.content = newContent;
    }
    
    this.updatedAt = event.timestamp?.toISOString() || new Date().toISOString();
  }

  private applyClinicalNoteFinalizedEvent(event: DomainEvent): void {
    const { finalizedBy, finalizedAt, electronicSignature, reviewers } = event.data;
    
    this.isFinalized = true;
    this.isDraft = false;
    this.finalizedBy = finalizedBy;
    this.finalizedAt = finalizedAt.toISOString();
    this.electronicSignature = electronicSignature;
    this.reviewers = reviewers || [];
    this.updatedAt = event.timestamp?.toISOString() || new Date().toISOString();
  }

  /**
   * Create snapshot of current state
   */
  toSnapshot(): ClinicalNoteSnapshot {
    return {
      id: this.id,
      patientId: this.patientId,
      providerId: this.providerId,
      encounterId: this.encounterId,
      noteType: this.noteType,
      content: this.content,
      templateId: this.templateId,
      isDraft: this.isDraft,
      isFinalized: this.isFinalized,
      finalizedBy: this.finalizedBy,
      finalizedAt: this.finalizedAt,
      electronicSignature: this.electronicSignature,
      reviewers: [...this.reviewers],
      addendums: [...this.addendums],
      isAmended: this.isAmended,
      originalContent: this.originalContent,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version
    };
  }

  /**
   * Restore from snapshot
   */
  fromSnapshot(snapshot: ClinicalNoteSnapshot): void {
    this.id = snapshot.id;
    this.patientId = snapshot.patientId;
    this.providerId = snapshot.providerId;
    this.encounterId = snapshot.encounterId;
    this.noteType = snapshot.noteType;
    this.content = snapshot.content;
    this.templateId = snapshot.templateId;
    this.isDraft = snapshot.isDraft;
    this.isFinalized = snapshot.isFinalized;
    this.finalizedBy = snapshot.finalizedBy;
    this.finalizedAt = snapshot.finalizedAt;
    this.electronicSignature = snapshot.electronicSignature;
    this.reviewers = [...snapshot.reviewers];
    this.addendums = [...snapshot.addendums];
    this.isAmended = snapshot.isAmended;
    this.originalContent = snapshot.originalContent;
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.version = snapshot.version;
  }

  /**
   * Validate business invariants
   */
  protected validateInvariants(): void {
    if (!this.patientId) {
      throw new Error('Clinical note must have patient ID');
    }

    if (!this.providerId) {
      throw new Error('Clinical note must have provider ID');
    }

    if (!this.noteType) {
      throw new Error('Clinical note must have note type');
    }

    if (!this.content.trim()) {
      throw new Error('Clinical note must have content');
    }

    if (this.isFinalized && !this.finalizedBy) {
      throw new Error('Finalized note must have finalizedBy');
    }

    if (this.isFinalized && !this.electronicSignature) {
      throw new Error('Finalized note must have electronic signature');
    }

    // Content length validation
    if (this.content.length > 50000) { // 50KB limit
      throw new Error('Clinical note content exceeds maximum length');
    }
  }

  // Getters for read-only access
  get getPatientId(): string { return this.patientId; }
  get getProviderId(): string { return this.providerId; }
  get getNoteType(): string { return this.noteType; }
  get getContent(): string { return this.content; }
  get getIsDraft(): boolean { return this.isDraft; }
  get getIsFinalized(): boolean { return this.isFinalized; }
  get getAddendums(): Array<any> { return [...this.addendums]; }
}

/**
 * Clinical Note repository
 */
export class ClinicalNoteRepository extends BaseAggregateRepository<ClinicalNoteAggregate> {
  protected aggregateType = 'ClinicalNote';

  protected createAggregate(id: string): ClinicalNoteAggregate {
    return new ClinicalNoteAggregate(id);
  }

  /**
   * Find notes by patient ID
   */
  async getByPatientId(patientId: string): Promise<ClinicalNoteAggregate[]> {
    // This would require a projection or read model to efficiently find by patient
    // For now, this is a placeholder
    throw new Error('Find by patient ID requires projection implementation');
  }

  /**
   * Find notes by provider ID
   */
  async getByProviderId(providerId: string): Promise<ClinicalNoteAggregate[]> {
    // This would require a projection or read model to efficiently find by provider
    // For now, this is a placeholder
    throw new Error('Find by provider ID requires projection implementation');
  }

  /**
   * Find notes by encounter ID
   */
  async getByEncounterId(encounterId: string): Promise<ClinicalNoteAggregate[]> {
    // This would require a projection or read model to efficiently find by encounter
    // For now, this is a placeholder
    throw new Error('Find by encounter ID requires projection implementation');
  }
}