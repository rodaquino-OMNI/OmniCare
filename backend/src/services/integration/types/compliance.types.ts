/**
 * Compliance Integration Types
 * Type definitions for compliance monitoring, audit trails, and certification management
 */

import { IntegrationResult, IntegrationMessage, IntegrationConfig, ComplianceStatus as BaseComplianceStatus, ComplianceFinding } from './integration.types';

/**
 * Compliance Framework Types
 */
export enum ComplianceFramework {
  HIPAA = 'HIPAA',
  SOX = 'SOX',
  GDPR = 'GDPR',
  HITECH = 'HITECH',
  FDA_21_CFR_PART_11 = 'FDA_21_CFR_PART_11',
  NIST_800_53 = 'NIST_800_53',
  ISO_27001 = 'ISO_27001',
  SOC_2 = 'SOC_2',
  PCI_DSS = 'PCI_DSS',
  FISMA = 'FISMA',
  CLIA = 'CLIA',
  CAP = 'CAP',
  JOINT_COMMISSION = 'JOINT_COMMISSION',
  MEANINGFUL_USE = 'MEANINGFUL_USE',
  MACRA_MIPS = 'MACRA_MIPS',
  INTEROPERABILITY_STANDARDS = 'INTEROPERABILITY_STANDARDS'
}

/**
 * Audit Event Types
 */
export enum AuditEventType {
  // User Authentication
  LOGIN_SUCCESS = 'login-success',
  LOGIN_FAILURE = 'login-failure',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password-change',
  ACCOUNT_LOCKOUT = 'account-lockout',
  
  // Data Access
  DATA_ACCESS = 'data-access',
  DATA_VIEW = 'data-view',
  DATA_EXPORT = 'data-export',
  DATA_PRINT = 'data-print',
  
  // Data Modification
  DATA_CREATE = 'data-create',
  DATA_UPDATE = 'data-update',
  DATA_DELETE = 'data-delete',
  DATA_MERGE = 'data-merge',
  
  // System Events
  SYSTEM_START = 'system-start',
  SYSTEM_STOP = 'system-stop',
  SYSTEM_CONFIGURATION_CHANGE = 'system-config-change',
  
  // Integration Events
  MESSAGE_SENT = 'message-sent',
  MESSAGE_RECEIVED = 'message-received',
  MESSAGE_PROCESSED = 'message-processed',
  MESSAGE_FAILED = 'message-failed',
  
  // Security Events
  SECURITY_ALERT = 'security-alert',
  INTRUSION_ATTEMPT = 'intrusion-attempt',
  PRIVILEGE_ESCALATION = 'privilege-escalation',
  UNAUTHORIZED_ACCESS = 'unauthorized-access',
  
  // Compliance Events
  COMPLIANCE_CHECK = 'compliance-check',
  POLICY_VIOLATION = 'policy-violation',
  AUDIT_TRAIL_REVIEW = 'audit-trail-review',
  
  // Administrative Events
  USER_CREATED = 'user-created',
  USER_MODIFIED = 'user-modified',
  USER_DELETED = 'user-deleted',
  ROLE_ASSIGNED = 'role-assigned',
  ROLE_REVOKED = 'role-revoked',
  PERMISSION_GRANTED = 'permission-granted',
  PERMISSION_REVOKED = 'permission-revoked'
}

/**
 * Audit Event Outcome
 */
export enum AuditEventOutcome {
  SUCCESS = 'success',
  MINOR_FAILURE = 'minor-failure',
  SERIOUS_FAILURE = 'serious-failure',
  MAJOR_FAILURE = 'major-failure'
}

/**
 * Risk Level
 */
export enum RiskLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

/**
 * Compliance Assessment Status
 */
export enum AssessmentStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  DEFERRED = 'deferred',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

/**
 * Remediation Status
 */
export enum RemediationStatus {
  IDENTIFIED = 'identified',
  PLANNED = 'planned',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  DEFERRED = 'deferred'
}

/**
 * Audit Event
 */
export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  outcome: AuditEventOutcome;
  source: AuditSource;
  agent: AuditAgent[];
  entity?: AuditEntity[];
  description?: string;
  purposeOfEvent?: string[];
  outcomeDescription?: string;
  networkAccessPointId?: string;
  networkAccessPointType?: 'machine-name' | 'ip-address' | 'telephone-number' | 'email-address' | 'uri';
  media?: AuditMedia;
  annotation?: string;
}

/**
 * Audit Source
 */
export interface AuditSource {
  site?: string;
  identifier: string;
  type?: AuditSourceType[];
}

/**
 * Audit Source Type
 */
export interface AuditSourceType {
  system: string;
  code: string;
  display: string;
}

/**
 * Audit Agent
 */
export interface AuditAgent {
  type?: AuditAgentType;
  role?: AuditAgentRole[];
  who?: Reference;
  altId?: string;
  name?: string;
  requestor: boolean;
  location?: Reference;
  policy?: string[];
  media?: AuditMedia;
  network?: AuditNetwork;
  purposeOfUse?: string[];
}

/**
 * Audit Agent Type
 */
export interface AuditAgentType {
  system: string;
  code: string;
  display: string;
}

/**
 * Audit Agent Role
 */
export interface AuditAgentRole {
  system: string;
  code: string;
  display: string;
}

/**
 * Reference
 */
export interface Reference {
  reference?: string;
  type?: string;
  identifier?: Identifier;
  display?: string;
}

/**
 * Identifier
 */
export interface Identifier {
  use?: string;
  type?: CodeableConcept;
  system?: string;
  value: string;
  period?: Period;
}

/**
 * Codeable Concept
 */
export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

/**
 * Coding
 */
export interface Coding {
  system: string;
  version?: string;
  code: string;
  display?: string;
}

/**
 * Period
 */
export interface Period {
  start: Date;
  end?: Date;
}

/**
 * Audit Media
 */
export interface AuditMedia {
  type: string;
  subtype?: string;
}

/**
 * Audit Network
 */
export interface AuditNetwork {
  address?: string;
  type?: 'machine-name' | 'ip-address' | 'telephone-number' | 'email-address' | 'uri';
}

/**
 * Audit Entity
 */
export interface AuditEntity {
  what?: Reference;
  type?: AuditEntityType;
  role?: AuditEntityRole;
  lifecycle?: AuditEntityLifecycle;
  securityLabel?: Coding[];
  name?: string;
  description?: string;
  query?: string; // base64 encoded
  detail?: AuditEntityDetail[];
}

/**
 * Audit Entity Type
 */
export interface AuditEntityType {
  system: string;
  code: string;
  display: string;
}

/**
 * Audit Entity Role
 */
export interface AuditEntityRole {
  system: string;
  code: string;
  display: string;
}

/**
 * Audit Entity Lifecycle
 */
export interface AuditEntityLifecycle {
  system: string;
  code: string;
  display: string;
}

/**
 * Audit Entity Detail
 */
export interface AuditEntityDetail {
  type: string;
  valueString?: string;
  valueBase64Binary?: string;
}

/**
 * Compliance Policy
 */
export interface CompliancePolicy {
  id: string;
  name: string;
  description: string;
  framework: ComplianceFramework;
  version: string;
  effectiveDate: Date;
  expirationDate?: Date;
  status: 'draft' | 'active' | 'retired' | 'superseded';
  category: PolicyCategory;
  scope: PolicyScope;
  requirements: PolicyRequirement[];
  controls: ComplianceControl[];
  approvedBy: string;
  approvalDate: Date;
  lastReviewDate?: Date;
  nextReviewDate: Date;
  owner: string;
  stakeholders: string[];
  relatedPolicies?: string[];
  exceptions?: PolicyException[];
}

/**
 * Policy Category
 */
export enum PolicyCategory {
  SECURITY = 'security',
  PRIVACY = 'privacy',
  DATA_GOVERNANCE = 'data-governance',
  CLINICAL_QUALITY = 'clinical-quality',
  OPERATIONAL = 'operational',
  TECHNICAL = 'technical',
  ADMINISTRATIVE = 'administrative',
  FINANCIAL = 'financial',
  LEGAL = 'legal',
  ETHICAL = 'ethical'
}

/**
 * Policy Scope
 */
export interface PolicyScope {
  organizationalUnits: string[];
  systems: string[];
  dataTypes: string[];
  processes: string[];
  locations: string[];
  userRoles: string[];
}

/**
 * Policy Requirement
 */
export interface PolicyRequirement {
  id: string;
  description: string;
  mandatory: boolean;
  priority: 'high' | 'medium' | 'low';
  dueDate?: Date;
  assignedTo?: string;
  status: 'draft' | 'active' | 'implemented' | 'violated' | 'waived';
  evidence?: string[];
  references?: string[];
}

/**
 * Compliance Control
 */
export interface ComplianceControl {
  id: string;
  controlId: string; // Framework-specific control ID
  name: string;
  description: string;
  category: ControlCategory;
  type: ControlType;
  family: string;
  baselineImpact: 'low' | 'moderate' | 'high';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  implementation: ControlImplementation;
  assessment: ControlAssessment;
  status: 'implemented' | 'partially-implemented' | 'planned' | 'alternative' | 'not-applicable';
  responsible: string;
  approver?: string;
  dependencies?: string[];
  relatedControls?: string[];
}

/**
 * Control Category
 */
export enum ControlCategory {
  ACCESS_CONTROL = 'access-control',
  AUDIT_ACCOUNTABILITY = 'audit-accountability',
  AWARENESS_TRAINING = 'awareness-training',
  CONFIGURATION_MANAGEMENT = 'configuration-management',
  CONTINGENCY_PLANNING = 'contingency-planning',
  IDENTIFICATION_AUTHENTICATION = 'identification-authentication',
  INCIDENT_RESPONSE = 'incident-response',
  MAINTENANCE = 'maintenance',
  MEDIA_PROTECTION = 'media-protection',
  PHYSICAL_ENVIRONMENTAL = 'physical-environmental',
  PLANNING = 'planning',
  PERSONNEL_SECURITY = 'personnel-security',
  RISK_ASSESSMENT = 'risk-assessment',
  SYSTEM_COMMUNICATIONS = 'system-communications',
  SYSTEM_INFORMATION_INTEGRITY = 'system-information-integrity',
  SYSTEM_SERVICES_ACQUISITION = 'system-services-acquisition'
}

/**
 * Control Type
 */
export enum ControlType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
  DIRECTIVE = 'directive',
  DETERRENT = 'deterrent',
  RECOVERY = 'recovery',
  COMPENSATING = 'compensating'
}

/**
 * Control Implementation
 */
export interface ControlImplementation {
  method: 'automated' | 'manual' | 'hybrid';
  description: string;
  procedures: string[];
  tools: string[];
  responsible: string;
  implementationDate: Date;
  evidence: string[];
  cost?: number;
  effort?: string;
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Control Assessment
 */
export interface ControlAssessment {
  lastAssessmentDate?: Date;
  nextAssessmentDate: Date;
  frequency: 'continuous' | 'annually' | 'semi-annually' | 'quarterly' | 'monthly' | 'weekly' | 'daily';
  method: 'examine' | 'interview' | 'test' | 'automated';
  assessor: string;
  effectiveness: 'effective' | 'partially-effective' | 'ineffective' | 'not-assessed';
  findings: ControlFinding[];
  recommendations: string[];
  status: 'compliant' | 'non-compliant' | 'partially-compliant' | 'not-assessed';
}

/**
 * Control Finding
 */
export interface ControlFinding {
  id: string;
  type: 'deficiency' | 'weakness' | 'observation' | 'improvement';
  severity: RiskLevel;
  description: string;
  evidence: string[];
  impact: string;
  likelihood: 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
  riskRating: RiskLevel;
  recommendations: string[];
  remediation: RemediationPlan;
  identifiedDate: Date;
  identifiedBy: string;
  status: RemediationStatus;
}

/**
 * Remediation Plan
 */
export interface RemediationPlan {
  id: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedTo: string;
  dueDate: Date;
  estimatedEffort: string;
  estimatedCost?: number;
  dependencies?: string[];
  milestones: RemediationMilestone[];
  status: RemediationStatus;
  approver?: string;
  approvalDate?: Date;
}

/**
 * Remediation Milestone
 */
export interface RemediationMilestone {
  id: string;
  description: string;
  dueDate: Date;
  completedDate?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  assignedTo: string;
  deliverables: string[];
  evidence?: string[];
}

/**
 * Policy Exception
 */
export interface PolicyException {
  id: string;
  description: string;
  justification: string;
  requestedBy: string;
  requestDate: Date;
  approvedBy?: string;
  approvalDate?: Date;
  status: 'requested' | 'approved' | 'denied' | 'expired' | 'revoked';
  effectiveDate?: Date;
  expirationDate?: Date;
  conditions?: string[];
  riskAcceptance?: RiskAcceptance;
  reviewDate?: Date;
  compensatingControls?: string[];
}

/**
 * Risk Acceptance
 */
export interface RiskAcceptance {
  risk: string;
  riskLevel: RiskLevel;
  impact: string;
  likelihood: string;
  mitigation: string[];
  acceptedBy: string;
  acceptanceDate: Date;
  reviewDate: Date;
}

/**
 * Compliance Assessment
 */
export interface ComplianceAssessment {
  id: string;
  name: string;
  framework: ComplianceFramework;
  scope: AssessmentScope;
  objectives: string[];
  methodology: string;
  startDate: Date;
  endDate?: Date;
  status: AssessmentStatus;
  assessor: AssessorInfo;
  findings: ComplianceAssessmentFinding[];
  recommendations: string[];
  overallRating: 'compliant' | 'substantially-compliant' | 'partially-compliant' | 'non-compliant';
  riskRating: RiskLevel;
  previousAssessment?: string;
  nextAssessmentDate?: Date;
  correctionActionPlan?: CorrectiveActionPlan;
  certification?: CertificationInfo;
}

/**
 * Assessment Scope
 */
export interface AssessmentScope {
  systems: string[];
  processes: string[];
  organizationalUnits: string[];
  dataTypes: string[];
  timeframe: Period;
  exclusions?: string[];
  limitations?: string[];
}

/**
 * Assessor Info
 */
export interface AssessorInfo {
  name: string;
  organization: string;
  credentials: string[];
  experience: string;
  independence: boolean;
  qualifications: string[];
}

/**
 * Compliance Assessment Finding
 */
export interface ComplianceAssessmentFinding extends ComplianceFinding {
  controlId?: string;
  requirement?: string;
  testProcedure: string;
  sampleSize?: number;
  populationSize?: number;
  exceptionRate?: number;
  rootCause?: string;
  businessImpact?: string;
  technicalImpact?: string;
  affectedSystems?: string[];
  affectedProcesses?: string[];
  relatedFindings?: string[];
}

/**
 * Corrective Action Plan
 */
export interface CorrectiveActionPlan {
  id: string;
  description: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  assignedTo: string;
  dueDate: Date;
  completionDate?: Date;
  status: RemediationStatus;
  actions: CorrectiveAction[];
  budget?: number;
  resources?: string[];
  dependencies?: string[];
  riskIfNotCompleted?: string;
  progress?: ProgressUpdate[];
}

/**
 * Corrective Action
 */
export interface CorrectiveAction {
  id: string;
  description: string;
  type: 'immediate' | 'short-term' | 'long-term';
  assignedTo: string;
  dueDate: Date;
  completionDate?: Date;
  status: RemediationStatus;
  evidence?: string[];
  effectiveness?: 'effective' | 'partially-effective' | 'ineffective' | 'pending';
  verificationMethod?: string;
  verificationDate?: Date;
  verifiedBy?: string;
}

/**
 * Progress Update
 */
export interface ProgressUpdate {
  date: Date;
  status: RemediationStatus;
  percentComplete: number;
  description: string;
  updatedBy: string;
  issues?: string[];
  risksAndConcerns?: string[];
  nextSteps?: string[];
}

/**
 * Certification Info
 */
export interface CertificationInfo {
  certificationBody: string;
  certificateNumber: string;
  issuedDate: Date;
  expirationDate: Date;
  scope: string;
  status: 'active' | 'suspended' | 'revoked' | 'expired';
  conditions?: string[];
  surveillanceSchedule?: SurveillanceSchedule;
}

/**
 * Surveillance Schedule
 */
export interface SurveillanceSchedule {
  frequency: 'annual' | 'semi-annual' | 'quarterly' | 'monthly';
  nextSurveillanceDate: Date;
  lastSurveillanceDate?: Date;
  surveillanceType: 'remote' | 'on-site' | 'hybrid';
  surveillanceScope: string[];
}

/**
 * Compliance Metric
 */
export interface ComplianceMetric {
  id: string;
  name: string;
  description: string;
  category: MetricCategory;
  type: MetricType;
  unit: string;
  formula?: string;
  threshold: MetricThreshold;
  frequency: 'real-time' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  dataSource: string;
  owner: string;
  calculationMethod: string;
  businessJustification: string;
  history: MetricHistory[];
}

/**
 * Metric Category
 */
export enum MetricCategory {
  SECURITY = 'security',
  PRIVACY = 'privacy',
  QUALITY = 'quality',
  OPERATIONAL = 'operational',
  FINANCIAL = 'financial',
  REGULATORY = 'regulatory',
  RISK = 'risk',
  PERFORMANCE = 'performance'
}

/**
 * Metric Type
 */
export enum MetricType {
  PERCENTAGE = 'percentage',
  COUNT = 'count',
  RATIO = 'ratio',
  AVERAGE = 'average',
  DURATION = 'duration',
  BINARY = 'binary'
}

/**
 * Metric Threshold
 */
export interface MetricThreshold {
  target: number;
  acceptable: number;
  critical: number;
  direction: 'higher-is-better' | 'lower-is-better' | 'target-is-optimal';
}

/**
 * Metric History
 */
export interface MetricHistory {
  date: Date;
  value: number;
  status: 'green' | 'yellow' | 'red';
  notes?: string;
  dataQuality?: 'high' | 'medium' | 'low';
}

/**
 * Compliance Report
 */
export interface ComplianceReport {
  id: string;
  title: string;
  type: ReportType;
  framework: ComplianceFramework;
  period: Period;
  generatedDate: Date;
  generatedBy: string;
  status: 'draft' | 'final' | 'published';
  audience: string[];
  executiveSummary: string;
  scope: string;
  methodology: string;
  keyFindings: string[];
  recommendations: string[];
  overallCompliance: ComplianceStatus;
  metrics: ComplianceMetric[];
  findings: ComplianceAssessmentFinding[];
  exceptions: PolicyException[];
  attachments: Attachment[];
  distribution: ReportDistribution[];
  nextReportDate?: Date;
}

/**
 * Report Type
 */
export enum ReportType {
  ASSESSMENT = 'assessment',
  AUDIT = 'audit',
  MONITORING = 'monitoring',
  CERTIFICATION = 'certification',
  INCIDENT = 'incident',
  MANAGEMENT = 'management',
  REGULATORY = 'regulatory',
  EXCEPTION = 'exception'
}

/**
 * Compliance Status
 */
export interface ComplianceStatus extends BaseComplianceStatus {
  framework: ComplianceFramework;
  overallScore: number;
  controlsTotal: number;
  controlsCompliant: number;
  controlsNonCompliant: number;
  controlsPartiallyCompliant: number;
  controlsNotAssessed: number;
  highRiskFindings: number;
  mediumRiskFindings: number;
  lowRiskFindings: number;
  openRemediation: number;
  overdueRemediation: number;
  exceptions: number;
  lastFullAssessment?: Date;
  nextFullAssessment?: Date;
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Attachment
 */
export interface Attachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: Date;
}

/**
 * Report Distribution
 */
export interface ReportDistribution {
  recipient: string;
  method: 'email' | 'portal' | 'print' | 'secure-file-transfer';
  deliveredDate?: Date;
  acknowledgmentRequired: boolean;
  acknowledgedDate?: Date;
  acknowledgedBy?: string;
}

/**
 * Compliance Incident
 */
export interface ComplianceIncident {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  severity: RiskLevel;
  status: IncidentStatus;
  discoveredDate: Date;
  discoveredBy: string;
  reportedDate: Date;
  reportedBy: string;
  affectedSystems: string[];
  affectedData: string[];
  affectedIndividuals?: number;
  potentialImpact: string;
  actualImpact?: string;
  rootCause?: string;
  containmentActions: string[];
  correctionActions: string[];
  preventiveActions: string[];
  lessonsLearned?: string[];
  regulatoryNotification?: RegulatoryNotification[];
  investigation: IncidentInvestigation;
  timeline: IncidentTimeline[];
  costs?: IncidentCost;
  followUp?: IncidentFollowUp[];
}

/**
 * Incident Category
 */
export enum IncidentCategory {
  DATA_BREACH = 'data-breach',
  UNAUTHORIZED_ACCESS = 'unauthorized-access',
  SYSTEM_FAILURE = 'system-failure',
  POLICY_VIOLATION = 'policy-violation',
  COMPLIANCE_VIOLATION = 'compliance-violation',
  SECURITY_INCIDENT = 'security-incident',
  PRIVACY_INCIDENT = 'privacy-incident',
  QUALITY_INCIDENT = 'quality-incident',
  OPERATIONAL_INCIDENT = 'operational-incident'
}

/**
 * Incident Status
 */
export enum IncidentStatus {
  REPORTED = 'reported',
  INVESTIGATING = 'investigating',
  CONTAINED = 'contained',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  CANCELLED = 'cancelled'
}

/**
 * Regulatory Notification
 */
export interface RegulatoryNotification {
  regulator: string;
  required: boolean;
  deadline: Date;
  notificationDate?: Date;
  method: string;
  reference?: string;
  acknowledgment?: string;
  status: 'pending' | 'submitted' | 'acknowledged' | 'overdue';
}

/**
 * Incident Investigation
 */
export interface IncidentInvestigation {
  leadInvestigator: string;
  team: string[];
  startDate: Date;
  endDate?: Date;
  methodology: string;
  findings: string[];
  evidence: string[];
  witnesses?: string[];
  expertConsultation?: string[];
  conclusion: string;
  recommendations: string[];
}

/**
 * Incident Timeline
 */
export interface IncidentTimeline {
  date: Date;
  event: string;
  description: string;
  source: string;
  evidence?: string[];
}

/**
 * Incident Cost
 */
export interface IncidentCost {
  investigation: number;
  remediation: number;
  legal: number;
  regulatory: number;
  business: number;
  reputation: number;
  total: number;
  currency: string;
}

/**
 * Incident Follow Up
 */
export interface IncidentFollowUp {
  date: Date;
  action: string;
  assignedTo: string;
  dueDate: Date;
  completionDate?: Date;
  status: RemediationStatus;
  evidence?: string[];
}

/**
 * Compliance Integration Configuration
 */
export interface ComplianceIntegrationConfig extends IntegrationConfig {
  frameworks: ComplianceFramework[];
  auditingEnabled: boolean;
  auditRetentionDays: number;
  realTimeMonitoring: boolean;
  alertingEnabled: boolean;
  reportingFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  automatedAssessments: boolean;
  encryptionRequired: boolean;
  digitalSignatureRequired: boolean;
}

/**
 * Compliance Dashboard
 */
export interface ComplianceDashboard {
  overallComplianceScore: number;
  frameworkStatus: FrameworkStatus[];
  riskSummary: RiskSummary;
  recentFindings: ComplianceAssessmentFinding[];
  upcomingAssessments: UpcomingAssessment[];
  overdueRemediation: RemediationPlan[];
  metrics: ComplianceMetric[];
  incidents: ComplianceIncident[];
  alerts: ComplianceAlert[];
  trends: ComplianceTrend[];
}

/**
 * Framework Status
 */
export interface FrameworkStatus {
  framework: ComplianceFramework;
  overallScore: number;
  status: 'compliant' | 'non-compliant' | 'partially-compliant';
  lastAssessment: Date;
  nextAssessment: Date;
  controlsCompliant: number;
  controlsTotal: number;
  highRiskFindings: number;
}

/**
 * Risk Summary
 */
export interface RiskSummary {
  totalRisks: number;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
  riskTrend: 'increasing' | 'stable' | 'decreasing';
  riskAppetite: 'low' | 'medium' | 'high';
  riskTolerance: number;
}

/**
 * Upcoming Assessment
 */
export interface UpcomingAssessment {
  id: string;
  name: string;
  framework: ComplianceFramework;
  dueDate: Date;
  assessor: string;
  scope: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Compliance Alert
 */
export interface ComplianceAlert {
  id: string;
  type: 'violation' | 'deadline' | 'threshold' | 'incident' | 'finding';
  severity: RiskLevel;
  message: string;
  source: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedDate?: Date;
  action?: string;
  relatedItems?: string[];
}

/**
 * Compliance Trend
 */
export interface ComplianceTrend {
  metric: string;
  period: Period;
  dataPoints: TrendDataPoint[];
  trend: 'improving' | 'stable' | 'declining';
  forecast?: TrendDataPoint[];
}

/**
 * Trend Data Point
 */
export interface TrendDataPoint {
  date: Date;
  value: number;
  target?: number;
  status: 'green' | 'yellow' | 'red';
}

/**
 * Compliance Service Interface
 */
export interface ComplianceService {
  // Audit Management
  createAuditEvent(event: AuditEvent): Promise<IntegrationResult<AuditEvent>>;
  getAuditEvents(criteria: AuditSearchCriteria): Promise<IntegrationResult<AuditEvent[]>>;
  exportAuditTrail(criteria: AuditSearchCriteria, format: 'csv' | 'json' | 'pdf'): Promise<IntegrationResult<string>>;
  
  // Policy Management
  createPolicy(policy: CompliancePolicy): Promise<IntegrationResult<CompliancePolicy>>;
  updatePolicy(policyId: string, updates: Partial<CompliancePolicy>): Promise<IntegrationResult<CompliancePolicy>>;
  getPolicy(policyId: string): Promise<IntegrationResult<CompliancePolicy>>;
  getPolicies(framework?: ComplianceFramework): Promise<IntegrationResult<CompliancePolicy[]>>;
  
  // Assessment Management
  createAssessment(assessment: ComplianceAssessment): Promise<IntegrationResult<ComplianceAssessment>>;
  updateAssessment(assessmentId: string, updates: Partial<ComplianceAssessment>): Promise<IntegrationResult<ComplianceAssessment>>;
  getAssessment(assessmentId: string): Promise<IntegrationResult<ComplianceAssessment>>;
  scheduleAssessment(assessment: ComplianceAssessment): Promise<IntegrationResult<string>>;
  
  // Remediation Management
  createRemediationPlan(plan: RemediationPlan): Promise<IntegrationResult<RemediationPlan>>;
  updateRemediationPlan(planId: string, updates: Partial<RemediationPlan>): Promise<IntegrationResult<RemediationPlan>>;
  getRemediationPlans(status?: RemediationStatus): Promise<IntegrationResult<RemediationPlan[]>>;
  
  // Incident Management
  createIncident(incident: ComplianceIncident): Promise<IntegrationResult<ComplianceIncident>>;
  updateIncident(incidentId: string, updates: Partial<ComplianceIncident>): Promise<IntegrationResult<ComplianceIncident>>;
  getIncident(incidentId: string): Promise<IntegrationResult<ComplianceIncident>>;
  getIncidents(criteria: IncidentSearchCriteria): Promise<IntegrationResult<ComplianceIncident[]>>;
  
  // Reporting
  generateComplianceReport(type: ReportType, framework: ComplianceFramework, period: Period): Promise<IntegrationResult<ComplianceReport>>;
  getComplianceStatus(framework?: ComplianceFramework): Promise<IntegrationResult<ComplianceStatus>>;
  getDashboard(): Promise<IntegrationResult<ComplianceDashboard>>;
  
  // Monitoring
  checkCompliance(framework: ComplianceFramework): Promise<IntegrationResult<ComplianceStatus>>;
  validateControl(controlId: string): Promise<IntegrationResult<ControlAssessment>>;
  
  // Metrics
  calculateMetric(metricId: string, period: Period): Promise<IntegrationResult<number>>;
  getMetricHistory(metricId: string, period: Period): Promise<IntegrationResult<MetricHistory[]>>;
  
  // Alerts
  createAlert(alert: ComplianceAlert): Promise<IntegrationResult<ComplianceAlert>>;
  acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<IntegrationResult<void>>;
  getAlerts(acknowledged?: boolean): Promise<IntegrationResult<ComplianceAlert[]>>;
  
  // Configuration
  getComplianceConfig(): Promise<IntegrationResult<ComplianceIntegrationConfig>>;
  updateComplianceConfig(config: Partial<ComplianceIntegrationConfig>): Promise<IntegrationResult<ComplianceIntegrationConfig>>;
}

/**
 * Audit Search Criteria
 */
export interface AuditSearchCriteria {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  outcomes?: AuditEventOutcome[];
  userIds?: string[];
  entityIds?: string[];
  sources?: string[];
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'eventType' | 'outcome';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Incident Search Criteria
 */
export interface IncidentSearchCriteria {
  startDate?: Date;
  endDate?: Date;
  categories?: IncidentCategory[];
  severities?: RiskLevel[];
  statuses?: IncidentStatus[];
  affectedSystems?: string[];
  reportedBy?: string[];
  limit?: number;
  offset?: number;
  orderBy?: 'discoveredDate' | 'reportedDate' | 'severity';
  orderDirection?: 'asc' | 'desc';
}

// Export all types
export type {
  IntegrationResult,
  IntegrationMessage,
  ComplianceService as IComplianceService
};