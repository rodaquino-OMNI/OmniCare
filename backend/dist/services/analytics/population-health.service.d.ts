import { EventEmitter } from 'events';
export interface PopulationHealthMetrics {
    totalPopulation: number;
    riskDistribution: {
        lowRisk: number;
        moderateRisk: number;
        highRisk: number;
        veryHighRisk: number;
    };
    chronicConditions: Array<{
        condition: string;
        prevalence: number;
        totalPatients: number;
        controlledRate: number;
        averageRiskScore: number;
    }>;
    socialDeterminants: {
        socialRiskScore: number;
        housingInstability: number;
        foodInsecurity: number;
        transportationBarriers: number;
        financialHardship: number;
    };
    healthEquity: {
        disparityIndex: number;
        raceEthnicityBreakdown: Array<{
            group: string;
            population: number;
            healthOutcomes: number;
            accessScore: number;
        }>;
        ageGroupAnalysis: Array<{
            ageGroup: string;
            population: number;
            riskScore: number;
            utilizationRate: number;
        }>;
    };
}
export interface RiskStratification {
    patientId: string;
    riskScore: number;
    riskLevel: 'Low' | 'Moderate' | 'High' | 'Very High';
    riskFactors: Array<{
        factor: string;
        weight: number;
        contribution: number;
        modifiable: boolean;
    }>;
    predictedOutcomes: {
        hospitalReadmission: number;
        emergencyDepartmentVisit: number;
        chronicDiseaseProgression: number;
        mortalityRisk: number;
    };
    recommendedInterventions: Array<{
        intervention: string;
        priority: 'High' | 'Medium' | 'Low';
        expectedImpact: number;
        costEffectiveness: number;
    }>;
    lastUpdated: Date;
}
export interface HealthOutcome {
    outcomeId: string;
    outcomeName: string;
    measure: string;
    target: number;
    current: number;
    trend: 'Improving' | 'Stable' | 'Declining';
    populationSize: number;
    timeframe: string;
    benchmarks: {
        national: number;
        regional: number;
        peerGroup: number;
    };
    disparities: Array<{
        subgroup: string;
        outcome: number;
        disparityGap: number;
    }>;
}
export interface CareGapAnalysis {
    patientId: string;
    patientName: string;
    gaps: Array<{
        gapType: 'Preventive Care' | 'Chronic Care Management' | 'Medication Adherence' | 'Follow-up Care';
        description: string;
        severity: 'Critical' | 'High' | 'Medium' | 'Low';
        daysOverdue: number;
        clinicalImpact: string;
        financialImpact: number;
        recommendedAction: string;
        assignedProvider?: string;
    }>;
    totalGaps: number;
    priorityScore: number;
    interventionRecommendations: string[];
}
export interface PopulationInsights {
    insights: Array<{
        category: 'Risk Management' | 'Care Gaps' | 'Health Outcomes' | 'Resource Utilization';
        insight: string;
        impact: 'High' | 'Medium' | 'Low';
        confidence: number;
        affectedPopulation: number;
        recommendations: string[];
        metrics: Record<string, number>;
    }>;
    trendAnalysis: {
        populationGrowth: number;
        riskTrends: Array<{
            riskLevel: string;
            change: number;
            direction: 'Increase' | 'Decrease' | 'Stable';
        }>;
        outcomeImprovements: Array<{
            outcome: string;
            improvement: number;
            timeframe: string;
        }>;
    };
    actionablePriorities: Array<{
        priority: string;
        description: string;
        expectedImpact: string;
        resourceRequired: string;
        timeline: string;
    }>;
}
export declare class PopulationHealthService extends EventEmitter {
    private riskModels;
    private outcomeMetrics;
    private interventionHistory;
    constructor();
    getPopulationHealthAnalytics(facilityId: string, period?: {
        start: Date;
        end: Date;
    }): Promise<PopulationHealthMetrics>;
    performRiskStratification(facilityId: string, patientIds?: string[]): Promise<RiskStratification[]>;
    analyzeHealthOutcomes(facilityId: string, outcomeIds?: string[]): Promise<HealthOutcome[]>;
    analyzeCareGaps(facilityId: string, patientIds?: string[]): Promise<CareGapAnalysis[]>;
    generatePopulationInsights(facilityId: string): Promise<PopulationInsights>;
    monitorInterventionEffectiveness(facilityId: string, interventionId: string, period: {
        start: Date;
        end: Date;
    }): Promise<{
        intervention: {
            id: string;
            name: string;
            type: string;
            startDate: Date;
            endDate?: Date;
        };
        targetPopulation: {
            size: number;
            eligiblePatients: number;
            enrolledPatients: number;
            completedPatients: number;
        };
        outcomes: Array<{
            metric: string;
            baseline: number;
            current: number;
            change: number;
            changePercentage: number;
            significant: boolean;
        }>;
        costEffectiveness: {
            totalCost: number;
            costPerPatient: number;
            estimatedSavings: number;
            roi: number;
        };
        recommendations: string[];
    }>;
    private getTotalPopulation;
    private calculateRiskDistribution;
    private analyzeChronicConditions;
    private assessSocialDeterminants;
    private analyzeHealthEquity;
    private getAllPatientIds;
    private getPatientData;
    private calculateRiskScore;
    private classifyRiskLevel;
    private identifyRiskFactors;
    private predictOutcomes;
    private recommendInterventions;
    private getStandardOutcomes;
    private calculateHealthOutcome;
    private getBenchmarks;
    private analyzeDisparities;
    private calculateOutcomeTrend;
    private getOutcomeName;
    private getOutcomeMeasure;
    private getOutcomeTarget;
    private getHighRiskPatients;
    private identifyCareGaps;
    private calculatePriorityScore;
    private generateInterventionRecommendations;
    private generateInsights;
    private analyzeTrends;
    private identifyActionablePriorities;
    private getInterventionDetails;
    private getTargetPopulation;
    private measureInterventionOutcomes;
    private calculateCostEffectiveness;
    private initializeRiskModels;
}
//# sourceMappingURL=population-health.service.d.ts.map