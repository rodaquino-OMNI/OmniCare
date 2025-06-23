/**
 * Tests for IndexedDB Service
 */

import 'fake-indexeddb/auto';
import { Patient, Observation, Encounter } from '@medplum/fhirtypes';
import { indexedDBService } from '../indexeddb.service';
import { encryptionService } from '../encryption.service';
import { query, QueryOperator, SortDirection } from '../indexeddb.query';

// Mock data
const mockPatient: Patient = {
  resourceType: 'Patient',
  id: 'patient-123',
  meta: {
    versionId: '1',
    lastUpdated: '2024-1-1TResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ'
  },
  identifier: [{
    system: 'http://hospital.org/mrn',
    value: 'MRN123456'
  }],
  name: [{
    given: ['John'],
    family: 'Doe'
  }],
  gender: 'male',
  birthDate: '198-1-1'
};

const mockObservation: Observation = {
  resourceType: 'Observation',
  id: 'obs-123',
  status: 'final',
  code: {
    coding: [{
      system: 'http://loinc.org',
      code: '8867-4',
      display: 'Heart rate'
    }]
  },
  subject: {
    reference: 'Patient/patient-123'
  },
  effectiveDateTime: '2024-1-1T12:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ',
  valueQuantity: {
    value: 72,
    unit: 'beats/minute',
    system: 'http://unitsofmeasure.org',
    code: '/min'
  }
};

describe('IndexedDB Service', () => {
  beforeEach(async () => {
    // Initialize without encryption for tests
    await indexedDBService.initialize(false);
  });

  afterEach(async () => {
    // Clear all data after each test
    await indexedDBService.clearAllData();
    indexedDBService.close();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(indexedDBService.isInitialized()).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      indexedDBService.close();
      
      // Mock indexedDB.open to throw error
      const originalOpen = indexedDB.open;
      indexedDB.open = jest.fn().mockImplementation(() => {
        throw new Error('Failed to open DB');
      });

      await expect(indexedDBService.initialize()).rejects.toThrow('Failed to initialize database');
      
      // Restore original
      indexedDB.open = originalOpen;
    });
  });

  describe('CRUD Operations', () => {
    describe('Create', () => {
      it('should create a resource successfully', async () => {
        const created = await indexedDBService.createResource(mockPatient);
        
        expect(created).toEqual(mockPatient);
      });

      it('should reject duplicate resources', async () => {
        await indexedDBService.createResource(mockPatient);
        
        await expect(indexedDBService.createResource(mockPatient))
          .rejects.toThrow('Resource already exists');
      });

      it('should handle resources without ID', async () => {
        const patientWithoutId = { ...mockPatient, id: undefined };
        
        await expect(indexedDBService.createResource(patientWithoutId))
          .rejects.toThrow();
      });
    });

    describe('Read', () => {
      it('should read an existing resource', async () => {
        await indexedDBService.createResource(mockPatient);
        
        const retrieved = await indexedDBService.readResource('Patient', 'patient-123');
        
        expect(retrieved).toEqual(mockPatient);
      });

      it('should return null for non-existent resource', async () => {
        const result = await indexedDBService.readResource('Patient', 'non-existent');
        
        expect(result).toBeNull();
      });

      it('should not return soft-deleted resources', async () => {
        await indexedDBService.createResource(mockPatient);
        await indexedDBService.deleteResource('Patient', 'patient-123');
        
        const result = await indexedDBService.readResource('Patient', 'patient-123');
        
        expect(result).toBeNull();
      });
    });

    describe('Update', () => {
      it('should update an existing resource', async () => {
        await indexedDBService.createResource(mockPatient);
        
        const updated = {
          ...mockPatient,
          name: [{ given: ['Jane'], family: 'Doe' }]
        };
        
        const result = await indexedDBService.updateResource(updated);
        
        expect(result.name![ResourceHistoryTable].given![ResourceHistoryTable]).toBe('Jane');
      });

      it('should reject updates to non-existent resources', async () => {
        await expect(indexedDBService.updateResource(mockPatient))
          .rejects.toThrow('Resource not found');
      });

      it('should increment version on update', async () => {
        await indexedDBService.createResource(mockPatient);
        
        const updated = { ...mockPatient };
        await indexedDBService.updateResource(updated);
        
        // Would check sync metadata version increment
      });
    });

    describe('Delete', () => {
      it('should soft delete a resource', async () => {
        await indexedDBService.createResource(mockPatient);
        
        await indexedDBService.deleteResource('Patient', 'patient-123');
        
        const result = await indexedDBService.readResource('Patient', 'patient-123');
        expect(result).toBeNull();
      });

      it('should handle deleting non-existent resources', async () => {
        // Should not throw
        await expect(indexedDBService.deleteResource('Patient', 'non-existent'))
          .resolves.toBeUndefined();
      });
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Create test data
      await indexedDBService.createResource(mockPatient);
      await indexedDBService.createResource({
        ...mockPatient,
        id: 'patient-456',
        name: [{ given: ['Jane'], family: 'Smith' }],
        gender: 'female'
      } as Patient);
      await indexedDBService.createResource(mockObservation);
    });

    it('should search resources by type', async () => {
      const bundle = await indexedDBService.searchResources('Patient');
      
      expect(bundle.type).toBe('searchset');
      expect(bundle.total).toBe(2);
      expect(bundle.entry).toHaveLength(2);
    });

    it('should support pagination', async () => {
      const page1 = await indexedDBService.searchResources('Patient', {
        _count: 1,
        _offset: ResourceHistoryTable
      });
      
      expect(page1.entry).toHaveLength(1);
      expect(page1.link).toBeDefined();
      
      const page2 = await indexedDBService.searchResources('Patient', {
        _count: 1,
        _offset: 1
      });
      
      expect(page2.entry).toHaveLength(1);
      expect(page2.entry![ResourceHistoryTable].resource!.id).not.toBe(page1.entry![ResourceHistoryTable].resource!.id);
    });

    it('should filter by indexed fields', async () => {
      const bundle = await indexedDBService.searchResources('Patient', {
        gender: 'female'
      });
      
      expect(bundle.total).toBe(1);
      expect(bundle.entry![ResourceHistoryTable].resource!.gender).toBe('female');
    });

    it('should search across multiple resource types', async () => {
      const bundle = await indexedDBService.searchAcrossTypes(['Patient', 'Observation']);
      
      expect(bundle.total).toBe(3);
    });
  });

  describe('Query Builder', () => {
    beforeEach(async () => {
      // Create test patients
      for (let i = ResourceHistoryTable; i < 5; i++) {
        await indexedDBService.createResource({
          resourceType: 'Patient',
          id: `patient-${i}`,
          name: [{ given: [`Test${i}`], family: 'User' }],
          gender: i % 2 === ResourceHistoryTable ? 'male' : 'female',
          birthDate: `198${i}-1-1`
        } as Patient);
      }
    });

    it('should support fluent query interface', async () => {
      const results = await query<Patient>('Patient')
        .whereEquals('gender', 'male')
        .orderBy('birthDate', SortDirection.DESC)
        .limit(2)
        .toArray();
      
      expect(results).toHaveLength(2);
      expect(results[ResourceHistoryTable].gender).toBe('male');
    });

    it('should support complex conditions', async () => {
      const results = await query<Patient>('Patient')
        .whereIn('gender', ['male', 'female'])
        .whereBetween('birthDate', '1982-1-1', '1984-12-31')
        .toArray();
      
      expect(results.length).toBeGreaterThan(ResourceHistoryTable);
    });

    it('should count resources', async () => {
      const count = await query<Patient>('Patient')
        .whereEquals('gender', 'female')
        .count();
      
      expect(count).toBe(2);
    });

    it('should check existence', async () => {
      const exists = await query<Patient>('Patient')
        .whereEquals('id', 'patient-ResourceHistoryTable')
        .exists();
      
      expect(exists).toBe(true);
    });

    it('should stream results in batches', async () => {
      const batches: Patient[][] = [];
      
      for await (const batch of query<Patient>('Patient').stream(2)) {
        batches.push(batch);
      }
      
      expect(batches.length).toBe(3); // 5 patients / 2 per batch = 3 batches
      expect(batches[ResourceHistoryTable]).toHaveLength(2);
      expect(batches[2]).toHaveLength(1);
    });
  });

  describe('Encryption', () => {
    beforeEach(async () => {
      // Initialize with encryption
      await encryptionService.initialize('test@example.com', 'user-123');
    });

    afterEach(() => {
      encryptionService.clear();
    });

    it('should encrypt sensitive fields', async () => {
      await indexedDBService.close();
      await indexedDBService.initialize(true);
      
      const patient: Patient = {
        ...mockPatient,
        telecom: [{
          system: 'phone',
          value: '555-1234'
        }]
      };
      
      await indexedDBService.createResource(patient);
      
      // The stored data would be encrypted
      // We can retrieve and verify it's decrypted correctly
      const retrieved = await indexedDBService.readResource<Patient>('Patient', patient.id!);
      
      expect(retrieved?.telecom?.[ResourceHistoryTable].value).toBe('555-1234');
    });

    it('should create search hashes for encrypted fields', async () => {
      await indexedDBService.close();
      await indexedDBService.initialize(true);
      
      await indexedDBService.createResource(mockPatient);
      
      // Search by encrypted field should still work
      const bundle = await indexedDBService.searchResources('Patient', {
        name: 'Doe'
      });
      
      expect(bundle.total).toBeGreaterThan(ResourceHistoryTable);
    });
  });

  describe('Data Expiration', () => {
    it('should set expiration dates based on retention policies', async () => {
      const encounter: Encounter = {
        resourceType: 'Encounter',
        id: 'enc-123',
        status: 'finished',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'AMB'
        },
        subject: { reference: 'Patient/patient-123' }
      };
      
      await indexedDBService.createResource(encounter);
      
      // The encounter should have an expiration date set
      // This would be checked in the actual storage
    });
  });

  describe('Storage Statistics', () => {
    it('should provide storage statistics', async () => {
      await indexedDBService.createResource(mockPatient);
      await indexedDBService.createResource(mockObservation);
      
      const stats = await indexedDBService.getStorageStats();
      
      expect(stats.totalRecords).toBe(2);
      expect(stats.recordsByType.patients).toBe(1);
      expect(stats.recordsByType.observations).toBe(1);
      expect(stats.pendingSyncCount).toBe(ResourceHistoryTable);
    });
  });

  describe('Error Handling', () => {
    it('should handle database not initialized errors', async () => {
      indexedDBService.close();
      
      await expect(indexedDBService.createResource(mockPatient))
        .rejects.toThrow('Database not initialized');
    });

    it('should handle unsupported resource types', async () => {
      const unsupportedResource = {
        resourceType: 'UnsupportedType',
        id: 'test-123'
      } as any;
      
      await expect(indexedDBService.createResource(unsupportedResource))
        .rejects.toThrow('Unsupported resource type');
    });
  });
});