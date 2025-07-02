/**
 * Chaos Engineering Reporter
 * Generates reports and visualizations for chaos experiments
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { ChaosExperimentResult } from './chaos-engine';
import { MetricsSnapshot, ExperimentMetrics } from './chaos-metrics';
import { ChaosExperiment } from './chaos.config';

export class ChaosReporter {
  private reportsDir: string;

  constructor(reportsDir: string = './chaos-reports') {
    this.reportsDir = reportsDir;
    this.ensureReportsDirectory();
  }

  private async ensureReportsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create reports directory:', error);
    }
  }

  async reportExperiment(
    experiment: ChaosExperiment,
    result: ChaosExperimentResult,
    metrics?: ExperimentMetrics
  ): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${experiment.name.replace(/\s+/g, '-')}-${timestamp}`;

    // Generate JSON report
    await this.generateJSONReport(experiment, result, metrics, filename);

    // Generate HTML report
    await this.generateHTMLReport(experiment, result, metrics, filename);

    // Generate summary report
    await this.updateSummaryReport(experiment, result);

    console.log(`Chaos experiment report generated: ${filename}`);
  }

  async generateJSONReport(
    experiment: ChaosExperiment,
    result: ChaosExperimentResult,
    metrics: ExperimentMetrics | undefined,
    filename: string
  ): Promise<void> {
    const report = {
      metadata: {
        reportVersion: '1.0',
        generatedAt: new Date().toISOString(),
        reporter: 'OmniCare Chaos Reporter',
      },
      experiment: {
        name: experiment.name,
        description: experiment.description,
        type: experiment.type,
        duration: experiment.duration,
        targets: experiment.targets,
        parameters: experiment.parameters,
        safeguards: experiment.safeguards,
      },
      execution: {
        startTime: new Date(result.startTime).toISOString(),
        endTime: new Date(result.endTime).toISOString(),
        duration: result.duration,
        success: result.success,
        errors: result.errors,
      },
      metrics: metrics || {},
      impact: this.calculateImpact(metrics),
      recommendations: this.generateRecommendations(experiment, result, metrics),
    };

    const filepath = path.join(this.reportsDir, `${filename}.json`);
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
  }

  async generateHTMLReport(
    experiment: ChaosExperiment,
    result: ChaosExperimentResult,
    metrics: ExperimentMetrics | undefined,
    filename: string
  ): Promise<void> {
    const html = this.generateHTMLContent(experiment, result, metrics);
    const filepath = path.join(this.reportsDir, `${filename}.html`);
    await fs.writeFile(filepath, html);
  }

  async updateSummaryReport(
    experiment: ChaosExperiment,
    result: ChaosExperimentResult
  ): Promise<void> {
    const summaryPath = path.join(this.reportsDir, 'summary.json');
    
    let summary: any = {
      lastUpdated: new Date().toISOString(),
      totalExperiments: 0,
      successfulExperiments: 0,
      failedExperiments: 0,
      experimentsByType: {},
      recentExperiments: [],
    };

    try {
      const existing = await fs.readFile(summaryPath, 'utf-8');
      summary = JSON.parse(existing);
    } catch (error) {
      // File doesn't exist yet, use default
    }

    // Update summary
    summary.lastUpdated = new Date().toISOString();
    summary.totalExperiments++;
    
    if (result.success) {
      summary.successfulExperiments++;
    } else {
      summary.failedExperiments++;
    }

    // Update by type
    if (!summary.experimentsByType[experiment.type]) {
      summary.experimentsByType[experiment.type] = { total: 0, successful: 0, failed: 0 };
    }
    summary.experimentsByType[experiment.type].total++;
    if (result.success) {
      summary.experimentsByType[experiment.type].successful++;
    } else {
      summary.experimentsByType[experiment.type].failed++;
    }

    // Add to recent experiments
    summary.recentExperiments.unshift({
      name: experiment.name,
      type: experiment.type,
      timestamp: new Date().toISOString(),
      success: result.success,
      duration: result.duration,
    });

    // Keep only last 50 experiments
    summary.recentExperiments = summary.recentExperiments.slice(0, 50);

    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  }

  private calculateImpact(metrics: ExperimentMetrics | undefined): any {
    if (!metrics) {
      return {
        severity: 'UNKNOWN',
        description: 'No metrics available',
      };
    }

    const impact = metrics.impactMetrics;
    let severity = 'LOW';
    const issues = [];

    if (impact.cpuImpact > 50) {
      severity = 'HIGH';
      issues.push(`CPU usage increased by ${impact.cpuImpact.toFixed(1)}%`);
    } else if (impact.cpuImpact > 20) {
      severity = 'MEDIUM';
      issues.push(`CPU usage increased by ${impact.cpuImpact.toFixed(1)}%`);
    }

    if (impact.memoryImpact > 30) {
      severity = 'HIGH';
      issues.push(`Memory usage increased by ${impact.memoryImpact.toFixed(1)}%`);
    } else if (impact.memoryImpact > 15) {
      severity = 'MEDIUM';
      issues.push(`Memory usage increased by ${impact.memoryImpact.toFixed(1)}%`);
    }

    if (impact.responseTimeImpact > 100) {
      severity = 'HIGH';
      issues.push(`Response time increased by ${impact.responseTimeImpact.toFixed(1)}%`);
    } else if (impact.responseTimeImpact > 50) {
      severity = 'MEDIUM';
      issues.push(`Response time increased by ${impact.responseTimeImpact.toFixed(1)}%`);
    }

    if (impact.errorRateImpact > 5) {
      severity = 'HIGH';
      issues.push(`Error rate increased by ${impact.errorRateImpact.toFixed(1)}%`);
    } else if (impact.errorRateImpact > 2) {
      severity = 'MEDIUM';
      issues.push(`Error rate increased by ${impact.errorRateImpact.toFixed(1)}%`);
    }

    return {
      severity,
      issues,
      description: issues.length > 0 ? issues.join('; ') : 'Minimal impact observed',
    };
  }

  private generateRecommendations(
    experiment: ChaosExperiment,
    result: ChaosExperimentResult,
    metrics: ExperimentMetrics | undefined
  ): string[] {
    const recommendations = [];

    if (!result.success) {
      recommendations.push('Experiment failed - investigate safeguard triggers or system issues');
    }

    if (metrics && metrics.impactMetrics.cpuImpact > 50) {
      recommendations.push('Consider CPU optimization or scaling strategies');
    }

    if (metrics && metrics.impactMetrics.memoryImpact > 30) {
      recommendations.push('Review memory management and consider memory optimization');
    }

    if (metrics && metrics.impactMetrics.responseTimeImpact > 100) {
      recommendations.push('Investigate response time degradation - consider caching or optimization');
    }

    if (metrics && metrics.impactMetrics.errorRateImpact > 5) {
      recommendations.push('High error rate increase - review error handling and resilience patterns');
    }

    if (experiment.type === 'database' && result.success) {
      recommendations.push('Consider implementing database connection pooling improvements');
    }

    if (experiment.type === 'network' && result.success) {
      recommendations.push('Review circuit breaker patterns and retry mechanisms');
    }

    if (recommendations.length === 0) {
      recommendations.push('System demonstrated good resilience - no immediate action required');
    }

    return recommendations;
  }

  private generateHTMLContent(
    experiment: ChaosExperiment,
    result: ChaosExperimentResult,
    metrics: ExperimentMetrics | undefined
  ): string {
    const impact = this.calculateImpact(metrics);
    const recommendations = this.generateRecommendations(experiment, result, metrics);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chaos Experiment Report: ${experiment.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .failure { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6; }
        .metric-value { font-size: 1.5em; font-weight: bold; color: #495057; }
        .chart-placeholder { background: #e9ecef; height: 200px; display: flex; align-items: center; justify-content: center; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .recommendations { background: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Chaos Experiment Report</h1>
        <h2>${experiment.name}</h2>
        <p><strong>Type:</strong> ${experiment.type}</p>
        <p><strong>Description:</strong> ${experiment.description}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </div>

    <div class="status ${result.success ? 'success' : 'failure'}">
        <h3>Execution Status: ${result.success ? 'SUCCESS' : 'FAILED'}</h3>
        <p><strong>Duration:</strong> ${(result.duration / 1000).toFixed(2)} seconds</p>
        <p><strong>Start Time:</strong> ${new Date(result.startTime).toLocaleString()}</p>
        <p><strong>End Time:</strong> ${new Date(result.endTime).toLocaleString()}</p>
        ${result.errors.length > 0 ? '<p><strong>Errors:</strong> ' + result.errors.join(', ') + '</p>' : ''}
    </div>

    <div class="status ${impact.severity === 'HIGH' ? 'failure' : impact.severity === 'MEDIUM' ? 'warning' : 'info'}">
        <h3>Impact Assessment: ${impact.severity}</h3>
        <p>${impact.description}</p>
    </div>

    <h3>Experiment Configuration</h3>
    <table>
        <tr><th>Parameter</th><th>Value</th></tr>
        <tr><td>Duration</td><td>${experiment.duration}ms</td></tr>
        <tr><td>Targets</td><td>${experiment.targets.join(', ')}</td></tr>
        <tr><td>Probability</td><td>${experiment.probability}</td></tr>
        ${Object.entries(experiment.parameters).map(([key, value]) => 
          `<tr><td>${key}</td><td>${JSON.stringify(value)}</td></tr>`
        ).join('')}
    </table>

    ${metrics ? `
    <h3>Performance Metrics</h3>
    <div class="metrics">
        <div class="metric-card">
            <h4>CPU Impact</h4>
            <div class="metric-value">${metrics.impactMetrics.cpuImpact.toFixed(1)}%</div>
        </div>
        <div class="metric-card">
            <h4>Memory Impact</h4>
            <div class="metric-value">${metrics.impactMetrics.memoryImpact.toFixed(1)}%</div>
        </div>
        <div class="metric-card">
            <h4>Response Time Impact</h4>
            <div class="metric-value">${metrics.impactMetrics.responseTimeImpact.toFixed(1)}%</div>
        </div>
        <div class="metric-card">
            <h4>Error Rate Impact</h4>
            <div class="metric-value">${metrics.impactMetrics.errorRateImpact.toFixed(1)}%</div>
        </div>
    </div>

    <h4>Baseline vs Peak Metrics</h4>
    <table>
        <tr><th>Metric</th><th>Baseline</th><th>Peak</th><th>Change</th></tr>
        <tr>
            <td>CPU Usage</td>
            <td>${metrics.baselineMetrics.system.cpuUsage.toFixed(1)}%</td>
            <td>${metrics.peakMetrics.system.cpuUsage.toFixed(1)}%</td>
            <td>${(metrics.peakMetrics.system.cpuUsage - metrics.baselineMetrics.system.cpuUsage).toFixed(1)}%</td>
        </tr>
        <tr>
            <td>Memory Usage</td>
            <td>${metrics.baselineMetrics.system.memoryUsage.toFixed(1)}%</td>
            <td>${metrics.peakMetrics.system.memoryUsage.toFixed(1)}%</td>
            <td>${(metrics.peakMetrics.system.memoryUsage - metrics.baselineMetrics.system.memoryUsage).toFixed(1)}%</td>
        </tr>
        <tr>
            <td>Avg Response Time</td>
            <td>${metrics.baselineMetrics.application.avgResponseTime.toFixed(0)}ms</td>
            <td>${metrics.peakMetrics.application.avgResponseTime.toFixed(0)}ms</td>
            <td>${(metrics.peakMetrics.application.avgResponseTime - metrics.baselineMetrics.application.avgResponseTime).toFixed(0)}ms</td>
        </tr>
        <tr>
            <td>Error Rate</td>
            <td>${metrics.baselineMetrics.application.errorRate.toFixed(2)}%</td>
            <td>${metrics.peakMetrics.application.errorRate.toFixed(2)}%</td>
            <td>${(metrics.peakMetrics.application.errorRate - metrics.baselineMetrics.application.errorRate).toFixed(2)}%</td>
        </tr>
    </table>
    ` : ''}

    <div class="recommendations">
        <h3>Recommendations</h3>
        <ul>
            ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>

    <h3>Safeguards</h3>
    <table>
        <tr><th>Name</th><th>Type</th><th>Condition</th><th>Action</th></tr>
        ${experiment.safeguards.map(safeguard => `
            <tr>
                <td>${safeguard.name}</td>
                <td>${safeguard.type}</td>
                <td>${safeguard.condition}</td>
                <td>${safeguard.action}</td>
            </tr>
        `).join('')}
    </table>

    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
        <p>Generated by OmniCare Chaos Engineering Framework</p>
        <p>Report Version: 1.0 | Generated: ${new Date().toISOString()}</p>
    </footer>
</body>
</html>`;
  }
}