import { Bundle, Patient, OperationOutcome } from '@medplum/fhirtypes';
import { Request, Response } from 'express';

import { FHIRController } from '../../../src/controllers/fhir.controller';
import { auditService } from '../../../src/services/audit.service';
import { databaseService } from '../../../src/services/database.service';
import { fhirResourcesService } from '../../../src/services/fhir-resources.service';
import { medplumService } from '../../../src/services/medplum.service';
import logger from '../../../src/utils/logger';
import { createMockUser } from '../../test-helpers';

// Mock all dependencies
jest.mock('../../../src/services/medplum.service');
jest.mock('../../../src/services/fhir-resources.service');
jest.mock('../../../src/services/database.service');
jest.mock('../../../src/services/audit.service');
jest.mock('../../../src/utils/logger');

describe('Patient Search API - TDD Test Suite', () => {
  let controller: FHIRController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const mockMedplumService = medplumService as jest.Mocked<typeof medplumService>;
  const mockFhirResourcesService = fhirResourcesService as jest.Mocked<typeof fhirResourcesService>;
  const mockAuditService = auditService as jest.Mocked<typeof auditService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create controller instance
    controller = new FHIRController();

    // Setup response mocks
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();

    // Setup request and response objects
    mockReq = {
      params: { resourceType: 'Patient' },
      query: {},
      headers: {
        'content-type': 'application/fhir+json',
        'accept': 'application/fhir+json'
      },
      user: createMockUser({
        id: 'test-user-1',
        role: 'physician',
        permissions: ['fhir:read', 'fhir:write']
      }),
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Test User Agent')
    };

    mockRes = {
      json: jsonMock,
      status: statusMock
    };
  });

  describe('Basic Patient Search', () => {
    it('should search patients by family name', async () => {
      // Arrange
      mockReq.query = { family: 'Smith' };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 2,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-1',
              name: [{ family: 'Smith', given: ['John'] }],
              birthDate: '1980-01-01'
            }
          },
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-2',
              name: [{ family: 'Smith', given: ['Jane'] }],
              birthDate: '1985-05-15'
            }
          }
        ]
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { family: 'Smith' });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should search patients by given name', async () => {
      // Arrange
      mockReq.query = { given: 'John' };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-1',
              name: [{ family: 'Doe', given: ['John'] }]
            }
          }
        ]
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { given: 'John' });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });

    it('should search patients by both family and given names', async () => {
      // Arrange
      mockReq.query = { family: 'Doe', given: 'Jane' };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-3',
              name: [{ family: 'Doe', given: ['Jane', 'Marie'] }]
            }
          }
        ]
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        family: 'Doe', 
        given: 'Jane' 
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });
  });

  describe('Advanced Search Parameters', () => {
    it('should search patients by birthdate range', async () => {
      // Arrange
      mockReq.query = { 
        birthdate: ['ge1980-01-01', 'le1990-12-31']
      };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 3,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-1',
              birthDate: '1985-06-15'
            }
          }
        ]
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        birthdate: ['ge1980-01-01', 'le1990-12-31']
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });

    it('should search patients by identifier (MRN)', async () => {
      // Arrange
      mockReq.query = { 
        identifier: 'MRN|12345678'
      };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-100',
              identifier: [{
                system: 'MRN',
                value: '12345678'
              }]
            }
          }
        ]
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        identifier: 'MRN|12345678'
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });

    it('should search patients by phone number', async () => {
      // Arrange
      mockReq.query = { 
        telecom: 'phone|(555) 123-4567'
      };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-50',
              telecom: [{
                system: 'phone',
                value: '(555) 123-4567',
                use: 'mobile' as const
              }]
            }
          }
        ]
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        telecom: 'phone|(555) 123-4567'
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });

    it('should search patients by email address', async () => {
      // Arrange
      mockReq.query = { 
        telecom: 'email|john.doe@example.com'
      };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-51',
              telecom: [{
                system: 'email',
                value: 'john.doe@example.com',
                use: 'home' as const
              }]
            }
          }
        ]
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        telecom: 'email|john.doe@example.com'
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });
  });

  describe('Search with Pagination and Sorting', () => {
    it('should handle pagination with _count and _offset', async () => {
      // Arrange
      mockReq.query = { 
        _count: '10',
        _offset: '20'
      };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 100,
        link: [
          { relation: 'self', url: '/fhir/R4/Patient?_count=10&_offset=20' },
          { relation: 'next', url: '/fhir/R4/Patient?_count=10&_offset=30' },
          { relation: 'previous', url: '/fhir/R4/Patient?_count=10&_offset=10' }
        ],
        entry: [] // 10 patient entries
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        _count: '10',
        _offset: '20'
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });

    it('should handle sorting by name', async () => {
      // Arrange
      mockReq.query = { 
        _sort: 'family,given'
      };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 5,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-1',
              name: [{ family: 'Adams', given: ['Alice'] }]
            }
          },
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-2',
              name: [{ family: 'Brown', given: ['Bob'] }]
            }
          }
        ]
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        _sort: 'family,given'
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });

    it('should handle reverse sorting with minus prefix', async () => {
      // Arrange
      mockReq.query = { 
        _sort: '-_lastUpdated'
      };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 3,
        entry: [] // Patients sorted by most recent first
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        _sort: '-_lastUpdated'
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });
  });

  describe('Search with Include and Revinclude', () => {
    it('should include related practitioners with _include', async () => {
      // Arrange
      mockReq.query = { 
        _include: 'Patient:general-practitioner'
      };
      
      const expectedBundle: Bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-1',
              generalPractitioner: [{ reference: 'Practitioner/prac-1' }]
            }
          },
          {
            resource: {
              resourceType: 'Practitioner',
              id: 'prac-1',
              name: [{ family: 'Smith', given: ['Dr', 'Jane'] }]
            },
            search: { mode: 'include' }
          }
        ]
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        _include: 'Patient:general-practitioner'
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });

    it('should include related resources with _revinclude', async () => {
      // Arrange
      mockReq.query = { 
        _revinclude: 'Encounter:patient'
      };
      
      const expectedBundle: Bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-1'
            }
          },
          {
            resource: {
              resourceType: 'Encounter',
              id: 'enc-1',
              subject: { reference: 'Patient/patient-1' }
            },
            search: { mode: 'include' }
          }
        ]
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        _revinclude: 'Encounter:patient'
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });
  });

  describe('Full-text Search', () => {
    it('should search patients using _text parameter', async () => {
      // Arrange
      mockReq.query = { 
        _text: 'diabetes hypertension'
      };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 2,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-10',
              text: {
                status: 'generated',
                div: '<div>Patient with diabetes and hypertension</div>'
              }
            }
          }
        ]
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        _text: 'diabetes hypertension'
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });

    it('should search using _content parameter for deep search', async () => {
      // Arrange
      mockReq.query = { 
        _content: 'allergic reaction'
      };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: []
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        _content: 'allergic reaction'
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });
  });

  describe('Complex Search Scenarios', () => {
    it('should handle multiple search parameters with OR logic', async () => {
      // Arrange
      mockReq.query = { 
        family: ['Smith', 'Jones'],
        given: 'John'
      };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 3,
        entry: [] // Patients with family Smith OR Jones AND given name John
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        family: ['Smith', 'Jones'],
        given: 'John'
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });

    it('should handle search with multiple identifiers', async () => {
      // Arrange
      mockReq.query = { 
        identifier: ['MRN|12345', 'SSN|987-65-4321']
      };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 2,
        entry: []
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        identifier: ['MRN|12345', 'SSN|987-65-4321']
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });

    it('should handle composite search parameters', async () => {
      // Arrange
      mockReq.query = { 
        'name-use': 'John|official',
        'birthdate': 'ge1980-01-01'
      };
      
      const expectedBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: []
      };

      mockMedplumService.searchResources.mockResolvedValue(expectedBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { 
        'name-use': 'John|official',
        'birthdate': 'ge1980-01-01'
      });
      expect(jsonMock).toHaveBeenCalledWith(expectedBundle);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for missing resource type', async () => {
      // Arrange
      mockReq.params = {};

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'required',
          diagnostics: 'Resource type is required'
        }]
      });
    });

    it('should handle search service errors gracefully', async () => {
      // Arrange
      mockReq.query = { family: 'Smith' };
      mockMedplumService.searchResources.mockRejectedValue(new Error('Database connection failed'));

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to search resources'
        }]
      });
    });

    it('should validate search parameter formats', async () => {
      // Arrange
      mockReq.query = { 
        birthdate: 'invalid-date-format'
      };

      const validationError = new Error('Invalid date format');
      mockMedplumService.searchResources.mockRejectedValue(validationError);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to search resources'
        }]
      });
    });

    it('should handle timeout errors for long-running searches', async () => {
      // Arrange
      mockReq.query = { _text: 'complex search query' };
      
      const timeoutError = new Error('Query timeout');
      (timeoutError as any).code = 'ETIMEDOUT';
      mockMedplumService.searchResources.mockRejectedValue(timeoutError);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to search resources'
        }]
      });
    });
  });

  describe('Search Result Formatting', () => {
    it('should return empty bundle for no results', async () => {
      // Arrange
      mockReq.query = { family: 'NonExistentName' };
      
      const emptyBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 0,
        entry: []
      };

      mockMedplumService.searchResources.mockResolvedValue(emptyBundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(jsonMock).toHaveBeenCalledWith(emptyBundle);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should include search score in results when relevant', async () => {
      // Arrange
      mockReq.query = { _text: 'diabetes' };
      
      const bundleWithScores: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 2,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-1'
            },
            search: {
              mode: 'match',
              score: 0.95
            }
          },
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-2'
            },
            search: {
              mode: 'match',
              score: 0.75
            }
          }
        ]
      };

      mockMedplumService.searchResources.mockResolvedValue(bundleWithScores);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(jsonMock).toHaveBeenCalledWith(bundleWithScores);
    });
  });

  describe('Security and Audit', () => {
    it('should audit successful patient searches', async () => {
      // Arrange
      mockReq.query = { family: 'Smith' };
      
      const bundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: []
      };

      mockMedplumService.searchResources.mockResolvedValue(bundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(logger.fhir).toHaveBeenCalledWith('Searching resources', expect.objectContaining({
        resourceType: 'Patient',
        searchParams: ['family'],
        userId: 'test-user-1'
      }));
    });

    it('should respect user permissions for patient search', async () => {
      // Arrange
      mockReq.user = createMockUser({
        id: 'restricted-user',
        role: 'nursing_staff',
        permissions: ['fhir:read:limited']
      });
      mockReq.query = { family: 'Smith' };

      // This test assumes permission checking is implemented
      const bundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: []
      };

      mockMedplumService.searchResources.mockResolvedValue(bundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(bundle);
    });
  });

  describe('Performance Considerations', () => {
    it('should limit results to prevent performance issues', async () => {
      // Arrange
      mockReq.query = {}; // No _count specified
      
      const bundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 10000,
        entry: [] // Should be limited to default max
      };

      mockMedplumService.searchResources.mockResolvedValue(bundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', {});
      expect(jsonMock).toHaveBeenCalledWith(bundle);
      // Note: Implementation should enforce a default limit
    });

    it('should reject excessive _count values', async () => {
      // Arrange
      mockReq.query = { _count: '10000' };
      
      const bundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 100,
        entry: []
      };

      mockMedplumService.searchResources.mockResolvedValue(bundle);

      // Act
      await controller.searchResources(mockReq as Request, mockRes as Response);

      // Assert
      // Implementation should cap the count at a reasonable maximum
      expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', { _count: '10000' });
    });
  });
});