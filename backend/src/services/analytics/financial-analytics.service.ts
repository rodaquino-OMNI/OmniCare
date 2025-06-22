/**
 * Financial Analytics Service
 * 
 * Comprehensive financial analytics, revenue cycle management,
 * and business intelligence for OmniCare EMR
 */

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
  current: number; // 0-30 days
  thirty: number;   // 31-60 days
  sixty: number;    // 61-90 days
  ninety: number;   // 91-120 days
  over120: number;  // >120 days
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

export class FinancialAnalyticsService extends EventEmitter {
  private _historicalData: Map<string, any[]> = new Map();
  private benchmarks: Map<string, number> = new Map();

  constructor() {
    super();
    this.initializeBenchmarks();
  }

  /**
   * Get comprehensive revenue cycle analytics
   */
  async getRevenueCycleAnalytics(
    facilityId: string,
    period: { start: Date; end: Date }
  ): Promise<{
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
  }> {
    const revenueMetrics = await this.calculateRevenueMetrics(facilityId, period);
    const payerMix = await this.analyzePayerMix(facilityId, period);
    const arAnalysis = await this.analyzeAccountsReceivable(facilityId);
    const denialAnalysis = await this.analyzeDenials(facilityId, period);
    const trends = await this.getRevenueTrends(facilityId, 12);
    const kpis = await this.calculateFinancialKPIs(revenueMetrics, payerMix, arAnalysis, denialAnalysis);

    return {
      revenueMetrics,
      payerMix,
      arAnalysis,
      denialAnalysis,
      trends,
      kpis
    };
  }

  /**
   * Analyze provider productivity and financial performance
   */
  async getProviderProductivityAnalysis(
    facilityId: string,
    period: { start: Date; end: Date },
    providerId?: string
  ): Promise<{
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
  }> {
    const providerMetrics = await this.calculateProviderProductivity(facilityId, period, providerId);
    const benchmarks = await this.getProductivityBenchmarks();
    
    const summary = {
      totalProviders: providerMetrics.length,
      averageProductivity: providerMetrics.reduce((sum, p) => sum + (p.totalRVUs || 0), 0) / providerMetrics.length,
      topPerformer: providerMetrics.sort((a, b) => (b.totalRVUs || 0) - (a.totalRVUs || 0))[0]?.providerName || 'N/A',
      improvementOpportunity: providerMetrics.filter(p => (p.totalRVUs || 0) < benchmarks.nationalBenchmarks.totalRVUs * 0.8).length
    };

    const recommendations = await this.generateProductivityRecommendations(providerMetrics, benchmarks);

    return {
      summary,
      providerMetrics,
      benchmarks,
      recommendations
    };
  }

  /**
   * Generate financial forecasting and budgeting
   */
  async generateFinancialForecast(
    facilityId: string,
    forecastMonths: number = 12
  ): Promise<{
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
  }> {
    const historicalRevenue = await this.getHistoricalRevenue(facilityId, 24);
    const seasonality = this.calculateSeasonality(historicalRevenue);
    const trendAnalysis = this.calculateTrend(historicalRevenue);

    const monthlyForecasts: FinancialForecast[] = [];
    let baseRevenue = historicalRevenue[historicalRevenue.length - 1]?.revenue || 0;

    for (let month = 1; month <= forecastMonths; month++) {
      const seasonalityFactor = seasonality[(month - 1) % 12] || 1.0;
      const trendFactor = 1 + (trendAnalysis.monthlyGrowthRate / 100);
      
      const projectedRevenue = baseRevenue * trendFactor * seasonalityFactor;
      const projectedExpenses = projectedRevenue * 0.75; // Assuming 75% expense ratio
      
      monthlyForecasts.push({
        period: this.getMonthName(month),
        projectedRevenue,
        projectedExpenses,
        projectedMargin: projectedRevenue - projectedExpenses,
        confidenceInterval: {
          lower: projectedRevenue * 0.85,
          upper: projectedRevenue * 1.15
        },
        keyAssumptions: [
          `Monthly growth rate: ${trendAnalysis.monthlyGrowthRate.toFixed(2)}%`,
          `Seasonality factor: ${((seasonalityFactor - 1) * 100).toFixed(1)}%`,
          'Current payer mix maintained',
          'No major market disruptions'
        ],
        riskFactors: [
          'Regulatory changes',
          'Payer contract renegotiations',
          'Economic downturn',
          'Competition changes'
        ]
      });

      baseRevenue = projectedRevenue;
    }

    const totalProjectedRevenue = monthlyForecasts.reduce((sum, f) => sum + f.projectedRevenue, 0);
    const projectedGrowthRate = ((totalProjectedRevenue / (historicalRevenue.reduce((sum, h) => sum + h.revenue, 0))) - 1) * 100;

    const scenarioAnalysis = this.generateScenarioAnalysis(monthlyForecasts);
    const keyDrivers = this.identifyKeyDrivers(historicalRevenue);

    return {
      summary: {
        totalProjectedRevenue,
        projectedGrowthRate,
        riskAdjustedRevenue: totalProjectedRevenue * 0.9,
        confidenceLevel: 85
      },
      monthlyForecasts,
      scenarioAnalysis,
      keyDrivers
    };
  }

  /**
   * Analyze profitability by service line
   */
  async getServiceLineProfitability(
    _facilityId: string,
    _period: { start: Date; end: Date }
  ): Promise<{
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
  }> {
    // Mock service line data - would integrate with actual EHR data
    const serviceLines = [
      {
        serviceLineName: 'Primary Care',
        revenue: 2500000,
        directCosts: 1500000,
        indirectCosts: 500000,
        grossMargin: 1000000,
        netMargin: 500000,
        marginPercentage: 20,
        volume: 15000,
        revenuePerUnit: 166.67,
        growthRate: 5.2
      },
      {
        serviceLineName: 'Cardiology',
        revenue: 1800000,
        directCosts: 900000,
        indirectCosts: 400000,
        grossMargin: 900000,
        netMargin: 500000,
        marginPercentage: 27.8,
        volume: 4500,
        revenuePerUnit: 400,
        growthRate: 8.1
      },
      {
        serviceLineName: 'Orthopedics',
        revenue: 3200000,
        directCosts: 1600000,
        indirectCosts: 600000,
        grossMargin: 1600000,
        netMargin: 1000000,
        marginPercentage: 31.25,
        volume: 3200,
        revenuePerUnit: 1000,
        growthRate: 12.5
      }
    ];

    const recommendations = serviceLines.map(sl => ({
      serviceLine: sl.serviceLineName,
      recommendation: sl.marginPercentage < 20 ? 
        'Focus on cost reduction and efficiency improvements' :
        'Expand capacity and market share',
      expectedImpact: sl.revenue * 0.05, // 5% improvement
      investmentRequired: sl.revenue * 0.02, // 2% investment
      roi: 2.5
    }));

    return { serviceLines, recommendations };
  }

  private async calculateRevenueMetrics(
    _facilityId: string,
    _period: { start: Date; end: Date }
  ): Promise<RevenueMetrics> {
    // Mock implementation - would query actual financial data
    const grossCharges = 5000000;
    const adjustments = 1200000;
    const writeOffs = 300000;
    const netCollections = 3500000;
    
    return {
      totalRevenue: grossCharges,
      grossCharges,
      netCollections,
      adjustments,
      writeOffs,
      collectionRate: (netCollections / (grossCharges - adjustments)) * 100,
      daysInAR: 45,
      denialRate: 8.5,
      firstPassResolutionRate: 91.2
    };
  }

  private async analyzePayerMix(
    _facilityId: string,
    _period: { start: Date; end: Date }
  ): Promise<PayerMix[]> {
    return [
      {
        payerName: 'Blue Cross Blue Shield',
        payerType: 'Commercial',
        volume: 3500,
        percentage: 35,
        averageReimbursement: 285,
        totalRevenue: 997500,
        denialRate: 5.2,
        averageDaysToPayment: 32
      },
      {
        payerName: 'Medicare',
        payerType: 'Medicare',
        volume: 2800,
        percentage: 28,
        averageReimbursement: 198,
        totalRevenue: 554400,
        denialRate: 3.1,
        averageDaysToPayment: 21
      },
      {
        payerName: 'Medicaid',
        payerType: 'Medicaid',
        volume: 2200,
        percentage: 22,
        averageReimbursement: 156,
        totalRevenue: 343200,
        denialRate: 12.8,
        averageDaysToPayment: 45
      },
      {
        payerName: 'Self-Pay',
        payerType: 'Self-Pay',
        volume: 1500,
        percentage: 15,
        averageReimbursement: 89,
        totalRevenue: 133500,
        denialRate: 0,
        averageDaysToPayment: 65
      }
    ];
  }

  private async analyzeAccountsReceivable(_facilityId: string): Promise<ARAnalysis> {
    const totalAR = 1250000;
    
    return {
      totalAR,
      current: 625000,    // 50%
      thirty: 250000,     // 20%
      sixty: 187500,      // 15%
      ninety: 125000,     // 10%
      over120: 62500,     // 5%
      buckets: [
        { ageBucket: '0-30 days', amount: 625000, percentage: 50, claimCount: 2500 },
        { ageBucket: '31-60 days', amount: 250000, percentage: 20, claimCount: 800 },
        { ageBucket: '61-90 days', amount: 187500, percentage: 15, claimCount: 450 },
        { ageBucket: '91-120 days', amount: 125000, percentage: 10, claimCount: 250 },
        { ageBucket: '>120 days', amount: 62500, percentage: 5, claimCount: 125 }
      ]
    };
  }

  private async analyzeDenials(
    _facilityId: string,
    _period: { start: Date; end: Date }
  ): Promise<DenialAnalysis> {
    return {
      totalDenials: 425,
      denialRate: 8.5,
      topDenialReasons: [
        {
          reasonCode: 'CO-11',
          description: 'Diagnosis inconsistent with procedure',
          count: 85,
          amount: 42500,
          percentage: 20
        },
        {
          reasonCode: 'CO-16',
          description: 'Claim lacks required information',
          count: 72,
          amount: 36000,
          percentage: 17
        },
        {
          reasonCode: 'CO-97',
          description: 'Payment is included in another service',
          count: 68,
          amount: 34000,
          percentage: 16
        }
      ],
      denialsByPayer: [
        {
          payerName: 'Medicaid',
          denialCount: 180,
          denialAmount: 90000,
          denialRate: 12.8
        },
        {
          payerName: 'Blue Cross Blue Shield',
          denialCount: 145,
          denialAmount: 72500,
          denialRate: 5.2
        }
      ],
      appealableAmount: 156000,
      recoveryOpportunity: 93600
    };
  }

  private async getRevenueTrends(_facilityId: string, months: number): Promise<any[]> {
    const trends = [];
    const now = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      
      trends.push({
        period: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        revenue: Math.floor(Math.random() * 500000) + 400000,
        collections: Math.floor(Math.random() * 450000) + 350000,
        denials: Math.floor(Math.random() * 50) + 20,
        ar: Math.floor(Math.random() * 200000) + 1000000
      });
    }
    
    return trends;
  }

  private async calculateFinancialKPIs(
    revenue: RevenueMetrics,
    _payerMix: PayerMix[],
    _ar: ARAnalysis,
    _denials: DenialAnalysis
  ): Promise<any[]> {
    const kpis = [
      {
        name: 'Collection Rate',
        value: revenue.collectionRate,
        target: this.benchmarks.get('collection-rate') || 95,
        variance: 0,
        trend: 'stable' as const
      },
      {
        name: 'Days in A/R',
        value: revenue.daysInAR,
        target: this.benchmarks.get('days-in-ar') || 35,
        variance: 0,
        trend: 'up' as const
      },
      {
        name: 'Denial Rate',
        value: revenue.denialRate,
        target: this.benchmarks.get('denial-rate') || 5,
        variance: 0,
        trend: 'down' as const
      },
      {
        name: 'First Pass Resolution',
        value: revenue.firstPassResolutionRate,
        target: this.benchmarks.get('first-pass-resolution') || 95,
        variance: 0,
        trend: 'stable' as const
      }
    ];

    // Calculate variances
    kpis.forEach(kpi => {
      kpi.variance = ((kpi.value - kpi.target) / kpi.target) * 100;
    });

    return kpis;
  }

  private async calculateProviderProductivity(
    _facilityId: string,
    _period: { start: Date; end: Date },
    _providerId?: string
  ): Promise<ProductivityMetrics[]> {
    // Mock provider productivity data
    return [
      {
        providerId: 'PROV001',
        providerName: 'Dr. Smith',
        totalEncounters: 1250,
        totalRVUs: 3750,
        workRVUs: 2250,
        practiceExpenseRVUs: 1125,
        malpracticeRVUs: 375,
        averageRVUPerEncounter: 3.0,
        revenuePerRVU: 45.50,
        revenuePerEncounter: 136.50,
        totalRevenue: 170625,
        collectionEfficiency: 92.5
      },
      {
        providerId: 'PROV002',
        providerName: 'Dr. Johnson',
        totalEncounters: 980,
        totalRVUs: 3430,
        workRVUs: 2058,
        practiceExpenseRVUs: 1029,
        malpracticeRVUs: 343,
        averageRVUPerEncounter: 3.5,
        revenuePerRVU: 47.20,
        revenuePerEncounter: 165.20,
        totalRevenue: 161896,
        collectionEfficiency: 94.2
      }
    ];
  }

  private async getProductivityBenchmarks(): Promise<any> {
    return {
      specialtyBenchmarks: new Map([
        ['Family Medicine', {
          totalRVUs: 4500,
          workRVUs: 2700,
          practiceExpenseRVUs: 1350,
          malpracticeRVUs: 450,
          revenuePerRVU: 50.00
        }],
        ['Internal Medicine', {
          totalRVUs: 4200,
          workRVUs: 2520,
          practiceExpenseRVUs: 1260,
          malpracticeRVUs: 420,
          revenuePerRVU: 52.00
        }]
      ]),
      nationalBenchmarks: {
        totalRVUs: 4350,
        workRVUs: 2610,
        practiceExpenseRVUs: 1305,
        malpracticeRVUs: 435,
        revenuePerRVU: 51.00,
        collectionEfficiency: 95.0
      }
    };
  }

  private async generateProductivityRecommendations(
    metrics: ProductivityMetrics[],
    benchmarks: any
  ): Promise<any[]> {
    return metrics.map(provider => {
      let recommendation = 'Performance within expected range';
      let priority: 'High' | 'Medium' | 'Low' = 'Low';
      let expectedImpact = 0;

      if ((provider.totalRVUs || 0) < benchmarks.nationalBenchmarks.totalRVUs * 0.8) {
        recommendation = 'Focus on increasing patient volume and encounter complexity';
        priority = 'High';
        expectedImpact = 25000;
      } else if ((provider.collectionEfficiency || 0) < 90) {
        recommendation = 'Improve documentation and coding accuracy';
        priority = 'Medium';
        expectedImpact = 15000;
      }

      return {
        providerId: provider.providerId || '',
        recommendation,
        expectedImpact,
        priority
      };
    });
  }

  private async getHistoricalRevenue(_facilityId: string, months: number): Promise<any[]> {
    const data = [];
    const now = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      
      data.push({
        period: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        revenue: Math.floor(Math.random() * 200000) + 400000 + (i * 5000), // Growth trend
        date
      });
    }
    
    return data;
  }

  private calculateSeasonality(_historicalData: any[]): number[] {
    // Mock seasonality calculation - would use actual statistical analysis
    return [1.0, 0.95, 1.02, 1.05, 1.03, 0.98, 0.92, 0.88, 1.08, 1.12, 1.05, 0.97];
  }

  private calculateTrend(historicalData: any[]): { monthlyGrowthRate: number; annualGrowthRate: number } {
    if (historicalData.length < 2) {
      return { monthlyGrowthRate: 0, annualGrowthRate: 0 };
    }

    const firstRevenue = historicalData[0].revenue;
    const lastRevenue = historicalData[historicalData.length - 1].revenue;
    const months = historicalData.length - 1;
    
    const monthlyGrowthRate = (Math.pow(lastRevenue / firstRevenue, 1 / months) - 1) * 100;
    const annualGrowthRate = monthlyGrowthRate * 12;

    return { monthlyGrowthRate, annualGrowthRate };
  }

  private generateScenarioAnalysis(forecasts: FinancialForecast[]): any {
    const realistic = forecasts[0]; // Use first forecast as baseline
    
    if (!realistic) {
      return {
        optimistic: null,
        realistic: null,
        pessimistic: null
      };
    }
    
    return {
      optimistic: {
        ...realistic,
        projectedRevenue: realistic.projectedRevenue * 1.15,
        projectedMargin: realistic.projectedMargin * 1.20
      },
      realistic,
      pessimistic: {
        ...realistic,
        projectedRevenue: realistic.projectedRevenue * 0.85,
        projectedMargin: realistic.projectedMargin * 0.75
      }
    };
  }

  private identifyKeyDrivers(_historicalData: any[]): any[] {
    return [
      {
        driver: 'Patient Volume',
        impact: 0.45,
        sensitivity: 'High' as const
      },
      {
        driver: 'Payer Mix',
        impact: 0.25,
        sensitivity: 'Medium' as const
      },
      {
        driver: 'Service Line Mix',
        impact: 0.20,
        sensitivity: 'Medium' as const
      },
      {
        driver: 'Collection Efficiency',
        impact: 0.10,
        sensitivity: 'Low' as const
      }
    ];
  }

  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[(month - 1) % 12] || 'Unknown';
  }

  private initializeBenchmarks(): void {
    this.benchmarks.set('collection-rate', 95);
    this.benchmarks.set('days-in-ar', 35);
    this.benchmarks.set('denial-rate', 5);
    this.benchmarks.set('first-pass-resolution', 95);
    this.benchmarks.set('net-collection-rate', 98);
    this.benchmarks.set('cost-to-collect', 3.5);
  }
}