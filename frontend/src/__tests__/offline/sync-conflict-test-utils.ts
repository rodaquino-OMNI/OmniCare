// Sync and Conflict Resolution Testing Utilities
// Using Jest - vi is not needed, jest.fn() is available globally

// Type definitions for testing (avoiding import issues)
interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string; 
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  phone?: string;
  email?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  allergies: Array<{
    id: string;
    substance: string;
    reaction: string;
    severity: 'mild' | 'moderate' | 'severe';
    onset?: string;
  }>;
  insurance: any[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

interface Encounter {
  id: string;
  patientId: string;
  type: 'inpatient' | 'outpatient' | 'emergency' | 'telemedicine';
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  startTime: string;
  endTime?: string;
  providerId: string;
  departmentId: string;
  chiefComplaint?: string;
  notes?: string;
  diagnosis: Array<{
    id: string;
    code: string;
    description: string;
    type: 'primary' | 'secondary';
    status: 'active' | 'resolved';
  }>;
  procedures: Array<{
    id: string;
    code: string;
    description: string;
    performedDate: string;
    performerId: string;
    status: 'completed' | 'cancelled';
  }>;
}

interface VitalSigns {
  id: string;
  patientId: string;
  recordedBy: string;
  recordedDate: string;
  temperature?: { value: number; unit: 'fahrenheit' | 'celsius' };
  bloodPressure?: { systolic: number; diastolic: number; unit: 'mmHg' };
  heartRate?: { value: number; unit: 'bpm' };
  respiratoryRate?: { value: number; unit: 'bpm' };
  oxygenSaturation?: { value: number; unit: '%' };
}

export interface SyncConflict<T = any> {
  id: string;
  resourceType: string;
  localVersion: T;
  serverVersion: T;
  baseVersion?: T;
  conflictType: 'create' | 'update' | 'delete';
  timestamp: string;
  resolution?: 'local' | 'server' | 'merge' | 'manual';
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  resourceType: string;
  resource: any;
  timestamp: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict';
  retryCount: number;
  error?: string;
}

export interface MergeStrategy {
  name: string;
  canHandle: (conflict: SyncConflict) => boolean;
  resolve: (conflict: SyncConflict) => Promise<any>;
}

export class SyncConflictSimulator {
  private conflicts: Map<string, SyncConflict> = new Map();
  private syncQueue: SyncOperation[] = [];
  private mergeStrategies: MergeStrategy[] = [];
  private conflictHandlers: Map<string, (conflict: SyncConflict) => any> = new Map();

  // Add a conflict
  addConflict(conflict: SyncConflict): void {
    this.conflicts.set(conflict.id, conflict);
  }

  // Create a realistic patient conflict
  createPatientConflict(patientId: string): SyncConflict<Patient> {
    const basePatient: Patient = {
      id: patientId,
      mrn: 'MRN123456',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '199-1-1',
      gender: 'male',
      phone: '555-10',
      email: 'john.doe@example.com',
      address: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'NY',
        zipCode: '12345',
        country: 'USA'
      },
      allergies: [],
      insurance: [],
      status: 'active',
      createdAt: '2024-1-1TResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ',
      updatedAt: '2024-1-1TResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ'
    };

    const localVersion: Patient = {
      ...basePatient,
      phone: '555-123', // Local change
      address: {
        ...basePatient.address!,
        street: '456 Oak Ave' // Local change
      },
      updatedAt: '2024-1-2T10:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ'
    };

    const serverVersion: Patient = {
      ...basePatient,
      email: 'johndoe@newmail.com', // Server change
      allergies: [{
        id: 'allergy-1',
        substance: 'Penicillin',
        reaction: 'Rash',
        severity: 'moderate',
        onset: '2024-1-2T8:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ'
      }],
      updatedAt: '2024-1-2T9:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ'
    };

    const conflict: SyncConflict<Patient> = {
      id: `conflict-${patientId}`,
      resourceType: 'Patient',
      localVersion,
      serverVersion,
      baseVersion: basePatient,
      conflictType: 'update',
      timestamp: new Date().toISOString()
    };

    this.addConflict(conflict);
    return conflict;
  }

  // Create encounter conflict
  createEncounterConflict(encounterId: string): SyncConflict<Encounter> {
    const baseEncounter: Encounter = {
      id: encounterId,
      patientId: 'patient-123',
      type: 'outpatient',
      status: 'in-progress',
      startTime: '2024-1-2T14:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ',
      providerId: 'provider-456',
      departmentId: 'dept-789',
      chiefComplaint: 'Annual checkup',
      diagnosis: [],
      procedures: []
    };

    const localVersion: Encounter = {
      ...baseEncounter,
      status: 'completed',
      endTime: '2024-1-2T15:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ',
      notes: 'Patient doing well, follow up in 6 months',
      diagnosis: [{
        id: 'diag-1',
        code: 'ZResourceHistoryTableResourceHistoryTable.ResourceHistoryTableResourceHistoryTable',
        description: 'Encounter for general adult medical examination',
        type: 'primary',
        status: 'active'
      }]
    };

    const serverVersion: Encounter = {
      ...baseEncounter,
      procedures: [{
        id: 'proc-1',
        code: '99213',
        description: 'Office visit, established patient',
        performedDate: '2024-1-2T14:3:ResourceHistoryTableResourceHistoryTableZ',
        performerId: 'provider-456',
        status: 'completed'
      }]
    };

    const conflict: SyncConflict<Encounter> = {
      id: `conflict-${encounterId}`,
      resourceType: 'Encounter',
      localVersion,
      serverVersion,
      baseVersion: baseEncounter,
      conflictType: 'update',
      timestamp: new Date().toISOString()
    };

    this.addConflict(conflict);
    return conflict;
  }

  // Create vital signs conflict
  createVitalSignsConflict(vitalId: string): SyncConflict<VitalSigns> {
    const baseVitals: VitalSigns = {
      id: vitalId,
      patientId: 'patient-123',
      recordedBy: 'nurse-789',
      recordedDate: '2024-01-02T14:15:00Z',
      temperature: { value: 98.6, unit: 'fahrenheit' },
      bloodPressure: { systolic: 120, diastolic: 80, unit: 'mmHg' },
      heartRate: { value: 72, unit: 'bpm' }
    };

    const localVersion: VitalSigns = {
      ...baseVitals,
      temperature: { value: 99.1, unit: 'fahrenheit' }, // Local update
      oxygenSaturation: { value: 98, unit: '%' } // Local addition
    };

    const serverVersion: VitalSigns = {
      ...baseVitals,
      heartRate: { value: 75, unit: 'bpm' }, // Server update
      respiratoryRate: { value: 16, unit: 'bpm' } // Server addition
    };

    const conflict: SyncConflict<VitalSigns> = {
      id: `conflict-${vitalId}`,
      resourceType: 'VitalSigns',
      localVersion,
      serverVersion,
      baseVersion: baseVitals,
      conflictType: 'update',
      timestamp: new Date().toISOString()
    };

    this.addConflict(conflict);
    return conflict;
  }

  // Create delete conflict
  createDeleteConflict(resourceType: string, resourceId: string): SyncConflict {
    const conflict: SyncConflict = {
      id: `conflict-delete-${resourceId}`,
      resourceType,
      localVersion: null, // Deleted locally
      serverVersion: { id: resourceId, updated: true }, // Updated on server
      conflictType: 'delete',
      timestamp: new Date().toISOString()
    };

    this.addConflict(conflict);
    return conflict;
  }

  // Add sync operation to queue
  queueSyncOperation(operation: Omit<SyncOperation, 'id' | 'status' | 'retryCount'>): SyncOperation {
    const syncOp: SyncOperation = {
      ...operation,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      retryCount: ResourceHistoryTable
    };

    this.syncQueue.push(syncOp);
    return syncOp;
  }

  // Process sync queue
  async processSyncQueue(): Promise<Map<string, SyncOperation>> {
    const results = new Map<string, SyncOperation>();

    for (const operation of this.syncQueue) {
      operation.status = 'syncing';
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check for conflicts
      const hasConflict = Math.random() < 0.3; // 30% chance of conflict
      
      if (hasConflict && operation.type === 'update') {
        operation.status = 'conflict';
        const conflict = this.createRandomConflict(operation.resourceType, operation.resource.id);
        operation.error = `Conflict detected: ${conflict.id}`;
      } else if (Math.random() < 0.1) { // 10% chance of failure
        operation.status = 'failed';
        operation.error = 'Network error';
        operation.retryCount++;
      } else {
        operation.status = 'completed';
      }

      results.set(operation.id, operation);
    }

    return results;
  }

  // Create random conflict based on resource type
  private createRandomConflict(resourceType: string, resourceId: string): SyncConflict {
    switch (resourceType) {
      case 'Patient':
        return this.createPatientConflict(resourceId);
      case 'Encounter':
        return this.createEncounterConflict(resourceId);
      case 'VitalSigns':
        return this.createVitalSignsConflict(resourceId);
      default:
        return {
          id: `conflict-${resourceId}`,
          resourceType,
          localVersion: { id: resourceId, data: 'local' },
          serverVersion: { id: resourceId, data: 'server' },
          conflictType: 'update',
          timestamp: new Date().toISOString()
        };
    }
  }

  // Register merge strategy
  registerMergeStrategy(strategy: MergeStrategy): void {
    this.mergeStrategies.push(strategy);
  }

  // Resolve conflict
  async resolveConflict(conflictId: string, resolution: 'local' | 'server' | 'merge' | 'manual'): Promise<any> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    conflict.resolution = resolution;

    switch (resolution) {
      case 'local':
        return conflict.localVersion;
      
      case 'server':
        return conflict.serverVersion;
      
      case 'merge':
        // Try registered merge strategies
        for (const strategy of this.mergeStrategies) {
          if (strategy.canHandle(conflict)) {
            return await strategy.resolve(conflict);
          }
        }
        // Fallback to simple merge
        return this.simpleMerge(conflict);
      
      case 'manual':
        // Check if manual handler is registered
        const handler = this.conflictHandlers.get(conflict.resourceType);
        if (handler) {
          return handler(conflict);
        }
        throw new Error('Manual resolution requested but no handler registered');
    }
  }

  // Simple merge strategy
  private simpleMerge(conflict: SyncConflict): any {
    if (!conflict.localVersion || !conflict.serverVersion) {
      return conflict.serverVersion || conflict.localVersion;
    }

    // For objects, merge properties with timestamps
    if (typeof conflict.localVersion === 'object' && typeof conflict.serverVersion === 'object') {
      const merged = { ...conflict.serverVersion };
      
      // Apply local changes that are newer
      for (const key in conflict.localVersion) {
        if (conflict.localVersion[key] !== conflict.baseVersion?.[key]) {
          merged[key] = conflict.localVersion[key];
        }
      }
      
      return merged;
    }

    // For primitives, prefer server version
    return conflict.serverVersion;
  }

  // Register conflict handler
  registerConflictHandler(resourceType: string, handler: (conflict: SyncConflict) => any): void {
    this.conflictHandlers.set(resourceType, handler);
  }

  // Get all conflicts
  getConflicts(): SyncConflict[] {
    return Array.from(this.conflicts.values());
  }

  // Get conflicts by type
  getConflictsByType(resourceType: string): SyncConflict[] {
    return this.getConflicts().filter(c => c.resourceType === resourceType);
  }

  // Clear all data
  clear(): void {
    this.conflicts.clear();
    this.syncQueue = [];
    this.mergeStrategies = [];
    this.conflictHandlers.clear();
  }
}

// Default merge strategies
export const defaultMergeStrategies: MergeStrategy[] = [
  {
    name: 'LastWriteWins',
    canHandle: () => true,
    resolve: async (conflict) => {
      // Compare timestamps if available
      const localTime = conflict.localVersion?.updatedAt || conflict.timestamp;
      const serverTime = conflict.serverVersion?.updatedAt || conflict.timestamp;
      
      return new Date(localTime) > new Date(serverTime) 
        ? conflict.localVersion 
        : conflict.serverVersion;
    }
  },
  {
    name: 'PatientDataMerge',
    canHandle: (conflict) => conflict.resourceType === 'Patient',
    resolve: async (conflict) => {
      const local = conflict.localVersion as Patient;
      const server = conflict.serverVersion as Patient;
      const base = conflict.baseVersion as Patient;

      // Merge patient data intelligently
      return {
        ...server,
        // Keep local changes that differ from base
        phone: local.phone !== base?.phone ? local.phone : server.phone,
        email: local.email !== base?.email ? local.email : server.email,
        address: local.address !== base?.address ? local.address : server.address,
        // Always take server allergies (safety critical)
        allergies: server.allergies,
        // Merge insurance
        insurance: [...new Set([...local.insurance, ...server.insurance])],
        updatedAt: new Date().toISOString()
      };
    }
  },
  {
    name: 'VitalSignsMerge',
    canHandle: (conflict) => conflict.resourceType === 'VitalSigns',
    resolve: async (conflict) => {
      const local = conflict.localVersion as VitalSigns;
      const server = conflict.serverVersion as VitalSigns;

      // Merge all vital signs, keeping all measurements
      return {
        ...server,
        ...local,
        // Ensure we have the latest of each measurement
        temperature: local.temperature || server.temperature,
        bloodPressure: local.bloodPressure || server.bloodPressure,
        heartRate: local.heartRate || server.heartRate,
        respiratoryRate: local.respiratoryRate || server.respiratoryRate,
        oxygenSaturation: local.oxygenSaturation || server.oxygenSaturation,
        recordedDate: new Date().toISOString()
      };
    }
  }
];

// Helper to create sync test scenario
export function createSyncTestScenario() {
  const simulator = new SyncConflictSimulator();
  
  // Register default strategies
  defaultMergeStrategies.forEach(strategy => {
    simulator.registerMergeStrategy(strategy);
  });

  // Create sample data
  const patientConflict = simulator.createPatientConflict('patient-123');
  const encounterConflict = simulator.createEncounterConflict('encounter-456');
  const vitalConflict = simulator.createVitalSignsConflict('vital-789');
  const deleteConflict = simulator.createDeleteConflict('Medication', 'med-123');

  // Queue some sync operations
  simulator.queueSyncOperation({
    type: 'update',
    resourceType: 'Patient',
    resource: { id: 'patient-123', firstName: 'Jane' },
    timestamp: new Date().toISOString()
  });

  simulator.queueSyncOperation({
    type: 'create',
    resourceType: 'Encounter',
    resource: { patientId: 'patient-123', type: 'telemedicine' },
    timestamp: new Date().toISOString()
  });

  return {
    simulator,
    conflicts: {
      patient: patientConflict,
      encounter: encounterConflict,
      vital: vitalConflict,
      delete: deleteConflict
    }
  };
}

// Helper to test conflict resolution UI
export function mockConflictResolutionUI() {
  return {
    showConflictDialog: jest.fn().mockResolvedValue('merge'),
    showMergeEditor: jest.fn().mockResolvedValue({ merged: true }),
    confirmDelete: jest.fn().mockResolvedValue(true),
    notifyConflictResolved: jest.fn()
  };
}