/**
 * Real-time API Monitoring Service
 * Monitors API endpoints and tracks performance metrics
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

import { Request, Response, NextFunction } from 'express';

interface APIMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: string;
  userAgent?: string;
  ip?: string;
  contentLength?: number;
  errorMessage?: string;
}

interface EndpointStats {
  endpoint: string;
  method: string;
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerMinute: number;
  errorRate: number;
  lastActivity: string;
  recentResponseTimes: number[];
}

interface AlertRule {
  id: string;
  name: string;
  endpoint?: string;
  condition: 'response_time' | 'error_rate' | 'requests_per_minute' | 'success_rate';
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  timeWindowMinutes: number;
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: string;
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  endpoint: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
}

export class APIMonitoringService extends EventEmitter {
  private metrics: APIMetric[] = [];
  private endpointStats: Map<string, EndpointStats> = new Map();
  private alertRules: AlertRule[] = [];
  private activeAlerts: Alert[] = [];
  private maxMetricsInMemory = 10000;
  private metricsFile = path.join(__dirname, '../data/api-metrics.jsonl');
  private alertsFile = path.join(__dirname, '../data/alerts.json');
  private isEnabled = true;

  constructor() {
    super();
    this.initializeDefaultAlertRules();
    this.startCleanupInterval();
    this.startAlertChecker();
  }

  /**
   * Express middleware to track API requests
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.isEnabled) {
        return next();
      }

      const startTime = performance.now();
      const originalSend = res.send;
      const originalJson = res.json;

      // Override response methods to capture metrics
      res.send = function(body?: any) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        setImmediate(() => {
          APIMonitoringService.getInstance().recordMetric({
            endpoint: req.route?.path || req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseTime,
            timestamp: new Date().toISOString(),
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            contentLength: Buffer.byteLength(body || '', 'utf8')
          });
        });

        return originalSend.call(this, body);
      };

      res.json = function(obj?: any) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        setImmediate(() => {
          APIMonitoringService.getInstance().recordMetric({
            endpoint: req.route?.path || req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseTime,
            timestamp: new Date().toISOString(),
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            contentLength: Buffer.byteLength(JSON.stringify(obj || {}), 'utf8')
          });
        });

        return originalJson.call(this, obj);
      };

      next();
    };
  }

  /**
   * Record API metric
   */
  recordMetric(metric: APIMetric): void {
    this.metrics.push(metric);
    this.updateEndpointStats(metric);
    
    // Emit metric event for real-time monitoring
    this.emit('metric', metric);
    
    // Keep metrics in memory under limit
    if (this.metrics.length > this.maxMetricsInMemory) {
      this.metrics = this.metrics.slice(-this.maxMetricsInMemory);
    }
    
    // Write to file for persistence (async)
    this.writeMetricToFile(metric).catch(console.error);
  }

  /**
   * Update endpoint statistics
   */
  private updateEndpointStats(metric: APIMetric): void {
    const key = `${metric.method}:${metric.endpoint}`;
    let stats = this.endpointStats.get(key);
    
    if (!stats) {
      stats = {
        endpoint: metric.endpoint,
        method: metric.method,
        totalRequests: 0,
        successRate: 100,
        avgResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerMinute: 0,
        errorRate: 0,
        lastActivity: metric.timestamp,
        recentResponseTimes: []
      };
      this.endpointStats.set(key, stats);
    }
    
    // Update basic stats
    stats.totalRequests++;
    stats.lastActivity = metric.timestamp;
    stats.recentResponseTimes.push(metric.responseTime);
    
    // Keep only recent response times (last 1000)
    if (stats.recentResponseTimes.length > 1000) {
      stats.recentResponseTimes = stats.recentResponseTimes.slice(-1000);
    }
    
    // Calculate response time stats
    const responseTimes = stats.recentResponseTimes.slice().sort((a, b) => a - b);
    stats.avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    stats.minResponseTime = Math.min(stats.minResponseTime, metric.responseTime);
    stats.maxResponseTime = Math.max(stats.maxResponseTime, metric.responseTime);
    stats.p50ResponseTime = this.getPercentile(responseTimes, 50);
    stats.p95ResponseTime = this.getPercentile(responseTimes, 95);
    stats.p99ResponseTime = this.getPercentile(responseTimes, 99);
    
    // Calculate success rate
    const recentMetrics = this.getRecentMetrics(metric.endpoint, metric.method, 5); // Last 5 minutes
    const successfulRequests = recentMetrics.filter(m => m.statusCode < 400).length;
    stats.successRate = recentMetrics.length > 0 ? (successfulRequests / recentMetrics.length) * 100 : 100;
    stats.errorRate = 100 - stats.successRate;
    
    // Calculate requests per minute
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const recentMinuteMetrics = recentMetrics.filter(m => m.timestamp > oneMinuteAgo);
    stats.requestsPerMinute = recentMinuteMetrics.length;
  }

  /**
   * Get percentile from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] ?? 0;
  }

  /**
   * Get recent metrics for an endpoint
   */
  private getRecentMetrics(endpoint: string, method: string, minutesBack: number): APIMetric[] {
    const cutoff = new Date(Date.now() - minutesBack * 60000).toISOString();
    return this.metrics.filter(m => 
      m.endpoint === endpoint && 
      m.method === method && 
      m.timestamp > cutoff
    );
  }

  /**
   * Get endpoint statistics
   */
  getEndpointStats(): EndpointStats[] {
    return Array.from(this.endpointStats.values());
  }

  /**
   * Get statistics for a specific endpoint
   */
  getEndpointStat(endpoint: string, method: string): EndpointStats | undefined {
    return this.endpointStats.get(`${method}:${endpoint}`);
  }

  /**
   * Get recent metrics
   */
  getRecentMetricsAll(minutes: number = 60): APIMetric[] {
    const cutoff = new Date(Date.now() - minutes * 60000).toISOString();
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'high-response-time',
        name: 'High Response Time',
        condition: 'response_time',
        operator: 'gt',
        threshold: 2000, // 2 seconds
        timeWindowMinutes: 5,
        enabled: true,
        cooldownMinutes: 10
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: 'error_rate',
        operator: 'gt',
        threshold: 5, // 5%
        timeWindowMinutes: 5,
        enabled: true,
        cooldownMinutes: 15
      },
      {
        id: 'low-success-rate',
        name: 'Low Success Rate',
        condition: 'success_rate',
        operator: 'lt',
        threshold: 95, // 95%
        timeWindowMinutes: 5,
        enabled: true,
        cooldownMinutes: 15
      },
      {
        id: 'fhir-patient-slow',
        name: 'FHIR Patient API Slow',
        endpoint: '/fhir/R4/Patient',
        condition: 'response_time',
        operator: 'gt',
        threshold: 500, // 500ms
        timeWindowMinutes: 3,
        enabled: true,
        cooldownMinutes: 5
      },
      {
        id: 'fhir-observation-slow',
        name: 'FHIR Observation API Slow',
        endpoint: '/fhir/R4/Observation',
        condition: 'response_time',
        operator: 'gt',
        threshold: 300, // 300ms
        timeWindowMinutes: 3,
        enabled: true,
        cooldownMinutes: 5
      }
    ];
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const newRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    this.alertRules.push(newRule);
    return newRule;
  }

  /**
   * Update alert rule
   */
  updateAlertRule(id: string, updates: Partial<AlertRule>): boolean {
    const ruleIndex = this.alertRules.findIndex(r => r.id === id);
    if (ruleIndex === -1) return false;
    
    const existingRule = this.alertRules[ruleIndex];
    if (!existingRule) return false;
    
    // Create a new rule by merging only defined properties from updates
    const updatedRule: AlertRule = {
      id: existingRule.id,
      name: updates.name ?? existingRule.name,
      endpoint: updates.endpoint !== undefined ? updates.endpoint : existingRule.endpoint,
      condition: updates.condition ?? existingRule.condition,
      operator: updates.operator ?? existingRule.operator,
      threshold: updates.threshold ?? existingRule.threshold,
      timeWindowMinutes: updates.timeWindowMinutes ?? existingRule.timeWindowMinutes,
      enabled: updates.enabled ?? existingRule.enabled,
      cooldownMinutes: updates.cooldownMinutes ?? existingRule.cooldownMinutes,
      lastTriggered: updates.lastTriggered !== undefined ? updates.lastTriggered : existingRule.lastTriggered
    };
    
    this.alertRules[ruleIndex] = updatedRule;
    return true;
  }

  /**
   * Delete alert rule
   */
  deleteAlertRule(id: string): boolean {
    const ruleIndex = this.alertRules.findIndex(r => r.id === id);
    if (ruleIndex === -1) return false;
    
    this.alertRules.splice(ruleIndex, 1);
    return true;
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  /**
   * Check alert rules and trigger alerts
   */
  private checkAlerts(): void {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;
      
      // Check cooldown
      if (rule.lastTriggered) {
        const lastTriggered = new Date(rule.lastTriggered);
        const cooldownExpiry = new Date(lastTriggered.getTime() + rule.cooldownMinutes * 60000);
        if (new Date() < cooldownExpiry) continue;
      }
      
      this.evaluateAlertRule(rule);
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private evaluateAlertRule(rule: AlertRule): void {
    const endpointStats = rule.endpoint ? 
      [this.endpointStats.get(`GET:${rule.endpoint}`), this.endpointStats.get(`POST:${rule.endpoint}`)]
        .filter(Boolean) as EndpointStats[] :
      Array.from(this.endpointStats.values());
    
    for (const stats of endpointStats) {
      if (!stats) continue;
      
      let value: number;
      let shouldAlert = false;
      
      switch (rule.condition) {
        case 'response_time':
          value = stats.avgResponseTime;
          break;
        case 'error_rate':
          value = stats.errorRate;
          break;
        case 'success_rate':
          value = stats.successRate;
          break;
        case 'requests_per_minute':
          value = stats.requestsPerMinute;
          break;
        default:
          continue;
      }
      
      // Check condition
      switch (rule.operator) {
        case 'gt':
          shouldAlert = value > rule.threshold;
          break;
        case 'gte':
          shouldAlert = value >= rule.threshold;
          break;
        case 'lt':
          shouldAlert = value < rule.threshold;
          break;
        case 'lte':
          shouldAlert = value <= rule.threshold;
          break;
        case 'eq':
          shouldAlert = value === rule.threshold;
          break;
      }
      
      if (shouldAlert) {
        this.triggerAlert(rule, stats, value);
        rule.lastTriggered = new Date().toISOString();
      }
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, stats: EndpointStats, value: number): void {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      endpoint: `${stats.method} ${stats.endpoint}`,
      message: this.generateAlertMessage(rule, stats, value),
      severity: this.calculateSeverity(rule, value),
      value,
      threshold: rule.threshold,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.activeAlerts.push(alert);
    
    // Keep only recent alerts (last 1000)
    if (this.activeAlerts.length > 1000) {
      this.activeAlerts = this.activeAlerts.slice(-1000);
    }
    
    // Emit alert event
    this.emit('alert', alert);
    
    // Log alert
    console.warn(`🚨 ALERT: ${alert.message}`);
    
    // Save alerts
    this.saveAlerts().catch(console.error);
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, stats: EndpointStats, value: number): string {
    const endpoint = `${stats.method} ${stats.endpoint}`;
    const unit = this.getConditionUnit(rule.condition);
    
    return `${rule.name}: ${endpoint} ${rule.condition} is ${value.toFixed(2)}${unit} (threshold: ${rule.threshold}${unit})`;
  }

  /**
   * Calculate alert severity
   */
  private calculateSeverity(rule: AlertRule, value: number): 'low' | 'medium' | 'high' | 'critical' {
    const deviation = Math.abs(value - rule.threshold) / rule.threshold;
    
    if (deviation > 1.0) return 'critical';
    if (deviation > 0.5) return 'high';
    if (deviation > 0.25) return 'medium';
    return 'low';
  }

  /**
   * Get unit for condition
   */
  private getConditionUnit(condition: string): string {
    switch (condition) {
      case 'response_time': return 'ms';
      case 'error_rate': return '%';
      case 'success_rate': return '%';
      case 'requests_per_minute': return '/min';
      default: return '';
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return [...this.activeAlerts];
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.find(a => a.id === alertId);
    if (!alert) return false;
    
    alert.acknowledged = true;
    this.saveAlerts().catch(console.error);
    return true;
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(hoursOld: number = 24): number {
    const cutoff = new Date(Date.now() - hoursOld * 3600000).toISOString();
    const initialCount = this.activeAlerts.length;
    this.activeAlerts = this.activeAlerts.filter(a => a.timestamp > cutoff);
    return initialCount - this.activeAlerts.length;
  }

  /**
   * Write metric to file
   */
  private async writeMetricToFile(metric: APIMetric): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.metricsFile), { recursive: true });
      await fs.appendFile(this.metricsFile, JSON.stringify(metric) + '\n');
    } catch (error) {
      console.error('Error writing metric to file:', error);
    }
  }

  /**
   * Save alerts to file
   */
  private async saveAlerts(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.alertsFile), { recursive: true });
      await fs.writeFile(this.alertsFile, JSON.stringify(this.activeAlerts, null, 2));
    } catch (error) {
      console.error('Error saving alerts:', error);
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      // Clean old metrics from memory
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const beforeCount = this.metrics.length;
      this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
      
      if (beforeCount !== this.metrics.length) {
        console.log(`🧹 Cleaned ${beforeCount - this.metrics.length} old metrics from memory`);
      }
      
      // Clean old alerts
      const clearedCount = this.clearOldAlerts(24);
      if (clearedCount > 0) {
        console.log(`🧹 Cleared ${clearedCount} old alerts`);
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Start alert checker
   */
  private startAlertChecker(): void {
    setInterval(() => {
      this.checkAlerts();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Enable monitoring
   */
  enable(): void {
    this.isEnabled = true;
    console.log('✅ API monitoring enabled');
  }

  /**
   * Disable monitoring
   */
  disable(): void {
    this.isEnabled = false;
    console.log('⏸️  API monitoring disabled');
  }

  /**
   * Get monitoring status
   */
  isMonitoringEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get summary statistics
   */
  getSummaryStats(): any {
    const stats = Array.from(this.endpointStats.values());
    
    return {
      totalEndpoints: stats.length,
      totalRequests: stats.reduce((sum, s) => sum + s.totalRequests, 0),
      avgResponseTime: stats.reduce((sum, s) => sum + s.avgResponseTime, 0) / stats.length || 0,
      overallSuccessRate: stats.reduce((sum, s) => sum + s.successRate, 0) / stats.length || 100,
      totalAlerts: this.activeAlerts.length,
      unacknowledgedAlerts: this.activeAlerts.filter(a => !a.acknowledged).length,
      monitoringEnabled: this.isEnabled,
      lastActivity: Math.max(...stats.map(s => new Date(s.lastActivity).getTime())),
      endpointCount: {
        healthy: stats.filter(s => s.successRate > 95 && s.avgResponseTime < 500).length,
        warning: stats.filter(s => (s.successRate <= 95 && s.successRate > 90) || (s.avgResponseTime >= 500 && s.avgResponseTime < 2000)).length,
        critical: stats.filter(s => s.successRate <= 90 || s.avgResponseTime >= 2000).length
      }
    };
  }

  // Singleton pattern
  private static instance: APIMonitoringService;
  
  static getInstance(): APIMonitoringService {
    if (!APIMonitoringService.instance) {
      APIMonitoringService.instance = new APIMonitoringService();
    }
    return APIMonitoringService.instance;
  }
}