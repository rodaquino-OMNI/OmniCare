/**
 * OmniCare CDS Hooks Service
 * 
 * Implementation of CDS Hooks specification for medication-prescribe and order-select hooks
 * Provides real-time clinical decision support during medication ordering and clinical workflows
 */

import {
  CDSHookRequest,
  CDSHookResponse,
  CDSCard,
  Patient,
  Medication,
  DrugInteraction,
  AllergyAlert,
  Alert,
  CDSConfiguration
} from '../types/CDSTypes';

import { DrugInteractionService } from '../interactions/DrugInteractionService';
import { AllergyAlertService } from '../allergies/AllergyAlertService';
import { ClinicalGuidelinesService } from '../guidelines/ClinicalGuidelinesService';

export class CDSHooksService {
  private drugInteractionService: DrugInteractionService;
  private allergyAlertService: AllergyAlertService;
  private guidelinesService: ClinicalGuidelinesService;
  private config: CDSConfiguration;

  constructor(config: CDSConfiguration) {
    this.config = config;
    this.drugInteractionService = new DrugInteractionService();
    this.allergyAlertService = new AllergyAlertService();
    this.guidelinesService = new ClinicalGuidelinesService();
  }

  /**
   * Main entry point for processing CDS Hook requests
   */
  async processHook(request: CDSHookRequest): Promise<CDSHookResponse> {
    try {
      const startTime = Date.now();
      
      // Validate request
      if (!this.validateRequest(request)) {
        throw new Error('Invalid CDS Hook request');
      }

      // Get patient data
      const patient = await this.getPatientData(request.context.patientId);
      
      let cards: CDSCard[] = [];

      // Process different hook types
      switch (request.hook) {
        case 'medication-prescribe':
          cards = await this.processMedicationPrescribeHook(request, patient);
          break;
        case 'order-select':
          cards = await this.processOrderSelectHook(request, patient);
          break;
        case 'patient-view':
          cards = await this.processPatientViewHook(request, patient);
          break;
        default:
          console.warn(`Unsupported hook type: ${request.hook}`);
      }

      // Filter cards based on configuration
      cards = this.filterCards(cards);

      // Check response time
      const responseTime = Date.now() - startTime;
      if (responseTime > this.config.timeouts.hookResponse) {
        console.warn(`CDS Hook response time exceeded threshold: ${responseTime}ms`);
      }

      return {
        cards,
        systemActions: []
      };

    } catch (error) {
      console.error('Error processing CDS Hook:', error);
      return {
        cards: [{
          summary: 'Clinical decision support temporarily unavailable',
          indicator: 'warning',
          source: {
            label: 'OmniCare CDS',
            url: 'https://omnicare.example.com/cds'
          }
        }]
      };
    }
  }

  /**
   * Process medication-prescribe hook
   * Triggered when a medication is being prescribed
   */
  private async processMedicationPrescribeHook(
    request: CDSHookRequest, 
    patient: Patient
  ): Promise<CDSCard[]> {
    const cards: CDSCard[] = [];
    const proposedMedications = this.extractMedicationsFromDraft(request.context.draft);

    for (const medication of proposedMedications) {
      // Check for drug interactions
      const interactions = await this.drugInteractionService.checkInteractions(
        medication,
        patient.currentMedications
      );
      cards.push(...this.createInteractionCards(interactions));

      // Check for allergies
      const allergyAlerts = await this.allergyAlertService.checkAllergies(
        medication,
        patient.allergies
      );
      cards.push(...this.createAllergyCards(allergyAlerts));

      // Check dosing appropriateness
      const dosingCards = await this.checkDosing(medication, patient);
      cards.push(...dosingCards);

      // Check for duplicate therapy
      const duplicateCards = this.checkDuplicateTherapy(medication, patient.currentMedications);
      cards.push(...duplicateCards);

      // Check clinical guidelines
      const guidelineCards = await this.checkClinicalGuidelines(medication, patient);
      cards.push(...guidelineCards);
    }

    return cards;
  }

  /**
   * Process order-select hook
   * Triggered when clinical orders are being selected
   */
  private async processOrderSelectHook(
    request: CDSHookRequest,
    patient: Patient
  ): Promise<CDSCard[]> {
    const cards: CDSCard[] = [];
    const selectedOrders = request.context.selections || [];

    for (const orderId of selectedOrders) {
      // Get order details (this would integrate with your order management system)
      const order = await this.getOrderDetails(orderId);
      
      if (order.type === 'medication') {
        // Apply medication-specific checks
        const medicationCards = await this.processMedicationPrescribeHook(request, patient);
        cards.push(...medicationCards);
      } else if (order.type === 'diagnostic') {
        // Check diagnostic appropriateness
        const diagnosticCards = await this.checkDiagnosticAppropriateness(order, patient);
        cards.push(...diagnosticCards);
      } else if (order.type === 'procedure') {
        // Check procedure appropriateness
        const procedureCards = await this.checkProcedureAppropriateness(order, patient);
        cards.push(...procedureCards);
      }
    }

    return cards;
  }

  /**
   * Process patient-view hook
   * Triggered when viewing patient summary
   */
  private async processPatientViewHook(
    request: CDSHookRequest,
    patient: Patient
  ): Promise<CDSCard[]> {
    const cards: CDSCard[] = [];

    // Check for preventive care reminders
    const preventiveCareCards = await this.checkPreventiveCare(patient);
    cards.push(...preventiveCareCards);

    // Check quality measure gaps
    const qualityCards = await this.checkQualityMeasureGaps(patient);
    cards.push(...qualityCards);

    // Risk stratification alerts
    const riskCards = await this.checkRiskStratification(patient);
    cards.push(...riskCards);

    return cards;
  }

  /**
   * Create cards for drug interactions
   */
  private createInteractionCards(interactions: DrugInteraction[]): CDSCard[] {
    return interactions
      .filter(interaction => this.shouldAlertForInteraction(interaction))
      .map(interaction => ({
        summary: `${interaction.severity} drug interaction: ${interaction.drug1} + ${interaction.drug2}`,
        detail: `${interaction.effect}\n\nManagement: ${interaction.management}`,
        indicator: this.getIndicatorForSeverity(interaction.severity),
        source: {
          label: 'Drug Interaction Database',
          url: `https://omnicare.example.com/interactions/${interaction.interactionId}`
        },
        suggestions: [{
          label: 'Review interaction details',
          actions: [{
            type: 'create',
            description: 'Open interaction details',
            resource: {
              resourceType: 'Communication',
              category: 'drug-interaction-review',
              payload: interaction
            }
          }]
        }],
        overrideReasons: [
          { code: 'patient-tolerates', display: 'Patient tolerates combination well' },
          { code: 'benefit-outweighs-risk', display: 'Benefit outweighs risk' },
          { code: 'monitoring-planned', display: 'Appropriate monitoring planned' }
        ]
      }));
  }

  /**
   * Create cards for allergy alerts
   */
  private createAllergyCards(allergyAlerts: AllergyAlert[]): CDSCard[] {
    return allergyAlerts.map(alert => ({
      summary: `Allergy Alert: ${alert.allergen}`,
      detail: alert.message,
      indicator: alert.severity === 'High' ? 'critical' : 'warning',
      source: {
        label: 'Allergy Database',
        url: `https://omnicare.example.com/allergies/${alert.alertId}`
      },
      suggestions: [{
        label: 'Select alternative medication',
        actions: [{
          type: 'create',
          description: 'Open alternative medication selector',
          resource: {
            resourceType: 'MedicationRequest',
            status: 'draft',
            intent: 'order'
          }
        }]
      }],
      overrideReasons: [
        { code: 'allergy-unconfirmed', display: 'Allergy status unconfirmed' },
        { code: 'no-alternative', display: 'No suitable alternative available' },
        { code: 'life-threatening-indication', display: 'Life-threatening indication' }
      ]
    }));
  }

  /**
   * Check medication dosing appropriateness
   */
  private async checkDosing(medication: Medication, patient: Patient): Promise<CDSCard[]> {
    const cards: CDSCard[] = [];

    // Check weight-based dosing
    if (this.isWeightBasedMedication(medication) && !patient.demographics.weight) {
      cards.push({
        summary: 'Weight required for safe dosing',
        detail: `${medication.name} requires weight-based dosing. Please record patient weight.`,
        indicator: 'warning',
        source: {
          label: 'Dosing Safety',
          url: 'https://omnicare.example.com/dosing-safety'
        }
      });
    }

    // Check renal dosing
    const renalDosing = await this.checkRenalDosing(medication, patient);
    if (renalDosing) {
      cards.push(renalDosing);
    }

    // Check pediatric dosing
    if (patient.demographics.age < 18) {
      const pediatricDosing = await this.checkPediatricDosing(medication, patient);
      if (pediatricDosing) {
        cards.push(pediatricDosing);
      }
    }

    // Check geriatric dosing
    if (patient.demographics.age >= 65) {
      const geriatricDosing = await this.checkGeriatricDosing(medication, patient);
      if (geriatricDosing) {
        cards.push(geriatricDosing);
      }
    }

    return cards;
  }

  /**
   * Check for duplicate therapy
   */
  private checkDuplicateTherapy(
    proposedMedication: Medication,
    currentMedications: Medication[]
  ): CDSCard[] {
    const duplicates = currentMedications.filter(med => 
      this.isSameTherapeuticClass(proposedMedication, med) &&
      med.status === 'Active'
    );

    if (duplicates.length > 0) {
      return [{
        summary: 'Potential duplicate therapy detected',
        detail: `Patient is already taking ${duplicates.map(m => m.name).join(', ')} which may have similar therapeutic effects.`,
        indicator: 'warning',
        source: {
          label: 'Duplicate Therapy Check',
          url: 'https://omnicare.example.com/duplicate-therapy'
        },
        suggestions: [{
          label: 'Review current medications',
          actions: [{
            type: 'create',
            description: 'Open medication review',
            resource: {
              resourceType: 'Task',
              code: 'medication-review',
              for: proposedMedication
            }
          }]
        }]
      }];
    }

    return [];
  }

  /**
   * Check clinical guidelines
   */
  private async checkClinicalGuidelines(
    medication: Medication,
    patient: Patient
  ): Promise<CDSCard[]> {
    const applicableGuidelines = await this.guidelinesService.getApplicableGuidelines(
      medication,
      patient
    );

    return applicableGuidelines.map(guideline => ({
      summary: `Clinical Guideline: ${guideline.title}`,
      detail: guideline.recommendations.map(r => r.description).join('\n'),
      indicator: 'info',
      source: {
        label: guideline.organization,
        url: `https://omnicare.example.com/guidelines/${guideline.guidelineId}`
      },
      links: [{
        label: 'View full guideline',
        url: `https://omnicare.example.com/guidelines/${guideline.guidelineId}`,
        type: 'absolute'
      }]
    }));
  }

  /**
   * Utility methods
   */
  private validateRequest(request: CDSHookRequest): boolean {
    return !!(
      request.hook &&
      request.hookInstance &&
      request.user &&
      request.context &&
      request.context.patientId
    );
  }

  private async getPatientData(patientId: string): Promise<Patient> {
    // This would integrate with your patient data service
    // For now, return a mock patient
    return {
      patientId,
      demographics: {
        age: 45,
        gender: 'F',
        weight: 70,
        height: 165
      },
      allergies: [],
      currentMedications: [],
      medicalHistory: []
    };
  }

  private extractMedicationsFromDraft(draft: any): Medication[] {
    // Extract medications from FHIR draft bundle
    if (!draft || !draft.entry) return [];
    
    return draft.entry
      .filter((entry: any) => entry.resource?.resourceType === 'MedicationRequest')
      .map((entry: any) => this.fhirToMedication(entry.resource));
  }

  private fhirToMedication(fhirMedication: any): Medication {
    return {
      medicationId: fhirMedication.id,
      name: fhirMedication.medicationCodeableConcept?.text || 'Unknown',
      dose: fhirMedication.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.value || 'Unknown',
      route: fhirMedication.dosageInstruction?.[0]?.route?.text || 'Unknown',
      frequency: fhirMedication.dosageInstruction?.[0]?.timing?.repeat?.frequency || 'Unknown',
      status: 'Active'
    };
  }

  private shouldAlertForInteraction(interaction: DrugInteraction): boolean {
    const severityOrder = ['Minor', 'Moderate', 'Major', 'Contraindicated'];
    const configSeverity = this.config.alertThresholds.drugInteraction;
    const configIndex = severityOrder.indexOf(configSeverity);
    const interactionIndex = severityOrder.indexOf(interaction.severity);
    
    return interactionIndex >= configIndex;
  }

  private getIndicatorForSeverity(severity: string): 'info' | 'warning' | 'critical' {
    switch (severity) {
      case 'Contraindicated':
        return 'critical';
      case 'Major':
        return 'critical';
      case 'Moderate':
        return 'warning';
      default:
        return 'info';
    }
  }

  private filterCards(cards: CDSCard[]): CDSCard[] {
    // Remove duplicate cards and apply priority filtering
    const uniqueCards = cards.filter((card, index, self) => 
      index === self.findIndex(c => c.summary === card.summary)
    );

    // Sort by indicator priority
    return uniqueCards.sort((a, b) => {
      const priorityOrder = { 'critical': 3, 'warning': 2, 'info': 1 };
      return priorityOrder[b.indicator] - priorityOrder[a.indicator];
    });
  }

  // Additional helper methods would be implemented here
  private async getOrderDetails(orderId: string): Promise<any> {
    // Mock implementation
    return { type: 'medication', id: orderId };
  }

  private async checkDiagnosticAppropriateness(order: any, patient: Patient): Promise<CDSCard[]> {
    // Implementation for diagnostic appropriateness
    return [];
  }

  private async checkProcedureAppropriateness(order: any, patient: Patient): Promise<CDSCard[]> {
    // Implementation for procedure appropriateness
    return [];
  }

  private async checkPreventiveCare(patient: Patient): Promise<CDSCard[]> {
    // Implementation for preventive care reminders
    return [];
  }

  private async checkQualityMeasureGaps(patient: Patient): Promise<CDSCard[]> {
    // Implementation for quality measure gap analysis
    return [];
  }

  private async checkRiskStratification(patient: Patient): Promise<CDSCard[]> {
    // Implementation for risk stratification
    return [];
  }

  private isWeightBasedMedication(medication: Medication): boolean {
    // Check if medication requires weight-based dosing
    const weightBasedMeds = ['warfarin', 'heparin', 'chemotherapy'];
    return weightBasedMeds.some(med => 
      medication.name.toLowerCase().includes(med.toLowerCase())
    );
  }

  private async checkRenalDosing(medication: Medication, patient: Patient): Promise<CDSCard | null> {
    // Check if renal dose adjustment is needed
    // This would integrate with lab results to check creatinine/GFR
    return null;
  }

  private async checkPediatricDosing(medication: Medication, patient: Patient): Promise<CDSCard | null> {
    // Check pediatric dosing appropriateness
    return null;
  }

  private async checkGeriatricDosing(medication: Medication, patient: Patient): Promise<CDSCard | null> {
    // Check geriatric dosing appropriateness (Beers criteria, etc.)
    return null;
  }

  private isSameTherapeuticClass(med1: Medication, med2: Medication): boolean {
    // This would use a drug database to check therapeutic equivalence
    // Mock implementation
    return med1.name === med2.name;
  }
}