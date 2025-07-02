/**
 * Chaos Engineering Configuration
 * Implements Chaos Monkey principles for OmniCare EMR
 */

export interface ChaosExperiment {
  name: string;
  description: string;
  type: 'latency' | 'error' | 'resource' | 'network' | 'database' | 'memory';
  enabled: boolean;
  probability: number; // 0-1
  duration: number; // milliseconds
  schedule?: string; // cron expression
  targets: string[];
  parameters: Record<string, any>;
  safeguards: ChaosSafeguard[];
}

export interface ChaosSafeguard {
  name: string;
  type: 'metric' | 'time' | 'manual';
  condition: string;
  action: 'stop' | 'rollback' | 'alert';
}

export const chaosConfig = {
  enabled: process.env.CHAOS_ENABLED === 'true',
  environment: process.env.NODE_ENV || 'development',
  safeEnvironments: ['test', 'development'],
  
  // Global settings
  global: {
    maxConcurrentExperiments: 3,
    defaultDuration: 60000, // 1 minute
    cooldownPeriod: 300000, // 5 minutes
    emergencyShutdownKey: 'CHAOS_EMERGENCY_STOP',
  },
  
  // Monitoring and alerting
  monitoring: {
    metricsEndpoint: '/api/metrics',
    alertWebhook: process.env.CHAOS_ALERT_WEBHOOK,
    healthCheckEndpoint: '/api/health',
    healthCheckThreshold: 0.95,
  },
  
  // Default safeguards
  defaultSafeguards: [
    {
      name: 'CPU Usage',
      type: 'metric',
      condition: 'cpu_usage > 80',
      action: 'stop',
    },
    {
      name: 'Memory Usage',
      type: 'metric',
      condition: 'memory_usage > 85',
      action: 'stop',
    },
    {
      name: 'Error Rate',
      type: 'metric',
      condition: 'error_rate > 5',
      action: 'stop',
    },
    {
      name: 'Response Time',
      type: 'metric',
      condition: 'avg_response_time > 5000',
      action: 'stop',
    },
    {
      name: 'Max Duration',
      type: 'time',
      condition: '600000', // 10 minutes
      action: 'stop',
    },
  ] as ChaosSafeguard[],
  
  // Predefined experiments
  experiments: [
    {
      name: 'API Latency Injection',
      description: 'Inject artificial latency into API responses',
      type: 'latency',
      enabled: true,
      probability: 0.1,
      duration: 30000,
      targets: ['/api/patients', '/api/appointments'],
      parameters: {
        minLatency: 100,
        maxLatency: 2000,
        distribution: 'gaussian',
      },
      safeguards: [],
    },
    {
      name: 'Database Connection Failures',
      description: 'Simulate database connection failures',
      type: 'database',
      enabled: true,
      probability: 0.05,
      duration: 15000,
      targets: ['postgresql'],
      parameters: {
        errorType: 'connection_timeout',
        failureRate: 0.2,
      },
      safeguards: [
        {
          name: 'Database Health',
          type: 'metric',
          condition: 'db_connection_errors > 10',
          action: 'stop',
        },
      ],
    },
    {
      name: 'Memory Pressure',
      description: 'Consume additional memory to test memory handling',
      type: 'memory',
      enabled: false, // Disabled by default for safety
      probability: 0.02,
      duration: 60000,
      targets: ['node_process'],
      parameters: {
        memorySize: '100MB',
        allocationPattern: 'gradual',
      },
      safeguards: [
        {
          name: 'Memory Limit',
          type: 'metric',
          condition: 'memory_usage > 90',
          action: 'stop',
        },
      ],
    },
    {
      name: 'External Service Failures',
      description: 'Simulate failures in external service calls',
      type: 'network',
      enabled: true,
      probability: 0.1,
      duration: 45000,
      targets: ['medplum_api', 'external_ehr'],
      parameters: {
        errorTypes: ['timeout', 'connection_refused', 'dns_failure'],
        failureRate: 0.3,
      },
      safeguards: [],
    },
    {
      name: 'CPU Spike',
      description: 'Generate CPU load to test performance under stress',
      type: 'resource',
      enabled: false,
      probability: 0.03,
      duration: 30000,
      targets: ['cpu'],
      parameters: {
        cpuLoad: 70, // percentage
        pattern: 'burst',
      },
      safeguards: [
        {
          name: 'CPU Protection',
          type: 'metric',
          condition: 'cpu_usage > 85',
          action: 'stop',
        },
      ],
    },
    {
      name: 'Random HTTP Errors',
      description: 'Inject random HTTP errors into API responses',
      type: 'error',
      enabled: true,
      probability: 0.05,
      duration: 120000,
      targets: ['/api/*'],
      parameters: {
        errorCodes: [500, 502, 503, 504],
        errorRate: 0.1,
        excludePaths: ['/api/health', '/api/metrics'],
      },
      safeguards: [],
    },
  ] as ChaosExperiment[],
  
  // Scheduling
  schedules: {
    businessHours: '0 9-17 * * 1-5', // 9 AM to 5 PM, Monday to Friday
    offHours: '0 18-8 * * *', // 6 PM to 8 AM
    weekends: '0 * * * 0,6', // Weekends
  },
  
  // Reporting
  reporting: {
    enabled: true,
    outputDir: './chaos-reports',
    formats: ['json', 'html'],
    includeMetrics: true,
    includeScreenshots: false,
  },
};