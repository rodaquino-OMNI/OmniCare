/**
 * Medication Management Types and Interfaces
 * OmniCare EMR - Clinical Workflow System
 */

export interface MedicationOrder {
  id: string;
  patientId: string;
  prescriberId: string;
  prescriberName: string;
  orderDate: Date;
  medication: MedicationDetails;
  dosing: DosingInstructions;
  indication: string;
  duration?: string;
  refills: number;
  daw: boolean; // Dispense as Written
  priorAuthRequired: boolean;
  status: 'Draft' | 'Pending' | 'Active' | 'Completed' | 'Cancelled' | 'On Hold';
  electronicPrescription?: ElectronicPrescription;
  safetyChecks: MedicationSafetyCheck;
  clinicalNotes?: string;
  patientCounseling: PatientCounseling;
  pharmacistReview?: PharmacistReview;
  administrationRecords?: MedicationAdministrationRecord[];
}

export interface MedicationDetails {
  name: string;
  genericName: string;
  brandName?: string;
  strength: string;
  dosageForm: 'Tablet' | 'Capsule' | 'Liquid' | 'Injection' | 'Topical' | 'Inhaler' | 'Patch' | 'Other';
  ndc: string; // National Drug Code
  rxcui?: string; // RxNorm Concept Unique Identifier
  drugClass: string;
  controlledSubstance: boolean;
  scheduleClass?: 'I' | 'II' | 'III' | 'IV' | 'V';
  blackBoxWarning: boolean;
  allergens?: string[];
}

export interface DosingInstructions {
  dose: string;
  route: 'Oral' | 'IV' | 'IM' | 'SubQ' | 'Topical' | 'Inhalation' | 'Rectal' | 'Vaginal' | 'Ophthalmic' | 'Otic' | 'Nasal';
  frequency: string;
  timing?: string;
  maxDailyDose?: string;
  administrationInstructions: string;
  foodInteractions?: string;
  specialInstructions?: string;
}

export interface ElectronicPrescription {
  id: string;
  rxNumber: string;
  pharmacyId: string;
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
  transmissionDate: Date;
  transmissionStatus: 'Pending' | 'Transmitted' | 'Received' | 'Error';
  errorMessage?: string;
  fillStatus: 'Not Filled' | 'Partial Fill' | 'Filled' | 'Pickup Ready' | 'Picked Up';
  fillDate?: Date;
  quantity: number;
  daysSupply: number;
  prescriptionImage?: string;
}

export interface MedicationSafetyCheck {
  id: string;
  performedDate: Date;
  performedBy: string;
  allergies: AllergyCheck;
  interactions: InteractionCheck;
  contraindications: ContraindicationCheck;
  duplicateTherapy: DuplicateTherapyCheck;
  dosing: DosingCheck;
  kidneyFunction: KidneyFunctionCheck;
  liverFunction: LiverFunctionCheck;
  pregnancy: PregnancyCheck;
  overallRiskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  warnings: MedicationWarning[];
  overrides: SafetyOverride[];
}

export interface AllergyCheck {
  hasKnownAllergies: boolean;
  potentialAllergies: string[];
  crossReactivityRisk: boolean;
  riskLevel: 'None' | 'Low' | 'Medium' | 'High';
  recommendedAction: string;
}

export interface InteractionCheck {
  drugDrugInteractions: DrugInteraction[];
  drugFoodInteractions: string[];
  drugDiseaseInteractions: string[];
  overallInteractionRisk: 'None' | 'Minor' | 'Moderate' | 'Major' | 'Contraindicated';
  clinicalSignificance: string;
  monitoringRecommendations: string[];
}

export interface DrugInteraction {
  interactingMedication: string;
  severity: 'Minor' | 'Moderate' | 'Major' | 'Contraindicated';
  mechanism: string;
  clinicalEffect: string;
  management: string;
  references: string[];
}

export interface ContraindicationCheck {
  hasContraindications: boolean;
  contraindications: Contraindication[];
  riskBenefitAssessment: string;
  clinicalJustification?: string;
}

export interface Contraindication {
  type: 'Absolute' | 'Relative';
  condition: string;
  reason: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  alternativeRecommendations: string[];
}

export interface DuplicateTherapyCheck {
  hasDuplicates: boolean;
  duplicateTherapies: DuplicateTherapy[];
  recommendedAction: string;
}

export interface DuplicateTherapy {
  existingMedication: string;
  therapeuticClass: string;
  potentialDuplication: string;
  clinicalSignificance: 'Low' | 'Medium' | 'High';
}

export interface DosingCheck {
  appropriateDose: boolean;
  doseRecommendation: string;
  ageAppropriate: boolean;
  weightBased: boolean;
  renalAdjustment: boolean;
  hepaticAdjustment: boolean;
  warnings: string[];
}

export interface KidneyFunctionCheck {
  creatinine?: number;
  eGFR?: number;
  requiresAdjustment: boolean;
  adjustmentRecommendation?: string;
  monitoringRequired: boolean;
}

export interface LiverFunctionCheck {
  alt?: number;
  ast?: number;
  bilirubin?: number;
  requiresAdjustment: boolean;
  adjustmentRecommendation?: string;
  monitoringRequired: boolean;
}

export interface PregnancyCheck {
  pregnancyStatus: 'Unknown' | 'Not Pregnant' | 'Pregnant' | 'Possibly Pregnant' | 'Breastfeeding';
  pregnancyCategory?: 'A' | 'B' | 'C' | 'D' | 'X';
  riskAssessment: string;
  alternativeRecommendations?: string[];
}

export interface MedicationWarning {
  type: 'Allergy' | 'Interaction' | 'Contraindication' | 'Dosing' | 'Monitoring' | 'BlackBox';
  severity: 'Info' | 'Warning' | 'Critical';
  message: string;
  clinicalSignificance: string;
  recommendedAction: string;
  override: boolean;
}

export interface SafetyOverride {
  warningType: string;
  overrideReason: string;
  overriddenBy: string;
  overrideDate: Date;
  clinicalJustification: string;
  acknowledgment: string;
}

export interface PatientCounseling {
  counselingPoints: CounselingPoint[];
  patientEducationProvided: boolean;
  educationMethod: 'Verbal' | 'Written' | 'Video' | 'Demonstration';
  patientUnderstanding: 'Good' | 'Fair' | 'Poor';
  languageBarriers: boolean;
  interpreterUsed: boolean;
  followUpEducationNeeded: boolean;
  counselingDate: Date;
  counseledBy: string;
}

export interface CounselingPoint {
  topic: 'Indication' | 'Dosing' | 'Administration' | 'Side Effects' | 'Interactions' | 'Storage' | 'Monitoring';
  information: string;
  emphasized: boolean;
  patientQuestions?: string[];
  patientConcerns?: string[];
}

export interface PharmacistReview {
  id: string;
  pharmacistId: string;
  pharmacistName: string;
  reviewDate: Date;
  reviewType: 'Initial' | 'Modification' | 'Renewal' | 'Consultation';
  clinicalReview: ClinicalReview;
  recommendations: PharmacistRecommendation[];
  approvalStatus: 'Approved' | 'Approved with Modifications' | 'Rejected' | 'Consultation Required';
  consultationNotes?: string;
  patientCounselingCompleted: boolean;
  monitoringPlan?: MonitoringPlan;
}

export interface ClinicalReview {
  appropriateIndication: boolean;
  appropriateDosing: boolean;
  appropriateDuration: boolean;
  safetyScreeningComplete: boolean;
  alternativesConsidered: boolean;
  costEffectiveness: string;
  theraputicDuplication: boolean;
  adherenceAssessment: string;
}

export interface PharmacistRecommendation {
  type: 'Dosing' | 'Alternative' | 'Monitoring' | 'Education' | 'Discontinuation';
  recommendation: string;
  rationale: string;
  priority: 'High' | 'Medium' | 'Low';
  communicatedToPhysician: boolean;
  physicianResponse?: string;
  implemented: boolean;
}

export interface MonitoringPlan {
  parameters: MonitoringParameter[];
  frequency: string;
  duration: string;
  alertCriteria: string[];
  followUpRequired: boolean;
}

export interface MonitoringParameter {
  parameter: string;
  baseline?: string;
  target: string;
  frequency: string;
  method: 'Lab' | 'Vital Signs' | 'Patient Report' | 'Physical Exam';
  alertThresholds: AlertThreshold[];
}

export interface AlertThreshold {
  condition: string;
  value: string;
  action: string;
  severity: 'Low' | 'Medium' | 'High';
}

export interface MedicationAdministrationRecord {
  id: string;
  patientId: string;
  medicationOrderId: string;
  nurseId: string;
  nurseName: string;
  administrationDate: Date;
  scheduledTime: Date;
  actualTime: Date;
  doseGiven: string;
  route: string;
  site?: string;
  fiveRightsVerified: FiveRightsVerification;
  preAdministrationAssessment: PreAdministrationAssessment;
  postAdministrationAssessment: PostAdministrationAssessment;
  administrationStatus: 'Given' | 'Held' | 'Refused' | 'Omitted' | 'Not Available';
  holdReason?: string;
  refusalReason?: string;
  omissionReason?: string;
  adverseReaction?: AdverseReaction;
  nursingNotes?: string;
  witnessRequired: boolean;
  witnessId?: string;
  wasteWitnessed?: boolean;
}

export interface FiveRightsVerification {
  rightPatient: boolean;
  rightMedication: boolean;
  rightDose: boolean;
  rightRoute: boolean;
  rightTime: boolean;
  verificationMethod: 'Barcode' | 'Manual' | 'Biometric';
  verifiedBy: string;
  verificationTime: Date;
}

export interface PreAdministrationAssessment {
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
  };
  painLevel?: number;
  consciousnessLevel: string;
  allergiesVerified: boolean;
  contraindications: string[];
  patientCondition: string;
  readyForAdministration: boolean;
}

export interface PostAdministrationAssessment {
  immediateResponse: string;
  adverseReactions: boolean;
  effectiveness?: string;
  patientTolerance: 'Good' | 'Fair' | 'Poor';
  followUpRequired: boolean;
  nextAssessmentTime?: Date;
}

export interface AdverseReaction {
  id: string;
  type: 'Allergic' | 'Side Effect' | 'Toxicity' | 'Interaction';
  severity: 'Mild' | 'Moderate' | 'Severe' | 'Life-threatening';
  description: string;
  onsetTime: Date;
  duration?: string;
  treatment: string;
  outcome: 'Resolved' | 'Resolving' | 'Ongoing' | 'Worsened';
  reportedToPhysician: boolean;
  reportedDate?: Date;
  medicationDiscontinued: boolean;
  adverseEventReported: boolean;
}

export interface MedicationReconciliation {
  id: string;
  patientId: string;
  reconciliationType: 'Admission' | 'Transfer' | 'Discharge' | 'Outpatient Visit';
  performedBy: string;
  performedDate: Date;
  homemedications: HomeMedication[];
  admissionMedications: AdmissionMedication[];
  discrepancies: MedicationDiscrepancy[];
  interventions: ReconciliationIntervention[];
  reconciliationComplete: boolean;
  physicianReviewed: boolean;
  patientEducationProvided: boolean;
}

export interface HomeMedication {
  name: string;
  strength: string;
  dosageForm: string;
  dose: string;
  frequency: string;
  route: string;
  indication: string;
  prescriber: string;
  lastFilled?: Date;
  adherence: 'Good' | 'Fair' | 'Poor' | 'Unknown';
  source: 'Patient Report' | 'Pharmacy' | 'Medical Record' | 'Family';
  verified: boolean;
}

export interface AdmissionMedication {
  name: string;
  strength: string;
  dose: string;
  frequency: string;
  route: string;
  indication: string;
  orderedBy: string;
  status: 'Continue' | 'Hold' | 'Discontinue' | 'Modify';
  reason?: string;
}

export interface MedicationDiscrepancy {
  type: 'Omission' | 'Commission' | 'Duplication' | 'Dosing Error' | 'Frequency Error';
  medication: string;
  description: string;
  clinicalSignificance: 'High' | 'Medium' | 'Low';
  riskLevel: string;
  resolved: boolean;
  resolution?: string;
}

export interface ReconciliationIntervention {
  type: 'Add' | 'Remove' | 'Modify' | 'Hold' | 'Clarify';
  medication: string;
  action: string;
  rationale: string;
  communicatedToPhysician: boolean;
  physicianResponse?: string;
  implemented: boolean;
}

export interface MedicationList {
  id: string;
  patientId: string;
  lastUpdated: Date;
  updatedBy: string;
  activeMedications: ActiveMedication[];
  inactiveMedications: InactiveMedication[];
  allergies: MedicationAllergy[];
  adverseDrugReactions: AdverseDrugReaction[];
}

export interface ActiveMedication {
  id: string;
  name: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  dose: string;
  frequency: string;
  route: string;
  indication: string;
  prescriber: string;
  startDate: Date;
  endDate?: Date;
  lastRefill?: Date;
  refillsRemaining: number;
  status: 'Active' | 'On Hold' | 'PRN';
  adherence?: 'Good' | 'Fair' | 'Poor' | 'Unknown';
}

export interface InactiveMedication {
  id: string;
  name: string;
  reason: 'Completed Course' | 'Discontinued by Provider' | 'Patient Stopped' | 'Adverse Reaction' | 'Ineffective';
  discontinuedDate: Date;
  discontinuedBy: string;
  notes?: string;
}

export interface MedicationAllergy {
  id: string;
  allergen: string;
  reactionType: 'Allergy' | 'Intolerance' | 'Adverse Effect';
  reaction: string;
  severity: 'Mild' | 'Moderate' | 'Severe' | 'Life-threatening';
  onsetDate?: Date;
  verifiedBy: string;
  verifiedDate: Date;
  notes?: string;
}

export interface AdverseDrugReaction {
  id: string;
  medication: string;
  reaction: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  onsetDate: Date;
  outcome: 'Resolved' | 'Ongoing' | 'Unknown';
  causality: 'Definite' | 'Probable' | 'Possible' | 'Unlikely';
  reportedToFDA: boolean;
}

export interface ControlledSubstanceTracking {
  id: string;
  medicationOrderId: string;
  patientId: string;
  prescriberId: string;
  medication: string;
  strength: string;
  quantityPrescribed: number;
  quantityDispensed: number;
  quantityRemaining: number;
  prescriptionDate: Date;
  fillDate?: Date;
  pharmacyId: string;
  deaNumber: string;
  pdmpChecked: boolean;
  pdmpCheckDate?: Date;
  pdmpResults?: string;
  morphineEquivalent?: number;
  totalDailyMorphineEquivalent?: number;
  highRiskPatient: boolean;
  riskFactors: string[];
  monitoringRequired: boolean;
  agreementSigned: boolean;
  lastUrineDrugScreen?: Date;
  pillCountDate?: Date;
  pillCountResult?: string;
}

export interface EPrescribingMessage {
  id: string;
  messageType: 'NewRx' | 'RxChange' | 'CancelRx' | 'RxFill' | 'RxHistory' | 'Error';
  fromEntity: string;
  toEntity: string;
  timestamp: Date;
  messageContent: any;
  processingStatus: 'Pending' | 'Processed' | 'Error' | 'Rejected';
  errorDetails?: string;
  acknowledgmentRequired: boolean;
  acknowledged: boolean;
}