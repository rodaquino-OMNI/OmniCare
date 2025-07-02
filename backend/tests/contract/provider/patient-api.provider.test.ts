/**
 * Provider Contract Verification Tests
 * Verifies that the API implementation meets consumer expectations
 */

import path from 'path';

import { Verifier } from '@pact-foundation/pact';

import { startServer, stopServer } from '../../../src/index';
import { DatabaseService } from '../../../src/services/database.service';
import { createMockPatient } from '../../setup';
import { pactConfig, verificationOptions } from '../pact.config';

describe('Patient API Provider Contract Verification', () => {
  let server: any;
  let db: DatabaseService;
  const PORT = 4001;

  beforeAll(async () => {
    // Start the provider API server
    process.env.PORT = String(PORT);
    server = await startServer();
    db = new DatabaseService();
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
    await stopServer(server);
  });

  // State handlers for different test scenarios
  const stateHandlers = {
    'A patient exists': async () => {
      // Create test patient in database
      const patient = createMockPatient();
      patient.id = 'patient-123';
      await db.query(
        `INSERT INTO patients (id, data, created_at, updated_at) 
         VALUES ($1, $2, NOW(), NOW())`,
        [patient.id, JSON.stringify(patient)]
      );
    },
    'No patients exist': async () => {
      // Clear all patients from database
      await db.query('DELETE FROM patients');
    },
    'Multiple patients exist': async () => {
      // Create multiple test patients
      const patients = Array.from({ length: 25 }, (_, i) => ({
        ...createMockPatient(),
        id: `patient-${i + 1}`,
        name: [{ family: 'Doe', given: [`Test${i + 1}`] }],
      }));

      for (const patient of patients) {
        await db.query(
          `INSERT INTO patients (id, data, created_at, updated_at) 
           VALUES ($1, $2, NOW(), NOW())`,
          [patient.id, JSON.stringify(patient)]
        );
      }
    },
    'Patients with name John exist': async () => {
      // Create patients with name John
      const johnPatients = Array.from({ length: 5 }, (_, i) => ({
        ...createMockPatient(),
        id: `john-patient-${i + 1}`,
        name: [{ family: 'Doe', given: ['John'] }],
        gender: 'male',
      }));

      for (const patient of johnPatients) {
        await db.query(
          `INSERT INTO patients (id, data, created_at, updated_at) 
           VALUES ($1, $2, NOW(), NOW())`,
          [patient.id, JSON.stringify(patient)]
        );
      }
    },
    'Provider is ready to create patients': async () => {
      // Ensure database is ready for patient creation
      await db.query('SELECT 1');
    },
    'User is authenticated': async () => {
      // Mock authentication state
      // This would be handled by middleware in actual implementation
    },
  };

  describe('Pact Verification', () => {
    it('should validate the provider against consumer contracts', async () => {
      const opts = {
        ...verificationOptions,
        providerBaseUrl: `http://localhost:${PORT}`,
        pactUrls: [
          path.resolve(__dirname, '../../../pacts/OmniCare-Frontend-OmniCare-API.json'),
        ],
        stateHandlers,
        beforeEach: async () => {
          // Clear database before each interaction
          await db.query('TRUNCATE TABLE patients CASCADE');
          console.log('Database cleared');
        },
        requestFilter: (req: any, res: any, next: any) => {
          // Add authentication headers if not present
          if (!req.headers.authorization) {
            req.headers.authorization = 'Bearer test-provider-token';
          }
          next();
        },
      };

      const verifier = new Verifier(opts);
      await verifier.verifyProvider();
    });
  });

  describe('Pact Broker Verification', () => {
    it('should validate against contracts from Pact Broker', async () => {
      if (!process.env.PACT_BROKER_URL) {
        console.warn('Skipping Pact Broker verification - PACT_BROKER_URL not set');
        return;
      }

      const opts = {
        ...verificationOptions,
        providerBaseUrl: `http://localhost:${PORT}`,
        pactBrokerUrl: pactConfig.pactBroker.brokerUrl,
        pactBrokerUsername: pactConfig.pactBroker.brokerUsername,
        pactBrokerPassword: pactConfig.pactBroker.brokerPassword,
        publishVerificationResult: true,
        providerVersion: pactConfig.provider.providerVersion,
        stateHandlers,
        beforeEach: async () => {
          await db.query('TRUNCATE TABLE patients CASCADE');
        },
        // Verify contracts with specific tags
        consumerVersionSelectors: [
          { tag: 'prod', latest: true },
          { tag: 'test', latest: true },
        ],
        // Include work-in-progress pacts
        enablePending: true,
        includeWipPactsSince: pactConfig.provider.includeWipPactsSince,
      };

      const verifier = new Verifier(opts);
      await verifier.verifyProvider();
    });
  });

  describe('Webhook Verification', () => {
    it('should verify contracts on webhook trigger', async () => {
      const webhookData = {
        consumerVersionSelectors: [
          {
            tag: 'feat/new-feature',
            latest: true,
          },
        ],
      };

      const opts = {
        ...verificationOptions,
        providerBaseUrl: `http://localhost:${PORT}`,
        pactBrokerUrl: pactConfig.pactBroker.brokerUrl,
        pactBrokerUsername: pactConfig.pactBroker.brokerUsername,
        pactBrokerPassword: pactConfig.pactBroker.brokerPassword,
        consumerVersionSelectors: webhookData.consumerVersionSelectors,
        stateHandlers,
        publishVerificationResult: true,
        providerVersion: `${pactConfig.provider.providerVersion}-${Date.now()}`,
      };

      const verifier = new Verifier(opts);
      await verifier.verifyProvider();
    });
  });
});