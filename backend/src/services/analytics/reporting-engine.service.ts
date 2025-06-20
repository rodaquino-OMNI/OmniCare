/**
 * Reporting Engine Service
 * 
 * Custom report builder, scheduled reporting, and automated alerts
 */

import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface ReportConfiguration {
  id?: string;
  name: string;
  description: string;
  type: 'Clinical Quality' | 'Financial' | 'Operational' | 'Population Health' | 'Custom';
  facilityId: string;
  dataSource: {
    tables: string[];
    joins: string[];
    filters: ReportFilter[];
  };
  columns: ReportColumn[];
  groupBy?: string[];
  sortBy?: Array<{
    column: string;
    direction: 'ASC' | 'DESC';
  }>;
  calculations: ReportCalculation[];
  visualizations: ReportVisualization[];
  schedule?: ReportSchedule;
  recipients: string[];
  format: 'PDF' | 'Excel' | 'CSV' | 'JSON';
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ReportFilter {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'NOT IN' | 'LIKE' | 'BETWEEN';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface ReportColumn {
  name: string;
  alias?: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  format?: string;
  aggregation?: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX';
  hidden?: boolean;
}

export interface ReportCalculation {
  name: string;
  formula: string;
  dataType: 'number' | 'percentage' | 'currency';
  description?: string;
}

export interface ReportVisualization {
  type: 'table' | 'chart' | 'graph' | 'metric';
  chartType?: 'bar' | 'line' | 'pie' | 'scatter' | 'heatmap';
  title: string;
  dataColumns: string[];
  options: Record<string, any>;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  time: string; // HH:mm format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface GeneratedReport {
  id: string;
  configurationId: string;
  name: string;
  facilityId: string;
  generatedAt: Date;
  generatedBy: string;
  status: 'Generating' | 'Completed' | 'Failed' | 'Cancelled';
  data: any;
  metadata: {
    rowCount: number;
    processingTime: number;
    dataFreshness: Date;
    parameters: Record<string, any>;
  };
  filePath?: string;
  downloadUrl?: string;
  expiresAt?: Date;
}

export interface ReportAlert {
  id: string;
  name: string;
  description: string;
  reportConfigurationId: string;
  conditions: Array<{
    column: string;
    operator: string;
    threshold: any;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
  }>;
  recipients: string[];
  enabled: boolean;
  lastTriggered?: Date;
  triggerCount: number;
}

@Injectable()
export class ReportingEngineService extends EventEmitter {
  private reportConfigurations: Map<string, ReportConfiguration> = new Map();
  private generatedReports: Map<string, GeneratedReport> = new Map();
  private reportAlerts: Map<string, ReportAlert> = new Map();
  private scheduledJobs: Map<string, any> = new Map();

  constructor() {
    super();
    this.initializeStandardReports();
  }

  /**
   * Create custom report configuration
   */
  async createCustomReport(config: ReportConfiguration): Promise<ReportConfiguration> {
    const reportId = `RPT-${Date.now()}`;
    const reportConfig: ReportConfiguration = {
      ...config,
      id: reportId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate configuration
    await this.validateReportConfiguration(reportConfig);

    // Store configuration
    this.reportConfigurations.set(reportId, reportConfig);

    // Set up schedule if provided
    if (reportConfig.schedule?.enabled) {
      await this.scheduleReport(reportId, reportConfig.schedule);
    }

    this.emit('report-created', {
      reportId,
      name: reportConfig.name,
      createdBy: reportConfig.createdBy
    });

    return reportConfig;
  }

  /**
   * Generate report from configuration
   */
  async generateReport(
    configurationId: string,
    parameters?: Record<string, any>,
    generatedBy?: string
  ): Promise<GeneratedReport> {
    const config = this.reportConfigurations.get(configurationId);
    if (!config) {
      throw new Error(`Report configuration ${configurationId} not found`);
    }

    const reportId = `GEN-${Date.now()}`;
    const startTime = Date.now();

    // Create initial report entry
    const report: GeneratedReport = {
      id: reportId,
      configurationId,
      name: config.name,
      facilityId: config.facilityId,
      generatedAt: new Date(),
      generatedBy: generatedBy || 'System',
      status: 'Generating',
      data: null,
      metadata: {
        rowCount: 0,
        processingTime: 0,
        dataFreshness: new Date(),
        parameters: parameters || {}
      }
    };

    this.generatedReports.set(reportId, report);

    try {
      // Execute report query
      const data = await this.executeReportQuery(config, parameters);
      
      // Apply calculations
      const processedData = await this.applyCalculations(data, config.calculations);
      
      // Generate visualizations
      const visualizations = await this.generateVisualizations(processedData, config.visualizations);

      // Update report with results
      const completedReport: GeneratedReport = {
        ...report,
        status: 'Completed',
        data: {
          rows: processedData,
          visualizations,
          summary: this.generateSummary(processedData, config)
        },
        metadata: {
          ...report.metadata,
          rowCount: processedData.length,
          processingTime: Date.now() - startTime
        }
      };

      this.generatedReports.set(reportId, completedReport);

      // Check for alert conditions
      await this.checkAlertConditions(completedReport);

      this.emit('report-generated', {
        reportId,
        configurationId,
        status: 'Completed',
        rowCount: processedData.length
      });

      return completedReport;

    } catch (error) {
      // Update report status to failed
      const failedReport: GeneratedReport = {
        ...report,
        status: 'Failed',
        metadata: {
          ...report.metadata,
          processingTime: Date.now() - startTime
        }
      };

      this.generatedReports.set(reportId, failedReport);

      this.emit('report-failed', {
        reportId,
        configurationId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string): Promise<GeneratedReport> {
    const report = this.generatedReports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }
    return report;
  }

  /**
   * Get reports with filters
   */
  async getReports(filters: {
    facilityId?: string;
    type?: string;
    status?: string;
    createdBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    reports: GeneratedReport[];
    total: number;
  }> {
    let reports = Array.from(this.generatedReports.values());

    // Apply filters
    if (filters.facilityId) {
      reports = reports.filter(r => r.facilityId === filters.facilityId);
    }
    if (filters.status) {
      reports = reports.filter(r => r.status === filters.status);
    }
    if (filters.createdBy) {
      reports = reports.filter(r => r.generatedBy === filters.createdBy);
    }

    // Sort by generated date (newest first)
    reports.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());

    const total = reports.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;

    return {
      reports: reports.slice(offset, offset + limit),
      total
    };
  }

  /**
   * Schedule report generation
   */
  async scheduleReport(
    configurationId: string,
    schedule: ReportSchedule
  ): Promise<ReportConfiguration> {
    const config = this.reportConfigurations.get(configurationId);
    if (!config) {
      throw new Error(`Report configuration ${configurationId} not found`);
    }

    // Update configuration with schedule
    const updatedConfig: ReportConfiguration = {
      ...config,
      schedule,
      updatedAt: new Date()
    };

    this.reportConfigurations.set(configurationId, updatedConfig);

    // Set up cron job
    const cronExpression = this.buildCronExpression(schedule);
    // Note: In real implementation, would use actual cron scheduler
    
    this.emit('report-scheduled', {
      configurationId,
      schedule,
      nextRun: this.calculateNextRun(schedule)
    });

    return updatedConfig;
  }

  /**
   * Export report in specified format
   */
  async exportReport(
    reportId: string,
    format: 'pdf' | 'excel' | 'csv'
  ): Promise<{
    filePath: string;
    downloadUrl: string;
    expiresAt: Date;
  }> {
    const report = await this.getReport(reportId);
    
    const fileName = `${report.name.replace(/\s+/g, '_')}_${Date.now()}.${format}`;
    const filePath = `/exports/${fileName}`;
    const downloadUrl = `${process.env.API_BASE_URL}/analytics/reports/${reportId}/download/${fileName}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Mock export process - would use actual export libraries
    await this.performExport(report, format, filePath);

    // Update report with export info
    const updatedReport: GeneratedReport = {
      ...report,
      filePath,
      downloadUrl,
      expiresAt
    };

    this.generatedReports.set(reportId, updatedReport);

    return {
      filePath,
      downloadUrl,
      expiresAt
    };
  }

  /**
   * Create report alert
   */
  async createReportAlert(alert: Omit<ReportAlert, 'id' | 'triggerCount'>): Promise<ReportAlert> {
    const alertId = `ALERT-${Date.now()}`;
    const reportAlert: ReportAlert = {
      ...alert,
      id: alertId,
      triggerCount: 0
    };

    this.reportAlerts.set(alertId, reportAlert);

    this.emit('alert-created', {
      alertId,
      reportConfigurationId: alert.reportConfigurationId,
      conditions: alert.conditions
    });

    return reportAlert;
  }

  /**
   * Get available report templates
   */
  async getReportTemplates(): Promise<ReportConfiguration[]> {
    return Array.from(this.reportConfigurations.values())
      .filter(config => config.type !== 'Custom');
  }

  /**
   * Clone report configuration
   */
  async cloneReportConfiguration(
    configurationId: string,
    newName: string,
    createdBy: string
  ): Promise<ReportConfiguration> {
    const originalConfig = this.reportConfigurations.get(configurationId);
    if (!originalConfig) {
      throw new Error(`Report configuration ${configurationId} not found`);
    }

    const clonedConfig: ReportConfiguration = {
      ...originalConfig,
      id: `RPT-${Date.now()}`,
      name: newName,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      schedule: undefined // Don't clone schedule
    };

    this.reportConfigurations.set(clonedConfig.id!, clonedConfig);

    return clonedConfig;
  }

  // Scheduled job for automatic report generation
  @Cron(CronExpression.EVERY_HOUR)
  async processScheduledReports(): Promise<void> {
    const now = new Date();
    
    for (const [configId, config] of this.reportConfigurations) {
      if (config.schedule?.enabled && config.schedule.nextRun && config.schedule.nextRun <= now) {
        try {
          await this.generateReport(configId, {}, 'Scheduled');
          
          // Update next run time
          config.schedule.lastRun = now;
          config.schedule.nextRun = this.calculateNextRun(config.schedule);
          
          this.reportConfigurations.set(configId, config);
        } catch (error) {
          console.error(`Failed to generate scheduled report ${configId}:`, error);
        }
      }
    }
  }

  private async validateReportConfiguration(config: ReportConfiguration): Promise<void> {
    if (!config.name || !config.facilityId) {
      throw new Error('Report name and facility ID are required');
    }

    if (!config.dataSource.tables || config.dataSource.tables.length === 0) {
      throw new Error('At least one data source table is required');
    }

    if (!config.columns || config.columns.length === 0) {
      throw new Error('At least one column is required');
    }

    // Validate filters
    for (const filter of config.dataSource.filters) {
      if (!filter.column || !filter.operator) {
        throw new Error('Invalid filter configuration');
      }
    }
  }

  private async executeReportQuery(
    config: ReportConfiguration,
    parameters?: Record<string, any>
  ): Promise<any[]> {
    // Mock query execution - would integrate with actual database
    const mockData = [];
    const rowCount = Math.floor(Math.random() * 1000) + 100;

    for (let i = 0; i < rowCount; i++) {
      const row: Record<string, any> = {};
      
      for (const column of config.columns) {
        switch (column.dataType) {
          case 'string':
            row[column.name] = `Sample ${column.name} ${i}`;
            break;
          case 'number':
            row[column.name] = Math.floor(Math.random() * 1000);
            break;
          case 'date':
            row[column.name] = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);
            break;
          case 'boolean':
            row[column.name] = Math.random() > 0.5;
            break;
        }
      }
      
      mockData.push(row);
    }

    return mockData;
  }

  private async applyCalculations(
    data: any[],
    calculations: ReportCalculation[]
  ): Promise<any[]> {
    return data.map(row => {
      const calculatedRow = { ...row };
      
      for (const calc of calculations) {
        // Mock calculation - would implement actual formula parser
        if (calc.name === 'total_revenue') {
          calculatedRow[calc.name] = (row.charges || 0) - (row.adjustments || 0);
        } else if (calc.name === 'collection_rate') {
          calculatedRow[calc.name] = ((row.collections || 0) / (row.charges || 1)) * 100;
        } else {
          calculatedRow[calc.name] = Math.random() * 100;
        }
      }
      
      return calculatedRow;
    });
  }

  private async generateVisualizations(
    data: any[],
    visualizations: ReportVisualization[]
  ): Promise<any[]> {
    return visualizations.map(viz => {
      const chartData = this.prepareChartData(data, viz);
      
      return {
        type: viz.type,
        title: viz.title,
        chartType: viz.chartType,
        data: chartData,
        options: viz.options
      };
    });
  }

  private prepareChartData(data: any[], visualization: ReportVisualization): any {
    // Mock chart data preparation
    if (visualization.chartType === 'pie') {
      return visualization.dataColumns.map(col => ({
        name: col,
        value: Math.floor(Math.random() * 100)
      }));
    } else if (visualization.chartType === 'bar' || visualization.chartType === 'line') {
      return data.slice(0, 10).map((row, index) => ({
        name: `Item ${index + 1}`,
        ...visualization.dataColumns.reduce((acc, col) => {
          acc[col] = row[col] || Math.random() * 100;
          return acc;
        }, {})
      }));
    }

    return data.slice(0, 100); // Return sample data for tables
  }

  private generateSummary(data: any[], config: ReportConfiguration): any {
    const summary: Record<string, any> = {
      totalRows: data.length,
      generatedAt: new Date()
    };

    // Calculate basic statistics for numeric columns
    for (const column of config.columns) {
      if (column.dataType === 'number') {
        const values = data.map(row => row[column.name]).filter(v => typeof v === 'number');
        if (values.length > 0) {
          summary[`${column.name}_sum`] = values.reduce((sum, val) => sum + val, 0);
          summary[`${column.name}_avg`] = summary[`${column.name}_sum`] / values.length;
          summary[`${column.name}_min`] = Math.min(...values);
          summary[`${column.name}_max`] = Math.max(...values);
        }
      }
    }

    return summary;
  }

  private async checkAlertConditions(report: GeneratedReport): Promise<void> {
    const alerts = Array.from(this.reportAlerts.values())
      .filter(alert => alert.reportConfigurationId === report.configurationId && alert.enabled);

    for (const alert of alerts) {
      let shouldTrigger = false;

      for (const condition of alert.conditions) {
        // Mock condition checking - would implement actual condition evaluation
        const currentValue = Math.random() * 100;
        const threshold = condition.threshold;

        switch (condition.operator) {
          case '>':
            shouldTrigger = currentValue > threshold;
            break;
          case '<':
            shouldTrigger = currentValue < threshold;
            break;
          case '>=':
            shouldTrigger = currentValue >= threshold;
            break;
          case '<=':
            shouldTrigger = currentValue <= threshold;
            break;
          case '=':
            shouldTrigger = currentValue === threshold;
            break;
        }

        if (shouldTrigger) {
          await this.triggerAlert(alert, report, condition);
          break;
        }
      }
    }
  }

  private async triggerAlert(
    alert: ReportAlert,
    report: GeneratedReport,
    condition: any
  ): Promise<void> {
    alert.lastTriggered = new Date();
    alert.triggerCount++;

    this.reportAlerts.set(alert.id, alert);

    this.emit('alert-triggered', {
      alertId: alert.id,
      reportId: report.id,
      condition,
      severity: condition.severity,
      recipients: alert.recipients
    });

    // Mock notification sending - would integrate with actual notification service
    console.log(`Alert triggered: ${alert.name} for report ${report.name}`);
  }

  private buildCronExpression(schedule: ReportSchedule): string {
    const [hour, minute] = schedule.time.split(':').map(Number);

    switch (schedule.frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`;
      case 'weekly':
        return `${minute} ${hour} * * ${schedule.dayOfWeek || 0}`;
      case 'monthly':
        return `${minute} ${hour} ${schedule.dayOfMonth || 1} * *`;
      case 'quarterly':
        return `${minute} ${hour} 1 */3 *`;
      case 'annually':
        return `${minute} ${hour} 1 1 *`;
      default:
        throw new Error(`Unsupported schedule frequency: ${schedule.frequency}`);
    }
  }

  private calculateNextRun(schedule: ReportSchedule): Date {
    const now = new Date();
    const [hour, minute] = schedule.time.split(':').map(Number);

    const nextRun = new Date(now);
    nextRun.setHours(hour, minute, 0, 0);

    switch (schedule.frequency) {
      case 'daily':
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      case 'weekly':
        const dayOfWeek = schedule.dayOfWeek || 0;
        const daysUntilNext = (dayOfWeek - nextRun.getDay() + 7) % 7;
        nextRun.setDate(nextRun.getDate() + (daysUntilNext || 7));
        break;
      case 'monthly':
        const dayOfMonth = schedule.dayOfMonth || 1;
        nextRun.setDate(dayOfMonth);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
      case 'quarterly':
        nextRun.setDate(1);
        nextRun.setMonth(Math.floor(nextRun.getMonth() / 3) * 3 + 3);
        break;
      case 'annually':
        nextRun.setMonth(0, 1);
        if (nextRun <= now) {
          nextRun.setFullYear(nextRun.getFullYear() + 1);
        }
        break;
    }

    return nextRun;
  }

  private async performExport(
    report: GeneratedReport,
    format: string,
    filePath: string
  ): Promise<void> {
    // Mock export process - would use actual export libraries like:
    // - PDF: puppeteer, pdfkit
    // - Excel: exceljs
    // - CSV: csv-writer
    console.log(`Exporting report ${report.id} to ${format} format at ${filePath}`);
  }

  private initializeStandardReports(): void {
    // Clinical Quality Dashboard
    this.reportConfigurations.set('clinical-quality-dashboard', {
      id: 'clinical-quality-dashboard',
      name: 'Clinical Quality Dashboard',
      description: 'Comprehensive clinical quality measures dashboard',
      type: 'Clinical Quality',
      facilityId: 'default',
      dataSource: {
        tables: ['quality_measures', 'patients', 'encounters'],
        joins: ['patients.id = encounters.patient_id'],
        filters: []
      },
      columns: [
        { name: 'measure_name', alias: 'Measure', dataType: 'string' },
        { name: 'performance_rate', alias: 'Performance Rate', dataType: 'number', format: '##.##%' },
        { name: 'benchmark', alias: 'Benchmark', dataType: 'number', format: '##.##%' },
        { name: 'patient_count', alias: 'Patients', dataType: 'number' }
      ],
      calculations: [
        {
          name: 'gap_to_benchmark',
          formula: 'benchmark - performance_rate',
          dataType: 'percentage',
          description: 'Gap to benchmark performance'
        }
      ],
      visualizations: [
        {
          type: 'chart',
          chartType: 'bar',
          title: 'Quality Measures Performance',
          dataColumns: ['measure_name', 'performance_rate', 'benchmark'],
          options: { showBenchmark: true }
        }
      ],
      recipients: [],
      format: 'PDF',
      createdBy: 'System',
      createdAt: new Date()
    });

    // Financial Performance Report
    this.reportConfigurations.set('financial-performance', {
      id: 'financial-performance',
      name: 'Financial Performance Report',
      description: 'Revenue cycle and financial analytics',
      type: 'Financial',
      facilityId: 'default',
      dataSource: {
        tables: ['billing', 'payments', 'adjustments'],
        joins: ['billing.id = payments.billing_id'],
        filters: []
      },
      columns: [
        { name: 'service_date', alias: 'Service Date', dataType: 'date' },
        { name: 'charges', alias: 'Charges', dataType: 'number', format: 'currency' },
        { name: 'payments', alias: 'Payments', dataType: 'number', format: 'currency' },
        { name: 'adjustments', alias: 'Adjustments', dataType: 'number', format: 'currency' }
      ],
      calculations: [
        {
          name: 'net_revenue',
          formula: 'charges - adjustments',
          dataType: 'currency',
          description: 'Net revenue after adjustments'
        },
        {
          name: 'collection_rate',
          formula: '(payments / charges) * 100',
          dataType: 'percentage',
          description: 'Collection rate percentage'
        }
      ],
      visualizations: [
        {
          type: 'chart',
          chartType: 'line',
          title: 'Revenue Trend',
          dataColumns: ['service_date', 'net_revenue'],
          options: { showTrend: true }
        }
      ],
      recipients: [],
      format: 'Excel',
      createdBy: 'System',
      createdAt: new Date()
    });
  }
}