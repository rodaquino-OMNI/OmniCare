import { MedplumClient } from '@medplum/core';
import {
  ServiceRequest,
  Task,
  Patient,
  Practitioner,
  PractitionerRole,
  Organization,
  Communication,
  DocumentReference,
  Coverage,
  Claim,
  ClaimResponse,
  Reference,
  Group,
  Device,
  HealthcareService,
  RelatedPerson,
  Location
} from '@medplum/fhirtypes';
import { v4 as uuidv4 } from 'uuid';
import { isReferenceToType, isFHIRResourceType, isDefined, assertDefined } from '../../utils/type-guards';
import { TypeSafeFHIRSearch } from '../../utils/fhir-search.utils';
import { createFlexibleReference, toFlexibleReference } from '../../utils/fhir-reference-utils';

export interface ReferralRequest {
  patientId: string;
  referringProviderId: string;
  specialtyType: string;
  targetProviderId?: string;
  targetOrganizationId?: string;
  urgency: 'routine' | 'urgent' | 'stat';
  reason: string;
  clinicalNotes: string;
  diagnosis: string[];
  relevantHistory?: string;
  insuranceId?: string;
  authorizationRequired: boolean;
}

export interface ReferralStatus {
  referralId: string;
  status: 'draft' | 'active' | 'on-hold' | 'completed' | 'revoked' | 'entered-in-error' | 'unknown';
  subStatus?: 'pending-authorization' | 'authorization-obtained' | 'appointment-scheduled' | 'seen' | 'report-available';
  lastUpdated: Date;
  updatedBy: string;
  notes?: string;
}

export interface ReferralAuthorization {
  authorizationNumber: string;
  insurerId: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  approvedDate?: Date;
  expirationDate?: Date;
  numberOfVisits?: number;
  specialInstructions?: string;
  denialReason?: string;
}

export interface ReferralCommunication {
  id: string;
  referralId: string;
  sender: string;
  recipient: string;
  messageType: 'question' | 'update' | 'report' | 'authorization';
  message: string;
  attachments?: string[];
  timestamp: Date;
  isRead: boolean;
}

export class ReferralManagementService {
  private typeSafeSearch: TypeSafeFHIRSearch;
  
  constructor(private medplum: MedplumClient) {
    this.typeSafeSearch = new TypeSafeFHIRSearch(medplum);
  }

  /**
   * Create a new referral
   */
  async createReferral(request: ReferralRequest): Promise<ServiceRequest> {
    // Create the ServiceRequest (referral)
    const serviceRequest = await this.medplum.createResource<ServiceRequest>({
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
      category: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: '306206005',
          display: 'Referral to service'
        }]
      }],
      priority: request.urgency,
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: '306206005',
          display: `Referral to ${request.specialtyType}`
        }],
        text: `Referral to ${request.specialtyType}`
      },
      subject: { reference: `Patient/${request.patientId}` },
      requester: { reference: `Practitioner/${request.referringProviderId}` },
      performer: request.targetProviderId 
        ? [{ reference: `Practitioner/${request.targetProviderId}` }]
        : request.targetOrganizationId
        ? [{ reference: `Organization/${request.targetOrganizationId}` }]
        : undefined,
      reasonCode: [{
        text: request.reason
      }],
      reasonReference: request.diagnosis.map(diag => ({
        display: diag
      })),
      note: [{
        text: request.clinicalNotes
      }],
      insurance: request.insuranceId 
        ? [{ reference: `Coverage/${request.insuranceId}` }]
        : undefined,
      meta: {
        tag: [{
          system: 'http://omnicare.com/referral-type',
          code: 'outbound-referral'
        }]
      }
    });

    // Create associated Task for tracking
    await this.medplum.createResource<Task>({
      resourceType: 'Task',
      status: 'requested',
      intent: 'order',
      priority: request.urgency,
      code: {
        coding: [{
          system: 'http://omnicare.com/task-type',
          code: 'referral-tracking',
          display: 'Referral Tracking'
        }]
      },
      description: `Track referral to ${request.specialtyType}`,
      focus: { reference: `ServiceRequest/${serviceRequest.id}` },
      for: { reference: `Patient/${request.patientId}` },
      requester: { reference: `Practitioner/${request.referringProviderId}` },
      businessStatus: {
        text: request.authorizationRequired ? 'Pending Authorization' : 'Active'
      }
    });

    // If authorization is required, create a placeholder
    if (request.authorizationRequired) {
      await this.createAuthorizationRequest(serviceRequest.id!, request.insuranceId!);
    }

    return serviceRequest;
  }

  /**
   * Create authorization request for referral
   */
  async createAuthorizationRequest(
    referralId: string,
    coverageId: string
  ): Promise<Claim> {
    const referral = await this.medplum.readResource('ServiceRequest', referralId);
    const coverage = await this.medplum.readResource('Coverage', coverageId);

    const claim = await this.medplum.createResource<Claim>({
      resourceType: 'Claim',
      status: 'active',
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'professional',
          display: 'Professional'
        }]
      },
      use: 'preauthorization',
      patient: referral?.subject ? referral.subject as Reference<Patient> : { reference: 'Patient/unknown' },
      created: new Date().toISOString(),
      provider: referral?.requester ? referral.requester as Reference<Organization | Practitioner | PractitionerRole> : { reference: 'Organization/unknown' },
      priority: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/processpriority',
          code: referral?.priority ?? 'normal'
        }]
      },
      insurance: [{
        sequence: 1,
        focal: true,
        coverage: { reference: `Coverage/${coverageId}` }
      }],
      referral: { reference: `ServiceRequest/${referralId}` },
      diagnosis: [{
        sequence: 1,
        diagnosisCodeableConcept: {
          text: referral?.reasonCode?.[0]?.text
        }
      }],
      item: [{
        sequence: 1,
        productOrService: {
          coding: [{
            system: 'http://www.ama-assn.org/go/cpt',
            code: '99243',
            display: 'Office consultation'
          }]
        },
        quantity: {
          value: 1
        }
      }]
    });

    // Update referral status
    await this.updateReferralStatus(referralId, 'on-hold', 'pending-authorization');

    return claim;
  }

  /**
   * Update referral status
   */
  async updateReferralStatus(
    referralId: string,
    status: ReferralStatus['status'],
    subStatus?: ReferralStatus['subStatus'],
    notes?: string
  ): Promise<ServiceRequest> {
    const referral = await this.medplum.readResource('ServiceRequest', referralId);
    
    if (!referral) {
      throw new Error('Referral not found');
    }

    // Update ServiceRequest
    const updatedReferral = await this.medplum.updateResource<ServiceRequest>({
      ...referral,
      status: status as ServiceRequest['status'],
      extension: [
        ...(referral.extension || []).filter(ext => ext.url !== 'http://omnicare.com/referral-substatus'),
        {
          url: 'http://omnicare.com/referral-substatus',
          valueString: subStatus
        }
      ]
    });

    // Update associated Task
    const taskResults = await this.typeSafeSearch.searchTasks({
      focus: `ServiceRequest/${referralId}`
    });
    const tasks = taskResults.resources;

    if (tasks.length > 0) {
      const task = tasks[0];
      await this.medplum.updateResource<Task>({
        ...task,
        status: status === 'revoked' ? 'cancelled' : this.mapServiceRequestStatusToTaskStatus(status),
        businessStatus: {
          text: subStatus || status
        },
        note: notes ? [...(task.note || []), { text: notes }] : task.note
      });
    }

    // Create communication entry for status change
    await this.createReferralCommunication(
      referralId,
      'system',
      referral.requester?.reference || 'System',
      'update',
      `Referral status updated to ${status}${subStatus ? ` - ${subStatus}` : ''}`
    );

    return updatedReferral;
  }

  /**
   * Schedule appointment for referral
   */
  async scheduleReferralAppointment(
    referralId: string,
    providerId: string,
    appointmentDate: Date,
    duration: number
  ): Promise<void> {
    const referral = await this.medplum.readResource('ServiceRequest', referralId);
    
    if (!referral) {
      throw new Error('Referral not found');
    }

    // Create appointment (using existing appointment service would be ideal)
    const appointment = await this.medplum.createResource({
      resourceType: 'Appointment',
      status: 'booked',
      serviceCategory: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/service-category',
          code: 'specialty',
          display: 'Specialty'
        }]
      }],
      serviceType: [{
        text: 'Referral Appointment'
      }],
      reasonReference: [{ reference: `ServiceRequest/${referralId}` }],
      start: appointmentDate.toISOString(),
      end: new Date(appointmentDate.getTime() + duration * 60000).toISOString(),
      participant: [
        {
          actor: referral.subject as Reference<Patient | Device | HealthcareService | Location | Practitioner | PractitionerRole | RelatedPerson>,
          required: 'required',
          status: 'accepted'
        },
        {
          actor: { reference: `Practitioner/${providerId}` },
          required: 'required',
          status: 'accepted'
        }
      ]
    });

    // Update referral status
    await this.updateReferralStatus(referralId, 'active', 'appointment-scheduled', 
      `Appointment scheduled for ${appointmentDate.toLocaleDateString()}`);
  }

  /**
   * Complete referral with report
   */
  async completeReferral(
    referralId: string,
    consultProviderId: string,
    consultNote: string,
    recommendations: string,
    followUpRequired: boolean
  ): Promise<DocumentReference> {
    const referral = await this.medplum.readResource('ServiceRequest', referralId);
    
    if (!referral) {
      throw new Error('Referral not found');
    }

    // Create consultation report
    const report = await this.medplum.createResource<DocumentReference>({
      resourceType: 'DocumentReference',
      status: 'current',
      type: {
        coding: [{
          system: 'http://loinc.org',
          code: '11488-4',
          display: 'Consult note'
        }]
      },
      category: [{
        coding: [{
          system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
          code: 'clinical-note',
          display: 'Clinical Note'
        }]
      }],
      subject: referral.subject as Reference<Patient | Device | Group | Practitioner>,
      author: [{ reference: `Practitioner/${consultProviderId}` }],
      context: {
        related: [{ reference: `ServiceRequest/${referralId}` }]
      },
      content: [{
        attachment: {
          contentType: 'text/plain',
          data: btoa(`CONSULTATION REPORT\n\n${consultNote}\n\nRECOMMENDATIONS:\n${recommendations}\n\nFOLLOW-UP REQUIRED: ${followUpRequired ? 'Yes' : 'No'}`),
          title: 'Consultation Report'
        }
      }]
    });

    // Update referral status
    await this.updateReferralStatus(referralId, 'completed', 'report-available');

    // Notify referring provider
    await this.createReferralCommunication(
      referralId,
      `Practitioner/${consultProviderId}`,
      referral.requester?.reference || '',
      'report',
      'Consultation report is now available',
      [report.id!]
    );

    return report;
  }

  /**
   * Get referral history for patient
   */
  async getPatientReferralHistory(
    patientId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ServiceRequest[]> {
    const searchParams: any = {
      subject: `Patient/${patientId}`,
      _sort: '-_lastUpdated'
    };

    if (startDate) {
      searchParams.date = `ge${startDate.toISOString()}`;
    }
    if (endDate) {
      searchParams.date = searchParams.date 
        ? `${searchParams.date}&le${endDate.toISOString()}`
        : `le${endDate.toISOString()}`;
    }

    const results = await this.typeSafeSearch.searchServiceRequests(searchParams);
    return results.resources;
  }

  /**
   * Create referral communication
   */
  async createReferralCommunication(
    referralId: string,
    senderId: string,
    recipientId: string,
    messageType: ReferralCommunication['messageType'],
    message: string,
    attachments?: string[]
  ): Promise<Communication> {
    return await this.medplum.createResource<Communication>({
      resourceType: 'Communication',
      status: 'completed',
      category: [{
        coding: [{
          system: 'http://omnicare.com/communication-category',
          code: 'referral-communication',
          display: 'Referral Communication'
        }]
      }],
      priority: messageType === 'authorization' ? 'urgent' : 'routine',
      subject: { reference: `ServiceRequest/${referralId}` },
      sender: { reference: senderId },
      recipient: [{ reference: recipientId }],
      sent: new Date().toISOString(),
      payload: [
        {
          contentString: message
        },
        ...(attachments || []).map(att => ({
          contentReference: { reference: att }
        }))
      ],
      meta: {
        tag: [{
          system: 'http://omnicare.com/message-type',
          code: messageType
        }]
      }
    });
  }

  /**
   * Process authorization response
   */
  async processAuthorizationResponse(
    referralId: string,
    authorizationNumber: string,
    status: 'approved' | 'denied',
    details: Partial<ReferralAuthorization>
  ): Promise<void> {
    // Find the claim
    const claimsBundle = await this.typeSafeSearch.searchResources('Claim', {
      referral: `ServiceRequest/${referralId}`
    });
    const claims = claimsBundle.entry?.map(entry => entry.resource).filter(Boolean) || [];

    if (claims.length === 0) {
      throw new Error('No authorization request found for this referral');
    }

    // Create ClaimResponse
    await this.medplum.createResource<ClaimResponse>({
      resourceType: 'ClaimResponse',
      status: 'active',
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'professional'
        }]
      },
      use: 'preauthorization',
      patient: (claims[0] as Claim).patient,
      created: new Date().toISOString(),
      insurer: (claims[0] as Claim).insurance?.[0]?.coverage ? { reference: (claims[0] as Claim).insurance![0].coverage!.reference?.replace('Coverage/', 'Organization/') || 'Organization/unknown' } : { reference: 'Organization/unknown' },
      request: { reference: `Claim/${(claims[0] as Claim).id}` },
      outcome: status === 'approved' ? 'complete' : 'error',
      disposition: status === 'approved' 
        ? `Approved - Auth #${authorizationNumber}`
        : `Denied - ${details.denialReason || 'No reason provided'}`,
      preAuthRef: status === 'approved' ? authorizationNumber : undefined,
      item: [{
        itemSequence: 1,
        adjudication: [{
          category: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/adjudication',
              code: status === 'approved' ? 'benefit' : 'denied'
            }]
          }
        }]
      }]
    });

    // Update referral status
    if (status === 'approved') {
      await this.updateReferralStatus(referralId, 'active', 'authorization-obtained',
        `Authorization approved: ${authorizationNumber}`);
    } else {
      await this.updateReferralStatus(referralId, 'on-hold', 'pending-authorization',
        `Authorization denied: ${details.denialReason}`);
    }
  }

  /**
   * Get referrals requiring action
   */
  async getReferralsRequiringAction(providerId: string): Promise<{
    pendingAuthorization: ServiceRequest[];
    awaitingScheduling: ServiceRequest[];
    reportsToReview: ServiceRequest[];
  }> {
    // Get all active referrals for provider
    const referralsResult = await this.typeSafeSearch.searchServiceRequests({
      requester: `Practitioner/${providerId}`,
      status: 'active,on-hold'
    });
    const referrals = referralsResult.resources;

    const pendingAuthorization: ServiceRequest[] = [];
    const awaitingScheduling: ServiceRequest[] = [];
    const reportsToReview: ServiceRequest[] = [];

    for (const referral of referrals) {
      const subStatus = referral.extension?.find(
        ext => ext.url === 'http://omnicare.com/referral-substatus'
      )?.valueString;

      if (subStatus === 'pending-authorization') {
        pendingAuthorization.push(referral);
      } else if (subStatus === 'authorization-obtained' || 
                (referral.status === 'active' && !subStatus)) {
        awaitingScheduling.push(referral);
      } else if (subStatus === 'report-available') {
        reportsToReview.push(referral);
      }
    }

    return {
      pendingAuthorization,
      awaitingScheduling,
      reportsToReview
    };
  }

  /**
   * Helper method to map ServiceRequest status to Task status
   */
  private mapServiceRequestStatusToTaskStatus(status: string): Task['status'] {
    const statusMap: Record<string, Task['status']> = {
      'draft': 'draft',
      'active': 'in-progress',
      'on-hold': 'on-hold',
      'completed': 'completed',
      'cancelled': 'cancelled',
      'entered-in-error': 'entered-in-error'
    };
    return statusMap[status] || 'draft';
  }
}