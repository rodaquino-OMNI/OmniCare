/**
 * Laboratory and Diagnostic Types and Interfaces
 * OmniCare EMR - Clinical Workflow System
 */

import { ClinicalOrder } from '../assessment/types';

export interface DiagnosticOrder {
  id: string;
  patientId: string;
  orderedBy: string;
  orderingPhysician: string;
  orderDate: Date;
  orderType: 'Laboratory' | 'Imaging' | 'Cardiology' | 'Pathology' | 'Genetics' | 'Microbiology';
  tests: DiagnosticTest[];
  clinicalIndication: string;
  specialInstructions?: string;
  urgency: 'Routine' | 'Urgent' | 'STAT' | 'Timed';
  scheduledDate?: Date;
  patientPreparation: PatientPreparation;
  status: 'Pending' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled' | 'Resulted';
  cancellationReason?: string;
  results?: DiagnosticResult[];
  qualityControl: QualityControlCheck;
  billing: BillingInformation;
}

export interface DiagnosticTest {
  testCode: string;
  testName: string;
  cptCode: string;
  loincCode?: string;
  testCategory: 'Chemistry' | 'Hematology' | 'Microbiology' | 'Immunology' | 'Molecular' | 'Radiology' | 'Cardiology' | 'Pathology';
  specimenType: SpecimenType;
  collectionMethod: string;
  volumeRequired: string;
  containerType: string;
  preservative?: string;
  transportConditions: string;
  turnaroundTime: string;
  referenceRange?: ReferenceRange;
  criticalValues?: CriticalValue[];
  interfering: InterferingFactor[];
  clinicalSignificance: string;
}

export interface SpecimenType {
  type: 'Blood' | 'Urine' | 'Stool' | 'CSF' | 'Tissue' | 'Swab' | 'Sputum' | 'Other';
  subtype?: string;
  collectionSite?: string;
  collectionTechnique: string;
  fastingRequired: boolean;
  specialHandling: string[];
}

export interface PatientPreparation {
  fastingHours?: number;
  dietaryRestrictions: string[];
  medicationHold: MedicationHold[];
  activityRestrictions: string[];
  preparationInstructions: string[];
  timingRequirements?: string;
  contrasterAgent?: ContrastAgent;
}

export interface MedicationHold {
  medication: string;
  holdDuration: string;
  reason: string;
  resumeInstructions: string;
}

export interface ContrastAgent {
  agentType: 'Iodinated' | 'Gadolinium' | 'Barium' | 'Other';
  agentName: string;
  dose: string;
  administration: 'Oral' | 'IV' | 'Rectal';
  allergyScreening: boolean;
  kidneyFunctionCheck: boolean;
  premedication?: string[];
}

export interface SpecimenCollection {
  id: string;
  orderId: string;
  patientId: string;
  collectedBy: string;
  collectionDate: Date;
  collectionTime: Date;
  collectionSite: string;
  specimens: Specimen[];
  collectionComplications: boolean;
  complicationDetails?: string;
  patientIdentityVerified: boolean;
  labelsAccurate: boolean;
  transportArranged: boolean;
  collectionNotes?: string;
}

export interface Specimen {
  id: string;
  specimenId: string;
  testCodes: string[];
  specimenType: SpecimenType;
  collectionContainer: string;
  volume: string;
  quality: SpecimenQuality;
  transportConditions: TransportConditions;
  receivedAt?: Date;
  receivedBy?: string;
  processingStatus: 'Collected' | 'In Transit' | 'Received' | 'Processing' | 'Completed' | 'Rejected';
  rejectionReason?: string;
  storageLocation?: string;
}

export interface SpecimenQuality {
  acceptable: boolean;
  issues: QualityIssue[];
  volume: string;
  appearance: string;
  temperature: string;
  integrity: 'Intact' | 'Compromised';
  contaminationRisk: 'None' | 'Possible' | 'Likely';
}

export interface QualityIssue {
  issue: 'Hemolysis' | 'Clotting' | 'Insufficient Volume' | 'Contamination' | 'Improper Storage' | 'Mislabeled';
  severity: 'Minor' | 'Major' | 'Critical';
  impact: string;
  actionTaken: string;
}

export interface TransportConditions {
  temperature: 'Room Temperature' | 'Refrigerated' | 'Frozen' | 'Dry Ice';
  timeLimit: string;
  specialHandling: string[];
  transportMethod: 'Pneumatic Tube' | 'Hand Carry' | 'Courier' | 'Mail';
  trackingNumber?: string;
}

export interface LaboratoryProcessing {
  id: string;
  specimenId: string;
  testCode: string;
  technician: string;
  processingDate: Date;
  instrument: Instrument;
  methodology: string;
  calibrationStatus: CalibrationStatus;
  qualityControlResults: QualityControlResult[];
  processingSteps: ProcessingStep[];
  result: TestResult;
  technicalComments?: string;
  repeat: boolean;
  repeatReason?: string;
  criticalValue: boolean;
  criticalValueNotified: boolean;
  notificationTime?: Date;
}

export interface Instrument {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  lastMaintenance: Date;
  calibrationStatus: 'Current' | 'Due' | 'Overdue';
  qualityControlStatus: 'Pass' | 'Fail' | 'Pending';
  operationalStatus: 'Online' | 'Offline' | 'Maintenance';
}

export interface CalibrationStatus {
  lastCalibration: Date;
  nextCalibrationDue: Date;
  calibrationMaterial: string;
  calibrationResult: 'Pass' | 'Fail';
  calibrationBy: string;
}

export interface QualityControlResult {
  controlLevel: 'Low' | 'Normal' | 'High';
  expectedValue: string;
  actualValue: string;
  withinRange: boolean;
  deviation?: number;
  action: 'Accept' | 'Repeat' | 'Investigate';
  comments?: string;
}

export interface ProcessingStep {
  step: string;
  startTime: Date;
  endTime: Date;
  status: 'Completed' | 'Failed' | 'Skipped';
  operator: string;
  notes?: string;
}

export interface TestResult {
  value: string;
  unit: string;
  referenceRange: ReferenceRange;
  flag: 'Normal' | 'High' | 'Low' | 'Critical High' | 'Critical Low' | 'Abnormal';
  methodUsed: string;
  precision: number;
  accuracy: number;
  resultDate: Date;
  resultTime: Date;
  verified: boolean;
  verifiedBy?: string;
  verificationDate?: Date;
}

export interface ReferenceRange {
  lowerLimit?: number;
  upperLimit?: number;
  textRange?: string;
  ageSpecific: boolean;
  genderSpecific: boolean;
  units: string;
  methodology: string;
  population: string;
}

export interface CriticalValue {
  condition: string;
  threshold: string;
  actionRequired: string;
  notificationProtocol: NotificationProtocol;
  timeframe: string;
}

export interface NotificationProtocol {
  primaryContact: string;
  backupContact: string;
  notificationMethod: 'Phone' | 'Page' | 'EMR Alert' | 'SMS';
  maxAttempts: number;
  escalationProcedure: string;
  documentationRequired: boolean;
}

export interface InterferingFactor {
  substance: string;
  effect: 'Increase' | 'Decrease' | 'False Positive' | 'False Negative';
  mechanism: string;
  clinicalSignificance: string;
  avoidance: string;
}

export interface DiagnosticResult {
  id: string;
  orderId: string;
  testCode: string;
  testName: string;
  result: TestResult;
  interpretation: ResultInterpretation;
  technicalNotes?: string;
  resultStatus: 'Preliminary' | 'Final' | 'Corrected' | 'Amended';
  reportedDate: Date;
  reportedBy: string;
  reviewedBy?: string;
  reviewDate?: Date;
  criticalValue: boolean;
  criticalValueHandling?: CriticalValueHandling;
  deltaCheck?: DeltaCheck;
  correlationCheck?: CorrelationCheck;
}

export interface ResultInterpretation {
  interpretation: string;
  clinicalCorrelation: string;
  recommendedFollowUp?: string;
  additionalTesting?: string[];
  limitations?: string;
  pathologistComments?: string;
}

export interface CriticalValueHandling {
  notifiedPersonnel: string[];
  notificationTime: Date;
  acknowledgment: boolean;
  acknowledgmentBy?: string;
  acknowledgmentTime?: Date;
  actionTaken: string;
  followUpRequired: boolean;
  followUpInstructions?: string;
}

export interface DeltaCheck {
  previousValue?: string;
  previousDate?: Date;
  percentChange?: number;
  deltaFlag: boolean;
  deltaComments?: string;
  reviewRequired: boolean;
}

export interface CorrelationCheck {
  relatedTests: string[];
  correlationStatus: 'Consistent' | 'Inconsistent' | 'Inconclusive';
  correlationComments?: string;
  additionalTestingRecommended: boolean;
}

export interface QualityControlCheck {
  performedBy: string;
  performedDate: Date;
  specimenQuality: SpecimenQuality;
  labelAccuracy: boolean;
  chainOfCustody: boolean;
  processingCompliance: boolean;
  resultReview: boolean;
  issues: QualityIssue[];
  overallStatus: 'Pass' | 'Fail' | 'Conditional';
  correctiveActions?: string[];
}

export interface BillingInformation {
  cptCodes: string[];
  icd10Codes: string[];
  insurance: InsuranceInformation;
  authorization: AuthorizationInfo;
  billingStatus: 'Pending' | 'Submitted' | 'Paid' | 'Denied' | 'Appeal';
  charges: BillingCharge[];
}

export interface InsuranceInformation {
  primaryInsurance: string;
  policyNumber: string;
  groupNumber: string;
  secondaryInsurance?: string;
  copay?: number;
  deductible?: number;
  coverageVerified: boolean;
  verificationDate?: Date;
}

export interface AuthorizationInfo {
  required: boolean;
  authorizationNumber?: string;
  authorizationDate?: Date;
  expirationDate?: Date;
  approvedTests: string[];
  limitations?: string;
}

export interface BillingCharge {
  cptCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalCharge: number;
  allowedAmount?: number;
  patientResponsibility?: number;
}

export interface ImagingStudy {
  id: string;
  orderId: string;
  patientId: string;
  studyType: 'X-Ray' | 'CT' | 'MRI' | 'Ultrasound' | 'Nuclear Medicine' | 'Mammography' | 'Fluoroscopy';
  bodyPart: string;
  contrast: boolean;
  contrastAgent?: ContrastAgent;
  protocol: ImagingProtocol;
  technologist: string;
  performedDate: Date;
  acquisitionParameters: AcquisitionParameters;
  imageQuality: ImageQuality;
  findings: ImagingFindings;
  impressions: string[];
  recommendations: string[];
  radiologist: string;
  readDate: Date;
  reportStatus: 'Preliminary' | 'Final' | 'Addendum';
  priorStudies: PriorStudy[];
  dicomStudyId?: string;
  seriesCount: number;
  imageCount: number;
}

export interface ImagingProtocol {
  protocolName: string;
  indication: string;
  technique: string;
  parameters: { [key: string]: string };
  positioning: string;
  views: string[];
  specialInstructions?: string;
}

export interface AcquisitionParameters {
  kVp?: number;
  mAs?: number;
  sliceThickness?: number;
  fieldOfView?: string;
  matrix?: string;
  repetitionTime?: number;
  echoTime?: number;
  flipAngle?: number;
  contrastTiming?: string;
}

export interface ImageQuality {
  technicalQuality: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Non-diagnostic';
  artifacts: string[];
  motionArtifact: boolean;
  adequatePenetration: boolean;
  positioning: 'Optimal' | 'Adequate' | 'Suboptimal';
  comments?: string;
}

export interface ImagingFindings {
  normal: boolean;
  abnormalFindings: AbnormalFinding[];
  measurements: Measurement[];
  comparisons: Comparison[];
  incidentalFindings: string[];
}

export interface AbnormalFinding {
  location: string;
  description: string;
  size?: string;
  characteristics: string[];
  significance: 'Benign' | 'Probably Benign' | 'Indeterminate' | 'Suspicious' | 'Malignant';
  followUpRecommended: boolean;
  followUpTimeframe?: string;
}

export interface Measurement {
  structure: string;
  measurement: number;
  unit: string;
  method: string;
  normalRange?: string;
  clinical: 'Normal' | 'Abnormal';
}

export interface Comparison {
  priorStudyDate: Date;
  findings: string;
  interval: 'Improved' | 'Stable' | 'Worsened' | 'New';
  significance: string;
}

export interface PriorStudy {
  studyDate: Date;
  studyType: string;
  relevantFindings: string;
  comparisonAvailable: boolean;
}

export interface PathologySpecimen {
  id: string;
  orderId: string;
  patientId: string;
  specimenType: 'Biopsy' | 'Cytology' | 'Surgical' | 'Autopsy';
  anatomicalSite: string;
  collectionMethod: string;
  submittedBy: string;
  submissionDate: Date;
  clinicalHistory: string;
  grossDescription: string;
  microscopyFindings: string;
  diagnosis: PathologyDiagnosis[];
  specialStains: SpecialStain[];
  immunohistochemistry?: ImmunohistochemistryResult[];
  molecularTesting?: MolecularTestResult[];
  margins?: MarginAssessment;
  staging?: CancerStaging;
  prognosticFactors?: PrognosticFactor[];
  pathologist: string;
  reportDate: Date;
  reportStatus: 'Preliminary' | 'Final' | 'Amended';
}

export interface PathologyDiagnosis {
  diagnosis: string;
  icd10Code: string;
  snomedCode?: string;
  grade?: string;
  certainty: 'Definitive' | 'Probable' | 'Possible' | 'Rule Out';
  comments?: string;
}

export interface SpecialStain {
  stainName: string;
  result: string;
  interpretation: string;
  clinicalSignificance: string;
}

export interface ImmunohistochemistryResult {
  marker: string;
  result: 'Positive' | 'Negative' | 'Equivocal';
  intensity: 'Weak' | 'Moderate' | 'Strong';
  percentage?: number;
  pattern?: string;
  clinicalSignificance: string;
}

export interface MolecularTestResult {
  testName: string;
  methodology: string;
  result: string;
  interpretation: string;
  clinicalSignificance: string;
  limitations?: string;
}

export interface MarginAssessment {
  margins: MarginStatus[];
  overallStatus: 'Clear' | 'Close' | 'Positive' | 'Cannot Assess';
  clinicalSignificance: string;
}

export interface MarginStatus {
  location: string;
  status: 'Clear' | 'Close' | 'Positive';
  distance?: string;
  comments?: string;
}

export interface CancerStaging {
  stagingSystem: string;
  primaryTumor: string;
  lymphNodes: string;
  metastasis: string;
  overallStage: string;
  pathologicalStage?: string;
}

export interface PrognosticFactor {
  factor: string;
  result: string;
  significance: string;
  implications: string;
}

export interface ResultsManagement {
  id: string;
  orderId: string;
  patientId: string;
  results: DiagnosticResult[];
  reviewStatus: 'Pending' | 'Reviewed' | 'Acknowledged' | 'Acted Upon';
  reviewedBy?: string;
  reviewDate?: Date;
  acknowledgmentRequired: boolean;
  acknowledgedBy?: string;
  acknowledgmentDate?: Date;
  patientNotification: PatientNotification;
  followUpOrders?: string[];
  additionalTesting?: string[];
  clinicalCorrelation: string;
  resultsSummary: string;
}

export interface PatientNotification {
  notificationRequired: boolean;
  notificationMethod: 'Phone' | 'Portal' | 'Letter' | 'In Person';
  notificationBy?: string;
  notificationDate?: Date;
  patientContacted: boolean;
  messageDelivered: boolean;
  patientQuestions?: string[];
  followUpScheduled: boolean;
  followUpDate?: Date;
}

export interface DiagnosticAlert {
  id: string;
  alertType: 'Critical Value' | 'Panic Value' | 'Delta Check' | 'Correlation Alert' | 'Quality Alert';
  severity: 'High' | 'Medium' | 'Low';
  message: string;
  patientId: string;
  orderId: string;
  testCode: string;
  value: string;
  generatedDate: Date;
  generatedBy: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedDate?: Date;
  actionTaken?: string;
  resolved: boolean;
  resolutionDate?: Date;
}