/**
 * Synchronization Types for OmniCare EMR - Frontend Re-exports
 * 
 * Re-exports shared synchronization types for frontend usage.
 */

// Re-export all sync types from shared types
export type {
  DataConflict,
  ConflictResolution,
  SyncOptions,
  SyncResult,
  OfflineChange,
  CacheEntry,
  SyncResourceData,
  ConflictResolutionData
} from '../../../../shared/types/sync.types';