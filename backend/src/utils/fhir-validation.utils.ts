import { ResourceType } from '@medplum/fhirtypes';

/**
 * Core FHIR R4 Resource Types supported by this system
 */
const VALID_RESOURCE_TYPES: readonly ResourceType[] = [
  'Patient', 'Practitioner', 'PractitionerRole', 'Organization', 'Encounter', 'Observation',
  'DiagnosticReport', 'Condition', 'Procedure', 'MedicationRequest',
  'MedicationStatement', 'MedicationDispense', 'MedicationAdministration', 'AllergyIntolerance', 
  'CarePlan', 'Goal', 'Appointment', 'Schedule', 'Slot', 'Coverage', 'Claim', 
  'Bundle', 'OperationOutcome', 'CapabilityStatement', 'ValueSet', 'CodeSystem',
  'Questionnaire', 'QuestionnaireResponse', 'DocumentReference', 'Binary',
  'AuditEvent', 'Provenance', 'Subscription', 'Communication', 'Device',
  'Location', 'Substance', 'Medication', 'Immunization', 'RelatedPerson',
  'Group', 'HealthcareService', 'ServiceRequest', 'Specimen', 'ImagingStudy',
  'Media', 'ClinicalImpression', 'RiskAssessment', 'FamilyMemberHistory',
  'DetectedIssue', 'Flag', 'List', 'Library', 'Measure', 'MeasureReport',
  'ActivityDefinition', 'PlanDefinition', 'Task', 'CareTeam', 'EpisodeOfCare', 
  'Account', 'ChargeItem', 'Invoice', 'NutritionOrder', 'VisionPrescription',
  'SupplyRequest', 'SupplyDelivery', 'AdverseEvent', 'GuidanceResponse',
  'RequestGroup', 'DeviceRequest', 'DeviceUseStatement', 'DeviceMetric',
  'MessageHeader', 'OperationDefinition', 'TestReport', 'TestScript',
  'Basic', 'Parameters', 'Endpoint', 'Consent', 'Composition'
] as const;

/**
 * Check if a string is a valid FHIR ResourceType
 */
export function isValidResourceType(resourceType: string): resourceType is ResourceType {
  return (VALID_RESOURCE_TYPES as readonly string[]).includes(resourceType);
}

/**
 * Validate and convert string to ResourceType with error handling
 */
export function validateResourceType(resourceType: string | undefined): ResourceType {
  if (!resourceType) {
    throw new Error('Resource type is required');
  }
  
  if (!isValidResourceType(resourceType)) {
    throw new Error(`Invalid resource type: ${resourceType}. Must be a valid FHIR resource type.`);
  }
  
  return resourceType;
}

/**
 * Get list of all supported resource types
 */
export function getSupportedResourceTypes(): readonly ResourceType[] {
  return VALID_RESOURCE_TYPES;
}