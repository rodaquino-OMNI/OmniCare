import { MedplumClient } from '@medplum/core';
import { 
  Appointment, 
  Encounter, 
  Patient, 
  Practitioner, 
  Communication,
  Media,
  DocumentReference,
  Observation,
  AppointmentParticipant,
  Reference,
  Group,
  PractitionerRole,
  RelatedPerson,
  Device,
  HealthcareService,
  Location
} from '@medplum/fhirtypes';
import { v4 as uuidv4 } from 'uuid';
import { isReferenceToType, isFHIRResourceType, isDefined } from '../../utils/type-guards';
import { createFlexibleReference, toFlexibleReference, safeCastReference } from '../../utils/fhir-reference-utils';
import { TypeSafeFHIRSearch } from '../../utils/fhir-search.utils';

export interface VideoSessionConfig {
  provider: string; // 'zoom' | 'teams' | 'webrtc' | 'doxy.me'
  apiKey?: string;
  apiSecret?: string;
  roomUrl?: string;
  sessionToken?: string;
}

export interface TelemedicineSession {
  sessionId: string;
  appointmentId: string;
  encounterId?: string;
  patientId: string;
  practitionerId: string;
  status: 'scheduled' | 'waiting' | 'in-progress' | 'completed' | 'cancelled';
  videoConfig: VideoSessionConfig;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  recordings?: string[];
  notes?: string;
  technicalIssues?: string[];
}

export interface VirtualVitals {
  reportedBy: 'patient' | 'caregiver';
  timestamp: Date;
  bloodPressure?: { systolic: number; diastolic: number };
  heartRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
  weight?: number;
  glucoseLevel?: number;
  painLevel?: number;
}

export class TelemedicineWorkflowService {
  private typeSafeSearch: TypeSafeFHIRSearch;
  
  constructor(private medplum: MedplumClient) {
    this.typeSafeSearch = new TypeSafeFHIRSearch(medplum);
  }

  /**
   * Schedule a telemedicine appointment
   */
  async scheduleTelemedicineAppointment(
    patientId: string,
    practitionerId: string,
    startTime: Date,
    duration: number,
    reason: string
  ): Promise<Appointment> {
    const appointment = await this.medplum.createResource<Appointment>({
      resourceType: 'Appointment',
      status: 'booked',
      appointmentType: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
          code: 'TELEMEDICINE',
          display: 'Telemedicine consultation'
        }]
      },
      reasonCode: [{
        text: reason
      }],
      start: startTime.toISOString(),
      end: new Date(startTime.getTime() + duration * 60000).toISOString(),
      participant: [
        {
          actor: { reference: `Patient/${patientId}` },
          required: 'required',
          status: 'accepted'
        },
        {
          actor: { reference: `Practitioner/${practitionerId}` },
          required: 'required', 
          status: 'accepted'
        }
      ],
      meta: {
        tag: [{
          system: 'http://omnicare.com/appointment-type',
          code: 'telemedicine'
        }]
      }
    });

    return appointment;
  }

  /**
   * Initialize telemedicine session
   */
  async initializeTelemedicineSession(
    appointmentId: string,
    videoConfig: VideoSessionConfig
  ): Promise<TelemedicineSession> {
    const appointment = await this.medplum.readResource('Appointment', appointmentId) as Appointment;
    
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    const patientRef = appointment.participant.find(p => p.actor?.reference?.startsWith('Patient/'));
    const practitionerRef = appointment.participant.find(p => p.actor?.reference?.startsWith('Practitioner/'));

    if (!patientRef?.actor?.reference || !practitionerRef?.actor?.reference) {
      throw new Error('Invalid appointment participants');
    }

    const session: TelemedicineSession = {
      sessionId: uuidv4(),
      appointmentId,
      patientId: patientRef.actor.reference.split('/')[1],
      practitionerId: practitionerRef.actor.reference.split('/')[1],
      status: 'scheduled',
      videoConfig
    };

    // Store session configuration
    await this.medplum.createResource<DocumentReference>({
      resourceType: 'DocumentReference',
      status: 'current',
      type: {
        coding: [{
          system: 'http://loinc.org',
          code: '11506-3',
          display: 'Telemedicine session configuration'
        }]
      },
      subject: patientRef.actor ? patientRef.actor as Reference<Patient | Device | Group | Practitioner> : { reference: 'Patient/unknown' },
      context: {
        related: [{ reference: `Appointment/${appointmentId}` }]
      },
      content: [{
        attachment: {
          contentType: 'application/json',
          data: btoa(JSON.stringify(session))
        }
      }]
    });

    return session;
  }

  /**
   * Start telemedicine encounter
   */
  async startTelemedicineEncounter(
    sessionId: string,
    appointmentId: string
  ): Promise<Encounter> {
    const appointment = await this.medplum.readResource('Appointment', appointmentId) as Appointment;
    
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Update appointment status
    await this.medplum.updateResource<Appointment>({
      ...appointment,
      status: 'arrived'
    });

    const patientRef = appointment.participant.find(p => p.actor?.reference?.startsWith('Patient/'));
    const practitionerRef = appointment.participant.find(p => p.actor?.reference?.startsWith('Practitioner/'));

    // Create encounter
    const encounter = await this.medplum.createResource<Encounter>({
      resourceType: 'Encounter',
      status: 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'VR',
        display: 'Virtual'
      },
      type: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: '448337001',
          display: 'Telemedicine consultation with patient'
        }]
      }],
      subject: patientRef?.actor ? patientRef.actor as Reference<Patient | Group> : { reference: 'Patient/unknown' },
      participant: [{
        individual: practitionerRef?.actor ? practitionerRef.actor as Reference<Practitioner | PractitionerRole | RelatedPerson> : { reference: 'Practitioner/unknown' },
        type: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
            code: 'PPRF',
            display: 'Primary performer'
          }]
        }]
      }],
      appointment: [{ reference: `Appointment/${appointmentId}` }],
      period: {
        start: new Date().toISOString()
      },
      meta: {
        tag: [{
          system: 'http://omnicare.com/encounter-mode',
          code: 'telemedicine'
        }]
      }
    });

    return encounter;
  }

  /**
   * Record patient-reported vitals during telemedicine session
   */
  async recordVirtualVitals(
    encounterId: string,
    patientId: string,
    vitals: VirtualVitals
  ): Promise<Observation[]> {
    const observations: Observation[] = [];
    const performer = vitals.reportedBy === 'patient' 
      ? { reference: `Patient/${patientId}` }
      : { display: 'Caregiver' };

    // Blood Pressure
    if (vitals.bloodPressure) {
      const bpObs = await this.medplum.createResource<Observation>({
        resourceType: 'Observation',
        status: 'final',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure panel'
          }]
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: vitals.timestamp.toISOString(),
        performer: [performer],
        component: [
          {
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8480-6',
                display: 'Systolic blood pressure'
              }]
            },
            valueQuantity: {
              value: vitals.bloodPressure.systolic,
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]'
            }
          },
          {
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8462-4',
                display: 'Diastolic blood pressure'
              }]
            },
            valueQuantity: {
              value: vitals.bloodPressure.diastolic,
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]'
            }
          }
        ],
        note: [{
          text: `Patient-reported during telemedicine visit`
        }]
      });
      observations.push(bpObs);
    }

    // Heart Rate
    if (vitals.heartRate) {
      const hrObs = await this.medplum.createResource<Observation>({
        resourceType: 'Observation',
        status: 'final',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          }]
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: vitals.timestamp.toISOString(),
        performer: [performer],
        valueQuantity: {
          value: vitals.heartRate,
          unit: 'beats/minute',
          system: 'http://unitsofmeasure.org',
          code: '/min'
        }
      });
      observations.push(hrObs);
    }

    // Temperature
    if (vitals.temperature) {
      const tempObs = await this.medplum.createResource<Observation>({
        resourceType: 'Observation',
        status: 'final',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '8310-5',
            display: 'Body temperature'
          }]
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: vitals.timestamp.toISOString(),
        performer: [performer],
        valueQuantity: {
          value: vitals.temperature,
          unit: 'degrees Fahrenheit',
          system: 'http://unitsofmeasure.org',
          code: '[degF]'
        }
      });
      observations.push(tempObs);
    }

    // Oxygen Saturation
    if (vitals.oxygenSaturation) {
      const o2Obs = await this.medplum.createResource<Observation>({
        resourceType: 'Observation',
        status: 'final',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '2708-6',
            display: 'Oxygen saturation'
          }]
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: vitals.timestamp.toISOString(),
        performer: [performer],
        valueQuantity: {
          value: vitals.oxygenSaturation,
          unit: '%',
          system: 'http://unitsofmeasure.org',
          code: '%'
        }
      });
      observations.push(o2Obs);
    }

    return observations;
  }

  /**
   * Document technical issues during session
   */
  async documentTechnicalIssue(
    encounterId: string,
    issue: string,
    severity: 'minor' | 'moderate' | 'severe'
  ): Promise<Communication> {
    return await this.medplum.createResource<Communication>({
      resourceType: 'Communication',
      status: 'completed',
      category: [{
        coding: [{
          system: 'http://omnicare.com/communication-category',
          code: 'technical-issue',
          display: 'Technical Issue'
        }]
      }],
      priority: severity === 'severe' ? 'urgent' : severity === 'moderate' ? 'routine' : 'routine',
      encounter: { reference: `Encounter/${encounterId}` },
      sent: new Date().toISOString(),
      payload: [{
        contentString: issue
      }],
      note: [{
        text: `Technical issue during telemedicine session: ${issue}`
      }]
    });
  }

  /**
   * Complete telemedicine encounter
   */
  async completeTelemedicineEncounter(
    encounterId: string,
    appointmentId: string,
    clinicalNotes: string,
    followUpRequired: boolean,
    prescriptionsIssued: string[]
  ): Promise<Encounter> {
    const encounter = await this.medplum.readResource('Encounter', encounterId) as Encounter;
    
    if (!encounter) {
      throw new Error('Encounter not found');
    }

    // Update encounter
    const updatedEncounter = await this.medplum.updateResource<Encounter>({
      ...encounter,
      status: 'finished',
      period: {
        ...encounter.period,
        end: new Date().toISOString()
      }
    });

    // Update appointment
    const appointment = await this.medplum.readResource('Appointment', appointmentId) as Appointment;
    await this.medplum.updateResource<Appointment>({
      ...appointment!,
      status: 'fulfilled'
    });

    // Create clinical documentation
    await this.medplum.createResource<DocumentReference>({
      resourceType: 'DocumentReference',
      status: 'current',
      type: {
        coding: [{
          system: 'http://loinc.org',
          code: '34117-2',
          display: 'History and physical note'
        }]
      },
      subject: encounter.subject,
      context: {
        encounter: [{ reference: `Encounter/${encounterId}` }],
        related: [{ reference: `Appointment/${appointmentId}` }]
      },
      content: [{
        attachment: {
          contentType: 'text/plain',
          data: btoa(clinicalNotes),
          title: 'Telemedicine Visit Notes'
        }
      }],
      meta: {
        tag: [{
          system: 'http://omnicare.com/document-type',
          code: 'telemedicine-notes'
        }]
      }
    });

    // Log follow-up requirement if needed
    if (followUpRequired) {
      await this.medplum.createResource<Communication>({
        resourceType: 'Communication',
        status: 'completed',
        category: [{
          coding: [{
            system: 'http://omnicare.com/communication-category',
            code: 'follow-up-required',
            display: 'Follow-up Required'
          }]
        }],
        subject: encounter.subject,
        encounter: { reference: `Encounter/${encounterId}` },
        sent: new Date().toISOString(),
        payload: [{
          contentString: 'In-person follow-up visit recommended based on telemedicine assessment'
        }]
      });
    }

    return updatedEncounter;
  }

  /**
   * Generate telemedicine visit summary
   */
  async generateVisitSummary(encounterId: string): Promise<DocumentReference> {
    const encounter = await this.medplum.readResource('Encounter', encounterId) as Encounter;
    const observationsResult = await this.typeSafeSearch.searchObservations({
      encounter: `Encounter/${encounterId}`
    });
    const observations = observationsResult.resources;
    
    const communicationsBundle = await this.typeSafeSearch.searchResources('Communication', {
      encounter: `Encounter/${encounterId}`
    });
    const communications = communicationsBundle.entry?.map(entry => entry.resource).filter(Boolean) || [];

    const summary = {
      visitDate: encounter?.period?.start,
      duration: encounter?.period?.end && encounter?.period?.start
        ? new Date(encounter.period.end).getTime() - new Date(encounter.period.start).getTime()
        : null,
      vitalSigns: observations.map((obs: Observation) => ({
        type: obs.code?.coding?.[0]?.display,
        value: obs.valueQuantity?.value,
        unit: obs.valueQuantity?.unit,
        time: (obs as any).effectiveDateTime ?? obs.effectivePeriod?.start
      })),
      technicalIssues: communications
        .filter((comm: Communication | undefined): comm is Communication => comm !== undefined && comm.category?.[0]?.coding?.[0]?.code === 'technical-issue')
        .map((comm: Communication) => comm.payload?.[0]?.contentString)
        .filter((content): content is string => content !== undefined)
    };

    return await this.medplum.createResource<DocumentReference>({
      resourceType: 'DocumentReference',
      status: 'current',
      type: {
        coding: [{
          system: 'http://loinc.org',
          code: '34133-9',
          display: 'Summary of episode note'
        }]
      },
      subject: encounter!.subject,
      context: {
        encounter: [{ reference: `Encounter/${encounterId}` }]
      },
      content: [{
        attachment: {
          contentType: 'application/json',
          data: btoa(JSON.stringify(summary)),
          title: 'Telemedicine Visit Summary'
        }
      }]
    });
  }
}