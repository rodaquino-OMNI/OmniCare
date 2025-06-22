/**
 * Analytics Controller
 * 
 * Express-based controller for analytics and reporting endpoints
 */

import { Request, Response, NextFunction } from 'express';

import logger from '../utils/logger';
import { ClinicalQualityMeasuresService } from '../services/analytics/clinical-quality-measures.service';
import { FinancialAnalyticsService } from '../services/analytics/financial-analytics.service';
import { OperationalMetricsService } from '../services/analytics/operational-metrics.service';
import { PopulationHealthService } from '../services/analytics/population-health.service';
import { ReportingEngineService } from '../services/analytics/reporting-engine.service';

/**
 * Analytics Controller
 * Handles analytics and reporting endpoints for OmniCare EMR
 */
export class AnalyticsController {
  constructor() {
    // Services are created lazily to allow for proper mocking
  }

  private getClinicalQualityService(): ClinicalQualityMeasuresService {
    return new ClinicalQualityMeasuresService();
  }

  private getFinancialService(): FinancialAnalyticsService {
    return new FinancialAnalyticsService();
  }

  private getOperationalService(): OperationalMetricsService {
    return new OperationalMetricsService();
  }

  private getPopulationService(): PopulationHealthService {
    return new PopulationHealthService();
  }

  private getReportingService(): ReportingEngineService {
    return new ReportingEngineService();
  }

  private checkAuthentication(req: Request, res: Response): boolean {
    if (!(req as any).user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return false;
    }
    return true;
  }

  private checkPermissions(req: Request, res: Response, permission: string): boolean {
    const user = (req as any).user;
    if (!user.permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Insufficient permissions for analytics data'
      });
      return false;
    }
    return true;
  }

  private parseDate(dateString: string): Date | null {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }

  private validateDateRange(startDate: string, endDate: string, res: Response): boolean {
    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);
    
    if (!start || !end) {
      res.status(400).json({
        success: false,
        error: 'Invalid date parameters',
        message: 'startDate and endDate must be valid ISO dates'
      });
      return false;
    }
    
    if (end <= start) {
      res.status(400).json({
        success: false,
        error: 'Invalid date range',
        message: 'End date must be after start date'
      });
      return false;
    }
    
    return true;
  }

  private validatePagination(page: string, limit: string, res: Response): boolean {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (pageNum < 1 || limitNum < 1) {
      res.status(400).json({
        success: false,
        error: 'Invalid pagination parameters',
        message: 'Page must be >= 1 and limit must be > 0'
      });
      return false;
    }
    
    return true;
  }

  // Clinical Quality Measures Endpoint
  async getClinicalQualityMeasures(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;

      const { startDate, endDate, measureSet } = req.query;

      if (startDate && endDate) {
        if (!this.validateDateRange(startDate as string, endDate as string, res)) return;
      }

      const start = this.parseDate(startDate as string);
      const end = this.parseDate(endDate as string);
      
      const measures = await this.getClinicalQualityService().calculateQualityMeasures({
        startDate: start,
        endDate: end,
        measureSet: measureSet as string
      });

      res.status(200).json({
        success: true,
        data: measures
      });
    } catch (error: unknown) {
      logger.error('Error fetching clinical quality measures:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch clinical quality measures'
        });
      }
    }
  }

  // Quality Measure Details Endpoint
  async getQualityMeasureDetails(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;

      const { measureId } = req.params;
      
      const details = await this.getClinicalQualityService().getQualityMeasureDetails(measureId);

      res.status(200).json({
        success: true,
        data: details
      });
    } catch (error: unknown) {
      logger.error('Error fetching quality measure details:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch quality measure details'
        });
      }
    }
  }

  // Financial Analytics Endpoint
  async getFinancialAnalytics(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;

      const { facilityId } = req.params;
      const { startDate, endDate } = req.query;

      if (startDate && endDate) {
        if (!this.validateDateRange(startDate as string, endDate as string, res)) return;
      }

      const start = this.parseDate(startDate as string);
      const end = this.parseDate(endDate as string);
      
      const financialData = await this.getFinancialService().getFinancialAnalytics({
        facilityId,
        startDate: start,
        endDate: end
      });

      res.status(200).json({
        success: true,
        data: financialData
      });
    } catch (error: unknown) {
      logger.error('Error fetching financial analytics:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch financial analytics'
        });
      }
    }
  }

  // Revenue Analytics Endpoint
  async getRevenueAnalytics(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;

      const { startDate, endDate, groupBy } = req.query;

      if (startDate && endDate) {
        if (!this.validateDateRange(startDate as string, endDate as string, res)) return;
      }

      const start = this.parseDate(startDate as string);
      const end = this.parseDate(endDate as string);
      
      const revenueData = await this.getFinancialService().getRevenueAnalytics({
        startDate: start,
        endDate: end,
        groupBy: groupBy as string
      });

      res.status(200).json({
        success: true,
        data: revenueData
      });
    } catch (error: unknown) {
      logger.error('Error fetching revenue analytics:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch revenue analytics'
        });
      }
    }
  }

  // Cost Analytics Endpoint
  async getCostAnalytics(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;
      
      const costData = await this.getFinancialService().getCostAnalytics();

      res.status(200).json({
        success: true,
        data: costData
      });
    } catch (error: unknown) {
      logger.error('Error fetching cost analytics:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch cost analytics'
        });
      }
    }
  }

  // Operational Metrics Endpoint
  async getOperationalMetrics(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;

      const { period, department } = req.query;
      
      const metrics = await this.getOperationalService().getOperationalMetrics({
        period: period as string,
        department: department as string
      });

      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error: unknown) {
      logger.error('Error fetching operational metrics:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch operational metrics'
        });
      }
    }
  }

  // Performance Indicators Endpoint
  async getPerformanceIndicators(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;
      
      const kpis = await this.getOperationalService().getKeyPerformanceIndicators();

      res.status(200).json({
        success: true,
        data: kpis
      });
    } catch (error: unknown) {
      logger.error('Error fetching performance indicators:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch performance indicators'
        });
      }
    }
  }

  // Population Health Analytics Endpoint
  async getPopulationHealthAnalytics(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;

      const { facilityId } = req.params;
      const { startDate, endDate } = req.query;

      if (startDate && endDate) {
        if (!this.validateDateRange(startDate as string, endDate as string, res)) return;
      }

      const start = this.parseDate(startDate as string);
      const end = this.parseDate(endDate as string);
      
      const populationData = await this.getPopulationService().getPopulationHealthAnalytics({
        facilityId,
        startDate: start,
        endDate: end
      });

      res.status(200).json({
        success: true,
        data: populationData
      });
    } catch (error: unknown) {
      logger.error('Error fetching population health analytics:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch population health analytics'
        });
      }
    }
  }

  // Population Health Metrics Endpoint (alias for test compatibility)
  async getPopulationHealthMetrics(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;

      const { population, riskLevel } = req.query;
      
      const populationData = await this.getPopulationService().getPopulationHealthMetrics({
        population: population as string,
        riskLevel: riskLevel as string
      });

      res.status(200).json({
        success: true,
        data: populationData
      });
    } catch (error: unknown) {
      logger.error('Error fetching population health metrics:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch population health metrics'
        });
      }
    }
  }

  // Reports Endpoint
  async getReports(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;

      const { facilityId, type, status } = req.query;
      
      const reports = await this.getReportingService().getReports({
        facilityId: facilityId as string,
        type: type as string,
        status: status as string
      });

      res.status(200).json({
        success: true,
        data: reports
      });
    } catch (error: unknown) {
      logger.error('Error fetching reports:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch reports'
        });
      }
    }
  }

  // Generate Report Endpoint
  async generateReport(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;

      const { reportType, parameters, format } = req.body;
      const userId = (req as any).user?.id;

      const supportedTypes = ['quality-measures', 'financial', 'operational', 'population-health'];
      if (!supportedTypes.includes(reportType)) {
        res.status(400).json({
          success: false,
          error: 'Invalid report type',
          message: 'Supported report types: quality-measures, financial, operational, population-health'
        });
        return;
      }
      
      const report = await this.getReportingService().generateCustomReport({
        reportType,
        parameters,
        format,
        userId
      });

      res.status(200).json({
        success: true,
        data: report
      });
    } catch (error: unknown) {
      logger.error('Error generating report:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to generate report'
        });
      }
    }
  }

  // Report History Endpoint
  async getReportHistory(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;

      const { page = '1', limit = '10' } = req.query;
      const userId = (req as any).user?.id;

      if (!this.validatePagination(page as string, limit as string, res)) return;
      
      const history = await this.getReportingService().getReportHistory({
        userId,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      });

      res.status(200).json({
        success: true,
        data: history
      });
    } catch (error: unknown) {
      logger.error('Error fetching report history:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch report history'
        });
      }
    }
  }

  // Create Custom Report Endpoint
  async createCustomReport(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:write')) return;

      const reportConfig = req.body;
      const userId = (req as any).user?.id;
      
      const report = await this.getReportingService().createCustomReport({
        ...reportConfig,
        userId
      });

      res.status(200).json({
        success: true,
        data: report
      });
    } catch (error: unknown) {
      logger.error('Error creating custom report:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create custom report'
        });
      }
    }
  }

  // Real-time Metrics Endpoint
  async getRealTimeMetrics(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;

      const { facilityId } = req.params;
      
      const realTimeData = await this.getOperationalService().getRealTimeMetrics({
        facilityId
      });

      res.status(200).json({
        success: true,
        data: realTimeData
      });
    } catch (error: unknown) {
      logger.error('Error fetching real-time metrics:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch real-time metrics'
        });
      }
    }
  }

  // Analytics Alerts Endpoint
  async getAnalyticsAlerts(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;

      const { facilityId } = req.params;
      
      const alerts = await this.getOperationalService().getAnalyticsAlerts({
        facilityId
      });

      res.status(200).json({
        success: true,
        data: alerts
      });
    } catch (error: unknown) {
      logger.error('Error fetching analytics alerts:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch analytics alerts'
        });
      }
    }
  }

  // Benchmark Comparisons Endpoint
  async getBenchmarkComparisons(req: Request, res: Response, next?: NextFunction) {
    try {
      if (!this.checkAuthentication(req, res)) return;
      if (!this.checkPermissions(req, res, 'analytics:read')) return;

      const { facilityId } = req.params;
      const { category } = req.query;
      
      const benchmarks = await this.getOperationalService().getBenchmarkComparisons({
        facilityId,
        category: category as string
      });

      res.status(200).json({
        success: true,
        data: benchmarks
      });
    } catch (error: unknown) {
      logger.error('Error fetching benchmark comparisons:', error);
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch benchmark comparisons'
        });
      }
    }
  }
}

const analyticsControllerInstance = new AnalyticsController();

export default analyticsControllerInstance;
export const analyticsController = analyticsControllerInstance;