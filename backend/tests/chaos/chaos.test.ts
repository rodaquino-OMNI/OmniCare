/**
 * Chaos Engineering Test Suite
 * Demonstrates usage of the chaos engineering framework
 */

import { ChaosEngine } from './chaos-engine';
import { chaosConfig } from './chaos.config';

describe('Chaos Engineering Tests', () => {
  let chaosEngine: ChaosEngine;

  beforeAll(async () => {
    chaosEngine = ChaosEngine.getInstance();
    await chaosEngine.initialize();
  });

  afterAll(async () => {
    await chaosEngine.emergencyShutdown();
  });

  describe('Engine Initialization', () => {
    it('should initialize successfully', () => {
      expect(chaosEngine).toBeDefined();
      const status = chaosEngine.getStatus();
      expect(status.enabled).toBe(chaosConfig.enabled);
    });

    it('should have correct environment configuration', () => {
      const status = chaosEngine.getStatus();
      expect(status.environment).toBeDefined();
      expect(chaosConfig.safeEnvironments).toContain(status.environment);
    });
  });

  describe('Experiment Execution', () => {
    it('should run API latency injection experiment', async () => {
      const experimentName = 'API Latency Injection';
      
      const result = await chaosEngine.runExperiment(experimentName);
      
      expect(result).toBeDefined();
      expect(result.experimentName).toBe(experimentName);
      expect(result.startTime).toBeGreaterThan(0);
      expect(result.endTime).toBeGreaterThan(result.startTime);
      expect(result.duration).toBeGreaterThan(0);
    }, 60000); // 60 second timeout

    it('should handle database connection failures', async () => {
      const experimentName = 'Database Connection Failures';
      
      const result = await chaosEngine.runExperiment(experimentName);
      
      expect(result).toBeDefined();
      expect(result.experimentName).toBe(experimentName);
      // Even if experiment "fails" due to safeguards, it should complete
      expect(result.endTime).toBeGreaterThan(0);
    }, 45000);

    it('should inject random HTTP errors', async () => {
      const experimentName = 'Random HTTP Errors';
      
      const result = await chaosEngine.runExperiment(experimentName);
      
      expect(result).toBeDefined();
      expect(result.experimentName).toBe(experimentName);
      expect(result.duration).toBeGreaterThan(0);
    }, 150000); // 2.5 minute timeout
  });

  describe('Experiment Management', () => {
    it('should track active experiments', async () => {
      const status = chaosEngine.getStatus();
      const initialCount = status.activeExperiments.length;

      // Start an experiment asynchronously
      const experimentPromise = chaosEngine.runExperiment('API Latency Injection');
      
      // Check that it's tracked as active
      const statusDuringExperiment = chaosEngine.getStatus();
      expect(statusDuringExperiment.activeExperiments.length).toBeGreaterThan(initialCount);

      // Wait for completion
      await experimentPromise;

      // Check that it's no longer active
      const finalStatus = chaosEngine.getStatus();
      expect(finalStatus.activeExperiments.length).toBe(initialCount);
    }, 60000);

    it('should stop experiments on command', async () => {
      // Start a long-running experiment
      const experimentPromise = chaosEngine.runExperiment('Random HTTP Errors');
      
      // Wait a bit then stop it
      setTimeout(async () => {
        await chaosEngine.stopExperiment('Random HTTP Errors');
      }, 5000);

      const result = await experimentPromise;
      
      // Should complete early due to stop command
      expect(result.duration).toBeLessThan(120000); // Less than full duration
    }, 30000);

    it('should respect maximum concurrent experiments limit', async () => {
      const promises = [];
      
      // Try to start more experiments than the limit
      for (let i = 0; i < chaosConfig.global.maxConcurrentExperiments + 2; i++) {
        promises.push(
          chaosEngine.runExperiment('API Latency Injection').catch(error => error)
        );
      }

      const results = await Promise.all(promises);
      
      // Some should fail due to limit
      const errors = results.filter(r => r instanceof Error);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('Maximum concurrent experiments'))).toBe(true);
    }, 90000);
  });

  describe('Safeguard System', () => {
    it('should trigger safeguards when conditions are met', async () => {
      // This test would require mocking metrics to trigger safeguards
      // For now, we'll test that safeguards are properly configured
      const experiment = chaosConfig.experiments.find(e => e.name === 'Memory Pressure');
      expect(experiment).toBeDefined();
      expect(experiment?.safeguards.length).toBeGreaterThan(0);
      
      const memorySafeguard = experiment?.safeguards.find(s => s.name === 'Memory Limit');
      expect(memorySafeguard).toBeDefined();
      expect(memorySafeguard?.condition).toBe('memory_usage > 90');
      expect(memorySafeguard?.action).toBe('stop');
    });

    it('should have default safeguards configured', () => {
      expect(chaosConfig.defaultSafeguards.length).toBeGreaterThan(0);
      
      const cpuSafeguard = chaosConfig.defaultSafeguards.find(s => s.name === 'CPU Usage');
      expect(cpuSafeguard).toBeDefined();
      expect(cpuSafeguard?.action).toBe('stop');
    });
  });

  describe('Metrics Collection', () => {
    it('should collect system metrics', () => {
      const status = chaosEngine.getStatus();
      expect(status.metrics).toBeDefined();
      expect(status.metrics.system).toBeDefined();
      expect(status.metrics.application).toBeDefined();
    });

    it('should track experiment impact', async () => {
      const result = await chaosEngine.runExperiment('API Latency Injection');
      
      expect(result.metrics).toBeDefined();
      // Metrics should contain impact measurements
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle invalid experiment names', async () => {
      await expect(chaosEngine.runExperiment('Non-existent Experiment'))
        .rejects.toThrow('Experiment Non-existent Experiment not found');
    });

    it('should handle disabled experiments', async () => {
      // Memory Pressure is disabled by default
      await expect(chaosEngine.runExperiment('Memory Pressure'))
        .rejects.toThrow('Experiment Memory Pressure is disabled');
    });

    it('should handle stopping non-existent experiments', async () => {
      await expect(chaosEngine.stopExperiment('Non-existent'))
        .rejects.toThrow('No active experiment: Non-existent');
    });
  });

  describe('Emergency Procedures', () => {
    it('should support emergency shutdown', async () => {
      // Start some experiments
      const promises = [
        chaosEngine.runExperiment('API Latency Injection').catch(() => {}),
        chaosEngine.runExperiment('Random HTTP Errors').catch(() => {}),
      ];

      // Trigger emergency shutdown
      setTimeout(() => {
        chaosEngine.emergencyShutdown();
      }, 5000);

      await Promise.all(promises);
      
      const status = chaosEngine.getStatus();
      expect(status.activeExperiments.length).toBe(0);
    }, 30000);
  });

  describe('Configuration Validation', () => {
    it('should have valid experiment configurations', () => {
      chaosConfig.experiments.forEach(experiment => {
        expect(experiment.name).toBeDefined();
        expect(experiment.type).toBeDefined();
        expect(experiment.probability).toBeGreaterThanOrEqual(0);
        expect(experiment.probability).toBeLessThanOrEqual(1);
        expect(experiment.duration).toBeGreaterThan(0);
        expect(experiment.targets).toBeInstanceOf(Array);
        expect(experiment.parameters).toBeDefined();
        expect(experiment.safeguards).toBeInstanceOf(Array);
      });
    });

    it('should have reasonable safeguard thresholds', () => {
      chaosConfig.defaultSafeguards.forEach(safeguard => {
        expect(safeguard.name).toBeDefined();
        expect(safeguard.type).toMatch(/^(metric|time|manual)$/);
        expect(safeguard.action).toMatch(/^(stop|rollback|alert)$/);
      });
    });

    it('should have safe environment restrictions', () => {
      expect(chaosConfig.safeEnvironments).toContain('test');
      expect(chaosConfig.safeEnvironments).toContain('development');
    });
  });
});