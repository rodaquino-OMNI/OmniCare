import { Request, Response } from 'express';

import { analyticsController } from '../../../src/controllers/analytics.controller';
import { ClinicalQualityMeasuresService } from '../../../src/services/analytics/clinical-quality-measures.service';
import { FinancialAnalyticsService } from '../../../src/services/analytics/financial-analytics.service';
import { OperationalMetricsService } from '../../../src/services/analytics/operational-metrics.service';
import { PopulationHealthService } from '../../../src/services/analytics/population-health.service';
import { ReportingEngineService } from '../../../src/services/analytics/reporting-engine.service';
import logger from '../../../src/utils/logger';
import { createMockUser } from '../../test-helpers';

// Mock all analytics services
jest.mock('../../../src/services/analytics/clinical-quality-measures.service');
jest.mock('../../../src/services/analytics/financial-analytics.service');
jest.mock('../../../src/services/analytics/operational-metrics.service');
jest.mock('../../../src/services/analytics/population-health.service');
jest.mock('../../../src/services/analytics/reporting-engine.service');
jest.mock('../../../src/utils/logger');

describe('Analytics Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  const mockClinicalQualityService = ClinicalQualityMeasuresService as jest.MockedClass<typeof ClinicalQualityMeasuresService>;
  const mockFinancialService = FinancialAnalyticsService as jest.MockedClass<typeof FinancialAnalyticsService>;
  const mockOperationalService = OperationalMetricsService as jest.MockedClass<typeof OperationalMetricsService>;
  const mockPopulationService = PopulationHealthService as jest.MockedClass<typeof PopulationHealthService>;
  const mockReportingService = ReportingEngineService as jest.MockedClass<typeof ReportingEngineService>;

  beforeEach(() => {
    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: createMockUser({
        id: 'test-user-1',
        role: 'administrative_staff',
        permissions: ['analytics:read', 'analytics:write']
      })
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('Clinical Quality Measures', () => {
    describe('getClinicalQualityMeasures', () => {
      it('should return clinical quality measures successfully', async () => {
        const mockMeasures = {
          measures: [
            {
              id: 'CQM001',
              title: 'Diabetes Control',
              numerator: 85,
              denominator: 100,
              percentage: 85.0,
              status: 'passing'
            }
          ],
          summary: {
            totalMeasures: 10,
            passingMeasures: 8,
            overallScore: 80.0
          }
        };

        mockRequest.query = {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          measureSet: 'CMS'
        };

        const mockServiceInstance = {
          calculateQualityMeasures: jest.fn().mockResolvedValue(mockMeasures)
        };
        mockClinicalQualityService.mockImplementation(() => mockServiceInstance as any);

        await analyticsController.getClinicalQualityMeasures(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockServiceInstance.calculateQualityMeasures).toHaveBeenCalledWith({
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          measureSet: 'CMS'
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockMeasures
        });
      });

      it('should handle invalid date parameters', async () => {
        mockRequest.query = {
          startDate: 'invalid-date',
          endDate: '2024-12-31'
        };

        await analyticsController.getClinicalQualityMeasures(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid date parameters',
          message: 'startDate and endDate must be valid ISO dates'
        });
      });

      it('should handle service errors gracefully', async () => {
        const serviceError = new Error('Database connection failed');
        
        const mockServiceInstance = {
          calculateQualityMeasures: jest.fn().mockRejectedValue(serviceError)
        };
        mockClinicalQualityService.mockImplementation(() => mockServiceInstance as any);

        await analyticsController.getClinicalQualityMeasures(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(serviceError);
      });
    });

    describe('getQualityMeasureDetails', () => {
      it('should return detailed quality measure data', async () => {
        const mockDetails = {
          measure: {
            id: 'CQM001',
            title: 'Diabetes Control',
            description: 'Percentage of patients with diabetes with HbA1c < 7%'
          },
          performance: {
            numerator: 85,
            denominator: 100,
            percentage: 85.0,
            benchmark: 80.0,
            trend: 'improving'
          },
          breakdown: {
            byProvider: [],
            byDemographic: [],
            byTimeFrame: []
          }
        };

        mockRequest.params = { measureId: 'CQM001' };

        const mockServiceInstance = {
          getQualityMeasureDetails: jest.fn().mockResolvedValue(mockDetails)
        };
        mockClinicalQualityService.mockImplementation(() => mockServiceInstance as any);

        await analyticsController.getQualityMeasureDetails(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockServiceInstance.getQualityMeasureDetails).toHaveBeenCalledWith('CQM001');
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockDetails
        });
      });
    });
  });

  describe('Financial Analytics', () => {
    describe('getRevenueAnalytics', () => {
      it('should return revenue analytics data', async () => {
        const mockRevenueData = {
          totalRevenue: 1250000.00,
          revenueByMonth: [
            { month: '2024-01', revenue: 100000.00, growth: 5.2 },
            { month: '2024-02', revenue: 105000.00, growth: 5.0 }
          ],
          revenueByService: [
            { service: 'Primary Care', revenue: 500000.00, percentage: 40.0 },
            { service: 'Specialty Care', revenue: 450000.00, percentage: 36.0 }
          ],
          payerMix: {
            medicare: 35.0,
            medicaid: 25.0,
            commercial: 35.0,
            selfPay: 5.0
          }
        };

        mockRequest.query = {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          groupBy: 'month'
        };

        const mockServiceInstance = {
          getRevenueAnalytics: jest.fn().mockResolvedValue(mockRevenueData)
        };
        mockFinancialService.mockImplementation(() => mockServiceInstance as any);

        await analyticsController.getRevenueAnalytics(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockServiceInstance.getRevenueAnalytics).toHaveBeenCalledWith({
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          groupBy: 'month'
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockRevenueData
        });
      });
    });

    describe('getCostAnalytics', () => {
      it('should return cost analytics data', async () => {
        const mockCostData = {
          totalCosts: 950000.00,
          costsByCategory: [
            { category: 'Personnel', amount: 600000.00, percentage: 63.2 },
            { category: 'Equipment', amount: 200000.00, percentage: 21.1 },
            { category: 'Supplies', amount: 150000.00, percentage: 15.8 }
          ],
          costPerPatient: 125.50,
          costTrends: {
            currentPeriod: 950000.00,
            previousPeriod: 920000.00,
            change: 3.3
          }
        };

        const mockServiceInstance = {
          getCostAnalytics: jest.fn().mockResolvedValue(mockCostData)
        };
        mockFinancialService.mockImplementation(() => mockServiceInstance as any);

        await analyticsController.getCostAnalytics(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockCostData
        });
      });
    });
  });

  describe('Operational Metrics', () => {
    describe('getOperationalMetrics', () => {
      it('should return operational metrics data', async () => {
        const mockMetrics = {
          patientFlow: {
            dailyVisits: 150,
            averageWaitTime: 15.5,
            patientSatisfaction: 4.2,
            noShowRate: 8.5
          },
          staffUtilization: {
            physiciansUtilization: 85.0,
            nursesUtilization: 78.0,
            supportStaffUtilization: 65.0
          },
          resourceUtilization: {
            roomUtilization: 72.0,
            equipmentUtilization: 68.0,
            bedOccupancy: 82.0
          },
          efficiency: {
            appointmentsPerDay: 120,
            averageAppointmentDuration: 22.5,
            documentationTime: 8.2
          }
        };

        mockRequest.query = {
          period: 'week',
          department: 'primary-care'
        };

        const mockServiceInstance = {
          getOperationalMetrics: jest.fn().mockResolvedValue(mockMetrics)
        };
        mockOperationalService.mockImplementation(() => mockServiceInstance as any);

        await analyticsController.getOperationalMetrics(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockServiceInstance.getOperationalMetrics).toHaveBeenCalledWith({
          period: 'week',
          department: 'primary-care'
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockMetrics
        });
      });
    });

    describe('getPerformanceIndicators', () => {
      it('should return key performance indicators', async () => {
        const mockKPIs = {
          clinical: {
            readmissionRate: 5.2,
            infectionRate: 1.8,
            mortalityRate: 0.8,
            patientSafetyScore: 95.5
          },
          operational: {
            bedTurnoverTime: 2.5,
            surgeryOnTimeRate: 92.0,
            emergencyResponseTime: 4.2,
            dischargeEfficiency: 88.0
          },
          financial: {
            revenuePerPatient: 1250.00,
            costPerPatient: 980.00,
            profitMargin: 21.6,
            collectionRate: 94.5
          }
        };

        const mockServiceInstance = {
          getKeyPerformanceIndicators: jest.fn().mockResolvedValue(mockKPIs)
        };
        mockOperationalService.mockImplementation(() => mockServiceInstance as any);

        await analyticsController.getPerformanceIndicators(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockKPIs
        });
      });
    });
  });

  describe('Population Health', () => {
    describe('getPopulationHealthMetrics', () => {
      it('should return population health data', async () => {
        const mockPopulationData = {
          demographics: {
            totalPatients: 10000,
            ageDistribution: {
              '0-17': 1500,
              '18-64': 6000,
              '65+': 2500
            },
            genderDistribution: {
              male: 4800,
              female: 5200
            }
          },
          chronicConditions: [
            { condition: 'Diabetes', prevalence: 12.5, patients: 1250 },
            { condition: 'Hypertension', prevalence: 25.8, patients: 2580 },
            { condition: 'Heart Disease', prevalence: 8.3, patients: 830 }
          ],
          riskStratification: {
            low: 6500,
            medium: 2800,
            high: 700
          },
          preventiveCare: {
            mammographyScreening: 78.5,
            colonoscopyScreening: 65.2,
            influenzaVaccination: 82.1
          }
        };

        mockRequest.query = {
          population: 'all',
          riskLevel: 'all'
        };

        const mockServiceInstance = {
          getPopulationHealthMetrics: jest.fn().mockResolvedValue(mockPopulationData)
        };
        mockPopulationService.mockImplementation(() => mockServiceInstance as any);

        await analyticsController.getPopulationHealthMetrics(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockServiceInstance.getPopulationHealthMetrics).toHaveBeenCalledWith({
          population: 'all',
          riskLevel: 'all'
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockPopulationData
        });
      });
    });
  });

  describe('Reporting Engine', () => {
    describe('generateReport', () => {
      it('should generate and return a custom report', async () => {
        const mockReport = {
          reportId: 'report-123',
          title: 'Monthly Quality Report',
          generatedAt: new Date('2024-01-15T10:00:00Z'),
          data: {
            sections: [
              {
                title: 'Quality Measures',
                content: { measures: [] }
              },
              {
                title: 'Financial Performance',
                content: { revenue: 100000 }
              }
            ]
          },
          metadata: {
            format: 'json',
            parameters: {},
            generatedBy: 'test-user-1'
          }
        };

        mockRequest.body = {
          reportType: 'quality-measures',
          parameters: {
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          },
          format: 'json'
        };

        const mockServiceInstance = {
          generateCustomReport: jest.fn().mockResolvedValue(mockReport)
        };
        mockReportingService.mockImplementation(() => mockServiceInstance as any);

        await analyticsController.generateReport(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockServiceInstance.generateCustomReport).toHaveBeenCalledWith({
          reportType: 'quality-measures',
          parameters: {
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          },
          format: 'json',
          userId: 'test-user-1'
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockReport
        });
      });

      it('should handle invalid report type', async () => {
        mockRequest.body = {
          reportType: 'invalid-type'
        };

        await analyticsController.generateReport(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid report type',
          message: 'Supported report types: quality-measures, financial, operational, population-health'
        });
      });
    });

    describe('getReportHistory', () => {
      it('should return user report history', async () => {
        const mockHistory = {
          reports: [
            {
              id: 'report-123',
              title: 'Monthly Quality Report',
              type: 'quality-measures',
              generatedAt: '2024-01-15T10:00:00Z',
              status: 'completed',
              downloadUrl: '/api/reports/report-123/download'
            }
          ],
          totalCount: 1,
          pagination: {
            page: 1,
            limit: 10,
            totalPages: 1
          }
        };

        mockRequest.query = {
          page: '1',
          limit: '10'
        };

        const mockServiceInstance = {
          getReportHistory: jest.fn().mockResolvedValue(mockHistory)
        };
        mockReportingService.mockImplementation(() => mockServiceInstance as any);

        await analyticsController.getReportHistory(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockServiceInstance.getReportHistory).toHaveBeenCalledWith({
          userId: 'test-user-1',
          page: 1,
          limit: 10
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockHistory
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing authentication', async () => {
      mockRequest.user = undefined;

      await analyticsController.getClinicalQualityMeasures(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    });

    it('should handle insufficient permissions', async () => {
      mockRequest.user = {
        id: 'test-user-1',
        role: 'nursing_staff',
        permissions: ['patient:read']
      };

      await analyticsController.getClinicalQualityMeasures(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
        message: 'Insufficient permissions for analytics data'
      });
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = new Error('Service temporarily unavailable');
      serviceError.name = 'ServiceUnavailableError';

      const mockServiceInstance = {
        calculateQualityMeasures: jest.fn().mockRejectedValue(serviceError)
      };
      mockClinicalQualityService.mockImplementation(() => mockServiceInstance as any);

      await analyticsController.getClinicalQualityMeasures(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('Input Validation', () => {
    it('should validate date range parameters', async () => {
      mockRequest.query = {
        startDate: '2024-12-31',
        endDate: '2024-01-01' // End date before start date
      };

      await analyticsController.getClinicalQualityMeasures(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date range',
        message: 'End date must be after start date'
      });
    });

    it('should validate pagination parameters', async () => {
      mockRequest.query = {
        page: '-1',
        limit: '0'
      };

      await analyticsController.getReportHistory(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid pagination parameters',
        message: 'Page must be >= 1 and limit must be > 0'
      });
    });
  });
});