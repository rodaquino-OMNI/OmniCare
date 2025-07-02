/**
 * Backend test utility types
 */

import { Request, Response } from 'express';
import { RedisClientType } from 'redis';
import { DataSource, Repository } from 'typeorm';

import { User, MockData } from '../../../types/shared';

// Test Database Types
export interface TestDatabase {
  dataSource: DataSource;
  repositories: {
    [entityName: string]: Repository<any>;
  };
  seed: (data: MockData) => Promise<void>;
  clear: () => Promise<void>;
  close: () => Promise<void>;
}

// Test Redis Types
export interface TestRedis {
  client: RedisClientType;
  clear: () => Promise<void>;
  close: () => Promise<void>;
}

// Mock Request/Response Types
export interface MockRequest extends Partial<Request> {
  user?: User;
  body?: any;
  params?: { [key: string]: string };
  query?: { [key: string]: any };
  headers?: { [key: string]: string };
  session?: any;
  cookies?: { [key: string]: string };
}

export interface MockResponse extends Partial<Response> {
  status: jest.MockedFunction<(code: number) => MockResponse>;
  json: jest.MockedFunction<(data: any) => MockResponse>;
  send: jest.MockedFunction<(data: any) => MockResponse>;
  cookie: jest.MockedFunction<(name: string, value: string, options?: any) => MockResponse>;
  clearCookie: jest.MockedFunction<(name: string, options?: any) => MockResponse>;
  redirect: jest.MockedFunction<(url: string) => MockResponse>;
  end: jest.MockedFunction<() => MockResponse>;
  statusCode?: number;
  locals?: any;
}

// Test Context Types
export interface BackendTestContext {
  database: TestDatabase;
  redis: TestRedis;
  testUser: User;
  cleanup: () => Promise<void>;
}

// API Test Types
export interface APITestCase {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  headers?: Record<string, string>;
  body?: any;
  expectedStatus: number;
  expectedResponse?: any;
  beforeTest?: () => Promise<void>;
  afterTest?: () => Promise<void>;
}

export interface APITestSuite {
  name: string;
  baseUrl: string;
  authentication?: {
    type: 'bearer' | 'basic' | 'apikey';
    credentials: string | { username: string; password: string } | { key: string; value: string };
  };
  tests: APITestCase[];
  beforeAll?: () => Promise<void>;
  afterAll?: () => Promise<void>;
}

// Mock Services Types
export interface MockMedplumService {
  getPatient: jest.MockedFunction<(id: string) => Promise<any>>;
  createPatient: jest.MockedFunction<(patient: any) => Promise<any>>;
  updatePatient: jest.MockedFunction<(id: string, patient: any) => Promise<any>>;
  deletePatient: jest.MockedFunction<(id: string) => Promise<void>>;
  searchPatients: jest.MockedFunction<(params: any) => Promise<any>>;
}

export interface MockDatabaseService {
  findOne: jest.MockedFunction<(entity: string, criteria: any) => Promise<any>>;
  findMany: jest.MockedFunction<(entity: string, criteria: any) => Promise<any[]>>;
  create: jest.MockedFunction<(entity: string, data: any) => Promise<any>>;
  update: jest.MockedFunction<(entity: string, id: string, data: any) => Promise<any>>;
  delete: jest.MockedFunction<(entity: string, id: string) => Promise<void>>;
  transaction: jest.MockedFunction<(callback: (manager: any) => Promise<any>) => Promise<any>>;
}

export interface MockRedisService {
  get: jest.MockedFunction<(key: string) => Promise<string | null>>;
  set: jest.MockedFunction<(key: string, value: string, ttl?: number) => Promise<void>>;
  del: jest.MockedFunction<(key: string) => Promise<void>>;
  exists: jest.MockedFunction<(key: string) => Promise<boolean>>;
  hget: jest.MockedFunction<(key: string, field: string) => Promise<string | null>>;
  hset: jest.MockedFunction<(key: string, field: string, value: string) => Promise<void>>;
  hdel: jest.MockedFunction<(key: string, field: string) => Promise<void>>;
}

// Performance Test Types
export interface PerformanceTestMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
}

export interface LoadTestConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  concurrency: number;
  duration: number; // seconds
  payload?: any;
  headers?: Record<string, string>;
  rampUp?: number; // seconds
}

export interface LoadTestResult {
  config: LoadTestConfig;
  metrics: PerformanceTestMetrics;
  errors: Array<{
    timestamp: string;
    error: string;
    statusCode?: number;
  }>;
  duration: number;
  requestCount: number;
  successCount: number;
  errorCount: number;
}

// Security Test Types
export interface SecurityTestCase {
  name: string;
  description: string;
  endpoint: string;
  method: string;
  attack: 'injection' | 'xss' | 'auth_bypass' | 'rate_limit' | 'csrf' | 'path_traversal';
  payload: any;
  expectedResult: 'blocked' | 'allowed' | 'sanitized';
}

export interface SecurityTestReport {
  testCase: SecurityTestCase;
  result: 'pass' | 'fail' | 'warning';
  details: string;
  recommendation?: string;
}

// Integration Test Types
export interface IntegrationTestConfig {
  database: {
    url: string;
    ssl?: boolean;
    cleanup?: boolean;
  };
  redis: {
    url: string;
    cleanup?: boolean;
  };
  externalAPIs: {
    medplum: {
      baseUrl: string;
      clientId: string;
      clientSecret: string;
      mock?: boolean;
    };
    fhir: {
      baseUrl: string;
      mock?: boolean;
    };
  };
  server: {
    port: number;
    host: string;
  };
}

// Test Data Factory Types
export interface TestDataFactory {
  createUser: (overrides?: Partial<User>) => User;
  createUsers: (count: number, overrides?: Partial<User>) => User[];
  createPatient: (overrides?: any) => any;
  createPatients: (count: number, overrides?: any) => any[];
  createPractitioner: (overrides?: any) => any;
  createPractitioners: (count: number, overrides?: any) => any[];
  createEncounter: (patientId: string, practitionerId: string, overrides?: any) => any;
  createObservation: (patientId: string, encounterId: string, overrides?: any) => any;
  createCondition: (patientId: string, overrides?: any) => any;
}

// Mock External API Types
export interface MockAPIResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  delay?: number;
}

export interface MockAPIEndpoint {
  method: string;
  path: string | RegExp;
  response: MockAPIResponse | ((req: any) => MockAPIResponse);
  times?: number;
}

export interface MockAPIServer {
  baseUrl: string;
  endpoints: MockAPIEndpoint[];
  start: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
  verify: () => boolean;
}

// Chaos Testing Types
export interface ChaosTestScenario {
  name: string;
  description: string;
  type: 'network_failure' | 'database_failure' | 'memory_leak' | 'cpu_spike' | 'disk_full';
  duration: number; // seconds
  intensity: 'low' | 'medium' | 'high';
  targetService: string;
  expectedBehavior: string;
}

export interface ChaosTestResult {
  scenario: ChaosTestScenario;
  startTime: string;
  endTime: string;
  success: boolean;
  observations: string[];
  metrics: PerformanceTestMetrics;
  recovery: {
    successful: boolean;
    timeToRecover: number; // seconds
  };
}

// Test Utilities
export interface TestUtilities {
  database: TestDatabase;
  redis: TestRedis;
  dataFactory: TestDataFactory;
  mockAPIs: MockAPIServer[];
  cleanup: () => Promise<void>;
}

// Contract Testing Types
export interface ContractTest {
  provider: string;
  consumer: string;
  endpoint: string;
  method: string;
  requestContract: {
    headers?: Record<string, any>;
    body?: any;
    query?: Record<string, any>;
  };
  responseContract: {
    status: number;
    headers?: Record<string, any>;
    body?: any;
  };
}

export interface ContractTestSuite {
  name: string;
  contracts: ContractTest[];
  beforeAll?: () => Promise<void>;
  afterAll?: () => Promise<void>;
}

// Export common testing utilities
export * from 'supertest';
export * from 'jest';