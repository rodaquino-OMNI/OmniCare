/**
 * Pact Contract Testing Configuration
 * Defines consumer-provider contracts for API interactions
 */

import path from 'path';

import { LogLevel } from '@pact-foundation/pact';

export const pactConfig = {
  // Pact file output directory
  pactFileDirectory: path.resolve(__dirname, '../../pacts'),
  
  // Pact broker configuration
  pactBroker: {
    brokerUrl: process.env.PACT_BROKER_URL || 'http://localhost:9292',
    brokerUsername: process.env.PACT_BROKER_USERNAME,
    brokerPassword: process.env.PACT_BROKER_PASSWORD,
    publishVerificationResult: true,
    tags: ['prod', 'test'],
    consumerVersion: process.env.CI_COMMIT_SHA || '1.0.0',
  },
  
  // Provider configuration
  provider: {
    name: 'OmniCare-API',
    baseUrl: process.env.PROVIDER_BASE_URL || 'http://localhost:4000',
    providerVersion: process.env.PROVIDER_VERSION || '1.0.0',
    enablePending: true,
    includeWipPactsSince: '2024-01-01',
  },
  
  // Consumer configuration
  consumer: {
    name: 'OmniCare-Frontend',
  },
  
  // Test configuration
  logLevel: (process.env.PACT_LOG_LEVEL || 'INFO') as LogLevel,
  spec: 2,
  cors: true,
  timeout: 30000,
  
  // State handlers for provider verification
  stateHandlers: {
    'A patient exists': async () => {
      // Setup test data for patient existence
      return {
        description: 'Patient with ID patient-123 exists in database',
        setup: async () => {
          // Database setup logic
        },
        teardown: async () => {
          // Database cleanup logic
        },
      };
    },
    'User is authenticated': async () => {
      return {
        description: 'Valid JWT token is provided',
        setup: async () => {
          // Auth setup logic
        },
      };
    },
    'No patients exist': async () => {
      return {
        description: 'Empty patient database',
        setup: async () => {
          // Clear database
        },
      };
    },
  },
  
  // Request filters for provider verification
  requestFilter: (req: any, res: any, next: any) => {
    // Add auth headers if needed
    if (!req.headers.authorization) {
      req.headers.authorization = 'Bearer test-token';
    }
    next();
  },
  
  // Custom matchers
  matchers: {
    patient: {
      id: {
        match: 'regex',
        regex: '^[a-zA-Z0-9-]+$',
      },
      birthDate: {
        match: 'regex',
        regex: '^\\d{4}-\\d{2}-\\d{2}$',
      },
      mrn: {
        match: 'regex',
        regex: '^MRN\\d{6}$',
      },
    },
    fhir: {
      resourceType: {
        match: 'type',
      },
      meta: {
        match: 'type',
      },
    },
    pagination: {
      total: {
        match: 'integer',
      },
      limit: {
        match: 'integer',
      },
      offset: {
        match: 'integer',
      },
    },
  },
};

// Pact verification options
export const verificationOptions = {
  providerBaseUrl: pactConfig.provider.baseUrl,
  provider: pactConfig.provider.name,
  providerVersion: pactConfig.provider.providerVersion,
  publishVerificationResult: pactConfig.pactBroker.publishVerificationResult,
  enablePending: pactConfig.provider.enablePending,
  includeWipPactsSince: pactConfig.provider.includeWipPactsSince,
  stateHandlers: pactConfig.stateHandlers,
  requestFilter: pactConfig.requestFilter,
  customProviderHeaders: {
    'X-Provider-Version': pactConfig.provider.providerVersion,
  },
};

// Pact publish options
export const publishOptions = {
  pactFilesOrDirs: [pactConfig.pactFileDirectory],
  pactBroker: pactConfig.pactBroker.brokerUrl,
  pactBrokerUsername: pactConfig.pactBroker.brokerUsername,
  pactBrokerPassword: pactConfig.pactBroker.brokerPassword,
  tags: pactConfig.pactBroker.tags,
  consumerVersion: pactConfig.pactBroker.consumerVersion,
};