import { ClinicalQualityMeasuresService } from '../services/analytics/clinical-quality-measures.service';
import { FinancialAnalyticsService } from '../services/analytics/financial-analytics.service';
import { OperationalMetricsService } from '../services/analytics/operational-metrics.service';
import { PopulationHealthService } from '../services/analytics/population-health.service';
import { ReportingEngineService } from '../services/analytics/reporting-engine.service';
export declare class AnalyticsController {
    private readonly clinicalQualityService;
    private readonly financialAnalyticsService;
    private readonly operationalMetricsService;
    private readonly populationHealthService;
    private readonly reportingEngineService;
    constructor(clinicalQualityService: ClinicalQualityMeasuresService, financialAnalyticsService: FinancialAnalyticsService, operationalMetricsService: OperationalMetricsService, populationHealthService: PopulationHealthService, reportingEngineService: ReportingEngineService);
    getClinicalQualityMeasures(facilityId: string, startDate?: string, endDate?: string, measureIds?: string): Promise<{
        success: boolean;
        data: import("../services/analytics/clinical-quality-measures.service").ClinicalQualityMeasure[];
        meta: {
            facilityId: string;
            period: {
                start: Date;
                end: Date;
            } | undefined;
            measureCount: number;
        };
    }>;
    generateQualityReport(facilityId: string, startDate: string, endDate: string): Promise<{
        success: boolean;
        data: import("../services/analytics/clinical-quality-measures.service").QualityMeasureReport;
    }>;
    performQualityGapAnalysis(facilityId: string, measureIds: string): Promise<{
        success: boolean;
        data: import("../services/analytics/clinical-quality-measures.service").QualityGapAnalysis[];
    }>;
    getQualityDashboard(facilityId: string): Promise<{
        success: boolean;
        data: {
            summary: {
                totalMeasures: number;
                averagePerformance: number;
                criticalMeasures: number;
                improvingMeasures: number;
            };
            alerts: Array<{
                measureId: string;
                measureName: string;
                severity: "Critical" | "Warning" | "Info";
                message: string;
                actionRequired: boolean;
            }>;
            topPerformers: Array<{
                measureId: string;
                measureName: string;
                performanceRate: number;
                benchmark: number;
            }>;
            needsAttention: Array<{
                measureId: string;
                measureName: string;
                performanceRate: number;
                benchmark: number;
                gap: number;
            }>;
        };
    }>;
    getRevenueCycleAnalytics(facilityId: string, startDate: string, endDate: string): Promise<{
        success: boolean;
        data: {
            revenueMetrics: import("../services/analytics/financial-analytics.service").RevenueMetrics;
            payerMix: import("../services/analytics/financial-analytics.service").PayerMix[];
            arAnalysis: import("../services/analytics/financial-analytics.service").ARAnalysis;
            denialAnalysis: import("../services/analytics/financial-analytics.service").DenialAnalysis;
            trends: Array<{
                period: string;
                revenue: number;
                collections: number;
                denials: number;
                ar: number;
            }>;
            kpis: Array<{
                name: string;
                value: number;
                target: number;
                variance: number;
                trend: "up" | "down" | "stable";
            }>;
        };
    }>;
    getProviderProductivityAnalysis(facilityId: string, startDate: string, endDate: string, providerId?: string): Promise<{
        success: boolean;
        data: {
            summary: {
                totalProviders: number;
                averageProductivity: number;
                topPerformer: string;
                improvementOpportunity: number;
            };
            providerMetrics: import("../services/analytics/financial-analytics.service").ProductivityMetrics[];
            benchmarks: {
                specialtyBenchmarks: Map<string, import("../services/analytics/financial-analytics.service").ProductivityMetrics>;
                nationalBenchmarks: import("../services/analytics/financial-analytics.service").ProductivityMetrics;
            };
            recommendations: Array<{
                providerId: string;
                recommendation: string;
                expectedImpact: number;
                priority: "High" | "Medium" | "Low";
            }>;
        };
    }>;
    generateFinancialForecast(facilityId: string, months?: string): Promise<{
        success: boolean;
        data: {
            summary: {
                totalProjectedRevenue: number;
                projectedGrowthRate: number;
                riskAdjustedRevenue: number;
                confidenceLevel: number;
            };
            monthlyForecasts: import("../services/analytics/financial-analytics.service").FinancialForecast[];
            scenarioAnalysis: {
                optimistic: import("../services/analytics/financial-analytics.service").FinancialForecast;
                realistic: import("../services/analytics/financial-analytics.service").FinancialForecast;
                pessimistic: import("../services/analytics/financial-analytics.service").FinancialForecast;
            };
            keyDrivers: Array<{
                driver: string;
                impact: number;
                sensitivity: "High" | "Medium" | "Low";
            }>;
        };
    }>;
    getServiceLineProfitability(facilityId: string, startDate: string, endDate: string): Promise<{
        success: boolean;
        data: {
            serviceLines: Array<{
                serviceLineName: string;
                revenue: number;
                directCosts: number;
                indirectCosts: number;
                grossMargin: number;
                netMargin: number;
                marginPercentage: number;
                volume: number;
                revenuePerUnit: number;
                growthRate: number;
            }>;
            recommendations: Array<{
                serviceLine: string;
                recommendation: string;
                expectedImpact: number;
                investmentRequired: number;
                roi: number;
            }>;
        };
    }>;
    getPatientFlowAnalytics(facilityId: string, startDate?: string, endDate?: string): Promise<{
        success: boolean;
        data: import("../services/analytics/operational-metrics.service").PatientFlowMetrics;
    }>;
    getStaffUtilizationAnalytics(facilityId: string, startDate: string, endDate: string, departmentId?: string): Promise<{
        success: boolean;
        data: import("../services/analytics/operational-metrics.service").StaffUtilizationMetrics;
    }>;
    getAppointmentAnalytics(facilityId: string, startDate: string, endDate: string): Promise<{
        success: boolean;
        data: import("../services/analytics/operational-metrics.service").AppointmentAnalytics;
    }>;
    getQualityMetrics(facilityId: string, startDate: string, endDate: string): Promise<{
        success: boolean;
        data: import("../services/analytics/operational-metrics.service").QualityMetrics;
    }>;
    getOperationalDashboard(facilityId: string): Promise<{
        success: boolean;
        data: import("../services/analytics/operational-metrics.service").OperationalDashboard;
    }>;
    generateOperationalInsights(facilityId: string): Promise<{
        success: boolean;
        data: {
            insights: Array<{
                category: "Patient Flow" | "Staffing" | "Quality" | "Efficiency";
                insight: string;
                impact: "High" | "Medium" | "Low";
                confidence: number;
                recommendations: string[];
            }>;
            predictions: Array<{
                metric: string;
                currentValue: number;
                predictedValue: number;
                timeframe: string;
                confidence: number;
                factors: string[];
            }>;
        };
    }>;
    getPopulationHealthAnalytics(facilityId: string, startDate?: string, endDate?: string): Promise<{
        success: boolean;
        data: import("../services/analytics/population-health.service").PopulationHealthMetrics;
    }>;
    performRiskStratification(facilityId: string, patientIds?: string): Promise<{
        success: boolean;
        data: import("../services/analytics/population-health.service").RiskStratification[];
    }>;
    analyzeHealthOutcomes(facilityId: string, outcomeIds?: string): Promise<{
        success: boolean;
        data: import("../services/analytics/population-health.service").HealthOutcome[];
    }>;
    analyzeCareGaps(facilityId: string, patientIds?: string): Promise<{
        success: boolean;
        data: import("../services/analytics/population-health.service").CareGapAnalysis[];
    }>;
    generatePopulationInsights(facilityId: string): Promise<{
        success: boolean;
        data: import("../services/analytics/population-health.service").PopulationInsights;
    }>;
    createCustomReport(reportConfig: any): Promise<{
        success: boolean;
        data: import("../services/analytics/reporting-engine.service").ReportConfiguration;
    }>;
    getReport(reportId: string): Promise<{
        success: boolean;
        data: import("../services/analytics/reporting-engine.service").GeneratedReport;
    }>;
    getReports(facilityId?: string, type?: string, status?: string): Promise<{
        success: boolean;
        data: {
            reports: import("../services/analytics/reporting-engine.service").GeneratedReport[];
            total: number;
        };
    }>;
    scheduleReport(reportId: string, scheduleConfig: any): Promise<{
        success: boolean;
        data: import("../services/analytics/reporting-engine.service").ReportConfiguration;
    }>;
    exportReport(reportId: string, format?: 'pdf' | 'excel' | 'csv'): Promise<{
        success: boolean;
        data: {
            filePath: string;
            downloadUrl: string;
            expiresAt: Date;
        };
    }>;
    getRealTimeMetrics(facilityId: string): Promise<{
        success: boolean;
        data: {
            currentlyInFacility: number;
            waitingPatients: number;
            inProgressEncounters: number;
            completedToday: number;
            averageWaitTime: number;
            staffOnDuty: number;
            availableRooms: number;
        };
        timestamp: Date;
    }>;
    getAnalyticsAlerts(facilityId: string): Promise<{
        success: boolean;
        data: {
            id: string;
            type: string;
            title: string;
            message: string;
            timestamp: Date;
            acknowledged: boolean;
        }[];
    }>;
    getBenchmarkComparisons(facilityId: string, category?: string): Promise<{
        success: boolean;
        data: any;
    }>;
}
//# sourceMappingURL=analytics.controller.d.ts.map