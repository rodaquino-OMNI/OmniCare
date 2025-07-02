/**
 * Chaos Engineering Engine
 * Core implementation of chaos experiments for OmniCare EMR
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

import * as cron from 'node-cron';

import { ChaosMetrics } from './chaos-metrics';
import { ChaosReporter } from './chaos-reporter';
import { chaosConfig, ChaosExperiment, ChaosSafeguard } from './chaos.config';

export class ChaosEngine extends EventEmitter {
  private static instance: ChaosEngine;
  private activeExperiments: Map<string, ChaosExperimentInstance> = new Map();
  private metrics: ChaosMetrics;
  private reporter: ChaosReporter;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private safeguardCheckers: Map<string, NodeJS.Timeout> = new Map();
  
  private constructor() {
    super();
    this.metrics = new ChaosMetrics();
    this.reporter = new ChaosReporter();
    this.setupEmergencyShutdown();
  }

  static getInstance(): ChaosEngine {
    if (!ChaosEngine.instance) {
      ChaosEngine.instance = new ChaosEngine();
    }
    return ChaosEngine.instance;
  }

  /**
   * Initialize the chaos engine
   */
  async initialize(): Promise<void> {
    if (!chaosConfig.enabled) {
      console.log('Chaos Engineering is disabled');
      return;
    }

    if (!chaosConfig.safeEnvironments.includes(chaosConfig.environment)) {
      console.warn(`Chaos Engineering not recommended for ${chaosConfig.environment} environment`);
      return;
    }

    console.log('Initializing Chaos Engineering Engine...');
    
    // Start metrics collection
    await this.metrics.start();
    
    // Schedule experiments
    this.scheduleExperiments();
    
    // Setup monitoring
    this.setupMonitoring();
    
    this.emit('initialized');
    console.log('Chaos Engineering Engine initialized successfully');
  }

  /**
   * Run a specific chaos experiment
   */
  async runExperiment(experimentName: string): Promise<ChaosExperimentResult> {
    const experiment = chaosConfig.experiments.find(e => e.name === experimentName);
    if (!experiment) {
      throw new Error(`Experiment ${experimentName} not found`);
    }

    if (!experiment.enabled) {
      throw new Error(`Experiment ${experimentName} is disabled`);
    }

    if (this.activeExperiments.size >= chaosConfig.global.maxConcurrentExperiments) {
      throw new Error('Maximum concurrent experiments reached');
    }

    console.log(`Starting chaos experiment: ${experimentName}`);
    
    const instance = new ChaosExperimentInstance(experiment, this.metrics);
    this.activeExperiments.set(experimentName, instance);
    
    // Setup safeguards
    this.setupSafeguards(experimentName, experiment);
    
    try {
      const result = await instance.execute();
      
      // Report results
      await this.reporter.reportExperiment(experiment, result);
      
      this.emit('experimentCompleted', { experiment: experimentName, result });
      return result;
    } catch (error) {
      this.emit('experimentFailed', { experiment: experimentName, error });
      throw error;
    } finally {
      this.activeExperiments.delete(experimentName);
      this.cleanupSafeguards(experimentName);
    }
  }

  /**
   * Stop a running experiment
   */
  async stopExperiment(experimentName: string): Promise<void> {
    const instance = this.activeExperiments.get(experimentName);
    if (!instance) {
      throw new Error(`No active experiment: ${experimentName}`);
    }

    console.log(`Stopping chaos experiment: ${experimentName}`);
    await instance.stop();
    this.activeExperiments.delete(experimentName);
    this.cleanupSafeguards(experimentName);
    
    this.emit('experimentStopped', { experiment: experimentName });
  }

  /**
   * Stop all running experiments
   */
  async stopAllExperiments(): Promise<void> {
    console.log('Stopping all chaos experiments...');
    
    const stopPromises = Array.from(this.activeExperiments.keys()).map(name => 
      this.stopExperiment(name)
    );
    
    await Promise.all(stopPromises);
    this.emit('allExperimentsStopped');
  }

  /**
   * Get status of all experiments
   */
  getStatus(): ChaosEngineStatus {
    return {
      enabled: chaosConfig.enabled,
      environment: chaosConfig.environment,
      activeExperiments: Array.from(this.activeExperiments.keys()),
      metrics: this.metrics.getSnapshot(),
      uptime: process.uptime(),
    };
  }

  /**
   * Emergency shutdown
   */
  async emergencyShutdown(): Promise<void> {
    console.log('CHAOS EMERGENCY SHUTDOWN INITIATED');
    
    await this.stopAllExperiments();
    
    // Clear all scheduled tasks
    this.scheduledTasks.forEach(task => task.stop());
    this.scheduledTasks.clear();
    
    // Clear safeguard checkers
    this.safeguardCheckers.forEach(checker => clearInterval(checker));
    this.safeguardCheckers.clear();
    
    await this.metrics.stop();
    
    this.emit('emergencyShutdown');
    console.log('Chaos Engineering Engine emergency shutdown completed');
  }

  private scheduleExperiments(): void {
    chaosConfig.experiments.forEach(experiment => {
      if (experiment.schedule && experiment.enabled) {
        const task = cron.schedule(experiment.schedule, async () => {
          try {
            if (Math.random() < experiment.probability) {
              await this.runExperiment(experiment.name);
            }
          } catch (error) {
            console.error(`Scheduled experiment ${experiment.name} failed:`, error);
          }
        });
        
        this.scheduledTasks.set(experiment.name, task);
      }
    });
  }

  private setupSafeguards(experimentName: string, experiment: ChaosExperiment): void {
    const allSafeguards = [...chaosConfig.defaultSafeguards, ...experiment.safeguards];
    
    const checker = setInterval(async () => {
      for (const safeguard of allSafeguards) {
        const shouldTrigger = await this.evaluateSafeguard(safeguard);
        
        if (shouldTrigger) {
          console.warn(`Safeguard triggered: ${safeguard.name} for experiment ${experimentName}`);
          
          if (safeguard.action === 'stop') {
            await this.stopExperiment(experimentName);
          } else if (safeguard.action === 'alert') {
            this.emit('safeguardAlert', { experiment: experimentName, safeguard });
          }
          
          break;
        }
      }
    }, 5000); // Check every 5 seconds
    
    this.safeguardCheckers.set(experimentName, checker);
  }

  private async evaluateSafeguard(safeguard: ChaosSafeguard): Promise<boolean> {
    switch (safeguard.type) {
      case 'metric':
        return await this.evaluateMetricCondition(safeguard.condition);
      case 'time':
        return Date.now() > parseInt(safeguard.condition);
      case 'manual':
        return false; // Manual safeguards are triggered externally
      default:
        return false;
    }
  }

  private async evaluateMetricCondition(condition: string): Promise<boolean> {
    const metrics = this.metrics.getSnapshot();
    
    try {
      // Simple condition evaluation (in production, use a proper expression parser)
      if (condition.includes('cpu_usage >')) {
        const threshold = parseFloat(condition.split('>')[1].trim());
        return metrics.system.cpuUsage > threshold;
      }
      
      if (condition.includes('memory_usage >')) {
        const threshold = parseFloat(condition.split('>')[1].trim());
        return metrics.system.memoryUsage > threshold;
      }
      
      if (condition.includes('error_rate >')) {
        const threshold = parseFloat(condition.split('>')[1].trim());
        return metrics.application.errorRate > threshold;
      }
      
      if (condition.includes('avg_response_time >')) {
        const threshold = parseFloat(condition.split('>')[1].trim());
        return metrics.application.avgResponseTime > threshold;
      }
      
      return false;
    } catch (error) {
      console.error('Error evaluating safeguard condition:', error);
      return false;
    }
  }

  private cleanupSafeguards(experimentName: string): void {
    const checker = this.safeguardCheckers.get(experimentName);
    if (checker) {
      clearInterval(checker);
      this.safeguardCheckers.delete(experimentName);
    }
  }

  private setupEmergencyShutdown(): void {
    process.on('SIGTERM', () => this.emergencyShutdown());
    process.on('SIGINT', () => this.emergencyShutdown());
    
    // Check for emergency stop environment variable
    setInterval(() => {
      if (process.env[chaosConfig.global.emergencyShutdownKey] === 'true') {
        this.emergencyShutdown();
      }
    }, 1000);
  }

  private setupMonitoring(): void {
    setInterval(async () => {
      const health = await this.checkSystemHealth();
      
      if (health.score < chaosConfig.monitoring.healthCheckThreshold) {
        console.warn('System health below threshold, stopping experiments');
        await this.stopAllExperiments();
      }
    }, 10000); // Check every 10 seconds
  }

  private async checkSystemHealth(): Promise<{ score: number; details: any }> {
    const metrics = this.metrics.getSnapshot();
    
    let score = 1.0;
    const details: any = {};
    
    // CPU health
    if (metrics.system.cpuUsage > 80) {
      score -= 0.3;
      details.cpu = 'HIGH';
    }
    
    // Memory health
    if (metrics.system.memoryUsage > 85) {
      score -= 0.3;
      details.memory = 'HIGH';
    }
    
    // Error rate health
    if (metrics.application.errorRate > 5) {
      score -= 0.4;
      details.errorRate = 'HIGH';
    }
    
    return { score: Math.max(0, score), details };
  }
}

/**
 * Individual chaos experiment instance
 */
class ChaosExperimentInstance {
  private startTime: number;
  private stopRequested: boolean = false;
  
  constructor(
    private experiment: ChaosExperiment,
    private metrics: ChaosMetrics
  ) {
    this.startTime = performance.now();
  }

  async execute(): Promise<ChaosExperimentResult> {
    const result: ChaosExperimentResult = {
      experimentName: this.experiment.name,
      startTime: this.startTime,
      endTime: 0,
      duration: 0,
      success: false,
      metrics: {},
      errors: [],
    };

    try {
      await this.injectChaos();
      
      // Wait for experiment duration or until stopped
      await this.waitForCompletion();
      
      result.success = !this.stopRequested;
    } catch (error) {
      result.errors.push(error.message);
    } finally {
      result.endTime = performance.now();
      result.duration = result.endTime - result.startTime;
      result.metrics = this.metrics.getExperimentMetrics(this.experiment.name);
    }

    return result;
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    await this.cleanupChaos();
  }

  private async injectChaos(): Promise<void> {
    switch (this.experiment.type) {
      case 'latency':
        await this.injectLatency();
        break;
      case 'error':
        await this.injectErrors();
        break;
      case 'database':
        await this.injectDatabaseFailures();
        break;
      case 'memory':
        await this.injectMemoryPressure();
        break;
      case 'network':
        await this.injectNetworkFailures();
        break;
      case 'resource':
        await this.injectResourceStress();
        break;
    }
  }

  private async injectLatency(): Promise<void> {
    // Implementation would hook into Express middleware or HTTP client
    console.log(`Injecting latency: ${this.experiment.parameters.minLatency}-${this.experiment.parameters.maxLatency}ms`);
  }

  private async injectErrors(): Promise<void> {
    // Implementation would hook into response handlers
    console.log(`Injecting errors: ${this.experiment.parameters.errorCodes}`);
  }

  private async injectDatabaseFailures(): Promise<void> {
    // Implementation would hook into database connection pool
    console.log(`Injecting database failures: ${this.experiment.parameters.errorType}`);
  }

  private async injectMemoryPressure(): Promise<void> {
    // Implementation would allocate memory
    console.log(`Injecting memory pressure: ${this.experiment.parameters.memorySize}`);
  }

  private async injectNetworkFailures(): Promise<void> {
    // Implementation would hook into HTTP clients
    console.log(`Injecting network failures for: ${this.experiment.targets}`);
  }

  private async injectResourceStress(): Promise<void> {
    // Implementation would generate CPU/IO load
    console.log(`Injecting resource stress: ${this.experiment.parameters.cpuLoad}%`);
  }

  private async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve();
      }, this.experiment.duration);

      const checkStop = setInterval(() => {
        if (this.stopRequested) {
          clearTimeout(timeout);
          clearInterval(checkStop);
          resolve();
        }
      }, 100);
    });
  }

  private async cleanupChaos(): Promise<void> {
    // Cleanup injected chaos effects
    console.log(`Cleaning up chaos for experiment: ${this.experiment.name}`);
  }
}

// Type definitions
export interface ChaosExperimentResult {
  experimentName: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  metrics: Record<string, any>;
  errors: string[];
}

export interface ChaosEngineStatus {
  enabled: boolean;
  environment: string;
  activeExperiments: string[];
  metrics: any;
  uptime: number;
}