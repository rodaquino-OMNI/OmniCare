/**
 * Circuit Breaker for API Gateway
 * Implements circuit breaker pattern to handle service failures
 */

import { EventEmitter } from 'events';

import logger from '../utils/logger';

import { CircuitBreakerState } from './types';

interface CircuitBreakerConfig {
  errorThreshold: number; // Percentage of failures that triggers opening
  volumeThreshold: number; // Minimum number of requests before considering error rate
  timeout: number; // Time to wait before attempting to close circuit (ms)
  resetTimeout: number; // Time to reset metrics (ms)
}

export class CircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private requests: number = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;
  private metrics: Array<{ timestamp: Date; success: boolean }> = [];

  constructor(config: CircuitBreakerConfig) {
    super();
    this.config = config;
    
    // Clean up old metrics periodically
    setInterval(() => {
      this.cleanupMetrics();
    }, this.config.resetTimeout);
  }

  /**
   * Check if requests can be made
   */
  canRequest(): boolean {
    this.updateState();
    return this.state !== 'open';
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.successes++;
    this.requests++;
    this.metrics.push({ timestamp: new Date(), success: true });
    
    if (this.state === 'half-open') {
      // If we get enough successes in half-open state, close the circuit
      const recentSuccesses = this.getRecentSuccesses();
      if (recentSuccesses >= this.config.volumeThreshold / 2) {
        this.closeCircuit();
      }
    }
    
    this.cleanupMetrics();
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.failures++;
    this.requests++;
    this.lastFailureTime = new Date();
    this.metrics.push({ timestamp: new Date(), success: false });
    
    if (this.state === 'half-open') {
      // Any failure in half-open state opens the circuit again
      this.openCircuit();
    } else if (this.state === 'closed') {
      // Check if we should open the circuit
      this.checkThreshold();
    }
    
    this.cleanupMetrics();
  }

  /**
   * Get current circuit breaker status
   */
  getStatus(): CircuitBreakerState {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Get error rate as percentage
   */
  getErrorRate(): number {
    if (this.requests === 0) return 0;
    return (this.failures / this.requests) * 100;
  }

  /**
   * Get success rate as percentage
   */
  getSuccessRate(): number {
    if (this.requests === 0) return 100;
    return (this.successes / this.requests) * 100;
  }

  /**
   * Get time until next retry attempt (in seconds)
   */
  getRetryAfter(): number {
    if (!this.nextAttemptTime) return 0;
    return Math.max(0, Math.ceil((this.nextAttemptTime.getTime() - Date.now()) / 1000));
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    this.metrics = [];
    
    logger.info('Circuit breaker manually reset');
    this.emit('circuit-reset');
  }

  /**
   * Manually open the circuit breaker
   */
  forceOpen(): void {
    this.openCircuit();
    logger.info('Circuit breaker manually opened');
  }

  /**
   * Manually close the circuit breaker
   */
  forceClose(): void {
    this.closeCircuit();
    logger.info('Circuit breaker manually closed');
  }

  /**
   * Update circuit breaker state based on current conditions
   */
  private updateState(): void {
    const now = new Date();
    
    if (this.state === 'open' && this.nextAttemptTime && now >= this.nextAttemptTime) {
      // Transition from open to half-open
      this.state = 'half-open';
      this.nextAttemptTime = undefined;
      
      logger.info('Circuit breaker transitioned to half-open state');
      this.emit('circuit-half-open');
    }
  }

  /**
   * Check if error threshold is exceeded
   */
  private checkThreshold(): void {
    if (this.requests < this.config.volumeThreshold) {
      return; // Not enough requests to make a decision
    }

    const errorRate = this.getErrorRate();
    if (errorRate >= this.config.errorThreshold) {
      this.openCircuit();
    }
  }

  /**
   * Open the circuit breaker
   */
  private openCircuit(): void {
    this.state = 'open';
    this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
    
    logger.warn('Circuit breaker opened', {
      errorRate: this.getErrorRate(),
      failures: this.failures,
      requests: this.requests,
      nextAttempt: this.nextAttemptTime,
    });
    
    this.emit('circuit-opened', {
      errorRate: this.getErrorRate(),
      failures: this.failures,
      requests: this.requests,
    });
  }

  /**
   * Close the circuit breaker
   */
  private closeCircuit(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.nextAttemptTime = undefined;
    
    logger.info('Circuit breaker closed');
    this.emit('circuit-closed');
  }

  /**
   * Get recent successful requests count
   */
  private getRecentSuccesses(): number {
    const cutoff = new Date(Date.now() - this.config.resetTimeout);
    return this.metrics.filter(m => m.timestamp >= cutoff && m.success).length;
  }

  /**
   * Clean up old metrics
   */
  private cleanupMetrics(): void {
    const cutoff = new Date(Date.now() - this.config.resetTimeout);
    const oldLength = this.metrics.length;
    
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
    
    // Also reset counters if all metrics are cleaned up
    if (this.metrics.length === 0) {
      this.failures = 0;
      this.successes = 0;
      this.requests = 0;
    } else {
      // Recalculate counters based on remaining metrics
      this.failures = this.metrics.filter(m => !m.success).length;
      this.successes = this.metrics.filter(m => m.success).length;
      this.requests = this.metrics.length;
    }
    
    if (oldLength !== this.metrics.length) {
      logger.debug('Cleaned up circuit breaker metrics', {
        removed: oldLength - this.metrics.length,
        remaining: this.metrics.length,
      });
    }
  }

  /**
   * Get detailed metrics
   */
  getMetrics(): {
    state: string;
    errorRate: number;
    successRate: number;
    totalRequests: number;
    failures: number;
    successes: number;
    lastFailureTime?: Date;
    nextAttemptTime?: Date;
    recentMetrics: Array<{ timestamp: Date; success: boolean }>;
  } {
    return {
      state: this.state,
      errorRate: this.getErrorRate(),
      successRate: this.getSuccessRate(),
      totalRequests: this.requests,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      recentMetrics: [...this.metrics],
    };
  }

  /**
   * Create a circuit breaker wrapper for functions
   */
  static wrap<T, TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<T>,
    config: CircuitBreakerConfig
  ): (...args: TArgs) => Promise<T> {
    const circuitBreaker = new CircuitBreaker(config);
    
    return async (...args: TArgs): Promise<T> => {
      if (!circuitBreaker.canRequest()) {
        throw new Error('Circuit breaker is open');
      }
      
      try {
        const result = await fn(...args);
        circuitBreaker.recordSuccess();
        return result;
      } catch (error) {
        circuitBreaker.recordFailure();
        throw error;
      }
    };
  }

  /**
   * Create multiple circuit breakers for different services
   */
  static createMultiple(
    services: string[],
    config: CircuitBreakerConfig
  ): Map<string, CircuitBreaker> {
    const circuitBreakers = new Map<string, CircuitBreaker>();
    
    services.forEach(service => {
      circuitBreakers.set(service, new CircuitBreaker(config));
    });
    
    return circuitBreakers;
  }
}