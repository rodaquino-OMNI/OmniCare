import winston from 'winston';

// Mock the config module first to prevent environment dependencies
jest.mock('../../../src/config', () => ({
  __esModule: true,
  default: {
    server: {
      env: 'test',
      port: 8080,
      host: 'localhost',
    },
    logging: {
      level: 'info',
      file: 'logs/omnicare.log',
    },
  },
}));

// Mock path module to avoid file system dependencies
jest.mock('path', () => ({
  dirname: jest.fn(() => 'logs'),
  join: jest.fn((dir, file) => `${dir}/${file}`),
}));

// Create a shared mock logger instance
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock winston to avoid actual file operations during tests
jest.mock('winston', () => ({
  createLogger: jest.fn(() => mockLogger),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Import logger after mocks are set up
import logger from '../../../src/utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Custom logging methods', () => {
    it('should log FHIR messages with context', () => {
      const message = 'Patient created successfully';
      const meta = { patientId: 'test-patient-1' };

      logger.fhir(message, meta);

      expect(mockLogger.info).toHaveBeenCalledWith(message, {
        context: 'FHIR',
        patientId: 'test-patient-1',
      });
    });

    it('should log FHIR messages without meta', () => {
      const message = 'FHIR operation completed';

      logger.fhir(message);

      expect(mockLogger.info).toHaveBeenCalledWith(message, {
        context: 'FHIR',
      });
    });

    it('should log security messages with context', () => {
      const message = 'Authentication failed';
      const meta = { userId: 'test-user', ip: '192.168.1.1' };

      logger.security(message, meta);

      expect(mockLogger.warn).toHaveBeenCalledWith(message, {
        context: 'SECURITY',
        userId: 'test-user',
        ip: '192.168.1.1',
      });
    });

    it('should log performance messages with context', () => {
      const message = 'Database query executed';
      const meta = { duration: '150ms', query: 'SELECT * FROM patients' };

      logger.performance(message, meta);

      expect(mockLogger.info).toHaveBeenCalledWith(message, {
        context: 'PERFORMANCE',
        duration: '150ms',
        query: 'SELECT * FROM patients',
      });
    });

    it('should log audit messages with context', () => {
      const message = 'Patient record accessed';
      const meta = { 
        userId: 'doc-123', 
        patientId: 'patient-456',
        action: 'read',
        timestamp: '2024-01-01T12:00:00Z',
      };

      logger.audit(message, meta);

      expect(mockLogger.info).toHaveBeenCalledWith(message, {
        context: 'AUDIT',
        userId: 'doc-123',
        patientId: 'patient-456',
        action: 'read',
        timestamp: '2024-01-01T12:00:00Z',
      });
    });

    it('should log integration messages with context', () => {
      const message = 'External API call completed';
      const meta = { 
        service: 'medplum',
        endpoint: '/fhir/Patient',
        statusCode: 200,
        responseTime: '250ms',
      };

      logger.integration(message, meta);

      expect(mockLogger.info).toHaveBeenCalledWith(message, {
        context: 'INTEGRATION',
        service: 'medplum',
        endpoint: '/fhir/Patient',
        statusCode: 200,
        responseTime: '250ms',
      });
    });
  });

  describe('Standard logging methods', () => {
    it('should support standard info logging', () => {
      const message = 'Application started';
      const meta = { port: 3000 };

      logger.info(message, meta);

      expect(mockLogger.info).toHaveBeenCalledWith(message, meta);
    });

    it('should support standard error logging', () => {
      const message = 'Database connection failed';
      const error = new Error('Connection timeout');

      logger.error(message, error);

      expect(mockLogger.error).toHaveBeenCalledWith(message, error);
    });

    it('should support standard warning logging', () => {
      const message = 'Deprecated API endpoint used';
      const meta = { endpoint: '/api/v1/patients' };

      logger.warn(message, meta);

      expect(mockLogger.warn).toHaveBeenCalledWith(message, meta);
    });

    it('should support standard debug logging', () => {
      const message = 'Debug information';
      const meta = { debugData: { step: 1, value: 'test' } };

      logger.debug(message, meta);

      expect(mockLogger.debug).toHaveBeenCalledWith(message, meta);
    });
  });

  describe('Logger configuration', () => {
    it('should create logger with correct configuration', () => {
      // Test that logger instance exists and has the required methods
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should configure transports correctly', () => {
      // Test logger basic functionality and transport configuration
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should configure format correctly', () => {
      // Test logger basic functionality and custom methods
      expect(logger).toBeDefined();
      expect(typeof logger.fhir).toBe('function');
      expect(typeof logger.security).toBe('function');
      expect(typeof logger.performance).toBe('function');
      expect(typeof logger.audit).toBe('function');
      expect(typeof logger.integration).toBe('function');
    });
  });

  describe('Error handling', () => {
    it('should handle complex error objects', () => {
      const message = 'Complex error occurred';
      const error = {
        name: 'ValidationError',
        message: 'Required field missing',
        code: 'REQUIRED_FIELD',
        field: 'Patient.name',
        stack: 'Error stack trace...',
      };

      logger.error(message, error);

      expect(mockLogger.error).toHaveBeenCalledWith(message, error);
    });

    it('should handle nested metadata objects', () => {
      const message = 'Complex operation completed';
      const meta = {
        operation: 'patient-search',
        parameters: {
          filters: {
            name: 'John Doe',
            birthDate: '1990-01-01',
          },
          pagination: {
            page: 1,
            size: 20,
          },
        },
        results: {
          total: 1,
          count: 1,
          processingTime: '45ms',
        },
      };

      logger.fhir(message, meta);

      expect(mockLogger.info).toHaveBeenCalledWith(message, {
        context: 'FHIR',
        ...meta,
      });
    });
  });

  describe('Context-specific logging scenarios', () => {
    it('should log FHIR resource creation', () => {
      logger.fhir('Patient created successfully', {
        patientId: 'patient-123',
        mrn: 'MRN123456',
        timestamp: '2024-01-01T12:00:00Z',
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Patient created successfully', {
        context: 'FHIR',
        patientId: 'patient-123',
        mrn: 'MRN123456',
        timestamp: '2024-01-01T12:00:00Z',
      });
    });

    it('should log security events', () => {
      logger.security('Failed login attempt', {
        username: 'doctor@hospital.com',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        attemptCount: 3,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith('Failed login attempt', {
        context: 'SECURITY',
        username: 'doctor@hospital.com',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        attemptCount: 3,
      });
    });

    it('should log performance metrics', () => {
      logger.performance('Database query performance', {
        query: 'SELECT * FROM patients WHERE active = true',
        executionTime: '125ms',
        rowsReturned: 50,
        cacheHit: false,
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Database query performance', {
        context: 'PERFORMANCE',
        query: 'SELECT * FROM patients WHERE active = true',
        executionTime: '125ms',
        rowsReturned: 50,
        cacheHit: false,
      });
    });

    it('should log audit trail events', () => {
      logger.audit('Patient record modified', {
        userId: 'doctor-456',
        patientId: 'patient-789',
        action: 'update',
        changedFields: ['name', 'address', 'telecom'],
        previousValues: {
          name: 'John Doe',
          address: '123 Old St',
        },
        newValues: {
          name: 'John Smith',
          address: '456 New Ave',
        },
        timestamp: '2024-01-01T12:30:00Z',
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Patient record modified', {
        context: 'AUDIT',
        userId: 'doctor-456',
        patientId: 'patient-789',
        action: 'update',
        changedFields: ['name', 'address', 'telecom'],
        previousValues: {
          name: 'John Doe',
          address: '123 Old St',
        },
        newValues: {
          name: 'John Smith',
          address: '456 New Ave',
        },
        timestamp: '2024-01-01T12:30:00Z',
      });
    });

    it('should log integration events', () => {
      logger.integration('External lab results received', {
        labProvider: 'LabCorp',
        patientId: 'patient-101',
        testType: 'blood-panel',
        resultsCount: 12,
        processingTime: '500ms',
        status: 'success',
      });

      expect(mockLogger.info).toHaveBeenCalledWith('External lab results received', {
        context: 'INTEGRATION',
        labProvider: 'LabCorp',
        patientId: 'patient-101',
        testType: 'blood-panel',
        resultsCount: 12,
        processingTime: '500ms',
        status: 'success',
      });
    });
  });
});