/**
 * Outpatient Encounter Types and Interfaces
 * OmniCare EMR - Clinical Workflow System
 */

import { Patient, VitalSigns, ClinicalOrder, ClinicalAlert } from '../assessment/types';

export interface OutpatientEncounter {
  id: string;
  patientId: string;
  scheduledDate: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  encounterType: 'Routine' | 'Follow-up' | 'Annual' | 'Urgent' | 'Procedure' | 'Consultation';
  status: 'Scheduled' | 'Checked In' | 'Roomed' | 'In Progress' | 'Completed' | 'Cancelled' | 'No Show';
  provider: Provider;
  location: string;
  roomNumber?: string;
  chiefComplaint?: string;
  reasonForVisit: string;
  preVisitPreparation?: PreVisitPreparation;
  nursingDocumentation?: NursingEncounterDocumentation;
  physicianDocumentation?: PhysicianEncounterDocumentation;
  postVisitActivities?: PostVisitActivities;
  visitSummary?: VisitSummary;
  followUpPlan?: FollowUpPlan;
}

export interface Provider {
  id: string;
  name: string;
  type: 'Physician' | 'Nurse Practitioner' | 'Physician Assistant';
  specialty?: string;
  credentials: string;
}

export interface PreVisitPreparation {
  id: string;
  encounterId: string;
  preparedBy: string;
  preparationDate: Date;
  roomPrepared: boolean;
  equipmentChecked: boolean;
  outstandingOrders: ClinicalOrder[];
  outstandingResults: LabResult[];
  previousVisitReviewed: boolean;
  preventiveCareNeeds: PreventiveCareItem[];
  medicationReviewCompleted: boolean;
  allergyReviewCompleted: boolean;
  insuranceVerified: boolean;
  notes: string;
}

export interface PreventiveCareItem {
  type: 'Screening' | 'Immunization' | 'Counseling' | 'Examination';
  description: string;
  dueDate: Date;
  priority: 'High' | 'Medium' | 'Low';
  ageRecommended: string;
  lastCompleted?: Date;
}

export interface NursingEncounterDocumentation {
  id: string;
  encounterId: string;
  nurseName: string;
  nurseId: string;
  roomingTime: Date;
  vitalSigns: VitalSigns;
  medicationReconciliation: MedicationReconciliation;
  chiefComplaint: string;
  reasonForVisit: string;
  preliminaryAssessments: PreliminaryAssessment[];
  immunizationHistory: ImmunizationRecord[];
  immunizationsAdministered: ImmunizationRecord[];
  patientEducationProvided: PatientEducation[];
  inOfficetreatments: Treatment[];
  patientConcems: string[];
  nursingNotes: string;
  followUpCoordination: string;
}

export interface MedicationReconciliation {
  id: string;
  performedBy: string;
  performedDate: Date;
  currentMedications: ReconciliationMedication[];
  discrepancies: MedicationDiscrepancy[];
  reconciliationComplete: boolean;
  notes: string;
}

export interface ReconciliationMedication {
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  prescriber: string;
  status: 'Continue' | 'Discontinue' | 'Modify' | 'New';
  adherence: 'Good' | 'Fair' | 'Poor' | 'Unknown';
  lastTaken?: Date;
  sideEffects?: string;
}

export interface MedicationDiscrepancy {
  medication: string;
  discrepancyType: 'Dosage' | 'Frequency' | 'Not Taking' | 'Not Prescribed' | 'Different Medication';
  description: string;
  resolution: string;
  resolvedBy: string;
}

export interface PreliminaryAssessment {
  type: string;
  findings: string;
  assessedBy: string;
  assessmentTime: Date;
}

export interface ImmunizationRecord {
  id: string;
  vaccineType: string;
  manufacturer: string;
  lotNumber: string;
  expirationDate: Date;
  administeredDate: Date;
  administeredBy: string;
  site: string;
  route: 'IM' | 'SubQ' | 'Oral' | 'Nasal';
  dose: string;
  reactions?: string;
  patientEducationProvided: boolean;
}

export interface PatientEducation {
  topic: string;
  method: 'Verbal' | 'Written' | 'Demonstration' | 'Video';
  providedBy: string;
  providedDate: Date;
  patientUnderstanding: 'Good' | 'Fair' | 'Poor';
  notes?: string;
  followUpNeeded: boolean;
}

export interface Treatment {
  id: string;
  type: string;
  description: string;
  performedBy: string;
  performedDate: Date;
  patientResponse: string;
  complications?: string;
  followUpRequired: boolean;
}

export interface PhysicianEncounterDocumentation {
  id: string;
  encounterId: string;
  physicianName: string;
  physicianId: string;
  encounterStartTime: Date;
  encounterEndTime: Date;
  historyOfPresentIllness: string;
  reviewOfSystems: string;
  physicalExamination: string;
  clinicalFindings: ClinicalFinding[];
  diagnosticImpression: DiagnosticImpression[];
  differentialDiagnosis: string[];
  treatmentPlan: TreatmentPlan;
  ordersPlaced: ClinicalOrder[];
  prescriptions: Prescription[];
  referrals: Referral[];
  followUpAppointments: FollowUpAppointment[];
  medicalDecisionMaking: string;
  patientEducationDiscussed: string[];
  patientQuestions: string[];
  aiAssistantSummary?: string;
  visitComplexity: 'Low' | 'Moderate' | 'High';
  timeSpent: number; // minutes
}

export interface ClinicalFinding {
  system: string;
  finding: string;
  significance: 'Normal' | 'Abnormal' | 'Critical';
  notes?: string;
}

export interface DiagnosticImpression {
  icd10Code: string;
  description: string;
  type: 'Primary' | 'Secondary';
  status: 'New' | 'Existing' | 'Resolved';
  confidence: 'High' | 'Medium' | 'Low';
}

export interface TreatmentPlan {
  goals: string[];
  interventions: Intervention[];
  medications: PrescriptionPlan[];
  lifestyle: LifestyleRecommendation[];
  monitoring: MonitoringPlan[];
  followUp: string;
}

export interface Intervention {
  type: 'Medication' | 'Procedure' | 'Therapy' | 'Surgery' | 'Lifestyle';
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  timeframe: string;
  expectedOutcome: string;
}

export interface PrescriptionPlan {
  medication: string;
  indication: string;
  dosage: string;
  frequency: string;
  duration: string;
  refills: number;
  counselingPoints: string[];
}

export interface LifestyleRecommendation {
  category: 'Diet' | 'Exercise' | 'Sleep' | 'Stress' | 'Smoking' | 'Alcohol';
  recommendation: string;
  rationale: string;
  resources?: string[];
}

export interface MonitoringPlan {
  parameter: string;
  frequency: string;
  target: string;
  method: string;
  alerts: string[];
}

export interface Prescription {
  id: string;
  patientId: string;
  medication: string;
  strength: string;
  dosageForm: string;
  quantity: number;
  daysSupply: number;
  refills: number;
  directions: string;
  indication: string;
  prescribedBy: string;
  prescribedDate: Date;
  pharmacyId?: string;
  status: 'Pending' | 'Transmitted' | 'Filled' | 'Cancelled';
  electronicallyPrescribed: boolean;
  daw: boolean; // Dispense as Written
  generic: boolean;
  priorAuthRequired: boolean;
}

export interface Referral {
  id: string;
  patientId: string;
  referringProvider: string;
  referredToProvider: string;
  specialty: string;
  reason: string;
  urgency: 'Routine' | 'Urgent' | 'STAT';
  authorizationRequired: boolean;
  authorizationStatus?: 'Pending' | 'Approved' | 'Denied';
  preferredAppointmentDate?: Date;
  clinicalNotes: string;
  status: 'Pending' | 'Scheduled' | 'Completed' | 'Cancelled';
}

export interface FollowUpAppointment {
  id: string;
  patientId: string;
  providerId: string;
  appointmentType: string;
  timeframe: string;
  reason: string;
  priority: 'High' | 'Medium' | 'Low';
  scheduledDate?: Date;
  status: 'Recommended' | 'Scheduled' | 'Completed' | 'Overdue';
}

export interface PostVisitActivities {
  id: string;
  encounterId: string;
  performedBy: string;
  completionDate: Date;
  documentationSigned: boolean;
  outstandingResultsReviewed: boolean;
  patientMessagesResponded: boolean;
  careTeamCommunication: CareTeamCommunication[];
  careplanUpdated: boolean;
  orderedTestsFollowUp: TestFollowUp[];
  complexPatientFollowUp: FollowUpCall[];
  postVisitInstructions: PostVisitInstructions;
}

export interface CareTeamCommunication {
  recipient: string;
  message: string;
  priority: 'High' | 'Medium' | 'Low';
  communicationMethod: 'EMR Message' | 'Phone' | 'Email' | 'Fax';
  sentDate: Date;
  acknowledged: boolean;
}

export interface TestFollowUp {
  orderId: string;
  testType: string;
  orderDate: Date;
  expectedResultDate: Date;
  resultReceived: boolean;
  resultDate?: Date;
  criticalValue: boolean;
  patientNotified: boolean;
  followUpRequired: boolean;
}

export interface FollowUpCall {
  patientId: string;
  scheduledDate: Date;
  reason: string;
  performedBy?: string;
  performedDate?: Date;
  outcome?: string;
  notes?: string;
  additionalFollowUpNeeded: boolean;
}

export interface PostVisitInstructions {
  id: string;
  patientId: string;
  instructions: string[];
  medications: MedicationInstruction[];
  activities: ActivityInstruction[];
  diet: DietInstruction[];
  followUp: string[];
  warningSymptoms: string[];
  emergencyInstructions: string;
  providedBy: string;
  providedDate: Date;
  patientAcknowledged: boolean;
}

export interface MedicationInstruction {
  medication: string;
  instructions: string;
  importantNotes: string[];
  sideEffectsToWatch: string[];
}

export interface ActivityInstruction {
  type: 'Restriction' | 'Recommendation';
  activity: string;
  duration: string;
  rationale: string;
}

export interface DietInstruction {
  type: 'Restriction' | 'Recommendation';
  instruction: string;
  rationale: string;
  duration?: string;
}

export interface VisitSummary {
  id: string;
  encounterId: string;
  patientId: string;
  visitDate: Date;
  provider: string;
  chiefComplaint: string;
  diagnoses: string[];
  treatmentProvided: string[];
  medicationsChanged: boolean;
  newPrescriptions: string[];
  ordersPlaced: string[];
  followUpRequired: boolean;
  nextAppointment?: Date;
  patientSatisfaction?: number; // 1-10 scale
  visitDuration: number; // minutes
  generatedBy: string;
  generatedDate: Date;
}

export interface FollowUpPlan {
  id: string;
  encounterId: string;
  appointments: FollowUpAppointment[];
  monitoring: MonitoringRequirement[];
  patientActions: PatientAction[];
  providerActions: ProviderAction[];
  timeline: PlanTimeline[];
  goals: CareGoal[];
}

export interface MonitoringRequirement {
  parameter: string;
  method: 'Self-monitoring' | 'Lab' | 'Office Visit' | 'Home Health';
  frequency: string;
  target: string;
  alertCriteria: string;
}

export interface PatientAction {
  action: string;
  timeframe: string;
  priority: 'High' | 'Medium' | 'Low';
  instructions: string;
  resources?: string[];
}

export interface ProviderAction {
  action: string;
  timeframe: string;
  assignedTo: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed';
}

export interface PlanTimeline {
  timepoint: string;
  activities: string[];
  milestones: string[];
  assessments: string[];
}

export interface CareGoal {
  id: string;
  description: string;
  target: string;
  timeframe: string;
  measurable: boolean;
  patientAgreed: boolean;
  barriers?: string[];
  interventions: string[];
}

export interface LabResult {
  id: string;
  patientId: string;
  testName: string;
  result: string;
  referenceRange: string;
  abnormal: boolean;
  critical: boolean;
  resultDate: Date;
  orderedBy: string;
  reviewedBy?: string;
  reviewDate?: Date;
  patientNotified: boolean;
}