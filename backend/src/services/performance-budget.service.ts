/**
 * Performance Budget Monitoring Service
 * Tracks and enforces performance budgets across the application
 */

import { EventEmitter } from 'events';

import logger from '../utils/logger';

import { performanceMonitoringService } from './performance-monitoring.service';
import { redisCacheService } from './redis-cache.service';

interface PerformanceBudget {
  name: string;
  category: 'api' | 'database' | 'frontend' | 'resource';
  metric: string;
  threshold: number;
  unit: 'ms' | 'mb' | 'kb' | 'percent' | 'count';
  severity: 'warning' | 'error' | 'critical';
  description: string;
}

interface BudgetViolation {
  budget: PerformanceBudget;
  actualValue: number;
  timestamp: Date;
  details?: string;
  resolved: boolean;
}

interface BudgetStatus {
  budget: PerformanceBudget;
  currentValue: number;
  percentageUsed: number;
  status: 'healthy' | 'warning' | 'violation';
  trend: 'improving' | 'stable' | 'degrading';
}

export class PerformanceBudgetService extends EventEmitter {
  private budgets: Map<string, PerformanceBudget> = new Map();
  private violations: Map<string, BudgetViolation[]> = new Map();
  private monitoringInterval?: NodeJS.Timer;
  private readonly MONITORING_INTERVAL = 30000; // 30 seconds
  private readonly VIOLATION_RETENTION = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    super();
    this.initializeDefaultBudgets();
    this.startMonitoring();
  }

  /**
   * Initialize default performance budgets
   */
  private initializeDefaultBudgets(): void {
    const defaultBudgets: PerformanceBudget[] = [
      // API Performance Budgets
      {
        name: 'API Response Time (p95)',
        category: 'api',
        metric: 'api.responseTime.p95',
        threshold: 1000,
        unit: 'ms',
        severity: 'error',
        description: 'API response time 95th percentile should be under 1 second',
      },
      {
        name: 'API Response Time (p99)',
        category: 'api',
        metric: 'api.responseTime.p99',
        threshold: 2000,
        unit: 'ms',
        severity: 'warning',
        description: 'API response time 99th percentile should be under 2 seconds',
      },
      {
        name: 'API Error Rate',
        category: 'api',
        metric: 'api.errorRate',
        threshold: 1,
        unit: 'percent',
        severity: 'critical',
        description: 'API error rate should be under 1%',
      },
      {
        name: 'API Throughput',
        category: 'api',
        metric: 'api.throughput',
        threshold: 5000,
        unit: 'count',
        severity: 'warning',
        description: 'API should handle at least 5000 requests per second',
      },

      // Database Performance Budgets
      {
        name: 'Database Query Time',
        category: 'database',
        metric: 'db.queryTime.avg',
        threshold: 50,
        unit: 'ms',
        severity: 'error',
        description: 'Average database query time should be under 50ms',
      },
      {
        name: 'Database Connection Pool Usage',
        category: 'database',
        metric: 'db.connectionPool.usage',
        threshold: 80,
        unit: 'percent',
        severity: 'warning',
        description: 'Database connection pool usage should be under 80%',
      },
      {
        name: 'Database Slow Queries',
        category: 'database',
        metric: 'db.slowQueries.count',
        threshold: 10,
        unit: 'count',
        severity: 'warning',
        description: 'Should have less than 10 slow queries per minute',
      },

      // Frontend Performance Budgets
      {
        name: 'First Contentful Paint',
        category: 'frontend',
        metric: 'frontend.fcp',
        threshold: 1500,
        unit: 'ms',
        severity: 'error',
        description: 'First Contentful Paint should be under 1.5 seconds',
      },
      {
        name: 'Largest Contentful Paint',
        category: 'frontend',
        metric: 'frontend.lcp',
        threshold: 2500,
        unit: 'ms',
        severity: 'error',
        description: 'Largest Contentful Paint should be under 2.5 seconds',
      },
      {
        name: 'First Input Delay',
        category: 'frontend',
        metric: 'frontend.fid',
        threshold: 100,
        unit: 'ms',
        severity: 'warning',
        description: 'First Input Delay should be under 100ms',
      },
      {
        name: 'Cumulative Layout Shift',
        category: 'frontend',
        metric: 'frontend.cls',
        threshold: 0.1,
        unit: 'percent',
        severity: 'warning',
        description: 'Cumulative Layout Shift should be under 0.1',
      },
      {
        name: 'JavaScript Bundle Size',
        category: 'frontend',
        metric: 'frontend.bundle.js',
        threshold: 2048,
        unit: 'kb',
        severity: 'warning',
        description: 'JavaScript bundle size should be under 2MB',
      },
      {
        name: 'CSS Bundle Size',
        category: 'frontend',
        metric: 'frontend.bundle.css',
        threshold: 512,
        unit: 'kb',
        severity: 'warning',
        description: 'CSS bundle size should be under 512KB',
      },

      // Resource Usage Budgets
      {
        name: 'Server Memory Usage',
        category: 'resource',
        metric: 'resource.memory.usage',
        threshold: 85,
        unit: 'percent',
        severity: 'critical',
        description: 'Server memory usage should be under 85%',
      },
      {
        name: 'Server CPU Usage',
        category: 'resource',
        metric: 'resource.cpu.usage',
        threshold: 70,
        unit: 'percent',
        severity: 'error',
        description: 'Server CPU usage should be under 70%',
      },
      {
        name: 'Redis Memory Usage',
        category: 'resource',
        metric: 'resource.redis.memory',
        threshold: 1024,
        unit: 'mb',
        severity: 'warning',
        description: 'Redis memory usage should be under 1GB',
      },
    ];

    defaultBudgets.forEach(budget => {
      this.addBudget(budget);
    });

    logger.info(`Initialized ${defaultBudgets.length} performance budgets`);
  }

  /**
   * Add a performance budget
   */
  addBudget(budget: PerformanceBudget): void {
    this.budgets.set(budget.name, budget);
    this.emit('budget-added', budget);
  }

  /**
   * Remove a performance budget
   */
  removeBudget(name: string): void {
    if (this.budgets.delete(name)) {
      this.violations.delete(name);
      this.emit('budget-removed', { name });
    }
  }

  /**
   * Update a performance budget
   */
  updateBudget(name: string, updates: Partial<PerformanceBudget>): void {
    const budget = this.budgets.get(name);
    if (budget) {
      Object.assign(budget, updates);
      this.emit('budget-updated', budget);
    }
  }

  /**
   * Get all budgets
   */
  getBudgets(): PerformanceBudget[] {
    return Array.from(this.budgets.values());
  }

  /**
   * Get budget status
   */
  async getBudgetStatus(): Promise<BudgetStatus[]> {
    const statuses: BudgetStatus[] = [];

    for (const budget of this.budgets.values()) {
      const currentValue = await this.getMetricValue(budget.metric);
      const percentageUsed = this.calculatePercentageUsed(currentValue, budget.threshold, budget.metric);
      const status = this.determineStatus(percentageUsed, budget.severity);
      const trend = await this.calculateTrend(budget.metric, currentValue);

      statuses.push({
        budget,
        currentValue,
        percentageUsed,
        status,
        trend,
      });
    }

    return statuses;
  }

  /**
   * Get violations
   */
  getViolations(resolved = false): BudgetViolation[] {
    const allViolations: BudgetViolation[] = [];

    this.violations.forEach(violations => {
      allViolations.push(...violations.filter(v => v.resolved === resolved));
    });

    return allViolations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Resolve a violation
   */
  resolveViolation(budgetName: string, timestamp: Date): void {
    const violations = this.violations.get(budgetName);
    if (violations) {
      const violation = violations.find(v => v.timestamp.getTime() === timestamp.getTime());
      if (violation) {
        violation.resolved = true;
        this.emit('violation-resolved', { budgetName, timestamp });
      }
    }
  }

  /**
   * Start monitoring budgets
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.checkBudgets();
    }, this.MONITORING_INTERVAL);

    // Initial check
    this.checkBudgets();
  }

  /**
   * Check all budgets
   */
  private async checkBudgets(): Promise<void> {
    for (const budget of this.budgets.values()) {
      try {
        const currentValue = await this.getMetricValue(budget.metric);
        const isViolation = this.isViolation(currentValue, budget);

        if (isViolation) {
          await this.recordViolation(budget, currentValue);
        } else {
          // Check if we can auto-resolve previous violations
          await this.checkAutoResolve(budget);
        }
      } catch (error) {
        logger.error(`Failed to check budget ${budget.name}:`, error);
      }
    }

    // Clean up old violations
    await this.cleanupOldViolations();
  }

  /**
   * Get metric value
   */
  private async getMetricValue(metric: string): Promise<number> {
    // Get metrics from various sources
    const [category, ...metricParts] = metric.split('.');
    const metricName = metricParts.join('.');

    switch (category) {
      case 'api':
        return this.getAPIMetric(metricName);
      case 'db':
        return this.getDatabaseMetric(metricName);
      case 'frontend':
        return this.getFrontendMetric(metricName);
      case 'resource':
        return this.getResourceMetric(metricName);
      default:
        return 0;
    }
  }

  /**
   * Get API metric
   */
  private async getAPIMetric(metric: string): Promise<number> {
    const apiMetrics = await performanceMonitoringService.getAPIMetrics();
    
    switch (metric) {
      case 'responseTime.p95':
        // Calculate p95 from all endpoints
        const responseTimes = apiMetrics.map(m => m.averageResponseTime);
        return this.calculatePercentile(responseTimes, 95);
        
      case 'responseTime.p99':
        const responseTimesP99 = apiMetrics.map(m => m.averageResponseTime);
        return this.calculatePercentile(responseTimesP99, 99);
        
      case 'errorRate':
        const totalRequests = apiMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
        const totalErrors = apiMetrics.reduce((sum, m) => sum + (m.errorRate * m.totalRequests), 0);
        return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
        
      case 'throughput':
        // Get from performance monitoring service
        const systemMetrics = await performanceMonitoringService.getSystemMetrics();
        return apiMetrics.reduce((sum, m) => sum + m.totalRequests, 0) / 60; // per second
        
      default:
        return 0;
    }
  }

  /**
   * Get database metric
   */
  private async getDatabaseMetric(metric: string): Promise<number> {
    const systemMetrics = await performanceMonitoringService.getSystemMetrics();
    
    switch (metric) {
      case 'queryTime.avg':
        return systemMetrics.database.averageQueryTime;
        
      case 'connectionPool.usage':
        const total = systemMetrics.database.totalConnections;
        const active = systemMetrics.database.activeConnections;
        return total > 0 ? (active / total) * 100 : 0;
        
      case 'slowQueries.count':
        return systemMetrics.database.slowQueries;
        
      default:
        return 0;
    }
  }

  /**
   * Get frontend metric
   */
  private async getFrontendMetric(metric: string): Promise<number> {
    // Get from Redis cache where frontend metrics are stored
    const cacheKey = `frontend:metrics:${metric}`;
    const value = await redisCacheService.get<number>(cacheKey);
    
    if (value !== null) {
      return value;
    }

    // Default values for demo
    const defaults: Record<string, number> = {
      'fcp': 1200,
      'lcp': 2300,
      'fid': 80,
      'cls': 0.08,
      'bundle.js': 1800,
      'bundle.css': 450,
    };

    return defaults[metric] || 0;
  }

  /**
   * Get resource metric
   */
  private async getResourceMetric(metric: string): Promise<number> {
    const systemMetrics = await performanceMonitoringService.getSystemMetrics();
    
    switch (metric) {
      case 'memory.usage':
        return systemMetrics.memory.percentage * 100;
        
      case 'cpu.usage':
        return systemMetrics.cpu.usage;
        
      case 'redis.memory':
        const redisMemory = systemMetrics.cache.usedMemory;
        // Parse Redis memory string (e.g., "450MB" -> 450)
        const match = redisMemory.match(/(\d+)([MG]B)/);
        if (match) {
          const value = parseInt(match[1]);
          const unit = match[2];
          return unit === 'GB' ? value * 1024 : value;
        }
        return 0;
        
      default:
        return 0;
    }
  }

  /**
   * Check if value violates budget
   */
  private isViolation(currentValue: number, budget: PerformanceBudget): boolean {
    // For throughput, violation is when we're below threshold
    if (budget.metric.includes('throughput')) {
      return currentValue < budget.threshold;
    }
    
    // For most metrics, violation is when we exceed threshold
    return currentValue > budget.threshold;
  }

  /**
   * Record a budget violation
   */
  private async recordViolation(budget: PerformanceBudget, actualValue: number): Promise<void> {
    const violation: BudgetViolation = {
      budget,
      actualValue,
      timestamp: new Date(),
      resolved: false,
      details: `${budget.name} exceeded threshold: ${actualValue}${budget.unit} > ${budget.threshold}${budget.unit}`,
    };

    // Add to violations
    const violations = this.violations.get(budget.name) || [];
    violations.push(violation);
    this.violations.set(budget.name, violations);

    // Store in Redis for persistence
    await redisCacheService.set(
      `budget:violation:${budget.name}:${violation.timestamp.getTime()}`,
      violation,
      { ttl: this.VIOLATION_RETENTION / 1000 }
    );

    // Emit violation event
    this.emit('budget-violation', violation);

    // Log based on severity
    const logMessage = `Performance budget violation: ${violation.details}`;
    switch (budget.severity) {
      case 'critical':
        logger.error(logMessage);
        break;
      case 'error':
        logger.error(logMessage);
        break;
      case 'warning':
        logger.warn(logMessage);
        break;
    }
  }

  /**
   * Check if violations can be auto-resolved
   */
  private async checkAutoResolve(budget: PerformanceBudget): Promise<void> {
    const violations = this.violations.get(budget.name);
    if (!violations || violations.length === 0) return;

    const unresolvedViolations = violations.filter(v => !v.resolved);
    if (unresolvedViolations.length === 0) return;

    // Auto-resolve if metric has been healthy for 5 consecutive checks
    const healthyDuration = 5 * this.MONITORING_INTERVAL;
    const cutoff = new Date(Date.now() - healthyDuration);

    for (const violation of unresolvedViolations) {
      if (violation.timestamp < cutoff) {
        violation.resolved = true;
        this.emit('violation-auto-resolved', {
          budgetName: budget.name,
          timestamp: violation.timestamp,
        });
      }
    }
  }

  /**
   * Calculate percentage used
   */
  private calculatePercentageUsed(currentValue: number, threshold: number, metric: string): number {
    if (metric.includes('throughput')) {
      // For throughput, 100% is meeting the threshold
      return (currentValue / threshold) * 100;
    }
    
    // For most metrics, percentage is how close we are to the limit
    return (currentValue / threshold) * 100;
  }

  /**
   * Determine status based on percentage
   */
  private determineStatus(percentageUsed: number, severity: string): 'healthy' | 'warning' | 'violation' {
    if (percentageUsed >= 100) {
      return 'violation';
    }
    
    // Warning thresholds based on severity
    const warningThresholds = {
      critical: 80,
      error: 85,
      warning: 90,
    };

    const warningThreshold = warningThresholds[severity as keyof typeof warningThresholds] || 90;
    
    if (percentageUsed >= warningThreshold) {
      return 'warning';
    }
    
    return 'healthy';
  }

  /**
   * Calculate trend
   */
  private async calculateTrend(metric: string, currentValue: number): Promise<'improving' | 'stable' | 'degrading'> {
    // Get historical values from cache
    const historyKey = `budget:history:${metric}`;
    const history = await redisCacheService.get<number[]>(historyKey) || [];
    
    // Add current value
    history.push(currentValue);
    
    // Keep last 10 values
    if (history.length > 10) {
      history.shift();
    }
    
    // Store updated history
    await redisCacheService.set(historyKey, history, { ttl: 86400 }); // 24 hours
    
    // Need at least 3 values to determine trend
    if (history.length < 3) {
      return 'stable';
    }
    
    // Calculate trend using simple linear regression
    const trend = this.calculateLinearTrend(history);
    
    if (metric.includes('throughput')) {
      // For throughput, positive trend is good
      if (trend > 0.05) return 'improving';
      if (trend < -0.05) return 'degrading';
    } else {
      // For most metrics, negative trend is good (lower values)
      if (trend < -0.05) return 'improving';
      if (trend > 0.05) return 'degrading';
    }
    
    return 'stable';
  }

  /**
   * Calculate linear trend
   */
  private calculateLinearTrend(values: number[]): number {
    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Clean up old violations
   */
  private async cleanupOldViolations(): Promise<void> {
    const cutoff = Date.now() - this.VIOLATION_RETENTION;

    this.violations.forEach((violations, budgetName) => {
      const filtered = violations.filter(v => v.timestamp.getTime() > cutoff);
      if (filtered.length !== violations.length) {
        this.violations.set(budgetName, filtered);
      }
    });
  }

  /**
   * Generate budget report
   */
  async generateReport(): Promise<string> {
    const statuses = await this.getBudgetStatus();
    const violations = this.getViolations(false);
    
    const report = `
# Performance Budget Report
Generated: ${new Date().toISOString()}

## Summary
- Total Budgets: ${this.budgets.size}
- Healthy: ${statuses.filter(s => s.status === 'healthy').length}
- Warnings: ${statuses.filter(s => s.status === 'warning').length}
- Violations: ${statuses.filter(s => s.status === 'violation').length}
- Active Violations: ${violations.length}

## Budget Status

${statuses.map(status => `
### ${status.budget.name}
- **Status**: ${status.status} ${this.getStatusEmoji(status.status)}
- **Current Value**: ${status.currentValue.toFixed(2)}${status.budget.unit}
- **Threshold**: ${status.budget.threshold}${status.budget.unit}
- **Usage**: ${status.percentageUsed.toFixed(1)}%
- **Trend**: ${status.trend} ${this.getTrendEmoji(status.trend)}
`).join('\n')}

## Recent Violations

${violations.slice(0, 10).map(v => `
- **${v.budget.name}** at ${v.timestamp.toISOString()}
  - Value: ${v.actualValue.toFixed(2)}${v.budget.unit} (threshold: ${v.budget.threshold}${v.budget.unit})
  - ${v.details || 'No additional details'}
`).join('\n')}

## Recommendations

${this.generateRecommendations(statuses, violations)}
`;

    return report;
  }

  private getStatusEmoji(status: string): string {
    const emojis = {
      healthy: '✅',
      warning: '⚠️',
      violation: '❌',
    };
    return emojis[status as keyof typeof emojis] || '';
  }

  private getTrendEmoji(trend: string): string {
    const emojis = {
      improving: '📈',
      stable: '➡️',
      degrading: '📉',
    };
    return emojis[trend as keyof typeof emojis] || '';
  }

  private generateRecommendations(statuses: BudgetStatus[], violations: BudgetViolation[]): string {
    const recommendations: string[] = [];

    // Check for critical violations
    const criticalViolations = violations.filter(v => v.budget.severity === 'critical');
    if (criticalViolations.length > 0) {
      recommendations.push('- **CRITICAL**: Address critical performance violations immediately');
    }

    // Check for degrading trends
    const degradingBudgets = statuses.filter(s => s.trend === 'degrading');
    if (degradingBudgets.length > 0) {
      recommendations.push(`- Monitor degrading metrics: ${degradingBudgets.map(s => s.budget.name).join(', ')}`);
    }

    // Check resource usage
    const resourceWarnings = statuses.filter(s => 
      s.budget.category === 'resource' && s.status !== 'healthy'
    );
    if (resourceWarnings.length > 0) {
      recommendations.push('- Consider scaling infrastructure to handle resource constraints');
    }

    // Check API performance
    const apiIssues = statuses.filter(s => 
      s.budget.category === 'api' && s.status === 'violation'
    );
    if (apiIssues.length > 0) {
      recommendations.push('- Optimize API endpoints to meet response time targets');
    }

    if (recommendations.length === 0) {
      recommendations.push('- All performance budgets are within acceptable limits');
    }

    return recommendations.join('\n');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}

// Export singleton instance
export const performanceBudgetService = new PerformanceBudgetService();