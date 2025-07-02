/**
 * Shared type definitions between frontend and backend
 * These types should be kept in sync between both environments
 */

import { Patient, Practitioner, Encounter, Observation, Condition } from '@medplum/fhirtypes';

// User and Authentication Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: Permission[];
  isMfaEnabled: boolean;
  passwordChangedAt: Date;
  failedLoginAttempts: number;
  isActive?: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserRole = 
  | 'super_admin'
  | 'admin'
  | 'physician'
  | 'nurse'
  | 'practitioner'
  | 'staff'
  | 'patient'
  | 'readonly';

export type Permission = 
  | 'read_patients'
  | 'write_patients'
  | 'delete_patients'
  | 'read_encounters'
  | 'write_encounters'
  | 'delete_encounters'
  | 'read_observations'
  | 'write_observations'
  | 'delete_observations'
  | 'read_conditions'
  | 'write_conditions'
  | 'delete_conditions'
  | 'read_medications'
  | 'write_medications'
  | 'delete_medications'
  | 'read_reports'
  | 'write_reports'
  | 'admin_users'
  | 'admin_system'
  | 'admin_audit';

// Enhanced FHIR types with additional properties
export interface EnhancedPatient extends Patient {
  // Additional fields for internal use
  _internal?: {
    cacheTimestamp?: string;
    syncStatus?: SyncStatus;
    conflicts?: ConflictResolution[];
  };
}

export interface EnhancedPractitioner extends Practitioner {
  _internal?: {
    permissions?: Permission[];
    lastSeen?: string;
  };
}

export interface EnhancedEncounter extends Encounter {
  _internal?: {
    workflow?: WorkflowStatus;
    priority?: Priority;
  };
}

// Sync and Offline Types
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error' | 'offline';

export interface SyncOperation {
  id: string;
  resourceType: string;
  resourceId: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: string;
  status: SyncStatus;
  retryCount: number;
  error?: string;
}

export interface ConflictResolution {
  id: string;
  resourceType: string;
  resourceId: string;
  localVersion: any;
  remoteVersion: any;
  resolution?: 'local' | 'remote' | 'merge' | 'pending';
  resolvedAt?: string;
  resolvedBy?: string;
}

// Workflow Types
export type WorkflowStatus = 
  | 'draft'
  | 'active'
  | 'on-hold'
  | 'revoked'
  | 'completed'
  | 'entered-in-error'
  | 'unknown';

export type Priority = 'routine' | 'urgent' | 'asap' | 'stat';

export interface ClinicalWorkflow {
  id: string;
  title: string;
  description?: string;
  status: WorkflowStatus;
  priority: Priority;
  assignedTo?: string[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
  metadata?: Record<string, any>;
}

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  assignedTo?: string;
  dueDate?: string;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

// Clinical Note Types
export interface ClinicalNote {
  id: string;
  patientId: string;
  encounterId?: string;
  authorId: string;
  title: string;
  content: string;
  type: ClinicalNoteType;
  status: 'draft' | 'final' | 'amended' | 'corrected';
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  attachments?: Attachment[];
  template?: string;
  metadata?: Record<string, any>;
  // Offline support
  _offline?: {
    localId?: string;
    syncStatus: SyncStatus;
    lastSyncAt?: string;
    conflicts?: any[];
  };
}

export type ClinicalNoteType = 
  | 'progress-note'
  | 'admission-note'
  | 'discharge-summary'
  | 'operative-note'
  | 'consultation-note'
  | 'nursing-note'
  | 'assessment'
  | 'plan'
  | 'other';

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
  data?: string; // Base64 encoded for offline
  uploadedAt: string;
  uploadedBy: string;
}

// Search and Filter Types
export interface SearchFilters {
  query?: string;
  resourceType?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  status?: string[];
  assignedTo?: string[];
  priority?: Priority[];
  tags?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult<T = any> {
  results: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  filters: SearchFilters;
  executedAt: string;
}

// Analytics and Reporting Types
export interface DashboardMetrics {
  totalPatients: number;
  activeEncounters: number;
  pendingTasks: number;
  urgentItems: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  lastUpdated: string;
  trends?: {
    patients: TrendData;
    encounters: TrendData;
    tasks: TrendData;
  };
}

export interface TrendData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  direction: 'up' | 'down' | 'stable';
}

// Error and Validation Types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface FormValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

// Cache and Storage Types
export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: string;
  expiresAt?: string;
  version?: string;
  tags?: string[];
}

export interface StorageQuota {
  usage: number;
  quota: number;
  available: number;
  percentUsed: number;
}

// Network and Connectivity Types
export type NetworkStatus = 'online' | 'offline' | 'slow' | 'reconnecting';

export interface NetworkInfo {
  status: NetworkStatus;
  effectiveType?: '2g' | '3g' | '4g' | '5g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  lastChecked: string;
}

// Test and Mock Types
export interface MockData {
  patients?: EnhancedPatient[];
  practitioners?: EnhancedPractitioner[];
  encounters?: EnhancedEncounter[];
  observations?: Observation[];
  conditions?: Condition[];
  notes?: ClinicalNote[];
  workflows?: ClinicalWorkflow[];
}

export interface TestContext {
  user: User;
  mockData: MockData;
  networkStatus: NetworkStatus;
  permissions: Permission[];
  isOffline?: boolean;
}

// API Integration Types
export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export interface APIResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  timestamp: string;
  duration: number;
}

// Export all types as a module
export * from '@medplum/fhirtypes';