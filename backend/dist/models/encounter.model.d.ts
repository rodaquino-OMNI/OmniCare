import { FHIRResource, Identifier, Reference, CodeableConcept, Period, Quantity } from './base.model';
export interface OmniCareEncounter extends FHIRResource {
    resourceType: 'Encounter';
    identifier?: Identifier[];
    status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
    statusHistory?: EncounterStatusHistory[];
    class: CodeableConcept;
    classHistory?: EncounterClassHistory[];
    type?: CodeableConcept[];
    serviceType?: CodeableConcept;
    priority?: CodeableConcept;
    subject?: Reference;
    episodeOfCare?: Reference[];
    basedOn?: Reference[];
    participant?: EncounterParticipant[];
    appointment?: Reference[];
    period?: Period;
    length?: Quantity;
    reasonCode?: CodeableConcept[];
    reasonReference?: Reference[];
    diagnosis?: EncounterDiagnosis[];
    account?: Reference[];
    hospitalization?: EncounterHospitalization;
    location?: EncounterLocation[];
    serviceProvider?: Reference;
    partOf?: Reference;
    omnicareEncounterId?: string;
    scheduledDateTime?: string;
    estimatedDuration?: number;
    actualDuration?: number;
    checkInTime?: string;
    checkOutTime?: string;
    waitTime?: number;
    encounterType?: EncounterType;
    visitReason?: string;
    chiefComplaint?: string;
    notes?: EncounterNote[];
    followUpRequired?: boolean;
    followUpInstructions?: string;
    patientSatisfactionScore?: number;
    billingInfo?: EncounterBilling;
    qualityMetrics?: EncounterQualityMetrics;
}
export interface EncounterStatusHistory {
    status: string;
    period: Period;
}
export interface EncounterClassHistory {
    class: CodeableConcept;
    period: Period;
}
export interface EncounterParticipant {
    type?: CodeableConcept[];
    period?: Period;
    individual?: Reference;
}
export interface EncounterDiagnosis {
    condition: Reference;
    use?: CodeableConcept;
    rank?: number;
}
export interface EncounterHospitalization {
    preAdmissionIdentifier?: Identifier;
    origin?: Reference;
    admitSource?: CodeableConcept;
    reAdmission?: CodeableConcept;
    dietPreference?: CodeableConcept[];
    specialCourtesy?: CodeableConcept[];
    specialArrangement?: CodeableConcept[];
    destination?: Reference;
    dischargeDisposition?: CodeableConcept;
}
export interface EncounterLocation {
    location: Reference;
    status?: 'planned' | 'active' | 'reserved' | 'completed';
    physicalType?: CodeableConcept;
    period?: Period;
}
export interface EncounterType {
    category: 'inpatient' | 'outpatient' | 'emergency' | 'home-health' | 'virtual' | 'short-stay' | 'observation';
    visitType: 'routine' | 'urgent' | 'walk-in' | 'scheduled' | 'emergency' | 'follow-up' | 'consultation';
    specialty?: string;
    isTelemedicine?: boolean;
}
export interface EncounterNote {
    id?: string;
    type: 'chief-complaint' | 'history-present-illness' | 'assessment' | 'plan' | 'instructions' | 'general';
    author: Reference;
    timestamp: string;
    content: string;
    confidential?: boolean;
}
export interface EncounterBilling {
    primaryInsurance?: Reference;
    secondaryInsurance?: Reference;
    copayAmount?: number;
    copayCollected?: boolean;
    eligibilityVerified?: boolean;
    authorizationRequired?: boolean;
    authorizationNumber?: string;
    estimatedCost?: number;
    actualCost?: number;
    billingCodes?: BillingCode[];
}
export interface BillingCode {
    type: 'cpt' | 'icd-10' | 'hcpcs' | 'drg';
    code: string;
    description: string;
    modifier?: string;
    units?: number;
    amount?: number;
}
export interface EncounterQualityMetrics {
    doorToDoctorTime?: number;
    totalEncounterTime?: number;
    treatmentDelays?: string[];
    protocolsFollowed?: string[];
    safetyChecksCompleted?: boolean;
    medicationReconciliationCompleted?: boolean;
    patientEducationProvided?: boolean;
}
export interface OmniCareAppointment extends FHIRResource {
    resourceType: 'Appointment';
    identifier?: Identifier[];
    status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'entered-in-error' | 'checked-in' | 'waitlist';
    cancelationReason?: CodeableConcept;
    serviceCategory?: CodeableConcept[];
    serviceType?: CodeableConcept[];
    specialty?: CodeableConcept[];
    appointmentType?: CodeableConcept;
    reasonCode?: CodeableConcept[];
    reasonReference?: Reference[];
    priority?: number;
    description?: string;
    supportingInformation?: Reference[];
    start?: string;
    end?: string;
    minutesDuration?: number;
    slot?: Reference[];
    created?: string;
    comment?: string;
    patientInstruction?: string;
    basedOn?: Reference[];
    participant: AppointmentParticipant[];
    requestedPeriod?: Period[];
    omnicareAppointmentId?: string;
    appointmentSource?: 'online' | 'phone' | 'walk-in' | 'referral' | 'system';
    confirmationStatus?: 'confirmed' | 'unconfirmed' | 'cancelled-by-patient' | 'cancelled-by-provider';
    remindersSent?: AppointmentReminder[];
    waitlistPosition?: number;
    estimatedWaitTime?: number;
    checkInInstructions?: string;
    preVisitForms?: Reference[];
    insuranceVerification?: {
        verified: boolean;
        verifiedDate?: string;
        eligibleForServices: boolean;
        copayAmount?: number;
        authorizationRequired?: boolean;
        notes?: string;
    };
    telemedicineInfo?: TelemedicineInfo;
}
export interface AppointmentParticipant {
    type?: CodeableConcept[];
    actor?: Reference;
    required?: 'required' | 'optional' | 'information-only';
    status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
    period?: Period;
}
export interface AppointmentReminder {
    type: 'email' | 'sms' | 'phone' | 'app-notification';
    sentDate: string;
    status: 'sent' | 'delivered' | 'failed' | 'opened' | 'responded';
    scheduledFor: string;
}
export interface TelemedicineInfo {
    platform: string;
    meetingUrl?: string;
    meetingId?: string;
    accessCode?: string;
    requiresApp?: boolean;
    technicalRequirements?: string[];
    troubleshootingContact?: string;
}
export interface EncounterSearchParams {
    _id?: string;
    patient?: string;
    subject?: string;
    status?: string;
    class?: string;
    type?: string;
    date?: string;
    practitioner?: string;
    location?: string;
    identifier?: string;
    'service-provider'?: string;
    'part-of'?: string;
    appointment?: string;
    'omnicare-id'?: string;
    'encounter-type'?: string;
    'visit-reason'?: string;
    'check-in-date'?: string;
    'provider-specialty'?: string;
    _count?: number;
    _offset?: number;
    _sort?: string;
    _include?: string[];
    _revinclude?: string[];
}
export interface AppointmentSearchParams {
    _id?: string;
    patient?: string;
    practitioner?: string;
    location?: string;
    status?: string;
    date?: string;
    'service-type'?: string;
    specialty?: string;
    'appointment-type'?: string;
    identifier?: string;
    'omnicare-id'?: string;
    'appointment-source'?: string;
    'confirmation-status'?: string;
    'upcoming'?: boolean;
    'date-range'?: string;
    _count?: number;
    _offset?: number;
    _sort?: string;
    _include?: string[];
    _revinclude?: string[];
}
export interface AppointmentSchedulingRequest {
    patient: Reference;
    practitioner?: Reference;
    serviceType: CodeableConcept;
    appointmentType?: CodeableConcept;
    preferredDates: string[];
    preferredTimes: string[];
    duration: number;
    reason: string;
    priority: 'routine' | 'urgent' | 'emergency';
    isTelemedicine?: boolean;
    notes?: string;
    insurance?: {
        primary: Reference;
        secondary?: Reference;
    };
}
export interface EncounterStatistics {
    totalEncounters: number;
    encountersByStatus: Record<string, number>;
    averageWaitTime: number;
    averageEncounterDuration: number;
    patientSatisfactionAverage: number;
    noShowRate: number;
    cancellationRate: number;
    topVisitReasons: Array<{
        reason: string;
        count: number;
    }>;
    encountersByProvider: Array<{
        provider: string;
        count: number;
        averageDuration: number;
    }>;
}
//# sourceMappingURL=encounter.model.d.ts.map