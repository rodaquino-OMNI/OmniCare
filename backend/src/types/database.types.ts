import type { Resource } from '@medplum/fhirtypes';
import { QueryResultRow } from 'pg';

import type { 
  SyncResourceData as SharedSyncResourceData,
  ConflictResolutionData as SharedConflictResolutionData
} from '../../../../shared/types/sync.types';

import type { UserRole } from './auth.types';

// Import shared sync types

// Database query parameter types
export type QueryParameterValue = string | number | boolean | Date | null | undefined;
export type QueryParameters = QueryParameterValue[];

// Filter types for database queries
type DatabaseFilterValue = string | number | boolean | Date | null | undefined;
export type DatabaseFilters = Record<string, DatabaseFilterValue>;

// Re-export sync types
export type SyncResourceData = SharedSyncResourceData;
export type ConflictResolutionData = SharedConflictResolutionData;

// Bundle entry type
export interface BundleEntryResource {
  resource: Resource;
  request?: {
    method: string;
    url: string;
  };
  response?: {
    status: string;
    location?: string;
  };
}

// OAuth client type
export interface OAuthClient extends QueryResultRow {
  id: string;
  client_id: string;
  client_secret: string;
  allowed_scopes: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Database user type
export interface DatabaseUser extends QueryResultRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}