/**
 * Analytics Controller
 * 
 * Express-based controller for analytics and reporting endpoints
 */

import { Request, Response } from 'express';
import logger from '@/utils/logger';

/**
 * Analytics Controller
 * Handles analytics and reporting endpoints for OmniCare EMR
 */
export class AnalyticsController {
  constructor() {
    private readonly clinicalQualityService: ClinicalQualityMeasuresService,
    private readonly financialAnalyticsService: FinancialAnalyticsService,
    private readonly operationalMetricsService: OperationalMetricsService,
    private readonly populationHealthService: PopulationHealthService,
    private readonly reportingEngineService: ReportingEngineService
  ) {}

  // Clinical Quality Measures Endpoints
  @Get('clinical-quality/:facilityId')
  @Roles('Provider', 'Quality Manager', 'System Administrator')
  async getClinicalQualityMeasures(
    @Param('facilityId') facilityId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('measureIds') measureIds?: string
  ) {
    try {
      const period = startDate && endDate ? {
        start: new Date(startDate),
        end: new Date(endDate)
      } : undefined;

      const measureIdList = measureIds ? measureIds.split(',') : undefined;

      const measures = await this.clinicalQualityService.calculateQualityMeasures(
        facilityId,
        period || {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date()
        },
        measureIdList
      );

      return {
        success: true,
        data: measures,
        meta: {
          facilityId,
          period,
          measureCount: measures.length
        }
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch clinical quality measures: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('clinical-quality/:facilityId/report')
  @Roles('Provider', 'Quality Manager', 'System Administrator')
  async generateQualityReport(
    @Param('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
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
    } catch (error) {
      throw new HttpException(
        `Failed to generate quality report: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('clinical-quality/:facilityId/gap-analysis')
  @Roles('Provider', 'Quality Manager', 'System Administrator')
  async performQualityGapAnalysis(
    @Param('facilityId') facilityId: string,
    @Query('measureIds') measureIds: string
  ) {
    try {
      const measureIdList = measureIds.split(',');
      const gapAnalysis = await this.clinicalQualityService.performGapAnalysis(facilityId, measureIdList);

      return {
        success: true,
        data: gapAnalysis
      };
    } catch (error) {
      throw new HttpException(
        `Failed to perform gap analysis: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('clinical-quality/:facilityId/dashboard')
  @Roles('Provider', 'Quality Manager', 'System Administrator')
  async getQualityDashboard(@Param('facilityId') facilityId: string) {
    try {
      const dashboard = await this.clinicalQualityService.getQualityDashboard(facilityId);

      return {
        success: true,
        data: dashboard
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch quality dashboard: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Financial Analytics Endpoints
  @Get('financial/:facilityId/revenue-cycle')
  @Roles('Billing Staff', 'Financial Counselor', 'System Administrator', 'Department Manager')
  async getRevenueCycleAnalytics(
    @Param('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
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
    } catch (error) {
      throw new HttpException(
        `Failed to fetch revenue cycle analytics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('financial/:facilityId/provider-productivity')
  @Roles('Provider', 'Department Manager', 'System Administrator')
  async getProviderProductivityAnalysis(
    @Param('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('providerId') providerId?: string
  ) {
    try {
      const period = {
        start: new Date(startDate),
        end: new Date(endDate)
      };

      const analysis = await this.financialAnalyticsService.getProviderProductivityAnalysis(
        facilityId,
        period,
        providerId
      );

      return {
        success: true,
        data: analysis
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch provider productivity analysis: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('financial/:facilityId/forecast')
  @Roles('Department Manager', 'System Administrator', 'Financial Counselor')
  async generateFinancialForecast(
    @Param('facilityId') facilityId: string,
    @Query('months') months?: string
  ) {
    try {
      const forecastMonths = months ? parseInt(months) : 12;
      const forecast = await this.financialAnalyticsService.generateFinancialForecast(
        facilityId,
        forecastMonths
      );

      return {
        success: true,
        data: forecast
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate financial forecast: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('financial/:facilityId/service-line-profitability')
  @Roles('Department Manager', 'System Administrator', 'Financial Counselor')
  async getServiceLineProfitability(
    @Param('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    try {
      const period = {
        start: new Date(startDate),
        end: new Date(endDate)
      };

      const profitability = await this.financialAnalyticsService.getServiceLineProfitability(
        facilityId,
        period
      );

      return {
        success: true,
        data: profitability
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch service line profitability: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Operational Metrics Endpoints
  @Get('operational/:facilityId/patient-flow')
  @Roles('Department Manager', 'System Administrator', 'Front Desk Staff')
  async getPatientFlowAnalytics(
    @Param('facilityId') facilityId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
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
    } catch (error) {
      throw new HttpException(
        `Failed to fetch patient flow analytics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('operational/:facilityId/staff-utilization')
  @Roles('Department Manager', 'System Administrator')
  async getStaffUtilizationAnalytics(
    @Param('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('departmentId') departmentId?: string
  ) {
    try {
      const period = {
        start: new Date(startDate),
        end: new Date(endDate)
      };

      const analytics = await this.operationalMetricsService.getStaffUtilizationAnalytics(
        facilityId,
        period,
        departmentId
      );

      return {
        success: true,
        data: analytics
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch staff utilization analytics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('operational/:facilityId/appointments')
  @Roles('Department Manager', 'System Administrator', 'Front Desk Staff')
  async getAppointmentAnalytics(
    @Param('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
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
    } catch (error) {
      throw new HttpException(
        `Failed to fetch appointment analytics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('operational/:facilityId/quality-metrics')
  @Roles('Provider', 'Quality Manager', 'System Administrator')
  async getQualityMetrics(
    @Param('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
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
    } catch (error) {
      throw new HttpException(
        `Failed to fetch quality metrics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('operational/:facilityId/dashboard')
  @Roles('Department Manager', 'System Administrator', 'Front Desk Staff', 'Provider')
  async getOperationalDashboard(@Param('facilityId') facilityId: string) {
    try {
      const dashboard = await this.operationalMetricsService.getOperationalDashboard(facilityId);

      return {
        success: true,
        data: dashboard
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch operational dashboard: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('operational/:facilityId/insights')
  @Roles('Department Manager', 'System Administrator')
  async generateOperationalInsights(@Param('facilityId') facilityId: string) {
    try {
      const insights = await this.operationalMetricsService.generateOperationalInsights(facilityId);

      return {
        success: true,
        data: insights
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate operational insights: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Population Health Endpoints
  @Get('population-health/:facilityId')
  @Roles('Provider', 'Quality Manager', 'System Administrator')
  async getPopulationHealthAnalytics(
    @Param('facilityId') facilityId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
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
    } catch (error) {
      throw new HttpException(
        `Failed to fetch population health analytics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('population-health/:facilityId/risk-stratification')
  @Roles('Provider', 'Quality Manager', 'System Administrator')
  async performRiskStratification(
    @Param('facilityId') facilityId: string,
    @Query('patientIds') patientIds?: string
  ) {
    try {
      const patientIdList = patientIds ? patientIds.split(',') : undefined;
      const stratification = await this.populationHealthService.performRiskStratification(
        facilityId,
        patientIdList
      );

      return {
        success: true,
        data: stratification
      };
    } catch (error) {
      throw new HttpException(
        `Failed to perform risk stratification: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('population-health/:facilityId/health-outcomes')
  @Roles('Provider', 'Quality Manager', 'System Administrator')
  async analyzeHealthOutcomes(
    @Param('facilityId') facilityId: string,
    @Query('outcomeIds') outcomeIds?: string
  ) {
    try {
      const outcomeIdList = outcomeIds ? outcomeIds.split(',') : undefined;
      const outcomes = await this.populationHealthService.analyzeHealthOutcomes(
        facilityId,
        outcomeIdList
      );

      return {
        success: true,
        data: outcomes
      };
    } catch (error) {
      throw new HttpException(
        `Failed to analyze health outcomes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('population-health/:facilityId/care-gaps')
  @Roles('Provider', 'Quality Manager', 'System Administrator')
  async analyzeCareGaps(
    @Param('facilityId') facilityId: string,
    @Query('patientIds') patientIds?: string
  ) {
    try {
      const patientIdList = patientIds ? patientIds.split(',') : undefined;
      const careGaps = await this.populationHealthService.analyzeCareGaps(
        facilityId,
        patientIdList
      );

      return {
        success: true,
        data: careGaps
      };
    } catch (error) {
      throw new HttpException(
        `Failed to analyze care gaps: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('population-health/:facilityId/insights')
  @Roles('Provider', 'Quality Manager', 'System Administrator')
  async generatePopulationInsights(@Param('facilityId') facilityId: string) {
    try {
      const insights = await this.populationHealthService.generatePopulationInsights(facilityId);

      return {
        success: true,
        data: insights
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate population insights: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Reporting Engine Endpoints
  @Post('reports')
  @Roles('Department Manager', 'System Administrator', 'Quality Manager')
  async createCustomReport(@Body() reportConfig: any) {
    try {
      const report = await this.reportingEngineService.createCustomReport(reportConfig);

      return {
        success: true,
        data: report
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create custom report: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('reports/:reportId')
  @Roles('Department Manager', 'System Administrator', 'Quality Manager', 'Provider')
  async getReport(@Param('reportId') reportId: string) {
    try {
      const report = await this.reportingEngineService.getReport(reportId);

      return {
        success: true,
        data: report
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch report: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('reports')
  @Roles('Department Manager', 'System Administrator', 'Quality Manager', 'Provider')
  async getReports(
    @Query('facilityId') facilityId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string
  ) {
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
    } catch (error) {
      throw new HttpException(
        `Failed to fetch reports: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('reports/:reportId/schedule')
  @Roles('Department Manager', 'System Administrator', 'Quality Manager')
  async scheduleReport(
    @Param('reportId') reportId: string,
    @Body() scheduleConfig: any
  ) {
    try {
      const scheduledReport = await this.reportingEngineService.scheduleReport(reportId, scheduleConfig);

      return {
        success: true,
        data: scheduledReport
      };
    } catch (error) {
      throw new HttpException(
        `Failed to schedule report: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('reports/:reportId/export')
  @Roles('Department Manager', 'System Administrator', 'Quality Manager', 'Provider')
  async exportReport(
    @Param('reportId') reportId: string,
    @Query('format') format: 'pdf' | 'excel' | 'csv' = 'pdf'
  ) {
    try {
      const exportedReport = await this.reportingEngineService.exportReport(reportId, format);

      return {
        success: true,
        data: exportedReport
      };
    } catch (error) {
      throw new HttpException(
        `Failed to export report: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Real-time Analytics Endpoints
  @Get('real-time/:facilityId/metrics')
  @Roles('Department Manager', 'System Administrator', 'Front Desk Staff', 'Provider')
  async getRealTimeMetrics(@Param('facilityId') facilityId: string) {
    try {
      const metrics = await this.operationalMetricsService.getOperationalDashboard(facilityId);

      return {
        success: true,
        data: metrics.realTimeMetrics,
        timestamp: new Date()
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch real-time metrics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('alerts/:facilityId')
  @Roles('Department Manager', 'System Administrator', 'Provider', 'Quality Manager')
  async getAnalyticsAlerts(@Param('facilityId') facilityId: string) {
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
    } catch (error) {
      throw new HttpException(
        `Failed to fetch analytics alerts: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Benchmark Comparison Endpoints
  @Get('benchmarks/:facilityId')
  @Roles('Department Manager', 'System Administrator', 'Quality Manager')
  async getBenchmarkComparisons(
    @Param('facilityId') facilityId: string,
    @Query('category') category?: string
  ) {
    try {
      // Mock benchmark data - would integrate with external benchmark services
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
    } catch (error) {
      throw new HttpException(
        `Failed to fetch benchmark comparisons: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}