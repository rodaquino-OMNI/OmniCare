/**
 * Clinical Assessment Types and Interfaces
 * OmniCare EMR - Clinical Workflow System
 */

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'M' | 'F' | 'O';
  allergies: Allergy[];
  medications: Medication[];
}

export interface Allergy {
  id: string;
  allergen: string;
  reaction: string;
  severity: 'Mild' | 'Moderate' | 'Severe' | 'Life-threatening';
  verifiedBy: string;
  dateVerified: Date;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate: Date;
  endDate?: Date;
  prescribedBy: string;
  active: boolean;
}

export interface VitalSigns {
  id: string;
  patientId: string;
  recordedBy: string;
  recordedAt: Date;
  temperature: number;
  temperatureUnit: 'F' | 'C';
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  heartRate: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  weight?: number;
  height?: number;
  bmi?: number;
  painLevel?: number; // 0-10 scale
}

export interface NursingAssessment {
  id: string;
  patientId: string;
  nurseName: string;
  nurseId: string;
  assessmentDate: Date;
  chiefComplaint: string;
  vitalSigns: VitalSigns;
  allergies: Allergy[];
  currentMedications: Medication[];
  acuityLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  painAssessment: PainAssessment;
  nursingNotes: string;
  skinAssessment?: SkinAssessment;
  neurologicalAssessment?: NeuroAssessment;
  intakeOutput?: IntakeOutput;
  riskAssessments: RiskAssessment[];
}

export interface PainAssessment {
  painLevel: number; // 0-10 scale
  location: string;
  character: string;
  frequency: string;
  duration: string;
  alleviatingFactors?: string;
  aggravatingFactors?: string;
  lastPainMedication?: string;
  lastMedicationTime?: Date;
}

export interface SkinAssessment {
  integrityStatus: 'Intact' | 'Impaired';
  color: string;
  temperature: string;
  turgor: string;
  lesions?: string;
  wounds?: Wound[];
  pressureUlcerRisk: number; // Braden scale
}

export interface Wound {
  location: string;
  size: string;
  appearance: string;
  drainage: string;
  stagingType: string;
}

export interface NeuroAssessment {
  levelOfConsciousness: 'Alert' | 'Lethargic' | 'Obtunded' | 'Stuporous' | 'Comatose';
  orientation: {
    person: boolean;
    place: boolean;
    time: boolean;
  };
  pupilResponse: string;
  motorResponse: string;
  sensoryResponse: string;
  glasgowComaScale?: number;
}

export interface IntakeOutput {
  date: Date;
  intakeOral: number;
  intakeIV: number;
  outputUrine: number;
  outputDrainage: number;
  outputEmesis: number;
  netBalance: number;
}

export interface RiskAssessment {
  type: 'Fall' | 'Pressure Ulcer' | 'DVT' | 'Infection';
  score: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  interventions: string[];
  assessedBy: string;
  assessmentDate: Date;
}

export interface PhysicianAssessment {
  id: string;
  patientId: string;
  physicianName: string;
  physicianId: string;
  assessmentDate: Date;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  familyHistory: string;
  socialHistory: string;
  reviewOfSystems: ReviewOfSystems;
  physicalExamination: PhysicalExam;
  diagnosticImpressions: DiagnosticImpression[];
  differentialDiagnosis: string[];
  assessmentAndPlan: AssessmentPlan[];
  clinicalDecisionMaking: string;
}

export interface ReviewOfSystems {
  constitutional: string;
  cardiovascular: string;
  respiratory: string;
  gastrointestinal: string;
  genitourinary: string;
  musculoskeletal: string;
  neurological: string;
  psychiatric: string;
  endocrine: string;
  hematologic: string;
  allergicImmunologic: string;
}

export interface PhysicalExam {
  generalAppearance: string;
  vitalSigns: VitalSigns;
  heent: string; // Head, Eyes, Ears, Nose, Throat
  cardiovascular: string;
  respiratory: string;
  abdominal: string;
  extremities: string;
  neurological: string;
  skin: string;
  psychiatric: string;
}

export interface DiagnosticImpression {
  icd10Code: string;
  description: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  status: 'Active' | 'Resolved' | 'Chronic' | 'Acute';
  confidence: 'High' | 'Medium' | 'Low';
}

export interface AssessmentPlan {
  problem: string;
  assessment: string;
  plan: string;
  orders: ClinicalOrder[];
  followUp: string;
}

export interface ClinicalOrder {
  id: string;
  type: 'Medication' | 'Laboratory' | 'Imaging' | 'Procedure' | 'Referral' | 'Therapy';
  description: string;
  priority: 'Routine' | 'Urgent' | 'STAT';
  orderedBy: string;
  orderDate: Date;
  scheduledDate?: Date;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  results?: string;
  notes?: string;
}

export interface ClinicalEncounter {
  id: string;
  patientId: string;
  encounterDate: Date;
  encounterType: 'Outpatient' | 'Inpatient' | 'Emergency' | 'Telemedicine';
  location: string;
  nursingAssessment?: NursingAssessment;
  physicianAssessment?: PhysicianAssessment;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  chiefComplaint: string;
  disposition: string;
}

export interface ClinicalAlert {
  id: string;
  patientId: string;
  type: 'Critical Value' | 'Drug Allergy' | 'Drug Interaction' | 'Clinical Reminder';
  severity: 'High' | 'Medium' | 'Low';
  message: string;
  createdBy: string;
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}