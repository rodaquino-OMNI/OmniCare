/**
 * OmniCare EMR Backend - Performance Monitoring Service
 * Comprehensive API optimization and metrics collection
 */

import logger from '../utils/logger';

import { cachedAuthService } from './cached-auth.service';
import { databaseService } from './database.service';
import { optimizedPatientService } from './optimized-patient.service';
import { redisCacheService } from './redis-cache.service';


export interface APIMetrics {
  endpoint: string;
  method: string;
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  slowRequestRate: number; // Percentage of requests > 1s
  cacheHitRate: number;
  lastUpdated: string;
}

export interface SystemMetrics {
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  database: {
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
    averageQueryTime: number;
    slowQueries: number;
  };
  cache: {
    hitRatio: number;
    usedMemory: string;
    connectedClients: number;
    keyspaceHits: number;
    keyspaceMisses: number;
  };
  authentication: {
    activeSessions: number;
    recentLogins: number;
    tokenValidationTime: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical';
  metric: string;
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface OptimizationRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'database' | 'cache' | 'api' | 'infrastructure';
  title: string;
  description: string;
  estimatedImpact: string;
  implementationEffort: string;
  actions: string[];
}

export class PerformanceMonitoringService {
  private readonly metricsRetention = 7 * 24 * 60 * 60; // 7 days in seconds
  private readonly alertThresholds = {
    responseTime: 1000, // 1 second
    errorRate: 0.05,    // 5%
    memoryUsage: 0.85,  // 85%
    cacheHitRate: 0.8,  // 80%
    dbConnections: 0.9, // 90% of pool
  };

  /**
   * Track API request metrics
   */
  async trackAPIRequest(
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number,
    cacheHit = false
  ): Promise<void> {
    try {
      const metricKey = `api:metrics:${method}:${this.normalizeEndpoint(endpoint)}`;
      const dailyKey = `api:daily:${new Date().toISOString().split('T')[0]}:${method}:${this.normalizeEndpoint(endpoint)}`;
      
      // Current metrics
      const currentMetrics = await redisCacheService.get<{
        totalRequests: number;
        totalResponseTime: number;
        errors: number;
        slowRequests: number;
        cacheHits: number;
      }>(metricKey) || {
        totalRequests: 0,
        totalResponseTime: 0,
        errors: 0,
        slowRequests: 0,
        cacheHits: 0,
      };

      // Update metrics
      currentMetrics.totalRequests++;
      currentMetrics.totalResponseTime += responseTime;
      
      if (statusCode >= 400) {
        currentMetrics.errors++;
      }
      
      if (responseTime > this.alertThresholds.responseTime) {
        currentMetrics.slowRequests++;
      }
      
      if (cacheHit) {
        currentMetrics.cacheHits++;
      }

      // Store updated metrics
      await Promise.all([
        redisCacheService.set(metricKey, currentMetrics, { ttl: this.metricsRetention }),
        redisCacheService.incr(`${dailyKey}:requests`),
        redisCacheService.incr(`${dailyKey}:response_time`, responseTime),
        statusCode >= 400 ? redisCacheService.incr(`${dailyKey}:errors`) : Promise.resolve(),
        responseTime > this.alertThresholds.responseTime ? redisCacheService.incr(`${dailyKey}:slow`) : Promise.resolve(),
        cacheHit ? redisCacheService.incr(`${dailyKey}:cache_hits`) : Promise.resolve(),
      ]);

      // Check for performance alerts
      await this.checkPerformanceAlerts(endpoint, method, currentMetrics, responseTime);

    } catch (error) {
      logger.error('Failed to track API request metrics:', error);
    }
  }

  /**
   * Get API metrics for all endpoints
   */
  async getAPIMetrics(): Promise<APIMetrics[]> {
    try {
      const metricKeys = await redisCacheService.keys('api:metrics:*');
      const metrics: APIMetrics[] = [];

      for (const key of metricKeys) {
        const data = await redisCacheService.get<{
          totalRequests: number;
          totalResponseTime: number;
          errors: number;
          slowRequests: number;
          cacheHits: number;
        }>(key);

        if (data && data.totalRequests > 0) {
          const [, , method, ...endpointParts] = key.split(':');
          const endpoint = endpointParts.join(':');

          metrics.push({
            endpoint,
            method,
            totalRequests: data.totalRequests,
            averageResponseTime: data.totalResponseTime / data.totalRequests,
            errorRate: data.errors / data.totalRequests,
            slowRequestRate: data.slowRequests / data.totalRequests,
            cacheHitRate: data.cacheHits / data.totalRequests,
            lastUpdated: new Date().toISOString(),
          });
        }
      }

      return metrics.sort((a, b) => b.totalRequests - a.totalRequests);
    } catch (error) {
      logger.error('Failed to get API metrics:', error);
      return [];
    }
  }

  /**
   * Get comprehensive system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const [dbHealth, cacheHealth, sessionMetrics, dbMetrics] = await Promise.all([
        databaseService.checkHealth(),
        redisCacheService.checkHealth(),
        cachedAuthService.getSessionMetrics(),
        databaseService.getPoolStats(),
      ]);

      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      return {
        memory: {
          used: memoryUsage.heapUsed,
          free: memoryUsage.heapTotal - memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: memoryUsage.heapUsed / memoryUsage.heapTotal,
        },
        cpu: {
          usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
          loadAverage: require('os').loadavg(),
        },
        database: {
          activeConnections: dbHealth.activeConnections,
          idleConnections: dbHealth.idleConnections,
          totalConnections: dbHealth.totalConnections,
          averageQueryTime: dbHealth.latency,
          slowQueries: 0, // Would need to be tracked separately
        },
        cache: {
          hitRatio: cacheHealth.hitRatio,
          usedMemory: cacheHealth.usedMemory,
          connectedClients: cacheHealth.connectedClients,
          keyspaceHits: cacheHealth.keyspaceHits,
          keyspaceMisses: cacheHealth.keyspaceMisses,
        },
        authentication: {
          activeSessions: sessionMetrics.totalActiveSessions,
          recentLogins: sessionMetrics.recentLogins,
          tokenValidationTime: 0, // Would need to be tracked
        },
      };
    } catch (error) {
      logger.error('Failed to get system metrics:', error);
      throw error;
    }
  }

  /**
   * Get performance alerts
   */
  async getPerformanceAlerts(): Promise<PerformanceAlert[]> {
    try {
      const alertKeys = await redisCacheService.keys('alerts:performance:*');
      const alerts: PerformanceAlert[] = [];

      for (const key of alertKeys) {
        const alert = await redisCacheService.get<PerformanceAlert>(key);
        if (alert) {
          alerts.push(alert);
        }
      }

      return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      logger.error('Failed to get performance alerts:', error);
      return [];
    }
  }

  /**
   * Generate optimization recommendations
   */
  async generateOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    try {
      const recommendations: OptimizationRecommendation[] = [];
      const systemMetrics = await this.getSystemMetrics();
      const apiMetrics = await this.getAPIMetrics();
      const cacheMetrics = await optimizedPatientService.getCacheMetrics();

      // Memory usage recommendations
      if (systemMetrics.memory.percentage > 0.8) {
        recommendations.push({
          id: 'memory-optimization',
          priority: 'high',
          category: 'infrastructure',
          title: 'High Memory Usage Detected',
          description: `Memory usage is at ${Math.round(systemMetrics.memory.percentage * 100)}%. Consider optimizing memory usage or scaling up.`,
          estimatedImpact: 'Improved response times and stability',
          implementationEffort: 'Medium',
          actions: [
            'Review and optimize caching strategies',
            'Implement memory profiling',
            'Consider horizontal scaling',
            'Optimize data structures and algorithms'
          ],
        });
      }

      // Cache hit rate recommendations
      if (cacheMetrics.cacheHitRate < 0.8) {
        recommendations.push({
          id: 'cache-optimization',
          priority: 'high',
          category: 'cache',
          title: 'Low Cache Hit Rate',
          description: `Cache hit rate is ${Math.round(cacheMetrics.cacheHitRate * 100)}%. Improving caching can significantly boost performance.`,
          estimatedImpact: 'Reduced database load and faster response times',
          implementationEffort: 'Low',
          actions: [
            'Review cache TTL settings',
            'Implement cache warming strategies',
            'Optimize cache key patterns',
            'Add caching to frequently accessed endpoints'
          ],
        });
      }

      // Database connection recommendations
      const dbUtilization = systemMetrics.database.activeConnections / systemMetrics.database.totalConnections;
      if (dbUtilization > 0.8) {
        recommendations.push({
          id: 'database-connections',
          priority: 'medium',
          category: 'database',
          title: 'High Database Connection Usage',
          description: `Database connection utilization is at ${Math.round(dbUtilization * 100)}%.`,
          estimatedImpact: 'Improved database performance and reduced connection bottlenecks',
          implementationEffort: 'Medium',
          actions: [
            'Optimize database connection pooling',
            'Implement connection multiplexing',
            'Review long-running queries',
            'Consider read replicas for read-heavy operations'
          ],
        });
      }

      // Slow API recommendations
      const slowAPIs = apiMetrics.filter(api => api.averageResponseTime > 1000);
      if (slowAPIs.length > 0) {
        recommendations.push({
          id: 'slow-apis',
          priority: 'high',
          category: 'api',
          title: 'Slow API Endpoints Detected',
          description: `${slowAPIs.length} endpoints have average response times > 1 second.`,
          estimatedImpact: 'Significantly improved user experience',
          implementationEffort: 'High',
          actions: [
            'Profile slow endpoints to identify bottlenecks',
            'Implement request-level caching',
            'Optimize database queries',
            'Consider asynchronous processing for heavy operations'
          ],
        });
      }

      // Error rate recommendations
      const highErrorAPIs = apiMetrics.filter(api => api.errorRate > 0.05);
      if (highErrorAPIs.length > 0) {
        recommendations.push({
          id: 'api-errors',
          priority: 'critical',
          category: 'api',
          title: 'High API Error Rates',
          description: `${highErrorAPIs.length} endpoints have error rates > 5%.`,
          estimatedImpact: 'Improved system reliability and user experience',
          implementationEffort: 'Medium',
          actions: [
            'Review error logs for common failure patterns',
            'Implement better error handling and retries',
            'Add input validation and sanitization',
            'Monitor dependencies for failures'
          ],
        });
      }

      return recommendations;
    } catch (error) {
      logger.error('Failed to generate optimization recommendations:', error);
      return [];
    }
  }

  /**
   * Acknowledge performance alert
   */
  async acknowledgeAlert(alertId: string): Promise<boolean> {
    try {
      const alertKey = `alerts:performance:${alertId}`;
      const alert = await redisCacheService.get<PerformanceAlert>(alertKey);
      
      if (alert) {
        alert.acknowledged = true;
        await redisCacheService.set(alertKey, alert, { ttl: this.metricsRetention });
        
        logger.info('Performance alert acknowledged', { alertId });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to acknowledge alert:', error);
      return false;
    }
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(): Promise<{
    summary: {
      totalRequests: number;
      averageResponseTime: number;
      overallErrorRate: number;
      systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
    };
    apiMetrics: APIMetrics[];
    systemMetrics: SystemMetrics;
    alerts: PerformanceAlert[];
    recommendations: OptimizationRecommendation[];
  }> {
    try {
      const [apiMetrics, systemMetrics, alerts, recommendations] = await Promise.all([
        this.getAPIMetrics(),
        this.getSystemMetrics(),
        this.getPerformanceAlerts(),
        this.generateOptimizationRecommendations(),
      ]);

      // Calculate summary statistics
      const totalRequests = apiMetrics.reduce((sum, metric) => sum + metric.totalRequests, 0);
      const totalResponseTime = apiMetrics.reduce((sum, metric) => sum + (metric.averageResponseTime * metric.totalRequests), 0);
      const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
      
      const totalErrors = apiMetrics.reduce((sum, metric) => sum + (metric.errorRate * metric.totalRequests), 0);
      const overallErrorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

      // Determine system health
      let systemHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
      
      if (averageResponseTime > 2000 || overallErrorRate > 0.1 || systemMetrics.memory.percentage > 0.9) {
        systemHealth = 'poor';
      } else if (averageResponseTime > 1000 || overallErrorRate > 0.05 || systemMetrics.memory.percentage > 0.8) {
        systemHealth = 'fair';
      } else if (averageResponseTime > 500 || overallErrorRate > 0.02 || systemMetrics.memory.percentage > 0.7) {
        systemHealth = 'good';
      }

      return {
        summary: {
          totalRequests,
          averageResponseTime,
          overallErrorRate,
          systemHealth,
        },
        apiMetrics,
        systemMetrics,
        alerts,
        recommendations,
      };
    } catch (error) {
      logger.error('Failed to generate performance report:', error);
      throw error;
    }
  }

  // Private helper methods

  private normalizeEndpoint(endpoint: string): string {
    // Normalize dynamic parts of endpoints
    return endpoint
      .replace(/\/[0-9a-f-]{36}/g, '/:id') // UUIDs
      .replace(/\/\d+/g, '/:id') // Numeric IDs
      .replace(/\/[^/]+@[^/]+/g, '/:email'); // Email addresses
  }

  private async checkPerformanceAlerts(
    endpoint: string,
    method: string,
    metrics: any,
    responseTime: number
  ): Promise<void> {
    try {
      const alerts: PerformanceAlert[] = [];

      // Response time alert
      if (responseTime > this.alertThresholds.responseTime * 2) {
        alerts.push({
          id: `response-time-${Date.now()}`,
          type: 'warning',
          metric: 'response_time',
          threshold: this.alertThresholds.responseTime,
          currentValue: responseTime,
          message: `Slow response detected for ${method} ${endpoint}: ${responseTime}ms`,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        });
      }

      // Error rate alert
      const errorRate = metrics.errors / metrics.totalRequests;
      if (errorRate > this.alertThresholds.errorRate) {
        alerts.push({
          id: `error-rate-${Date.now()}`,
          type: 'critical',
          metric: 'error_rate',
          threshold: this.alertThresholds.errorRate,
          currentValue: errorRate,
          message: `High error rate for ${method} ${endpoint}: ${Math.round(errorRate * 100)}%`,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        });
      }

      // Store alerts
      for (const alert of alerts) {
        const alertKey = `alerts:performance:${alert.id}`;
        await redisCacheService.set(alertKey, alert, { ttl: this.metricsRetention });
        
        logger.warn('Performance alert generated', alert);
      }
    } catch (error) {
      logger.error('Failed to check performance alerts:', error);
    }
  }
}

// Export singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();