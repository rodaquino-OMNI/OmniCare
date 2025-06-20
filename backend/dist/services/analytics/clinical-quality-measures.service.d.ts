import { EventEmitter } from 'events';
export interface ClinicalQualityMeasure {
    id: string;
    name: string;
    description: string;
    category: 'Process' | 'Outcome' | 'Structure' | 'Balancing';
    measureType: 'Proportion' | 'Ratio' | 'Continuous Variable' | 'Cohort';
    steward: string;
    nqfNumber?: string;
    cmsNumber?: string;
    version: string;
    measurementPeriod: {
        start: Date;
        end: Date;
    };
    population: {
        initialPopulation: number;
        denominator: number;
        numerator: number;
        exclusions: number;
        exceptions: number;
    };
    performanceRate: number;
    benchmark?: number;
    target?: number;
    trend: 'Improving' | 'Stable' | 'Declining';
    riskAdjusted: boolean;
}
export interface QualityMeasureReport {
    reportId: string;
    facilityId: string;
    reportingPeriod: {
        start: Date;
        end: Date;
    };
    measures: ClinicalQualityMeasure[];
    summary: {
        totalMeasures: number;
        averagePerformance: number;
        measuresAboveBenchmark: number;
        improvementOpportunities: number;
    };
    recommendations: QualityRecommendation[];
    generatedAt: Date;
    submittedTo?: string[];
}
export interface QualityRecommendation {
    measureId: string;
    priority: 'High' | 'Medium' | 'Low';
    recommendation: string;
    expectedImpact: string;
    implementationTimeline: string;
    resources: string[];
}
export interface QualityGapAnalysis {
    measureId: string;
    measureName: string;
    currentPerformance: number;
    benchmark: number;
    gap: number;
    impactedPatients: number;
    estimatedImprovement: {
        patients: number;
        revenueImpact: number;
        qualityScore: number;
    };
    interventions: {
        intervention: string;
        estimatedCost: number;
        expectedROI: number;
    }[];
}
export declare class ClinicalQualityMeasuresService extends EventEmitter {
    private measures;
    private historicalData;
    constructor();
    calculateQualityMeasures(facilityId: string, period: {
        start: Date;
        end: Date;
    }, measureIds?: string[]): Promise<ClinicalQualityMeasure[]>;
    generateQualityReport(facilityId: string, period: {
        start: Date;
        end: Date;
    }): Promise<QualityMeasureReport>;
    performGapAnalysis(facilityId: string, measureIds: string[]): Promise<QualityGapAnalysis[]>;
    getQualityTrends(facilityId: string, measureId: string, months?: number): Promise<{
        measureId: string;
        measureName: string;
        data: Array<{
            period: string;
            performanceRate: number;
            benchmark?: number;
            trend: 'up' | 'down' | 'stable';
        }>;
        overallTrend: 'Improving' | 'Stable' | 'Declining';
        changeRate: number;
    }>;
    getQualityDashboard(facilityId: string): Promise<{
        summary: {
            totalMeasures: number;
            averagePerformance: number;
            criticalMeasures: number;
            improvingMeasures: number;
        };
        alerts: Array<{
            measureId: string;
            measureName: string;
            severity: 'Critical' | 'Warning' | 'Info';
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
    }>;
    private calculateSingleMeasure;
    private calculateTrend;
    private generateRecommendations;
    private calculateRevenueImpact;
    private suggestInterventions;
    private getRecommendationText;
    private getRequiredResources;
    private storeHistoricalData;
    private initializeCoreMeasures;
}
//# sourceMappingURL=clinical-quality-measures.service.d.ts.map