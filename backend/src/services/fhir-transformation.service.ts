import {
  Patient,
  Encounter,
  Bundle,
  HumanName,
  ContactPoint,
  Address,
  Identifier,
  CodeableConcept,
  Quantity,
  Period,
  Reference,
  Extension,
  Annotation,
  Observation
} from '@medplum/fhirtypes';

import { 
  OmniCarePatient, 
  OmniCareEncounter, 
  OmniCareObservation 
} from '@/types/fhir';
import logger from '@/utils/logger';

// Input types for transformation
interface PatientInput {
  id?: string;
  active?: boolean;
  names?: any[];
  name?: any[];
  identifiers?: any[];
  identifier?: any[];
  mrn?: string;
  gender?: string;
  birthDate?: string;
  dateOfBirth?: string;
  deceased?: boolean;
  dateOfDeath?: string;
  contacts?: any[];
  telecom?: any[];
  addresses?: any[];
  address?: any[];
  maritalStatus?: any;
  photo?: any;
  language?: any[];
  languages?: any[];
  emergencyContact?: any;
  emergencyContacts?: any[];
  insuranceInformation?: any;
  insurance?: any;
  insuranceStatus?: any;
  registrationDate?: string;
  preferredLanguage?: string;
  omnicarePatientId?: string;
  omnicareId?: string;
  multipleBirth?: any;
  birthOrder?: number;
  primaryCareProviders?: any[];
  managingOrganization?: any;
  linkedPatients?: any[];
  portalAccess?: any;
}

interface EncounterInput {
  id?: string;
  status?: string;
  class?: any;
  type?: any[];
  subject?: any;
  participant?: any[];
  participants?: any[];
  period?: any;
  reasonCode?: any[];
  reasonCodes?: any[];
  diagnosis?: any[];
  diagnoses?: any[];
  hospitalization?: any;
  location?: any[];
  locations?: any[];
  serviceProvider?: any;
  serviceProviderId?: string;
  identifiers?: any[];
  encounterId?: string;
  encounterTypes?: any[];
  serviceType?: any;
  priority?: any;
  patientId?: string;
  episodeOfCare?: any[];
  referrals?: any[];
  appointmentId?: string;
  startTime?: string;
  endTime?: string;
  duration?: any;
  reasonReferences?: any[];
  accountId?: string;
  parentEncounterId?: string;
  appointmentType?: string;
  chiefComplaint?: string;
  visitSummary?: string;
  followUpInstructions?: string;
  omnicareId?: string;
  billingNotes?: string;
}

interface ObservationInput {
  id?: string;
  status?: string;
  category?: any[];
  categories?: any[];
  code?: any;
  subject?: any;
  encounter?: any;
  encounterId?: string;
  effectiveDateTime?: string;
  effectiveTime?: string;
  effectivePeriod?: any;
  observationTime?: string;
  issued?: string;
  issuedTime?: string;
  performer?: any[];
  performers?: any[];
  value?: any;
  valueQuantity?: any;
  valueCodeableConcept?: any;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: any;
  valueRatio?: any;
  valueSampledData?: any;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: any;
  interpretation?: any[];
  note?: any[];
  notes?: any[];
  method?: any;
  specimen?: any;
  specimenId?: string;
  device?: any;
  deviceId?: string;
  referenceRange?: any[];
  referenceRanges?: any[];
  component?: any[];
  components?: any[];
  identifiers?: any[];
  observationId?: string;
  orderIds?: string[];
  partOfIds?: string[];
  patientId?: string;
  focusIds?: string[];
  dataAbsentReason?: any;
  bodySite?: any;
  memberIds?: string[];
  derivedFromIds?: string[];
  deviceUsed?: string;
  qualityFlags?: string[];
  abnormalFlags?: string[];
  criticalAlerts?: boolean;
  omnicareId?: string;
}

/**
 * FHIR Data Transformation Service
 * Handles transformation between OmniCare internal formats and FHIR R4 resources
 * Ensures compliance with FHIR R4 specifications while maintaining OmniCare-specific extensions
 */
export class FHIRTransformationService {

  // ===============================
  // PATIENT TRANSFORMATIONS
  // ===============================

  /**
   * Transform OmniCare patient data to FHIR Patient resource
   */
  transformToFHIRPatient(omnicarePatient: PatientInput): OmniCarePatient {
    try {
      const patient: OmniCarePatient = {
        resourceType: 'Patient',
        id: omnicarePatient.id || undefined,
        meta: {
          profile: ['http://omnicare.com/fhir/StructureDefinition/OmniCarePatient'],
          lastUpdated: new Date().toISOString(),
          versionId: '1',
          source: 'OmniCare EMR System'
        },
        active: omnicarePatient.active !== false,
        
        // Transform names
        name: this.transformNames(omnicarePatient.names || omnicarePatient.name || []),
        
        // Transform identifiers
        identifier: this.transformIdentifiers(omnicarePatient.identifiers || omnicarePatient.identifier || [], omnicarePatient.mrn),
        
        // Basic demographics
        gender: omnicarePatient.gender ? this.transformGender(omnicarePatient.gender) : undefined,
        birthDate: (omnicarePatient.birthDate || omnicarePatient.dateOfBirth) ? this.transformDate((omnicarePatient.birthDate || omnicarePatient.dateOfBirth)!) : undefined,
        deceasedBoolean: omnicarePatient.deceased || false,
        deceasedDateTime: omnicarePatient.dateOfDeath ? this.transformDateTime(omnicarePatient.dateOfDeath) : undefined,
        
        // Contact information
        telecom: this.transformTelecom(omnicarePatient.contacts || omnicarePatient.telecom || []),
        address: this.transformAddresses(omnicarePatient.addresses || omnicarePatient.address || []),
        
        // Marital status
        maritalStatus: omnicarePatient.maritalStatus ? this.transformCodeableConcept(omnicarePatient.maritalStatus) : undefined,
        
        // Multiple birth
        multipleBirthBoolean: omnicarePatient.multipleBirth || false,
        multipleBirthInteger: omnicarePatient.birthOrder || undefined,
        
        // Photo
        photo: omnicarePatient.photo ? [{ contentType: 'image/jpeg', data: omnicarePatient.photo }] : undefined,
        
        // Emergency contacts
        contact: this.transformEmergencyContacts(omnicarePatient.emergencyContacts || []),
        
        // Communication preferences
        communication: this.transformCommunication(omnicarePatient.languages || []),
        
        // Care providers
        generalPractitioner: this.transformPractitionerReferences(omnicarePatient.primaryCareProviders || []) as any,
        managingOrganization: omnicarePatient.managingOrganization ? { reference: `Organization/${omnicarePatient.managingOrganization}` } : undefined,
        
        // Links to other patients
        link: omnicarePatient.linkedPatients ? this.transformPatientLinks(omnicarePatient.linkedPatients) : undefined,

        // OmniCare-specific extensions
        extension: [
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/registration-date',
            valueDateTime: omnicarePatient.registrationDate || new Date().toISOString()
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/preferred-language',
            valueString: omnicarePatient.preferredLanguage || 'en'
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/patient-portal-access',
            valueBoolean: omnicarePatient.portalAccess || false
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/insurance-verification-status',
            valueString: omnicarePatient.insuranceStatus || 'pending'
          }
        ].filter(ext => ext.valueDateTime || ext.valueString || ext.valueBoolean !== undefined),

        // Set OmniCare-specific properties
        omnicarePatientId: omnicarePatient.omnicareId || omnicarePatient.id,
        registrationDate: omnicarePatient.registrationDate,
        preferredLanguage: omnicarePatient.preferredLanguage,
        emergencyContact: omnicarePatient.emergencyContact,
        insuranceInformation: omnicarePatient.insurance
      };

      logger.debug('Transformed OmniCare patient to FHIR', { patientId: patient.id });
      return patient;
    } catch (error) {
      logger.error('Failed to transform patient to FHIR:', error);
      throw new Error(`Patient transformation failed: ${String(error)}`);
    }
  }

  /**
   * Transform FHIR Patient resource to OmniCare format
   */
  transformFromFHIRPatient(fhirPatient: Patient): any {
    try {
      const omnicarePatient = {
        id: fhirPatient.id,
        mrn: this.extractMRN(fhirPatient.identifier || []),
        active: fhirPatient.active !== false,
        
        // Extract name information
        firstName: fhirPatient.name?.[0]?.given?.[0] || '',
        middleName: fhirPatient.name?.[0]?.given?.[1] || '',
        lastName: fhirPatient.name?.[0]?.family || '',
        preferredName: fhirPatient.name?.find(n => n.use === 'nickname')?.given?.[0] || '',
        
        // Demographics
        gender: fhirPatient.gender,
        dateOfBirth: fhirPatient.birthDate,
        deceased: fhirPatient.deceasedBoolean || false,
        dateOfDeath: fhirPatient.deceasedDateTime,
        
        // Contact information
        phoneNumbers: this.extractPhoneNumbers(fhirPatient.telecom || []),
        emailAddresses: this.extractEmailAddresses(fhirPatient.telecom || []),
        addresses: this.extractAddresses(fhirPatient.address || []),
        
        // Additional information
        maritalStatus: fhirPatient.maritalStatus?.coding?.[0]?.code,
        emergencyContacts: this.extractEmergencyContacts(fhirPatient.contact || []),
        languages: this.extractLanguages(fhirPatient.communication || []),
        
        // OmniCare-specific fields
        omnicareId: this.extractExtensionValue(fhirPatient.extension, 'http://omnicare.com/fhir/StructureDefinition/omnicare-patient-id'),
        registrationDate: this.extractExtensionValue(fhirPatient.extension, 'http://omnicare.com/fhir/StructureDefinition/registration-date'),
        preferredLanguage: this.extractExtensionValue(fhirPatient.extension, 'http://omnicare.com/fhir/StructureDefinition/preferred-language'),
        portalAccess: this.extractExtensionValue(fhirPatient.extension, 'http://omnicare.com/fhir/StructureDefinition/patient-portal-access'),
        insuranceStatus: this.extractExtensionValue(fhirPatient.extension, 'http://omnicare.com/fhir/StructureDefinition/insurance-verification-status'),
        
        // Metadata
        lastUpdated: fhirPatient.meta?.lastUpdated,
        version: fhirPatient.meta?.versionId
      };

      logger.debug('Transformed FHIR patient to OmniCare format', { patientId: omnicarePatient.id });
      return omnicarePatient;
    } catch (error) {
      logger.error('Failed to transform FHIR patient to OmniCare format:', error);
      throw new Error(`Patient transformation failed: ${String(error)}`);
    }
  }

  // ===============================
  // ENCOUNTER TRANSFORMATIONS
  // ===============================

  /**
   * Transform OmniCare encounter data to FHIR Encounter resource
   */
  transformToFHIREncounter(omnicareEncounter: EncounterInput): OmniCareEncounter {
    try {
      const encounter: OmniCareEncounter = {
        resourceType: 'Encounter',
        id: omnicareEncounter.id || undefined,
        meta: {
          profile: ['http://omnicare.com/fhir/StructureDefinition/OmniCareEncounter'],
          lastUpdated: new Date().toISOString(),
          versionId: '1',
          source: 'OmniCare EMR System'
        },
        
        // Identifiers
        identifier: this.transformIdentifiers(omnicareEncounter.identifiers || [], omnicareEncounter.encounterId),
        
        // Status and class
        status: this.mapEncounterStatus(omnicareEncounter.status),
        class: this.transformEncounterClass(omnicareEncounter.type || omnicareEncounter.class),
        
        // Type
        type: omnicareEncounter.encounterTypes ? omnicareEncounter.encounterTypes.map((type: any) => this.transformCodeableConcept(type)) : undefined,
        
        // Service type
        serviceType: omnicareEncounter.serviceType ? this.transformCodeableConcept(omnicareEncounter.serviceType) : undefined,
        
        // Priority
        priority: omnicareEncounter.priority ? this.transformCodeableConcept(omnicareEncounter.priority) : undefined,
        
        // Patient reference
        subject: { reference: `Patient/${omnicareEncounter.patientId}` },
        
        // Episode of care
        episodeOfCare: omnicareEncounter.episodeOfCare ? [{ reference: `EpisodeOfCare/${omnicareEncounter.episodeOfCare}` }] : undefined,
        
        // Incoming referral
        basedOn: omnicareEncounter.referrals ? omnicareEncounter.referrals.map((ref: string) => ({ reference: `ServiceRequest/${ref}` })) : undefined,
        
        // Participants (providers, interpreters, etc.)
        participant: this.transformEncounterParticipants(omnicareEncounter.participants || []),
        
        // Appointment
        appointment: omnicareEncounter.appointmentId ? [{ reference: `Appointment/${omnicareEncounter.appointmentId}` }] : undefined,
        
        // Period
        period: this.transformPeriod(omnicareEncounter.startTime, omnicareEncounter.endTime),
        
        // Length
        length: omnicareEncounter.duration ? { value: omnicareEncounter.duration, unit: 'min', system: 'http://unitsofmeasure.org', code: 'min' } : undefined,
        
        // Reason
        reasonCode: omnicareEncounter.reasonCodes ? omnicareEncounter.reasonCodes.map((code: any) => this.transformCodeableConcept(code)) : undefined,
        reasonReference: omnicareEncounter.reasonReferences ? omnicareEncounter.reasonReferences.map((ref: string) => ({ reference: ref })) : undefined,
        
        // Diagnosis
        diagnosis: this.transformEncounterDiagnoses(omnicareEncounter.diagnoses || []),
        
        // Account
        account: omnicareEncounter.accountId ? [{ reference: `Account/${omnicareEncounter.accountId}` }] : undefined,
        
        // Hospitalization
        hospitalization: this.transformHospitalization(omnicareEncounter.hospitalization),
        
        // Location
        location: this.transformEncounterLocations(omnicareEncounter.locations || []),
        
        // Service provider
        serviceProvider: omnicareEncounter.serviceProviderId ? { reference: `Organization/${omnicareEncounter.serviceProviderId}` } : undefined,
        
        // Part of
        partOf: omnicareEncounter.parentEncounterId ? { reference: `Encounter/${omnicareEncounter.parentEncounterId}` } : undefined,

        // OmniCare-specific extensions
        extension: [
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/appointment-type',
            valueString: omnicareEncounter.appointmentType || 'routine'
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/chief-complaint',
            valueString: omnicareEncounter.chiefComplaint || ''
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/visit-summary',
            valueString: omnicareEncounter.visitSummary || ''
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/follow-up-instructions',
            valueString: omnicareEncounter.followUpInstructions || ''
          }
        ].filter(ext => ext.valueString),

        // Set OmniCare-specific properties
        omnicareEncounterId: omnicareEncounter.omnicareId || omnicareEncounter.id,
        appointmentType: omnicareEncounter.appointmentType,
        chiefComplaint: omnicareEncounter.chiefComplaint,
        visitSummary: omnicareEncounter.visitSummary,
        followUpInstructions: omnicareEncounter.followUpInstructions,
        billingNotes: omnicareEncounter.billingNotes
      };

      logger.debug('Transformed OmniCare encounter to FHIR', { encounterId: encounter.id });
      return encounter;
    } catch (error) {
      logger.error('Failed to transform encounter to FHIR:', error);
      throw new Error(`Encounter transformation failed: ${String(error)}`);
    }
  }

  // ===============================
  // OBSERVATION TRANSFORMATIONS
  // ===============================

  /**
   * Transform OmniCare observation data to FHIR Observation resource
   */
  transformToFHIRObservation(omnicareObservation: ObservationInput): OmniCareObservation {
    try {
      const observation: OmniCareObservation = {
        resourceType: 'Observation',
        id: omnicareObservation.id || undefined,
        meta: {
          profile: ['http://omnicare.com/fhir/StructureDefinition/OmniCareObservation'],
          lastUpdated: new Date().toISOString(),
          versionId: '1',
          source: 'OmniCare EMR System'
        },
        
        // Identifiers
        identifier: this.transformIdentifiers(omnicareObservation.identifiers || [], omnicareObservation.observationId),
        
        // Based on
        basedOn: omnicareObservation.orderIds ? omnicareObservation.orderIds.map((id: string) => ({ reference: `ServiceRequest/${id}` })) : undefined,
        
        // Part of
        partOf: omnicareObservation.partOfIds ? omnicareObservation.partOfIds.map((id: string) => ({ reference: `MedicationAdministration/${id}` })) : undefined,
        
        // Status
        status: this.mapObservationStatus(omnicareObservation.status),
        
        // Category
        category: this.transformObservationCategories(omnicareObservation.categories || []),
        
        // Code
        code: this.transformCodeableConcept(omnicareObservation.code),
        
        // Subject
        subject: { reference: `Patient/${omnicareObservation.patientId}` },
        
        // Focus
        focus: omnicareObservation.focusIds ? omnicareObservation.focusIds.map((id: string) => ({ reference: id })) : undefined,
        
        // Encounter
        encounter: omnicareObservation.encounterId ? { reference: `Encounter/${omnicareObservation.encounterId}` } : undefined,
        
        // Effective time
        effectiveDateTime: (omnicareObservation.effectiveTime || omnicareObservation.observationTime) ? this.transformDateTime((omnicareObservation.effectiveTime || omnicareObservation.observationTime)!) : undefined,
        effectivePeriod: omnicareObservation.effectivePeriod ? this.transformPeriod(omnicareObservation.effectivePeriod.start, omnicareObservation.effectivePeriod.end) : undefined,
        
        // Issued
        issued: omnicareObservation.issuedTime ? this.transformDateTime(omnicareObservation.issuedTime) : undefined,
        
        // Performer
        performer: this.transformPerformerReferences(omnicareObservation.performers || []) as any,
        
        // Value
        valueQuantity: omnicareObservation.valueQuantity ? this.transformQuantity(omnicareObservation.valueQuantity) : undefined,
        valueCodeableConcept: omnicareObservation.valueCodeableConcept ? this.transformCodeableConcept(omnicareObservation.valueCodeableConcept) : undefined,
        valueString: omnicareObservation.valueString,
        valueBoolean: omnicareObservation.valueBoolean,
        valueInteger: omnicareObservation.valueInteger,
        valueRange: omnicareObservation.valueRange ? this.transformRange(omnicareObservation.valueRange) : undefined,
        valueRatio: omnicareObservation.valueRatio ? this.transformRatio(omnicareObservation.valueRatio) : undefined,
        valueSampledData: omnicareObservation.valueSampledData,
        valueTime: omnicareObservation.valueTime,
        valueDateTime: omnicareObservation.valueDateTime ? this.transformDateTime(omnicareObservation.valueDateTime) : undefined,
        valuePeriod: omnicareObservation.valuePeriod ? this.transformPeriod(omnicareObservation.valuePeriod.start, omnicareObservation.valuePeriod.end) : undefined,
        
        // Data absent reason
        dataAbsentReason: omnicareObservation.dataAbsentReason ? this.transformCodeableConcept(omnicareObservation.dataAbsentReason) : undefined,
        
        // Interpretation
        interpretation: omnicareObservation.interpretation ? omnicareObservation.interpretation.map((interp: any) => this.transformCodeableConcept(interp)) : undefined,
        
        // Note
        note: omnicareObservation.notes ? omnicareObservation.notes.map((note: any) => this.transformAnnotation(note)) : undefined,
        
        // Body site
        bodySite: omnicareObservation.bodySite ? this.transformCodeableConcept(omnicareObservation.bodySite) : undefined,
        
        // Method
        method: omnicareObservation.method ? this.transformCodeableConcept(omnicareObservation.method) : undefined,
        
        // Specimen
        specimen: omnicareObservation.specimenId ? { reference: `Specimen/${omnicareObservation.specimenId}` } : undefined,
        
        // Device
        device: omnicareObservation.deviceId ? { reference: `Device/${omnicareObservation.deviceId}` } : undefined,
        
        // Reference range
        referenceRange: this.transformReferenceRanges(omnicareObservation.referenceRanges || []),
        
        // Has member
        hasMember: omnicareObservation.memberIds ? omnicareObservation.memberIds.map((id: string) => ({ reference: `Observation/${id}` })) : undefined,
        
        // Derived from
        derivedFrom: omnicareObservation.derivedFromIds ? omnicareObservation.derivedFromIds.map((id: string) => ({ reference: id })) : undefined,
        
        // Component
        component: this.transformObservationComponents(omnicareObservation.components || []),

        // OmniCare-specific extensions
        extension: [
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/device-used',
            valueString: omnicareObservation.deviceUsed || ''
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/quality-flags',
            valueString: omnicareObservation.qualityFlags ? omnicareObservation.qualityFlags.join(',') : ''
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/abnormal-flags',
            valueString: omnicareObservation.abnormalFlags ? omnicareObservation.abnormalFlags.join(',') : ''
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/critical-alerts',
            valueBoolean: omnicareObservation.criticalAlerts || false
          }
        ].filter(ext => ext.valueString || ext.valueBoolean !== undefined),

        // Set OmniCare-specific properties
        omnicareObservationId: omnicareObservation.omnicareId || omnicareObservation.id,
        deviceUsed: omnicareObservation.deviceUsed,
        qualityFlags: omnicareObservation.qualityFlags,
        abnormalFlags: omnicareObservation.abnormalFlags,
        criticalAlerts: omnicareObservation.criticalAlerts
      };

      logger.debug('Transformed OmniCare observation to FHIR', { observationId: observation.id });
      return observation;
    } catch (error) {
      logger.error('Failed to transform observation to FHIR:', error);
      throw new Error(`Observation transformation failed: ${String(error)}`);
    }
  }

  // ===============================
  // UTILITY TRANSFORMATION METHODS
  // ===============================

  private transformNames(names: any[]): HumanName[] {
    return names.map(name => ({
      use: name.use || 'official',
      family: name.family || name.lastName,
      given: [name.given, name.firstName, name.middleName].filter(Boolean).flat(),
      prefix: name.prefix ? [name.prefix] : undefined,
      suffix: name.suffix ? [name.suffix] : undefined,
      period: name.period ? this.transformPeriod(name.period.start, name.period.end) : undefined
    }));
  }

  private transformIdentifiers(identifiers: any[], mrn?: string): Identifier[] {
    const transformed = identifiers.map(id => ({
      use: id.use || 'usual',
      type: id.type ? this.transformCodeableConcept(id.type) : undefined,
      system: id.system,
      value: id.value,
      period: id.period ? this.transformPeriod(id.period.start, id.period.end) : undefined,
      assigner: id.assigner ? { reference: id.assigner } : undefined
    }));

    // Add MRN if provided
    if (mrn && !identifiers.find(id => id.type?.coding?.[0]?.code === 'MR')) {
      transformed.push({
        use: 'usual',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'MR',
            display: 'Medical Record Number'
          }]
        },
        system: 'http://omnicare.com/patient-id',
        value: mrn,
        period: undefined,
        assigner: undefined
      });
    }

    return transformed;
  }

  private transformGender(gender: string): 'male' | 'female' | 'other' | 'unknown' | undefined {
    if (!gender) return undefined;
    const normalized = gender.toLowerCase();
    if (['male', 'm'].includes(normalized)) return 'male';
    if (['female', 'f'].includes(normalized)) return 'female';
    if (['other', 'o'].includes(normalized)) return 'other';
    return 'unknown';
  }

  private transformDate(date: string | Date): string | undefined {
    if (!date) return undefined;
    if (date instanceof Date) return date.toISOString().split('T')[0];
    if (typeof date === 'string') {
      const parsed = new Date(date);
      return parsed.toISOString().split('T')[0];
    }
    return undefined;
  }

  private transformDateTime(dateTime: string | Date): string | undefined {
    if (!dateTime) return undefined;
    if (dateTime instanceof Date) return dateTime.toISOString();
    if (typeof dateTime === 'string') {
      const parsed = new Date(dateTime);
      return parsed.toISOString();
    }
    return undefined;
  }

  private transformTelecom(contacts: any[]): ContactPoint[] {
    return contacts.map(contact => ({
      system: this.mapContactSystem(contact.type || contact.system),
      value: contact.value || contact.number || contact.email,
      use: contact.use || 'home',
      rank: contact.rank || 1,
      period: contact.period ? this.transformPeriod(contact.period.start, contact.period.end) : undefined
    }));
  }

  private transformAddresses(addresses: any[]): Address[] {
    return addresses.map(addr => ({
      use: addr.use || 'home',
      type: addr.type || 'both',
      text: addr.text,
      line: [addr.line1, addr.line2, addr.street, addr.streetAddress].filter(Boolean),
      city: addr.city,
      district: addr.district || addr.county,
      state: addr.state || addr.stateProvince,
      postalCode: addr.postalCode || addr.zipCode,
      country: addr.country,
      period: addr.period ? this.transformPeriod(addr.period.start, addr.period.end) : undefined
    }));
  }

  private transformCodeableConcept(concept: Record<string, any>): CodeableConcept {
    if (!concept) return { text: 'Unknown' };
    
    return {
      coding: concept.coding ? concept.coding.map((c: any) => ({
        system: c.system,
        version: c.version,
        code: c.code,
        display: c.display,
        userSelected: c.userSelected
      })) : concept.code ? [{
        system: concept.system,
        code: concept.code,
        display: concept.display
      }] : undefined,
      text: concept.text || concept.display || concept.name
    };
  }

  private transformQuantity(quantity: Record<string, any>): Quantity {
    return {
      value: quantity.value,
      comparator: quantity.comparator,
      unit: quantity.unit,
      system: quantity.system || 'http://unitsofmeasure.org',
      code: quantity.code || quantity.unit
    };
  }

  private transformPeriod(start?: string | Date, end?: string | Date): Period | undefined {
    if (!start && !end) return undefined;
    return {
      start: start ? this.transformDateTime(start) : undefined,
      end: end ? this.transformDateTime(end) : undefined
    };
  }

  private transformAnnotation(note: Record<string, any>): Annotation {
    return {
      authorReference: note.authorId ? { reference: `Practitioner/${note.authorId}` } : undefined,
      authorString: note.authorName,
      time: note.time ? this.transformDateTime(note.time) : undefined,
      text: note.text || note.content
    };
  }

  private mapContactSystem(type: string): 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other' {
    const normalized = type?.toLowerCase();
    if (['phone', 'mobile', 'cell'].includes(normalized)) return 'phone';
    if (['fax'].includes(normalized)) return 'fax';
    if (['email'].includes(normalized)) return 'email';
    if (['pager'].includes(normalized)) return 'pager';
    if (['url', 'web', 'website'].includes(normalized)) return 'url';
    if (['sms', 'text'].includes(normalized)) return 'sms';
    return 'other';
  }

  private mapEncounterStatus(status?: string): 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown' {
    const normalized = status?.toLowerCase();
    if (!normalized) return 'unknown';
    if (['planned', 'scheduled'].includes(normalized)) return 'planned';
    if (['arrived', 'checked-in'].includes(normalized)) return 'arrived';
    if (['triaged'].includes(normalized)) return 'triaged';
    if (['in-progress', 'active', 'ongoing'].includes(normalized)) return 'in-progress';
    if (['onleave', 'on-leave'].includes(normalized)) return 'onleave';
    if (['finished', 'completed', 'discharged'].includes(normalized)) return 'finished';
    if (['cancelled', 'canceled'].includes(normalized)) return 'cancelled';
    if (['entered-in-error', 'error'].includes(normalized)) return 'entered-in-error';
    return 'unknown';
  }

  private mapObservationStatus(status?: string): 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown' {
    const normalized = status?.toLowerCase();
    if (!normalized) return 'unknown';
    if (['registered'].includes(normalized)) return 'registered';
    if (['preliminary', 'pending'].includes(normalized)) return 'preliminary';
    if (['final', 'completed'].includes(normalized)) return 'final';
    if (['amended'].includes(normalized)) return 'amended';
    if (['corrected'].includes(normalized)) return 'corrected';
    if (['cancelled', 'canceled'].includes(normalized)) return 'cancelled';
    if (['entered-in-error', 'error'].includes(normalized)) return 'entered-in-error';
    return 'unknown';
  }

  // Helper methods for extracting data from FHIR resources
  private extractMRN(identifiers: Identifier[]): string {
    const mrn = identifiers.find(id => id.type?.coding?.[0]?.code === 'MR');
    return mrn?.value || '';
  }

  private extractPhoneNumbers(telecom: ContactPoint[]): string[] {
    return telecom.filter(t => t.system === 'phone').map(t => t.value || '');
  }

  private extractEmailAddresses(telecom: ContactPoint[]): string[] {
    return telecom.filter(t => t.system === 'email').map(t => t.value || '');
  }

  private extractAddresses(addresses: Address[]): any[] {
    return addresses.map(addr => ({
      line1: addr.line?.[0] || '',
      line2: addr.line?.[1] || '',
      city: addr.city || '',
      state: addr.state || '',
      postalCode: addr.postalCode || '',
      country: addr.country || '',
      use: addr.use || 'home'
    }));
  }

  private extractEmergencyContacts(contacts: Patient['contact']): any[] {
    return (contacts || []).map(contact => ({
      name: contact.name ? `${contact.name.given?.join(' ')} ${contact.name.family}`.trim() : '',
      relationship: contact.relationship?.[0]?.coding?.[0]?.display || '',
      phone: contact.telecom?.find(t => t.system === 'phone')?.value || '',
      email: contact.telecom?.find(t => t.system === 'email')?.value || ''
    }));
  }

  private extractLanguages(communication: Patient['communication']): string[] {
    return (communication || []).map(comm => comm.language?.coding?.[0]?.code || '');
  }

  private extractExtensionValue(extensions: Extension[] | undefined, url: string): any {
    const extension = extensions?.find(ext => ext.url === url);
    return extension?.valueString || extension?.valueBoolean || extension?.valueDateTime || extension?.valueInteger || extension?.valueDecimal;
  }

  // Additional helper methods for complex transformations
  private transformEmergencyContacts(contacts: any[]): Patient['contact'] {
    return contacts.map(contact => ({
      relationship: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
          code: contact.relationshipCode || 'C',
          display: contact.relationship || 'Emergency Contact'
        }]
      }],
      name: {
        family: contact.lastName || contact.name?.split(' ').pop(),
        given: contact.firstName ? [contact.firstName] : contact.name?.split(' ').slice(0, -1) || []
      },
      telecom: [
        contact.phone ? { system: 'phone', value: contact.phone, use: 'home' } : null,
        contact.email ? { system: 'email', value: contact.email, use: 'home' } : null
      ].filter(Boolean) as ContactPoint[]
    }));
  }

  private transformCommunication(languages: any[]): Patient['communication'] {
    return languages.map(lang => ({
      language: {
        coding: [{
          system: 'urn:ietf:bcp:47',
          code: lang.code || lang,
          display: lang.display || lang.name
        }]
      },
      preferred: lang.preferred || false
    }));
  }

  private transformPractitionerReferences(providers: any[]): Reference[] {
    return providers.map(provider => ({
      reference: typeof provider === 'string' ? `Practitioner/${provider}` : `Practitioner/${provider.id}`,
      display: provider.name || provider.display
    })) as Reference[];
  }

  private transformPatientLinks(linkedPatients: any[]): Patient['link'] {
    return linkedPatients.map(link => ({
      other: { reference: `Patient/${link.patientId || link.id}` },
      type: link.type || 'seealso'
    }));
  }

  private transformEncounterClass(encounterClass: any): Encounter['class'] {
    if (!encounterClass) {
      return {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'Ambulatory'
      };
    }

    return {
      system: encounterClass.system || 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: encounterClass.code || 'AMB',
      display: encounterClass.display || 'Ambulatory'
    };
  }

  private transformEncounterParticipants(participants: any[]): Encounter['participant'] {
    return participants.map(participant => ({
      type: participant.types ? participant.types.map((type: any) => this.transformCodeableConcept(type)) : undefined,
      period: participant.period ? this.transformPeriod(participant.period.start, participant.period.end) : undefined,
      individual: participant.practitionerId ? { reference: `Practitioner/${participant.practitionerId}` } : undefined
    }));
  }

  private transformEncounterDiagnoses(diagnoses: any[]): Encounter['diagnosis'] {
    return diagnoses.map(diag => ({
      condition: { reference: `Condition/${diag.conditionId || diag.id}` },
      use: diag.use ? this.transformCodeableConcept(diag.use) : undefined,
      rank: diag.rank || 1
    }));
  }

  private transformHospitalization(hospitalization: any): Encounter['hospitalization'] {
    if (!hospitalization) return undefined;

    return {
      preAdmissionIdentifier: hospitalization.preAdmissionId ? { value: hospitalization.preAdmissionId } : undefined,
      origin: hospitalization.originLocationId ? { reference: `Location/${hospitalization.originLocationId}` } : undefined,
      admitSource: hospitalization.admitSource ? this.transformCodeableConcept(hospitalization.admitSource) : undefined,
      reAdmission: hospitalization.reAdmission ? this.transformCodeableConcept(hospitalization.reAdmission) : undefined,
      dietPreference: hospitalization.dietPreferences ? hospitalization.dietPreferences.map((diet: any) => this.transformCodeableConcept(diet)) : undefined,
      specialCourtesy: hospitalization.specialCourtesies ? hospitalization.specialCourtesies.map((courtesy: any) => this.transformCodeableConcept(courtesy)) : undefined,
      specialArrangement: hospitalization.specialArrangements ? hospitalization.specialArrangements.map((arrangement: any) => this.transformCodeableConcept(arrangement)) : undefined,
      destination: hospitalization.destinationLocationId ? { reference: `Location/${hospitalization.destinationLocationId}` } : undefined,
      dischargeDisposition: hospitalization.dischargeDisposition ? this.transformCodeableConcept(hospitalization.dischargeDisposition) : undefined
    };
  }

  private transformEncounterLocations(locations: any[]): Encounter['location'] {
    return locations.map(loc => ({
      location: { reference: `Location/${loc.locationId || loc.id}` },
      status: loc.status || 'active',
      physicalType: loc.physicalType ? this.transformCodeableConcept(loc.physicalType) : undefined,
      period: loc.period ? this.transformPeriod(loc.period.start, loc.period.end) : undefined
    }));
  }

  private transformObservationCategories(categories: any[]): Observation['category'] {
    return categories.map(category => this.transformCodeableConcept(category));
  }

  private transformPerformerReferences(performers: any[]): Reference[] {
    return performers.map(performer => ({
      reference: `${performer.resourceType || 'Practitioner'}/${performer.id}`,
      display: performer.name || performer.display
    })) as Reference[];
  }

  private transformRange(range: any): any {
    return {
      low: range.low ? this.transformQuantity(range.low) : undefined,
      high: range.high ? this.transformQuantity(range.high) : undefined
    };
  }

  private transformRatio(ratio: any): any {
    return {
      numerator: ratio.numerator ? this.transformQuantity(ratio.numerator) : undefined,
      denominator: ratio.denominator ? this.transformQuantity(ratio.denominator) : undefined
    };
  }

  private transformReferenceRanges(ranges: any[]): Observation['referenceRange'] {
    return ranges.map(range => ({
      low: range.low ? this.transformQuantity(range.low) : undefined,
      high: range.high ? this.transformQuantity(range.high) : undefined,
      type: range.type ? this.transformCodeableConcept(range.type) : undefined,
      appliesTo: range.appliesTo ? range.appliesTo.map((applies: any) => this.transformCodeableConcept(applies)) : undefined,
      age: range.age ? this.transformRange(range.age) : undefined,
      text: range.text
    }));
  }

  private transformObservationComponents(components: any[]): Observation['component'] {
    return components.map(comp => ({
      code: this.transformCodeableConcept(comp.code),
      valueQuantity: comp.valueQuantity ? this.transformQuantity(comp.valueQuantity) : undefined,
      valueCodeableConcept: comp.valueCodeableConcept ? this.transformCodeableConcept(comp.valueCodeableConcept) : undefined,
      valueString: comp.valueString,
      valueBoolean: comp.valueBoolean,
      valueInteger: comp.valueInteger,
      valueRange: comp.valueRange ? this.transformRange(comp.valueRange) : undefined,
      valueRatio: comp.valueRatio ? this.transformRatio(comp.valueRatio) : undefined,
      valueSampledData: comp.valueSampledData,
      valueTime: comp.valueTime,
      valueDateTime: comp.valueDateTime ? this.transformDateTime(comp.valueDateTime) : undefined,
      valuePeriod: comp.valuePeriod ? this.transformPeriod(comp.valuePeriod.start, comp.valuePeriod.end) : undefined,
      dataAbsentReason: comp.dataAbsentReason ? this.transformCodeableConcept(comp.dataAbsentReason) : undefined,
      interpretation: comp.interpretation ? comp.interpretation.map((interp: any) => this.transformCodeableConcept(interp)) : undefined,
      referenceRange: comp.referenceRanges ? this.transformReferenceRanges(comp.referenceRanges) : undefined
    }));
  }

  /**
   * Validate transformation results
   */
  async validateTransformation(original: any, transformed: any, resourceType: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Basic validation
      if (!transformed.resourceType) {
        errors.push('Missing resourceType');
      }

      if (transformed.resourceType !== resourceType) {
        errors.push(`Resource type mismatch: expected ${resourceType}, got ${transformed.resourceType}`);
      }

      // Resource-specific validation
      switch (resourceType) {
        case 'Patient':
          if (!transformed.name || transformed.name.length === 0) {
            errors.push('Patient must have at least one name');
          }
          break;
        case 'Encounter':
          if (!transformed.subject) {
            errors.push('Encounter must have a subject reference');
          }
          if (!transformed.status) {
            errors.push('Encounter must have a status');
          }
          break;
        case 'Observation':
          if (!transformed.code) {
            errors.push('Observation must have a code');
          }
          if (!transformed.subject) {
            errors.push('Observation must have a subject reference');
          }
          if (!transformed.status) {
            errors.push('Observation must have a status');
          }
          break;
      }

      const valid = errors.length === 0;
      
      if (valid) {
        logger.debug(`Transformation validation passed for ${resourceType}`, { originalId: original.id });
      } else {
        logger.warn(`Transformation validation failed for ${resourceType}`, { errors, originalId: original.id });
      }

      return { valid, errors };
    } catch (error) {
      logger.error('Transformation validation error:', error);
      return { valid: false, errors: [`Validation error: ${String(error)}`] };
    }
  }

  /**
   * Transform bundle of resources
   */
  async transformBundle(omnicareBundle: any, bundleType: 'transaction' | 'batch' | 'collection' = 'collection'): Promise<Bundle> {
    try {
      const bundle: Bundle = {
        resourceType: 'Bundle',
        id: omnicareBundle.id || `bundle-${Date.now()}`,
        meta: {
          lastUpdated: new Date().toISOString(),
          source: 'OmniCare EMR System'
        },
        type: bundleType,
        timestamp: new Date().toISOString(),
        total: omnicareBundle.resources?.length || 0,
        entry: []
      };

      if (omnicareBundle.resources && Array.isArray(omnicareBundle.resources)) {
        for (const resource of omnicareBundle.resources) {
          try {
            let transformed;
            
            switch (resource.resourceType || resource.type) {
              case 'Patient':
                transformed = this.transformToFHIRPatient(resource);
                break;
              case 'Encounter':
                transformed = this.transformToFHIREncounter(resource);
                break;
              case 'Observation':
                transformed = this.transformToFHIRObservation(resource);
                break;
              default:
                logger.warn('Unsupported resource type in bundle transformation', { type: resource.resourceType || resource.type });
                continue;
            }

            bundle.entry!.push({
              resource: transformed,
              request: bundleType === 'transaction' || bundleType === 'batch' ? {
                method: resource.id ? 'PUT' : 'POST',
                url: resource.id ? `${transformed.resourceType}/${resource.id}` : transformed.resourceType
              } : undefined
            });
          } catch (error) {
            logger.error('Failed to transform resource in bundle:', { error, resource: resource.id });
          }
        }
      }

      logger.info('Bundle transformation completed', { 
        bundleId: bundle.id, 
        totalResources: bundle.total, 
        transformedResources: bundle.entry?.length || 0 
      });

      return bundle;
    } catch (error) {
      logger.error('Bundle transformation failed:', error);
      throw new Error(`Bundle transformation failed: ${String(error)}`);
    }
  }
}

// Export singleton instance
export const fhirTransformationService = new FHIRTransformationService();