/**
 * Outpatient Encounter Service
 * OmniCare EMR - Clinical Workflow Implementation
 */

import {
  OutpatientEncounter,
  PreVisitPreparation,
  NursingEncounterDocumentation,
  PhysicianEncounterDocumentation,
  PostVisitActivities,
  VisitSummary,
  FollowUpPlan,
  MedicationReconciliation,
  ImmunizationRecord,
  Prescription,
  Referral,
  FollowUpAppointment,
  PreventiveCareItem,
  Provider,
  PatientEducation,
  Treatment
} from './types';

import { Patient, VitalSigns, ClinicalOrder } from '../assessment/types';

export class OutpatientEncounterService {
  private encounters: Map<string, OutpatientEncounter> = new Map();
  private providers: Map<string, Provider> = new Map();
  private scheduledEncounters: OutpatientEncounter[] = [];

  /**
   * PRE-VISIT CLINICAL PREPARATION WORKFLOWS
   */

  /**
   * Prepare for scheduled patients (Nursing Staff)
   */
  async performPreVisitPreparation(
    encounterId: string,
    nurseName: string,
    nurseId: string
  ): Promise<PreVisitPreparation> {
    const encounter = this.encounters.get(encounterId);
    if (!encounter) {
      throw new Error('Encounter not found');
    }

    const preparation: PreVisitPreparation = {
      id: this.generateId(),
      encounterId,
      preparedBy: nurseName,
      preparationDate: new Date(),
      roomPrepared: false,
      equipmentChecked: false,
      outstandingOrders: [],
      outstandingResults: [],
      previousVisitReviewed: false,
      preventiveCareNeeds: [],
      medicationReviewCompleted: false,
      allergyReviewCompleted: false,
      insuranceVerified: false,
      notes: ''
    };

    // Check for outstanding orders and results
    preparation.outstandingOrders = await this.getOutstandingOrders(encounter.patientId);
    preparation.outstandingResults = await this.getOutstandingResults(encounter.patientId);

    // Review previous visit notes
    preparation.previousVisitReviewed = await this.reviewPreviousVisits(encounter.patientId);

    // Identify preventive care needs
    preparation.preventiveCareNeeds = await this.identifyPreventiveCareNeeds(encounter.patientId);

    // Prepare room and check equipment
    await this.prepareExaminationRoom(encounter.roomNumber || '');
    preparation.roomPrepared = true;
    preparation.equipmentChecked = true;

    // Verify insurance
    preparation.insuranceVerified = await this.verifyInsurance(encounter.patientId);

    encounter.preVisitPreparation = preparation;
    this.encounters.set(encounterId, encounter);

    return preparation;
  }

  /**
   * DURING CLINICAL VISIT WORKFLOWS
   */

  /**
   * Room patient and perform nursing documentation (Nursing Staff)
   */
  async performNursingEncounterDocumentation(
    encounterId: string,
    nurseName: string,
    nurseId: string,
    vitalSigns: VitalSigns,
    chiefComplaint: string,
    reasonForVisit: string
  ): Promise<NursingEncounterDocumentation> {
    const encounter = this.encounters.get(encounterId);
    if (!encounter) {
      throw new Error('Encounter not found');
    }

    const nursingDoc: NursingEncounterDocumentation = {
      id: this.generateId(),
      encounterId,
      nurseName,
      nurseId,
      roomingTime: new Date(),
      vitalSigns,
      medicationReconciliation: await this.performMedicationReconciliation(encounter.patientId, nurseId),
      chiefComplaint,
      reasonForVisit,
      preliminaryAssessments: [],
      immunizationHistory: await this.getImmunizationHistory(encounter.patientId),
      immunizationsAdministered: [],
      patientEducationProvided: [],
      inOfficetreatments: [],
      patientConcems: [],
      nursingNotes: '',
      followUpCoordination: ''
    };

    // Update encounter status
    encounter.status = 'Roomed';
    encounter.actualStartTime = new Date();
    encounter.chiefComplaint = chiefComplaint;
    encounter.nursingDocumentation = nursingDoc;

    this.encounters.set(encounterId, encounter);

    return nursingDoc;
  }

  /**
   * Perform physician encounter documentation (Physician - Exclusive)
   */
  async performPhysicianEncounterDocumentation(
    encounterId: string,
    physicianName: string,
    physicianId: string,
    clinicalData: {
      historyOfPresentIllness: string;
      reviewOfSystems: string;
      physicalExamination: string;
      medicalDecisionMaking: string;
    }
  ): Promise<PhysicianEncounterDocumentation> {
    const encounter = this.encounters.get(encounterId);
    if (!encounter || encounter.provider.id !== physicianId) {
      throw new Error('Unauthorized: Only the assigned physician can document this encounter');
    }

    const physicianDoc: PhysicianEncounterDocumentation = {
      id: this.generateId(),
      encounterId,
      physicianName,
      physicianId,
      encounterStartTime: new Date(),
      encounterEndTime: new Date(),
      historyOfPresentIllness: clinicalData.historyOfPresentIllness,
      reviewOfSystems: clinicalData.reviewOfSystems,
      physicalExamination: clinicalData.physicalExamination,
      clinicalFindings: [],
      diagnosticImpression: [],
      differentialDiagnosis: [],
      treatmentPlan: {
        goals: [],
        interventions: [],
        medications: [],
        lifestyle: [],
        monitoring: [],
        followUp: ''
      },
      ordersPlaced: [],
      prescriptions: [],
      referrals: [],
      followUpAppointments: [],
      medicalDecisionMaking: clinicalData.medicalDecisionMaking,
      patientEducationDiscussed: [],
      patientQuestions: [],
      visitComplexity: 'Moderate',
      timeSpent: 0
    };

    // Generate AI assistant summary if available
    physicianDoc.aiAssistantSummary = await this.generateAISummary(encounter);

    encounter.status = 'In Progress';
    encounter.physicianDocumentation = physicianDoc;

    this.encounters.set(encounterId, encounter);

    return physicianDoc;
  }

  /**
   * Create electronic prescriptions (Physician - Exclusive)
   */
  async createElectronicPrescriptions(
    encounterId: string,
    prescriptions: Prescription[],
    physicianId: string
  ): Promise<Prescription[]> {
    const encounter = this.encounters.get(encounterId);
    if (!encounter || encounter.provider.id !== physicianId) {
      throw new Error('Unauthorized: Only the assigned physician can prescribe medications');
    }

    const createdPrescriptions: Prescription[] = [];

    for (const prescription of prescriptions) {
      // Check drug interactions and allergies
      await this.checkMedicationSafety(encounter.patientId, prescription.medication);

      const newPrescription: Prescription = {
        ...prescription,
        id: this.generateId(),
        prescribedBy: physicianId,
        prescribedDate: new Date(),
        status: 'Pending',
        electronicallyPrescribed: true
      };

      createdPrescriptions.push(newPrescription);
    }

    // Update encounter documentation
    if (encounter.physicianDocumentation) {
      encounter.physicianDocumentation.prescriptions = createdPrescriptions;
    }

    this.encounters.set(encounterId, encounter);

    return createdPrescriptions;
  }

  /**
   * Create clinical orders (Physician - Exclusive)
   */
  async createClinicalOrders(
    encounterId: string,
    orders: ClinicalOrder[],
    physicianId: string
  ): Promise<ClinicalOrder[]> {
    const encounter = this.encounters.get(encounterId);
    if (!encounter || encounter.provider.id !== physicianId) {
      throw new Error('Unauthorized: Only the assigned physician can create orders');
    }

    const createdOrders: ClinicalOrder[] = [];

    for (const order of orders) {
      const newOrder: ClinicalOrder = {
        ...order,
        id: this.generateId(),
        orderedBy: physicianId,
        orderDate: new Date(),
        status: 'Pending'
      };

      createdOrders.push(newOrder);
    }

    // Update encounter documentation
    if (encounter.physicianDocumentation) {
      encounter.physicianDocumentation.ordersPlaced = createdOrders;
    }

    this.encounters.set(encounterId, encounter);

    return createdOrders;
  }

  /**
   * Schedule follow-up appointments (Physician - Exclusive)
   */
  async scheduleFollowUpAppointments(
    encounterId: string,
    appointments: FollowUpAppointment[],
    physicianId: string
  ): Promise<FollowUpAppointment[]> {
    const encounter = this.encounters.get(encounterId);
    if (!encounter || encounter.provider.id !== physicianId) {
      throw new Error('Unauthorized: Only the assigned physician can schedule follow-up appointments');
    }

    const scheduledAppointments: FollowUpAppointment[] = [];

    for (const appointment of appointments) {
      const newAppointment: FollowUpAppointment = {
        ...appointment,
        id: this.generateId(),
        status: 'Recommended'
      };

      scheduledAppointments.push(newAppointment);
    }

    // Update encounter documentation
    if (encounter.physicianDocumentation) {
      encounter.physicianDocumentation.followUpAppointments = scheduledAppointments;
    }

    this.encounters.set(encounterId, encounter);

    return scheduledAppointments;
  }

  /**
   * Provide patient education (Nursing Staff)
   */
  async providePatientEducation(
    encounterId: string,
    education: PatientEducation[],
    nurseId: string
  ): Promise<void> {
    const encounter = this.encounters.get(encounterId);
    if (!encounter || !encounter.nursingDocumentation) {
      throw new Error('Encounter or nursing documentation not found');
    }

    encounter.nursingDocumentation.patientEducationProvided = education;
    this.encounters.set(encounterId, encounter);
  }

  /**
   * Administer immunizations (Nursing Staff)
   */
  async administerImmunizations(
    encounterId: string,
    immunizations: ImmunizationRecord[],
    nurseId: string
  ): Promise<void> {
    const encounter = this.encounters.get(encounterId);
    if (!encounter || !encounter.nursingDocumentation) {
      throw new Error('Encounter or nursing documentation not found');
    }

    for (const immunization of immunizations) {
      immunization.id = this.generateId();
      immunization.administeredBy = nurseId;
      immunization.administeredDate = new Date();
    }

    encounter.nursingDocumentation.immunizationsAdministered = immunizations;
    this.encounters.set(encounterId, encounter);
  }

  /**
   * POST-VISIT CLINICAL ACTIVITIES
   */

  /**
   * Complete post-visit activities (Physician)
   */
  async completePostVisitActivities(
    encounterId: string,
    physicianId: string
  ): Promise<PostVisitActivities> {
    const encounter = this.encounters.get(encounterId);
    if (!encounter || encounter.provider.id !== physicianId) {
      throw new Error('Unauthorized: Only the assigned physician can complete post-visit activities');
    }

    const postVisitActivities: PostVisitActivities = {
      id: this.generateId(),
      encounterId,
      performedBy: physicianId,
      completionDate: new Date(),
      documentationSigned: false,
      outstandingResultsReviewed: false,
      patientMessagesResponded: false,
      careTeamCommunication: [],
      careplanUpdated: false,
      orderedTestsFollowUp: [],
      complexPatientFollowUp: [],
      postVisitInstructions: {
        id: this.generateId(),
        patientId: encounter.patientId,
        instructions: [],
        medications: [],
        activities: [],
        diet: [],
        followUp: [],
        warningSymptoms: [],
        emergencyInstructions: 'Contact your healthcare provider or call 911 for emergencies',
        providedBy: physicianId,
        providedDate: new Date(),
        patientAcknowledged: false
      }
    };

    // Sign clinical documentation
    postVisitActivities.documentationSigned = await this.signEncounterDocumentation(encounterId, physicianId);

    // Review outstanding results
    postVisitActivities.outstandingResultsReviewed = await this.reviewOutstandingResults(encounter.patientId);

    // Update care plan
    postVisitActivities.careplanUpdated = await this.updateCarePlan(encounter.patientId, encounterId);

    encounter.postVisitActivities = postVisitActivities;
    encounter.status = 'Completed';
    encounter.actualEndTime = new Date();

    this.encounters.set(encounterId, encounter);

    return postVisitActivities;
  }

  /**
   * Perform nursing post-visit follow-up (Nursing Staff)
   */
  async performNursingPostVisitFollowUp(
    encounterId: string,
    nurseId: string
  ): Promise<void> {
    const encounter = this.encounters.get(encounterId);
    if (!encounter) {
      throw new Error('Encounter not found');
    }

    // Follow up on ordered tests
    await this.followUpOrderedTests(encounter.patientId);

    // Monitor for incoming results
    await this.monitorIncomingResults(encounter.patientId);

    // Coordinate post-visit care needs
    await this.coordinatePostVisitCare(encounter.patientId);

    // Conduct follow-up calls for complex patients
    if (encounter.physicianDocumentation?.visitComplexity === 'High') {
      await this.scheduleComplexPatientFollowUp(encounter.patientId, nurseId);
    }
  }

  /**
   * Generate visit summary
   */
  async generateVisitSummary(encounterId: string): Promise<VisitSummary> {
    const encounter = this.encounters.get(encounterId);
    if (!encounter) {
      throw new Error('Encounter not found');
    }

    const visitSummary: VisitSummary = {
      id: this.generateId(),
      encounterId,
      patientId: encounter.patientId,
      visitDate: encounter.scheduledDate,
      provider: encounter.provider.name,
      chiefComplaint: encounter.chiefComplaint || '',
      diagnoses: encounter.physicianDocumentation?.diagnosticImpression.map(d => d.description) || [],
      treatmentProvided: encounter.physicianDocumentation?.treatmentPlan.interventions.map(i => i.description) || [],
      medicationsChanged: (encounter.physicianDocumentation?.prescriptions.length || 0) > 0,
      newPrescriptions: encounter.physicianDocumentation?.prescriptions.map(p => p.medication) || [],
      ordersPlaced: encounter.physicianDocumentation?.ordersPlaced.map(o => o.description) || [],
      followUpRequired: (encounter.physicianDocumentation?.followUpAppointments.length || 0) > 0,
      nextAppointment: encounter.physicianDocumentation?.followUpAppointments[0]?.scheduledDate,
      visitDuration: this.calculateVisitDuration(encounter),
      generatedBy: 'System',
      generatedDate: new Date()
    };

    encounter.visitSummary = visitSummary;
    this.encounters.set(encounterId, encounter);

    return visitSummary;
  }

  /**
   * HELPER METHODS
   */

  private async getOutstandingOrders(patientId: string): Promise<ClinicalOrder[]> {
    // Implementation to retrieve outstanding orders
    return [];
  }

  private async getOutstandingResults(patientId: string): Promise<any[]> {
    // Implementation to retrieve outstanding results
    return [];
  }

  private async reviewPreviousVisits(patientId: string): Promise<boolean> {
    // Implementation to review previous visit notes
    return true;
  }

  private async identifyPreventiveCareNeeds(patientId: string): Promise<PreventiveCareItem[]> {
    // Implementation to identify preventive care needs based on age, gender, risk factors
    return [];
  }

  private async prepareExaminationRoom(roomNumber: string): Promise<void> {
    // Implementation to prepare examination room
  }

  private async verifyInsurance(patientId: string): Promise<boolean> {
    // Implementation to verify insurance eligibility
    return true;
  }

  private async performMedicationReconciliation(patientId: string, nurseId: string): Promise<MedicationReconciliation> {
    return {
      id: this.generateId(),
      performedBy: nurseId,
      performedDate: new Date(),
      currentMedications: [],
      discrepancies: [],
      reconciliationComplete: true,
      notes: ''
    };
  }

  private async getImmunizationHistory(patientId: string): Promise<ImmunizationRecord[]> {
    // Implementation to retrieve immunization history
    return [];
  }

  private async generateAISummary(encounter: OutpatientEncounter): Promise<string> {
    // Implementation to generate AI-assisted clinical summary
    return 'AI-generated clinical summary based on encounter documentation';
  }

  private async checkMedicationSafety(patientId: string, medication: string): Promise<void> {
    // Implementation to check drug interactions and allergies
  }

  private async signEncounterDocumentation(encounterId: string, physicianId: string): Promise<boolean> {
    // Implementation to electronically sign documentation
    return true;
  }

  private async reviewOutstandingResults(patientId: string): Promise<boolean> {
    // Implementation to review outstanding test results
    return true;
  }

  private async updateCarePlan(patientId: string, encounterId: string): Promise<boolean> {
    // Implementation to update patient care plan
    return true;
  }

  private async followUpOrderedTests(patientId: string): Promise<void> {
    // Implementation to follow up on ordered tests
  }

  private async monitorIncomingResults(patientId: string): Promise<void> {
    // Implementation to monitor for incoming results
  }

  private async coordinatePostVisitCare(patientId: string): Promise<void> {
    // Implementation to coordinate post-visit care needs
  }

  private async scheduleComplexPatientFollowUp(patientId: string, nurseId: string): Promise<void> {
    // Implementation to schedule follow-up calls for complex patients
  }

  private calculateVisitDuration(encounter: OutpatientEncounter): number {
    if (encounter.actualStartTime && encounter.actualEndTime) {
      return Math.round((encounter.actualEndTime.getTime() - encounter.actualStartTime.getTime()) / (1000 * 60));
    }
    return 0;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * PUBLIC API METHODS
   */

  public async createEncounter(encounter: Partial<OutpatientEncounter>): Promise<OutpatientEncounter> {
    const newEncounter: OutpatientEncounter = {
      id: this.generateId(),
      status: 'Scheduled',
      ...encounter
    } as OutpatientEncounter;

    this.encounters.set(newEncounter.id, newEncounter);
    this.scheduledEncounters.push(newEncounter);

    return newEncounter;
  }

  public async getEncounter(encounterId: string): Promise<OutpatientEncounter | undefined> {
    return this.encounters.get(encounterId);
  }

  public async getPatientEncounters(patientId: string): Promise<OutpatientEncounter[]> {
    return Array.from(this.encounters.values()).filter(encounter => encounter.patientId === patientId);
  }

  public async getScheduledEncounters(date?: Date): Promise<OutpatientEncounter[]> {
    if (date) {
      return this.scheduledEncounters.filter(encounter => 
        encounter.scheduledDate.toDateString() === date.toDateString()
      );
    }
    return this.scheduledEncounters.filter(encounter => encounter.status === 'Scheduled');
  }

  public async updateEncounterStatus(encounterId: string, status: OutpatientEncounter['status']): Promise<void> {
    const encounter = this.encounters.get(encounterId);
    if (encounter) {
      encounter.status = status;
      this.encounters.set(encounterId, encounter);
    }
  }
}