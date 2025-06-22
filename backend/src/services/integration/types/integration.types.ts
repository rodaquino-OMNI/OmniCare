/**
 * Core Integration Types
 * Common types and interfaces for all integration services
 */

// Integration Status Enum
export enum IntegrationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  ERROR = 'error',
  MAINTENANCE = 'maintenance',
  SUSPENDED = 'suspended',
  DEPRECATED = 'deprecated'
}

// Integration Type Enum
export enum IntegrationType {
  FHIR = 'fhir',
  HL7V2 = 'hl7v2',
  DIRECT = 'direct',
  X12 = 'x12',
  NCPDP = 'ncpdp',
  CDA = 'cda',
  CCDA = 'ccda',
  CUSTOM = 'custom',
  WEBHOOK = 'webhook',
  API_REST = 'api-rest',
  API_GRAPHQL = 'api-graphql',
  FILE_BASED = 'file-based'
}

// Integration Method Enum
export enum IntegrationMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  SUBSCRIBE = 'SUBSCRIBE',
  PUBLISH = 'PUBLISH',
  QUERY = 'QUERY',
  MUTATION = 'MUTATION'
}

// Integration Protocol Enum
export enum IntegrationProtocol {
  HTTP = 'http',
  HTTPS = 'https',
  TCP = 'tcp',
  MLLP = 'mllp',
  SFTP = 'sftp',
  FTPS = 'ftps',
  WEBSOCKET = 'websocket',
  AMQP = 'amqp',
  KAFKA = 'kafka',
  MQTT = 'mqtt',
  STOMP = 'stomp'
}

// Integration Direction Enum
export enum IntegrationDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  BIDIRECTIONAL = 'bidirectional'
}

// Integration Priority Enum
export enum IntegrationPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  ROUTINE = 'routine'
}

// Integration Security Enum
export enum IntegrationSecurity {
  TLS = 'tls',
  MUTUAL_TLS = 'mutual-tls',
  OAUTH2 = 'oauth2',
  SAML = 'saml',
  API_KEY = 'api-key',
  JWT = 'jwt',
  BASIC_AUTH = 'basic-auth',
  CERTIFICATE = 'certificate',
  NONE = 'none'
}

// Integration Transport Enum
export enum IntegrationTransport {
  REST = 'rest',
  SOAP = 'soap',
  GRAPHQL = 'graphql',
  MESSAGING = 'messaging',
  FILE = 'file',
  STREAM = 'stream',
  BATCH = 'batch',
  REALTIME = 'realtime'
}

// Integration Format Enum
export enum IntegrationFormat {
  JSON = 'json',
  XML = 'xml',
  HL7 = 'hl7',
  CSV = 'csv',
  FIXED_WIDTH = 'fixed-width',
  BINARY = 'binary',
  FHIR_JSON = 'fhir-json',
  FHIR_XML = 'fhir-xml',
  CDA = 'cda',
  CCDA = 'ccda',
  X12 = 'x12',
  NCPDP = 'ncpdp'
}

// Integration Encoding Enum
export enum IntegrationEncoding {
  UTF8 = 'utf-8',
  UTF16 = 'utf-16',
  ASCII = 'ascii',
  BASE64 = 'base64',
  HEX = 'hex',
  BINARY = 'binary',
  ISO_8859_1 = 'iso-8859-1'
}

// Integration Compression Enum
export enum IntegrationCompression {
  NONE = 'none',
  GZIP = 'gzip',
  DEFLATE = 'deflate',
  BROTLI = 'brotli',
  LZ4 = 'lz4',
  SNAPPY = 'snappy',
  ZSTD = 'zstd'
}

// Integration Authentication Interface
export interface IntegrationAuthentication {
  type: IntegrationSecurity;
  credentials?: {
    username?: string;
    password?: string;
    apiKey?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
    privateKey?: string;
    certificate?: string;
    passphrase?: string;
  };
  tokenEndpoint?: string;
  scope?: string[];
  audience?: string;
  issuer?: string;
  expiresIn?: number;
  refreshToken?: string;
}

// Integration Encryption Interface
export interface IntegrationEncryption {
  enabled: boolean;
  algorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'RSA-OAEP' | 'ChaCha20-Poly1305';
  keyId?: string;
  publicKey?: string;
  privateKey?: string;
  iv?: string;
  aad?: string;
  keyDerivation?: {
    algorithm: 'PBKDF2' | 'Argon2' | 'Scrypt';
    iterations?: number;
    salt?: string;
  };
}

// Integration Validation Interface
export interface IntegrationValidation {
  enabled: boolean;
  schemaType: 'json-schema' | 'xml-schema' | 'fhir' | 'hl7v2' | 'custom';
  schemaUrl?: string;
  schemaVersion?: string;
  strictMode?: boolean;
  customRules?: ValidationRule[];
  skipFields?: string[];
}

export interface ValidationRule {
  field: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

// Integration Transformation Interface
export interface IntegrationTransformation {
  enabled: boolean;
  engine: 'jsonata' | 'jolt' | 'javascript' | 'xslt' | 'custom';
  sourceFormat: IntegrationFormat;
  targetFormat: IntegrationFormat;
  mappingUrl?: string;
  mappingScript?: string;
  options?: Record<string, any>;
}

// Integration Routing Interface
export interface IntegrationRouting {
  enabled: boolean;
  strategy: 'round-robin' | 'weighted' | 'priority' | 'content-based' | 'header-based';
  routes: Route[];
  fallbackRoute?: string;
  retryOnFailure?: boolean;
  circuitBreaker?: CircuitBreakerConfig;
}

export interface Route {
  id: string;
  name: string;
  endpoint: string;
  weight?: number;
  priority?: number;
  condition?: RouteCondition;
  active: boolean;
}

export interface RouteCondition {
  field: string;
  operator: 'equals' | 'contains' | 'regex' | 'greater-than' | 'less-than';
  value: any;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  threshold: number;
  timeout: number;
  resetTime: number;
  halfOpenRequests: number;
}

// Integration Logging Interface
export interface IntegrationLogging {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  destination: 'console' | 'file' | 'elasticsearch' | 'cloudwatch' | 'datadog';
  format: 'json' | 'text' | 'structured';
  includePayload?: boolean;
  includeHeaders?: boolean;
  maskSensitiveData?: boolean;
  retentionDays?: number;
  customFields?: Record<string, any>;
}

// Integration Monitoring Interface
export interface IntegrationMonitoring {
  enabled: boolean;
  metricsEnabled: boolean;
  tracingEnabled: boolean;
  healthCheckInterval: number;
  alerting?: AlertingConfig;
  metrics?: MetricsConfig;
  tracing?: TracingConfig;
}

export interface AlertingConfig {
  enabled: boolean;
  channels: AlertChannel[];
  rules: AlertRule[];
}

export interface AlertChannel {
  type: 'email' | 'sms' | 'slack' | 'pagerduty' | 'webhook';
  endpoint: string;
  credentials?: Record<string, string>;
}

export interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  duration: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  channels: string[];
}

export interface MetricsConfig {
  provider: 'prometheus' | 'cloudwatch' | 'datadog' | 'newrelic';
  endpoint?: string;
  interval: number;
  customMetrics?: string[];
}

export interface TracingConfig {
  provider: 'jaeger' | 'zipkin' | 'xray' | 'datadog';
  endpoint?: string;
  samplingRate: number;
}

// Integration Handler Map Type
export type IntegrationHandlerMap = Map<string, MessageHandler>;

// Integration Service Map Type
export type IntegrationServiceMap = Map<string, IntegrationService>;

// Integration Protocol Handlers Interface
export interface IntegrationProtocolHandlers {
  [IntegrationProtocol.HTTP]: HttpProtocolHandler;
  [IntegrationProtocol.HTTPS]: HttpsProtocolHandler;
  [IntegrationProtocol.TCP]: TcpProtocolHandler;
  [IntegrationProtocol.MLLP]: MllpProtocolHandler;
  [IntegrationProtocol.WEBSOCKET]: WebSocketProtocolHandler;
  [protocol: string]: ProtocolHandler;
}

// Base Protocol Handler Interface
export interface ProtocolHandler {
  name: string;
  protocol: IntegrationProtocol;
  connect(config: IntegrationConfig): Promise<void>;
  disconnect(): Promise<void>;
  send(message: IntegrationMessage): Promise<IntegrationResult>;
  receive(): Promise<IntegrationMessage>;
  isConnected(): boolean;
}

// Specific Protocol Handlers
export interface HttpProtocolHandler extends ProtocolHandler {
  protocol: IntegrationProtocol.HTTP;
  setHeaders(headers: Record<string, string>): void;
  setTimeout(timeout: number): void;
}

export interface HttpsProtocolHandler extends ProtocolHandler {
  protocol: IntegrationProtocol.HTTPS;
  setHeaders(headers: Record<string, string>): void;
  setTimeout(timeout: number): void;
  setCertificates(certs: any): void;
}

export interface TcpProtocolHandler extends ProtocolHandler {
  protocol: IntegrationProtocol.TCP;
  setKeepAlive(enabled: boolean, delay?: number): void;
}

export interface MllpProtocolHandler extends ProtocolHandler {
  protocol: IntegrationProtocol.MLLP;
  setStartBlock(startBlock: string): void;
  setEndBlock(endBlock: string): void;
}

export interface WebSocketProtocolHandler extends ProtocolHandler {
  protocol: IntegrationProtocol.WEBSOCKET;
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
  onMessage(handler: (message: any) => void): void;
}

// Integration Transformers Interface
export interface IntegrationTransformers {
  [IntegrationFormat.JSON]: JsonTransformer;
  [IntegrationFormat.XML]: XmlTransformer;
  [IntegrationFormat.HL7]: Hl7Transformer;
  [IntegrationFormat.FHIR_JSON]: FhirJsonTransformer;
  [IntegrationFormat.FHIR_XML]: FhirXmlTransformer;
  [format: string]: DataTransformer;
}

// Base Data Transformer Interface
export interface DataTransformer {
  name: string;
  sourceFormat: IntegrationFormat;
  targetFormat: IntegrationFormat;
  transform(data: any, options?: TransformOptions): Promise<any>;
  validate(data: any): Promise<ValidationResult>;
}

export interface TransformOptions {
  mapping?: any;
  schema?: any;
  strict?: boolean;
  customFunctions?: Record<string, Function>;
}

// Specific Transformers
export interface JsonTransformer extends DataTransformer {
  sourceFormat: IntegrationFormat.JSON;
  parse(jsonString: string): any;
  stringify(data: any, pretty?: boolean): string;
}

export interface XmlTransformer extends DataTransformer {
  sourceFormat: IntegrationFormat.XML;
  parse(xmlString: string): any;
  build(data: any): string;
}

export interface Hl7Transformer extends DataTransformer {
  sourceFormat: IntegrationFormat.HL7;
  parseMessage(hl7String: string): any;
  buildMessage(data: any): string;
}

export interface FhirJsonTransformer extends DataTransformer {
  sourceFormat: IntegrationFormat.FHIR_JSON;
  toBundle(resources: any[]): any;
  fromBundle(bundle: any): any[];
}

export interface FhirXmlTransformer extends DataTransformer {
  sourceFormat: IntegrationFormat.FHIR_XML;
  toBundle(resources: any[]): string;
  fromBundle(bundleXml: string): any[];
}

// Integration Validators Interface
export interface IntegrationValidators {
  [IntegrationFormat.JSON]: JsonValidator;
  [IntegrationFormat.XML]: XmlValidator;
  [IntegrationFormat.HL7]: Hl7Validator;
  [IntegrationFormat.FHIR_JSON]: FhirValidator;
  [IntegrationFormat.FHIR_XML]: FhirValidator;
  [format: string]: FormatValidator;
}

// Base Format Validator Interface
export interface FormatValidator {
  name: string;
  format: IntegrationFormat;
  validate(data: any, schema?: any): Promise<ValidationResult>;
  validateSchema(schema: any): boolean;
}

// Specific Validators
export interface JsonValidator extends FormatValidator {
  format: IntegrationFormat.JSON;
  validateJsonSchema(data: any, schema: any): ValidationResult;
}

export interface XmlValidator extends FormatValidator {
  format: IntegrationFormat.XML;
  validateXsd(xmlData: string, xsdSchema: string): ValidationResult;
}

export interface Hl7Validator extends FormatValidator {
  format: IntegrationFormat.HL7;
  validateSegment(segment: string): ValidationResult;
  validateMessage(message: string): ValidationResult;
}

export interface FhirValidator extends FormatValidator {
  format: IntegrationFormat.FHIR_JSON | IntegrationFormat.FHIR_XML;
  validateResource(resource: any): ValidationResult;
  validateProfile(resource: any, profileUrl: string): ValidationResult;
}

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

// Validation Result
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
  warnings?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

// Data Transformation Engine
export interface DataTransformationEngine {
  addRule(rule: TransformationRule): void;
  removeRule(ruleId: string): void;
  transform(data: any, sourceFormat: string, targetFormat: string): Promise<any>;
  validate(data: any, schema: string): Promise<ValidationResult>;
  getRules(): TransformationRule[];
}