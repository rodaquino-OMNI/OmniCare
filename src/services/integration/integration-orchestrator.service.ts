/**
 * OmniCare EMR - Integration Orchestrator Service
 * Coordinates and manages all integration workflows and service interactions
 */

import { EventEmitter } from 'events';
import logger from '@/utils/logger';
import { hl7IntegrationService } from './hl7/hl7-integration.service';
import { pharmacyIntegrationService } from './pharmacy/pharmacy-integration.service';
import { insuranceIntegrationService } from './insurance/insurance-integration.service';
import { labIntegrationService } from './lab/lab-integration.service';
import { dataMappingService } from './utils/data-mapping.service';
import { integrationErrorHandlingService } from './utils/error-handling.service';
import { integrationUtilityService } from './utils/integration-utility.service';

export interface IntegrationWorkflow {
  id: string;
  name: string;
  description: string;
  type: WorkflowType;
  status: WorkflowStatus;
  priority: WorkflowPriority;
  steps: WorkflowStep[];
  configuration: WorkflowConfiguration;
  triggers: WorkflowTrigger[];
  schedule?: WorkflowSchedule;
  metadata: WorkflowMetadata;
  history: WorkflowExecution[];
  createdAt: Date;
  updatedAt: Date;
  version: string;
}

export enum WorkflowType {
  DATA_SYNC = 'data_sync',
  REAL_TIME = 'real_time',
  BATCH_PROCESSING = 'batch_processing',
  EVENT_DRIVEN = 'event_driven',
  SCHEDULED = 'scheduled',
  MANUAL = 'manual',
  EMERGENCY = 'emergency'
}

export enum WorkflowStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PAUSED = 'paused',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  MAINTENANCE = 'maintenance'
}

export enum WorkflowPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low'
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  order: number;
  service: string;
  operation: string;
  configuration: any;
  dependencies: string[];
  retryConfig?: {
    enabled: boolean;
    maxRetries: number;
    delayMs: number;
  };
  timeoutMs?: number;
  conditions?: StepCondition[];
  errorHandling: 'stop' | 'continue' | 'retry' | 'skip' | 'fallback';
  fallbackStep?: string;
  parallel?: boolean;
}

export enum StepType {
  TRANSFORM = 'transform',
  VALIDATE = 'validate',
  SEND = 'send',
  RECEIVE = 'receive',
  STORE = 'store',
  NOTIFY = 'notify',
  DECISION = 'decision',
  LOOP = 'loop',
  DELAY = 'delay',
  CUSTOM = 'custom'
}

export interface StepCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value: any;
}

export interface WorkflowConfiguration {
  concurrency: {
    maxConcurrentExecutions: number;
    queueSize: number;
  };
  timeout: {
    totalTimeoutMs: number;
    stepTimeoutMs: number;
  };
  retry: {
    enabled: boolean;
    maxRetries: number;
    backoffStrategy: 'exponential' | 'linear' | 'fixed';
    initialDelayMs: number;
  };
  monitoring: {
    enabled: boolean;
    alertOnFailure: boolean;
    alertOnDelay: boolean;
    metricsCollection: boolean;
  };
  dataRetention: {
    keepExecutionHistory: boolean;
    historyRetentionDays: number;
    keepFailedExecutions: boolean;
  };
}

export interface WorkflowTrigger {
  id: string;
  type: TriggerType;
  configuration: any;
  isActive: boolean;
  lastTriggered?: Date;
  triggerCount: number;
}

export enum TriggerType {
  SCHEDULE = 'schedule',
  EVENT = 'event',
  FILE_WATCH = 'file_watch',
  HTTP_REQUEST = 'http_request',
  MESSAGE_QUEUE = 'message_queue',
  DATABASE_CHANGE = 'database_change',
  MANUAL = 'manual'
}

export interface WorkflowSchedule {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  nextRun?: Date;
  lastRun?: Date;
  runCount: number;
}

export interface WorkflowMetadata {
  createdBy: string;
  lastModifiedBy: string;
  tags: string[];
  category: string;
  documentation?: string;
  contacts: string[];
  businessOwner: string;
  technicalOwner: string;
  supportLevel: 'basic' | 'standard' | 'premium' | 'critical';
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  triggeredBy: string;
  triggerType: TriggerType;
  input?: any;
  output?: any;
  steps: StepExecution[];
  errors: ExecutionError[];
  metrics: ExecutionMetrics;
  context: ExecutionContext;
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  RETRYING = 'retrying'
}

export interface StepExecution {
  stepId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  input?: any;
  output?: any;
  error?: any;
  retryCount: number;
  logs: string[];
}

export interface ExecutionError {
  stepId?: string;
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ExecutionMetrics {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  averageStepDuration: number;
  dataTransferred: number;
  resourceUsage: {
    cpu?: number;
    memory?: number;
    network?: number;
  };
}

export interface ExecutionContext {
  correlationId: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  environment: string;
  variables: Record<string, any>;
  permissions?: string[];
}

export interface ServiceRegistry {
  services: Map<string, IntegrationService>;
  healthStatus: Map<string, ServiceHealth>;
  loadBalancing: Map<string, LoadBalancerConfig>;
}

export interface IntegrationService {
  id: string;
  name: string;
  type: string;
  version: string;
  endpoint?: string;
  status: 'available' | 'unavailable' | 'degraded' | 'maintenance';
  capabilities: string[];
  dependencies: string[];
  healthCheckUrl?: string;
  lastHealthCheck?: Date;
  instance?: any;
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  responseTime: number;
  uptime: number;
  errorCount: number;
  details?: any;
}

export interface LoadBalancerConfig {
  strategy: 'round-robin' | 'least-connections' | 'weighted' | 'random';
  instances: string[];
  weights?: Record<string, number>;
}

export class IntegrationOrchestratorService extends EventEmitter {
  private workflows: Map<string, IntegrationWorkflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private serviceRegistry: ServiceRegistry;
  private executionQueue: WorkflowExecution[] = [];
  private isProcessing = false;

  constructor() {
    super();
    this.serviceRegistry = {
      services: new Map(),
      healthStatus: new Map(),
      loadBalancing: new Map()
    };
    
    this.initializeService();
  }

  /**
   * Initialize integration orchestrator service
   */
  private async initializeService(): Promise<void> {
    logger.info('Initializing integration orchestrator service');
    
    // Register built-in services
    await this.registerBuiltInServices();
    
    // Load workflows from storage
    await this.loadWorkflows();
    
    // Start processing queue
    this.startProcessingQueue();
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Create workflow
   */
  async createWorkflow(workflowData: Partial<IntegrationWorkflow>): Promise<IntegrationWorkflow> {
    try {
      logger.debug('Creating integration workflow');

      const workflow: IntegrationWorkflow = {
        id: this.generateWorkflowId(),
        name: workflowData.name!,
        description: workflowData.description!,
        type: workflowData.type!,
        status: WorkflowStatus.INACTIVE,
        priority: workflowData.priority || WorkflowPriority.NORMAL,
        steps: workflowData.steps || [],
        configuration: {
          concurrency: { maxConcurrentExecutions: 5, queueSize: 100 },
          timeout: { totalTimeoutMs: 300000, stepTimeoutMs: 60000 },
          retry: { enabled: true, maxRetries: 3, backoffStrategy: 'exponential', initialDelayMs: 1000 },
          monitoring: { enabled: true, alertOnFailure: true, alertOnDelay: true, metricsCollection: true },
          dataRetention: { keepExecutionHistory: true, historyRetentionDays: 30, keepFailedExecutions: true },
          ...workflowData.configuration
        },
        triggers: workflowData.triggers || [],
        schedule: workflowData.schedule,
        metadata: {
          createdBy: 'system',
          lastModifiedBy: 'system',
          tags: [],
          category: 'integration',
          contacts: [],
          businessOwner: '',
          technicalOwner: '',
          supportLevel: 'standard',
          ...workflowData.metadata
        },
        history: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0'
      };

      // Validate workflow
      await this.validateWorkflow(workflow);

      // Store workflow
      this.workflows.set(workflow.id, workflow);

      this.emit('workflowCreated', workflow);
      logger.info(`Workflow created: ${workflow.id} - ${workflow.name}`);
      
      return workflow;
    } catch (error) {
      logger.error('Failed to create workflow:', error);
      throw new Error(`Workflow creation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute workflow
   */
  async executeWorkflow(
    workflowId: string,
    input?: any,
    context?: Partial<ExecutionContext>
  ): Promise<WorkflowExecution> {
    try {
      const workflow = this.workflows.get(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      if (workflow.status !== WorkflowStatus.ACTIVE) {
        throw new Error(`Workflow is not active: ${workflow.status}`);
      }

      logger.debug(`Executing workflow: ${workflowId}`);

      // Create execution context
      const execution: WorkflowExecution = {
        id: this.generateExecutionId(),
        workflowId,
        status: ExecutionStatus.PENDING,
        startTime: new Date(),
        triggeredBy: context?.userId || 'system',
        triggerType: TriggerType.MANUAL,
        input,
        steps: [],
        errors: [],
        metrics: {
          totalSteps: workflow.steps.length,
          completedSteps: 0,
          failedSteps: 0,
          skippedSteps: 0,
          averageStepDuration: 0,
          dataTransferred: 0,
          resourceUsage: {}
        },
        context: {
          correlationId: integrationUtilityService.generateCorrelationId(),
          environment: process.env.NODE_ENV || 'development',
          variables: {},
          ...context
        }
      };

      // Store execution
      this.executions.set(execution.id, execution);
      workflow.history.push(execution);

      // Add to execution queue
      this.executionQueue.push(execution);

      this.emit('workflowExecutionStarted', execution);
      logger.info(`Workflow execution queued: ${execution.id}`);
      
      return execution;
    } catch (error) {
      logger.error('Failed to execute workflow:', error);
      throw new Error(`Workflow execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process workflow execution
   */
  private async processExecution(execution: WorkflowExecution): Promise<void> {
    try {
      const workflow = this.workflows.get(execution.workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      execution.status = ExecutionStatus.RUNNING;
      logger.debug(`Processing workflow execution: ${execution.id}`);

      let currentData = execution.input;
      const stepExecutions = new Map<string, StepExecution>();

      // Sort steps by order
      const sortedSteps = [...workflow.steps].sort((a, b) => a.order - b.order);

      for (const step of sortedSteps) {
        // Check dependencies
        if (!this.areDependenciesMet(step, stepExecutions)) {
          logger.warn(`Step dependencies not met, skipping: ${step.id}`);
          execution.metrics.skippedSteps++;
          continue;
        }

        // Check conditions
        if (step.conditions && !this.evaluateStepConditions(step.conditions, currentData)) {
          logger.debug(`Step conditions not met, skipping: ${step.id}`);
          execution.metrics.skippedSteps++;
          continue;
        }

        const stepExecution = await this.executeStep(step, currentData, execution.context);
        stepExecutions.set(step.id, stepExecution);
        execution.steps.push(stepExecution);

        if (stepExecution.status === ExecutionStatus.COMPLETED) {
          execution.metrics.completedSteps++;
          currentData = stepExecution.output || currentData;
        } else if (stepExecution.status === ExecutionStatus.FAILED) {
          execution.metrics.failedSteps++;
          
          if (step.errorHandling === 'stop') {
            throw new Error(`Step failed: ${step.name}`);
          } else if (step.errorHandling === 'fallback' && step.fallbackStep) {
            // Execute fallback step
            const fallbackStep = workflow.steps.find(s => s.id === step.fallbackStep);
            if (fallbackStep) {
              const fallbackExecution = await this.executeStep(fallbackStep, currentData, execution.context);
              execution.steps.push(fallbackExecution);
              currentData = fallbackExecution.output || currentData;
            }
          }
        }
      }

      // Complete execution
      execution.status = ExecutionStatus.COMPLETED;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      execution.output = currentData;

      // Calculate metrics
      this.calculateExecutionMetrics(execution);

      this.emit('workflowExecutionCompleted', execution);
      logger.info(`Workflow execution completed: ${execution.id}`);

    } catch (error) {
      execution.status = ExecutionStatus.FAILED;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      
      execution.errors.push({
        code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown execution error',
        details: error,
        timestamp: new Date(),
        severity: 'high'
      });

      this.emit('workflowExecutionFailed', execution);
      logger.error(`Workflow execution failed: ${execution.id}:`, error);
    }
  }

  /**
   * Execute individual step
   */
  private async executeStep(
    step: WorkflowStep,
    input: any,
    context: ExecutionContext
  ): Promise<StepExecution> {
    const stepExecution: StepExecution = {
      stepId: step.id,
      status: ExecutionStatus.RUNNING,
      startTime: new Date(),
      input,
      retryCount: 0,
      logs: []
    };

    try {
      logger.debug(`Executing step: ${step.name} (${step.type})`);

      let result: any;

      switch (step.type) {
        case StepType.TRANSFORM:
          result = await this.executeTransformStep(step, input, context);
          break;
        case StepType.VALIDATE:
          result = await this.executeValidateStep(step, input, context);
          break;
        case StepType.SEND:
          result = await this.executeSendStep(step, input, context);
          break;
        case StepType.RECEIVE:
          result = await this.executeReceiveStep(step, input, context);
          break;
        case StepType.STORE:
          result = await this.executeStoreStep(step, input, context);
          break;
        case StepType.NOTIFY:
          result = await this.executeNotifyStep(step, input, context);
          break;
        case StepType.DECISION:
          result = await this.executeDecisionStep(step, input, context);
          break;
        case StepType.DELAY:
          result = await this.executeDelayStep(step, input, context);
          break;
        case StepType.CUSTOM:
          result = await this.executeCustomStep(step, input, context);
          break;
        default:
          throw new Error(`Unsupported step type: ${step.type}`);
      }

      stepExecution.status = ExecutionStatus.COMPLETED;
      stepExecution.output = result;
      stepExecution.endTime = new Date();
      stepExecution.duration = stepExecution.endTime.getTime() - stepExecution.startTime.getTime();

      logger.debug(`Step completed: ${step.name}`);
      return stepExecution;

    } catch (error) {
      stepExecution.status = ExecutionStatus.FAILED;
      stepExecution.error = error;
      stepExecution.endTime = new Date();
      stepExecution.duration = stepExecution.endTime.getTime() - stepExecution.startTime.getTime();

      logger.error(`Step failed: ${step.name}:`, error);
      return stepExecution;
    }
  }

  /**
   * Execute transform step
   */
  private async executeTransformStep(step: WorkflowStep, input: any, context: ExecutionContext): Promise<any> {
    const mappingContext = {
      sourceSystem: step.configuration.sourceSystem,
      targetSystem: step.configuration.targetSystem,
      transactionId: context.correlationId,
      userId: context.userId
    };

    return dataMappingService.transformData(input, mappingContext);
  }

  /**
   * Execute validate step
   */
  private async executeValidateStep(step: WorkflowStep, input: any, context: ExecutionContext): Promise<any> {
    // TODO: Implement validation logic
    return { isValid: true, data: input };
  }

  /**
   * Execute send step
   */
  private async executeSendStep(step: WorkflowStep, input: any, context: ExecutionContext): Promise<any> {
    const service = this.serviceRegistry.services.get(step.service);
    if (!service || !service.instance) {
      throw new Error(`Service not available: ${step.service}`);
    }

    // Route to appropriate service method
    const method = service.instance[step.operation];
    if (typeof method !== 'function') {
      throw new Error(`Operation not available: ${step.operation} on ${step.service}`);
    }

    return method.call(service.instance, input, step.configuration);
  }

  /**
   * Execute receive step
   */
  private async executeReceiveStep(step: WorkflowStep, input: any, context: ExecutionContext): Promise<any> {
    // TODO: Implement receive logic (e.g., polling, listening)
    return input;
  }

  /**
   * Execute store step
   */
  private async executeStoreStep(step: WorkflowStep, input: any, context: ExecutionContext): Promise<any> {
    // TODO: Implement storage logic
    return input;
  }

  /**
   * Execute notify step
   */
  private async executeNotifyStep(step: WorkflowStep, input: any, context: ExecutionContext): Promise<any> {
    // TODO: Implement notification logic
    return input;
  }

  /**
   * Execute decision step
   */
  private async executeDecisionStep(step: WorkflowStep, input: any, context: ExecutionContext): Promise<any> {
    // TODO: Implement decision logic
    return input;
  }

  /**
   * Execute delay step
   */
  private async executeDelayStep(step: WorkflowStep, input: any, context: ExecutionContext): Promise<any> {
    const delayMs = step.configuration.delayMs || 1000;
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return input;
  }

  /**
   * Execute custom step
   */
  private async executeCustomStep(step: WorkflowStep, input: any, context: ExecutionContext): Promise<any> {
    // TODO: Implement custom step execution
    return input;
  }

  /**
   * Check if step dependencies are met
   */
  private areDependenciesMet(step: WorkflowStep, stepExecutions: Map<string, StepExecution>): boolean {
    return step.dependencies.every(depId => {
      const depExecution = stepExecutions.get(depId);
      return depExecution && depExecution.status === ExecutionStatus.COMPLETED;
    });
  }

  /**
   * Evaluate step conditions
   */
  private evaluateStepConditions(conditions: StepCondition[], data: any): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getNestedValue(data, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not_equals':
          return fieldValue !== condition.value;
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'greater_than':
          return Number(fieldValue) > Number(condition.value);
        case 'less_than':
          return Number(fieldValue) < Number(condition.value);
        case 'exists':
          return fieldValue !== undefined && fieldValue !== null;
        default:
          return false;
      }
    });
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Calculate execution metrics
   */
  private calculateExecutionMetrics(execution: WorkflowExecution): void {
    const completedSteps = execution.steps.filter(s => s.status === ExecutionStatus.COMPLETED);
    
    if (completedSteps.length > 0) {
      execution.metrics.averageStepDuration = completedSteps.reduce(
        (sum, step) => sum + (step.duration || 0), 0
      ) / completedSteps.length;
    }
  }

  /**
   * Validate workflow
   */
  private async validateWorkflow(workflow: IntegrationWorkflow): Promise<void> {
    const errors: string[] = [];

    // Basic validation
    if (!workflow.name) errors.push('Workflow name is required');
    if (!workflow.steps || workflow.steps.length === 0) errors.push('At least one step is required');

    // Step validation
    workflow.steps.forEach((step, index) => {
      if (!step.name) errors.push(`Step ${index}: name is required`);
      if (!step.service) errors.push(`Step ${index}: service is required`);
      if (!step.operation) errors.push(`Step ${index}: operation is required`);
      
      // Check if service exists
      if (!this.serviceRegistry.services.has(step.service)) {
        errors.push(`Step ${index}: service not found: ${step.service}`);
      }
    });

    if (errors.length > 0) {
      throw new Error(`Workflow validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Register built-in services
   */
  private async registerBuiltInServices(): Promise<void> {
    // Register HL7 service
    this.serviceRegistry.services.set('hl7', {
      id: 'hl7',
      name: 'HL7 Integration Service',
      type: 'integration',
      version: '1.0',
      status: 'available',
      capabilities: ['parse', 'generate', 'transform', 'send', 'receive'],
      dependencies: [],
      instance: hl7IntegrationService
    });

    // Register pharmacy service
    this.serviceRegistry.services.set('pharmacy', {
      id: 'pharmacy',
      name: 'Pharmacy Integration Service',
      type: 'integration',
      version: '1.0',
      status: 'available',
      capabilities: ['prescription', 'refill', 'status', 'search'],
      dependencies: [],
      instance: pharmacyIntegrationService
    });

    // Register insurance service
    this.serviceRegistry.services.set('insurance', {
      id: 'insurance',
      name: 'Insurance Integration Service',
      type: 'integration',
      version: '1.0',
      status: 'available',
      capabilities: ['eligibility', 'claims', 'prior-auth', 'formulary'],
      dependencies: [],
      instance: insuranceIntegrationService
    });

    // Register lab service
    this.serviceRegistry.services.set('lab', {
      id: 'lab',
      name: 'Lab Integration Service',
      type: 'integration',
      version: '1.0',
      status: 'available',
      capabilities: ['orders', 'results', 'critical-values', 'search'],
      dependencies: [],
      instance: labIntegrationService
    });

    logger.info('Built-in services registered');
  }

  /**
   * Load workflows from storage
   */
  private async loadWorkflows(): Promise<void> {
    // TODO: Load from database or configuration files
    logger.info('Workflows loaded from storage');
  }

  /**
   * Start processing queue
   */
  private startProcessingQueue(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    
    const processNext = async () => {
      if (this.executionQueue.length > 0) {
        const execution = this.executionQueue.shift()!;
        try {
          await this.processExecution(execution);
        } catch (error) {
          logger.error('Failed to process execution:', error);
        }
      }
      
      // Continue processing
      setTimeout(processNext, 100);
    };

    processNext();
    logger.info('Execution queue processing started');
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.performHealthChecks();
    }, 60000); // Check every minute

    logger.info('Health monitoring started');
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    for (const [serviceId, service] of this.serviceRegistry.services.entries()) {
      try {
        const startTime = Date.now();
        
        // Get health status from service
        let health: any;
        if (service.instance && typeof service.instance.getHealthStatus === 'function') {
          health = service.instance.getHealthStatus();
        } else {
          health = { status: 'UP' };
        }

        const responseTime = Date.now() - startTime;
        
        this.serviceRegistry.healthStatus.set(serviceId, {
          status: health.status === 'UP' ? 'healthy' : 'unhealthy',
          lastCheck: new Date(),
          responseTime,
          uptime: 0, // TODO: Calculate uptime
          errorCount: 0, // TODO: Track error count
          details: health.details
        });

        // Update service status
        service.status = health.status === 'UP' ? 'available' : 'degraded';
        service.lastHealthCheck = new Date();

      } catch (error) {
        logger.warn(`Health check failed for service ${serviceId}:`, error);
        
        this.serviceRegistry.healthStatus.set(serviceId, {
          status: 'unhealthy',
          lastCheck: new Date(),
          responseTime: 0,
          uptime: 0,
          errorCount: 0,
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        });

        const service = this.serviceRegistry.services.get(serviceId);
        if (service) {
          service.status = 'unavailable';
        }
      }
    }
  }

  /**
   * Generate unique IDs
   */
  private generateWorkflowId(): string {
    return `wf_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): IntegrationWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get service health status
   */
  getServiceHealth(serviceId?: string): ServiceHealth | Map<string, ServiceHealth> {
    if (serviceId) {
      return this.serviceRegistry.healthStatus.get(serviceId)!;
    }
    return this.serviceRegistry.healthStatus;
  }

  /**
   * Get orchestrator health status
   */
  getHealthStatus(): { status: string; details: any } {
    const totalServices = this.serviceRegistry.services.size;
    const healthyServices = Array.from(this.serviceRegistry.healthStatus.values())
      .filter(h => h.status === 'healthy').length;
    
    const queueSize = this.executionQueue.length;
    const runningExecutions = Array.from(this.executions.values())
      .filter(e => e.status === ExecutionStatus.RUNNING).length;

    const overallHealthy = healthyServices === totalServices && queueSize < 100;

    return {
      status: overallHealthy ? 'UP' : 'DEGRADED',
      details: {
        totalServices,
        healthyServices,
        queueSize,
        runningExecutions,
        totalWorkflows: this.workflows.size,
        totalExecutions: this.executions.size
      }
    };
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.removeAllListeners();
    this.isProcessing = false;
    this.workflows.clear();
    this.executions.clear();
    this.executionQueue = [];
    this.serviceRegistry.services.clear();
    this.serviceRegistry.healthStatus.clear();
    logger.info('Integration orchestrator service shut down');
  }
}

// Export singleton instance
export const integrationOrchestratorService = new IntegrationOrchestratorService();