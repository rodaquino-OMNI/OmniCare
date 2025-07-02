/**
 * OmniCare EMR - Healthcare Domain Events
 * HIPAA-compliant domain events for critical healthcare operations
 */

import { DomainEvent, EventMetadata, HealthcareEventType } from '../types/event-sourcing.types';

// Base healthcare event
export abstract class HealthcareDomainEvent implements DomainEvent {
  public eventId: string;
  public eventType: string;
  public aggregateId: string;
  public aggregateType: string;
  public data: any;
  public metadata?: EventMetadata;
  public version?: number;
  public timestamp: Date;

  constructor(
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    data: any,
    metadata?: EventMetadata
  ) {
    this.eventId = require('uuid').v4();
    this.eventType = eventType;
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
    this.data = data;
    this.metadata = metadata;
    this.timestamp = new Date();
  }
}

// Patient Events
export class PatientRegisteredEvent extends HealthcareDomainEvent {
  constructor(
    patientId: string,
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
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.PATIENT_REGISTERED, patientId, 'Patient', data, metadata);
  }
}

export class PatientUpdatedEvent extends HealthcareDomainEvent {
  constructor(
    patientId: string,
    data: {
      changedFields: string[];
      previousValues: Record<string, any>;
      newValues: Record<string, any>;
      reason?: string;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.PATIENT_UPDATED, patientId, 'Patient', data, metadata);
  }
}

export class PatientMergedEvent extends HealthcareDomainEvent {
  constructor(
    targetPatientId: string,
    data: {
      sourcePatientId: string;
      mergedData: Record<string, any>;
      duplicateRecords: string[];
      approvedBy: string;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.PATIENT_MERGED, targetPatientId, 'Patient', data, metadata);
  }
}

// Clinical Note Events
export class ClinicalNoteCreatedEvent extends HealthcareDomainEvent {
  constructor(
    noteId: string,
    data: {
      patientId: string;
      providerId: string;
      encounterId?: string;
      noteType: string;
      content: string;
      templateId?: string;
      isDraft: boolean;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.CLINICAL_NOTE_CREATED, noteId, 'ClinicalNote', data, metadata);
  }
}

export class ClinicalNoteUpdatedEvent extends HealthcareDomainEvent {
  constructor(
    noteId: string,
    data: {
      previousContent: string;
      newContent: string;
      reason: string;
      isAddendum: boolean;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.CLINICAL_NOTE_UPDATED, noteId, 'ClinicalNote', data, metadata);
  }
}

export class ClinicalNoteFinalizedEvent extends HealthcareDomainEvent {
  constructor(
    noteId: string,
    data: {
      finalizedBy: string;
      finalizedAt: Date;
      electronicSignature: string;
      reviewers?: string[];
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.CLINICAL_NOTE_FINALIZED, noteId, 'ClinicalNote', data, metadata);
  }
}

// Prescription Events
export class PrescriptionCreatedEvent extends HealthcareDomainEvent {
  constructor(
    prescriptionId: string,
    data: {
      patientId: string;
      providerId: string;
      medicationCode: string;
      medicationName: string;
      dosage: string;
      quantity: number;
      refills: number;
      instructions: string;
      priority: 'routine' | 'urgent' | 'stat';
      allergyChecked: boolean;
      drugInteractionChecked: boolean;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.PRESCRIPTION_CREATED, prescriptionId, 'Prescription', data, metadata);
  }
}

export class PrescriptionDispensedEvent extends HealthcareDomainEvent {
  constructor(
    prescriptionId: string,
    data: {
      pharmacyId: string;
      pharmacistId: string;
      dispensedQuantity: number;
      dispensedDate: Date;
      lotNumber?: string;
      expirationDate?: Date;
      ndc?: string;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.PRESCRIPTION_DISPENSED, prescriptionId, 'Prescription', data, metadata);
  }
}

// Lab Order Events
export class LabOrderCreatedEvent extends HealthcareDomainEvent {
  constructor(
    orderId: string,
    data: {
      patientId: string;
      providerId: string;
      labTests: Array<{
        testCode: string;
        testName: string;
        priority: 'routine' | 'urgent' | 'stat';
        specimenType: string;
      }>;
      clinicalIndication: string;
      orderDate: Date;
      collectionInstructions?: string;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.LAB_ORDER_CREATED, orderId, 'LabOrder', data, metadata);
  }
}

export class LabOrderResultedEvent extends HealthcareDomainEvent {
  constructor(
    orderId: string,
    data: {
      results: Array<{
        testCode: string;
        value: string;
        unit: string;
        referenceRange: string;
        abnormalFlag?: string;
        criticalFlag?: boolean;
      }>;
      performedBy: string;
      verifiedBy: string;
      resultDate: Date;
      specimenCollectionDate: Date;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.LAB_ORDER_RESULTED, orderId, 'LabOrder', data, metadata);
  }
}

// Appointment Events
export class AppointmentScheduledEvent extends HealthcareDomainEvent {
  constructor(
    appointmentId: string,
    data: {
      patientId: string;
      providerId: string;
      appointmentType: string;
      scheduledDate: Date;
      duration: number;
      location: string;
      reason: string;
      status: 'scheduled';
      scheduledBy: string;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.APPOINTMENT_SCHEDULED, appointmentId, 'Appointment', data, metadata);
  }
}

export class AppointmentCheckedInEvent extends HealthcareDomainEvent {
  constructor(
    appointmentId: string,
    data: {
      checkedInAt: Date;
      checkedInBy: string;
      arrivalTime: Date;
      insuranceVerified: boolean;
      copayCollected?: number;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.APPOINTMENT_CHECKED_IN, appointmentId, 'Appointment', data, metadata);
  }
}

// Medication Administration Events
export class MedicationAdministeredEvent extends HealthcareDomainEvent {
  constructor(
    administrationId: string,
    data: {
      patientId: string;
      medicationId: string;
      dosage: string;
      route: string;
      administeredBy: string;
      administeredAt: Date;
      witnessedBy?: string;
      site?: string;
      reaction?: string;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.MEDICATION_ADMINISTERED, administrationId, 'MedicationAdministration', data, metadata);
  }
}

export class MedicationRefusedEvent extends HealthcareDomainEvent {
  constructor(
    refusalId: string,
    data: {
      patientId: string;
      medicationId: string;
      scheduledTime: Date;
      refusedAt: Date;
      reason: string;
      documentedBy: string;
      patientEducationProvided: boolean;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.MEDICATION_REFUSED, refusalId, 'MedicationAdministration', data, metadata);
  }
}

// Vital Signs Events
export class VitalSignsRecordedEvent extends HealthcareDomainEvent {
  constructor(
    vitalSignsId: string,
    data: {
      patientId: string;
      encounterId?: string;
      measurements: {
        temperature?: { value: number; unit: string; site: string };
        bloodPressure?: { systolic: number; diastolic: number; unit: string; position: string };
        heartRate?: { value: number; unit: string; rhythm: string };
        respiratoryRate?: { value: number; unit: string };
        oxygenSaturation?: { value: number; unit: string; supplementalOxygen: boolean };
        height?: { value: number; unit: string };
        weight?: { value: number; unit: string };
        bmi?: { value: number; unit: string };
        painLevel?: { value: number; scale: string };
      };
      recordedBy: string;
      recordedAt: Date;
      method: 'manual' | 'device';
      deviceId?: string;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.VITAL_SIGNS_RECORDED, vitalSignsId, 'VitalSigns', data, metadata);
  }
}

// Access Control Events
export class PatientAccessGrantedEvent extends HealthcareDomainEvent {
  constructor(
    accessId: string,
    data: {
      patientId: string;
      userId: string;
      accessType: 'normal' | 'emergency' | 'break_glass';
      grantedBy: string;
      reason: string;
      permissions: string[];
      expiresAt?: Date;
      auditNote?: string;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.PATIENT_ACCESS_GRANTED, accessId, 'PatientAccess', data, metadata);
  }
}

export class EmergencyAccessActivatedEvent extends HealthcareDomainEvent {
  constructor(
    accessId: string,
    data: {
      patientId: string;
      userId: string;
      emergencyType: 'cardiac_arrest' | 'trauma' | 'respiratory_failure' | 'other';
      justification: string;
      witnessedBy?: string;
      activatedAt: Date;
      duration: number; // minutes
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.EMERGENCY_ACCESS_ACTIVATED, accessId, 'PatientAccess', data, metadata);
  }
}

// Compliance Events
export class ConsentGivenEvent extends HealthcareDomainEvent {
  constructor(
    consentId: string,
    data: {
      patientId: string;
      consentType: 'treatment' | 'research' | 'disclosure' | 'marketing';
      consentForm: string;
      givenBy: string; // patient or authorized representative
      witnessedBy: string;
      effectiveDate: Date;
      expirationDate?: Date;
      digitalSignature?: string;
      ipAddress?: string;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.CONSENT_GIVEN, consentId, 'Consent', data, metadata);
  }
}

export class HIPAADisclosureLoggedEvent extends HealthcareDomainEvent {
  constructor(
    disclosureId: string,
    data: {
      patientId: string;
      disclosedTo: string;
      disclosedBy: string;
      purpose: string;
      informationDisclosed: string[];
      disclosureDate: Date;
      minimumNecessary: boolean;
      authorizationRequired: boolean;
      authorizationId?: string;
      recipientType: 'provider' | 'payer' | 'researcher' | 'legal' | 'patient' | 'other';
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.HIPAA_DISCLOSURE_LOGGED, disclosureId, 'HIPAADisclosure', data, metadata);
  }
}

// Billing Events
export class ClaimSubmittedEvent extends HealthcareDomainEvent {
  constructor(
    claimId: string,
    data: {
      patientId: string;
      encounterId: string;
      payerId: string;
      claimNumber: string;
      totalAmount: number;
      submittedDate: Date;
      submittedBy: string;
      procedures: Array<{
        code: string;
        description: string;
        amount: number;
        units: number;
      }>;
      diagnoses: Array<{
        code: string;
        description: string;
        primary: boolean;
      }>;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.CLAIM_SUBMITTED, claimId, 'Claim', data, metadata);
  }
}

export class PaymentReceivedEvent extends HealthcareDomainEvent {
  constructor(
    paymentId: string,
    data: {
      claimId: string;
      patientId: string;
      payerId: string;
      amount: number;
      paymentDate: Date;
      paymentMethod: 'electronic' | 'check' | 'cash' | 'credit_card';
      remittanceAdvice?: string;
      adjustments?: Array<{
        reason: string;
        amount: number;
      }>;
    },
    metadata?: EventMetadata
  ) {
    super(HealthcareEventType.PAYMENT_RECEIVED, paymentId, 'Payment', data, metadata);
  }
}

// Factory function to create events with proper metadata
export function createHealthcareEvent<T extends HealthcareDomainEvent>(
  EventClass: new (...args: any[]) => T,
  ...args: any[]
): T {
  const event = new EventClass(...args);
  
  // Ensure proper HIPAA-compliant metadata
  if (event.metadata) {
    event.metadata.hipaaCompliant = true;
    event.metadata.dataClassification = 'PHI';
    event.metadata.retentionPeriod = '7_years';
  }
  
  return event;
}