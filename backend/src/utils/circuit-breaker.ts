/**
 * Circuit Breaker Pattern Implementation
 * Provides fault tolerance for external service calls
 */

import { AppError, ErrorFactory, ErrorTransformer } from './error-transformer';
import logger from './logger';
import { Result, err, ok } from './result';

/**
 * Circuit Breaker States
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, calls fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service is back
}

/**
 * Circuit Breaker Configuration
 */
export interface CircuitBreakerConfig {
  /** Failure threshold to open circuit */
  failureThreshold: number;
  /** Success threshold to close circuit from half-open */
  successThreshold: number;
  /** Time window to reset failure count (ms) */
  timeWindow: number;
  /** Timeout for each call (ms) */
  timeout: number;
  /** Recovery timeout when circuit is open (ms) */
  recoveryTimeout: number;
  /** Function to determine if error should count as failure */
  shouldCountFailure?: (error: unknown) => boolean;
}

/**
 * Circuit Breaker Statistics
 */
export interface CircuitBreakerStats {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  state: CircuitState;
  uptime: number;
}

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;
  private stats: CircuitBreakerStats;
  private readonly startTime = new Date();

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig
  ) {
    this.stats = {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      state: this.state,
      uptime: 0
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<Result<T, AppError>> {
    this.stats.totalCalls++;
    this.updateUptime();

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        logger.info(`Circuit breaker ${this.name} entering HALF_OPEN state`);
      } else {
        this.stats.rejectedCalls++;
        const error = ErrorFactory.externalService(
          this.name,
          'Circuit breaker is OPEN'
        );
        
        if (fallback) {
          logger.info(`Circuit breaker ${this.name} using fallback`);
          try {
            const result = await fallback();
            return ok(result);
          } catch (fallbackError) {
            return err(ErrorTransformer.transform(fallbackError));
          }
        }
        
        return err(error);
      }
    }

    // Execute the function with timeout
    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return ok(result);
    } catch (error) {
      this.onFailure(error);
      
      // Use fallback if provided, regardless of state
      if (fallback) {
        logger.info(`Circuit breaker ${this.name} using fallback after failure`);
        try {
          const result = await fallback();
          return ok(result);
        } catch (fallbackError) {
          return err(ErrorTransformer.transform(fallbackError));
        }
      }
      
      return err(ErrorTransformer.transform(error));
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Circuit breaker timeout: ${this.config.timeout}ms`));
      }, this.config.timeout);

      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.stats.successCalls++;
    this.lastSuccessTime = new Date();
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info(`Circuit breaker ${this.name} closed after successful recovery`);
      }
    }

    this.updateStats();
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: unknown): void {
    this.stats.failedCalls++;
    this.lastFailureTime = new Date();

    // Check if this error should count as a failure
    if (this.config.shouldCountFailure) {
      if (!this.config.shouldCountFailure(error)) {
        this.updateStats();
        return;
      }
    }

    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.setNextAttemptTime();
      logger.warn(`Circuit breaker ${this.name} opened after failed recovery attempt`);
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.setNextAttemptTime();
      logger.warn(`Circuit breaker ${this.name} opened after ${this.failureCount} failures`);
    }

    this.updateStats();
  }

  /**
   * Check if circuit should attempt to reset
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime ? new Date() >= this.nextAttemptTime : false;
  }

  /**
   * Set next attempt time
   */
  private setNextAttemptTime(): void {
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.state = this.state;
    this.stats.lastFailureTime = this.lastFailureTime;
    this.stats.lastSuccessTime = this.lastSuccessTime;
    this.updateUptime();
  }

  /**
   * Update uptime
   */
  private updateUptime(): void {
    this.stats.uptime = Date.now() - this.startTime.getTime();
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    this.updateUptime();
    return { ...this.stats };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force circuit state (for testing)
   */
  setState(state: CircuitState): void {
    this.state = state;
    this.updateStats();
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    this.updateStats();
    logger.info(`Circuit breaker ${this.name} reset`);
  }

  /**
   * Get health status
   */
  getHealth(): {
    healthy: boolean;
    state: CircuitState;
    failureRate: number;
    uptime: number;
  } {
    const totalCalls = this.stats.totalCalls;
    const failureRate = totalCalls > 0 ? this.stats.failedCalls / totalCalls : 0;
    
    return {
      healthy: this.state === CircuitState.CLOSED,
      state: this.state,
      failureRate,
      uptime: this.stats.uptime
    };
  }
}

/**
 * Circuit Breaker Manager
 */
export class CircuitBreakerManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 3,
    timeWindow: 60000, // 1 minute
    timeout: 30000,    // 30 seconds
    recoveryTimeout: 60000, // 1 minute
    shouldCountFailure: (error) => {
      // Don't count client errors (4xx) as failures
      if (error instanceof AppError) {
        return error.statusCode >= 500;
      }
      return true;
    }
  };

  /**
   * Get or create circuit breaker
   */
  getCircuitBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const mergedConfig = { ...this.defaultConfig, ...config };
      this.circuitBreakers.set(name, new CircuitBreaker(name, mergedConfig));
      logger.info(`Created circuit breaker for ${name}`);
    }
    return this.circuitBreakers.get(name)!;
  }

  /**
   * Execute with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    fn: () => Promise<T>,
    options?: {
      config?: Partial<CircuitBreakerConfig>;
      fallback?: () => Promise<T>;
    }
  ): Promise<Result<T, AppError>> {
    const circuitBreaker = this.getCircuitBreaker(serviceName, options?.config);
    return circuitBreaker.execute(fn, options?.fallback);
  }

  /**
   * Get all circuit breakers
   */
  getAllCircuitBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Get health status of all circuit breakers
   */
  getOverallHealth(): {
    healthy: boolean;
    totalCircuits: number;
    healthyCircuits: number;
    circuits: Record<string, ReturnType<CircuitBreaker['getHealth']>>;
  } {
    const circuits: Record<string, ReturnType<CircuitBreaker['getHealth']>> = {};
    let healthyCount = 0;

    for (const [name, circuitBreaker] of this.circuitBreakers) {
      const health = circuitBreaker.getHealth();
      circuits[name] = health;
      if (health.healthy) {
        healthyCount++;
      }
    }

    return {
      healthy: healthyCount === this.circuitBreakers.size,
      totalCircuits: this.circuitBreakers.size,
      healthyCircuits: healthyCount,
      circuits
    };
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
  }

  /**
   * Remove circuit breaker
   */
  remove(name: string): boolean {
    return this.circuitBreakers.delete(name);
  }
}

// Global circuit breaker manager
export const circuitBreakerManager = new CircuitBreakerManager();

/**
 * Decorator for circuit breaker protection
 */
export function withCircuitBreaker(
  serviceName: string,
  config?: Partial<CircuitBreakerConfig>
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await circuitBreakerManager.execute(
        serviceName,
        () => method.apply(this, args),
        { config }
      );
      
      if (result.isErr()) {
        throw result.error;
      }
      
      return result.value;
    };

    return descriptor;
  };
}

/**
 * Utility function for circuit breaker execution
 */
export async function executeWithCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  options?: {
    config?: Partial<CircuitBreakerConfig>;
    fallback?: () => Promise<T>;
  }
): Promise<Result<T, AppError>> {
  return circuitBreakerManager.execute(serviceName, fn, options);
}