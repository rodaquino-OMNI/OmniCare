/**
 * OmniCare EMR - Patient Aggregate
 * Patient aggregate root with event sourcing
 */

import {
  PatientRegisteredEvent,
  PatientUpdatedEvent,
  PatientMergedEvent,
  createHealthcareEvent
} from '../domain-events/healthcare-events';
import { DomainEvent } from '../types/event-sourcing.types';

import { HealthcareAggregateRoot, BaseAggregateRepository } from './aggregate-root';

export interface PatientSnapshot {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  ssn?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  phone?: string;
  email?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  insuranceInfo?: {
    primaryInsurance: {
      payerId: string;
      memberId: string;
      groupId: string;
    };
    secondaryInsurance?: {
      payerId: string;
      memberId: string;
      groupId: string;
    };
  };
  isActive: boolean;
  isDeceased: boolean;
  deceasedDate?: string;
  mergedIntoPatientId?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export class PatientAggregate extends HealthcareAggregateRoot {
  private mrn: string = '';
  private firstName: string = '';
  private lastName: string = '';
  private dateOfBirth: string = '';
  private gender: string = '';
  private ssn?: string;
  private address?: any;
  private phone?: string;
  private email?: string;
  private emergencyContact?: any;
  private insuranceInfo?: any;
  private isActive: boolean = true;
  private isDeceased: boolean = false;
  private deceasedDate?: string;
  private mergedIntoPatientId?: string;
  private createdAt: string = '';
  private updatedAt: string = '';

  constructor(id?: string) {
    super(id);
  }

  /**
   * Register new patient
   */
  static registerPatient(
    data: {
      mrn: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      gender: string;
      ssn?: string;
      address?: any;
      phone?: string;
      email?: string;
      emergencyContact?: any;
      insuranceInfo?: any;
    },
    userId: string,
    correlationId?: string
  ): PatientAggregate {
    const patient = new PatientAggregate();
    
    // Validate required fields
    if (!data.mrn || !data.firstName || !data.lastName || !data.dateOfBirth || !data.gender) {
      throw new Error('Required patient registration fields missing');
    }

    // Validate date of birth
    const dobDate = new Date(data.dateOfBirth);
    if (isNaN(dobDate.getTime())) {
      throw new Error('Invalid date of birth');
    }

    // Create and apply event
    const event = createHealthcareEvent(
      PatientRegisteredEvent,
      patient.id,
      data,
      patient.createHealthcareEventMetadata(userId, 'patient_registration', correlationId)
    );

    patient.addEvent(event);
    patient.validateInvariants();
    
    return patient;
  }

  /**
   * Update patient information
   */
  updatePatient(
    changedFields: string[],
    newValues: Record<string, any>,
    userId: string,
    reason?: string,
    correlationId?: string
  ): void {
    if (!this.isActive) {
      throw new Error('Cannot update inactive patient');
    }

    if (this.isDeceased) {
      throw new Error('Cannot update deceased patient');
    }

    if (this.mergedIntoPatientId) {
      throw new Error('Cannot update merged patient');
    }

    // Get previous values
    const previousValues: Record<string, any> = {};
    changedFields.forEach(field => {
      previousValues[field] = (this as any)[field];
    });

    // Create and apply event
    const event = createHealthcareEvent(
      PatientUpdatedEvent,
      this.id,
      {
        changedFields,
        previousValues,
        newValues,
        reason
      },
      this.createHealthcareEventMetadata(userId, 'patient_update', correlationId)
    );

    this.addEvent(event);
    this.validateInvariants();
  }

  /**
   * Merge patient records
   */
  mergePatient(
    sourcePatientId: string,
    mergedData: Record<string, any>,
    duplicateRecords: string[],
    userId: string,
    correlationId?: string
  ): void {
    if (!this.isActive) {
      throw new Error('Cannot merge into inactive patient');
    }

    if (this.isDeceased) {
      throw new Error('Cannot merge into deceased patient');
    }

    if (this.mergedIntoPatientId) {
      throw new Error('Cannot merge into already merged patient');
    }

    // Create and apply event
    const event = createHealthcareEvent(
      PatientMergedEvent,
      this.id,
      {
        sourcePatientId,
        mergedData,
        duplicateRecords,
        approvedBy: userId
      },
      this.createHealthcareEventMetadata(userId, 'patient_merge', correlationId)
    );

    this.addEvent(event);
    this.validateInvariants();
  }

  /**
   * Apply domain event to aggregate state
   */
  applyEvent(event: DomainEvent): void {
    switch (event.eventType) {
      case 'PatientRegistered':
        this.applyPatientRegisteredEvent(event);
        break;
      case 'PatientUpdated':
        this.applyPatientUpdatedEvent(event);
        break;
      case 'PatientMerged':
        this.applyPatientMergedEvent(event);
        break;
      case 'PatientDeceased':
        this.applyPatientDeceasedEvent(event);
        break;
      default:
        // Unknown event type - ignore or log warning
        break;
    }
  }

  private applyPatientRegisteredEvent(event: DomainEvent): void {
    const data = event.data;
    this.mrn = data.mrn;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.dateOfBirth = data.dateOfBirth;
    this.gender = data.gender;
    this.ssn = data.ssn;
    this.address = data.address;
    this.phone = data.phone;
    this.email = data.email;
    this.emergencyContact = data.emergencyContact;
    this.insuranceInfo = data.insuranceInfo;
    this.isActive = true;
    this.isDeceased = false;
    this.createdAt = event.timestamp?.toISOString() || new Date().toISOString();
    this.updatedAt = this.createdAt;
  }

  private applyPatientUpdatedEvent(event: DomainEvent): void {
    const { changedFields, newValues } = event.data;
    
    changedFields.forEach((field: string) => {
      if (newValues[field] !== undefined) {
        (this as any)[field] = newValues[field];
      }
    });
    
    this.updatedAt = event.timestamp?.toISOString() || new Date().toISOString();
  }

  private applyPatientMergedEvent(event: DomainEvent): void {
    const { mergedData } = event.data;
    
    // Merge data from source patient
    Object.keys(mergedData).forEach(key => {
      if (mergedData[key] !== undefined) {
        (this as any)[key] = mergedData[key];
      }
    });
    
    this.updatedAt = event.timestamp?.toISOString() || new Date().toISOString();
  }

  private applyPatientDeceasedEvent(event: DomainEvent): void {
    this.isDeceased = true;
    this.deceasedDate = event.data.deceasedDate;
    this.updatedAt = event.timestamp?.toISOString() || new Date().toISOString();
  }

  /**
   * Create snapshot of current state
   */
  toSnapshot(): PatientSnapshot {
    return {
      id: this.id,
      mrn: this.mrn,
      firstName: this.firstName,
      lastName: this.lastName,
      dateOfBirth: this.dateOfBirth,
      gender: this.gender,
      ssn: this.ssn,
      address: this.address,
      phone: this.phone,
      email: this.email,
      emergencyContact: this.emergencyContact,
      insuranceInfo: this.insuranceInfo,
      isActive: this.isActive,
      isDeceased: this.isDeceased,
      deceasedDate: this.deceasedDate,
      mergedIntoPatientId: this.mergedIntoPatientId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version
    };
  }

  /**
   * Restore from snapshot
   */
  fromSnapshot(snapshot: PatientSnapshot): void {
    this.id = snapshot.id;
    this.mrn = snapshot.mrn;
    this.firstName = snapshot.firstName;
    this.lastName = snapshot.lastName;
    this.dateOfBirth = snapshot.dateOfBirth;
    this.gender = snapshot.gender;
    this.ssn = snapshot.ssn;
    this.address = snapshot.address;
    this.phone = snapshot.phone;
    this.email = snapshot.email;
    this.emergencyContact = snapshot.emergencyContact;
    this.insuranceInfo = snapshot.insuranceInfo;
    this.isActive = snapshot.isActive;
    this.isDeceased = snapshot.isDeceased;
    this.deceasedDate = snapshot.deceasedDate;
    this.mergedIntoPatientId = snapshot.mergedIntoPatientId;
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.version = snapshot.version;
  }

  /**
   * Validate business invariants
   */
  protected validateInvariants(): void {
    if (!this.mrn) {
      throw new Error('Patient must have MRN');
    }

    if (!this.firstName || !this.lastName) {
      throw new Error('Patient must have first and last name');
    }

    if (!this.dateOfBirth) {
      throw new Error('Patient must have date of birth');
    }

    if (!this.gender) {
      throw new Error('Patient must have gender');
    }

    // Validate date of birth is not in future
    const dobDate = new Date(this.dateOfBirth);
    if (dobDate > new Date()) {
      throw new Error('Date of birth cannot be in the future');
    }

    // Validate SSN format if provided
    if (this.ssn && !/^\d{3}-\d{2}-\d{4}$/.test(this.ssn)) {
      throw new Error('Invalid SSN format');
    }

    // Validate email format if provided
    if (this.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      throw new Error('Invalid email format');
    }
  }

  // Getters for read-only access
  get getMrn(): string { return this.mrn; }
  get getFirstName(): string { return this.firstName; }
  get getLastName(): string { return this.lastName; }
  get getDateOfBirth(): string { return this.dateOfBirth; }
  get getGender(): string { return this.gender; }
  get getIsActive(): boolean { return this.isActive; }
  get getIsDeceased(): boolean { return this.isDeceased; }
  get getFullName(): string { return `${this.firstName} ${this.lastName}`; }
}

/**
 * Patient repository
 */
export class PatientRepository extends BaseAggregateRepository<PatientAggregate> {
  protected aggregateType = 'Patient';

  protected createAggregate(id: string): PatientAggregate {
    return new PatientAggregate(id);
  }

  /**
   * Find patient by MRN
   */
  async getByMrn(mrn: string): Promise<PatientAggregate | null> {
    // This would require a projection or read model to efficiently find by MRN
    // For now, this is a placeholder
    throw new Error('Find by MRN requires projection implementation');
  }

  /**
   * Find patients by name
   */
  async findByName(firstName: string, lastName: string): Promise<PatientAggregate[]> {
    // This would require a projection or read model to efficiently search by name
    // For now, this is a placeholder
    throw new Error('Find by name requires projection implementation');
  }
}