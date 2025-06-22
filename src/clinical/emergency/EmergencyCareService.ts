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
  EmergencyProcedure,
  AnatomicalArea
} from './types';
import { FallPreventionPlan } from '../hospital/types';
import { v4 as uuidv4 } from 'uuid';

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
      finalDisposition: this.mapDispositionToFinalType(dispositionPlan.plannedDisposition),
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

  /**
   * TRIAGE ASSESSMENT HELPERS
   */

  private isTraumaPresentation(complaint: string, arrivalMethod: EmergencyEncounter['arrivalMethod']): boolean {
    const traumaKeywords = [
      'trauma', 'injury', 'accident', 'fall', 'assault', 'stabbing', 'gunshot',
      'mvc', 'mva', 'collision', 'crash', 'burn', 'laceration', 'fracture',
      'head injury', 'chest injury', 'penetrating'
    ];
    
    const hasTraumaKeyword = traumaKeywords.some(keyword => 
      complaint.toLowerCase().includes(keyword)
    );
    
    const isTraumaArrival = ['Ambulance', 'Helicopter', 'Police'].includes(arrivalMethod);
    
    return hasTraumaKeyword || isTraumaArrival;
  }

  private isMentalHealthPresentation(complaint: string): boolean {
    const mentalHealthKeywords = [
      'suicidal', 'suicide', 'depression', 'anxiety', 'panic', 'psychosis',
      'hallucination', 'delusion', 'paranoid', 'manic', 'bipolar', 'psychiatric',
      'self-harm', 'overdose', 'intoxication', 'withdrawal', 'agitated', 'violent',
      'homicidal', 'altered mental status', 'confusion'
    ];
    
    return mentalHealthKeywords.some(keyword => 
      complaint.toLowerCase().includes(keyword)
    );
  }

  private isModerateComplexity(assessment: TriageAssessment): boolean {
    // Check for moderate acuity conditions
    const hasModerateVitalSigns = 
      (assessment.vitalSigns.bloodPressure.systolic > 160 && assessment.vitalSigns.bloodPressure.systolic <= 180) ||
      (assessment.vitalSigns.heartRate > 100 && assessment.vitalSigns.heartRate <= 120) ||
      (assessment.vitalSigns.oxygenSaturation >= 92 && assessment.vitalSigns.oxygenSaturation < 95);
    
    const hasModerateSymptoms = 
      assessment.painAssessment.painLevel >= 4 && assessment.painAssessment.painLevel <= 7;
    
    const needsMultipleResources = 
      assessment.chiefComplaint.toLowerCase().includes('abdominal pain') ||
      assessment.chiefComplaint.toLowerCase().includes('headache') ||
      assessment.chiefComplaint.toLowerCase().includes('back pain');
    
    return hasModerateVitalSigns || hasModerateSymptoms || needsMultipleResources;
  }

  private isLowComplexity(assessment: TriageAssessment): boolean {
    // Check for low acuity conditions
    const hasStableVitalSigns = 
      assessment.vitalSigns.bloodPressure.systolic >= 90 && assessment.vitalSigns.bloodPressure.systolic <= 160 &&
      assessment.vitalSigns.heartRate >= 60 && assessment.vitalSigns.heartRate <= 100 &&
      assessment.vitalSigns.oxygenSaturation >= 95;
    
    const hasMinimalSymptoms = 
      assessment.painAssessment.painLevel < 4;
    
    const simpleComplaints = [
      'med refill', 'prescription', 'suture removal', 'wound check',
      'minor laceration', 'rash', 'sore throat', 'uri', 'uti symptoms'
    ];
    
    const isSimpleComplaint = simpleComplaints.some(complaint => 
      assessment.chiefComplaint.toLowerCase().includes(complaint)
    );
    
    return hasStableVitalSigns && (hasMinimalSymptoms || isSimpleComplaint);
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
    return uuidv4();
  }

  private getTriageLevelDescription(level: 1 | 2 | 3 | 4 | 5): string {
    const descriptions = {
      1: 'Resuscitation - Immediate life-saving intervention required',
      2: 'Emergent - High risk situation requiring immediate care',
      3: 'Urgent - Multiple resources needed, potential deterioration',
      4: 'Less Urgent - Single resource needed, stable',
      5: 'Non-Urgent - May be seen in fast track or referred'
    };
    return descriptions[level];
  }

  private getMaxWaitTime(level: 1 | 2 | 3 | 4 | 5): number {
    const waitTimes = { 1: 0, 2: 10, 3: 30, 4: 60, 5: 120 };
    return waitTimes[level];
  }

  private getResourceRequirements(level: 1 | 2 | 3 | 4 | 5): string[] {
    const resources = {
      1: ['Resuscitation room', 'Full team activation', 'All resources'],
      2: ['High acuity bed', 'Multiple resources', 'Immediate physician'],
      3: ['Treatment room', '2+ resources', 'Labs/imaging likely'],
      4: ['Fast track eligible', '1 resource', 'Simple intervention'],
      5: ['May defer to clinic', 'Minimal resources', 'Non-urgent']
    };
    return resources[level];
  }

  private getMonitoringFrequency(level: 1 | 2 | 3 | 4 | 5): number {
    const frequencies = { 1: 5, 2: 15, 3: 30, 4: 60, 5: 120 };
    return frequencies[level];
  }

  private getTreatmentArea(level: 1 | 2 | 3 | 4 | 5): 'Resuscitation' | 'Acute' | 'Urgent' | 'Fast Track' | 'Waiting Room' {
    const areas: Record<number, 'Resuscitation' | 'Acute' | 'Urgent' | 'Fast Track' | 'Waiting Room'> = {
      1: 'Resuscitation',
      2: 'Acute',
      3: 'Urgent',
      4: 'Fast Track',
      5: 'Waiting Room'
    };
    return areas[level];
  }

  private isSTEMIPresentation(assessment: TriageAssessment): boolean {
    const stemiKeywords = ['chest pain', 'heart attack', 'mi', 'cardiac'];
    return stemiKeywords.some(keyword => 
      assessment.chiefComplaint.toLowerCase().includes(keyword)
    ) && assessment.triageCategory.level <= 2;
  }

  private isStrokePresentation(assessment: TriageAssessment): boolean {
    const strokeKeywords = ['stroke', 'weakness', 'numbness', 'slurred speech', 'facial droop'];
    return strokeKeywords.some(keyword => 
      assessment.chiefComplaint.toLowerCase().includes(keyword)
    );
  }

  private isSepsisPresentation(assessment: TriageAssessment): boolean {
    return assessment.vitalSigns.temperature > 101 || 
           assessment.vitalSigns.temperature < 96.8 ||
           (assessment.vitalSigns.heartRate > 90 && assessment.vitalSigns.respiratoryRate > 20);
  }

  private isPediatricResuscitation(assessment: TriageAssessment): boolean {
    return assessment.chiefComplaint.toLowerCase().includes('pediatric') && 
           assessment.triageCategory.level === 1;
  }

  private async activatePediatricProtocol(assessment: TriageAssessment): Promise<EmergencyProtocol> {
    return {
      protocolName: 'Pediatric Resuscitation Protocol',
      indication: 'Pediatric emergency requiring resuscitation',
      interventions: [
        {
          intervention: 'Activate pediatric code team',
          timing: 'Immediate',
          priority: 'Critical',
          completed: false
        },
        {
          intervention: 'Obtain pediatric crash cart',
          timing: 'Immediate',
          priority: 'Critical',
          completed: false
        },
        {
          intervention: 'Calculate weight-based medication dosing',
          timing: 'Within 5 min',
          priority: 'Critical',
          completed: false
        }
      ],
      contraindications: [],
      precautions: ['Use pediatric-specific equipment', 'Weight-based dosing'],
      monitoringRequirements: ['Continuous monitoring', 'Frequent reassessment'],
      activatedBy: assessment.nurseId,
      activationTime: new Date()
    };
  }

  private async performTraumaAssessment(presentingComplaint: string, arrivalMethod: EmergencyEncounter['arrivalMethod']): Promise<TraumaAssessment> {
    const now = new Date();
    const anatomicalAreas: AnatomicalArea[] = [
      { region: 'Head', injured: false },
      { region: 'Neck', injured: false },
      { region: 'Chest', injured: false },
      { region: 'Abdomen', injured: false },
      { region: 'Pelvis', injured: false },
      { region: 'Extremities', injured: false },
      { region: 'Back', injured: false },
      { region: 'Spine', injured: false }
    ];

    return {
      mechanismOfInjury: presentingComplaint,
      timeOfInjury: now,
      traumaType: 'Blunt',
      anatomicalAreas,
      traumaScore: 0,
      traumaTeamActivated: arrivalMethod === 'Ambulance' || arrivalMethod === 'Helicopter',
      traumaTeamActivationCriteria: [],
      cSpineImmobilization: true,
      logRollRequired: true,
      primarySurvey: {
        airway: 'Patent',
        breathing: 'Adequate',
        circulation: 'Adequate',
        disability: 'None',
        exposure: 'Complete',
        interventions: []
      }
    };
  }

  private async performMentalHealthScreening(): Promise<MentalHealthScreening> {
    return {
      suicidalIdeation: false,
      homicidalIdeation: false,
      depressionScreen: 0,
      anxietyScreen: 0,
      substanceUseScreen: false,
      agitation: false,
      cooperativeness: 'Cooperative',
      mentalStatus: 'Alert and oriented',
      safetyRisk: 'Low',
      safeguardsRequired: [],
      psychiatricConsultNeeded: true
    };
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

  private mapDispositionToFinalType(plannedDisposition: 'Observation' | 'Transfer' | 'Discharge' | 'Admit' | 'OR' | 'ICU' | 'Morgue'): 'Discharged' | 'Admitted' | 'Transferred' | 'Deceased' | 'Left AMA' | 'Eloped' {
    const mapping: Record<string, 'Discharged' | 'Admitted' | 'Transferred' | 'Deceased' | 'Left AMA' | 'Eloped'> = {
      'Discharge': 'Discharged',
      'Admit': 'Admitted',
      'Transfer': 'Transferred',
      'Morgue': 'Deceased',
      'OR': 'Admitted',
      'ICU': 'Admitted',
      'Observation': 'Admitted'
    };
    return mapping[plannedDisposition] || 'Discharged';
  }

  /**
   * EMERGENCY CARE SUPPORT METHODS
   */

  private async generateStandingOrders(assessment: TriageAssessment): Promise<ClinicalOrder[]> {
    const orders: ClinicalOrder[] = [];
    
    // Basic standing orders based on triage category
    if (assessment.triageCategory.level <= 2) {
      orders.push({
        id: this.generateId(),
        type: 'Laboratory',
        description: 'CBC, BMP, PT/INR, Type & Screen',
        status: 'Pending',
        priority: 'STAT',
        orderedBy: 'Standing Order Protocol',
        orderDate: new Date()
      });
      
      orders.push({
        id: this.generateId(),
        type: 'Procedure',
        description: 'Establish IV access',
        status: 'Pending',
        priority: 'STAT',
        orderedBy: 'Standing Order Protocol',
        orderDate: new Date()
      });
    }
    
    // Chest pain standing orders
    if (assessment.chiefComplaint.toLowerCase().includes('chest pain')) {
      orders.push({
        id: this.generateId(),
        type: 'Laboratory',
        description: 'EKG',
        status: 'Pending',
        priority: 'STAT',
        orderedBy: 'Standing Order Protocol',
        orderDate: new Date()
      });
      
      orders.push({
        id: this.generateId(),
        type: 'Laboratory',
        description: 'Troponin, BNP',
        status: 'Pending',
        priority: 'STAT',
        orderedBy: 'Standing Order Protocol',
        orderDate: new Date()
      });
    }
    
    // Stroke standing orders
    if (this.isStrokePresentation(assessment)) {
      orders.push({
        id: this.generateId(),
        type: 'Imaging',
        description: 'CT Head without contrast',
        status: 'Pending',
        priority: 'STAT',
        orderedBy: 'Standing Order Protocol',
        orderDate: new Date()
      });
    }
    
    return orders;
  }

  private async determineImmediateInterventions(assessment: TriageAssessment): Promise<string[]> {
    const interventions: string[] = [];
    
    // Critical interventions based on vital signs
    if (assessment.vitalSigns.oxygenSaturation < 92) {
      interventions.push('Apply supplemental oxygen');
    }
    
    if (assessment.vitalSigns.bloodPressure.systolic < 90) {
      interventions.push('Start IV fluid resuscitation');
    }
    
    if (assessment.vitalSigns.temperature > 104) {
      interventions.push('Initiate cooling measures');
    }
    
    // Pain management
    if (assessment.painAssessment.painLevel >= 7) {
      interventions.push('Administer pain medication per protocol');
    }
    
    // Trauma interventions
    if (assessment.traumaAssessment) {
      interventions.push('Apply cervical collar');
      interventions.push('Maintain spinal immobilization');
    }
    
    // Mental health interventions
    if (assessment.mentalHealthAssessment?.safetyRisk === 'High') {
      interventions.push('Initiate 1:1 observation');
      interventions.push('Remove potentially harmful items');
    }
    
    return interventions;
  }

  private determineOrderPriority(
    order: ClinicalOrder,
    acuityLevel: number
  ): 'STAT' | 'Urgent' | 'Routine' {
    // Critical acuity always gets STAT
    if (acuityLevel === 1) return 'STAT';
    
    // Check order type and description for priority indicators
    const statIndicators = ['troponin', 'ekg', 'ct head', 'blood gas', 'lactate'];
    const orderDesc = order.description.toLowerCase();
    
    if (statIndicators.some(indicator => orderDesc.includes(indicator))) {
      return 'STAT';
    }
    
    // High acuity (level 2) defaults to Urgent
    if (acuityLevel === 2) return 'Urgent';
    
    // Lower acuity defaults to Routine
    return 'Routine';
  }

  private async activateSTATOrder(order: ClinicalOrder, encounterId: string): Promise<void> {
    // Notify relevant departments
    console.log(`STAT Order Activated: ${order.description}`);
    
    // In a real system, this would:
    // 1. Send notifications to appropriate departments
    // 2. Update order tracking systems
    // 3. Alert relevant staff
    // 4. Set up monitoring for completion
    
    // Update order status
    order.status = 'In Progress';
    
    // Create alert for STAT order
    this.activeAlerts.push({
      id: this.generateId(),
      alertType: 'Protocol Reminder',
      severity: 'High',
      message: `STAT Order: ${order.description} for encounter ${encounterId}`,
      patientId: '',
      encounterId,
      generatedBy: 'System',
      generatedDate: new Date(),
      acknowledged: false,
      resolved: false
    });
  }

  private async verifyEmergencyMedication(medication: string, acuityLevel: number): Promise<void> {
    // Verify medication is appropriate for emergency use
    const emergencyMedications = [
      'epinephrine', 'atropine', 'adenosine', 'amiodarone', 'lidocaine',
      'naloxone', 'nitroglycerin', 'aspirin', 'morphine', 'fentanyl',
      'midazolam', 'lorazepam', 'dexamethasone', 'albuterol', 'ipratropium'
    ];
    
    const medLower = medication.toLowerCase();
    const isEmergencyMed = emergencyMedications.some(med => medLower.includes(med));
    
    if (!isEmergencyMed && acuityLevel <= 2) {
      console.warn(`Non-emergency medication ordered for critical patient: ${medication}`);
    }
    
    // In a real system, this would:
    // 1. Check drug interactions
    // 2. Verify dosing is appropriate
    // 3. Check for allergies
    // 4. Ensure medication is available
  }

}
