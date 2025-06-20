/**
 * Emergency Care Types and Interfaces
 * OmniCare EMR - Clinical Workflow System
 */

import { VitalSigns, ClinicalOrder, Patient } from '../assessment/types';

export interface EmergencyEncounter {
  id: string;
  patientId: string;
  arrivalDate: Date;
  arrivalMethod: 'Walk-in' | 'Ambulance' | 'Police' | 'Transfer' | 'Helicopter';
  presentingComplaint: string;
  emergencyContactNotified: boolean;
  triageAssessment?: TriageAssessment;
  physicianAssessment?: EmergencyPhysicianAssessment;
  treatmentRecords: EmergencyTreatment[];
  disposition: EmergencyDisposition;
  departureDate?: Date;
  status: 'Arrived' | 'Triaged' | 'In Treatment' | 'Awaiting Disposition' | 'Discharged' | 'Admitted' | 'Transferred' | 'Deceased';
  acuityLevel: 1 | 2 | 3 | 4 | 5; // 1=Critical, 5=Non-urgent
  bedAssignment?: string;
  isolationPrecautions?: IsolationPrecaution[];
}

export interface TriageAssessment {
  id: string;
  nurseId: string;
  nurseName: string;
  triageDate: Date;
  triageProtocol: 'ESI' | 'CTAS' | 'MTS' | 'ATS'; // Emergency Severity Index, etc.
  chiefComplaint: string;
  vitalSigns: VitalSigns;
  painAssessment: EmergencyPainAssessment;
  neurologicalStatus: NeuroStatus;
  respiratoryStatus: RespiratoryStatus;
  circulatoryStatus: CirculatoryStatus;
  traumaAssessment?: TraumaAssessment;
  mentalHealthAssessment?: MentalHealthScreening;
  triageCategory: TriageCategory;
  priorityScore: number;
  emergencyProtocols: EmergencyProtocol[];
  standingOrders: ClinicalOrder[];
  immediateInterventions: string[];
  triageNotes: string;
  reassessmentRequired: boolean;
  reassessmentInterval?: number; // minutes
}

export interface EmergencyPainAssessment {
  painLevel: number; // 0-10 scale
  location: string;
  onset: 'Sudden' | 'Gradual' | 'Progressive';
  character: string;
  radiationPattern?: string;
  alleviatingFactors: string[];
  aggravatingFactors: string[];
  associatedSymptoms: string[];
  functionalImpact: 'None' | 'Mild' | 'Moderate' | 'Severe';
  lastPainMedication?: string;
  lastMedicationTime?: Date;
  effectivenessOfLastMedication?: 'None' | 'Minimal' | 'Moderate' | 'Complete';
}

export interface NeuroStatus {
  levelOfConsciousness: 'Alert' | 'Verbal' | 'Pain' | 'Unresponsive';
  glasgowComaScale: {
    eye: number;
    verbal: number;
    motor: number;
    total: number;
  };
  pupilResponse: {
    left: 'Reactive' | 'Sluggish' | 'Fixed';
    right: 'Reactive' | 'Sluggish' | 'Fixed';
    size: string;
  };
  orientation: {
    person: boolean;
    place: boolean;
    time: boolean;
    situation: boolean;
  };
  motorFunction: string;
  sensoryFunction: string;
  speechPattern: string;
  cognitiveStatus: string;
}

export interface RespiratoryStatus {
  respiratoryRate: number;
  oxygenSaturation: number;
  supplementalOxygen: boolean;
  oxygenDeliveryMethod?: string;
  oxygenFlow?: number;
  breathSounds: {
    left: string;
    right: string;
  };
  respiratoryEffort: 'Normal' | 'Labored' | 'Distressed';
  coughPresent: boolean;
  sputumProduction: boolean;
  sputumCharacter?: string;
  accessoryMuscleUse: boolean;
  cyanosis: boolean;
}

export interface CirculatoryStatus {
  heartRate: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  pulseQuality: 'Strong' | 'Weak' | 'Thready' | 'Bounding';
  pulseRhythm: 'Regular' | 'Irregular';
  capillaryRefill: number; // seconds
  peripheralPulses: PulseAssessment[];
  skinColor: 'Normal' | 'Pale' | 'Flushed' | 'Cyanotic' | 'Mottled';
  skinTemperature: 'Normal' | 'Cool' | 'Warm' | 'Hot';
  edema: boolean;
  edemaLocation?: string[];
  jugularVenousDistention: boolean;
}

export interface PulseAssessment {
  location: 'Radial' | 'Ulnar' | 'Brachial' | 'Carotid' | 'Femoral' | 'Popliteal' | 'Dorsalis Pedis' | 'Posterior Tibial';
  present: boolean;
  quality: 'Strong' | 'Weak' | 'Absent';
}

export interface TraumaAssessment {
  mechanismOfInjury: string;
  timeOfInjury: Date;
  traumaType: 'Blunt' | 'Penetrating' | 'Burn' | 'Chemical' | 'Electrical' | 'Thermal';
  anatomicalAreas: AnatomicalArea[];
  traumaScore: number;
  injurySeverityScore?: number;
  traumaTeamActivated: boolean;
  traumaTeamActivationCriteria: string[];
  cSpineImmobilization: boolean;
  logRollRequired: boolean;
  primarySurvey: PrimarySurvey;
  secondarySurvey?: SecondarySurvey;
}

export interface AnatomicalArea {
  region: 'Head' | 'Neck' | 'Chest' | 'Abdomen' | 'Pelvis' | 'Extremities' | 'Back' | 'Spine';
  injured: boolean;
  injuryType?: string;
  severity?: 'Minor' | 'Moderate' | 'Severe' | 'Critical';
  description?: string;
}

export interface PrimarySurvey {
  airway: 'Patent' | 'Compromised' | 'Obstructed';
  breathing: 'Adequate' | 'Inadequate' | 'Absent';
  circulation: 'Adequate' | 'Compromised' | 'Shock';
  disability: 'None' | 'Neurological Deficit';
  exposure: string;
  interventions: string[];
}

export interface SecondarySurvey {
  headToToeAssessment: string;
  diagnosticTests: string[];
  additionalHistory: string;
  familyHistory: string;
  medicationHistory: string;
  findings: string[];
}

export interface MentalHealthScreening {
  suicidalIdeation: boolean;
  homicidalIdeation: boolean;
  depressionScreen: number; // PHQ-2 score
  anxietyScreen: number; // GAD-2 score
  substanceUseScreen: boolean;
  agitation: boolean;
  cooperativeness: 'Cooperative' | 'Uncooperative' | 'Combative';
  mentalStatus: string;
  safetyRisk: 'Low' | 'Medium' | 'High';
  safeguardsRequired: string[];
  psychiatricConsultNeeded: boolean;
}

export interface TriageCategory {
  level: 1 | 2 | 3 | 4 | 5;
  description: string;
  maxWaitTime: number; // minutes
  resourceRequirements: string[];
  monitoringFrequency: number; // minutes
  expectedTreatmentArea: 'Resuscitation' | 'Acute' | 'Urgent' | 'Fast Track' | 'Waiting Room';
}

export interface EmergencyProtocol {
  protocolName: string;
  indication: string;
  interventions: ProtocolIntervention[];
  contraindications: string[];
  precautions: string[];
  monitoringRequirements: string[];
  activatedBy: string;
  activationTime: Date;
}

export interface ProtocolIntervention {
  intervention: string;
  timing: 'Immediate' | 'Within 5 min' | 'Within 15 min' | 'Within 30 min' | 'Within 1 hour';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  completed: boolean;
  completedBy?: string;
  completionTime?: Date;
  notes?: string;
}

export interface EmergencyPhysicianAssessment {
  id: string;
  physicianId: string;
  physicianName: string;
  assessmentDate: Date;
  rapidAssessmentCompleted: boolean;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  currentMedications: string;
  allergies: string;
  socialHistory: string;
  physicalExamination: EmergencyPhysicalExam;
  diagnosticImpression: EmergencyDiagnosis[];
  differentialDiagnosis: string[];
  emergencyManagementPlan: EmergencyManagementPlan;
  riskStratification: RiskStratification;
  dispositionPlanning: DispositionPlanning;
  consultationsRequested: EmergencyConsultation[];
  proceduresPerformed: EmergencyProcedure[];
  criticalCare: CriticalCareIndicators;
  reassessmentSchedule: ReassessmentSchedule;
}

export interface EmergencyPhysicalExam {
  generalAppearance: string;
  vitalSigns: VitalSigns;
  heent: string;
  cardiovascular: string;
  respiratory: string;
  abdominal: string;
  neurological: string;
  musculoskeletal: string;
  extremities: string;
  skin: string;
  psychiatric: string;
  focusedExam?: FocusedExamination[];
}

export interface FocusedExamination {
  system: string;
  indication: string;
  findings: string;
  clinicalSignificance: string;
}

export interface EmergencyDiagnosis {
  icd10Code: string;
  description: string;
  type: 'Primary' | 'Secondary' | 'Rule Out';
  certainty: 'Definitive' | 'Probable' | 'Possible' | 'Rule Out';
  acuity: 'Life-threatening' | 'Urgent' | 'Less Urgent' | 'Non-urgent';
  treatmentPriority: number;
}

export interface EmergencyManagementPlan {
  immediateInterventions: string[];
  medicationOrders: ClinicalOrder[];
  diagnosticOrders: ClinicalOrder[];
  proceduralOrders: ClinicalOrder[];
  monitoringPlan: EmergencyMonitoringPlan;
  treatmentGoals: string[];
  responseToTreatment: string;
  contingencyPlans: ContingencyPlan[];
}

export interface EmergencyMonitoringPlan {
  vitalSignsFrequency: number; // minutes
  neurologyChecks: boolean;
  neurologyFrequency?: number;
  cardiacMonitoring: boolean;
  oxygenSaturationMonitoring: boolean;
  fluidBalance: boolean;
  painReassessment: number; // minutes
  otherMonitoring: string[];
}

export interface ContingencyPlan {
  condition: string;
  triggerCriteria: string[];
  interventions: string[];
  escalationProtocol: string;
  timeframe: string;
}

export interface RiskStratification {
  overallRiskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  riskFactors: RiskFactor[];
  protectiveFactors: string[];
  riskScores: RiskScore[];
  riskMitigationStrategies: string[];
}

export interface RiskFactor {
  factor: string;
  impact: 'Low' | 'Moderate' | 'High';
  modifiable: boolean;
  interventions?: string[];
}

export interface RiskScore {
  scoreName: string;
  score: number;
  interpretation: string;
  riskLevel: string;
}

export interface DispositionPlanning {
  plannedDisposition: 'Discharge' | 'Admit' | 'Transfer' | 'Observation' | 'OR' | 'ICU' | 'Morgue';
  dischargeReadiness: DischargeReadiness;
  admissionCriteria?: AdmissionCriteria;
  transferCriteria?: TransferCriteria;
  followUpPlanning: EmergencyFollowUp;
  socialDisposition: SocialDisposition;
}

export interface DischargeReadiness {
  clinicalStability: boolean;
  painControlAdequate: boolean;
  functionalStatus: string;
  homeEnvironmentSafe: boolean;
  followUpArranged: boolean;
  medicationsReconciled: boolean;
  patientEducationCompleted: boolean;
  transportationArranged: boolean;
  dischargeInstructions: string[];
}

export interface AdmissionCriteria {
  medicalCriteria: string[];
  socialCriteria: string[];
  preferredUnit: string;
  levelOfCare: 'Floor' | 'Telemetry' | 'ICU' | 'CCU';
  estimatedLengthOfStay: string;
}

export interface TransferCriteria {
  transferReason: string;
  receivingFacility: string;
  levelOfCare: string;
  mode: 'Ground' | 'Air' | 'Critical Care Transport';
  urgency: 'Emergent' | 'Urgent' | 'Routine';
  acceptingPhysician: string;
}

export interface EmergencyFollowUp {
  primaryCareFollowUp: boolean;
  primaryCareTimeframe: string;
  specialistFollowUp: boolean;
  specialistType?: string;
  specialistTimeframe?: string;
  emergencyRecheck: boolean;
  recheckTimeframe?: string;
  returnPrecautions: string[];
  warningSymptoms: string[];
}

export interface SocialDisposition {
  safeDischarge: boolean;
  socialConcerns: string[];
  socialServicesConsult: boolean;
  homeHealthNeeded: boolean;
  equipmentNeeded: boolean;
  caregiversAvailable: boolean;
  alternativePlacements: string[];
}

export interface EmergencyConsultation {
  id: string;
  consultingService: string;
  consultingPhysician?: string;
  requestDate: Date;
  urgency: 'STAT' | 'Urgent' | 'Routine';
  reason: string;
  clinicalQuestion: string;
  consultationCompleted: boolean;
  consultationDate?: Date;
  recommendations: string[];
  followUp: string;
}

export interface EmergencyProcedure {
  id: string;
  procedureName: string;
  indication: string;
  performedBy: string;
  assistedBy: string[];
  performedDate: Date;
  location: string;
  anesthesiaType?: string;
  complications: boolean;
  complicationDescription?: string;
  outcome: string;
  postProcedureInstructions: string[];
  followUpRequired: boolean;
}

export interface CriticalCareIndicators {
  criticalCareRequired: boolean;
  airwayManagement: boolean;
  mechanicalVentilation: boolean;
  vasopressorSupport: boolean;
  continuousMonitoring: boolean;
  criticalCareProcedures: string[];
  criticalCareTeam: string[];
}

export interface ReassessmentSchedule {
  nextReassessment: Date;
  reassessmentFrequency: number; // minutes
  triggerCriteria: string[];
  parameters: string[];
  responsibleProvider: string;
}

export interface EmergencyTreatment {
  id: string;
  treatmentType: 'Medication' | 'Procedure' | 'Intervention' | 'Monitoring' | 'Supportive Care';
  description: string;
  indication: string;
  performedBy: string;
  performedDate: Date;
  startTime: Date;
  endTime?: Date;
  response: TreatmentResponse;
  complications: boolean;
  complicationDetails?: string;
  effectiveness: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'No Response';
  sideEffects: boolean;
  sideEffectDetails?: string;
  monitoringRequired: boolean;
  monitoringPlan?: string;
  followUpTreatment?: string;
  treatmentNotes: string;
}

export interface TreatmentResponse {
  immediateResponse: string;
  vitalSignsChange: boolean;
  symptomImprovement: boolean;
  functionalImprovement: boolean;
  adverseReaction: boolean;
  timeToResponse: number; // minutes
  durationOfEffect?: number; // minutes
  patientReportedOutcome?: string;
}

export interface EmergencyDisposition {
  finalDisposition: 'Discharged' | 'Admitted' | 'Transferred' | 'Left AMA' | 'Eloped' | 'Deceased';
  dispositionDate: Date;
  dispositionTime: Date;
  dispositionBy: string;
  dischargeLocation?: string;
  admittingService?: string;
  admittingPhysician?: string;
  transferDestination?: string;
  transferMode?: string;
  dischargeInstructions: DischargeInstructions;
  prescriptions: EmergencyPrescription[];
  followUpAppointments: EmergencyFollowUpAppointment[];
  returnPrecautions: string[];
  conditionAtDischarge: 'Improved' | 'Stable' | 'Unchanged' | 'Worsened';
  functionalStatus: string;
  patientSatisfaction?: number;
}

export interface DischargeInstructions {
  activityRestrictions: string[];
  dietInstructions: string[];
  medicationInstructions: string[];
  woundCare?: string[];
  symptomMonitoring: string[];
  emergencyReasonReasons: string[];
  followUpInstructions: string[];
  educationMaterials: string[];
  interpreterUsed: boolean;
  patientUnderstanding: 'Good' | 'Fair' | 'Poor';
}

export interface EmergencyPrescription {
  medication: string;
  dosage: string;
  quantity: number;
  instructions: string;
  indication: string;
  refills: number;
  prescriber: string;
  pharmacyTransmitted: boolean;
}

export interface EmergencyFollowUpAppointment {
  provider: string;
  timeframe: string;
  reason: string;
  urgency: 'Routine' | 'Urgent' | 'ASAP';
  schedulingInstructions: string;
  appointmentScheduled: boolean;
}

export interface IsolationPrecaution {
  type: 'Contact' | 'Droplet' | 'Airborne' | 'Protective';
  indication: string;
  startDate: Date;
  endDate?: Date;
  requirements: string[];
  supplies: string[];
  educationProvided: boolean;
}

export interface EmergencyAlert {
  id: string;
  alertType: 'Critical Value' | 'Deterioration' | 'Allergy' | 'Drug Interaction' | 'Protocol Reminder';
  severity: 'High' | 'Medium' | 'Low';
  message: string;
  patientId: string;
  encounterId: string;
  generatedBy: string;
  generatedDate: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgeDate?: Date;
  actionTaken?: string;
  resolved: boolean;
}

export interface EmergencyQualityMetrics {
  doorToTriageTime: number; // minutes
  doorToPhysicianTime: number; // minutes
  lengthOfStay: number; // minutes
  leftWithoutBeingSeen: boolean;
  leftAgainstMedicalAdvice: boolean;
  patientSatisfactionScore?: number;
  throughputMetrics: ThroughputMetrics;
  qualityIndicators: QualityIndicator[];
}

export interface ThroughputMetrics {
  doorToDisposition: number;
  bedWaitTime: number;
  treatmentTime: number;
  boardingTime?: number;
  totalEncounterTime: number;
}

export interface QualityIndicator {
  indicator: string;
  met: boolean;
  target: string;
  actual: string;
  variance?: number;
}