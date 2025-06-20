/**
 * OmniCare CDS Type Definitions
 * 
 * Comprehensive type definitions for the Clinical Decision Support system
 */

// Base patient data structure
export interface Patient {
  patientId: string;
  demographics: {
    age: number;
    gender: 'M' | 'F' | 'Other';
    weight?: number;
    height?: number;
    bmi?: number;
  };
  allergies: Allergy[];
  currentMedications: Medication[];
  medicalHistory: MedicalCondition[];
  vitalSigns?: VitalSigns;
  labResults?: LabResult[];
  preferences?: PatientPreferences;
}

// Allergy information
export interface Allergy {
  allergen: string;
  allergenType: 'Drug' | 'Food' | 'Environmental' | 'Other';
  severity: 'Mild' | 'Moderate' | 'Severe' | 'Unknown';
  reaction: string[];
  onsetDate?: Date;
  status: 'Active' | 'Inactive' | 'Resolved';
  verificationStatus: 'Confirmed' | 'Unconfirmed' | 'Entered-in-error';
}

// Medication information
export interface Medication {
  medicationId: string;
  name: string;
  genericName?: string;
  rxcui?: string; // RxNorm code
  dose: string;
  route: string;
  frequency: string;
  startDate?: Date;
  endDate?: Date;
  prescriber?: string;
  indication?: string;
  status: 'Active' | 'Discontinued' | 'Held' | 'Completed';
}

// Medical conditions
export interface MedicalCondition {
  conditionId: string;
  icd10Code: string;
  description: string;
  status: 'Active' | 'Resolved' | 'Inactive';
  onsetDate?: Date;
  severity?: 'Mild' | 'Moderate' | 'Severe';
  verificationStatus: 'Confirmed' | 'Provisional' | 'Differential' | 'Refuted';
}

// Vital signs
export interface VitalSigns {
  temperature?: number;
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  height?: number;
  weight?: number;
  timestamp: Date;
}

// Lab results
export interface LabResult {
  testName: string;
  loincCode?: string;
  value: number | string;
  unit: string;
  referenceRange?: string;
  abnormalFlag?: 'High' | 'Low' | 'Critical High' | 'Critical Low' | 'Abnormal';
  resultDate: Date;
  status: 'Final' | 'Preliminary' | 'Corrected' | 'Cancelled';
}

// Patient preferences
export interface PatientPreferences {
  languagePreference?: string;
  communicationPreferences?: string[];
  advanceDirectives?: boolean;
  emergencyContact?: string;
}

// CDS Hook request structure (following CDS Hooks specification)
export interface CDSHookRequest {
  hook: string;
  hookInstance: string;
  fhirServer?: string;
  user: {
    id: string;
    resourceType: 'Practitioner';
  };
  context: CDSHookContext;
  prefetch?: Record<string, any>;
}

// CDS Hook context varies by hook type
export interface CDSHookContext {
  patientId: string;
  encounterId?: string;
  draft?: any; // For medication-prescribe hook
  selections?: string[]; // For order-select hook
  [key: string]: any;
}

// CDS Hook response structure
export interface CDSHookResponse {
  cards: CDSCard[];
  systemActions?: SystemAction[];
}

// CDS Cards for alerts and recommendations
export interface CDSCard {
  uuid?: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: {
    label: string;
    url?: string;
    icon?: string;
  };
  suggestions?: Suggestion[];
  selectionBehavior?: 'at-most-one' | 'any';
  overrideReasons?: OverrideReason[];
  links?: Link[];
}

// Suggestions for CDS cards
export interface Suggestion {
  label: string;
  uuid?: string;
  isRecommended?: boolean;
  actions?: Action[];
}

// Actions that can be taken
export interface Action {
  type: 'create' | 'update' | 'delete';
  description?: string;
  resource?: any; // FHIR resource
}

// Override reasons for alerts
export interface OverrideReason {
  code: string;
  display: string;
  system?: string;
}

// Links to external resources
export interface Link {
  label: string;
  url: string;
  type: 'absolute' | 'smart';
  appContext?: string;
}

// System actions
export interface SystemAction {
  type: string;
  description?: string;
  resource?: any;
}

// Drug interaction information
export interface DrugInteraction {
  interactionId: string;
  drug1: string;
  drug2: string;
  severity: 'Contraindicated' | 'Major' | 'Moderate' | 'Minor';
  mechanism: string;
  effect: string;
  management: string;
  evidence: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  references?: string[];
}

// Allergy alerts
export interface AllergyAlert {
  alertId: string;
  patientId: string;
  allergen: string;
  medication: string;
  crossReactivity: boolean;
  severity: 'High' | 'Medium' | 'Low';
  message: string;
  recommendation: string;
}

// Clinical guidelines
export interface ClinicalGuideline {
  guidelineId: string;
  title: string;
  organization: string;
  version: string;
  lastUpdated: Date;
  conditions: string[];
  recommendations: Recommendation[];
  evidenceLevel: 'A' | 'B' | 'C' | 'D';
}

// Clinical recommendations
export interface Recommendation {
  recommendationId: string;
  title: string;
  description: string;
  strength: 'Strong' | 'Weak' | 'Conditional';
  category: 'Prevention' | 'Screening' | 'Treatment' | 'Monitoring';
  applicability: ApplicabilityCriteria;
  actions: RecommendedAction[];
}

// Applicability criteria for recommendations
export interface ApplicabilityCriteria {
  ageRange?: { min?: number; max?: number };
  gender?: 'M' | 'F' | 'Any';
  conditions?: string[];
  labValues?: LabCriteria[];
  medications?: string[];
}

// Lab criteria for recommendations
export interface LabCriteria {
  testName: string;
  operator: '>' | '<' | '>=' | '<=' | '=' | '!=';
  value: number;
  unit: string;
}

// Recommended actions
export interface RecommendedAction {
  actionType: 'Order' | 'Medication' | 'Referral' | 'Education' | 'Monitoring';
  description: string;
  frequency?: string;
  duration?: string;
  priority: 'High' | 'Medium' | 'Low';
}

// Quality measures
export interface QualityMeasure {
  measureId: string;
  title: string;
  description: string;
  category: 'Process' | 'Outcome' | 'Structure' | 'Balancing';
  population: PopulationCriteria;
  numerator: MeasureCriteria;
  denominator: MeasureCriteria;
  exclusions?: MeasureCriteria;
  reportingPeriod: {
    start: Date;
    end: Date;
  };
}

// Population criteria for quality measures
export interface PopulationCriteria {
  description: string;
  criteria: ClinicalCriteria[];
}

// Measure criteria
export interface MeasureCriteria {
  description: string;
  criteria: ClinicalCriteria[];
}

// Clinical criteria
export interface ClinicalCriteria {
  type: 'Age' | 'Gender' | 'Condition' | 'Medication' | 'Procedure' | 'Lab' | 'Vital';
  operator?: '>' | '<' | '>=' | '<=' | '=' | '!=';
  value?: any;
  unit?: string;
  codeSystem?: string;
  codes?: string[];
}

// Risk scores
export interface RiskScore {
  scoreId: string;
  scoreName: string;
  patient: Patient;
  score: number;
  risk: 'Low' | 'Intermediate' | 'High' | 'Very High';
  factors: RiskFactor[];
  calculatedDate: Date;
  validityPeriod?: number; // in days
}

// Risk factors
export interface RiskFactor {
  name: string;
  value: any;
  points: number;
  weight: number;
  description?: string;
}

// Clinical calculators
export interface ClinicalCalculator {
  calculatorId: string;
  name: string;
  description: string;
  category: 'Cardiology' | 'Nephrology' | 'Endocrinology' | 'Pediatrics' | 'General';
  inputs: CalculatorInput[];
  formula: string;
  interpretation: CalculatorInterpretation[];
  references?: string[];
}

// Calculator inputs
export interface CalculatorInput {
  inputId: string;
  label: string;
  type: 'number' | 'select' | 'boolean' | 'date';
  unit?: string;
  required: boolean;
  options?: CalculatorOption[];
  validationRules?: ValidationRule[];
}

// Calculator options for select inputs
export interface CalculatorOption {
  value: any;
  label: string;
  points?: number;
}

// Validation rules for inputs
export interface ValidationRule {
  type: 'min' | 'max' | 'range' | 'required';
  value: any;
  message: string;
}

// Calculator interpretation
export interface CalculatorInterpretation {
  range: {
    min?: number;
    max?: number;
  };
  interpretation: string;
  recommendation?: string;
  riskLevel?: 'Low' | 'Moderate' | 'High' | 'Very High';
}

// Alert types
export interface Alert {
  alertId: string;
  patientId: string;
  alertType: 'Drug Interaction' | 'Allergy' | 'Duplicate Therapy' | 'Dosing' | 'Clinical Guideline' | 'Quality Measure' | 'Risk Score';
  severity: 'Info' | 'Warning' | 'Critical';
  title: string;
  message: string;
  timestamp: Date;
  source: string;
  actionable: boolean;
  dismissed?: boolean;
  dismissedBy?: string;
  dismissedAt?: Date;
  dismissalReason?: string;
  relatedData?: any;
}

// Performance metrics
export interface PerformanceMetric {
  metricId: string;
  providerId?: string;
  departmentId?: string;
  facilityId?: string;
  metricType: 'Quality' | 'Safety' | 'Efficiency' | 'Patient Satisfaction';
  metricName: string;
  value: number;
  target?: number;
  period: {
    start: Date;
    end: Date;
  };
  trend: 'Improving' | 'Stable' | 'Declining';
  benchmarkComparison?: BenchmarkComparison;
}

// Benchmark comparison
export interface BenchmarkComparison {
  nationalAverage?: number;
  regionalAverage?: number;
  peerAverage?: number;
  percentile?: number;
  performance: 'Above Average' | 'Average' | 'Below Average';
}

// Evidence-based recommendations
export interface EvidenceRecommendation {
  recommendationId: string;
  title: string;
  context: ClinicalContext;
  evidence: Evidence[];
  recommendation: string;
  strength: 'Strong for' | 'Weak for' | 'Weak against' | 'Strong against';
  qualityOfEvidence: 'High' | 'Moderate' | 'Low' | 'Very Low';
  applicability: ApplicabilityCriteria;
  implementation: ImplementationGuidance;
}

// Clinical context for recommendations
export interface ClinicalContext {
  population: string;
  intervention: string;
  comparison?: string;
  outcome: string;
  setting: string;
}

// Evidence supporting recommendations
export interface Evidence {
  studyType: 'RCT' | 'Cohort' | 'Case-Control' | 'Cross-Sectional' | 'Case Series' | 'Expert Opinion';
  population: string;
  sampleSize?: number;
  findings: string;
  limitations?: string;
  reference: string;
  evidenceLevel: 'I' | 'II' | 'III' | 'IV' | 'V';
}

// Implementation guidance
export interface ImplementationGuidance {
  barriers: string[];
  facilitators: string[];
  resources: string[];
  monitoring: string[];
  evaluation: string[];
}

// Configuration for CDS system
export interface CDSConfiguration {
  enabledServices: string[];
  alertThresholds: {
    drugInteraction: 'Major' | 'Moderate' | 'Minor';
    allergyAlert: 'High' | 'Medium' | 'Low';
  };
  timeouts: {
    hookResponse: number; // milliseconds
    externalService: number;
  };
  externalServices: {
    drugDatabase: string;
    guidelinesService: string;
    evidenceService: string;
  };
  customRules: CustomRule[];
}

// Custom rules for CDS
export interface CustomRule {
  ruleId: string;
  name: string;
  description: string;
  category: string;
  condition: string; // JavaScript expression
  action: RuleAction[];
  enabled: boolean;
  priority: number;
}

// Rule actions
export interface RuleAction {
  type: 'Alert' | 'Suggest' | 'Block' | 'Log';
  severity?: 'Info' | 'Warning' | 'Critical';
  message?: string;
  data?: any;
}