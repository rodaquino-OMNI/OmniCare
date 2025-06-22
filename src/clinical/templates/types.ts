/**
 * Clinical Templates Types and Interfaces
 * OmniCare EMR - Clinical Documentation Templates
 */

import { DiagnosticImpression, VitalSigns } from '../assessment/types';

export interface ClinicalTemplate {
  id: string;
  name: string;
  type: ClinicalTemplateType;
  version: string;
  description: string;
  category: TemplateCategory;
  specialty?: string;
  isActive: boolean;
  isDefault: boolean;
  createdBy: string;
  createdDate: Date;
  lastModifiedBy: string;
  lastModifiedDate: Date;
  sections: TemplateSection[];
  metadata: TemplateMetadata;
  fhirMapping?: FHIRTemplateMapping;
  complianceRequired: boolean;
  autoSave: boolean;
  validationRules: ValidationRule[];
}

export type ClinicalTemplateType = 
  | 'History_and_Physical'
  | 'Progress_Note'
  | 'Discharge_Summary'
  | 'Consultation_Note'
  | 'Operative_Note'
  | 'Emergency_Note'
  | 'Nursing_Note'
  | 'Therapy_Note'
  | 'Medication_Reconciliation'
  | 'Care_Plan'
  | 'Patient_Education'
  | 'Procedure_Note'
  | 'Diagnostic_Report'
  | 'Immunization_Record'
  | 'Vital_Signs_Flow'
  | 'Assessment_Tool'
  | 'Screening_Form'
  | 'Consent_Form'
  | 'Transfer_Summary';

export type TemplateCategory = 
  | 'Admission'
  | 'Progress'
  | 'Discharge'
  | 'Emergency'
  | 'Outpatient'
  | 'Inpatient'
  | 'Surgical'
  | 'Diagnostic'
  | 'Therapeutic'
  | 'Preventive'
  | 'Administrative'
  | 'Legal'
  | 'Quality';

export interface TemplateSection {
  id: string;
  title: string;
  order: number;
  isRequired: boolean;
  isVisible: boolean;
  isCollapsible: boolean;
  fields: TemplateField[];
  conditionalDisplay?: ConditionalDisplay;
  validationRules?: ValidationRule[];
  helpText?: string;
  clinicalGuidance?: string;
}

export interface TemplateField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  isRequired: boolean;
  isReadOnly: boolean;
  order: number;
  placeholder?: string;
  defaultValue?: any;
  options?: FieldOption[];
  validation?: FieldValidation;
  conditionalDisplay?: ConditionalDisplay;
  clinicalCoding?: ClinicalCoding;
  fhirPath?: string;
  helpText?: string;
  autoComplete?: AutoCompleteConfig;
  calculatedField?: CalculatedFieldConfig;
}

export type FieldType = 
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'time'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'signature'
  | 'drawing'
  | 'medication'
  | 'diagnosis'
  | 'procedure'
  | 'vitals'
  | 'allergy'
  | 'provider'
  | 'patient'
  | 'location'
  | 'duration'
  | 'dosage'
  | 'frequency'
  | 'measurement'
  | 'scale'
  | 'assessment'
  | 'free_text'
  | 'structured_data';

export interface FieldOption {
  value: string;
  label: string;
  isDefault?: boolean;
  clinicalCode?: string;
  description?: string;
  isActive?: boolean;
}

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customValidator?: string;
  errorMessage?: string;
}

export interface ConditionalDisplay {
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains';
  value: any;
  action: 'show' | 'hide' | 'require' | 'disable';
}

export interface ClinicalCoding {
  system: 'ICD10' | 'CPT' | 'SNOMED' | 'LOINC' | 'RxNorm' | 'NDC' | 'HCPCS';
  code?: string;
  display?: string;
  version?: string;
}

export interface AutoCompleteConfig {
  source: 'medications' | 'diagnoses' | 'procedures' | 'allergies' | 'providers' | 'custom';
  endpoint?: string;
  searchFields?: string[];
  minSearchLength?: number;
  maxResults?: number;
}

export interface CalculatedFieldConfig {
  expression: string;
  dependencies: string[];
  unit?: string;
  precision?: number;
  refreshTrigger: 'change' | 'blur' | 'manual';
}

export interface ValidationRule {
  id: string;
  name: string;
  expression: string;
  errorMessage: string;
  severity: 'error' | 'warning' | 'info';
  isActive: boolean;
}

export interface TemplateMetadata {
  tags: string[];
  keywords: string[];
  clinicalContext: string[];
  applicableConditions: string[];
  ageRange?: AgeRange;
  gender?: 'male' | 'female' | 'any';
  language: string;
  jurisdiction: string;
  complianceFramework?: string[];
  effectiveDate?: Date;
  expirationDate?: Date;
  reviewCycle: number; // months
  lastReviewDate?: Date;
  nextReviewDate?: Date;
}

export interface AgeRange {
  min?: number;
  max?: number;
  unit: 'days' | 'months' | 'years';
}

export interface FHIRTemplateMapping {
  resourceType: string;
  profile?: string;
  fieldMappings: FHIRFieldMapping[];
  extensions?: FHIRExtension[];
}

export interface FHIRFieldMapping {
  templateFieldId: string;
  fhirPath: string;
  dataType: string;
  isRequired: boolean;
  transformation?: string;
}

export interface FHIRExtension {
  url: string;
  valueType: string;
  templateFieldId: string;
}

export interface TemplateInstance {
  id: string;
  templateId: string;
  patientId: string;
  encounterId?: string;
  createdBy: string;
  createdDate: Date;
  lastModifiedBy: string;
  lastModifiedDate: Date;
  status: TemplateInstanceStatus;
  data: Record<string, any>;
  validationErrors: ValidationError[];
  isSigned: boolean;
  signedBy?: string;
  signedDate?: Date;
  isLocked: boolean;
  version: string;
  parentInstanceId?: string;
  amendments: TemplateAmendment[];
}

export type TemplateInstanceStatus = 
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'signed'
  | 'amended'
  | 'deleted'
  | 'archived';

export interface ValidationError {
  fieldId: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
}

export interface TemplateAmendment {
  id: string;
  amendedBy: string;
  amendedDate: Date;
  reason: string;
  changes: FieldChange[];
  isSignificant: boolean;
}

export interface FieldChange {
  fieldId: string;
  fieldName: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'modified' | 'deleted';
}

export interface TemplateSearchCriteria {
  type?: ClinicalTemplateType;
  category?: TemplateCategory;
  specialty?: string;
  keywords?: string[];
  isActive?: boolean;
  patientAge?: number;
  patientGender?: string;
  clinicalContext?: string[];
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface TemplateUsageStats {
  templateId: string;
  usageCount: number;
  lastUsed: Date;
  averageCompletionTime: number;
  completionRate: number;
  errorRate: number;
  userFeedback: UserFeedback[];
}

export interface UserFeedback {
  userId: string;
  rating: number;
  comment?: string;
  submittedDate: Date;
  category: 'usability' | 'content' | 'technical' | 'suggestion';
}

export interface TemplateImportExport {
  template: ClinicalTemplate;
  instances?: TemplateInstance[];
  metadata: {
    exportedBy: string;
    exportedDate: Date;
    version: string;
    checksum: string;
  };
}

export interface SmartFormCapabilities {
  autoComplete: boolean;
  clinicalDecisionSupport: boolean;
  drugInteractionChecking: boolean;
  allergyAlerts: boolean;
  duplicateDetection: boolean;
  dataValidation: boolean;
  templateSuggestions: boolean;
  contextualHelp: boolean;
  voiceInput: boolean;
  mobileOptimized: boolean;
}

export interface TemplateAccessControl {
  templateId: string;
  permissions: TemplatePermission[];
  restrictions: TemplateRestriction[];
}

export interface TemplatePermission {
  userId?: string;
  roleId?: string;
  departmentId?: string;
  permission: 'view' | 'create' | 'edit' | 'delete' | 'sign' | 'admin';
  grantedBy: string;
  grantedDate: Date;
  expirationDate?: Date;
}

export interface TemplateRestriction {
  type: 'time' | 'location' | 'patient_type' | 'encounter_type' | 'specialty';
  criteria: string;
  isActive: boolean;
}

export interface ClinicalFormBuilder {
  buildTemplate(config: TemplateBuilderConfig): ClinicalTemplate;
  validateTemplate(template: ClinicalTemplate): ValidationResult;
  previewTemplate(template: ClinicalTemplate): TemplatePreview;
  exportTemplate(templateId: string, format: ExportFormat): string;
  importTemplate(data: string, format: ExportFormat): ClinicalTemplate;
}

export interface TemplateBuilderConfig {
  name: string;
  type: ClinicalTemplateType;
  category: TemplateCategory;
  sections: SectionConfig[];
  metadata: Partial<TemplateMetadata>;
  validation?: ValidationRule[];
}

export interface SectionConfig {
  title: string;
  fields: FieldConfig[];
  isRequired?: boolean;
  isCollapsible?: boolean;
}

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  isRequired?: boolean;
  options?: string[];
  validation?: Partial<FieldValidation>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface TemplatePreview {
  html: string;
  css: string;
  javascript?: string;
  metadata: {
    fieldCount: number;
    sectionCount: number;
    estimatedTime: number;
    complexity: 'low' | 'medium' | 'high';
  };
}

export type ExportFormat = 'json' | 'xml' | 'fhir' | 'pdf' | 'html' | 'csv';

export interface TemplateLibrary {
  id: string;
  name: string;
  description: string;
  version: string;
  publisher: string;
  templates: ClinicalTemplate[];
  dependencies: string[];
  installDate?: Date;
  isActive: boolean;
}

export interface TemplateRegistry {
  searchTemplates(criteria: TemplateSearchCriteria): Promise<ClinicalTemplate[]>;
  getTemplate(id: string): Promise<ClinicalTemplate | null>;
  createTemplate(template: ClinicalTemplate): Promise<string>;
  updateTemplate(id: string, template: Partial<ClinicalTemplate>): Promise<void>;
  deleteTemplate(id: string): Promise<void>;
  duplicateTemplate(id: string, newName: string): Promise<string>;
  getTemplateVersions(id: string): Promise<ClinicalTemplate[]>;
  publishTemplate(id: string): Promise<void>;
  retireTemplate(id: string): Promise<void>;
}