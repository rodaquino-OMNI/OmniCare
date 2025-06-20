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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicalQualityMeasuresService = void 0;
const common_1 = require("@nestjs/common");
const events_1 = require("events");
let ClinicalQualityMeasuresService = class ClinicalQualityMeasuresService extends events_1.EventEmitter {
    measures = new Map();
    historicalData = new Map();
    constructor() {
        super();
        this.initializeCoreMeasures();
    }
    async calculateQualityMeasures(facilityId, period, measureIds) {
        const measuresToCalculate = measureIds ?
            measureIds.map(id => this.measures.get(id)).filter(Boolean) :
            Array.from(this.measures.values());
        const calculatedMeasures = [];
        for (const measure of measuresToCalculate) {
            if (!measure)
                continue;
            const calculatedMeasure = await this.calculateSingleMeasure(measure, facilityId, period);
            calculatedMeasures.push(calculatedMeasure);
        }
        this.emit('measures-calculated', {
            facilityId,
            period,
            measures: calculatedMeasures
        });
        return calculatedMeasures;
    }
    async generateQualityReport(facilityId, period) {
        const measures = await this.calculateQualityMeasures(facilityId, period);
        const summary = {
            totalMeasures: measures.length,
            averagePerformance: measures.reduce((sum, m) => sum + m.performanceRate, 0) / measures.length,
            measuresAboveBenchmark: measures.filter(m => m.benchmark && m.performanceRate >= m.benchmark).length,
            improvementOpportunities: measures.filter(m => m.benchmark && m.performanceRate < m.benchmark).length
        };
        const recommendations = await this.generateRecommendations(measures);
        const report = {
            reportId: `QMR-${Date.now()}`,
            facilityId,
            reportingPeriod: period,
            measures,
            summary,
            recommendations,
            generatedAt: new Date()
        };
        this.storeHistoricalData(facilityId, measures);
        return report;
    }
    async performGapAnalysis(facilityId, measureIds) {
        const gapAnalyses = [];
        for (const measureId of measureIds) {
            const measure = this.measures.get(measureId);
            if (!measure || !measure.benchmark)
                continue;
            const gap = measure.benchmark - measure.performanceRate;
            if (gap <= 0)
                continue;
            const analysis = {
                measureId,
                measureName: measure.name,
                currentPerformance: measure.performanceRate,
                benchmark: measure.benchmark,
                gap,
                impactedPatients: Math.floor(measure.population.denominator * (gap / 100)),
                estimatedImprovement: {
                    patients: Math.floor(measure.population.denominator * (gap / 100) * 0.7),
                    revenueImpact: this.calculateRevenueImpact(measure, gap),
                    qualityScore: gap * 0.8
                },
                interventions: await this.suggestInterventions(measure, gap)
            };
            gapAnalyses.push(analysis);
        }
        return gapAnalyses.sort((a, b) => b.gap - a.gap);
    }
    async getQualityTrends(facilityId, measureId, months = 12) {
        const historical = this.historicalData.get(`${facilityId}-${measureId}`) || [];
        const measure = this.measures.get(measureId);
        const recentData = historical.slice(-months);
        const data = recentData.map((item, index) => {
            const previousRate = index > 0 ? recentData[index - 1].performanceRate : item.performanceRate;
            let trend = 'stable';
            if (item.performanceRate > previousRate * 1.02)
                trend = 'up';
            else if (item.performanceRate < previousRate * 0.98)
                trend = 'down';
            return {
                period: `${item.measurementPeriod.start.getFullYear()}-${item.measurementPeriod.start.getMonth() + 1}`,
                performanceRate: item.performanceRate,
                benchmark: item.benchmark,
                trend
            };
        });
        const firstRate = recentData[0]?.performanceRate || 0;
        const lastRate = recentData[recentData.length - 1]?.performanceRate || 0;
        const changeRate = ((lastRate - firstRate) / firstRate) * 100;
        let overallTrend = 'Stable';
        if (changeRate > 2)
            overallTrend = 'Improving';
        else if (changeRate < -2)
            overallTrend = 'Declining';
        return {
            measureId,
            measureName: measure?.name || 'Unknown Measure',
            data,
            overallTrend,
            changeRate
        };
    }
    async getQualityDashboard(facilityId) {
        const measures = Array.from(this.measures.values());
        const summary = {
            totalMeasures: measures.length,
            averagePerformance: measures.reduce((sum, m) => sum + m.performanceRate, 0) / measures.length,
            criticalMeasures: measures.filter(m => m.benchmark && m.performanceRate < m.benchmark * 0.8).length,
            improvingMeasures: measures.filter(m => m.trend === 'Improving').length
        };
        const alerts = measures
            .filter(m => m.benchmark && m.performanceRate < m.benchmark * 0.9)
            .map(measure => ({
            measureId: measure.id,
            measureName: measure.name,
            severity: (measure.performanceRate < measure.benchmark * 0.8) ? 'Critical' : 'Warning',
            message: `Performance (${measure.performanceRate.toFixed(1)}%) below benchmark (${measure.benchmark.toFixed(1)}%)`,
            actionRequired: measure.performanceRate < measure.benchmark * 0.8
        }));
        const topPerformers = measures
            .filter(m => m.benchmark && m.performanceRate >= m.benchmark)
            .sort((a, b) => (b.performanceRate - (b.benchmark || 0)) - (a.performanceRate - (a.benchmark || 0)))
            .slice(0, 5)
            .map(m => ({
            measureId: m.id,
            measureName: m.name,
            performanceRate: m.performanceRate,
            benchmark: m.benchmark || 0
        }));
        const needsAttention = measures
            .filter(m => m.benchmark && m.performanceRate < m.benchmark)
            .sort((a, b) => ((a.benchmark || 0) - a.performanceRate) - ((b.benchmark || 0) - b.performanceRate))
            .slice(0, 10)
            .map(m => ({
            measureId: m.id,
            measureName: m.name,
            performanceRate: m.performanceRate,
            benchmark: m.benchmark || 0,
            gap: (m.benchmark || 0) - m.performanceRate
        }));
        return {
            summary,
            alerts,
            topPerformers,
            needsAttention
        };
    }
    async calculateSingleMeasure(measure, facilityId, period) {
        const mockPopulation = {
            initialPopulation: Math.floor(Math.random() * 1000) + 500,
            denominator: Math.floor(Math.random() * 800) + 400,
            numerator: Math.floor(Math.random() * 600) + 200,
            exclusions: Math.floor(Math.random() * 50),
            exceptions: Math.floor(Math.random() * 30)
        };
        const performanceRate = (mockPopulation.numerator / mockPopulation.denominator) * 100;
        return {
            ...measure,
            measurementPeriod: period,
            population: mockPopulation,
            performanceRate,
            trend: this.calculateTrend(measure.id, performanceRate)
        };
    }
    calculateTrend(measureId, currentRate) {
        const random = Math.random();
        if (random < 0.4)
            return 'Improving';
        if (random < 0.8)
            return 'Stable';
        return 'Declining';
    }
    async generateRecommendations(measures) {
        const recommendations = [];
        for (const measure of measures) {
            if (measure.benchmark && measure.performanceRate < measure.benchmark) {
                const gap = measure.benchmark - measure.performanceRate;
                recommendations.push({
                    measureId: measure.id,
                    priority: gap > 20 ? 'High' : gap > 10 ? 'Medium' : 'Low',
                    recommendation: this.getRecommendationText(measure),
                    expectedImpact: `Improve performance by ${Math.min(gap * 0.7, 15).toFixed(1)} percentage points`,
                    implementationTimeline: gap > 20 ? '3-6 months' : '1-3 months',
                    resources: this.getRequiredResources(measure)
                });
            }
        }
        return recommendations.sort((a, b) => {
            const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }
    calculateRevenueImpact(measure, gap) {
        const baseRevenuePerPatient = 150;
        const impactedPatients = Math.floor(measure.population.denominator * (gap / 100));
        return impactedPatients * baseRevenuePerPatient * 0.1;
    }
    async suggestInterventions(measure, gap) {
        const interventions = [];
        if (measure.category === 'Process') {
            interventions.push({
                intervention: 'Implement clinical decision support alerts',
                estimatedCost: 5000,
                expectedROI: 3.5
            });
            interventions.push({
                intervention: 'Staff training and education program',
                estimatedCost: 2500,
                expectedROI: 2.8
            });
        }
        if (measure.category === 'Outcome') {
            interventions.push({
                intervention: 'Patient engagement and education initiative',
                estimatedCost: 7500,
                expectedROI: 4.2
            });
            interventions.push({
                intervention: 'Care coordination improvement',
                estimatedCost: 4000,
                expectedROI: 3.1
            });
        }
        return interventions;
    }
    getRecommendationText(measure) {
        const recommendations = {
            'Process': 'Implement workflow improvements and clinical decision support',
            'Outcome': 'Focus on patient engagement and care coordination',
            'Structure': 'Evaluate and upgrade infrastructure and resources',
            'Balancing': 'Monitor for unintended consequences while improving primary measure'
        };
        return recommendations[measure.category] || 'Review current processes and implement best practices';
    }
    getRequiredResources(measure) {
        const resources = {
            'Process': ['Clinical staff training', 'EHR configuration', 'Workflow documentation'],
            'Outcome': ['Patient education materials', 'Care coordination tools', 'Follow-up protocols'],
            'Structure': ['Technology upgrades', 'Staff recruitment', 'Equipment procurement'],
            'Balancing': ['Monitoring tools', 'Data analysis capabilities', 'Quality assurance protocols']
        };
        return resources[measure.category] || ['General quality improvement resources'];
    }
    storeHistoricalData(facilityId, measures) {
        for (const measure of measures) {
            const key = `${facilityId}-${measure.id}`;
            const historical = this.historicalData.get(key) || [];
            historical.push(measure);
            if (historical.length > 24) {
                historical.shift();
            }
            this.historicalData.set(key, historical);
        }
    }
    initializeCoreMeasures() {
        this.measures.set('HEDIS-CDC-HbA1c', {
            id: 'HEDIS-CDC-HbA1c',
            name: 'Comprehensive Diabetes Care: HbA1c Control (<8.0%)',
            description: 'Percentage of members 18-75 years of age with diabetes whose HbA1c is <8.0%',
            category: 'Outcome',
            measureType: 'Proportion',
            steward: 'NCQA',
            nqfNumber: '0575',
            version: '2023',
            measurementPeriod: { start: new Date(), end: new Date() },
            population: { initialPopulation: 0, denominator: 0, numerator: 0, exclusions: 0, exceptions: 0 },
            performanceRate: 0,
            benchmark: 75,
            target: 80,
            trend: 'Stable',
            riskAdjusted: false
        });
        this.measures.set('HEDIS-BCS', {
            id: 'HEDIS-BCS',
            name: 'Breast Cancer Screening',
            description: 'Percentage of women 50-74 years who had mammography to screen for breast cancer',
            category: 'Process',
            measureType: 'Proportion',
            steward: 'NCQA',
            nqfNumber: '2372',
            version: '2023',
            measurementPeriod: { start: new Date(), end: new Date() },
            population: { initialPopulation: 0, denominator: 0, numerator: 0, exclusions: 0, exceptions: 0 },
            performanceRate: 0,
            benchmark: 80,
            target: 85,
            trend: 'Stable',
            riskAdjusted: false
        });
        this.measures.set('CMS165', {
            id: 'CMS165',
            name: 'Controlling High Blood Pressure',
            description: 'Percentage of patients 18-85 years with hypertension whose blood pressure was adequately controlled',
            category: 'Outcome',
            measureType: 'Proportion',
            steward: 'CMS',
            cmsNumber: 'CMS165v10',
            version: '10.0.0',
            measurementPeriod: { start: new Date(), end: new Date() },
            population: { initialPopulation: 0, denominator: 0, numerator: 0, exclusions: 0, exceptions: 0 },
            performanceRate: 0,
            benchmark: 70,
            target: 75,
            trend: 'Stable',
            riskAdjusted: false
        });
        this.measures.set('CMS122', {
            id: 'CMS122',
            name: 'Diabetes: Hemoglobin A1c (HbA1c) Poor Control (>9%)',
            description: 'Percentage of patients 18-75 years with diabetes who had HbA1c > 9.0% during the measurement period',
            category: 'Outcome',
            measureType: 'Proportion',
            steward: 'CMS',
            cmsNumber: 'CMS122v10',
            version: '10.0.0',
            measurementPeriod: { start: new Date(), end: new Date() },
            population: { initialPopulation: 0, denominator: 0, numerator: 0, exclusions: 0, exceptions: 0 },
            performanceRate: 0,
            benchmark: 15,
            target: 10,
            trend: 'Stable',
            riskAdjusted: false
        });
    }
};
exports.ClinicalQualityMeasuresService = ClinicalQualityMeasuresService;
exports.ClinicalQualityMeasuresService = ClinicalQualityMeasuresService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ClinicalQualityMeasuresService);
//# sourceMappingURL=clinical-quality-measures.service.js.map