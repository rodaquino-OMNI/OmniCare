/**
 * Chaos Engineering Metrics Collection
 * Collects and analyzes metrics during chaos experiments
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { performance } from 'perf_hooks';

export class ChaosMetrics extends EventEmitter {
  private metricsHistory: MetricsSnapshot[] = [];
  private experimentMetrics: Map<string, ExperimentMetrics> = new Map();
  private collectionInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;

  async start(): Promise<void> {
    this.startTime = performance.now();
    
    // Collect metrics every 5 seconds
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000);
    
    console.log('Chaos metrics collection started');
  }

  async stop(): Promise<void> {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    console.log('Chaos metrics collection stopped');
  }

  getSnapshot(): MetricsSnapshot {
    return this.collectMetrics();
  }

  getHistory(minutes: number = 10): MetricsSnapshot[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp > cutoff);
  }

  getExperimentMetrics(experimentName: string): ExperimentMetrics | undefined {
    return this.experimentMetrics.get(experimentName);
  }

  startExperimentMetrics(experimentName: string): void {
    this.experimentMetrics.set(experimentName, {
      name: experimentName,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      baselineMetrics: this.getSnapshot(),
      peakMetrics: this.getSnapshot(),
      averageMetrics: this.getSnapshot(),
      impactMetrics: {},
    });
  }

  endExperimentMetrics(experimentName: string): void {
    const metrics = this.experimentMetrics.get(experimentName);
    if (metrics) {
      metrics.endTime = performance.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.impactMetrics = this.calculateImpact(metrics);
    }
  }

  private collectMetrics(): MetricsSnapshot {
    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      system: this.collectSystemMetrics(),
      application: this.collectApplicationMetrics(),
      database: this.collectDatabaseMetrics(),
      network: this.collectNetworkMetrics(),
      custom: this.collectCustomMetrics(),
    };

    // Store in history (keep last 1000 snapshots)
    this.metricsHistory.push(snapshot);
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory.shift();
    }

    // Update experiment metrics
    this.updateExperimentMetrics(snapshot);

    this.emit('metricsCollected', snapshot);
    return snapshot;
  }

  private collectSystemMetrics(): SystemMetrics {
    const memInfo = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      cpuUsage: this.getCpuUsage(),
      memoryUsage: (usedMem / totalMem) * 100,
      memoryUsageBytes: usedMem,
      totalMemoryBytes: totalMem,
      heapUsed: memInfo.heapUsed,
      heapTotal: memInfo.heapTotal,
      rss: memInfo.rss,
      external: memInfo.external,
      loadAverage: os.loadavg(),
      uptime: os.uptime(),
      processUptime: process.uptime(),
    };
  }

  private collectApplicationMetrics(): ApplicationMetrics {
    return {
      requestCount: this.getRequestCount(),
      errorCount: this.getErrorCount(),
      errorRate: this.getErrorRate(),
      avgResponseTime: this.getAverageResponseTime(),
      p95ResponseTime: this.getP95ResponseTime(),
      p99ResponseTime: this.getP99ResponseTime(),
      activeConnections: this.getActiveConnections(),
      throughput: this.getThroughput(),
      eventLoopLag: this.getEventLoopLag(),
    };
  }

  private collectDatabaseMetrics(): DatabaseMetrics {
    return {
      connectionPoolSize: this.getDbConnectionPoolSize(),
      activeConnections: this.getDbActiveConnections(),
      idleConnections: this.getDbIdleConnections(),
      waitingConnections: this.getDbWaitingConnections(),
      queryCount: this.getDbQueryCount(),
      avgQueryTime: this.getDbAvgQueryTime(),
      slowQueries: this.getDbSlowQueries(),
      connectionErrors: this.getDbConnectionErrors(),
    };
  }

  private collectNetworkMetrics(): NetworkMetrics {
    return {
      bytesIn: this.getNetworkBytesIn(),
      bytesOut: this.getNetworkBytesOut(),
      packetsIn: this.getNetworkPacketsIn(),
      packetsOut: this.getNetworkPacketsOut(),
      tcpConnections: this.getTcpConnections(),
      httpConnections: this.getHttpConnections(),
      externalApiCalls: this.getExternalApiCalls(),
      externalApiErrors: this.getExternalApiErrors(),
    };
  }

  private collectCustomMetrics(): CustomMetrics {
    return {
      fhirOperations: this.getFhirOperations(),
      patientAccess: this.getPatientAccess(),
      auditEvents: this.getAuditEvents(),
      securityAlerts: this.getSecurityAlerts(),
      businessMetrics: this.getBusinessMetrics(),
    };
  }

  private updateExperimentMetrics(snapshot: MetricsSnapshot): void {
    this.experimentMetrics.forEach((metrics, experimentName) => {
      if (metrics.endTime === 0) { // Still running
        // Update peak metrics
        if (snapshot.system.cpuUsage > metrics.peakMetrics.system.cpuUsage) {
          metrics.peakMetrics = { ...snapshot };
        }
        
        // Update running averages (simplified)
        metrics.averageMetrics = this.calculateRunningAverage(
          metrics.averageMetrics,
          snapshot,
          metrics.duration
        );
      }
    });
  }

  private calculateImpact(metrics: ExperimentMetrics): ImpactMetrics {
    const baseline = metrics.baselineMetrics;
    const peak = metrics.peakMetrics;
    const average = metrics.averageMetrics;

    return {
      cpuImpact: ((peak.system.cpuUsage - baseline.system.cpuUsage) / baseline.system.cpuUsage) * 100,
      memoryImpact: ((peak.system.memoryUsage - baseline.system.memoryUsage) / baseline.system.memoryUsage) * 100,
      responseTimeImpact: ((peak.application.avgResponseTime - baseline.application.avgResponseTime) / baseline.application.avgResponseTime) * 100,
      errorRateImpact: peak.application.errorRate - baseline.application.errorRate,
      throughputImpact: ((average.application.throughput - baseline.application.throughput) / baseline.application.throughput) * 100,
    };
  }

  private calculateRunningAverage(current: MetricsSnapshot, latest: MetricsSnapshot, duration: number): MetricsSnapshot {
    // Simplified running average calculation
    const weight = Math.min(duration / 60000, 1); // Max weight after 1 minute
    
    return {
      timestamp: latest.timestamp,
      system: {
        ...current.system,
        cpuUsage: current.system.cpuUsage * (1 - weight) + latest.system.cpuUsage * weight,
        memoryUsage: current.system.memoryUsage * (1 - weight) + latest.system.memoryUsage * weight,
      },
      application: {
        ...current.application,
        avgResponseTime: current.application.avgResponseTime * (1 - weight) + latest.application.avgResponseTime * weight,
        errorRate: current.application.errorRate * (1 - weight) + latest.application.errorRate * weight,
      },
      database: current.database,
      network: current.network,
      custom: current.custom,
    };
  }

  // Helper methods to collect actual metrics
  private getCpuUsage(): number {
    // In a real implementation, this would track CPU usage over time
    return Math.random() * 100; // Mock value
  }

  private getRequestCount(): number {
    // Mock implementation
    return Math.floor(Math.random() * 1000);
  }

  private getErrorCount(): number {
    return Math.floor(Math.random() * 10);
  }

  private getErrorRate(): number {
    return (this.getErrorCount() / this.getRequestCount()) * 100;
  }

  private getAverageResponseTime(): number {
    return Math.random() * 1000 + 100;
  }

  private getP95ResponseTime(): number {
    return this.getAverageResponseTime() * 1.5;
  }

  private getP99ResponseTime(): number {
    return this.getAverageResponseTime() * 2;
  }

  private getActiveConnections(): number {
    return Math.floor(Math.random() * 100);
  }

  private getThroughput(): number {
    return Math.random() * 1000;
  }

  private getEventLoopLag(): number {
    return Math.random() * 10;
  }

  private getDbConnectionPoolSize(): number {
    return 20; // Mock value
  }

  private getDbActiveConnections(): number {
    return Math.floor(Math.random() * 15);
  }

  private getDbIdleConnections(): number {
    return 20 - this.getDbActiveConnections();
  }

  private getDbWaitingConnections(): number {
    return Math.floor(Math.random() * 5);
  }

  private getDbQueryCount(): number {
    return Math.floor(Math.random() * 500);
  }

  private getDbAvgQueryTime(): number {
    return Math.random() * 100 + 10;
  }

  private getDbSlowQueries(): number {
    return Math.floor(Math.random() * 3);
  }

  private getDbConnectionErrors(): number {
    return Math.floor(Math.random() * 2);
  }

  private getNetworkBytesIn(): number {
    return Math.floor(Math.random() * 1000000);
  }

  private getNetworkBytesOut(): number {
    return Math.floor(Math.random() * 1000000);
  }

  private getNetworkPacketsIn(): number {
    return Math.floor(Math.random() * 10000);
  }

  private getNetworkPacketsOut(): number {
    return Math.floor(Math.random() * 10000);
  }

  private getTcpConnections(): number {
    return Math.floor(Math.random() * 100);
  }

  private getHttpConnections(): number {
    return Math.floor(Math.random() * 50);
  }

  private getExternalApiCalls(): number {
    return Math.floor(Math.random() * 100);
  }

  private getExternalApiErrors(): number {
    return Math.floor(Math.random() * 5);
  }

  private getFhirOperations(): number {
    return Math.floor(Math.random() * 200);
  }

  private getPatientAccess(): number {
    return Math.floor(Math.random() * 50);
  }

  private getAuditEvents(): number {
    return Math.floor(Math.random() * 20);
  }

  private getSecurityAlerts(): number {
    return Math.floor(Math.random() * 2);
  }

  private getBusinessMetrics(): Record<string, number> {
    return {
      appointmentsScheduled: Math.floor(Math.random() * 10),
      patientsRegistered: Math.floor(Math.random() * 5),
      prescriptionsIssued: Math.floor(Math.random() * 15),
    };
  }
}

// Type definitions
export interface MetricsSnapshot {
  timestamp: number;
  system: SystemMetrics;
  application: ApplicationMetrics;
  database: DatabaseMetrics;
  network: NetworkMetrics;
  custom: CustomMetrics;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  memoryUsageBytes: number;
  totalMemoryBytes: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  loadAverage: number[];
  uptime: number;
  processUptime: number;
}

export interface ApplicationMetrics {
  requestCount: number;
  errorCount: number;
  errorRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  activeConnections: number;
  throughput: number;
  eventLoopLag: number;
}

export interface DatabaseMetrics {
  connectionPoolSize: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  queryCount: number;
  avgQueryTime: number;
  slowQueries: number;
  connectionErrors: number;
}

export interface NetworkMetrics {
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  tcpConnections: number;
  httpConnections: number;
  externalApiCalls: number;
  externalApiErrors: number;
}

export interface CustomMetrics {
  fhirOperations: number;
  patientAccess: number;
  auditEvents: number;
  securityAlerts: number;
  businessMetrics: Record<string, number>;
}

export interface ExperimentMetrics {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  baselineMetrics: MetricsSnapshot;
  peakMetrics: MetricsSnapshot;
  averageMetrics: MetricsSnapshot;
  impactMetrics: ImpactMetrics;
}

export interface ImpactMetrics {
  cpuImpact: number;
  memoryImpact: number;
  responseTimeImpact: number;
  errorRateImpact: number;
  throughputImpact: number;
}