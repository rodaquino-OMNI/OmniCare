import { EventEmitter } from 'events';
import { AuditLogEntry, SecurityEvent, ComplianceReport } from '@/types/auth.types';
export interface AuditDatabase {
    saveAuditEntry(entry: AuditLogEntry): Promise<void>;
    getAuditEntries(filters: AuditFilters): Promise<AuditLogEntry[]>;
    generateComplianceReport(reportType: string, dateRange: {
        start: Date;
        end: Date;
    }): Promise<ComplianceReport>;
    searchAuditLogs(query: string, filters?: AuditFilters): Promise<AuditLogEntry[]>;
    getAuditStatistics(timeframe: 'daily' | 'weekly' | 'monthly'): Promise<AuditStatistics>;
}
export interface AuditFilters {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
    ipAddress?: string;
    limit?: number;
    offset?: number;
}
export interface AuditStatistics {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    uniqueUsers: number;
    eventsByType: Record<string, number>;
    eventsByUser: Record<string, number>;
    topResources: Array<{
        resource: string;
        count: number;
    }>;
    securityIncidents: number;
}
export declare class AuditService extends EventEmitter {
    private logger;
    private securityLogger;
    private database?;
    private encryptionKey;
    constructor(database?: AuditDatabase);
    private initializeLoggers;
    private setupEventListeners;
    logUserAction(userId: string, action: string, resource: string, resourceId: string | undefined, ipAddress: string, userAgent: string, success?: boolean, errorMessage?: string, additionalData?: Record<string, any>): Promise<void>;
    logSecurityEvent(event: SecurityEvent): Promise<void>;
    generateHipaaComplianceReport(startDate: Date, endDate: Date, generatedBy: string): Promise<ComplianceReport>;
    searchAuditLogs(query: string, filters?: AuditFilters): Promise<AuditLogEntry[]>;
    getAuditStatistics(timeframe?: 'daily' | 'weekly' | 'monthly'): Promise<AuditStatistics>;
    private handleCriticalSecurityEvent;
    private generateAuditId;
    private signLogEntry;
    private encryptSensitiveData;
    private isSensitiveField;
    private isSecurityRelevantAction;
    private mapActionToSecurityEventType;
    private determineSeverity;
    private mapSeverityToLogLevel;
    private analyzeLogFiles;
    private generateReportSummary;
    private getTopActions;
    private searchLogFiles;
    private calculateStatisticsFromLogs;
    shutdown(): void;
}
//# sourceMappingURL=audit.service.d.ts.map