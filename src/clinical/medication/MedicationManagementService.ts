/**
 * Medication Management Service
 * OmniCare EMR - Clinical Workflow Implementation
 */

import {
  MedicationOrder,
  MedicationSafetyCheck,
  PharmacistReview,
  MedicationAdministrationRecord,
  MedicationReconciliation,
  ElectronicPrescription,
  PatientCounseling,
  ControlledSubstanceTracking,
  MedicationList,
  MedicationDetails,
  DosingInstructions,
  AllergyCheck,
  InteractionCheck,
  ContraindicationCheck,
  MedicationWarning,
  DrugInteraction,
  AdverseReaction,
  FiveRightsVerification,
  PreAdministrationAssessment,
  PostAdministrationAssessment,
  CounselingPoint,
  MonitoringPlan,
  HomeMedication,
  AdmissionMedication,
  MedicationDiscrepancy,
  DuplicateTherapyCheck
} from './types';

import { Patient } from '../assessment/types';

export class MedicationManagementService {
  private medicationOrders: Map<string, MedicationOrder> = new Map();
  private medicationLists: Map<string, MedicationList> = new Map();
  private administrationRecords: Map<string, MedicationAdministrationRecord[]> = new Map();
  private controlledSubstanceTracking: Map<string, ControlledSubstanceTracking> = new Map();
  private drugDatabase: Map<string, MedicationDetails> = new Map();

  /**
   * PRESCRIPTION CREATION WORKFLOWS (Physician - Exclusive)
   */

  /**
   * Create medication order with comprehensive safety checks
   */
  async createMedicationOrder(
    patientId: string,
    physicianId: string,
    physicianName: string,
    medicationDetails: MedicationDetails,
    dosingInstructions: DosingInstructions,
    indication: string,
    duration?: string,
    refills: number = 0,
    specialInstructions?: string
  ): Promise<MedicationOrder> {
    // Perform comprehensive safety checks
    const safetyChecks = await this.performSafetyChecks(patientId, medicationDetails, dosingInstructions);

    // Check for critical safety issues
    if (safetyChecks.overallRiskLevel === 'Critical') {
      const criticalWarnings = safetyChecks.warnings.filter(w => w.severity === 'Critical');
      if (criticalWarnings.some(w => !w.override)) {
        throw new Error(`Critical safety alert: ${criticalWarnings[0].message}`);
      }
    }

    const medicationOrder: MedicationOrder = {
      id: this.generateId(),
      patientId,
      prescriberId: physicianId,
      prescriberName: physicianName,
      orderDate: new Date(),
      medication: medicationDetails,
      dosing: dosingInstructions,
      indication,
      duration,
      refills,
      daw: false, // Dispense as Written
      priorAuthRequired: await this.checkPriorAuthorization(medicationDetails),
      status: 'Draft',
      safetyChecks,
      clinicalNotes: specialInstructions,
      patientCounseling: {
        counselingPoints: await this.generateCounselingPoints(medicationDetails, dosingInstructions),
        patientEducationProvided: false,
        educationMethod: 'Verbal',
        patientUnderstanding: 'Good',
        languageBarriers: false,
        interpreterUsed: false,
        followUpEducationNeeded: false,
        counselingDate: new Date(),
        counseledBy: physicianId
      }
    };

    // Create controlled substance tracking if applicable
    if (medicationDetails.controlledSubstance) {
      await this.createControlledSubstanceTracking(medicationOrder);
    }

    this.medicationOrders.set(medicationOrder.id, medicationOrder);

    return medicationOrder;
  }

  /**
   * Check medication interactions with AI assistant
   */
  async checkMedicationInteractions(
    patientId: string,
    newMedication: MedicationDetails
  ): Promise<InteractionCheck> {
    const patientMedications = await this.getPatientMedications(patientId);
    const interactions: DrugInteraction[] = [];

    // Check drug-drug interactions
    for (const existingMed of patientMedications.activeMedications) {
      const interaction = await this.checkDrugInteraction(existingMed.name, newMedication.name);
      if (interaction) {
        interactions.push(interaction);
      }
    }

    // Check drug-food interactions
    const drugFoodInteractions = await this.checkDrugFoodInteractions(newMedication.name);

    // Check drug-disease interactions
    const drugDiseaseInteractions = await this.checkDrugDiseaseInteractions(patientId, newMedication.name);

    const overallRisk = this.calculateInteractionRisk(interactions);

    return {
      drugDrugInteractions: interactions,
      drugFoodInteractions,
      drugDiseaseInteractions,
      overallInteractionRisk: overallRisk,
      clinicalSignificance: this.assessClinicalSignificance(interactions),
      monitoringRecommendations: this.generateMonitoringRecommendations(interactions)
    };
  }

  /**
   * Create electronic prescription
   */
  async createElectronicPrescription(
    medicationOrderId: string,
    pharmacyId: string,
    pharmacyDetails: any
  ): Promise<ElectronicPrescription> {
    const medicationOrder = this.medicationOrders.get(medicationOrderId);
    if (!medicationOrder) {
      throw new Error('Medication order not found');
    }

    const ePrescription: ElectronicPrescription = {
      id: this.generateId(),
      rxNumber: this.generateRxNumber(),
      pharmacyId,
      pharmacyName: pharmacyDetails.name,
      pharmacyAddress: pharmacyDetails.address,
      pharmacyPhone: pharmacyDetails.phone,
      transmissionDate: new Date(),
      transmissionStatus: 'Pending',
      fillStatus: 'Not Filled',
      quantity: this.calculateQuantity(medicationOrder.dosing, medicationOrder.duration),
      daysSupply: this.calculateDaysSupply(medicationOrder.duration),
    };

    // Transmit prescription electronically
    try {
      await this.transmitPrescription(ePrescription, medicationOrder);
      ePrescription.transmissionStatus = 'Transmitted';
    } catch (error) {
      ePrescription.transmissionStatus = 'Error';
      ePrescription.errorMessage = (error as Error).message;
    }

    medicationOrder.electronicPrescription = ePrescription;
    medicationOrder.status = 'Pending';

    this.medicationOrders.set(medicationOrderId, medicationOrder);

    return ePrescription;
  }

  /**
   * PHARMACIST WORKFLOWS (Pharmacist - Exclusive)
   */

  /**
   * Perform pharmacist review and verification
   */
  async performPharmacistReview(
    medicationOrderId: string,
    pharmacistId: string,
    pharmacistName: string
  ): Promise<PharmacistReview> {
    const medicationOrder = this.medicationOrders.get(medicationOrderId);
    if (!medicationOrder) {
      throw new Error('Medication order not found');
    }

    const review: PharmacistReview = {
      id: this.generateId(),
      pharmacistId,
      pharmacistName,
      reviewDate: new Date(),
      reviewType: 'Initial',
      clinicalReview: {
        appropriateIndication: await this.verifyIndication(medicationOrder),
        appropriateDosing: await this.verifyDosing(medicationOrder),
        appropriateDuration: await this.verifyDuration(medicationOrder),
        safetyScreeningComplete: medicationOrder.safetyChecks.performedDate !== null,
        alternativesConsidered: false,
        costEffectiveness: 'Appropriate',
        theraputicDuplication: await this.checkTherapeuticDuplication(medicationOrder),
        adherenceAssessment: 'Good'
      },
      recommendations: [],
      approvalStatus: 'Approved',
      patientCounselingCompleted: false,
      monitoringPlan: await this.createMonitoringPlan(medicationOrder)
    };

    // Generate recommendations if needed
    if (!review.clinicalReview.appropriateDosing) {
      review.recommendations.push({
        type: 'Dosing',
        recommendation: 'Consider dose adjustment based on patient factors',
        rationale: 'Current dose may be inappropriate for patient age/weight/kidney function',
        priority: 'High',
        communicatedToPhysician: false,
        implemented: false
      });
      review.approvalStatus = 'Approved with Modifications';
    }

    medicationOrder.pharmacistReview = review;
    this.medicationOrders.set(medicationOrderId, medicationOrder);

    return review;
  }

  /**
   * Approve or suggest alternatives (Pharmacist - Exclusive)
   */
  async approveMedicationOrder(
    medicationOrderId: string,
    pharmacistId: string,
    approvalStatus: 'Approved' | 'Approved with Modifications' | 'Rejected',
    consultationNotes?: string
  ): Promise<void> {
    const medicationOrder = this.medicationOrders.get(medicationOrderId);
    if (!medicationOrder || !medicationOrder.pharmacistReview) {
      throw new Error('Medication order or pharmacist review not found');
    }

    medicationOrder.pharmacistReview.approvalStatus = approvalStatus;
    medicationOrder.pharmacistReview.consultationNotes = consultationNotes;

    if (approvalStatus === 'Approved') {
      medicationOrder.status = 'Active';
    } else if (approvalStatus === 'Rejected') {
      medicationOrder.status = 'Cancelled';
    }

    this.medicationOrders.set(medicationOrderId, medicationOrder);
  }

  /**
   * MEDICATION ADMINISTRATION WORKFLOWS (Nursing Staff - Exclusive)
   */

  /**
   * Verify order and patient identity (5 rights)
   */
  async verifyFiveRights(
    medicationOrderId: string,
    patientId: string,
    nurseId: string,
    nurseName: string,
    verificationMethod: 'Barcode' | 'Manual' | 'Biometric' = 'Barcode'
  ): Promise<FiveRightsVerification> {
    const medicationOrder = this.medicationOrders.get(medicationOrderId);
    if (!medicationOrder) {
      throw new Error('Medication order not found');
    }

    const verification: FiveRightsVerification = {
      rightPatient: medicationOrder.patientId === patientId,
      rightMedication: true, // Would verify against barcode/manual check
      rightDose: true, // Would verify against order
      rightRoute: true, // Would verify against order
      rightTime: this.isWithinAdministrationWindow(new Date()),
      verificationMethod,
      verifiedBy: nurseId,
      verificationTime: new Date()
    };

    // All rights must be verified
    const allRightsVerified = verification.rightPatient && 
                             verification.rightMedication && 
                             verification.rightDose && 
                             verification.rightRoute && 
                             verification.rightTime;

    if (!allRightsVerified) {
      throw new Error('Five rights verification failed - cannot administer medication');
    }

    return verification;
  }

  /**
   * Document medication administration
   */
  async documentMedicationAdministration(
    medicationOrderId: string,
    patientId: string,
    nurseId: string,
    nurseName: string,
    adminData: {
      scheduledTime: Date;
      doseGiven: string;
      route: string;
      site?: string;
    }
  ): Promise<MedicationAdministrationRecord> {
    const medicationOrder = this.medicationOrders.get(medicationOrderId);
    if (!medicationOrder) {
      throw new Error('Medication order not found');
    }

    // Verify five rights
    const fiveRightsVerification = await this.verifyFiveRights(
      medicationOrderId, 
      patientId, 
      nurseId, 
      nurseName
    );

    // Perform pre-administration assessment
    const preAssessment: PreAdministrationAssessment = {
      consciousnessLevel: 'Alert',
      allergiesVerified: true,
      contraindications: [],
      patientCondition: 'Stable',
      readyForAdministration: true
    };

    const administrationRecord: MedicationAdministrationRecord = {
      id: this.generateId(),
      patientId,
      medicationOrderId,
      nurseId,
      nurseName,
      administrationDate: new Date(),
      scheduledTime: adminData.scheduledTime,
      actualTime: new Date(),
      doseGiven: adminData.doseGiven,
      route: adminData.route,
      site: adminData.site,
      fiveRightsVerified: fiveRightsVerification,
      preAdministrationAssessment: preAssessment,
      postAdministrationAssessment: {
        immediateResponse: 'No immediate adverse reactions',
        adverseReactions: false,
        patientTolerance: 'Good',
        followUpRequired: false
      },
      administrationStatus: 'Given',
      witnessRequired: medicationOrder.medication.controlledSubstance,
      wasteWitnessed: false
    };

    // Store administration record
    if (!this.administrationRecords.has(patientId)) {
      this.administrationRecords.set(patientId, []);
    }
    this.administrationRecords.get(patientId)!.push(administrationRecord);

    // Update medication order administration records
    if (!medicationOrder.administrationRecords) {
      medicationOrder.administrationRecords = [];
    }
    medicationOrder.administrationRecords.push(administrationRecord);

    this.medicationOrders.set(medicationOrderId, medicationOrder);

    return administrationRecord;
  }

  /**
   * Monitor for adverse reactions
   */
  async monitorAdverseReactions(
    administrationRecordId: string,
    nurseId: string,
    reaction?: AdverseReaction
  ): Promise<void> {
    // Find administration record
    let adminRecord: MedicationAdministrationRecord | undefined;
    let patientId: string = '';

    for (const [pid, records] of this.administrationRecords.entries()) {
      const record = records.find(r => r.id === administrationRecordId);
      if (record) {
        adminRecord = record;
        patientId = pid;
        break;
      }
    }

    if (!adminRecord) {
      throw new Error('Administration record not found');
    }

    if (reaction) {
      adminRecord.adverseReaction = {
        ...reaction,
        id: this.generateId(),
        onsetTime: new Date(),
        reportedToPhysician: false,
        adverseEventReported: false
      };

      // Update post-administration assessment
      adminRecord.postAdministrationAssessment.adverseReactions = true;
      adminRecord.postAdministrationAssessment.followUpRequired = true;

      // Alert physician for severe reactions
      if (reaction.severity === 'Severe' || reaction.severity === 'Life-threatening') {
        await this.alertPhysician(patientId, reaction);
      }
    }
  }

  /**
   * MEDICATION RECONCILIATION WORKFLOWS
   */

  /**
   * Perform medication reconciliation
   */
  async performMedicationReconciliation(
    patientId: string,
    reconciliationType: 'Admission' | 'Transfer' | 'Discharge' | 'Outpatient Visit',
    performedBy: string
  ): Promise<MedicationReconciliation> {
    const homemedications = await this.getHomeMedications(patientId);
    const admissionMedications = await this.getAdmissionMedications(patientId);

    const reconciliation: MedicationReconciliation = {
      id: this.generateId(),
      patientId,
      reconciliationType,
      performedBy,
      performedDate: new Date(),
      homemedications,
      admissionMedications,
      discrepancies: [],
      interventions: [],
      reconciliationComplete: false,
      physicianReviewed: false,
      patientEducationProvided: false
    };

    // Identify discrepancies
    reconciliation.discrepancies = await this.identifyMedicationDiscrepancies(
      homemedications,
      admissionMedications
    );

    // Generate interventions for discrepancies
    for (const discrepancy of reconciliation.discrepancies) {
      if (discrepancy.clinicalSignificance === 'High') {
        reconciliation.interventions.push({
          type: 'Clarify',
          medication: discrepancy.medication,
          action: 'Clarify discrepancy with physician',
          rationale: `High significance discrepancy: ${discrepancy.description}`,
          communicatedToPhysician: false,
          implemented: false
        });
      }
    }

    reconciliation.reconciliationComplete = reconciliation.discrepancies.length === 0 ||
                                          reconciliation.interventions.length > 0;

    return reconciliation;
  }

  /**
   * SAFETY CHECK IMPLEMENTATIONS
   */

  private async performSafetyChecks(
    patientId: string,
    medication: MedicationDetails,
    dosing: DosingInstructions
  ): Promise<MedicationSafetyCheck> {
    const patient = await this.getPatientData(patientId);
    
    const allergyCheck = await this.performAllergyCheck(patient, medication);
    const interactionCheck = await this.checkMedicationInteractions(patientId, medication);
    const contraindicationCheck = await this.checkContraindications(patient, medication);
    const duplicateTherapyCheck = await this.checkDuplicateTherapy(patientId, medication);
    const dosingCheck = await this.checkDosing(patient, medication, dosing);

    const warnings: MedicationWarning[] = [];
    
    // Generate warnings based on checks
    if (allergyCheck.riskLevel === 'High') {
      warnings.push({
        type: 'Allergy',
        severity: 'Critical',
        message: `Patient has documented allergy to ${allergyCheck.potentialAllergies.join(', ')}`,
        clinicalSignificance: 'High risk of allergic reaction',
        recommendedAction: 'Consider alternative medication',
        override: false
      });
    }

    if (interactionCheck.overallInteractionRisk === 'Major' || interactionCheck.overallInteractionRisk === 'Contraindicated') {
      warnings.push({
        type: 'Interaction',
        severity: 'Critical',
        message: `Major drug interaction detected`,
        clinicalSignificance: interactionCheck.clinicalSignificance,
        recommendedAction: 'Review interaction and consider alternatives',
        override: false
      });
    }

    const overallRiskLevel = this.calculateOverallRiskLevel(
      allergyCheck,
      interactionCheck,
      contraindicationCheck,
      warnings
    );

    return {
      id: this.generateId(),
      performedDate: new Date(),
      performedBy: 'System',
      allergies: allergyCheck,
      interactions: interactionCheck,
      contraindications: contraindicationCheck,
      duplicateTherapy: duplicateTherapyCheck,
      dosing: dosingCheck,
      kidneyFunction: { requiresAdjustment: false, monitoringRequired: false },
      liverFunction: { requiresAdjustment: false, monitoringRequired: false },
      pregnancy: { pregnancyStatus: 'Unknown', riskAssessment: 'Unknown pregnancy status' },
      overallRiskLevel,
      warnings,
      overrides: []
    };
  }

  private async performAllergyCheck(patient: any, medication: MedicationDetails): Promise<AllergyCheck> {
    // Implementation would check patient allergies against medication
    return {
      hasKnownAllergies: false,
      potentialAllergies: [],
      crossReactivityRisk: false,
      riskLevel: 'None',
      recommendedAction: 'No allergy concerns identified'
    };
  }

  private async checkContraindications(patient: any, medication: MedicationDetails): Promise<ContraindicationCheck> {
    // Implementation would check patient conditions against medication contraindications
    return {
      hasContraindications: false,
      contraindications: [],
      riskBenefitAssessment: 'No contraindications identified'
    };
  }

  private async checkDuplicateTherapy(patientId: string, medication: MedicationDetails): Promise<any> {
    // Implementation would check for duplicate therapeutic classes
    return {
      hasDuplicates: false,
      duplicateTherapies: [],
      recommendedAction: 'No duplicate therapy detected'
    };
  }

  private async checkDosing(patient: any, medication: MedicationDetails, dosing: DosingInstructions): Promise<any> {
    // Implementation would verify appropriate dosing
    return {
      appropriateDose: true,
      doseRecommendation: 'Current dose is appropriate',
      ageAppropriate: true,
      weightBased: false,
      renalAdjustment: false,
      hepaticAdjustment: false,
      warnings: []
    };
  }

  /**
   * HELPER METHODS
   */

  private calculateOverallRiskLevel(
    allergyCheck: AllergyCheck,
    interactionCheck: InteractionCheck,
    contraindicationCheck: ContraindicationCheck,
    warnings: MedicationWarning[]
  ): 'Low' | 'Medium' | 'High' | 'Critical' {
    const criticalWarnings = warnings.filter(w => w.severity === 'Critical');
    if (criticalWarnings.length > 0) return 'Critical';
    
    if (allergyCheck.riskLevel === 'High' || 
        interactionCheck.overallInteractionRisk === 'Major' ||
        contraindicationCheck.hasContraindications) {
      return 'High';
    }
    
    if (interactionCheck.overallInteractionRisk === 'Moderate') {
      return 'Medium';
    }
    
    return 'Low';
  }

  private async checkDrugInteraction(drug1: string, drug2: string): Promise<DrugInteraction | null> {
    // Implementation would check drug interaction database
    return null;
  }

  private async checkDrugFoodInteractions(medication: string): Promise<string[]> {
    return [];
  }

  private async checkDrugDiseaseInteractions(patientId: string, medication: string): Promise<string[]> {
    return [];
  }

  private calculateInteractionRisk(interactions: DrugInteraction[]): InteractionCheck['overallInteractionRisk'] {
    if (interactions.some(i => i.severity === 'Contraindicated')) return 'Contraindicated';
    if (interactions.some(i => i.severity === 'Major')) return 'Major';
    if (interactions.some(i => i.severity === 'Moderate')) return 'Moderate';
    if (interactions.some(i => i.severity === 'Minor')) return 'Minor';
    return 'None';
  }

  private assessClinicalSignificance(interactions: DrugInteraction[]): string {
    return interactions.length > 0 ? 
      `${interactions.length} interaction(s) identified` : 
      'No significant interactions';
  }

  private generateMonitoringRecommendations(interactions: DrugInteraction[]): string[] {
    return interactions
      .filter(i => i.severity === 'Major' || i.severity === 'Moderate')
      .map(i => i.management);
  }

  private async getPatientData(patientId: string): Promise<any> {
    // Implementation would retrieve patient data
    return {};
  }

  private async getPatientMedications(patientId: string): Promise<MedicationList> {
    return this.medicationLists.get(patientId) || {
      id: this.generateId(),
      patientId,
      lastUpdated: new Date(),
      updatedBy: 'System',
      activeMedications: [],
      inactiveMedications: [],
      allergies: [],
      adverseDrugReactions: []
    };
  }

  /**
   * MISSING METHOD IMPLEMENTATIONS
   */

  private async checkPriorAuthorization(medication: MedicationDetails): Promise<boolean> {
    // Check if medication requires prior authorization
    return medication.controlledSubstance || medication.blackBoxWarning;
  }

  private async generateCounselingPoints(medication: MedicationDetails, dosing: DosingInstructions): Promise<CounselingPoint[]> {
    const counselingPoints: CounselingPoint[] = [
      {
        topic: 'Indication',
        information: `This medication is prescribed for your condition`,
        emphasized: true
      },
      {
        topic: 'Dosing',
        information: `Take ${dosing.dose} ${dosing.frequency} by ${dosing.route}`,
        emphasized: true
      },
      {
        topic: 'Administration',
        information: dosing.administrationInstructions,
        emphasized: false
      }
    ];

    if (medication.blackBoxWarning) {
      counselingPoints.push({
        topic: 'Side Effects',
        information: 'This medication has serious warnings - please review with your healthcare provider',
        emphasized: true
      });
    }

    return counselingPoints;
  }

  private async createControlledSubstanceTracking(medicationOrder: MedicationOrder): Promise<void> {
    if (!medicationOrder.medication.controlledSubstance) {
      return;
    }

    const tracking: ControlledSubstanceTracking = {
      id: this.generateId(),
      medicationOrderId: medicationOrder.id,
      patientId: medicationOrder.patientId,
      prescriberId: medicationOrder.prescriberId,
      medication: medicationOrder.medication.name,
      strength: medicationOrder.medication.strength,
      quantityPrescribed: this.calculateQuantity(medicationOrder.dosing, medicationOrder.duration),
      quantityDispensed: 0,
      quantityRemaining: 0,
      prescriptionDate: new Date(),
      pharmacyId: '',
      deaNumber: '',
      pdmpChecked: false,
      highRiskPatient: false,
      riskFactors: [],
      monitoringRequired: true,
      agreementSigned: false
    };

    this.controlledSubstanceTracking.set(tracking.id, tracking);
  }

  private async transmitPrescription(prescription: ElectronicPrescription, medicationOrder: MedicationOrder): Promise<void> {
    // Implementation would transmit prescription to pharmacy
    // This is a placeholder for actual e-prescribing integration
    return Promise.resolve();
  }

  private async verifyIndication(medicationOrder: MedicationOrder): Promise<boolean> {
    // Implementation would verify indication is appropriate
    return !!(medicationOrder.indication && medicationOrder.indication.length > 0);
  }

  private async verifyDosing(medicationOrder: MedicationOrder): Promise<boolean> {
    // Implementation would verify dosing is appropriate
    return !!(medicationOrder.dosing.dose && medicationOrder.dosing.frequency);
  }

  private async verifyDuration(medicationOrder: MedicationOrder): Promise<boolean> {
    // Implementation would verify duration is appropriate
    return !medicationOrder.duration || medicationOrder.duration.length > 0;
  }

  private async checkTherapeuticDuplication(medicationOrder: MedicationOrder): Promise<boolean> {
    // Implementation would check for therapeutic duplication
    const patientMedications = await this.getPatientMedications(medicationOrder.patientId);
    return patientMedications.activeMedications.some(med => 
      med.genericName === medicationOrder.medication.genericName
    );
  }

  private async createMonitoringPlan(medicationOrder: MedicationOrder): Promise<MonitoringPlan> {
    const monitoringPlan: MonitoringPlan = {
      parameters: [
        {
          parameter: 'Therapeutic Response',
          target: 'Effective symptom control',
          frequency: 'Weekly',
          method: 'Patient Report',
          alertThresholds: [
            {
              condition: 'No improvement',
              value: '2 weeks',
              action: 'Consider dose adjustment',
              severity: 'Medium'
            }
          ]
        }
      ],
      frequency: 'Weekly',
      duration: '30 days',
      alertCriteria: ['Adverse reactions', 'Lack of efficacy'],
      followUpRequired: true
    };

    // Add specific monitoring for controlled substances
    if (medicationOrder.medication.controlledSubstance) {
      monitoringPlan.parameters.push({
        parameter: 'Abuse Potential',
        target: 'No signs of misuse',
        frequency: 'Monthly',
        method: 'Physical Exam',
        alertThresholds: [
          {
            condition: 'Early refill requests',
            value: '> 3 days early',
            action: 'Investigate usage',
            severity: 'High'
          }
        ]
      });
    }

    return monitoringPlan;
  }

  private isWithinAdministrationWindow(currentTime: Date): boolean {
    // Implementation would check if within administration window
    // For now, assume it's always within window
    return true;
  }

  private async alertPhysician(patientId: string, reaction: AdverseReaction): Promise<void> {
    // Implementation would alert physician of adverse reaction
    return Promise.resolve();
  }

  private async getHomeMedications(patientId: string): Promise<HomeMedication[]> {
    // Implementation would retrieve home medications
    return [];
  }

  private async getAdmissionMedications(patientId: string): Promise<AdmissionMedication[]> {
    // Implementation would retrieve admission medications
    return [];
  }

  private async identifyMedicationDiscrepancies(
    homeMedications: HomeMedication[],
    admissionMedications: AdmissionMedication[]
  ): Promise<MedicationDiscrepancy[]> {
    const discrepancies: MedicationDiscrepancy[] = [];

    // Check for omissions
    for (const homeMed of homeMedications) {
      const foundInAdmission = admissionMedications.find(admMed => 
        admMed.name.toLowerCase() === homeMed.name.toLowerCase()
      );
      
      if (!foundInAdmission) {
        discrepancies.push({
          type: 'Omission',
          medication: homeMed.name,
          description: `Home medication ${homeMed.name} not continued on admission`,
          clinicalSignificance: 'Medium',
          riskLevel: 'Medium',
          resolved: false
        });
      }
    }

    // Check for commissions
    for (const admMed of admissionMedications) {
      const foundInHome = homeMedications.find(homeMed => 
        homeMed.name.toLowerCase() === admMed.name.toLowerCase()
      );
      
      if (!foundInHome) {
        discrepancies.push({
          type: 'Commission',
          medication: admMed.name,
          description: `New medication ${admMed.name} added on admission`,
          clinicalSignificance: 'Low',
          riskLevel: 'Low',
          resolved: false
        });
      }
    }

    return discrepancies;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateRxNumber(): string {
    return 'RX' + Math.random().toString(36).substr(2, 8).toUpperCase();
  }

  private calculateQuantity(dosing: DosingInstructions, duration?: string): number {
    // Implementation would calculate quantity based on dosing and duration
    return 30; // Default 30-day supply
  }

  private calculateDaysSupply(duration?: string): number {
    // Implementation would parse duration string
    return 30; // Default 30 days
  }

  /**
   * PUBLIC API METHODS
   */

  public async getMedicationOrder(orderId: string): Promise<MedicationOrder | undefined> {
    return this.medicationOrders.get(orderId);
  }

  public async getPatientMedicationOrders(patientId: string): Promise<MedicationOrder[]> {
    return Array.from(this.medicationOrders.values()).filter(order => order.patientId === patientId);
  }

  public async getAdministrationRecords(patientId: string): Promise<MedicationAdministrationRecord[]> {
    return this.administrationRecords.get(patientId) || [];
  }

  public async cancelMedicationOrder(orderId: string, reason: string, cancelledBy: string): Promise<void> {
    const order = this.medicationOrders.get(orderId);
    if (order) {
      order.status = 'Cancelled';
      order.clinicalNotes = `${order.clinicalNotes || ''}\nCancelled: ${reason} by ${cancelledBy}`;
      this.medicationOrders.set(orderId, order);
    }
  }
}