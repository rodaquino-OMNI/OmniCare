/**
 * OmniCare EMR - Event Sourcing Types
 * Core types and interfaces for event sourcing system
 */

// Base domain event interface
export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  data: any;
  metadata?: EventMetadata;
  version?: number;
  timestamp?: Date;
}

// Event metadata
export interface EventMetadata {
  correlationId: string;
  causationId: string;
  userId: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  [key: string]: any;
}

// Event stream
export interface EventStream {
  streamId: string;
  aggregateType: string;
  aggregateId: string;
  version: number;
  eventCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Snapshot
export interface Snapshot {
  streamId: string;
  version: number;
  data: any;
  metadata: Record<string, any>;
  createdAt?: Date;
}

// Aggregate root base
export interface AggregateRoot {
  id: string;
  version: number;
  uncommittedEvents: DomainEvent[];
  
  applyEvent(event: DomainEvent): void;
  markEventsAsCommitted(): void;
  loadFromHistory(events: DomainEvent[]): void;
  getUncommittedEvents(): DomainEvent[];
  toSnapshot(): any;
  fromSnapshot(snapshot: any): void;
}

// Event handler interface
export interface EventHandler<T extends DomainEvent = DomainEvent> {
  eventType: string;
  handle(event: T): Promise<void>;
}

// Projection interface
export interface Projection {
  projectionName: string;
  handle(event: DomainEvent): Promise<void>;
  getState(): Promise<any>;
  reset(): Promise<void>;
}

// Command interface
export interface Command {
  commandId: string;
  commandType: string;
  aggregateId: string;
  data: any;
  metadata?: CommandMetadata;
}

// Command metadata
export interface CommandMetadata {
  correlationId: string;
  userId: string;
  timestamp: string;
  [key: string]: any;
}

// Command handler interface
export interface CommandHandler<T extends Command = Command> {
  commandType: string;
  handle(command: T): Promise<void>;
}

// Saga interface
export interface Saga {
  sagaId: string;
  sagaType: string;
  state: any;
  
  handle(event: DomainEvent): Promise<Command[]>;
  isComplete(): boolean;
}

// Event store interface
export interface EventStore {
  appendToStream(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void>;
  readStreamEvents(streamId: string, fromVersion?: number, toVersion?: number): Promise<DomainEvent[]>;
  readAggregateEvents(aggregateId: string, aggregateType: string, fromVersion?: number): Promise<DomainEvent[]>;
  getSnapshot(streamId: string): Promise<Snapshot | null>;
  saveSnapshot(snapshot: Snapshot): Promise<void>;
  getAllStreams(): Promise<EventStream[]>;
  replayEvents(fromTimestamp: Date, toTimestamp?: Date, eventTypes?: string[]): Promise<AsyncIterableIterator<DomainEvent>>;
}

// Read model interface
export interface ReadModel {
  modelName: string;
  rebuild(): Promise<void>;
  query(params: any): Promise<any>;
}

// Process manager interface
export interface ProcessManager {
  processId: string;
  processType: string;
  state: any;
  
  handle(event: DomainEvent): Promise<Command[]>;
  isComplete(): boolean;
}

// Healthcare-specific event types
export enum HealthcareEventType {
  // Patient events
  PATIENT_REGISTERED = 'PatientRegistered',
  PATIENT_UPDATED = 'PatientUpdated',
  PATIENT_MERGED = 'PatientMerged',
  PATIENT_DECEASED = 'PatientDeceased',
  
  // Clinical events
  CLINICAL_NOTE_CREATED = 'ClinicalNoteCreated',
  CLINICAL_NOTE_UPDATED = 'ClinicalNoteUpdated',
  CLINICAL_NOTE_FINALIZED = 'ClinicalNoteFinalized',
  CLINICAL_NOTE_ADDENDED = 'ClinicalNoteAddended',
  
  // Prescription events
  PRESCRIPTION_CREATED = 'PrescriptionCreated',
  PRESCRIPTION_DISPENSED = 'PrescriptionDispensed',
  PRESCRIPTION_REFILLED = 'PrescriptionRefilled',
  PRESCRIPTION_CANCELLED = 'PrescriptionCancelled',
  
  // Order events
  LAB_ORDER_CREATED = 'LabOrderCreated',
  LAB_ORDER_RESULTED = 'LabOrderResulted',
  LAB_ORDER_CANCELLED = 'LabOrderCancelled',
  IMAGING_ORDER_CREATED = 'ImagingOrderCreated',
  IMAGING_ORDER_COMPLETED = 'ImagingOrderCompleted',
  
  // Appointment events
  APPOINTMENT_SCHEDULED = 'AppointmentScheduled',
  APPOINTMENT_RESCHEDULED = 'AppointmentRescheduled',
  APPOINTMENT_CANCELLED = 'AppointmentCancelled',
  APPOINTMENT_CHECKED_IN = 'AppointmentCheckedIn',
  APPOINTMENT_COMPLETED = 'AppointmentCompleted',
  
  // Medication events
  MEDICATION_ADMINISTERED = 'MedicationAdministered',
  MEDICATION_REFUSED = 'MedicationRefused',
  MEDICATION_ALLERGY_ADDED = 'MedicationAllergyAdded',
  
  // Vital signs events
  VITAL_SIGNS_RECORDED = 'VitalSignsRecorded',
  VITAL_SIGNS_CORRECTED = 'VitalSignsCorrected',
  
  // Access control events
  PATIENT_ACCESS_GRANTED = 'PatientAccessGranted',
  PATIENT_ACCESS_REVOKED = 'PatientAccessRevoked',
  EMERGENCY_ACCESS_ACTIVATED = 'EmergencyAccessActivated',
  
  // Billing events
  CLAIM_SUBMITTED = 'ClaimSubmitted',
  CLAIM_APPROVED = 'ClaimApproved',
  CLAIM_DENIED = 'ClaimDenied',
  PAYMENT_RECEIVED = 'PaymentReceived',
  
  // Compliance events
  CONSENT_GIVEN = 'ConsentGiven',
  CONSENT_WITHDRAWN = 'ConsentWithdrawn',
  HIPAA_DISCLOSURE_LOGGED = 'HIPAADisclosureLogged',
  AUDIT_EVENT_LOGGED = 'AuditEventLogged'
}

// Healthcare command types
export enum HealthcareCommandType {
  // Patient commands
  REGISTER_PATIENT = 'RegisterPatient',
  UPDATE_PATIENT = 'UpdatePatient',
  MERGE_PATIENTS = 'MergePatients',
  
  // Clinical commands
  CREATE_CLINICAL_NOTE = 'CreateClinicalNote',
  UPDATE_CLINICAL_NOTE = 'UpdateClinicalNote',
  FINALIZE_CLINICAL_NOTE = 'FinalizeClinicalNote',
  ADDEND_CLINICAL_NOTE = 'AddendClinicalNote',
  
  // Prescription commands
  CREATE_PRESCRIPTION = 'CreatePrescription',
  DISPENSE_PRESCRIPTION = 'DispensePrescription',
  REFILL_PRESCRIPTION = 'RefillPrescription',
  CANCEL_PRESCRIPTION = 'CancelPrescription',
  
  // Order commands
  CREATE_LAB_ORDER = 'CreateLabOrder',
  RESULT_LAB_ORDER = 'ResultLabOrder',
  CREATE_IMAGING_ORDER = 'CreateImagingOrder',
  COMPLETE_IMAGING_ORDER = 'CompleteImagingOrder',
  
  // Appointment commands
  SCHEDULE_APPOINTMENT = 'ScheduleAppointment',
  RESCHEDULE_APPOINTMENT = 'RescheduleAppointment',
  CANCEL_APPOINTMENT = 'CancelAppointment',
  CHECK_IN_APPOINTMENT = 'CheckInAppointment',
  COMPLETE_APPOINTMENT = 'CompleteAppointment',
  
  // Medication commands
  ADMINISTER_MEDICATION = 'AdministerMedication',
  RECORD_MEDICATION_REFUSAL = 'RecordMedicationRefusal',
  ADD_MEDICATION_ALLERGY = 'AddMedicationAllergy',
  
  // Vital signs commands
  RECORD_VITAL_SIGNS = 'RecordVitalSigns',
  CORRECT_VITAL_SIGNS = 'CorrectVitalSigns',
  
  // Access control commands
  GRANT_PATIENT_ACCESS = 'GrantPatientAccess',
  REVOKE_PATIENT_ACCESS = 'RevokePatientAccess',
  ACTIVATE_EMERGENCY_ACCESS = 'ActivateEmergencyAccess'
}

// Event sourcing error types
export class EventSourcingError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'EventSourcingError';
  }
}

export class ConcurrencyError extends EventSourcingError {
  constructor(message: string, public expectedVersion: number, public actualVersion: number) {
    super(message, 'CONCURRENCY_ERROR', { expectedVersion, actualVersion });
    this.name = 'ConcurrencyError';
  }
}

export class AggregateNotFoundError extends EventSourcingError {
  constructor(aggregateType: string, aggregateId: string) {
    super(`Aggregate ${aggregateType} with id ${aggregateId} not found`, 'AGGREGATE_NOT_FOUND', { aggregateType, aggregateId });
    this.name = 'AggregateNotFoundError';
  }
}