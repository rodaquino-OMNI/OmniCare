/**
 * Metrics Collector Service
 * Collects and aggregates system metrics
 */

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface MetricsSummary {
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  uptime: number;
}

export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private startTime: Date = new Date();

  record(name: string, value: number, labels?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      labels
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);

    // Keep only last 1000 metrics per type
    const metricArray = this.metrics.get(name)!;
    if (metricArray.length > 1000) {
      metricArray.splice(0, metricArray.length - 1000);
    }
  }

  getMetric(name: string): Metric[] {
    return this.metrics.get(name) || [];
  }

  getSummary(): MetricsSummary {
    const requests = this.getMetric('requests');
    const errors = this.getMetric('errors');
    const responseTimes = this.getMetric('response_time');

    return {
      totalRequests: requests.length,
      errorRate: requests.length > 0 ? errors.length / requests.length : 0,
      averageResponseTime: responseTimes.length > 0 
        ? responseTimes.reduce((sum, m) => sum + m.value, 0) / responseTimes.length 
        : 0,
      uptime: Date.now() - this.startTime.getTime()
    };
  }

  reset(): void {
    this.metrics.clear();
    this.startTime = new Date();
  }
}

export const metricsCollector = new MetricsCollector();