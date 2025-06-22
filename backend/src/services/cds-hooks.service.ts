import axios from 'axios';

import { fhirResourcesService } from './fhir-resources.service';
import { medplumService } from './medplum.service';

import config from '@/config';
import {
  CDSHookRequest,
  CDSHookResponse,
  CDSCard,
  CDSSuggestion,
  CDSAction,
  CDSHookContext,
  Patient,
  Encounter,
  MedicationRequest,
  ServiceRequest,
  Observation,
} from '@/types/fhir';
import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error.utils';

interface CDSService {
  hook: string;
  name: string;
  title: string;
  description: string;
  id: string;
  prefetch?: { [key: string]: string };
  usageRequirements?: string;
}

/**
 * Clinical Decision Support Hooks Service
 * Implements CDS Hooks specification for clinical decision support
 * integration with EHR workflows
 */
export class CDSHooksService {
  private readonly services: CDSService[] = [
    {
      hook: 'patient-view',
      name: 'Patient Risk Assessment',
      title: 'OmniCare Patient Risk Assessment',
      description: 'Assess patient risk factors and provide preventive care recommendations',
      id: 'omnicare-patient-risk-assessment',
      prefetch: {
        patient: 'Patient/{{context.patientId}}',
        conditions: 'Condition?patient={{context.patientId}}',
        medications: 'MedicationRequest?patient={{context.patientId}}&status=active',
        observations: 'Observation?patient={{context.patientId}}&category=vital-signs&_sort=-date&_count=10',
        allergies: 'AllergyIntolerance?patient={{context.patientId}}',
      },
    },
    {
      hook: 'medication-prescribe',
      name: 'Medication Safety Check',
      title: 'OmniCare Medication Safety Check',
      description: 'Check for drug interactions, allergies, and dosing recommendations',
      id: 'omnicare-medication-safety',
      prefetch: {
        patient: 'Patient/{{context.patientId}}',
        medications: 'MedicationRequest?patient={{context.patientId}}&status=active',
        allergies: 'AllergyIntolerance?patient={{context.patientId}}',
        conditions: 'Condition?patient={{context.patientId}}',
        observations: 'Observation?patient={{context.patientId}}&category=laboratory&_sort=-date&_count=5',
      },
    },
    {
      hook: 'order-review',
      name: 'Order Appropriateness',
      title: 'OmniCare Order Appropriateness Check',
      description: 'Review diagnostic and therapeutic orders for appropriateness',
      id: 'omnicare-order-review',
      prefetch: {
        patient: 'Patient/{{context.patientId}}',
        conditions: 'Condition?patient={{context.patientId}}',
        observations: 'Observation?patient={{context.patientId}}&_sort=-date&_count=20',
        procedures: 'Procedure?patient={{context.patientId}}&_sort=-date&_count=10',
      },
    },
    {
      hook: 'encounter-start',
      name: 'Encounter Preparation',
      title: 'OmniCare Encounter Preparation',
      description: 'Prepare encounter with relevant patient information and care gaps',
      id: 'omnicare-encounter-prep',
      prefetch: {
        patient: 'Patient/{{context.patientId}}',
        encounter: 'Encounter/{{context.encounterId}}',
        conditions: 'Condition?patient={{context.patientId}}',
        medications: 'MedicationRequest?patient={{context.patientId}}&status=active',
        carePlans: 'CarePlan?patient={{context.patientId}}&status=active',
      },
    },
    {
      hook: 'encounter-discharge',
      name: 'Discharge Planning',
      title: 'OmniCare Discharge Planning',
      description: 'Assist with discharge planning and follow-up care coordination',
      id: 'omnicare-discharge-planning',
      prefetch: {
        patient: 'Patient/{{context.patientId}}',
        encounter: 'Encounter/{{context.encounterId}}',
        conditions: 'Condition?patient={{context.patientId}}',
        medications: 'MedicationRequest?patient={{context.patientId}}&status=active',
        procedures: 'Procedure?patient={{context.patientId}}&encounter={{context.encounterId}}',
      },
    },
  ];

  // ===============================
  // CDS HOOKS DISCOVERY
  // ===============================

  /**
   * Get CDS services discovery document
   */
  getDiscoveryDocument(): { services: CDSService[] } {
    logger.info('CDS Hooks discovery document requested');
    
    return {
      services: this.services.map(service => ({
        ...service,
        usageRequirements: service.usageRequirements || 'User must be authenticated with appropriate clinical permissions',
      })),
    };
  }

  // ===============================
  // CDS HOOKS EXECUTION
  // ===============================

  /**
   * Execute patient-view hook
   */
  async executePatientView(request: CDSHookRequest): Promise<CDSHookResponse> {
    try {
      logger.info('Executing patient-view CDS hook', {
        hookInstance: request.hookInstance,
        patientId: request.context.patientId,
      });

      const cards: CDSCard[] = [];
      const prefetchData = request.prefetch || {};

      // Get patient data
      const patient = prefetchData.patient || 
        (request.context.patientId ? await fhirResourcesService.getPatient(request.context.patientId) : null);

      // Risk assessment card
      const riskCard = await this.assessPatientRisk(patient, prefetchData);
      if (riskCard) cards.push(riskCard);

      // Preventive care card
      const preventiveCard = await this.checkPreventiveCare(patient, prefetchData);
      if (preventiveCard) cards.push(preventiveCard);

      // Care gaps card
      const careGapsCard = await this.identifyCareGaps(patient, prefetchData);
      if (careGapsCard) cards.push(careGapsCard);

      logger.info('Patient-view CDS hook completed', {
        hookInstance: request.hookInstance,
        cardsGenerated: cards.length,
      });

      return { cards };
    } catch (error) {
      logger.error('Failed to execute patient-view hook:', error);
      throw error;
    }
  }

  /**
   * Execute medication-prescribe hook
   */
  async executeMedicationPrescribe(request: CDSHookRequest): Promise<CDSHookResponse> {
    try {
      logger.info('Executing medication-prescribe CDS hook', {
        hookInstance: request.hookInstance,
        patientId: request.context.patientId,
        draftOrders: request.context.draftOrders?.length || 0,
      });

      const cards: CDSCard[] = [];
      const prefetchData = request.prefetch || {};

      // Get patient data
      const patient = prefetchData.patient || 
        (request.context.patientId ? await fhirResourcesService.getPatient(request.context.patientId) : null);

      // Check each draft medication order
      for (const draftOrder of request.context.draftOrders || []) {
        if (draftOrder.resourceType === 'MedicationRequest') {
          // Drug interaction check
          const interactionCard = await this.checkDrugInteractions(draftOrder, prefetchData);
          if (interactionCard) cards.push(interactionCard);

          // Allergy check
          const allergyCard = await this.checkDrugAllergies(draftOrder, patient, prefetchData);
          if (allergyCard) cards.push(allergyCard);

          // Dosing recommendation
          const dosingCard = await this.checkDosing(draftOrder, patient, prefetchData);
          if (dosingCard) cards.push(dosingCard);

          // Contraindication check
          const contraindicationCard = await this.checkContraindications(draftOrder, prefetchData);
          if (contraindicationCard) cards.push(contraindicationCard);
        }
      }

      logger.info('Medication-prescribe CDS hook completed', {
        hookInstance: request.hookInstance,
        cardsGenerated: cards.length,
      });

      return { cards };
    } catch (error) {
      logger.error('Failed to execute medication-prescribe hook:', error);
      throw error;
    }
  }

  /**
   * Execute order-review hook
   */
  async executeOrderReview(request: CDSHookRequest): Promise<CDSHookResponse> {
    try {
      logger.info('Executing order-review CDS hook', {
        hookInstance: request.hookInstance,
        patientId: request.context.patientId,
        draftOrders: request.context.draftOrders?.length || 0,
      });

      const cards: CDSCard[] = [];
      const prefetchData = request.prefetch || {};

      // Get patient data
      const patient = prefetchData.patient || 
        (request.context.patientId ? await fhirResourcesService.getPatient(request.context.patientId) : null);

      // Check each draft order
      for (const draftOrder of request.context.draftOrders || []) {
        if (draftOrder.resourceType === 'ServiceRequest') {
          // Order appropriateness check
          const appropriatenessCard = await this.checkOrderAppropriateness(draftOrder, patient, prefetchData);
          if (appropriatenessCard) cards.push(appropriatenessCard);

          // Duplicate order check
          const duplicateCard = await this.checkDuplicateOrders(draftOrder, prefetchData);
          if (duplicateCard) cards.push(duplicateCard);

          // Cost-effectiveness check
          const costCard = await this.checkCostEffectiveness(draftOrder, patient);
          if (costCard) cards.push(costCard);
        }
      }

      logger.info('Order-review CDS hook completed', {
        hookInstance: request.hookInstance,
        cardsGenerated: cards.length,
      });

      return { cards };
    } catch (error) {
      logger.error('Failed to execute order-review hook:', error);
      throw error;
    }
  }

  // ===============================
  // CLINICAL DECISION LOGIC
  // ===============================

  /**
   * Assess patient risk factors
   */
  private async assessPatientRisk(patient: Patient, prefetchData: any): Promise<CDSCard | null> {
    try {
      const conditions = prefetchData.conditions?.entry?.map((e: any) => e.resource) || [];
      const observations = prefetchData.observations?.entry?.map((e: any) => e.resource) || [];

      const riskFactors: string[] = [];
      
      // Check for diabetes
      if (conditions.some((c: any) => 
        c.code?.coding?.some((coding: any) => 
          coding.code === 'E11' || coding.display?.toLowerCase().includes('diabetes')
        )
      )) {
        riskFactors.push('Type 2 Diabetes');
      }

      // Check for hypertension
      if (conditions.some((c: any) => 
        c.code?.coding?.some((coding: any) => 
          coding.code === 'I10' || coding.display?.toLowerCase().includes('hypertension')
        )
      )) {
        riskFactors.push('Hypertension');
      }

      // Check vital signs for risk factors
      const latestBP = observations.find((o: any) => 
        o.code?.coding?.some((c: any) => c.code === '85354-9')
      );
      
      if (latestBP?.component) {
        const systolic = latestBP.component.find((c: any) => 
          c.code?.coding?.some((coding: any) => coding.code === '8480-6')
        )?.valueQuantity?.value;
        
        const diastolic = latestBP.component.find((c: any) => 
          c.code?.coding?.some((coding: any) => coding.code === '8462-4')
        )?.valueQuantity?.value;

        if (systolic >= 140 || diastolic >= 90) {
          riskFactors.push('Elevated Blood Pressure');
        }
      }

      if (riskFactors.length === 0) return null;

      return {
        summary: `Patient has ${riskFactors.length} identified risk factor(s)`,
        detail: `Risk factors identified: ${riskFactors.join(', ')}. Consider preventive interventions and closer monitoring.`,
        indicator: 'warning',
        source: {
          label: 'OmniCare Risk Assessment',
          url: 'https://omnicare.com/clinical-guidelines/risk-assessment',
        },
        suggestions: [{
          label: 'Review care plan for risk management',
          actions: [{
            type: 'create',
            description: 'Create care plan for risk factor management',
            resource: {
              resourceType: 'CarePlan',
              status: 'draft',
              intent: 'plan',
              subject: { reference: `Patient/${patient.id}` },
              title: 'Risk Factor Management Plan',
              description: `Management plan for identified risk factors: ${riskFactors.join(', ')}`,
            },
          }],
        }],
      };
    } catch (error) {
      logger.error('Failed to assess patient risk:', error);
      return null;
    }
  }

  /**
   * Check preventive care recommendations
   */
  private async checkPreventiveCare(patient: Patient, prefetchData: any): Promise<CDSCard | null> {
    try {
      if (!patient.birthDate) return null;

      const age = new Date().getFullYear() - new Date(patient.birthDate).getFullYear();
      const recommendations: string[] = [];

      // Age-based screening recommendations
      if (age >= 50) {
        recommendations.push('Colorectal cancer screening');
        recommendations.push('Annual wellness visit');
      }

      if (age >= 40 && patient.gender === 'female') {
        recommendations.push('Mammography screening');
      }

      if (age >= 65) {
        recommendations.push('Pneumococcal vaccination');
        recommendations.push('Annual influenza vaccination');
      }

      if (recommendations.length === 0) return null;

      return {
        summary: `${recommendations.length} preventive care recommendation(s)`,
        detail: `Recommended preventive care: ${recommendations.join(', ')}`,
        indicator: 'info',
        source: {
          label: 'OmniCare Preventive Care Guidelines',
          url: 'https://omnicare.com/clinical-guidelines/preventive-care',
        },
        links: [{
          label: 'View full preventive care guidelines',
          url: 'https://omnicare.com/clinical-guidelines/preventive-care',
          type: 'absolute',
        }],
      };
    } catch (error) {
      logger.error('Failed to check preventive care:', error);
      return null;
    }
  }

  /**
   * Identify care gaps
   */
  private async identifyCareGaps(patient: Patient, prefetchData: any): Promise<CDSCard | null> {
    try {
      const conditions = prefetchData.conditions?.entry?.map((e: any) => e.resource) || [];
      const medications = prefetchData.medications?.entry?.map((e: any) => e.resource) || [];
      const observations = prefetchData.observations?.entry?.map((e: any) => e.resource) || [];

      const careGaps: string[] = [];

      // Check for diabetes management gaps
      const hasDiabetes = conditions.some((c: any) => 
        c.code?.coding?.some((coding: any) => 
          coding.display?.toLowerCase().includes('diabetes')
        )
      );

      if (hasDiabetes) {
        const hasA1C = observations.some((o: any) => 
          o.code?.coding?.some((c: any) => c.code === '4548-4' || c.display?.includes('A1C'))
        );
        
        if (!hasA1C) {
          careGaps.push('Missing HbA1c monitoring for diabetes');
        }
      }

      if (careGaps.length === 0) return null;

      return {
        summary: `${careGaps.length} care gap(s) identified`,
        detail: `Care gaps: ${careGaps.join(', ')}`,
        indicator: 'warning',
        source: {
          label: 'OmniCare Care Gap Analysis',
          url: 'https://omnicare.com/clinical-guidelines/care-gaps',
        },
      };
    } catch (error) {
      logger.error('Failed to identify care gaps:', error);
      return null;
    }
  }

  /**
   * Check for drug interactions
   */
  private async checkDrugInteractions(
    medicationRequest: MedicationRequest, 
    prefetchData: any
  ): Promise<CDSCard | null> {
    try {
      const currentMedications = prefetchData.medications?.entry?.map((e: any) => e.resource) || [];
      
      // This is a simplified example - in practice, you'd use a drug interaction database
      const newMedication = medicationRequest.medicationCodeableConcept?.coding?.[0]?.display;
      
      if (!newMedication) return null;

      // Example interaction check (simplified)
      const interactions = this.checkForKnownInteractions(newMedication, currentMedications);
      
      if (interactions.length === 0) return null;

      return {
        summary: `${interactions.length} potential drug interaction(s) detected`,
        detail: `Potential interactions: ${interactions.join(', ')}`,
        indicator: 'critical',
        source: {
          label: 'OmniCare Drug Interaction Check',
          url: 'https://omnicare.com/clinical-guidelines/drug-interactions',
        },
        suggestions: [{
          label: 'Review interaction and consider alternatives',
          actions: [{
            type: 'delete',
            description: 'Remove problematic medication order',
            resourceId: medicationRequest.id,
          }],
        }],
      };
    } catch (error) {
      logger.error('Failed to check drug interactions:', error);
      return null;
    }
  }

  /**
   * Check for drug allergies
   */
  private async checkDrugAllergies(
    medicationRequest: MedicationRequest,
    patient: Patient,
    prefetchData: any
  ): Promise<CDSCard | null> {
    try {
      const allergies = prefetchData.allergies?.entry?.map((e: any) => e.resource) || [];
      const newMedication = medicationRequest.medicationCodeableConcept?.coding?.[0]?.display;
      
      if (!newMedication || allergies.length === 0) return null;

      // Check for allergen matches (simplified)
      const matchingAllergies = allergies.filter((allergy: any) => 
        allergy.code?.coding?.some((coding: any) => 
          coding.display?.toLowerCase().includes(newMedication.toLowerCase()) ||
          newMedication.toLowerCase().includes(coding.display?.toLowerCase())
        )
      );

      if (matchingAllergies.length === 0) return null;

      return {
        summary: 'ALLERGY ALERT: Patient has documented allergy',
        detail: `Patient has documented allergy to ${newMedication}. Reaction: ${matchingAllergies[0].reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display || 'Unknown'}`,
        indicator: 'critical',
        source: {
          label: 'OmniCare Allergy Check',
        },
        suggestions: [{
          label: 'Cancel order due to allergy',
          actions: [{
            type: 'delete',
            description: 'Remove order due to patient allergy',
            resourceId: medicationRequest.id,
          }],
        }],
      };
    } catch (error) {
      logger.error('Failed to check drug allergies:', error);
      return null;
    }
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Simplified drug interaction checking
   */
  private checkForKnownInteractions(newMedication: string, currentMedications: any[]): string[] {
    const interactions: string[] = [];
    
    // This is a very simplified example - in practice, use a comprehensive drug database
    const knownInteractions: { [key: string]: string[] } = {
      'warfarin': ['aspirin', 'ibuprofen', 'naproxen'],
      'digoxin': ['furosemide', 'spironolactone'],
      'metformin': [], // Add interactions as needed
    };

    const newMedLower = newMedication.toLowerCase();
    
    currentMedications.forEach(med => {
      const currentMedName = med.medicationCodeableConcept?.coding?.[0]?.display?.toLowerCase();
      
      if (currentMedName) {
        // Check if new medication interacts with current medication
        Object.entries(knownInteractions).forEach(([drug, interactsWith]) => {
          if (newMedLower.includes(drug) && interactsWith.some(interaction => 
            currentMedName.includes(interaction)
          )) {
            interactions.push(`${newMedication} + ${currentMedName}`);
          }
        });
      }
    });

    return interactions;
  }

  /**
   * Simplified dosing check
   */
  private async checkDosing(
    medicationRequest: MedicationRequest,
    patient: Patient,
    prefetchData: any
  ): Promise<CDSCard | null> {
    // This would implement dosing algorithms based on patient characteristics
    // For now, return null (no dosing recommendations)
    return null;
  }

  /**
   * Check contraindications
   */
  private async checkContraindications(
    medicationRequest: MedicationRequest,
    prefetchData: any
  ): Promise<CDSCard | null> {
    // This would check for contraindications based on patient conditions
    // For now, return null (no contraindications found)
    return null;
  }

  /**
   * Check order appropriateness
   */
  private async checkOrderAppropriateness(
    serviceRequest: ServiceRequest,
    patient: Patient,
    prefetchData: any
  ): Promise<CDSCard | null> {
    // This would implement clinical guidelines for order appropriateness
    // For now, return null (order is appropriate)
    return null;
  }

  /**
   * Check for duplicate orders
   */
  private async checkDuplicateOrders(
    serviceRequest: ServiceRequest,
    prefetchData: any
  ): Promise<CDSCard | null> {
    // This would check for recent similar orders
    // For now, return null (no duplicates found)
    return null;
  }

  /**
   * Check cost-effectiveness
   */
  private async checkCostEffectiveness(
    serviceRequest: ServiceRequest,
    patient: Patient
  ): Promise<CDSCard | null> {
    // This would implement cost-effectiveness analysis
    // For now, return null (order is cost-effective)
    return null;
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{ status: string; details: any }> {
    try {
      return {
        status: 'UP',
        details: {
          servicesAvailable: this.services.length,
          services: this.services.map(s => ({ id: s.id, hook: s.hook, name: s.name })),
        },
      };
    } catch (error) {
      return {
        status: 'DOWN',
        details: { error: getErrorMessage(error) },
      };
    }
  }
}

// Export singleton instance
export const cdsHooksService = new CDSHooksService();