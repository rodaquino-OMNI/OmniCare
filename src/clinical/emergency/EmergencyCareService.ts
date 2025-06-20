/**
 * Emergency Care Service
 * OmniCare EMR - Clinical Workflow Implementation
 */

import {
  EmergencyEncounter,
  TriageAssessment,
  EmergencyPhysicianAssessment,
  EmergencyTreatment,
  EmergencyDisposition,
  TriageCategory,
  EmergencyProtocol,
  TraumaAssessment,
  MentalHealthScreening,
  EmergencyAlert,
  CriticalCareIndicators,
  EmergencyQualityMetrics,
  EmergencyPainAssessment,
  NeuroStatus,
  RespiratoryStatus,
  CirculatoryStatus,
  DispositionPlanning,
  EmergencyConsultation,
  EmergencyProcedure
} from './types';

import { VitalSigns, Patient, ClinicalOrder } from '../assessment/types';

export class EmergencyCareService {
  private emergencyEncounters: Map<string, EmergencyEncounter> = new Map();
  private triageQueue: EmergencyEncounter[] = [];
  private activeAlerts: EmergencyAlert[] = [];
  private protocolLibrary: Map<string, EmergencyProtocol> = new Map();

  /**
   * EMERGENCY ASSESSMENT WORKFLOWS (Nursing Staff - Exclusive)
   */

  /**
   * Perform initial triage assessment
   */
  async performInitialTriageAssessment(
    patientId: string,
    nurseId: string,
    nurseName: string,
    presentingComplaint: string,
    vitalSigns: VitalSigns,
    arrivalMethod: EmergencyEncounter['arrivalMethod'] = 'Walk-in'
  ): Promise<{ encounter: EmergencyEncounter; triageAssessment: TriageAssessment }> {
    
    // Create emergency encounter
    const encounter: EmergencyEncounter = {
      id: this.generateId(),
      patientId,
      arrivalDate: new Date(),
      arrivalMethod,
      presentingComplaint,
      emergencyContactNotified: false,
      treatmentRecords: [],
      disposition: {} as EmergencyDisposition,
      status: 'Arrived',
      acuityLevel: 3, // Initial assignment, will be determined by triage
      isolationPrecautions: []
    };

    // Perform comprehensive triage assessment
    const triageAssessment: TriageAssessment = {
      id: this.generateId(),
      nurseId,
      nurseName,
      triageDate: new Date(),
      triageProtocol: 'ESI', // Emergency Severity Index
      chiefComplaint: presentingComplaint,
      vitalSigns,
      painAssessment: await this.performEmergencyPainAssessment(presentingComplaint),
      neurologicalStatus: await this.assessNeurologicalStatus(vitalSigns),
      respiratoryStatus: await this.assessRespiratoryStatus(vitalSigns),
      circulatoryStatus: await this.assessCirculatoryStatus(vitalSigns),
      triageCategory: {} as TriageCategory,
      priorityScore: 0,
      emergencyProtocols: [],
      standingOrders: [],
      immediateInterventions: [],
      triageNotes: '',
      reassessmentRequired: false
    };

    // Assess for trauma
    if (this.isTraumaPresentation(presentingComplaint, arrivalMethod)) {
      triageAssessment.traumaAssessment = await this.performTraumaAssessment(presentingComplaint, arrivalMethod);
    }

    // Assess mental health concerns
    if (this.isMentalHealthPresentation(presentingComplaint)) {
      triageAssessment.mentalHealthAssessment = await this.performMentalHealthScreening();
    }

    // Calculate triage category and acuity
    const triageResult = await this.calculateTriageCategory(triageAssessment);
    triageAssessment.triageCategory = triageResult.category;
    triageAssessment.priorityScore = triageResult.priority;
    encounter.acuityLevel = triageResult.category.level;

    // Activate emergency protocols if needed
    triageAssessment.emergencyProtocols = await this.activateEmergencyProtocols(triageAssessment);

    // Generate standing orders based on presentation
    triageAssessment.standingOrders = await this.generateStandingOrders(triageAssessment);

    // Determine immediate interventions
    triageAssessment.immediateInterventions = await this.determineImmediateInterventions(triageAssessment);

    // Set reassessment requirements
    if (encounter.acuityLevel <= 2) {
      triageAssessment.reassessmentRequired = true;
      triageAssessment.reassessmentInterval = encounter.acuityLevel === 1 ? 15 : 30; // minutes
    }

    encounter.triageAssessment = triageAssessment;
    encounter.status = 'Triaged';

    // Add to triage queue based on priority
    this.addToTriageQueue(encounter);

    // Generate critical alerts if needed
    await this.checkForCriticalAlerts(encounter);

    this.emergencyEncounters.set(encounter.id, encounter);

    return { encounter, triageAssessment };
  }

  /**
   * Assign triage category based on severity
   */
  async calculateTriageCategory(assessment: TriageAssessment): Promise<{ category: TriageCategory; priority: number }> {
    let priority = 0;
    let level: 1 | 2 | 3 | 4 | 5 = 5;

    // Critical vital signs = Level 1
    if (this.hasCriticalVitalSigns(assessment.vitalSigns)) {
      level = 1;
      priority = 100;
    }
    // High-risk presentations = Level 2
    else if (this.isHighRiskPresentation(assessment)) {
      level = 2;
      priority = 80;
    }
    // Moderate complexity = Level 3
    else if (this.isModerateComplexity(assessment)) {
      level = 3;
      priority = 60;
    }
    // Low complexity = Level 4
    else if (this.isLowComplexity(assessment)) {
      level = 4;
      priority = 40;
    }
    // Non-urgent = Level 5
    else {
      level = 5;
      priority = 20;
    }

    const category: TriageCategory = {
      level,
      description: this.getTriageLevelDescription(level),
      maxWaitTime: this.getMaxWaitTime(level),
      resourceRequirements: this.getResourceRequirements(level),
      monitoringFrequency: this.getMonitoringFrequency(level),
      expectedTreatmentArea: this.getTreatmentArea(level)
    };

    return { category, priority };
  }

  /**
   * Initiate emergency protocols when indicated
   */
  async activateEmergencyProtocols(assessment: TriageAssessment): Promise<EmergencyProtocol[]> {
    const protocols: EmergencyProtocol[] = [];

    // STEMI Protocol
    if (this.isSTEMIPresentation(assessment)) {
      protocols.push(await this.activateSTEMIProtocol(assessment));
    }

    // Stroke Protocol
    if (this.isStrokePresentation(assessment)) {
      protocols.push(await this.activateStrokeProtocol(assessment));
    }

    // Sepsis Protocol
    if (this.isSepsisPresentation(assessment)) {
      protocols.push(await this.activateSepsisProtocol(assessment));
    }

    // Trauma Protocol
    if (assessment.traumaAssessment?.traumaTeamActivated) {
      protocols.push(await this.activateTraumaProtocol(assessment));
    }

    // Pediatric Resuscitation Protocol
    if (this.isPediatricResuscitation(assessment)) {
      protocols.push(await this.activatePediatricProtocol(assessment));
    }

    return protocols;
  }

  /**
   * PHYSICIAN ASSESSMENT WORKFLOWS (Physician - Exclusive)
   */

  /**
   * Perform rapid emergency assessment
   */
  async performEmergencyPhysicianAssessment(
    encounterId: string,
    physicianId: string,
    physicianName: string
  ): Promise<EmergencyPhysicianAssessment> {
    const encounter = this.emergencyEncounters.get(encounterId);
    if (!encounter) {
      throw new Error('Emergency encounter not found');
    }

    const assessment: EmergencyPhysicianAssessment = {
      id: this.generateId(),
      physicianId,
      physicianName,
      assessmentDate: new Date(),
      rapidAssessmentCompleted: true,
      historyOfPresentIllness: '',
      pastMedicalHistory: '',
      currentMedications: '',
      allergies: '',
      socialHistory: '',
      physicalExamination: {
        generalAppearance: '',
        vitalSigns: encounter.triageAssessment?.vitalSigns || {} as VitalSigns,
        heent: '',
        cardiovascular: '',
        respiratory: '',
        abdominal: '',
        neurological: '',
        musculoskeletal: '',
        extremities: '',
        skin: '',
        psychiatric: '',
        focusedExam: []
      },
      diagnosticImpression: [],
      differentialDiagnosis: [],
      emergencyManagementPlan: {
        immediateInterventions: [],
        medicationOrders: [],
        diagnosticOrders: [],
        proceduralOrders: [],
        monitoringPlan: {
          vitalSignsFrequency: 15,
          neurologyChecks: false,
          cardiacMonitoring: false,
          oxygenSaturationMonitoring: true,
          fluidBalance: false,
          painReassessment: 60,
          otherMonitoring: []
        },
        treatmentGoals: [],
        responseToTreatment: '',
        contingencyPlans: []
      },
      riskStratification: {
        overallRiskLevel: 'Moderate',
        riskFactors: [],
        protectiveFactors: [],
        riskScores: [],
        riskMitigationStrategies: []
      },
      dispositionPlanning: {} as DispositionPlanning,
      consultationsRequested: [],
      proceduresPerformed: [],
      criticalCare: {
        criticalCareRequired: false,
        airwayManagement: false,
        mechanicalVentilation: false,
        vasopressorSupport: false,
        continuousMonitoring: false,
        criticalCareProcedures: [],
        criticalCareTeam: []
      },
      reassessmentSchedule: {
        nextReassessment: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        reassessmentFrequency: 60,
        triggerCriteria: [],
        parameters: [],
        responsibleProvider: physicianId
      }
    };

    encounter.physicianAssessment = assessment;
    encounter.status = 'In Treatment';

    this.emergencyEncounters.set(encounterId, encounter);

    return assessment;
  }

  /**
   * Order emergent diagnostics and interventions (Physician - Exclusive)
   */
  async orderEmergentInterventions(
    encounterId: string,
    physicianId: string,
    orders: ClinicalOrder[]
  ): Promise<ClinicalOrder[]> {
    const encounter = this.emergencyEncounters.get(encounterId);
    if (!encounter || !encounter.physicianAssessment || encounter.physicianAssessment.physicianId !== physicianId) {
      throw new Error('Unauthorized: Only the assigned physician can order interventions');
    }

    const emergentOrders: ClinicalOrder[] = [];

    for (const order of orders) {
      const emergentOrder: ClinicalOrder = {
        ...order,
        id: this.generateId(),
        orderedBy: physicianId,
        orderDate: new Date(),
        status: 'Pending',
        priority: this.determineOrderPriority(order, encounter.acuityLevel)
      };

      // Auto-activate STAT orders
      if (emergentOrder.priority === 'STAT') {
        await this.activateSTATOrder(emergentOrder, encounterId);
      }

      emergentOrders.push(emergentOrder);
    }

    // Update management plan
    encounter.physicianAssessment.emergencyManagementPlan.medicationOrders.push(
      ...emergentOrders.filter(o => o.type === 'Medication')
    );
    encounter.physicianAssessment.emergencyManagementPlan.diagnosticOrders.push(
      ...emergentOrders.filter(o => o.type === 'Laboratory' || o.type === 'Imaging')
    );
    encounter.physicianAssessment.emergencyManagementPlan.proceduralOrders.push(
      ...emergentOrders.filter(o => o.type === 'Procedure')
    );

    this.emergencyEncounters.set(encounterId, encounter);

    return emergentOrders;
  }

  /**
   * Determine disposition (admit, discharge, transfer)
   */
  async determineDisposition(
    encounterId: string,
    physicianId: string,
    dispositionPlan: DispositionPlanning
  ): Promise<EmergencyDisposition> {
    const encounter = this.emergencyEncounters.get(encounterId);
    if (!encounter || !encounter.physicianAssessment || encounter.physicianAssessment.physicianId !== physicianId) {
      throw new Error('Unauthorized: Only the assigned physician can determine disposition');
    }

    const disposition: EmergencyDisposition = {
      finalDisposition: dispositionPlan.plannedDisposition,
      dispositionDate: new Date(),
      dispositionTime: new Date(),
      dispositionBy: physicianId,
      dischargeInstructions: {
        activityRestrictions: [],
        dietInstructions: [],
        medicationInstructions: [],
        symptomMonitoring: [],
        emergencyReasonReasons: [],
        followUpInstructions: [],
        educationMaterials: [],
        interpreterUsed: false,
        patientUnderstanding: 'Good'
      },
      prescriptions: [],
      followUpAppointments: [],
      returnPrecautions: [],
      conditionAtDischarge: 'Improved',
      functionalStatus: 'Baseline'
    };

    // Set disposition-specific details
    switch (dispositionPlan.plannedDisposition) {
      case 'Admit':
        disposition.admittingService = dispositionPlan.admissionCriteria?.preferredUnit;
        disposition.admittingPhysician = physicianId;
        break;
      case 'Transfer':
        disposition.transferDestination = dispositionPlan.transferCriteria?.receivingFacility;
        disposition.transferMode = dispositionPlan.transferCriteria?.mode;
        break;
      case 'Discharge':
        disposition.dischargeLocation = 'Home';
        break;
    }

    encounter.disposition = disposition;
    encounter.status = 'Awaiting Disposition';

    this.emergencyEncounters.set(encounterId, encounter);

    return disposition;
  }

  /**
   * EMERGENCY TREATMENT WORKFLOWS (Nursing Staff - Exclusive)
   */

  /**
   * Implement emergency interventions
   */
  async implementEmergencyInterventions(
    encounterId: string,
    nurseId: string,
    nurseName: string,
    interventions: string[]
  ): Promise<EmergencyTreatment[]> {
    const encounter = this.emergencyEncounters.get(encounterId);
    if (!encounter) {
      throw new Error('Emergency encounter not found');
    }

    const treatments: EmergencyTreatment[] = [];

    for (const intervention of interventions) {
      const treatment: EmergencyTreatment = {
        id: this.generateId(),
        treatmentType: 'Intervention',
        description: intervention,
        indication: encounter.presentingComplaint,
        performedBy: nurseName,
        performedDate: new Date(),
        startTime: new Date(),
        response: {
          immediateResponse: 'Intervention completed',
          vitalSignsChange: false,
          symptomImprovement: false,
          functionalImprovement: false,
          adverseReaction: false,
          timeToResponse: 0,
          patientReportedOutcome: ''
        },
        complications: false,
        effectiveness: 'Good',
        sideEffects: false,
        monitoringRequired: true,
        treatmentNotes: `Emergency intervention: ${intervention}`
      };

      treatments.push(treatment);
      encounter.treatmentRecords.push(treatment);
    }

    this.emergencyEncounters.set(encounterId, encounter);

    return treatments;
  }

  /**
   * Administer emergency medications
   */
  async administerEmergencyMedications(
    encounterId: string,
    nurseId: string,
    nurseName: string,
    medications: { medication: string; dose: string; route: string; indication: string }[]
  ): Promise<EmergencyTreatment[]> {
    const encounter = this.emergencyEncounters.get(encounterId);
    if (!encounter) {
      throw new Error('Emergency encounter not found');
    }

    const treatments: EmergencyTreatment[] = [];

    for (const med of medications) {
      // Verify emergency medication protocols
      await this.verifyEmergencyMedication(med.medication, encounter.acuityLevel);

      const treatment: EmergencyTreatment = {
        id: this.generateId(),
        treatmentType: 'Medication',
        description: `${med.medication} ${med.dose} ${med.route}`,
        indication: med.indication,
        performedBy: nurseName,
        performedDate: new Date(),
        startTime: new Date(),
        response: {
          immediateResponse: 'Medication administered',
          vitalSignsChange: false,
          symptomImprovement: false,
          functionalImprovement: false,
          adverseReaction: false,
          timeToResponse: 0
        },
        complications: false,
        effectiveness: 'Good',
        sideEffects: false,
        monitoringRequired: true,
        treatmentNotes: `Emergency medication: ${med.medication} for ${med.indication}`
      };

      treatments.push(treatment);
      encounter.treatmentRecords.push(treatment);
    }

    this.emergencyEncounters.set(encounterId, encounter);

    return treatments;
  }

  /**
   * Perform continuous monitoring
   */
  async performContinuousMonitoring(
    encounterId: string,
    nurseId: string,
    monitoringType: 'Cardiac' | 'Neurological' | 'Respiratory' | 'Pain' | 'Vital Signs'
  ): Promise<void> {
    const encounter = this.emergencyEncounters.get(encounterId);
    if (!encounter) {
      throw new Error('Emergency encounter not found');
    }

    // Update monitoring plan
    if (encounter.physicianAssessment?.emergencyManagementPlan.monitoringPlan) {
      const monitoringPlan = encounter.physicianAssessment.emergencyManagementPlan.monitoringPlan;
      
      switch (monitoringType) {
        case 'Cardiac':
          monitoringPlan.cardiacMonitoring = true;
          break;
        case 'Neurological':
          monitoringPlan.neurologyChecks = true;
          monitoringPlan.neurologyFrequency = 15;
          break;
        case 'Vital Signs':
          monitoringPlan.vitalSignsFrequency = 15;
          break;
        case 'Pain':
          monitoringPlan.painReassessment = 30;
          break;
      }
    }

    this.emergencyEncounters.set(encounterId, encounter);
  }

  /**
   * EMERGENCY PROTOCOL IMPLEMENTATIONS
   */

  private async activateSTEMIProtocol(assessment: TriageAssessment): Promise<EmergencyProtocol> {
    return {
      protocolName: 'STEMI Protocol',
      indication: 'ST-Elevation Myocardial Infarction',
      interventions: [
        {
          intervention: 'Obtain 12-lead EKG',
          timing: 'Immediate',
          priority: 'Critical',
          completed: false
        },
        {
          intervention: 'Activate cardiac catheterization lab',
          timing: 'Within 5 min',
          priority: 'Critical',
          completed: false
        },
        {
          intervention: 'Administer aspirin 325mg',
          timing: 'Immediate',
          priority: 'Critical',
          completed: false
        },
        {
          intervention: 'Start IV access',
          timing: 'Immediate',
          priority: 'High',
          completed: false
        }
      ],
      contraindications: ['Active bleeding', 'Recent surgery'],
      precautions: ['Monitor for bleeding'],
      monitoringRequirements: ['Continuous cardiac monitoring', 'Vital signs q15min'],
      activatedBy: assessment.nurseId,
      activationTime: new Date()
    };
  }

  private async activateStrokeProtocol(assessment: TriageAssessment): Promise<EmergencyProtocol> {
    return {
      protocolName: 'Acute Stroke Protocol',
      indication: 'Suspected acute stroke',
      interventions: [
        {
          intervention: 'Obtain NIHSS score',
          timing: 'Within 15 min',
          priority: 'Critical',
          completed: false
        },
        {
          intervention: 'Stat CT head without contrast',
          timing: 'Within 15 min',
          priority: 'Critical',
          completed: false
        },
        {
          intervention: 'Activate stroke team',
          timing: 'Immediate',
          priority: 'Critical',
          completed: false
        }
      ],
      contraindications: [],
      precautions: ['Monitor neurological status'],
      monitoringRequirements: ['Neuro checks q15min', 'Blood pressure monitoring'],
      activatedBy: assessment.nurseId,
      activationTime: new Date()
    };
  }

  private async activateSepsisProtocol(assessment: TriageAssessment): Promise<EmergencyProtocol> {
    return {
      protocolName: 'Sepsis Protocol',
      indication: 'Suspected sepsis',
      interventions: [
        {
          intervention: 'Obtain blood cultures',
          timing: 'Within 30 min',
          priority: 'High',
          completed: false
        },
        {
          intervention: 'Start broad spectrum antibiotics',
          timing: 'Within 1 hour',
          priority: 'High',
          completed: false
        },
        {
          intervention: 'Fluid resuscitation',
          timing: 'Within 30 min',
          priority: 'High',
          completed: false
        }
      ],
      contraindications: ['Fluid overload'],
      precautions: ['Monitor fluid balance'],
      monitoringRequirements: ['Vital signs q15min', 'Urine output'],
      activatedBy: assessment.nurseId,
      activationTime: new Date()
    };
  }

  private async activateTraumaProtocol(assessment: TriageAssessment): Promise<EmergencyProtocol> {
    return {
      protocolName: 'Trauma Team Activation',
      indication: 'Major trauma',
      interventions: [
        {
          intervention: 'Activate trauma team',
          timing: 'Immediate',
          priority: 'Critical',
          completed: false
        },
        {
          intervention: 'Primary survey (ABCDE)',
          timing: 'Immediate',
          priority: 'Critical',
          completed: false
        },
        {
          intervention: 'Cervical spine immobilization',
          timing: 'Immediate',
          priority: 'Critical',
          completed: false
        }
      ],
      contraindications: [],
      precautions: ['Maintain spinal precautions'],
      monitoringRequirements: ['Continuous monitoring', 'Serial assessments'],
      activatedBy: assessment.nurseId,
      activationTime: new Date()
    };
  }

  /**
   * HELPER METHODS
   */

  private async performEmergencyPainAssessment(complaint: string): Promise<EmergencyPainAssessment> {
    const hasPain = ['pain', 'ache', 'hurt', 'sore', 'burning'].some(term => 
      complaint.toLowerCase().includes(term)
    );

    return {
      painLevel: hasPain ? 7 : 0,
      location: hasPain ? 'Multiple' : 'None',
      onset: 'Sudden',
      character: 'Sharp',
      alleviatingFactors: [],
      aggravatingFactors: [],
      associatedSymptoms: [],
      functionalImpact: hasPain ? 'Moderate' : 'None'
    };
  }

  private async assessNeurologicalStatus(vitalSigns: VitalSigns): Promise<NeuroStatus> {
    return {
      levelOfConsciousness: 'Alert',
      glasgowComaScale: {
        eye: 4,
        verbal: 5,
        motor: 6,
        total: 15
      },
      pupilResponse: {
        left: 'Reactive',
        right: 'Reactive',
        size: '3mm'
      },
      orientation: {
        person: true,
        place: true,
        time: true,
        situation: true
      },
      motorFunction: 'Normal',
      sensoryFunction: 'Normal',
      speechPattern: 'Clear',
      cognitiveStatus: 'Normal'
    };
  }

  private async assessRespiratoryStatus(vitalSigns: VitalSigns): Promise<RespiratoryStatus> {
    return {
      respiratoryRate: vitalSigns.respiratoryRate,
      oxygenSaturation: vitalSigns.oxygenSaturation,
      supplementalOxygen: vitalSigns.oxygenSaturation < 92,
      breathSounds: {
        left: 'Clear',
        right: 'Clear'
      },
      respiratoryEffort: vitalSigns.respiratoryRate > 20 ? 'Labored' : 'Normal',
      coughPresent: false,
      sputumProduction: false,
      accessoryMuscleUse: false,
      cyanosis: vitalSigns.oxygenSaturation < 88
    };
  }

  private async assessCirculatoryStatus(vitalSigns: VitalSigns): Promise<CirculatoryStatus> {
    return {
      heartRate: vitalSigns.heartRate,
      bloodPressure: vitalSigns.bloodPressure,
      pulseQuality: 'Strong',
      pulseRhythm: 'Regular',
      capillaryRefill: 2,
      peripheralPulses: [],
      skinColor: 'Normal',
      skinTemperature: 'Normal',
      edema: false,
      jugularVenousDistention: false
    };
  }

  private hasCriticalVitalSigns(vitalSigns: VitalSigns): boolean {
    return (
      vitalSigns.bloodPressure.systolic < 70 ||
      vitalSigns.bloodPressure.systolic > 220 ||
      vitalSigns.heartRate < 40 ||
      vitalSigns.heartRate > 150 ||
      vitalSigns.respiratoryRate < 8 ||
      vitalSigns.respiratoryRate > 30 ||
      vitalSigns.oxygenSaturation < 85 ||
      vitalSigns.temperature > 104 ||
      vitalSigns.temperature < 95
    );
  }

  private isHighRiskPresentation(assessment: TriageAssessment): boolean {
    const highRiskComplaints = [
      'chest pain', 'shortness of breath', 'stroke symptoms',
      'severe bleeding', 'unconscious', 'seizure'
    ];
    
    return highRiskComplaints.some(complaint => 
      assessment.chiefComplaint.toLowerCase().includes(complaint)
    );
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * PUBLIC API METHODS
   */

  public async getEmergencyEncounter(encounterId: string): Promise<EmergencyEncounter | undefined> {
    return this.emergencyEncounters.get(encounterId);
  }

  public async getTriageQueue(): Promise<EmergencyEncounter[]> {
    return this.triageQueue.sort((a, b) => a.acuityLevel - b.acuityLevel);
  }

  public async getActiveAlerts(): Promise<EmergencyAlert[]> {
    return this.activeAlerts.filter(alert => !alert.acknowledged);
  }

  private addToTriageQueue(encounter: EmergencyEncounter): void {
    this.triageQueue.push(encounter);
    this.triageQueue.sort((a, b) => a.acuityLevel - b.acuityLevel);
  }

  private async checkForCriticalAlerts(encounter: EmergencyEncounter): Promise<void> {
    if (encounter.acuityLevel === 1) {
      this.activeAlerts.push({
        id: this.generateId(),
        alertType: 'Critical Value',
        severity: 'High',
        message: `Critical patient arrived: ${encounter.presentingComplaint}`,
        patientId: encounter.patientId,
        encounterId: encounter.id,
        generatedBy: 'System',
        generatedDate: new Date(),
        acknowledged: false,
        resolved: false
      });
    }
  }
}