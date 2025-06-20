"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const roles_guard_1 = require("../guards/roles.guard");
const roles_decorator_1 = require("../decorators/roles.decorator");
const clinical_quality_measures_service_1 = require("../services/analytics/clinical-quality-measures.service");
const financial_analytics_service_1 = require("../services/analytics/financial-analytics.service");
const operational_metrics_service_1 = require("../services/analytics/operational-metrics.service");
const population_health_service_1 = require("../services/analytics/population-health.service");
const reporting_engine_service_1 = require("../services/analytics/reporting-engine.service");
let AnalyticsController = class AnalyticsController {
    clinicalQualityService;
    financialAnalyticsService;
    operationalMetricsService;
    populationHealthService;
    reportingEngineService;
    constructor(clinicalQualityService, financialAnalyticsService, operationalMetricsService, populationHealthService, reportingEngineService) {
        this.clinicalQualityService = clinicalQualityService;
        this.financialAnalyticsService = financialAnalyticsService;
        this.operationalMetricsService = operationalMetricsService;
        this.populationHealthService = populationHealthService;
        this.reportingEngineService = reportingEngineService;
    }
    async getClinicalQualityMeasures(facilityId, startDate, endDate, measureIds) {
        try {
            const period = startDate && endDate ? {
                start: new Date(startDate),
                end: new Date(endDate)
            } : undefined;
            const measureIdList = measureIds ? measureIds.split(',') : undefined;
            const measures = await this.clinicalQualityService.calculateQualityMeasures(facilityId, period || {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                end: new Date()
            }, measureIdList);
            return {
                success: true,
                data: measures,
                meta: {
                    facilityId,
                    period,
                    measureCount: measures.length
                }
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch clinical quality measures: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async generateQualityReport(facilityId, startDate, endDate) {
        try {
            const period = {
                start: new Date(startDate),
                end: new Date(endDate)
            };
            const report = await this.clinicalQualityService.generateQualityReport(facilityId, period);
            return {
                success: true,
                data: report
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to generate quality report: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async performQualityGapAnalysis(facilityId, measureIds) {
        try {
            const measureIdList = measureIds.split(',');
            const gapAnalysis = await this.clinicalQualityService.performGapAnalysis(facilityId, measureIdList);
            return {
                success: true,
                data: gapAnalysis
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to perform gap analysis: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getQualityDashboard(facilityId) {
        try {
            const dashboard = await this.clinicalQualityService.getQualityDashboard(facilityId);
            return {
                success: true,
                data: dashboard
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch quality dashboard: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getRevenueCycleAnalytics(facilityId, startDate, endDate) {
        try {
            const period = {
                start: new Date(startDate),
                end: new Date(endDate)
            };
            const analytics = await this.financialAnalyticsService.getRevenueCycleAnalytics(facilityId, period);
            return {
                success: true,
                data: analytics
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch revenue cycle analytics: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getProviderProductivityAnalysis(facilityId, startDate, endDate, providerId) {
        try {
            const period = {
                start: new Date(startDate),
                end: new Date(endDate)
            };
            const analysis = await this.financialAnalyticsService.getProviderProductivityAnalysis(facilityId, period, providerId);
            return {
                success: true,
                data: analysis
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch provider productivity analysis: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async generateFinancialForecast(facilityId, months) {
        try {
            const forecastMonths = months ? parseInt(months) : 12;
            const forecast = await this.financialAnalyticsService.generateFinancialForecast(facilityId, forecastMonths);
            return {
                success: true,
                data: forecast
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to generate financial forecast: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getServiceLineProfitability(facilityId, startDate, endDate) {
        try {
            const period = {
                start: new Date(startDate),
                end: new Date(endDate)
            };
            const profitability = await this.financialAnalyticsService.getServiceLineProfitability(facilityId, period);
            return {
                success: true,
                data: profitability
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch service line profitability: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getPatientFlowAnalytics(facilityId, startDate, endDate) {
        try {
            const period = startDate && endDate ? {
                start: new Date(startDate),
                end: new Date(endDate)
            } : undefined;
            const analytics = await this.operationalMetricsService.getPatientFlowAnalytics(facilityId, period);
            return {
                success: true,
                data: analytics
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch patient flow analytics: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getStaffUtilizationAnalytics(facilityId, startDate, endDate, departmentId) {
        try {
            const period = {
                start: new Date(startDate),
                end: new Date(endDate)
            };
            const analytics = await this.operationalMetricsService.getStaffUtilizationAnalytics(facilityId, period, departmentId);
            return {
                success: true,
                data: analytics
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch staff utilization analytics: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getAppointmentAnalytics(facilityId, startDate, endDate) {
        try {
            const period = {
                start: new Date(startDate),
                end: new Date(endDate)
            };
            const analytics = await this.operationalMetricsService.getAppointmentAnalytics(facilityId, period);
            return {
                success: true,
                data: analytics
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch appointment analytics: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getQualityMetrics(facilityId, startDate, endDate) {
        try {
            const period = {
                start: new Date(startDate),
                end: new Date(endDate)
            };
            const metrics = await this.operationalMetricsService.getQualityMetrics(facilityId, period);
            return {
                success: true,
                data: metrics
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch quality metrics: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getOperationalDashboard(facilityId) {
        try {
            const dashboard = await this.operationalMetricsService.getOperationalDashboard(facilityId);
            return {
                success: true,
                data: dashboard
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch operational dashboard: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async generateOperationalInsights(facilityId) {
        try {
            const insights = await this.operationalMetricsService.generateOperationalInsights(facilityId);
            return {
                success: true,
                data: insights
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to generate operational insights: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getPopulationHealthAnalytics(facilityId, startDate, endDate) {
        try {
            const period = startDate && endDate ? {
                start: new Date(startDate),
                end: new Date(endDate)
            } : undefined;
            const analytics = await this.populationHealthService.getPopulationHealthAnalytics(facilityId, period);
            return {
                success: true,
                data: analytics
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch population health analytics: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async performRiskStratification(facilityId, patientIds) {
        try {
            const patientIdList = patientIds ? patientIds.split(',') : undefined;
            const stratification = await this.populationHealthService.performRiskStratification(facilityId, patientIdList);
            return {
                success: true,
                data: stratification
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to perform risk stratification: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async analyzeHealthOutcomes(facilityId, outcomeIds) {
        try {
            const outcomeIdList = outcomeIds ? outcomeIds.split(',') : undefined;
            const outcomes = await this.populationHealthService.analyzeHealthOutcomes(facilityId, outcomeIdList);
            return {
                success: true,
                data: outcomes
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to analyze health outcomes: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async analyzeCareGaps(facilityId, patientIds) {
        try {
            const patientIdList = patientIds ? patientIds.split(',') : undefined;
            const careGaps = await this.populationHealthService.analyzeCareGaps(facilityId, patientIdList);
            return {
                success: true,
                data: careGaps
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to analyze care gaps: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async generatePopulationInsights(facilityId) {
        try {
            const insights = await this.populationHealthService.generatePopulationInsights(facilityId);
            return {
                success: true,
                data: insights
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to generate population insights: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createCustomReport(reportConfig) {
        try {
            const report = await this.reportingEngineService.createCustomReport(reportConfig);
            return {
                success: true,
                data: report
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to create custom report: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getReport(reportId) {
        try {
            const report = await this.reportingEngineService.getReport(reportId);
            return {
                success: true,
                data: report
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch report: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getReports(facilityId, type, status) {
        try {
            const reports = await this.reportingEngineService.getReports({
                facilityId,
                type,
                status
            });
            return {
                success: true,
                data: reports
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch reports: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async scheduleReport(reportId, scheduleConfig) {
        try {
            const scheduledReport = await this.reportingEngineService.scheduleReport(reportId, scheduleConfig);
            return {
                success: true,
                data: scheduledReport
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to schedule report: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async exportReport(reportId, format = 'pdf') {
        try {
            const exportedReport = await this.reportingEngineService.exportReport(reportId, format);
            return {
                success: true,
                data: exportedReport
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to export report: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getRealTimeMetrics(facilityId) {
        try {
            const metrics = await this.operationalMetricsService.getOperationalDashboard(facilityId);
            return {
                success: true,
                data: metrics.realTimeMetrics,
                timestamp: new Date()
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch real-time metrics: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getAnalyticsAlerts(facilityId) {
        try {
            const dashboard = await this.operationalMetricsService.getOperationalDashboard(facilityId);
            const qualityDashboard = await this.clinicalQualityService.getQualityDashboard(facilityId);
            const allAlerts = [
                ...dashboard.alerts,
                ...qualityDashboard.alerts.map(alert => ({
                    id: alert.measureId,
                    type: alert.severity === 'Critical' ? 'Critical' : 'Warning',
                    title: `Quality Alert: ${alert.measureName}`,
                    message: alert.message,
                    timestamp: new Date(),
                    acknowledged: false
                }))
            ];
            return {
                success: true,
                data: allAlerts
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch analytics alerts: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getBenchmarkComparisons(facilityId, category) {
        try {
            const benchmarks = {
                clinical: {
                    diabetesControl: { current: 73.5, benchmark: 75.0, percentile: 45 },
                    hypertensionControl: { current: 68.2, benchmark: 70.0, percentile: 42 },
                    patientSatisfaction: { current: 4.2, benchmark: 4.5, percentile: 38 }
                },
                financial: {
                    collectionRate: { current: 92.5, benchmark: 95.0, percentile: 48 },
                    daysInAR: { current: 45, benchmark: 35, percentile: 25 },
                    denialRate: { current: 8.5, benchmark: 5.0, percentile: 20 }
                },
                operational: {
                    waitTime: { current: 18, benchmark: 15, percentile: 35 },
                    patientThroughput: { current: 85, benchmark: 95, percentile: 40 },
                    staffUtilization: { current: 87.5, benchmark: 85.0, percentile: 65 }
                }
            };
            const result = category ? benchmarks[category] : benchmarks;
            return {
                success: true,
                data: result
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to fetch benchmark comparisons: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, common_1.Get)('clinical-quality/:facilityId'),
    (0, roles_decorator_1.Roles)('Provider', 'Quality Manager', 'System Administrator'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('measureIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getClinicalQualityMeasures", null);
__decorate([
    (0, common_1.Get)('clinical-quality/:facilityId/report'),
    (0, roles_decorator_1.Roles)('Provider', 'Quality Manager', 'System Administrator'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "generateQualityReport", null);
__decorate([
    (0, common_1.Get)('clinical-quality/:facilityId/gap-analysis'),
    (0, roles_decorator_1.Roles)('Provider', 'Quality Manager', 'System Administrator'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('measureIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "performQualityGapAnalysis", null);
__decorate([
    (0, common_1.Get)('clinical-quality/:facilityId/dashboard'),
    (0, roles_decorator_1.Roles)('Provider', 'Quality Manager', 'System Administrator'),
    __param(0, (0, common_1.Param)('facilityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getQualityDashboard", null);
__decorate([
    (0, common_1.Get)('financial/:facilityId/revenue-cycle'),
    (0, roles_decorator_1.Roles)('Billing Staff', 'Financial Counselor', 'System Administrator', 'Department Manager'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getRevenueCycleAnalytics", null);
__decorate([
    (0, common_1.Get)('financial/:facilityId/provider-productivity'),
    (0, roles_decorator_1.Roles)('Provider', 'Department Manager', 'System Administrator'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('providerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getProviderProductivityAnalysis", null);
__decorate([
    (0, common_1.Get)('financial/:facilityId/forecast'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator', 'Financial Counselor'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('months')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "generateFinancialForecast", null);
__decorate([
    (0, common_1.Get)('financial/:facilityId/service-line-profitability'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator', 'Financial Counselor'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getServiceLineProfitability", null);
__decorate([
    (0, common_1.Get)('operational/:facilityId/patient-flow'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator', 'Front Desk Staff'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getPatientFlowAnalytics", null);
__decorate([
    (0, common_1.Get)('operational/:facilityId/staff-utilization'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('departmentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getStaffUtilizationAnalytics", null);
__decorate([
    (0, common_1.Get)('operational/:facilityId/appointments'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator', 'Front Desk Staff'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getAppointmentAnalytics", null);
__decorate([
    (0, common_1.Get)('operational/:facilityId/quality-metrics'),
    (0, roles_decorator_1.Roles)('Provider', 'Quality Manager', 'System Administrator'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getQualityMetrics", null);
__decorate([
    (0, common_1.Get)('operational/:facilityId/dashboard'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator', 'Front Desk Staff', 'Provider'),
    __param(0, (0, common_1.Param)('facilityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getOperationalDashboard", null);
__decorate([
    (0, common_1.Get)('operational/:facilityId/insights'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator'),
    __param(0, (0, common_1.Param)('facilityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "generateOperationalInsights", null);
__decorate([
    (0, common_1.Get)('population-health/:facilityId'),
    (0, roles_decorator_1.Roles)('Provider', 'Quality Manager', 'System Administrator'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getPopulationHealthAnalytics", null);
__decorate([
    (0, common_1.Get)('population-health/:facilityId/risk-stratification'),
    (0, roles_decorator_1.Roles)('Provider', 'Quality Manager', 'System Administrator'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('patientIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "performRiskStratification", null);
__decorate([
    (0, common_1.Get)('population-health/:facilityId/health-outcomes'),
    (0, roles_decorator_1.Roles)('Provider', 'Quality Manager', 'System Administrator'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('outcomeIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "analyzeHealthOutcomes", null);
__decorate([
    (0, common_1.Get)('population-health/:facilityId/care-gaps'),
    (0, roles_decorator_1.Roles)('Provider', 'Quality Manager', 'System Administrator'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('patientIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "analyzeCareGaps", null);
__decorate([
    (0, common_1.Get)('population-health/:facilityId/insights'),
    (0, roles_decorator_1.Roles)('Provider', 'Quality Manager', 'System Administrator'),
    __param(0, (0, common_1.Param)('facilityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "generatePopulationInsights", null);
__decorate([
    (0, common_1.Post)('reports'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator', 'Quality Manager'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "createCustomReport", null);
__decorate([
    (0, common_1.Get)('reports/:reportId'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator', 'Quality Manager', 'Provider'),
    __param(0, (0, common_1.Param)('reportId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getReport", null);
__decorate([
    (0, common_1.Get)('reports'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator', 'Quality Manager', 'Provider'),
    __param(0, (0, common_1.Query)('facilityId')),
    __param(1, (0, common_1.Query)('type')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getReports", null);
__decorate([
    (0, common_1.Post)('reports/:reportId/schedule'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator', 'Quality Manager'),
    __param(0, (0, common_1.Param)('reportId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "scheduleReport", null);
__decorate([
    (0, common_1.Get)('reports/:reportId/export'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator', 'Quality Manager', 'Provider'),
    __param(0, (0, common_1.Param)('reportId')),
    __param(1, (0, common_1.Query)('format')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "exportReport", null);
__decorate([
    (0, common_1.Get)('real-time/:facilityId/metrics'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator', 'Front Desk Staff', 'Provider'),
    __param(0, (0, common_1.Param)('facilityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getRealTimeMetrics", null);
__decorate([
    (0, common_1.Get)('alerts/:facilityId'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator', 'Provider', 'Quality Manager'),
    __param(0, (0, common_1.Param)('facilityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getAnalyticsAlerts", null);
__decorate([
    (0, common_1.Get)('benchmarks/:facilityId'),
    (0, roles_decorator_1.Roles)('Department Manager', 'System Administrator', 'Quality Manager'),
    __param(0, (0, common_1.Param)('facilityId')),
    __param(1, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getBenchmarkComparisons", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, common_1.Controller)('analytics'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt'), roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [clinical_quality_measures_service_1.ClinicalQualityMeasuresService,
        financial_analytics_service_1.FinancialAnalyticsService,
        operational_metrics_service_1.OperationalMetricsService,
        population_health_service_1.PopulationHealthService,
        reporting_engine_service_1.ReportingEngineService])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map