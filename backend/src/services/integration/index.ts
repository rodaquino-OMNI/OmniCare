/**
 * Integration Services Index
 * Central export point for all integration and interoperability services
 */

// HL7 FHIR R4 Services
export { FHIRValidationService } from './fhir/fhir-validation.service';
export { FHIRComplianceService } from './fhir/fhir-compliance.service';
export { FHIRTransformationService } from './fhir/fhir-transformation.service';

// SMART on FHIR Services
export { SMARTAppRegistrationService } from './smart/smart-app-registration.service';
export { SMARTLaunchService } from './smart/smart-launch.service';

// HL7 v2 Services
export { HL7v2ParserService } from './hl7v2/hl7v2-parser.service';
export { HL7v2RouterService } from './hl7v2/hl7v2-router.service';
export { HL7v2InterfaceService } from './hl7v2/hl7v2-interface.service';

// Direct Trust Services
export { DirectTrustService } from './direct/direct-trust.service';
export { DirectMessagingService } from './direct/direct-messaging.service';
export { DirectSecurityService } from './direct/direct-security.service';

// Laboratory Integration Services
export { LISIntegrationService } from './lab/lis-integration.service';
export { LabResultsService } from './lab/lab-results.service';
export { LabOrdersService } from './lab/lab-orders.service';

// Pharmacy Integration Services
export { PharmacyIntegrationService } from './pharmacy/pharmacy-integration.service';
export { NCPDPScriptService } from './pharmacy/ncpdp-script.service';
export { MedicationSyncService } from './pharmacy/medication-sync.service';

// Insurance Services
export { InsuranceVerificationService } from './insurance/insurance-verification.service';
export { X12EDIService } from './insurance/x12-edi.service';
export { CoverageService } from './insurance/coverage.service';

// Clinical Data Exchange Services
export { ClinicalDataExchangeService } from './clinical/clinical-data-exchange.service';
export { CDADocumentService } from './clinical/cda-document.service';
export { CCDAService } from './clinical/ccda.service';

// Public Health Reporting Services
export { PublicHealthReportingService } from './public-health/public-health-reporting.service';
export { CDCReportingService } from './public-health/cdc-reporting.service';
export { StateReportingService } from './public-health/state-reporting.service';

// Compliance and Monitoring Services
export { ComplianceMonitoringService } from './compliance/compliance-monitoring.service';
export { IntegrationAuditService } from './compliance/integration-audit.service';
export { CertificationService } from './compliance/certification.service';

// Utility Services
export { IntegrationUtilityService } from './utils/integration-utility.service';
export { DataMappingService } from './utils/data-mapping.service';
export { ErrorHandlingService } from './utils/error-handling.service';

// Main Integration Orchestrator
export { IntegrationOrchestrator } from './integration-orchestrator';

// Types and Interfaces
// Export specific types to avoid conflicts
export {
  IntegrationResult,
  IntegrationMessage,
  IntegrationConfig,
  IntegrationError,
  IntegrationStatus,
  IntegrationType,
  IntegrationMethod,
  IntegrationProtocol,
  IntegrationDirection,
  IntegrationPriority,
  IntegrationSecurity,
  IntegrationTransport,
  IntegrationFormat,
  IntegrationEncoding,
  IntegrationCompression,
  IntegrationAuthentication,
  IntegrationEncryption,
  IntegrationValidation,
  IntegrationTransformation,
  IntegrationRouting,
  IntegrationLogging,
  IntegrationMonitoring,
  IntegrationHandlerMap,
  IntegrationServiceMap,
  IntegrationProtocolHandlers,
  IntegrationTransformers,
  IntegrationValidators,
  ValidationResult
} from './types/integration.types';

export * from './types/hl7v2.types';
export * from './types/direct.types';

// Pharmacy types with aliases for conflicts
export {
  NCPDPVersion,
  PrescriptionStatus,
  DispenseStatus,
  FillStatus,
  PrescriptionType,
  RefillStatus,
  DrugDatabaseType,
  FormularyStatus,
  PharmacySystem,
  NCPDPMessage,
  NCPDPMessageType,
  PharmacyIntegrationConfig,
  IntegrationResult as PharmacyIntegrationResult,
  Prescription,
  MedicationDispense,
  MedicationHistory,
  RefillRequest,
  RefillResponse,
  PriorAuthorization as PriorAuthorizationRequest,
  PriorAuthorization as PriorAuthorizationResponse,
  FormularyCheckRequest as FormularyLookupRequest,
  FormularyCheckResponse as FormularyLookupResponse,
  DrugInteractionCheckRequest as DrugInteractionCheck,
  DrugInteractionResult,
  MedicationAdherenceData as MedicationAdherence,
  BenefitDetail as PharmacyBenefit,
  PharmacyReference as PharmacyNetwork,
  PharmacyAddress as PharmacyLocation,
  MedicationSyncRequest,
  MedicationSyncResponse,
  MedicationSyncRequest as RxHistoryRequest,
  MedicationSyncResponse as RxHistoryResponse,
  MedicationRecord as MedicationReconciliation,
  PatientReference as PharmacyPatientReference,
  CoverageReference as PharmacyCoverageReference,
  PrescriptionReference as PharmacyPrescriptionReference,
  Quantity as PharmacyQuantity
} from './types/pharmacy.types';

// Insurance types with aliases for conflicts
export {
  X12TransactionType,
  X12TransactionType as X12Version,
  EligibilityPurpose as InsuranceRequestType,
  ClaimStatus,
  ClaimStatus as ClaimType,
  AuthorizationStatus,
  EligibilityStatus,
  PlanType as PayerType,
  BenefitCategory,
  CoverageStatus as NetworkStatus,
  ServiceType,
  ServiceType as PlaceOfService,
  EDISegment as X12Segment,
  FunctionalGroup as X12Loop,
  TransactionSet as X12Transaction,
  InsuranceIntegrationConfig,
  IntegrationResult as InsuranceIntegrationResult,
  EligibilityDetails as InsuranceVerification,
  EligibilityRequest,
  EligibilityResponse,
  Benefit,
  Coverage,
  ClaimSubmissionRequest as ClaimSubmission,
  ClaimSubmissionResponse as ClaimResponse,
  ClaimItem,
  PriorAuthorizationRequest as AuthorizationRequest,
  PriorAuthorizationResponse as AuthorizationResponse,
  AuthorizedService,
  RemittanceAdvice as PaymentPosting,
  CopaymentDetail as PaymentDetail,
  RemittanceAdvice,
  ClaimError as DenialReason,
  Claim as AppealRequest,
  ClaimSubmissionResponse as AppealResponse,
  CoverageDetail as COBRequest,
  CoverageDetail as COBResponse,
  CoverageDetail as COBDetail,
  PatientReference as InsurancePatientReference,
  ProviderReference as InsuranceProviderReference,
  FacilityReference as InsuranceFacilityReference,
  EncounterReference as InsuranceEncounterReference,
  Address as InsuranceAddress,
  Annotation as InsuranceAnnotation
} from './types/insurance.types';

// Lab types with aliases for conflicts
export {
  LaboratorySystem as LabSystem,
  LabOrderStatus,
  LabResultStatus,
  SpecimenStatus,
  ResultInterpretation,
  SpecimenType,
  LabTestCategory,
  PriorityCode as PriorityLevel,
  ResultFlag,
  LabInterfaceMessage as LabMessage,
  LabResult as LabIntegrationResult,
  LabOrder,
  LabResult,
  LabTestDefinition as LabTest,
  LabPanel,
  LabResult as LabObservation,
  Specimen,
  SpecimenCollection,
  LabResult as LabReport,
  CriticalValueAlert as CriticalValue,
  LabInterface,
  LabRouting,
  LabResult as ResultDelivery,
  Specimen as LabAccession,
  QualityControlResult as QualityControl,
  LabLocation as LabFacility,
  ReferenceRange,
  Annotation as LabComment,
  PatientReference as LabPatientReference,
  Reference as LabReference,
  CodeableConcept as LabCodeableConcept,
  Coding as LabCoding,
  Identifier as LabIdentifier,
  Period as LabPeriod,
  Annotation as LabAttachment
} from './types/lab.types';

// Compliance types - no conflicts
export * from './types/compliance.types';