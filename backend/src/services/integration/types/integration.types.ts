/**
 * Core Integration Types
 * Common types and interfaces for all integration services
 */

// Base Integration Result
export interface IntegrationResult<T = any> {
  success: boolean;
  data?: T;
  error?: IntegrationError;
  metadata?: IntegrationMetadata;
  timestamp?: Date;
}

// Integration Error
export interface IntegrationError {
  code: string;
  message: string;
  details?: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  timestamp: Date;
}

// Integration Metadata
export interface IntegrationMetadata {
  requestId: string;
  correlationId?: string;
  source: string;
  destination: string;
  messageType: string;
  version: string;
  timestamp: Date;
  retryCount?: number;
  processingTime?: number;
}

// Integration Configuration
export interface IntegrationConfig {
  enabled: boolean;
  endpoint: string;
  timeout: number;
  retryAttempts: number;
  retryDelayMs: number;
  authentication?: AuthenticationConfig;
  headers?: Record<string, string>;
  customSettings?: Record<string, any>;
}

// Authentication Configuration
export interface AuthenticationConfig {
  type: 'basic' | 'bearer' | 'oauth2' | 'mutual-tls' | 'custom';
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
    scope?: string;
    tokenUrl?: string;
  };
  certificates?: {
    clientCert?: string;
    clientKey?: string;
    caCert?: string;
  };
}

// Message Status
export enum MessageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  RETRY = 'retry',
  CANCELLED = 'cancelled'
}

// Integration Message
export interface IntegrationMessage {
  id: string;
  correlationId?: string;
  messageType: string;
  source: string;
  destination: string;
  payload: any;
  headers?: Record<string, string>;
  status: MessageStatus;
  created: Date;
  updated: Date;
  retryCount: number;
  maxRetries: number;
  nextRetry?: Date;
  error?: IntegrationError;
}

// Integration Validation Result
export interface IntegrationValidationResult {
  valid: boolean;
  errors: IntegrationValidationError[];
  warnings: ValidationWarning[];
  schemaVersion?: string;
  validatedAt: Date;
}

export interface IntegrationValidationError {
  path: string;
  message: string;
  code: string;
  severity: 'error' | 'fatal';
  value?: any;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
  severity: 'warning' | 'info';
  value?: any;
}

// Transformation Rules
export interface TransformationRule {
  id: string;
  name: string;
  sourceFormat: string;
  targetFormat: string;
  mapping: FieldMappingRule[];
  conditions?: TransformationCondition[];
  active: boolean;
}

export interface FieldMappingRule {
  sourceField: string;
  targetField: string;
  transformation?: string; // JavaScript function as string
  defaultValue?: any;
  required: boolean;
}

export interface TransformationCondition {
  field: string;
  operator: 'equals' | 'not-equals' | 'contains' | 'regex' | 'exists';
  value: any;
  action: 'include' | 'exclude' | 'transform';
}

// Integration Pattern Types
export enum IntegrationPattern {
  REQUEST_RESPONSE = 'request-response',
  PUBLISH_SUBSCRIBE = 'publish-subscribe',
  MESSAGE_QUEUE = 'message-queue',
  BATCH_PROCESSING = 'batch-processing',
  STREAMING = 'streaming',
  WEBHOOK = 'webhook'
}

// Connection Health
export interface ConnectionHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
  errorCount: number;
  uptime: number;
  details?: Record<string, any>;
}

// Integration Statistics
export interface IntegrationStatistics {
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  averageProcessingTime: number;
  errorRate: number;
  throughput: number;
  lastActivity: Date;
  connectionHealth: ConnectionHealth;
}

// Audit Event
export interface IntegrationAuditEvent {
  id: string;
  eventType: string;
  source: string;
  destination?: string;
  userId?: string;
  messageId?: string;
  action: string;
  result: 'success' | 'failure' | 'warning';
  details?: any;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// Compliance Status
export interface ComplianceStatus {
  standard: string;
  version: string;
  compliant: boolean;
  lastAssessment: Date;
  expiresAt?: Date;
  certificationId?: string;
  findings: ComplianceFinding[];
  score?: number;
}

export interface ComplianceFinding {
  ruleId: string;
  ruleName: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'pass' | 'fail' | 'warning' | 'not-applicable';
  description: string;
  remediation?: string;
  evidence?: any;
}

// Rate Limiting
export interface RateLimitConfig {
  enabled: boolean;
  requestsPerMinute: number;
  requestsPerHour: number;
  burstSize: number;
  backoffStrategy: 'exponential' | 'linear' | 'constant';
}

// Cache Configuration
export interface CacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  maxSize: number;
  strategy: 'LRU' | 'LFU' | 'TTL';
  compressionEnabled?: boolean;
}

// Integration Service Interface
export interface IntegrationService {
  name: string;
  version: string;
  initialize(): Promise<void>;
  configure(config: IntegrationConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getHealth(): Promise<ConnectionHealth>;
  getStatistics(): Promise<IntegrationStatistics>;
  processMessage(message: IntegrationMessage): Promise<IntegrationResult>;
}

// Event Handlers
export type MessageHandler = (message: IntegrationMessage) => Promise<IntegrationResult>;
export type ErrorHandler = (error: IntegrationError, message?: IntegrationMessage) => Promise<void>;
export type SuccessHandler = (result: IntegrationResult, message: IntegrationMessage) => Promise<void>;

// Service Registry
export interface ServiceRegistry {
  register(service: IntegrationService): void;
  unregister(serviceName: string): void;
  getService(serviceName: string): IntegrationService | undefined;
  getAllServices(): IntegrationService[];
  getServiceHealth(serviceName: string): Promise<ConnectionHealth>;
}

// Message Router
export interface MessageRouter {
  addRoute(pattern: string, handler: MessageHandler): void;
  removeRoute(pattern: string): void;
  route(message: IntegrationMessage): Promise<IntegrationResult>;
  getRoutes(): string[];
}

// Data Transformation Engine
export interface DataTransformationEngine {
  addRule(rule: TransformationRule): void;
  removeRule(ruleId: string): void;
  transform(data: any, sourceFormat: string, targetFormat: string): Promise<any>;
  validate(data: any, schema: string): Promise<ValidationResult>;
  getRules(): TransformationRule[];
}