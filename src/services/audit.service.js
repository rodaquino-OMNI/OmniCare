"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const auth_config_1 = require("@/config/auth.config");
class AuditService extends events_1.EventEmitter {
    logger;
    securityLogger;
    database;
    encryptionKey;
    constructor(database) {
        super();
        this.database = database;
        this.encryptionKey = process.env.AUDIT_ENCRYPTION_KEY || 'default-audit-key-change-in-production';
        this.initializeLoggers();
        this.setupEventListeners();
    }
    initializeLoggers() {
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf((info) => {
                return JSON.stringify({
                    timestamp: info.timestamp,
                    level: info.level,
                    message: info.message,
                    ...info,
                    signature: this.signLogEntry(info)
                });
            })),
            defaultMeta: { service: 'omnicare-audit' },
            transports: [
                new winston_daily_rotate_file_1.default({
                    filename: 'logs/audit/audit-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: auth_config_1.AUDIT_CONFIG.logRotation.compress,
                    maxSize: auth_config_1.AUDIT_CONFIG.logRotation.maxSize,
                    maxFiles: auth_config_1.AUDIT_CONFIG.logRotation.maxFiles,
                    createSymlink: true,
                    symlinkName: 'audit-current.log'
                }),
                ...(process.env.NODE_ENV !== 'production' ? [
                    new winston_1.default.transports.Console({
                        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                    })
                ] : [])
            ]
        });
        this.securityLogger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf((info) => {
                return JSON.stringify({
                    timestamp: info.timestamp,
                    level: info.level,
                    message: info.message,
                    ...info,
                    signature: this.signLogEntry(info)
                });
            })),
            defaultMeta: { service: 'omnicare-security' },
            transports: [
                new winston_daily_rotate_file_1.default({
                    filename: 'logs/security/security-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '50m',
                    maxFiles: '365d'
                }),
                new winston_1.default.transports.File({
                    filename: 'logs/security/critical-events.log',
                    level: 'error'
                })
            ]
        });
    }
    setupEventListeners() {
        this.on('auditEntry', async (entry) => {
            try {
                if (this.database) {
                    await this.database.saveAuditEntry(entry);
                }
            }
            catch (error) {
                console.error('Failed to save audit entry to database:', error);
            }
        });
        this.on('securityEvent', async (event) => {
            try {
                if (auth_config_1.AUDIT_CONFIG.criticalEvents.includes(event.type)) {
                    await this.handleCriticalSecurityEvent(event);
                }
            }
            catch (error) {
                console.error('Failed to handle critical security event:', error);
            }
        });
    }
    async logUserAction(userId, action, resource, resourceId, ipAddress, userAgent, success = true, errorMessage, additionalData) {
        const entry = {
            id: this.generateAuditId(),
            userId,
            action,
            resource,
            resourceId,
            ipAddress,
            userAgent,
            timestamp: new Date(),
            success,
            errorMessage,
            additionalData: additionalData ? this.encryptSensitiveData(additionalData) : undefined
        };
        this.logger.info('User action', entry);
        this.emit('auditEntry', entry);
        if (this.isSecurityRelevantAction(action)) {
            const securityEvent = {
                type: this.mapActionToSecurityEventType(action),
                userId,
                severity: this.determineSeverity(action, success),
                description: `User action: ${action} on ${resource}`,
                metadata: { action, resource, resourceId, success, ipAddress }
            };
            await this.logSecurityEvent(securityEvent);
        }
    }
    async logSecurityEvent(event) {
        const logEntry = {
            ...event,
            timestamp: new Date(),
            id: this.generateAuditId()
        };
        const logLevel = this.mapSeverityToLogLevel(event.severity);
        this.securityLogger.log(logLevel, 'Security event', logEntry);
        this.emit('securityEvent', event);
        if (auth_config_1.AUDIT_CONFIG.criticalEvents.includes(event.type)) {
            await this.handleCriticalSecurityEvent(event);
        }
    }
    async generateHipaaComplianceReport(startDate, endDate, generatedBy) {
        const reportId = this.generateAuditId();
        let data = [];
        let summary = {};
        if (this.database) {
            const report = await this.database.generateComplianceReport('HIPAA_ACCESS_LOG', { start: startDate, end: endDate });
            data = report.data;
            summary = report.summary;
        }
        else {
            data = await this.analyzeLogFiles(startDate, endDate);
            summary = this.generateReportSummary(data);
        }
        const report = {
            reportId,
            reportType: 'HIPAA_ACCESS_LOG',
            generatedBy,
            dateRange: { start: startDate, end: endDate },
            data,
            summary: {
                ...summary,
                totalAccesses: data.length,
                uniqueUsers: new Set(data.map(entry => entry.userId)).size,
                failedAttempts: data.filter(entry => !entry.success).length,
                securityIncidents: data.filter(entry => this.isSecurityRelevantAction(entry.action) && !entry.success).length
            },
            createdAt: new Date()
        };
        await this.logSecurityEvent({
            type: 'SYSTEM_CONFIGURATION_CHANGE',
            userId: generatedBy,
            severity: 'MEDIUM',
            description: `HIPAA compliance report generated for period ${startDate.toISOString()} to ${endDate.toISOString()}`,
            metadata: { reportId, reportType: 'HIPAA_ACCESS_LOG' }
        });
        return report;
    }
    async searchAuditLogs(query, filters) {
        if (this.database) {
            return await this.database.searchAuditLogs(query, filters);
        }
        return this.searchLogFiles(query, filters);
    }
    async getAuditStatistics(timeframe = 'daily') {
        if (this.database) {
            return await this.database.getAuditStatistics(timeframe);
        }
        return this.calculateStatisticsFromLogs(timeframe);
    }
    async handleCriticalSecurityEvent(event) {
        this.securityLogger.error('CRITICAL SECURITY EVENT', {
            ...event,
            timestamp: new Date(),
            priority: 'CRITICAL'
        });
        console.error(`CRITICAL SECURITY EVENT: ${event.type} - ${event.description}`);
        this.emit('criticalSecurityEvent', event);
    }
    generateAuditId() {
        const timestamp = Date.now().toString(36);
        const random = crypto_1.default.randomBytes(8).toString('hex');
        return `audit_${timestamp}_${random}`;
    }
    signLogEntry(entry) {
        const data = JSON.stringify(entry, Object.keys(entry).sort());
        return crypto_1.default
            .createHmac('sha256', this.encryptionKey)
            .update(data)
            .digest('hex');
    }
    encryptSensitiveData(data) {
        const encrypted = {};
        for (const [key, value] of Object.entries(data)) {
            if (this.isSensitiveField(key)) {
                const cipher = crypto_1.default.createCipher('aes-256-cbc', this.encryptionKey);
                let encryptedValue = cipher.update(JSON.stringify(value), 'utf8', 'hex');
                encryptedValue += cipher.final('hex');
                encrypted[key] = `encrypted:${encryptedValue}`;
            }
            else {
                encrypted[key] = value;
            }
        }
        return encrypted;
    }
    isSensitiveField(fieldName) {
        const sensitiveFields = [
            'password', 'ssn', 'dob', 'phone', 'email',
            'address', 'medicalRecord', 'diagnosis',
            'treatment', 'medication', 'notes'
        ];
        return sensitiveFields.some(field => fieldName.toLowerCase().includes(field));
    }
    isSecurityRelevantAction(action) {
        const securityActions = [
            'login', 'logout', 'password_change', 'mfa_setup',
            'user_creation', 'user_modification', 'permission_change',
            'data_access', 'data_modification', 'data_deletion',
            'system_configuration', 'backup', 'restore'
        ];
        return securityActions.some(secAction => action.toLowerCase().includes(secAction));
    }
    mapActionToSecurityEventType(action) {
        const actionLower = action.toLowerCase();
        if (actionLower.includes('login'))
            return 'LOGIN_SUCCESS';
        if (actionLower.includes('logout'))
            return 'LOGOUT';
        if (actionLower.includes('password'))
            return 'PASSWORD_CHANGE';
        if (actionLower.includes('data_access'))
            return 'DATA_ACCESS';
        if (actionLower.includes('data_modification'))
            return 'DATA_MODIFICATION';
        if (actionLower.includes('unauthorized'))
            return 'UNAUTHORIZED_ACCESS';
        return 'DATA_ACCESS';
    }
    determineSeverity(action, success) {
        if (!success) {
            if (action.includes('login') || action.includes('unauthorized')) {
                return 'HIGH';
            }
            return 'MEDIUM';
        }
        if (action.includes('system_configuration') || action.includes('user_creation')) {
            return 'MEDIUM';
        }
        return 'LOW';
    }
    mapSeverityToLogLevel(severity) {
        switch (severity) {
            case 'CRITICAL': return 'error';
            case 'HIGH': return 'error';
            case 'MEDIUM': return 'warn';
            case 'LOW': return 'info';
            default: return 'info';
        }
    }
    async analyzeLogFiles(_startDate, _endDate) {
        return [];
    }
    generateReportSummary(data) {
        return {
            totalEntries: data.length,
            successfulActions: data.filter(entry => entry.success).length,
            failedActions: data.filter(entry => !entry.success).length,
            uniqueUsers: new Set(data.map(entry => entry.userId)).size,
            topActions: this.getTopActions(data),
            timeRange: {
                earliest: data.reduce((min, entry) => entry.timestamp < min ? entry.timestamp : min, data[0]?.timestamp || new Date()),
                latest: data.reduce((max, entry) => entry.timestamp > max ? entry.timestamp : max, data[0]?.timestamp || new Date())
            }
        };
    }
    getTopActions(data) {
        const actionCounts = {};
        data.forEach(entry => {
            actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
        });
        return Object.entries(actionCounts)
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }
    async searchLogFiles(_query, _filters) {
        return [];
    }
    async calculateStatisticsFromLogs(_timeframe) {
        return {
            totalEvents: 0,
            successfulEvents: 0,
            failedEvents: 0,
            uniqueUsers: 0,
            eventsByType: {},
            eventsByUser: {},
            topResources: [],
            securityIncidents: 0
        };
    }
    shutdown() {
        this.logger.end();
        this.securityLogger.end();
        this.removeAllListeners();
    }
}
exports.AuditService = AuditService;
//# sourceMappingURL=audit.service.js.map