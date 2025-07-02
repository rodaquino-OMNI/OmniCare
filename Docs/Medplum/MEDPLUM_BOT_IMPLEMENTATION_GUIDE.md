# Medplum Bot System Implementation Guide for OmniCare

## Overview

This guide provides a detailed implementation plan for adopting Medplum's bot automation pattern in OmniCare, transforming the current task-based workflow system into an event-driven, serverless automation platform.

## Current State vs Proposed State

### Current: Task-Based Workflows
```typescript
// Current implementation in fhir-task.service.ts
async createMedicationOrderWorkflow(
  medicationRequestId: string,
  patientId: string,
  prescriberId: string,
  pharmacistId?: string
): Promise<Task[]> {
  const tasks: Task[] = [];
  // Manual task creation with dependencies
  const reviewTask = await this.createTask({...});
  const dispensingTask = await this.createTask({...});
  const educationTask = await this.createTask({...});
  return tasks;
}
```

### Proposed: Event-Driven Bots
```typescript
// Proposed bot implementation
export const medicationOrderBot: Bot = {
  name: 'medication-order-bot',
  trigger: {
    resourceType: 'MedicationRequest',
    event: ['create', 'update']
  },
  handler: async (event: BotEvent) => {
    const medication = event.resource as MedicationRequest;
    
    // Automatic workflow orchestration
    await Promise.all([
      createPharmacyReviewTask(medication),
      checkInsuranceEligibility(medication),
      sendPrescriptionToPharmacy(medication)
    ]);
  }
};
```

## Architecture Design

### Core Components

#### 1. Bot Engine
```typescript
// bot-engine.service.ts
export class BotEngine {
  private bots: Map<string, Bot> = new Map();
  private executionQueue: BotExecutionQueue;
  
  async registerBot(bot: Bot): Promise<void> {
    this.bots.set(bot.name, bot);
    await this.createSubscription(bot.trigger);
  }
  
  async executeBotAsync(botName: string, event: BotEvent): Promise<void> {
    const bot = this.bots.get(botName);
    if (!bot) throw new Error(`Bot ${botName} not found`);
    
    // Queue for async execution
    await this.executionQueue.enqueue({
      bot,
      event,
      retryCount: 0,
      maxRetries: bot.maxRetries || 3
    });
  }
  
  private async createSubscription(trigger: BotTrigger): Promise<void> {
    await medplumService.createSubscription(
      trigger.resourceType,
      'rest-hook',
      `${config.baseUrl}/bots/webhook`
    );
  }
}
```

#### 2. Bot Definition Interface
```typescript
// types/bot.types.ts
export interface Bot {
  name: string;
  description?: string;
  version: string;
  trigger: BotTrigger;
  handler: BotHandler;
  config?: BotConfig;
  maxRetries?: number;
  timeout?: number;
}

export interface BotTrigger {
  resourceType: string | string[];
  event: ('create' | 'update' | 'delete')[];
  criteria?: string; // FHIR search criteria
}

export interface BotEvent {
  id: string;
  timestamp: Date;
  resource: Resource;
  previousResource?: Resource;
  action: 'create' | 'update' | 'delete';
  metadata: Record<string, unknown>;
}

export type BotHandler = (event: BotEvent) => Promise<BotResult>;

export interface BotResult {
  success: boolean;
  outputs?: Resource[];
  logs?: string[];
  error?: string;
}
```

#### 3. Bot Execution Queue
```typescript
// bot-execution-queue.service.ts
export class BotExecutionQueue {
  private queue: Bull.Queue<BotJob>;
  
  constructor() {
    this.queue = new Bull('bot-execution', {
      redis: config.redis,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });
    
    this.setupWorkers();
  }
  
  private setupWorkers(): void {
    this.queue.process('execute-bot', async (job) => {
      const { bot, event } = job.data;
      
      try {
        // Execute with timeout
        const result = await Promise.race([
          bot.handler(event),
          this.timeout(bot.timeout || 30000)
        ]);
        
        // Log execution
        await this.logExecution(bot, event, result);
        
        return result;
      } catch (error) {
        await this.handleError(bot, event, error);
        throw error;
      }
    });
  }
}
```

### Sample Bot Implementations

#### 1. Lab Results Bot
```typescript
// bots/lab-results.bot.ts
export const labResultsBot: Bot = {
  name: 'lab-results-processor',
  version: '1.0.0',
  trigger: {
    resourceType: 'DiagnosticReport',
    event: ['create', 'update'],
    criteria: 'status=final'
  },
  handler: async (event: BotEvent) => {
    const report = event.resource as DiagnosticReport;
    const outputs: Resource[] = [];
    
    // Check for critical values
    const criticalValues = await checkCriticalValues(report);
    if (criticalValues.length > 0) {
      // Create urgent task for provider
      const task = await createUrgentReviewTask(report, criticalValues);
      outputs.push(task);
      
      // Send alert
      await sendCriticalValueAlert(report, criticalValues);
    }
    
    // Update patient chart
    await updatePatientChart(report);
    
    // Notify ordering provider
    const notification = await createProviderNotification(report);
    outputs.push(notification);
    
    return {
      success: true,
      outputs,
      logs: [`Processed lab results for patient ${report.subject?.reference}`]
    };
  }
};
```

#### 2. Insurance Eligibility Bot
```typescript
// bots/insurance-eligibility.bot.ts
export const insuranceEligibilityBot: Bot = {
  name: 'insurance-eligibility-checker',
  version: '1.0.0',
  trigger: {
    resourceType: ['ServiceRequest', 'MedicationRequest'],
    event: ['create']
  },
  handler: async (event: BotEvent) => {
    const request = event.resource;
    
    // Get patient insurance
    const coverage = await getPatientCoverage(request.subject);
    if (!coverage) {
      return {
        success: true,
        logs: ['No insurance coverage found']
      };
    }
    
    // Check eligibility via X12 270/271
    const eligibilityResponse = await checkEligibility({
      patient: request.subject,
      coverage,
      service: request
    });
    
    // Create eligibility determination
    const determination = createEligibilityDetermination(
      request,
      eligibilityResponse
    );
    
    // Update request with insurance info
    await updateRequestWithInsurance(request, determination);
    
    return {
      success: true,
      outputs: [determination],
      logs: [`Eligibility check completed: ${determination.status}`]
    };
  }
};
```

#### 3. Appointment Reminder Bot
```typescript
// bots/appointment-reminder.bot.ts
export const appointmentReminderBot: Bot = {
  name: 'appointment-reminder',
  version: '1.0.0',
  trigger: {
    resourceType: 'Appointment',
    event: ['create', 'update'],
    criteria: 'status=booked'
  },
  config: {
    reminderIntervals: [
      { days: 7, method: 'email' },
      { days: 2, method: 'sms' },
      { hours: 24, method: 'sms' }
    ]
  },
  handler: async (event: BotEvent) => {
    const appointment = event.resource as Appointment;
    
    // Schedule reminders
    const reminders = await scheduleReminders(
      appointment,
      event.bot.config.reminderIntervals
    );
    
    // Create communication records
    const communications = reminders.map(reminder =>
      createCommunicationRecord(appointment, reminder)
    );
    
    return {
      success: true,
      outputs: communications,
      logs: [`Scheduled ${reminders.length} reminders`]
    };
  }
};
```

## Migration Strategy

### Phase 1: Infrastructure Setup (Week 1-2)

#### Tasks:
1. **Create Bot Engine Service**
   ```typescript
   // backend/src/services/bot-engine.service.ts
   - Implement bot registration
   - Setup execution queue
   - Add webhook endpoint
   - Create logging system
   ```

2. **Setup FHIR Subscriptions**
   ```typescript
   // Extend existing subscription service
   - Add bot trigger support
   - Implement webhook handler
   - Add retry logic
   ```

3. **Create Bot Development Kit**
   ```typescript
   // backend/src/bots/sdk/index.ts
   - Helper functions
   - Testing utilities
   - Common patterns
   ```

### Phase 2: Pilot Implementation (Week 3-4)

#### Migrate First Workflow:
```typescript
// Before: Task-based medication workflow
async createMedicationOrderWorkflow() {
  // 200+ lines of orchestration code
}

// After: Event-driven bot
export const medicationOrderBot: Bot = {
  // 50 lines of focused logic
};
```

#### Create Bot Management UI:
```typescript
// frontend/src/components/admin/BotManagement.tsx
export function BotManagement() {
  return (
    <div>
      <BotList />
      <BotExecutionHistory />
      <BotConfiguration />
    </div>
  );
}
```

### Phase 3: Full Migration (Week 5-8)

#### Workflow Migration Plan:
| Current Workflow | Bot Name | Priority | Complexity |
|-----------------|----------|----------|------------|
| Medication Order | medication-order-bot | High | Medium |
| Lab Order | lab-order-bot | High | Low |
| Referral | referral-bot | Medium | High |
| Insurance Auth | insurance-auth-bot | Medium | High |
| Appointment | appointment-bot | Low | Low |

## Integration with Existing Systems

### 1. Leverage Existing Services
```typescript
// Bots can use all existing services
export const labResultBot: Bot = {
  handler: async (event) => {
    // Use existing services
    await auditService.log(event);
    await notificationService.send(...);
    await fhirTaskService.createTask(...);
  }
};
```

### 2. Maintain Backward Compatibility
```typescript
// Adapter for existing task-based workflows
export class TaskBotAdapter {
  async executeTaskWorkflow(workflowName: string, params: any) {
    // Convert to bot event
    const event = this.convertToEvent(params);
    
    // Execute via bot engine
    return await botEngine.execute(workflowName, event);
  }
}
```

### 3. Gradual Feature Flags
```typescript
// Enable bots per workflow
if (featureFlags.isEnabled('bot.medication-order')) {
  await botEngine.execute('medication-order-bot', event);
} else {
  await fhirTaskService.createMedicationOrderWorkflow(...);
}
```

## Performance Considerations

### 1. Execution Isolation
```typescript
// Run bots in isolated contexts
export class BotSandbox {
  async execute(bot: Bot, event: BotEvent): Promise<BotResult> {
    const vm = new VM({
      timeout: bot.timeout || 30000,
      sandbox: {
        // Limited API access
        fhir: this.sandboxedFhirClient,
        logger: this.sandboxedLogger
      }
    });
    
    return vm.run(bot.handler, event);
  }
}
```

### 2. Resource Limits
```typescript
// Implement resource constraints
export const botConfig = {
  maxConcurrentExecutions: 10,
  maxExecutionTime: 30000, // 30 seconds
  maxMemoryUsage: 256 * 1024 * 1024, // 256MB
  maxOutputSize: 10 * 1024 * 1024 // 10MB
};
```

### 3. Monitoring & Metrics
```typescript
// Track bot performance
export class BotMetrics {
  async recordExecution(bot: Bot, duration: number, success: boolean) {
    await prometheus.histogram('bot_execution_duration', duration, {
      bot: bot.name,
      success: success.toString()
    });
    
    await prometheus.counter('bot_executions_total', 1, {
      bot: bot.name,
      status: success ? 'success' : 'failure'
    });
  }
}
```

## Testing Strategy

### 1. Bot Unit Tests
```typescript
// bots/__tests__/medication-order.bot.test.ts
describe('MedicationOrderBot', () => {
  it('should create pharmacy review task', async () => {
    const event = createMockBotEvent({
      resource: mockMedicationRequest()
    });
    
    const result = await medicationOrderBot.handler(event);
    
    expect(result.success).toBe(true);
    expect(result.outputs).toHaveLength(3);
    expect(result.outputs[0].resourceType).toBe('Task');
  });
});
```

### 2. Integration Tests
```typescript
// tests/integration/bot-engine.test.ts
describe('BotEngine Integration', () => {
  it('should execute bot on FHIR webhook', async () => {
    // Register bot
    await botEngine.registerBot(testBot);
    
    // Simulate webhook
    const response = await request(app)
      .post('/bots/webhook')
      .send(mockWebhookPayload);
    
    expect(response.status).toBe(200);
    
    // Verify execution
    const executions = await botEngine.getExecutions(testBot.name);
    expect(executions).toHaveLength(1);
  });
});
```

### 3. Bot Development Tools
```typescript
// CLI for bot testing
// npm run bot:test medication-order-bot -- --event=create

export class BotTestRunner {
  async testBot(botName: string, options: TestOptions) {
    const bot = await this.loadBot(botName);
    const event = this.createTestEvent(options);
    
    console.log(`Testing ${botName}...`);
    const result = await bot.handler(event);
    
    this.printResult(result);
    this.validateResult(result, options.expectations);
  }
}
```

## Deployment & Operations

### 1. Bot Deployment Pipeline
```yaml
# .github/workflows/bot-deployment.yml
name: Deploy Bots
on:
  push:
    paths:
      - 'backend/src/bots/**'

jobs:
  deploy:
    steps:
      - name: Validate Bots
        run: npm run bots:validate
      
      - name: Run Bot Tests
        run: npm run bots:test
      
      - name: Deploy to Staging
        run: npm run bots:deploy:staging
      
      - name: Run Integration Tests
        run: npm run test:integration:bots
      
      - name: Deploy to Production
        run: npm run bots:deploy:prod
```

### 2. Bot Registry
```typescript
// bots/registry.ts
export const botRegistry: BotRegistryConfig = {
  bots: [
    {
      name: 'medication-order-bot',
      version: '1.0.0',
      enabled: true,
      environments: ['staging', 'production']
    },
    {
      name: 'lab-results-bot',
      version: '1.0.0',
      enabled: true,
      environments: ['staging']
    }
  ]
};
```

### 3. Operational Dashboard
```typescript
// frontend/src/components/admin/BotDashboard.tsx
export function BotDashboard() {
  const { data: metrics } = useBotMetrics();
  
  return (
    <Dashboard>
      <MetricCard title="Total Executions" value={metrics.total} />
      <MetricCard title="Success Rate" value={metrics.successRate} />
      <MetricCard title="Avg Duration" value={metrics.avgDuration} />
      
      <BotExecutionChart data={metrics.executions} />
      <BotErrorLog errors={metrics.recentErrors} />
      
      <BotControls onToggle={toggleBot} onRestart={restartBot} />
    </Dashboard>
  );
}
```

## Success Metrics

### Technical Metrics
- **Code Reduction**: 50-70% less workflow code
- **Execution Speed**: 2x faster workflow completion
- **Error Rate**: 40% reduction in workflow errors
- **Development Time**: 60% faster to implement new workflows

### Business Metrics
- **Time to Market**: New workflows in days vs weeks
- **Operational Cost**: 30% reduction in server resources
- **Flexibility**: 5x more workflow variations supported
- **Maintenance**: 50% less time spent on workflow bugs

## Conclusion

The bot system implementation will transform OmniCare's workflow automation from a rigid, task-based system to a flexible, event-driven platform. This change will significantly reduce development time, improve system reliability, and enable rapid iteration on clinical workflows.