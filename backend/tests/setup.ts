import { jest } from '@jest/globals';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Make crypto available globally for tests that might need it
import * as cryptoModule from 'crypto';
(global as any).crypto = cryptoModule;

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Mock external dependencies
jest.mock('@medplum/core', () => ({
  createReference: jest.fn((resource: any) => ({
    reference: `${resource.resourceType}/${resource.id}`,
  })),
  getReferenceString: jest.fn((ref: any) => ref.reference),
  normalizeOperationOutcome: jest.fn((outcome: any) => outcome),
}));

// Note: @medplum/client package doesn't exist, using @medplum/core for client functionality

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    flushall: jest.fn(),
    on: jest.fn(),
  })),
}));

// Mock PostgreSQL
jest.mock('pg', () => {
  const mockPool = {
    connect: jest.fn(() => Promise.resolve({
      query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })),
      release: jest.fn(),
    })),
    query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })),
    end: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    // Additional pool methods that might be used
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  };

  return {
    Pool: jest.fn(() => mockPool),
    Client: jest.fn(() => ({
      connect: jest.fn(() => Promise.resolve()),
      query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })),
      end: jest.fn(() => Promise.resolve()),
      on: jest.fn(),
    })),
  };
});

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    json: jest.fn(() => ({})),
    colorize: jest.fn(() => ({})),
    simple: jest.fn(() => ({})),
    printf: jest.fn(() => ({})),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Mock JWT Service
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn((payload: any, secret: string, options?: any) => {
    const mockToken = `mock.jwt.token.${Date.now()}`;
    return mockToken;
  }),
  verify: jest.fn((token: string, secret: string) => {
    if (token.includes('invalid') || token === 'invalid-refresh-token') {
      throw new Error('Invalid token');
    }
    return {
      userId: 'user-1',
      username: 'admin@omnicare.com',
      role: 'SYSTEM_ADMINISTRATOR',
      sessionId: 'session-123',
      type: 'access',
      iss: 'test-issuer',
      exp: Date.now() + 3600000, // 1 hour from now
    };
  }),
  decode: jest.fn((token: string) => ({
    userId: 'user-1',
    username: 'admin@omnicare.com',
    role: 'SYSTEM_ADMINISTRATOR',
    sessionId: 'session-123',
    type: 'access',
    iss: 'test-issuer',
    exp: Date.now() + 3600000,
  })),
}));

// Mock Auth Services
jest.mock('../src/auth/jwt.service', () => ({
  JWTAuthService: jest.fn().mockImplementation(() => ({
    generateTokens: jest.fn(() => ({
      accessToken: 'mock.access.token',
      refreshToken: 'mock.refresh.token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    })),
    verifyAccessToken: jest.fn(() => ({
      userId: 'user-1',
      username: 'admin@omnicare.com',
      role: 'SYSTEM_ADMINISTRATOR',
      sessionId: 'session-123',
    })),
    verifyRefreshToken: jest.fn(() => ({
      userId: 'user-1',
      sessionId: 'session-123',
    })),
    extractTokenFromHeader: jest.fn((header: string) => {
      if (!header || !header.startsWith('Bearer ')) return null;
      const token = header.substring(7).trim();
      return token || null;
    }),
  })),
}));

// Mock Session Service
jest.mock('../src/services/session.service', () => {
  // Mock InMemorySessionStore
  const MockInMemorySessionStore = jest.fn().mockImplementation(() => {
    const mockInstance = {
      sessions: new Map(),
      userSessions: new Map(),
      get: jest.fn((sessionId: string) => {
        const session = mockInstance.sessions.get(sessionId) || null;
        return Promise.resolve(session);
      }),
      set: jest.fn((sessionId: string, session: any) => {
        mockInstance.sessions.set(sessionId, session);
        // Update user sessions index
        if (!mockInstance.userSessions.has(session.userId)) {
          mockInstance.userSessions.set(session.userId, new Set());
        }
        mockInstance.userSessions.get(session.userId)?.add(sessionId);
        return Promise.resolve();
      }),
      delete: jest.fn((sessionId: string) => {
        const session = mockInstance.sessions.get(sessionId);
        if (session) {
          mockInstance.sessions.delete(sessionId);
          // Clean up user sessions index
          const userSessions = mockInstance.userSessions.get(session.userId);
          if (userSessions) {
            userSessions.delete(sessionId);
            if (userSessions.size === 0) {
              mockInstance.userSessions.delete(session.userId);
            }
          }
        }
        return Promise.resolve();
      }),
      exists: jest.fn((sessionId: string) => {
        const exists = mockInstance.sessions.has(sessionId);
        return Promise.resolve(exists);
      }),
      getAllUserSessions: jest.fn((userId: string) => {
        const sessionIds = mockInstance.userSessions.get(userId) || new Set();
        const sessions = Array.from(sessionIds).map(id => mockInstance.sessions.get(id)).filter(Boolean);
        return Promise.resolve(sessions);
      }),
      deleteUserSessions: jest.fn((userId: string) => {
        const sessionIds = mockInstance.userSessions.get(userId) || new Set();
        sessionIds.forEach((id: string) => mockInstance.sessions.delete(id));
        mockInstance.userSessions.delete(userId);
        return Promise.resolve();
      }),
      cleanup: jest.fn(() => {
        // Mock cleanup of expired sessions
        let cleanedCount = 0;
        const now = new Date();
        for (const [sessionId, session] of mockInstance.sessions.entries()) {
          if (session && session.expiresAt && session.expiresAt < now) {
            mockInstance.sessions.delete(sessionId);
            cleanedCount++;
          }
        }
        return Promise.resolve(cleanedCount);
      }),
    };
    return mockInstance;
  });

  // Mock SessionManager
  const MockSessionManager = jest.fn().mockImplementation(() => ({
    createSession: jest.fn(() => Promise.resolve({
      sessionId: 'session-123',
      userId: 'user-1',
      role: 'physician',
      permissions: [],
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    })),
    getSession: jest.fn(() => Promise.resolve({
      sessionId: 'session-123',
      userId: 'user-1',
      role: 'physician',
      permissions: [],
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    })),
    validateSessionSecurity: jest.fn(() => Promise.resolve({
      isValid: true,
      securityIssues: [],
    })),
    updateSessionActivity: jest.fn(() => Promise.resolve({
      sessionId: 'session-123',
      userId: 'user-1',
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    })),
    destroySession: jest.fn(() => Promise.resolve()),
    destroyUserSessions: jest.fn(() => Promise.resolve()),
    forceLogout: jest.fn(() => Promise.resolve()),
    getUserSessions: jest.fn(() => Promise.resolve([])),
    isSessionValid: jest.fn(() => true),
    shutdown: jest.fn(),
    removeAllListeners: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
  }));

  return {
    InMemorySessionStore: MockInMemorySessionStore,
    SessionManager: MockSessionManager,
    sessionManager: new MockSessionManager(),
  };
});

// Mock Audit Service
jest.mock('../src/services/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    logSecurityEvent: jest.fn(),
    logUserAction: jest.fn(),
    shutdown: jest.fn(),
    searchAuditLogs: jest.fn(),
    getAuditStatistics: jest.fn(),
    generateHipaaComplianceReport: jest.fn(),
    logAccess: jest.fn(),
    logPatientAccess: jest.fn(),  
    createSession: jest.fn(),
    updateSessionActivity: jest.fn(),
    endSession: jest.fn(),
    setSessionId: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn()
  })),
  auditService: {
    logSecurityEvent: jest.fn(),
    logUserAction: jest.fn(),
    shutdown: jest.fn(),
    searchAuditLogs: jest.fn(),
    getAuditStatistics: jest.fn(),
    generateHipaaComplianceReport: jest.fn(),
    logAccess: jest.fn(),
    logPatientAccess: jest.fn(),
    createSession: jest.fn(),
    updateSessionActivity: jest.fn(),
    endSession: jest.fn(),
    setSessionId: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn()
  }
}));

// Mock Compliance Service
jest.mock('../src/services/compliance.service', () => ({
  ComplianceService: jest.fn().mockImplementation(() => ({
    checkHipaaCompliance: jest.fn(),
    validatePHIAccess: jest.fn(),
    logDataBreach: jest.fn(),
    generateComplianceAuditReport: jest.fn(),
    validateDataMinimization: jest.fn()
  }))
}));

// Mock Validation Service
jest.mock('../src/services/validation.service', () => ({
  ValidationService: jest.fn().mockImplementation(() => ({
    validateEmail: jest.fn(),
    validatePhoneNumber: jest.fn(),
    sanitizeInput: jest.fn(),
    validateFHIRId: jest.fn(),
    validateURI: jest.fn()
  })),
  validationService: {
    validateEmail: jest.fn(),
    validatePhoneNumber: jest.fn(),
    sanitizeInput: jest.fn(),
    validateFHIRId: jest.fn(),
    validateURI: jest.fn()
  }
}));

// Set up test database connection
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'omnicare_test';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
// Set DATABASE_URL which is what the config actually uses
process.env.DATABASE_URL = 'postgresql://test_user:test_password@localhost:5432/omnicare_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_key_for_testing_only';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_for_testing_only';
process.env.MEDPLUM_CLIENT_ID = 'test_client_id';
process.env.MEDPLUM_CLIENT_SECRET = 'test_client_secret';

// Global test helpers
(global as any).mockConsole = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Test data factories
(global as any).createMockPatient = () => ({
  resourceType: 'Patient',
  id: 'test-patient-1',
  identifier: [
    {
      system: 'http://hospital.smarthealthit.org',
      value: 'MRN123456',
    },
  ],
  name: [
    {
      family: 'Doe',
      given: ['John'],
    },
  ],
  gender: 'male',
  birthDate: '1990-01-01',
  telecom: [
    {
      system: 'phone',
      value: '555-0123',
      use: 'mobile',
    },
    {
      system: 'email',
      value: 'john.doe@example.com',
      use: 'home',
    },
  ],
  address: [
    {
      use: 'home',
      line: ['123 Main St'],
      city: 'Anytown',
      state: 'NY',
      postalCode: '12345',
      country: 'US',
    },
  ],
});

(global as any).createMockPractitioner = () => ({
  resourceType: 'Practitioner',
  id: 'test-practitioner-1',
  identifier: [
    {
      system: 'http://hl7.org/fhir/sid/us-npi',
      value: '1234567890',
    },
  ],
  name: [
    {
      family: 'Smith',
      given: ['Jane'],
      prefix: ['Dr.'],
    },
  ],
  telecom: [
    {
      system: 'phone',
      value: '555-0456',
      use: 'work',
    },
    {
      system: 'email',
      value: 'dr.smith@hospital.com',
      use: 'work',
    },
  ],
  qualification: [
    {
      code: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
            code: 'MD',
            display: 'Doctor of Medicine',
          },
        ],
      },
    },
  ],
});

(global as any).createMockEncounter = () => ({
  resourceType: 'Encounter',
  id: 'test-encounter-1',
  status: 'in-progress',
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'AMB',
    display: 'ambulatory',
  },
  subject: {
    reference: 'Patient/test-patient-1',
  },
  participant: [
    {
      individual: {
        reference: 'Practitioner/test-practitioner-1',
      },
    },
  ],
  period: {
    start: new Date().toISOString(),
  },
  serviceProvider: {
    reference: 'Organization/test-organization-1',
  },
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Mock Database Service
jest.mock('../src/services/database.service', () => {
  const mockPool = {
    connect: jest.fn(() => Promise.resolve({
      query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })),
      release: jest.fn(),
    })),
    query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })),
    end: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  };

  const mockDatabaseService = {
    initialize: jest.fn(() => Promise.resolve()),
    query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })),
    getPool: jest.fn(() => mockPool),
    getClient: jest.fn(() => Promise.resolve({
      query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })),
      release: jest.fn(),
    })),
    transaction: jest.fn((callback: any) => {
      const mockClient = {
        query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })),
        release: jest.fn(),
      };
      return callback(mockClient);
    }),
    transactionWithCheckpoints: jest.fn((transactionId: string, callback: any) => {
      const mockClient = {
        query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })),
        release: jest.fn(),
      };
      const createCheckpoint = jest.fn(() => Promise.resolve());
      return callback(mockClient, createCheckpoint);
    }),
    getTransactionCheckpoints: jest.fn(() => Promise.resolve([])),
    cleanupOldCheckpoints: jest.fn(() => Promise.resolve(0)),
    checkHealth: jest.fn(() => Promise.resolve({
      status: 'healthy',
      latency: 0,
      activeConnections: 0,
      idleConnections: 0,
      totalConnections: 0,
    })),
    getPoolStats: jest.fn(() => ({
      total: 0,
      idle: 0,
      waiting: 0,
    })),
    shutdown: jest.fn(() => Promise.resolve()),
    ensureAuditSchema: jest.fn(() => Promise.resolve()),
    // Additional methods that might be used
    connect: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(() => Promise.resolve()),
    cleanup: jest.fn(() => Promise.resolve()),
    getRepository: jest.fn((entityClass: any) => ({
      find: jest.fn(() => Promise.resolve([])),
      findOne: jest.fn(() => Promise.resolve(null)),
      save: jest.fn((entity: any) => Promise.resolve(entity)),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      count: jest.fn(() => Promise.resolve(0)),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn(() => Promise.resolve([])),
        getOne: jest.fn(() => Promise.resolve(null)),
        getCount: jest.fn(() => Promise.resolve(0)),
      })),
    })),
  };

  return {
    DatabaseService: jest.fn(() => mockDatabaseService),
    databaseService: mockDatabaseService,
  };
});

// Clean up after all tests
afterAll(async () => {
  // Clean up any persistent connections
  jest.restoreAllMocks();
});