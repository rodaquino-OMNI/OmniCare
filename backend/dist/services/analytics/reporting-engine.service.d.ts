import { EventEmitter } from 'events';
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
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
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
export declare class ReportingEngineService extends EventEmitter {
    private reportConfigurations;
    private generatedReports;
    private reportAlerts;
    private scheduledJobs;
    constructor();
    createCustomReport(config: ReportConfiguration): Promise<ReportConfiguration>;
    generateReport(configurationId: string, parameters?: Record<string, any>, generatedBy?: string): Promise<GeneratedReport>;
    getReport(reportId: string): Promise<GeneratedReport>;
    getReports(filters: {
        facilityId?: string;
        type?: string;
        status?: string;
        createdBy?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        reports: GeneratedReport[];
        total: number;
    }>;
    scheduleReport(configurationId: string, schedule: ReportSchedule): Promise<ReportConfiguration>;
    exportReport(reportId: string, format: 'pdf' | 'excel' | 'csv'): Promise<{
        filePath: string;
        downloadUrl: string;
        expiresAt: Date;
    }>;
    createReportAlert(alert: Omit<ReportAlert, 'id' | 'triggerCount'>): Promise<ReportAlert>;
    getReportTemplates(): Promise<ReportConfiguration[]>;
    cloneReportConfiguration(configurationId: string, newName: string, createdBy: string): Promise<ReportConfiguration>;
    processScheduledReports(): Promise<void>;
    private validateReportConfiguration;
    private executeReportQuery;
    private applyCalculations;
    private generateVisualizations;
    private prepareChartData;
    private generateSummary;
    private checkAlertConditions;
    private triggerAlert;
    private buildCronExpression;
    private calculateNextRun;
    private performExport;
    private initializeStandardReports;
}
//# sourceMappingURL=reporting-engine.service.d.ts.map