import { EventEmitter } from 'events';
export interface RevenueMetrics {
    totalRevenue: number;
    grossCharges: number;
    netCollections: number;
    adjustments: number;
    writeOffs: number;
    collectionRate: number;
    daysInAR: number;
    denialRate: number;
    firstPassResolutionRate: number;
}
export interface PayerMix {
    payerName: string;
    payerType: 'Commercial' | 'Medicare' | 'Medicaid' | 'Self-Pay' | 'Workers Comp' | 'Other';
    volume: number;
    percentage: number;
    averageReimbursement: number;
    totalRevenue: number;
    denialRate: number;
    averageDaysToPayment: number;
}
export interface ARAnalysis {
    totalAR: number;
    current: number;
    thirty: number;
    sixty: number;
    ninety: number;
    over120: number;
    buckets: Array<{
        ageBucket: string;
        amount: number;
        percentage: number;
        claimCount: number;
    }>;
}
export interface DenialAnalysis {
    totalDenials: number;
    denialRate: number;
    topDenialReasons: Array<{
        reasonCode: string;
        description: string;
        count: number;
        amount: number;
        percentage: number;
    }>;
    denialsByPayer: Array<{
        payerName: string;
        denialCount: number;
        denialAmount: number;
        denialRate: number;
    }>;
    appealableAmount: number;
    recoveryOpportunity: number;
}
export interface ProductivityMetrics {
    providerId?: string;
    providerName?: string;
    totalEncounters: number;
    totalRVUs: number;
    workRVUs: number;
    practiceExpenseRVUs: number;
    malpracticeRVUs: number;
    averageRVUPerEncounter: number;
    revenuePerRVU: number;
    revenuePerEncounter: number;
    totalRevenue: number;
    collectionEfficiency: number;
}
export interface FinancialForecast {
    period: string;
    projectedRevenue: number;
    projectedExpenses: number;
    projectedMargin: number;
    confidenceInterval: {
        lower: number;
        upper: number;
    };
    keyAssumptions: string[];
    riskFactors: string[];
}
export declare class FinancialAnalyticsService extends EventEmitter {
    private historicalData;
    private benchmarks;
    constructor();
    getRevenueCycleAnalytics(facilityId: string, period: {
        start: Date;
        end: Date;
    }): Promise<{
        revenueMetrics: RevenueMetrics;
        payerMix: PayerMix[];
        arAnalysis: ARAnalysis;
        denialAnalysis: DenialAnalysis;
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
            trend: 'up' | 'down' | 'stable';
        }>;
    }>;
    getProviderProductivityAnalysis(facilityId: string, period: {
        start: Date;
        end: Date;
    }, providerId?: string): Promise<{
        summary: {
            totalProviders: number;
            averageProductivity: number;
            topPerformer: string;
            improvementOpportunity: number;
        };
        providerMetrics: ProductivityMetrics[];
        benchmarks: {
            specialtyBenchmarks: Map<string, ProductivityMetrics>;
            nationalBenchmarks: ProductivityMetrics;
        };
        recommendations: Array<{
            providerId: string;
            recommendation: string;
            expectedImpact: number;
            priority: 'High' | 'Medium' | 'Low';
        }>;
    }>;
    generateFinancialForecast(facilityId: string, forecastMonths?: number): Promise<{
        summary: {
            totalProjectedRevenue: number;
            projectedGrowthRate: number;
            riskAdjustedRevenue: number;
            confidenceLevel: number;
        };
        monthlyForecasts: FinancialForecast[];
        scenarioAnalysis: {
            optimistic: FinancialForecast;
            realistic: FinancialForecast;
            pessimistic: FinancialForecast;
        };
        keyDrivers: Array<{
            driver: string;
            impact: number;
            sensitivity: 'High' | 'Medium' | 'Low';
        }>;
    }>;
    getServiceLineProfitability(facilityId: string, period: {
        start: Date;
        end: Date;
    }): Promise<{
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
    }>;
    private calculateRevenueMetrics;
    private analyzePayerMix;
    private analyzeAccountsReceivable;
    private analyzeDenials;
    private getRevenueTrends;
    private calculateFinancialKPIs;
    private calculateProviderProductivity;
    private getProductivityBenchmarks;
    private generateProductivityRecommendations;
    private getHistoricalRevenue;
    private calculateSeasonality;
    private calculateTrend;
    private generateScenarioAnalysis;
    private identifyKeyDrivers;
    private getMonthName;
    private initializeBenchmarks;
}
//# sourceMappingURL=financial-analytics.service.d.ts.map