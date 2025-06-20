/**
 * Hospital Admission and Discharge Types and Interfaces
 * OmniCare EMR - Clinical Workflow System
 */

import { VitalSigns, ClinicalOrder, Patient } from '../assessment/types';
import { MedicationReconciliation } from '../medication/types';

export interface HospitalAdmission {
  id: string;
  patientId: string;
  admissionDate: Date;
  admissionTime: Date;
  admissionSource: 'Emergency Department' | 'Direct Admission' | 'Transfer' | 'Scheduled' | 'Observation';
  admissionType: 'Inpatient' | 'Observation' | 'Day Surgery' | 'Same Day';
  admissionDiagnosis: AdmissionDiagnosis[];
  attendingPhysician: string;
  admittingService: string;
  bedAssignment: BedAssignment;
  nursingAdmissionAssessment?: NursingAdmissionAssessment;
  physicianAdmissionAssessment?: PhysicianAdmissionAssessment;
  inpatientCareRecords: InpatientCareRecord[];
  dischargeProcess?: DischargeProcess;
  status: 'Pending' | 'Active' | 'Discharged' | 'Transferred' | 'Deceased';
  lengthOfStay?: number; // days
  dischargePlanning: DischargePlanning;
  qualityIndicators: QualityIndicator[];
}

export interface AdmissionDiagnosis {
  icd10Code: string;
  description: string;
  type: 'Principal' | 'Secondary' | 'Comorbidity' | 'Complication';
  presentOnAdmission: boolean;
  severity: 'Mild' | 'Moderate' | 'Severe';
  chronicCondition: boolean;
}

export interface BedAssignment {
  unit: string;
  room: string;
  bed: string;
  bedType: 'Medical/Surgical' | 'ICU' | 'Telemetry' | 'Isolation' | 'Private' | 'Semi-Private';
  isolationPrecautions?: IsolationPrecaution[];
  specialEquipment?: string[];
  assignmentDate: Date;
  transferHistory: BedTransfer[];
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

export interface BedTransfer {
  fromUnit: string;
  fromRoom: string;
  fromBed: string;
  toUnit: string;
  toRoom: string;
  toBed: string;
  transferDate: Date;
  transferReason: string;
  transferredBy: string;
  handoffCommunication: string;
  patientCondition: string;
}

export interface NursingAdmissionAssessment {
  id: string;
  admissionId: string;
  nurseId: string;
  nurseName: string;
  assessmentDate: Date;
  baselineVitalSigns: VitalSigns;
  admissionWeight: number;
  admissionHeight: number;
  allergies: AdmissionAllergy[];
  medicationReconciliation: MedicationReconciliation;
  nursingCarePlan: NursingCarePlan;
  riskAssessments: AdmissionRiskAssessment[];
  functionalAssessment: FunctionalAssessment;
  psychosocialAssessment: PsychosocialAssessment;
  spiritualAssessment?: SpiritualAssessment;
  nutritionalScreening: NutritionalScreening;
  skinAssessment: SkinIntegrityAssessment;
  fallPrevention: FallPreventionPlan;
  safetyMeasures: SafetyMeasure[];
  patientEducation: AdmissionEducation;
  familyInvolvement: FamilyInvolvement;
  dischargeNeedsAssessment: DischargeNeedsAssessment;
}

export interface AdmissionAllergy {
  allergen: string;
  reactionType: 'Allergy' | 'Intolerance' | 'Adverse Effect';
  reaction: string;
  severity: 'Mild' | 'Moderate' | 'Severe' | 'Life-threatening';
  verifiedBy: string;
  verificationDate: Date;
  braceletApplied: boolean;
  chartFlagged: boolean;
}

export interface NursingCarePlan {
  id: string;
  nursingDiagnoses: NursingDiagnosis[];
  carePlanGoals: CarePlanGoal[];
  nursingInterventions: NursingIntervention[];
  patientOutcomes: PatientOutcome[];
  evaluationDate: Date;
  planRevisions: PlanRevision[];
}

export interface NursingDiagnosis {
  diagnosis: string;
  relatedTo: string;
  evidencedBy: string[];
  priority: 'High' | 'Medium' | 'Low';
  targetDate: Date;
  resolved: boolean;
  resolutionDate?: Date;
}

export interface CarePlanGoal {
  goal: string;
  measurableOutcome: string;
  timeframe: string;
  patientAgreed: boolean;
  familyInvolved: boolean;
  achieved: boolean;
  achievementDate?: Date;
}

export interface NursingIntervention {
  intervention: string;
  frequency: string;
  rationale: string;
  delegatable: boolean;
  performedBy: string[];
  evaluationCriteria: string;
  effectiveness: 'Effective' | 'Partially Effective' | 'Ineffective';
}

export interface PatientOutcome {
  outcome: string;
  measurement: string;
  target: string;
  actualResult: string;
  achieved: boolean;
  evaluationDate: Date;
}

export interface PlanRevision {
  revisionDate: Date;
  revisedBy: string;
  reason: string;
  changes: string;
  newGoals?: string[];
  discontinuedInterventions?: string[];
}

export interface AdmissionRiskAssessment {
  riskType: 'Fall' | 'Pressure Ulcer' | 'DVT' | 'Infection' | 'Medication Error' | 'Suicide';
  assessmentTool: string;
  score: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  riskFactors: string[];
  preventiveInterventions: string[];
  reassessmentInterval: number; // hours
  lastAssessment: Date;
  nextAssessment: Date;
}

export interface FunctionalAssessment {
  adlScore: number; // Activities of Daily Living
  mobilityLevel: 'Independent' | 'Assistance Required' | 'Dependent';
  mobilityAids: string[];
  cognitiveStatus: 'Alert' | 'Confused' | 'Disoriented' | 'Impaired';
  communicationAbility: 'Normal' | 'Impaired' | 'Non-verbal';
  hearingStatus: 'Normal' | 'Impaired' | 'Deaf';
  visionStatus: 'Normal' | 'Impaired' | 'Blind';
  assistiveDevices: string[];
  homeEnvironment: string;
  caregiverSupport: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'None';
}

export interface PsychosocialAssessment {
  mentalStatus: 'Stable' | 'Anxious' | 'Depressed' | 'Agitated' | 'Confused';
  copingMechanisms: string[];
  supportSystems: string[];
  stressors: string[];
  substanceUse: SubstanceUseAssessment;
  domesticViolenceScreening: DomesticViolenceScreening;
  financialConcerns: boolean;
  culturalConsiderations: string[];
  languageBarriers: boolean;
  interpreterNeeded: boolean;
}

export interface SubstanceUseAssessment {
  alcohol: 'Never' | 'Occasional' | 'Regular' | 'Heavy' | 'History of Abuse';
  tobacco: 'Never' | 'Former' | 'Current';
  illicitDrugs: 'Never' | 'Former' | 'Current';
  prescriptionAbuse: boolean;
  detoxificationNeeded: boolean;
  treatmentRecommended: boolean;
}

export interface DomesticViolenceScreening {
  screeningPerformed: boolean;
  positiveScreen: boolean;
  safetyPlanNeeded: boolean;
  resourcesProvided: boolean;
  socialServicesConsult: boolean;
}

export interface SpiritualAssessment {
  spiritualNeeds: string[];
  religiousAffiliation?: string;
  spiritualSupport: boolean;
  chaplainConsult: boolean;
  ritualRequirements?: string[];
  endOfLifeConcerns: boolean;
}

export interface NutritionalScreening {
  nutritionalRisk: 'Low' | 'Medium' | 'High';
  weightStatus: 'Underweight' | 'Normal' | 'Overweight' | 'Obese';
  dietaryRestrictions: string[];
  swallowingDifficulties: boolean;
  appetite: 'Good' | 'Fair' | 'Poor';
  recentWeightLoss: boolean;
  supplementsNeeded: boolean;
  dietitianConsult: boolean;
}

export interface SkinIntegrityAssessment {
  skinCondition: 'Intact' | 'Impaired';
  pressureUlcers: PressureUlcer[];
  wounds: Wound[];
  bradenScore: number;
  preventiveMeasures: string[];
  woundCareNeeds: boolean;
  specialMattress: boolean;
  repositioningSchedule: string;
}

export interface PressureUlcer {
  location: string;
  stage: 'Stage 1' | 'Stage 2' | 'Stage 3' | 'Stage 4' | 'Unstageable' | 'Deep Tissue Injury';
  size: string;
  drainage: string;
  appearance: string;
  treatmentPlan: string;
  healingProgress: 'Improving' | 'Stable' | 'Worsening';
}

export interface Wound {
  location: string;
  type: 'Surgical' | 'Traumatic' | 'Pressure' | 'Diabetic' | 'Vascular';
  size: string;
  appearance: string;
  drainage: string;
  infection: boolean;
  treatmentPlan: string;
  dressingType: string;
  changeFrequency: string;
}

export interface FallPreventionPlan {
  fallRiskScore: number;
  riskFactors: string[];
  preventionInterventions: string[];
  bedAlarmStatus: boolean;
  ambulation: 'Independent' | 'Supervised' | 'Assisted' | 'Bed Rest';
  equipmentNeeds: string[];
  familyEducation: boolean;
}

export interface SafetyMeasure {
  measure: string;
  indication: string;
  implemented: boolean;
  implementationDate?: Date;
  effectiveness: 'Effective' | 'Partially Effective' | 'Ineffective';
  reviewDate: Date;
}

export interface AdmissionEducation {
  educationNeeds: string[];
  learningBarriers: string[];
  preferredLearningMethod: 'Verbal' | 'Written' | 'Demonstration' | 'Video';
  educationProvided: EducationProvided[];
  comprehensionLevel: 'Good' | 'Fair' | 'Poor';
  followUpEducationNeeded: boolean;
}

export interface EducationProvided {
  topic: string;
  method: string;
  providedBy: string;
  providedDate: Date;
  patientUnderstanding: 'Good' | 'Fair' | 'Poor';
  returnDemonstration: boolean;
  materialsGiven: string[];
}

export interface FamilyInvolvement {
  primaryCaregiver?: string;
  familyMembers: FamilyMember[];
  involvementLevel: 'Highly Involved' | 'Moderately Involved' | 'Minimally Involved' | 'Not Involved';
  educationNeeds: string[];
  supportRole: string;
  contactPermissions: boolean;
}

export interface FamilyMember {
  name: string;
  relationship: string;
  contactInfo: string;
  primaryContact: boolean;
  emergencyContact: boolean;
  involvementInCare: boolean;
}

export interface DischargeNeedsAssessment {
  dischargeDestination: 'Home' | 'Skilled Nursing' | 'Rehab' | 'Long-term Care' | 'Hospice' | 'Other Hospital';
  homeEnvironment: 'Safe' | 'Unsafe' | 'Needs Modification';
  caregiverAvailability: 'Available' | 'Limited' | 'None';
  equipmentNeeds: string[];
  serviceNeeds: string[];
  transportationArranged: boolean;
  followUpAppointments: boolean;
  anticipatedDischargeDate?: Date;
}

export interface PhysicianAdmissionAssessment {
  id: string;
  admissionId: string;
  physicianId: string;
  physicianName: string;
  assessmentDate: Date;
  admissionHistoryPhysical: AdmissionHistoryPhysical;
  admissionOrders: ClinicalOrder[];
  admissionDiagnosis: AdmissionDiagnosis[];
  treatmentPlan: InpatientTreatmentPlan;
  levelOfCare: 'Floor' | 'Telemetry' | 'ICU' | 'CCU' | 'Step-down';
  admissionGoals: TreatmentGoal[];
  expectedLengthOfStay: number;
  consultationsRequired: ConsultationRequest[];
  prophylaxisMeasures: ProphylaxisMeasure[];
  codeStatus: CodeStatus;
  advancedDirectives: AdvancedDirectives;
  communicationPlan: CommunicationPlan;
}

export interface AdmissionHistoryPhysical {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  pastSurgicalHistory: string;
  familyHistory: string;
  socialHistory: string;
  allergies: string;
  currentMedications: string;
  reviewOfSystems: string;
  physicalExamination: string;
  diagnosticImpression: string;
  medicalDecisionMaking: string;
}

export interface InpatientTreatmentPlan {
  primaryDiagnosis: string;
  treatmentGoals: string[];
  medicationPlan: MedicationPlan[];
  diagnosticPlan: string[];
  therapeuticInterventions: string[];
  consultationPlan: string[];
  mobilityPlan: string;
  nutritionPlan: string;
  dischargePlanning: string;
  monitoring: MonitoringPlan[];
}

export interface MedicationPlan {
  medication: string;
  indication: string;
  dosing: string;
  duration: string;
  monitoring: string;
  adjustmentCriteria: string;
}

export interface MonitoringPlan {
  parameter: string;
  frequency: string;
  target: string;
  action: string;
  responsibleParty: string;
}

export interface TreatmentGoal {
  goal: string;
  timeframe: string;
  measurableOutcome: string;
  interventions: string[];
  achieved: boolean;
  achievementDate?: Date;
}

export interface ConsultationRequest {
  consultingService: string;
  reason: string;
  urgency: 'Routine' | 'Urgent' | 'STAT';
  clinicalQuestion: string;
  requestDate: Date;
  status: 'Requested' | 'Scheduled' | 'Completed';
}

export interface ProphylaxisMeasure {
  type: 'DVT' | 'GI Bleeding' | 'Infection' | 'Fall';
  indication: string;
  intervention: string;
  startDate: Date;
  duration: string;
  monitoring: string;
}

export interface CodeStatus {
  status: 'Full Code' | 'DNR' | 'DNI' | 'Comfort Care' | 'DNAR';
  discussionDate: Date;
  discussedWith: string[];
  documentedBy: string;
  reviewDate?: Date;
}

export interface AdvancedDirectives {
  hasAdvancedDirectives: boolean;
  livingWill: boolean;
  powerOfAttorney: boolean;
  healthcareProxy: boolean;
  dnarForm: boolean;
  documentLocation: string;
  proxyName?: string;
  proxyContact?: string;
}

export interface CommunicationPlan {
  primaryContact: string;
  updateFrequency: 'Daily' | 'As Needed' | 'Weekly';
  updateMethod: 'Phone' | 'In Person' | 'Portal';
  familyMeetingScheduled: boolean;
  interpreterNeeded: boolean;
  languagePreference: string;
}

export interface InpatientCareRecord {
  id: string;
  admissionId: string;
  careDate: Date;
  shift: 'Day' | 'Evening' | 'Night';
  nurseId: string;
  nurseName: string;
  nursingInterventions: NursingInpatientIntervention[];
  vitalSigns: VitalSigns[];
  intakeOutput: IntakeOutputRecord;
  medicationAdministration: string[];
  patientResponse: PatientResponse;
  safetyChecks: SafetyCheck[];
  patientEducation: PatientEducationRecord[];
  multidisciplinaryCare: MultidisciplinaryActivity[];
  progressNotes: ProgressNote[];
  familyCommunication: FamilyCommunicationRecord[];
}

export interface NursingInpatientIntervention {
  intervention: string;
  time: Date;
  performedBy: string;
  patientResponse: string;
  complications: boolean;
  complicationDetails?: string;
  followUpRequired: boolean;
  effectiveness: 'Effective' | 'Partially Effective' | 'Ineffective';
}

export interface IntakeOutputRecord {
  date: Date;
  shift: 'Day' | 'Evening' | 'Night';
  oralIntake: number;
  ivIntake: number;
  otherIntake: number;
  totalIntake: number;
  urineOutput: number;
  drainageOutput: number;
  otherOutput: number;
  totalOutput: number;
  netBalance: number;
  fluidRestriction?: number;
  fluidGoal?: number;
  recordedBy: string;
}

export interface PatientResponse {
  painLevel: number;
  mentalStatus: string;
  activityTolerance: string;
  appetiteLevel: 'Good' | 'Fair' | 'Poor';
  sleepQuality: 'Good' | 'Fair' | 'Poor';
  moodAssessment: string;
  cooperationLevel: 'Cooperative' | 'Uncooperative' | 'Combative';
}

export interface SafetyCheck {
  checkType: 'Fall Risk' | 'Suicide Risk' | 'Skin Integrity' | 'IV Site' | 'Equipment';
  time: Date;
  findings: string;
  actionTaken?: string;
  checkedBy: string;
  followUpRequired: boolean;
}

export interface PatientEducationRecord {
  topic: string;
  educationProvided: string;
  method: 'Verbal' | 'Written' | 'Demonstration' | 'Video';
  providedBy: string;
  time: Date;
  patientUnderstanding: 'Good' | 'Fair' | 'Poor';
  followUpNeeded: boolean;
}

export interface MultidisciplinaryActivity {
  discipline: 'Physical Therapy' | 'Occupational Therapy' | 'Speech Therapy' | 'Social Work' | 'Nutrition' | 'Pharmacy' | 'Chaplain';
  activity: string;
  time: Date;
  provider: string;
  patientResponse: string;
  recommendationsFollowUp: string[];
}

export interface ProgressNote {
  noteType: 'Nursing' | 'Physician' | 'Progress' | 'Assessment';
  time: Date;
  author: string;
  note: string;
  plan: string;
  followUp: string;
}

export interface FamilyCommunicationRecord {
  time: Date;
  communicatedBy: string;
  familyMember: string;
  method: 'Phone' | 'In Person' | 'Portal';
  content: string;
  questions: string[];
  concerns: string[];
  followUpNeeded: boolean;
}

export interface DischargeProcess {
  id: string;
  admissionId: string;
  dischargeDate: Date;
  dischargeTime: Date;
  dischargedBy: string;
  dischargeDestination: 'Home' | 'Skilled Nursing' | 'Rehab' | 'Long-term Care' | 'Hospice' | 'AMA' | 'Transfer' | 'Deceased';
  dischargeCondition: 'Improved' | 'Stable' | 'Unchanged' | 'Worsened';
  dischargeDiagnoses: DischargeDiagnosis[];
  physicianDischargeProcess: PhysicianDischargeProcess;
  nursingDischargeProcess: NursingDischargeProcess;
  dischargeInstructions: DischargeInstructions;
  dischargeEducation: DischargeEducation;
  followUpPlan: DischargeFollowUpPlan;
  homeCarePlanning: HomeCarePlanning;
  equipmentArrangements: EquipmentArrangement[];
  transportationArrangements: TransportationArrangement;
  qualityMetrics: DischargeQualityMetrics;
}

export interface DischargeDiagnosis {
  icd10Code: string;
  description: string;
  type: 'Principal' | 'Secondary';
  presentOnAdmission: boolean;
  resolved: boolean;
  chronicCondition: boolean;
}

export interface PhysicianDischargeProcess {
  readinessForDischarge: boolean;
  dischargeCriteriaMet: boolean;
  medicationReconciliation: boolean;
  followUpArranged: boolean;
  dischargeSummary: DischargeSummary;
  dischargeOrders: ClinicalOrder[];
  dischargePrescriptions: DischargePrescription[];
  followUpAppointments: DischargeFollowUpAppointment[];
  clearanceRequired: boolean;
  clearanceObtained?: boolean;
}

export interface DischargeSummary {
  admissionDate: Date;
  dischargeDate: Date;
  lengthOfStay: number;
  admissionDiagnosis: string;
  dischargeDiagnoses: string[];
  hospitalCourse: string;
  proceduresPerformed: string[];
  complications: string[];
  dischargeMedications: string[];
  followUpInstructions: string[];
  activityRestrictions: string[];
  dietInstructions: string[];
  warningSymptoms: string[];
  emergencyInstructions: string;
  providerInformation: string;
}

export interface DischargePrescription {
  medication: string;
  strength: string;
  dosage: string;
  quantity: number;
  refills: number;
  instructions: string;
  indication: string;
  newMedication: boolean;
  changeFromAdmission: boolean;
}

export interface DischargeFollowUpAppointment {
  provider: string;
  specialty: string;
  timeframe: string;
  reason: string;
  urgency: 'Routine' | 'Urgent' | 'ASAP';
  scheduled: boolean;
  appointmentDate?: Date;
}

export interface NursingDischargeProcess {
  dischargeEducationCompleted: boolean;
  patientUnderstanding: 'Good' | 'Fair' | 'Poor';
  equipmentEducation: boolean;
  medicationEducation: boolean;
  activityEducation: boolean;
  followUpEducation: boolean;
  homeEnvironmentAssessed: boolean;
  caregiverEducation: boolean;
  finalVitalSigns: VitalSigns;
  finalAssessment: string;
  dischargeSafety: 'Safe' | 'Concerns' | 'Unsafe';
  transportationVerified: boolean;
}

export interface DischargeInstructions {
  activityLevel: string;
  activityRestrictions: string[];
  dietInstructions: string[];
  medicationInstructions: string[];
  woundCareInstructions?: string[];
  equipmentInstructions?: string[];
  followUpInstructions: string[];
  warningSymptoms: string[];
  emergencyContacts: string[];
  whenToSeekCare: string[];
  resourceContacts: string[];
}

export interface DischargeEducation {
  educationTopics: string[];
  educationMethod: 'Verbal' | 'Written' | 'Demonstration' | 'Video' | 'Combined';
  materialsProvided: string[];
  interpreterUsed: boolean;
  familyEducated: boolean;
  caregiverEducated: boolean;
  returnDemonstration: boolean;
  competencyValidated: boolean;
  educationBarriers: string[];
  followUpEducationNeeded: boolean;
}

export interface DischargeFollowUpPlan {
  primaryCareProvider: string;
  primaryCareTimeframe: string;
  specialistFollowUp: SpecialistFollowUp[];
  homeHealthServices: HomeHealthService[];
  communityResources: CommunityResource[];
  emergencyPlan: EmergencyPlan;
  coordinationOfCare: CoordinationOfCare;
}

export interface SpecialistFollowUp {
  specialty: string;
  provider: string;
  reason: string;
  timeframe: string;
  urgency: 'Routine' | 'Urgent' | 'ASAP';
  scheduled: boolean;
}

export interface HomeHealthService {
  serviceType: 'Nursing' | 'Physical Therapy' | 'Occupational Therapy' | 'Speech Therapy' | 'Home Health Aide';
  frequency: string;
  duration: string;
  goals: string[];
  provider: string;
  authorized: boolean;
}

export interface CommunityResource {
  resourceType: string;
  organization: string;
  contact: string;
  services: string[];
  eligibilityRequirements: string[];
}

export interface EmergencyPlan {
  emergencyContacts: string[];
  warningSymptoms: string[];
  immediateActions: string[];
  whenToCallEMS: string[];
  hospitalToReturn: string;
  emergencyMedications?: string[];
}

export interface CoordinationOfCare {
  primaryCoordinator: string;
  communicationPlan: string;
  informationSharing: boolean;
  careTeamMembers: string[];
  transitionSupport: string;
}

export interface HomeCarePlanning {
  homeEnvironmentSafe: boolean;
  homeModifications: HomeModification[];
  caregiverCapacity: 'Adequate' | 'Needs Support' | 'Inadequate';
  caregiverTraining: CaregiverTraining[];
  safetyPlan: HomeSafetyPlan;
  emergencyPreparedness: EmergencyPreparedness;
}

export interface HomeModification {
  modification: string;
  reason: string;
  priority: 'High' | 'Medium' | 'Low';
  cost?: number;
  timeframe: string;
  responsible: string;
}

export interface CaregiverTraining {
  topic: string;
  competencyRequired: boolean;
  trainingMethod: string;
  trainedBy: string;
  trainingDate: Date;
  competencyValidated: boolean;
  followUpTraining: boolean;
}

export interface HomeSafetyPlan {
  safetyIssues: string[];
  interventions: string[];
  emergencyContacts: string[];
  accessibilityNeeds: string[];
  securityMeasures: string[];
}

export interface EmergencyPreparedness {
  emergencySupplies: string[];
  emergencyPlan: string;
  evacuationPlan?: string;
  communicationPlan: string;
  medicationBackup: boolean;
  equipmentBackup: boolean;
}

export interface EquipmentArrangement {
  equipment: string;
  supplier: string;
  deliveryDate: Date;
  setup: boolean;
  training: boolean;
  maintenance: string;
  insurance: 'Covered' | 'Partial' | 'Self-pay';
  cost?: number;
}

export interface TransportationArrangement {
  method: 'Private Vehicle' | 'Ambulance' | 'Medical Transport' | 'Wheelchair Van' | 'Public Transport';
  scheduled: boolean;
  scheduledTime?: Date;
  specialRequirements: string[];
  cost?: number;
  insurance: 'Covered' | 'Self-pay';
}

export interface DischargePlanning {
  planningStartDate: Date;
  dischargeCoordinator: string;
  estimatedDischargeDate: Date;
  actualDischargeDate?: Date;
  planningBarriers: DischargeBarrier[];
  planningMilestones: PlanningMilestone[];
  planningMeetings: PlanningMeeting[];
  dischargeReadiness: DischargeReadiness;
  dischargeRisk: 'Low' | 'Medium' | 'High';
  interventions: DischargeIntervention[];
}

export interface DischargeBarrier {
  barrier: string;
  type: 'Medical' | 'Social' | 'Financial' | 'Environmental' | 'Educational';
  impact: 'High' | 'Medium' | 'Low';
  intervention: string;
  responsible: string;
  targetResolution: Date;
  resolved: boolean;
  resolutionDate?: Date;
}

export interface PlanningMilestone {
  milestone: string;
  targetDate: Date;
  achieved: boolean;
  achievementDate?: Date;
  responsible: string;
  barriers?: string[];
}

export interface PlanningMeeting {
  meetingDate: Date;
  attendees: string[];
  decisions: string[];
  actionItems: ActionItem[];
  nextMeetingDate?: Date;
}

export interface ActionItem {
  action: string;
  responsible: string;
  dueDate: Date;
  completed: boolean;
  completionDate?: Date;
}

export interface DischargeReadiness {
  medicalStability: boolean;
  painManagement: boolean;
  functionalCapacity: boolean;
  safeDischarge: boolean;
  caregiverReadiness: boolean;
  homeEnvironmentReady: boolean;
  followUpArranged: boolean;
  equipmentArranged: boolean;
  transportationArranged: boolean;
  overallReadiness: boolean;
}

export interface DischargeIntervention {
  intervention: string;
  type: 'Medical' | 'Social' | 'Educational' | 'Coordination';
  responsible: string;
  startDate: Date;
  completionDate?: Date;
  effectiveness: 'Effective' | 'Partially Effective' | 'Ineffective';
  outcome: string;
}

export interface QualityIndicator {
  indicator: string;
  target: string;
  actual: string;
  met: boolean;
  variance?: number;
  improvementOpportunity?: string;
}

export interface DischargeQualityMetrics {
  lengthOfStay: number;
  readmissionRisk: 'Low' | 'Medium' | 'High';
  dischargeTimeliness: boolean;
  patientSatisfaction?: number;
  familySatisfaction?: number;
  qualityIndicators: QualityIndicator[];
  complications: string[];
  preventableReadmission: boolean;
}