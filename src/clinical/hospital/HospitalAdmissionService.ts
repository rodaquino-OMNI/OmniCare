/**
 * Hospital Admission and Discharge Service
 * OmniCare EMR - Clinical Workflow Implementation
 */

import {
  HospitalAdmission,
  NursingAdmissionAssessment,
  PhysicianAdmissionAssessment,
  InpatientCareRecord,
  DischargeProcess,
  DischargePlanning,
  BedAssignment,
  AdmissionDiagnosis,
  NursingCarePlan,
  AdmissionRiskAssessment,
  FunctionalAssessment,
  DischargeReadiness,
  InpatientTreatmentPlan,
  CodeStatus,
  DischargeInstructions
} from './types';

import { Patient, VitalSigns, ClinicalOrder } from '../assessment/types';
import { MedicationReconciliation } from '../medication/types';

export class HospitalAdmissionService {
  private admissions: Map<string, HospitalAdmission> = new Map();
  private bedAssignments: Map<string, BedAssignment> = new Map();
  private inpatientCareRecords: Map<string, InpatientCareRecord[]> = new Map();
  private dischargePlans: Map<string, DischargePlanning> = new Map();

  /**
   * CLINICAL ADMISSION PROCESS WORKFLOWS (Nursing Staff)
   */

  /**
   * Perform admission assessment
   */
  async performNursingAdmissionAssessment(
    patientId: string,
    admissionId: string,
    nurseId: string,
    nurseName: string,
    baselineVitalSigns: VitalSigns,
    admissionWeight: number,
    admissionHeight: number
  ): Promise<NursingAdmissionAssessment> {
    
    const admission = this.admissions.get(admissionId);
    if (!admission) {
      throw new Error('Admission not found');
    }

    // Perform comprehensive nursing assessment
    const nursingAssessment: NursingAdmissionAssessment = {
      id: this.generateId(),
      admissionId,
      nurseId,
      nurseName,
      assessmentDate: new Date(),
      baselineVitalSigns,
      admissionWeight,
      admissionHeight,
      allergies: await this.verifyAllergies(patientId),
      medicationReconciliation: await this.performAdmissionMedicationReconciliation(patientId, nurseId),
      nursingCarePlan: await this.createInitialNursingCarePlan(patientId, admission),
      riskAssessments: await this.performAdmissionRiskAssessments(patientId, baselineVitalSigns),
      functionalAssessment: await this.performFunctionalAssessment(patientId),
      psychosocialAssessment: await this.performPsychosocialAssessment(patientId),
      nutritionalScreening: await this.performNutritionalScreening(patientId),
      skinAssessment: await this.performSkinIntegrityAssessment(patientId),
      fallPrevention: await this.createFallPreventionPlan(patientId, baselineVitalSigns),
      safetyMeasures: await this.implementSafetyMeasures(admission),
      patientEducation: await this.planAdmissionEducation(patientId),
      familyInvolvement: await this.assessFamilyInvolvement(patientId),
      dischargeNeedsAssessment: await this.performInitialDischargeNeedsAssessment(patientId)
    };

    // Orient patient to hospital environment
    await this.orientPatientToEnvironment(patientId, admission.bedAssignment);

    // Implement fall prevention and safety measures
    await this.implementFallPreventionMeasures(nursingAssessment.fallPrevention);

    // Complete risk assessments
    await this.implementRiskBasedInterventions(nursingAssessment.riskAssessments);

    admission.nursingAdmissionAssessment = nursingAssessment;
    this.admissions.set(admissionId, admission);

    return nursingAssessment;
  }

  /**
   * Document baseline vital signs and measurements
   */
  async documentBaselineAssessment(
    admissionId: string,
    nurseId: string,
    assessment: {
      vitalSigns: VitalSigns;
      weight: number;
      height: number;
      painLevel: number;
      skinCondition: string;
      mobilityLevel: string;
    }
  ): Promise<void> {
    const admission = this.admissions.get(admissionId);
    if (!admission || !admission.nursingAdmissionAssessment) {
      throw new Error('Admission or nursing assessment not found');
    }

    // Update baseline assessment
    admission.nursingAdmissionAssessment.baselineVitalSigns = assessment.vitalSigns;
    admission.nursingAdmissionAssessment.admissionWeight = assessment.weight;
    admission.nursingAdmissionAssessment.admissionHeight = assessment.height;

    // Document initial assessment findings
    const careRecord: InpatientCareRecord = {
      id: this.generateId(),
      admissionId,
      careDate: new Date(),
      shift: this.getCurrentShift(),
      nurseId,
      nurseName: await this.getNurseName(nurseId),
      nursingInterventions: [],
      vitalSigns: [assessment.vitalSigns],
      intakeOutput: {
        date: new Date(),
        shift: this.getCurrentShift(),
        oralIntake: 0,
        ivIntake: 0,
        otherIntake: 0,
        totalIntake: 0,
        urineOutput: 0,
        drainageOutput: 0,
        otherOutput: 0,
        totalOutput: 0,
        netBalance: 0,
        recordedBy: nurseId
      },
      medicationAdministration: [],
      patientResponse: {
        painLevel: assessment.painLevel,
        mentalStatus: 'Alert',
        activityTolerance: assessment.mobilityLevel,
        appetiteLevel: 'Fair',
        sleepQuality: 'Fair',
        moodAssessment: 'Stable',
        cooperationLevel: 'Cooperative'
      },
      safetyChecks: [],
      patientEducation: [],
      multidisciplinaryCare: [],
      progressNotes: [],
      familyCommunication: []
    };

    // Store initial care record
    if (!this.inpatientCareRecords.has(admissionId)) {
      this.inpatientCareRecords.set(admissionId, []);
    }
    this.inpatientCareRecords.get(admissionId)!.push(careRecord);

    this.admissions.set(admissionId, admission);
  }

  /**
   * Complete medication reconciliation
   */
  async completeAdmissionMedicationReconciliation(
    admissionId: string,
    nurseId: string,
    homemedications: any[],
    discrepancies: any[]
  ): Promise<MedicationReconciliation> {
    const admission = this.admissions.get(admissionId);
    if (!admission) {
      throw new Error('Admission not found');
    }

    const reconciliation: MedicationReconciliation = {
      id: this.generateId(),
      patientId: admission.patientId,
      reconciliationType: 'Admission',
      performedBy: nurseId,
      performedDate: new Date(),
      homemedications,
      admissionMedications: [],
      discrepancies,
      interventions: [],
      reconciliationComplete: discrepancies.length === 0,
      physicianReviewed: false,
      patientEducationProvided: true
    };

    // Generate interventions for discrepancies
    for (const discrepancy of discrepancies) {
      if (discrepancy.clinicalSignificance === 'High') {
        reconciliation.interventions.push({
          type: 'Clarify',
          medication: discrepancy.medication,
          action: 'Clarify with physician',
          rationale: discrepancy.description,
          communicatedToPhysician: false,
          implemented: false
        });
      }
    }

    if (admission.nursingAdmissionAssessment) {
      admission.nursingAdmissionAssessment.medicationReconciliation = reconciliation;
    }

    this.admissions.set(admissionId, admission);
    return reconciliation;
  }

  /**
   * PHYSICIAN ADMISSION WORKFLOWS (Physician - Exclusive)
   */

  /**
   * Complete admission history and physical
   */
  async completeAdmissionHistoryPhysical(
    admissionId: string,
    physicianId: string,
    physicianName: string,
    historyPhysical: {
      chiefComplaint: string;
      historyOfPresentIllness: string;
      pastMedicalHistory: string;
      physicalExamination: string;
      diagnosticImpression: string;
    }
  ): Promise<PhysicianAdmissionAssessment> {
    
    const admission = this.admissions.get(admissionId);
    if (!admission) {
      throw new Error('Admission not found');
    }

    const physicianAssessment: PhysicianAdmissionAssessment = {
      id: this.generateId(),
      admissionId,
      physicianId,
      physicianName,
      assessmentDate: new Date(),
      admissionHistoryPhysical: {
        chiefComplaint: historyPhysical.chiefComplaint,
        historyOfPresentIllness: historyPhysical.historyOfPresentIllness,
        pastMedicalHistory: historyPhysical.pastMedicalHistory,
        pastSurgicalHistory: '',
        familyHistory: '',
        socialHistory: '',
        allergies: '',
        currentMedications: '',
        reviewOfSystems: '',
        physicalExamination: historyPhysical.physicalExamination,
        diagnosticImpression: historyPhysical.diagnosticImpression,
        medicalDecisionMaking: ''
      },
      admissionOrders: [],
      admissionDiagnosis: await this.createAdmissionDiagnoses(historyPhysical.diagnosticImpression),
      treatmentPlan: await this.createInpatientTreatmentPlan(admission.patientId, historyPhysical.diagnosticImpression),
      levelOfCare: this.determineLevelOfCare(admission.admissionDiagnosis),
      admissionGoals: await this.createTreatmentGoals(historyPhysical.diagnosticImpression),
      expectedLengthOfStay: this.estimateLengthOfStay(admission.admissionDiagnosis),
      consultationsRequired: [],
      prophylaxisMeasures: await this.orderProphylaxisMeasures(admission.patientId),
      codeStatus: await this.determineCodeStatus(admission.patientId),
      advancedDirectives: await this.reviewAdvancedDirectives(admission.patientId),
      communicationPlan: await this.createCommunicationPlan(admission.patientId)
    };

    admission.physicianAdmissionAssessment = physicianAssessment;
    admission.status = 'Active';

    this.admissions.set(admissionId, admission);

    return physicianAssessment;
  }

  /**
   * Create admission orders
   */
  async createAdmissionOrders(
    admissionId: string,
    physicianId: string,
    orders: ClinicalOrder[]
  ): Promise<ClinicalOrder[]> {
    const admission = this.admissions.get(admissionId);
    if (!admission || !admission.physicianAdmissionAssessment || admission.physicianAdmissionAssessment.physicianId !== physicianId) {
      throw new Error('Unauthorized: Only the attending physician can create admission orders');
    }

    const admissionOrders: ClinicalOrder[] = [];

    for (const order of orders) {
      const admissionOrder: ClinicalOrder = {
        ...order,
        id: this.generateId(),
        orderedBy: physicianId,
        orderDate: new Date(),
        status: 'Pending'
      };

      admissionOrders.push(admissionOrder);
    }

    admission.physicianAdmissionAssessment.admissionOrders = admissionOrders;
    this.admissions.set(admissionId, admission);

    return admissionOrders;
  }

  /**
   * Document admission diagnosis and determine level of care
   */
  async documentAdmissionDiagnosis(
    admissionId: string,
    physicianId: string,
    diagnoses: AdmissionDiagnosis[]
  ): Promise<void> {
    const admission = this.admissions.get(admissionId);
    if (!admission || !admission.physicianAdmissionAssessment || admission.physicianAdmissionAssessment.physicianId !== physicianId) {
      throw new Error('Unauthorized: Only the attending physician can document admission diagnosis');
    }

    admission.admissionDiagnosis = diagnoses;
    admission.physicianAdmissionAssessment.admissionDiagnosis = diagnoses;

    // Update level of care based on diagnosis
    admission.physicianAdmissionAssessment.levelOfCare = this.determineLevelOfCare(diagnoses);

    this.admissions.set(admissionId, admission);
  }

  /**
   * INPATIENT CARE MANAGEMENT WORKFLOWS (Nursing Staff - Exclusive)
   */

  /**
   * Implement and document nursing interventions
   */
  async implementNursingInterventions(
    admissionId: string,
    nurseId: string,
    nurseName: string,
    interventions: string[]
  ): Promise<InpatientCareRecord> {
    const admission = this.admissions.get(admissionId);
    if (!admission) {
      throw new Error('Admission not found');
    }

    const nursingInterventions = interventions.map(intervention => ({
      intervention,
      time: new Date(),
      performedBy: nurseName,
      patientResponse: 'Tolerated well',
      complications: false,
      followUpRequired: false,
      effectiveness: 'Effective' as const
    }));

    const careRecord: InpatientCareRecord = {
      id: this.generateId(),
      admissionId,
      careDate: new Date(),
      shift: this.getCurrentShift(),
      nurseId,
      nurseName,
      nursingInterventions,
      vitalSigns: [],
      intakeOutput: {
        date: new Date(),
        shift: this.getCurrentShift(),
        oralIntake: 0,
        ivIntake: 0,
        otherIntake: 0,
        totalIntake: 0,
        urineOutput: 0,
        drainageOutput: 0,
        otherOutput: 0,
        totalOutput: 0,
        netBalance: 0,
        recordedBy: nurseId
      },
      medicationAdministration: [],
      patientResponse: {
        painLevel: 0,
        mentalStatus: 'Alert',
        activityTolerance: 'Good',
        appetiteLevel: 'Good',
        sleepQuality: 'Good',
        moodAssessment: 'Stable',
        cooperationLevel: 'Cooperative'
      },
      safetyChecks: [],
      patientEducation: [],
      multidisciplinaryCare: [],
      progressNotes: [],
      familyCommunication: []
    };

    // Store care record
    if (!this.inpatientCareRecords.has(admissionId)) {
      this.inpatientCareRecords.set(admissionId, []);
    }
    this.inpatientCareRecords.get(admissionId)!.push(careRecord);

    return careRecord;
  }

  /**
   * Monitor and record vital signs per protocol
   */
  async recordInpatientVitalSigns(
    admissionId: string,
    nurseId: string,
    vitalSigns: VitalSigns
  ): Promise<void> {
    const careRecords = this.inpatientCareRecords.get(admissionId) || [];
    const currentShift = this.getCurrentShift();
    
    // Find or create current shift record
    let currentRecord = careRecords.find(record => 
      record.careDate.toDateString() === new Date().toDateString() && 
      record.shift === currentShift
    );

    if (!currentRecord) {
      currentRecord = {
        id: this.generateId(),
        admissionId,
        careDate: new Date(),
        shift: currentShift,
        nurseId,
        nurseName: await this.getNurseName(nurseId),
        nursingInterventions: [],
        vitalSigns: [],
        intakeOutput: {
          date: new Date(),
          shift: currentShift,
          oralIntake: 0,
          ivIntake: 0,
          otherIntake: 0,
          totalIntake: 0,
          urineOutput: 0,
          drainageOutput: 0,
          otherOutput: 0,
          totalOutput: 0,
          netBalance: 0,
          recordedBy: nurseId
        },
        medicationAdministration: [],
        patientResponse: {
          painLevel: vitalSigns.painLevel || 0,
          mentalStatus: 'Alert',
          activityTolerance: 'Good',
          appetiteLevel: 'Good',
          sleepQuality: 'Good',
          moodAssessment: 'Stable',
          cooperationLevel: 'Cooperative'
        },
        safetyChecks: [],
        patientEducation: [],
        multidisciplinaryCare: [],
        progressNotes: [],
        familyCommunication: []
      };

      careRecords.push(currentRecord);
      this.inpatientCareRecords.set(admissionId, careRecords);
    }

    // Add vital signs to record
    currentRecord.vitalSigns.push(vitalSigns);

    // Check for critical values and create alerts
    await this.checkInpatientVitalSignsAlerts(admissionId, vitalSigns);
  }

  /**
   * Document fluid intake and output measurements
   */
  async documentIntakeOutput(
    admissionId: string,
    nurseId: string,
    intakeOutput: {
      oralIntake: number;
      ivIntake: number;
      urineOutput: number;
      drainageOutput: number;
    }
  ): Promise<void> {
    const careRecords = this.inpatientCareRecords.get(admissionId) || [];
    const currentShift = this.getCurrentShift();
    
    const currentRecord = careRecords.find(record => 
      record.careDate.toDateString() === new Date().toDateString() && 
      record.shift === currentShift
    );

    if (currentRecord) {
      currentRecord.intakeOutput = {
        date: new Date(),
        shift: currentShift,
        oralIntake: intakeOutput.oralIntake,
        ivIntake: intakeOutput.ivIntake,
        otherIntake: 0,
        totalIntake: intakeOutput.oralIntake + intakeOutput.ivIntake,
        urineOutput: intakeOutput.urineOutput,
        drainageOutput: intakeOutput.drainageOutput,
        otherOutput: 0,
        totalOutput: intakeOutput.urineOutput + intakeOutput.drainageOutput,
        netBalance: (intakeOutput.oralIntake + intakeOutput.ivIntake) - (intakeOutput.urineOutput + intakeOutput.drainageOutput),
        recordedBy: nurseId
      };

      this.inpatientCareRecords.set(admissionId, careRecords);
    }
  }

  /**
   * CLINICAL DISCHARGE PROCESS WORKFLOWS (Physician - Exclusive)
   */

  /**
   * Determine readiness for discharge
   */
  async determineDischargeReadiness(
    admissionId: string,
    physicianId: string
  ): Promise<DischargeReadiness> {
    const admission = this.admissions.get(admissionId);
    if (!admission || !admission.physicianAdmissionAssessment || admission.physicianAdmissionAssessment.physicianId !== physicianId) {
      throw new Error('Unauthorized: Only the attending physician can determine discharge readiness');
    }

    const dischargeReadiness: DischargeReadiness = {
      medicalStability: await this.assessMedicalStability(admissionId),
      painManagement: await this.assessPainManagement(admissionId),
      functionalCapacity: await this.assessFunctionalCapacity(admissionId),
      safeDischarge: await this.assessDischargeSafety(admissionId),
      caregiverReadiness: await this.assessCaregiverReadiness(admission.patientId),
      homeEnvironmentReady: await this.assessHomeEnvironment(admission.patientId),
      followUpArranged: false,
      equipmentArranged: false,
      transportationArranged: false,
      overallReadiness: false
    };

    dischargeReadiness.overallReadiness = Object.values(dischargeReadiness).every(value => 
      typeof value === 'boolean' ? value : true
    );

    return dischargeReadiness;
  }

  /**
   * Create discharge orders and reconcile medications
   */
  async createDischargeOrdersAndMedications(
    admissionId: string,
    physicianId: string,
    dischargeOrders: ClinicalOrder[],
    dischargeMedications: any[]
  ): Promise<DischargeProcess> {
    const admission = this.admissions.get(admissionId);
    if (!admission || !admission.physicianAdmissionAssessment || admission.physicianAdmissionAssessment.physicianId !== physicianId) {
      throw new Error('Unauthorized: Only the attending physician can create discharge orders');
    }

    const dischargeProcess: DischargeProcess = {
      id: this.generateId(),
      admissionId,
      dischargeDate: new Date(),
      dischargeTime: new Date(),
      dischargedBy: physicianId,
      dischargeDestination: 'Home',
      dischargeCondition: 'Improved',
      dischargeDiagnoses: admission.admissionDiagnosis.map(diag => ({
        icd10Code: diag.icd10Code,
        description: diag.description,
        type: diag.type,
        presentOnAdmission: diag.presentOnAdmission,
        resolved: true,
        chronicCondition: diag.chronicCondition
      })),
      physicianDischargeProcess: {
        readinessForDischarge: true,
        dischargeCriteriaMet: true,
        medicationReconciliation: true,
        followUpArranged: false,
        dischargeSummary: await this.generateDischargeSummary(admissionId),
        dischargeOrders,
        dischargePrescriptions: dischargeMedications,
        followUpAppointments: [],
        clearanceRequired: false
      },
      nursingDischargeProcess: {
        dischargeEducationCompleted: false,
        patientUnderstanding: 'Good',
        equipmentEducation: false,
        medicationEducation: false,
        activityEducation: false,
        followUpEducation: false,
        homeEnvironmentAssessed: false,
        caregiverEducation: false,
        finalVitalSigns: {} as VitalSigns,
        finalAssessment: '',
        dischargeSafety: 'Safe',
        transportationVerified: false
      },
      dischargeInstructions: await this.createDischargeInstructions(admissionId),
      dischargeEducation: {
        educationTopics: [],
        educationMethod: 'Combined',
        materialsProvided: [],
        interpreterUsed: false,
        familyEducated: false,
        caregiverEducated: false,
        returnDemonstration: false,
        competencyValidated: false,
        educationBarriers: [],
        followUpEducationNeeded: false
      },
      followUpPlan: {
        primaryCareProvider: '',
        primaryCareTimeframe: '1-2 weeks',
        specialistFollowUp: [],
        homeHealthServices: [],
        communityResources: [],
        emergencyPlan: {
          emergencyContacts: [],
          warningSymptoms: [],
          immediateActions: [],
          whenToCallEMS: [],
          hospitalToReturn: ''
        },
        coordinationOfCare: {
          primaryCoordinator: physicianId,
          communicationPlan: '',
          informationSharing: true,
          careTeamMembers: [],
          transitionSupport: ''
        }
      },
      homeCarePlanning: {
        homeEnvironmentSafe: true,
        homeModifications: [],
        caregiverCapacity: 'Adequate',
        caregiverTraining: [],
        safetyPlan: {
          safetyIssues: [],
          interventions: [],
          emergencyContacts: [],
          accessibilityNeeds: [],
          securityMeasures: []
        },
        emergencyPreparedness: {
          emergencySupplies: [],
          emergencyPlan: '',
          communicationPlan: '',
          medicationBackup: true,
          equipmentBackup: false
        }
      },
      equipmentArrangements: [],
      transportationArrangements: {
        method: 'Private Vehicle',
        scheduled: false,
        specialRequirements: [],
        insurance: 'Self-pay'
      },
      qualityMetrics: {
        lengthOfStay: Math.ceil((new Date().getTime() - admission.admissionDate.getTime()) / (1000 * 60 * 60 * 24)),
        readmissionRisk: 'Low',
        dischargeTimeliness: true,
        qualityIndicators: [],
        complications: [],
        preventableReadmission: false
      }
    };

    admission.dischargeProcess = dischargeProcess;
    admission.status = 'Discharged';

    this.admissions.set(admissionId, admission);

    return dischargeProcess;
  }

  /**
   * HELPER METHODS
   */

  private async verifyAllergies(patientId: string): Promise<any[]> {
    // Implementation would retrieve and verify patient allergies
    return [];
  }

  private async performAdmissionMedicationReconciliation(patientId: string, nurseId: string): Promise<MedicationReconciliation> {
    return {
      id: this.generateId(),
      patientId,
      reconciliationType: 'Admission',
      performedBy: nurseId,
      performedDate: new Date(),
      homemedications: [],
      admissionMedications: [],
      discrepancies: [],
      interventions: [],
      reconciliationComplete: true,
      physicianReviewed: false,
      patientEducationProvided: true
    };
  }

  private async createInitialNursingCarePlan(patientId: string, admission: HospitalAdmission): Promise<NursingCarePlan> {
    return {
      id: this.generateId(),
      nursingDiagnoses: [],
      carePlanGoals: [],
      nursingInterventions: [],
      patientOutcomes: [],
      evaluationDate: new Date(),
      planRevisions: []
    };
  }

  private async performAdmissionRiskAssessments(patientId: string, vitalSigns: VitalSigns): Promise<AdmissionRiskAssessment[]> {
    const assessments: AdmissionRiskAssessment[] = [];

    // Fall risk assessment
    assessments.push({
      riskType: 'Fall',
      assessmentTool: 'Morse Fall Scale',
      score: 25,
      riskLevel: 'Medium',
      riskFactors: ['Age > 65', 'History of falls'],
      preventiveInterventions: ['Bed alarm', 'Non-slip socks'],
      reassessmentInterval: 24,
      lastAssessment: new Date(),
      nextAssessment: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    return assessments;
  }

  private getCurrentShift(): 'Day' | 'Evening' | 'Night' {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 15) return 'Day';
    if (hour >= 15 && hour < 23) return 'Evening';
    return 'Night';
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * PUBLIC API METHODS
   */

  public async createAdmission(admission: Partial<HospitalAdmission>): Promise<HospitalAdmission> {
    const newAdmission: HospitalAdmission = {
      id: this.generateId(),
      status: 'Pending',
      inpatientCareRecords: [],
      dischargePlanning: {} as DischargePlanning,
      qualityIndicators: [],
      ...admission
    } as HospitalAdmission;

    this.admissions.set(newAdmission.id, newAdmission);

    return newAdmission;
  }

  public async getAdmission(admissionId: string): Promise<HospitalAdmission | undefined> {
    return this.admissions.get(admissionId);
  }

  public async getPatientAdmissions(patientId: string): Promise<HospitalAdmission[]> {
    return Array.from(this.admissions.values()).filter(admission => admission.patientId === patientId);
  }

  public async getInpatientCareRecords(admissionId: string): Promise<InpatientCareRecord[]> {
    return this.inpatientCareRecords.get(admissionId) || [];
  }

  public async getActiveAdmissions(): Promise<HospitalAdmission[]> {
    return Array.from(this.admissions.values()).filter(admission => admission.status === 'Active');
  }
}