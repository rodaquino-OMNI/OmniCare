/**
 * OmniCare EMR - Pharmacy Integration Service
 * Handles e-prescribing, medication orders, and pharmacy system integration
 */

import { EventEmitter } from 'events';
import logger from '@/utils/logger';
import { Medication, MedicationRequest, MedicationDispense } from '@medplum/fhirtypes';

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  prescriberId: string;
  prescriberName: string;
  prescriberDEA?: string;
  prescriberNPI: string;
  medication: MedicationDetails;
  dosageInstructions: DosageInstruction[];
  dispenseRequest: DispenseRequest;
  substitutionAllowed: boolean;
  priorAuthorizationRequired: boolean;
  status: PrescriptionStatus;
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
}

export interface MedicationDetails {
  name: string;
  code: string;
  codeSystem: 'RxNorm' | 'NDC' | 'SNOMED';
  strength: string;
  form: string;
  route: string;
  generic: boolean;
  controlledSubstance: boolean;
  scheduleClass?: string;
}

export interface DosageInstruction {
  text: string;
  timing: {
    frequency: string;
    period: number;
    periodUnit: 'h' | 'd' | 'wk' | 'mo';
    duration?: number;
    durationUnit?: 'h' | 'd' | 'wk' | 'mo';
  };
  dose: {
    value: number;
    unit: string;
  };
  asNeeded: boolean;
  asNeededReason?: string;
}

export interface DispenseRequest {
  quantity: {
    value: number;
    unit: string;
  };
  daysSupply: number;
  numberOfRefills: number;
  refillsRemaining?: number;
  validityPeriod: {
    start: Date;
    end: Date;
  };
  pharmacyId?: string;
  pharmacyName?: string;
}

export enum PrescriptionStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  SENT = 'sent',
  RECEIVED = 'received',
  IN_PROGRESS = 'in-progress',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  ERROR = 'error'
}

export interface PharmacyInfo {
  id: string;
  name: string;
  ncpdpId: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  phone: string;
  fax?: string;
  email?: string;
  hours: string;
  services: string[];
  acceptsEPrescribing: boolean;
}

export interface MedicationHistory {
  patientId: string;
  medications: MedicationRecord[];
  lastUpdated: Date;
}

export interface MedicationRecord {
  medication: MedicationDetails;
  prescribedDate: Date;
  prescriber: string;
  pharmacy?: string;
  status: string;
  fillDates: Date[];
  adherenceScore?: number;
}

export interface DrugInteraction {
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
  drug1: string;
  drug2: string;
  description: string;
  clinicalEffect: string;
  management: string;
}

export interface RefillRequest {
  prescriptionId: string;
  patientId: string;
  pharmacyId: string;
  requestedDate: Date;
  status: 'pending' | 'approved' | 'denied';
  reason?: string;
  approvedBy?: string;
  approvedDate?: Date;
}

export class PharmacyIntegrationService extends EventEmitter {
  private prescriptions: Map<string, Prescription> = new Map();
  private pharmacies: Map<string, PharmacyInfo> = new Map();
  private pendingRefills: Map<string, RefillRequest> = new Map();

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize pharmacy integration service
   */
  private async initializeService(): Promise<void> {
    logger.info('Initializing pharmacy integration service');
    // TODO: Load pharmacy directory, establish connections, etc.
  }

  /**
   * Create and send a new prescription
   */
  async createPrescription(prescriptionData: Partial<Prescription>): Promise<Prescription> {
    try {
      logger.debug('Creating new prescription');

      const prescription: Prescription = {
        id: this.generatePrescriptionId(),
        patientId: prescriptionData.patientId!,
        patientName: prescriptionData.patientName!,
        prescriberId: prescriptionData.prescriberId!,
        prescriberName: prescriptionData.prescriberName!,
        prescriberNPI: prescriptionData.prescriberNPI!,
        medication: prescriptionData.medication!,
        dosageInstructions: prescriptionData.dosageInstructions!,
        dispenseRequest: prescriptionData.dispenseRequest!,
        substitutionAllowed: prescriptionData.substitutionAllowed ?? true,
        priorAuthorizationRequired: prescriptionData.priorAuthorizationRequired ?? false,
        status: PrescriptionStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...prescriptionData
      };

      // Validate prescription
      await this.validatePrescription(prescription);

      // Check for drug interactions
      const interactions = await this.checkDrugInteractions(
        prescription.patientId,
        prescription.medication
      );

      if (interactions.length > 0) {
        logger.warn('Drug interactions detected:', interactions);
        this.emit('drugInteractions', { prescription, interactions });
      }

      // Store prescription
      this.prescriptions.set(prescription.id, prescription);

      logger.info(`Created prescription ${prescription.id} for patient ${prescription.patientId}`);
      return prescription;
    } catch (error) {
      logger.error('Failed to create prescription:', error);
      throw new Error(`Prescription creation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send prescription to pharmacy
   */
  async sendPrescription(prescriptionId: string, pharmacyId: string): Promise<void> {
    try {
      const prescription = this.prescriptions.get(prescriptionId);
      if (!prescription) {
        throw new Error('Prescription not found');
      }

      const pharmacy = this.pharmacies.get(pharmacyId);
      if (!pharmacy) {
        throw new Error('Pharmacy not found');
      }

      logger.debug(`Sending prescription ${prescriptionId} to pharmacy ${pharmacyId}`);

      // TODO: Implement actual e-prescribing transmission (NCPDP SCRIPT, Surescripts, etc.)
      
      // Update prescription status
      prescription.status = PrescriptionStatus.SENT;
      prescription.dispenseRequest.pharmacyId = pharmacyId;
      prescription.dispenseRequest.pharmacyName = pharmacy.name;
      prescription.updatedAt = new Date();

      // Emit event
      this.emit('prescriptionSent', { prescription, pharmacy });

      logger.info(`Prescription ${prescriptionId} sent to ${pharmacy.name}`);
    } catch (error) {
      logger.error('Failed to send prescription:', error);
      throw new Error(`Prescription send error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel a prescription
   */
  async cancelPrescription(prescriptionId: string, reason: string): Promise<void> {
    try {
      const prescription = this.prescriptions.get(prescriptionId);
      if (!prescription) {
        throw new Error('Prescription not found');
      }

      logger.debug(`Cancelling prescription ${prescriptionId}`);

      // TODO: Send cancellation to pharmacy if already sent
      
      prescription.status = PrescriptionStatus.CANCELLED;
      prescription.notes = `Cancelled: ${reason}`;
      prescription.updatedAt = new Date();

      this.emit('prescriptionCancelled', { prescription, reason });

      logger.info(`Prescription ${prescriptionId} cancelled`);
    } catch (error) {
      logger.error('Failed to cancel prescription:', error);
      throw new Error(`Prescription cancellation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get prescription status from pharmacy
   */
  async checkPrescriptionStatus(prescriptionId: string): Promise<PrescriptionStatus> {
    try {
      const prescription = this.prescriptions.get(prescriptionId);
      if (!prescription) {
        throw new Error('Prescription not found');
      }

      logger.debug(`Checking status for prescription ${prescriptionId}`);

      // TODO: Query pharmacy system for real-time status
      
      return prescription.status;
    } catch (error) {
      logger.error('Failed to check prescription status:', error);
      throw new Error(`Status check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process refill request
   */
  async processRefillRequest(refillRequest: RefillRequest): Promise<void> {
    try {
      logger.debug(`Processing refill request for prescription ${refillRequest.prescriptionId}`);

      const prescription = this.prescriptions.get(refillRequest.prescriptionId);
      if (!prescription) {
        throw new Error('Prescription not found');
      }

      // Check if refills are available
      if (prescription.dispenseRequest.refillsRemaining === 0) {
        refillRequest.status = 'denied';
        refillRequest.reason = 'No refills remaining';
      } else {
        // TODO: Apply business rules for automatic approval
        refillRequest.status = 'pending';
      }

      this.pendingRefills.set(refillRequest.prescriptionId, refillRequest);
      this.emit('refillRequested', refillRequest);

      logger.info(`Refill request processed for prescription ${refillRequest.prescriptionId}`);
    } catch (error) {
      logger.error('Failed to process refill request:', error);
      throw new Error(`Refill request error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Approve or deny refill request
   */
  async respondToRefillRequest(
    prescriptionId: string, 
    approved: boolean, 
    approverId: string,
    reason?: string
  ): Promise<void> {
    try {
      const refillRequest = this.pendingRefills.get(prescriptionId);
      if (!refillRequest) {
        throw new Error('Refill request not found');
      }

      refillRequest.status = approved ? 'approved' : 'denied';
      refillRequest.approvedBy = approverId;
      refillRequest.approvedDate = new Date();
      refillRequest.reason = reason;

      if (approved) {
        const prescription = this.prescriptions.get(prescriptionId);
        if (prescription && prescription.dispenseRequest.refillsRemaining) {
          prescription.dispenseRequest.refillsRemaining--;
        }
      }

      this.emit('refillResponse', refillRequest);

      logger.info(`Refill request for ${prescriptionId} ${approved ? 'approved' : 'denied'}`);
    } catch (error) {
      logger.error('Failed to respond to refill request:', error);
      throw new Error(`Refill response error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get patient medication history
   */
  async getMedicationHistory(patientId: string): Promise<MedicationHistory> {
    try {
      logger.debug(`Retrieving medication history for patient ${patientId}`);

      // TODO: Query pharmacy systems and PBMs for comprehensive history
      
      const patientPrescriptions = Array.from(this.prescriptions.values())
        .filter(p => p.patientId === patientId);

      const medications: MedicationRecord[] = patientPrescriptions.map(p => ({
        medication: p.medication,
        prescribedDate: p.createdAt,
        prescriber: p.prescriberName,
        pharmacy: p.dispenseRequest.pharmacyName,
        status: p.status,
        fillDates: [], // TODO: Get actual fill dates from pharmacy
        adherenceScore: undefined // TODO: Calculate adherence
      }));

      const history: MedicationHistory = {
        patientId,
        medications,
        lastUpdated: new Date()
      };

      logger.info(`Retrieved ${medications.length} medications for patient ${patientId}`);
      return history;
    } catch (error) {
      logger.error('Failed to get medication history:', error);
      throw new Error(`Medication history error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check for drug interactions
   */
  async checkDrugInteractions(
    patientId: string, 
    newMedication: MedicationDetails
  ): Promise<DrugInteraction[]> {
    try {
      logger.debug(`Checking drug interactions for ${newMedication.name}`);

      // TODO: Integrate with drug interaction database (e.g., First Databank, Micromedex)
      
      const interactions: DrugInteraction[] = [];
      
      // Get patient's current medications
      const history = await this.getMedicationHistory(patientId);
      const currentMeds = history.medications
        .filter(m => m.status === 'active' || m.status === 'filled');

      // TODO: Implement actual interaction checking logic
      
      logger.info(`Found ${interactions.length} drug interactions`);
      return interactions;
    } catch (error) {
      logger.error('Failed to check drug interactions:', error);
      throw new Error(`Drug interaction check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for pharmacies
   */
  async searchPharmacies(criteria: {
    zipCode?: string;
    city?: string;
    state?: string;
    radius?: number;
    services?: string[];
  }): Promise<PharmacyInfo[]> {
    try {
      logger.debug('Searching for pharmacies:', criteria);

      // TODO: Implement pharmacy search using NCPDP directory or similar
      
      const results = Array.from(this.pharmacies.values()).filter(pharmacy => {
        if (criteria.zipCode && !pharmacy.address.zipCode.startsWith(criteria.zipCode)) {
          return false;
        }
        if (criteria.city && pharmacy.address.city !== criteria.city) {
          return false;
        }
        if (criteria.state && pharmacy.address.state !== criteria.state) {
          return false;
        }
        if (criteria.services) {
          const hasAllServices = criteria.services.every(service => 
            pharmacy.services.includes(service)
          );
          if (!hasAllServices) return false;
        }
        return true;
      });

      logger.info(`Found ${results.length} pharmacies matching criteria`);
      return results;
    } catch (error) {
      logger.error('Failed to search pharmacies:', error);
      throw new Error(`Pharmacy search error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate prescription before sending
   */
  private async validatePrescription(prescription: Prescription): Promise<void> {
    const errors: string[] = [];

    // Basic validation
    if (!prescription.patientId) errors.push('Patient ID is required');
    if (!prescription.prescriberId) errors.push('Prescriber ID is required');
    if (!prescription.medication?.name) errors.push('Medication name is required');
    if (!prescription.dosageInstructions?.length) errors.push('Dosage instructions are required');
    if (!prescription.dispenseRequest?.quantity) errors.push('Dispense quantity is required');

    // Controlled substance validation
    if (prescription.medication?.controlledSubstance) {
      if (!prescription.prescriberDEA) {
        errors.push('DEA number required for controlled substances');
      }
      // TODO: Additional controlled substance checks
    }

    if (errors.length > 0) {
      throw new Error(`Prescription validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Generate unique prescription ID
   */
  private generatePrescriptionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `rx_${timestamp}${random}`;
  }

  /**
   * Convert to FHIR MedicationRequest
   */
  async toFHIRMedicationRequest(prescription: Prescription): Promise<MedicationRequest> {
    // TODO: Implement full FHIR conversion
    return {
      resourceType: 'MedicationRequest',
      id: prescription.id,
      status: this.mapPrescriptionStatusToFHIR(prescription.status),
      intent: 'order',
      medicationCodeableConcept: {
        coding: [{
          system: `http://www.nlm.nih.gov/research/umls/rxnorm`,
          code: prescription.medication.code,
          display: prescription.medication.name
        }]
      },
      subject: {
        reference: `Patient/${prescription.patientId}`,
        display: prescription.patientName
      },
      requester: {
        reference: `Practitioner/${prescription.prescriberId}`,
        display: prescription.prescriberName
      },
      dosageInstruction: prescription.dosageInstructions.map(di => ({
        text: di.text,
        timing: {
          repeat: {
            frequency: 1,
            period: di.timing.period,
            periodUnit: di.timing.periodUnit
          }
        },
        doseAndRate: [{
          doseQuantity: {
            value: di.dose.value,
            unit: di.dose.unit
          }
        }],
        asNeededBoolean: di.asNeeded
      })),
      dispenseRequest: {
        quantity: {
          value: prescription.dispenseRequest.quantity.value,
          unit: prescription.dispenseRequest.quantity.unit
        },
        numberOfRepeatsAllowed: prescription.dispenseRequest.numberOfRefills,
        expectedSupplyDuration: {
          value: prescription.dispenseRequest.daysSupply,
          unit: 'd'
        }
      }
    };
  }

  /**
   * Map internal status to FHIR status
   */
  private mapPrescriptionStatusToFHIR(status: PrescriptionStatus): string {
    const mapping: Record<PrescriptionStatus, string> = {
      [PrescriptionStatus.DRAFT]: 'draft',
      [PrescriptionStatus.ACTIVE]: 'active',
      [PrescriptionStatus.SENT]: 'active',
      [PrescriptionStatus.RECEIVED]: 'active',
      [PrescriptionStatus.IN_PROGRESS]: 'active',
      [PrescriptionStatus.FILLED]: 'completed',
      [PrescriptionStatus.CANCELLED]: 'cancelled',
      [PrescriptionStatus.EXPIRED]: 'stopped',
      [PrescriptionStatus.ERROR]: 'entered-in-error'
    };
    return mapping[status] || 'unknown';
  }

  /**
   * Get service health status
   */
  getHealthStatus(): { status: string; details: any } {
    return {
      status: 'UP',
      details: {
        prescriptionsCount: this.prescriptions.size,
        pharmaciesCount: this.pharmacies.size,
        pendingRefillsCount: this.pendingRefills.size
      }
    };
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.removeAllListeners();
    this.prescriptions.clear();
    this.pharmacies.clear();
    this.pendingRefills.clear();
    logger.info('Pharmacy integration service shut down');
  }
}

// Export singleton instance
export const pharmacyIntegrationService = new PharmacyIntegrationService();