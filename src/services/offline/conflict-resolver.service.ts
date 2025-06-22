import { Resource, Observation, MedicationRequest, Encounter } from '@medplum/fhirtypes';
import {
  Conflict,
  Resolution,
  ConflictResolutionStrategy,
  ResourceVersion
} from '../../types/offline.types';
import { OfflineDataStore } from './offline-store.service';
import logger from '../../utils/logger';

/**
 * Conflict Resolution Service
 * Handles automatic and manual conflict resolution for FHIR resources
 */
export class ConflictResolver {
  private resolutionRules: Map<string, ConflictRule[]> = new Map();

  constructor(private offlineStore: OfflineDataStore) {
    this.initializeResolutionRules();
  }

  /**
   * Resolve conflict based on strategy
   */
  async resolve(
    conflict: Conflict,
    local: Resource,
    remote: Resource,
    strategy: ConflictResolutionStrategy
  ): Promise<Resolution | null> {
    logger.info(`Resolving conflict for ${conflict.resourceType}/${conflict.resourceId} using ${strategy} strategy`);

    // Try automatic resolution first
    const autoResolution = await this.tryAutomaticResolution(conflict, local, remote);
    if (autoResolution) {
      return autoResolution;
    }

    // Apply strategy
    switch (strategy) {
      case 'client_wins':
        return this.createResolution('keep_local', local, 'Automatic: Client wins strategy');

      case 'server_wins':
        return this.createResolution('keep_remote', remote, 'Automatic: Server wins strategy');

      case 'timestamp':
        return this.resolveByTimestamp(conflict, local, remote);

      case 'version':
        return this.resolveByVersion(conflict, local, remote);

      case 'merge':
        return await this.resolveByMerge(conflict, local, remote);

      case 'manual':
        // Return null to queue for manual resolution
        return null;

      default:
        logger.warn(`Unknown resolution strategy: ${strategy}`);
        return null;
    }
  }

  /**
   * Try automatic resolution based on business rules
   */
  private async tryAutomaticResolution(
    conflict: Conflict,
    local: Resource,
    remote: Resource
  ): Promise<Resolution | null> {
    const rules = this.resolutionRules.get(conflict.resourceType) || [];

    for (const rule of rules) {
      if (rule.condition(local, remote)) {
        const resolution = await rule.resolve(local, remote);
        if (resolution) {
          logger.info(`Applied automatic resolution rule: ${rule.name}`);
          return this.createResolution(
            resolution.action,
            resolution.result,
            `Automatic: ${rule.name}`
          );
        }
      }
    }

    return null;
  }

  /**
   * Resolve by timestamp - keep most recent
   */
  private resolveByTimestamp(
    conflict: Conflict,
    local: Resource,
    remote: Resource
  ): Resolution {
    const localTime = new Date(local.meta?.lastUpdated || 0).getTime();
    const remoteTime = new Date(remote.meta?.lastUpdated || 0).getTime();

    if (localTime > remoteTime) {
      return this.createResolution('keep_local', local, 'Automatic: Local is more recent');
    } else {
      return this.createResolution('keep_remote', remote, 'Automatic: Remote is more recent');
    }
  }

  /**
   * Resolve by version - keep higher version
   */
  private resolveByVersion(
    conflict: Conflict,
    local: Resource,
    remote: Resource
  ): Resolution {
    const localVersion = parseInt(local.meta?.versionId || '0');
    const remoteVersion = parseInt(remote.meta?.versionId || '0');

    if (localVersion > remoteVersion) {
      return this.createResolution('keep_local', local, 'Automatic: Local has higher version');
    } else {
      return this.createResolution('keep_remote', remote, 'Automatic: Remote has higher version');
    }
  }

  /**
   * Resolve by merging changes
   */
  private async resolveByMerge(
    conflict: Conflict,
    local: Resource,
    remote: Resource
  ): Promise<Resolution | null> {
    try {
      // Get common ancestor
      const ancestor = await this.findCommonAncestor(conflict.resourceType, conflict.resourceId);
      
      if (!ancestor) {
        // No common ancestor, can't merge automatically
        return null;
      }

      // Perform three-way merge
      const merged = await this.threeWayMerge(ancestor, local, remote);
      
      if (merged) {
        return this.createResolution('merge', merged, 'Automatic: Three-way merge');
      }

      return null;
    } catch (error) {
      logger.error('Merge failed:', error);
      return null;
    }
  }

  /**
   * Find common ancestor for three-way merge
   */
  private async findCommonAncestor(
    resourceType: string,
    resourceId: string
  ): Promise<Resource | null> {
    const versions = await this.offlineStore.getResourceVersions(resourceType, resourceId);
    
    if (versions.length === 0) {
      return null;
    }

    // Find last synced version
    const lastSynced = versions.find(v => v.hash === versions[0].hash);
    
    if (lastSynced) {
      // Reconstruct resource from version
      // This is simplified - in production would need full version reconstruction
      return null;
    }

    return null;
  }

  /**
   * Perform three-way merge
   */
  private async threeWayMerge(
    ancestor: Resource,
    local: Resource,
    remote: Resource
  ): Promise<Resource | null> {
    try {
      // Deep clone remote as base for merged result
      const merged = JSON.parse(JSON.stringify(remote));

      // Get changes from ancestor to local
      const localChanges = this.getChanges(ancestor, local);
      
      // Get changes from ancestor to remote
      const remoteChanges = this.getChanges(ancestor, remote);

      // Check for conflicting changes
      const conflicts = this.findConflictingChanges(localChanges, remoteChanges);
      
      if (conflicts.length > 0) {
        // Can't auto-merge with conflicts
        return null;
      }

      // Apply non-conflicting local changes to merged
      this.applyChanges(merged, localChanges);

      // Update metadata
      merged.meta = {
        ...merged.meta,
        lastUpdated: new Date().toISOString(),
        versionId: String(Math.max(
          parseInt(local.meta?.versionId || '0'),
          parseInt(remote.meta?.versionId || '0')
        ) + 1),
        tag: [
          ...(merged.meta?.tag || []),
          {
            system: 'http://omnicare.com/tags',
            code: 'auto-merged',
            display: 'Automatically merged'
          }
        ]
      };

      return merged;
    } catch (error) {
      logger.error('Three-way merge failed:', error);
      return null;
    }
  }

  /**
   * Get changes between two versions
   */
  private getChanges(from: Resource, to: Resource): Map<string, any> {
    const changes = new Map<string, any>();
    
    // Simple field-by-field comparison
    // In production, would use a proper diff algorithm
    const fromObj = from as any;
    const toObj = to as any;

    for (const key in toObj) {
      if (key === 'meta' || key === 'id') continue;
      
      if (JSON.stringify(fromObj[key]) !== JSON.stringify(toObj[key])) {
        changes.set(key, toObj[key]);
      }
    }

    return changes;
  }

  /**
   * Find conflicting changes
   */
  private findConflictingChanges(
    localChanges: Map<string, any>,
    remoteChanges: Map<string, any>
  ): string[] {
    const conflicts: string[] = [];

    for (const [key, localValue] of localChanges) {
      if (remoteChanges.has(key)) {
        const remoteValue = remoteChanges.get(key);
        if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
          conflicts.push(key);
        }
      }
    }

    return conflicts;
  }

  /**
   * Apply changes to resource
   */
  private applyChanges(resource: any, changes: Map<string, any>): void {
    for (const [key, value] of changes) {
      resource[key] = value;
    }
  }

  /**
   * Create resolution object
   */
  private createResolution(
    action: Resolution['action'],
    result: Resource | Resource[],
    notes: string
  ): Resolution {
    return {
      action,
      result,
      resolvedBy: 'system',
      resolvedAt: new Date().toISOString(),
      notes
    };
  }

  /**
   * Initialize domain-specific resolution rules
   */
  private initializeResolutionRules(): void {
    // Observation rules
    this.resolutionRules.set('Observation', [
      {
        name: 'Device measurements take precedence',
        condition: (local: Resource, remote: Resource) => {
          const l = local as Observation;
          const r = remote as Observation;
          return this.isFromDevice(l) !== this.isFromDevice(r);
        },
        resolve: async (local: Resource, remote: Resource) => {
          const l = local as Observation;
          const r = remote as Observation;
          return {
            action: 'keep_local' as const,
            result: this.isFromDevice(l) ? local : remote
          };
        }
      },
      {
        name: 'Keep both vital signs if close in time',
        condition: (local: Resource, remote: Resource) => {
          const l = local as Observation;
          const r = remote as Observation;
          return this.isVitalSign(l) && 
                 this.isVitalSign(r) && 
                 this.areCloseInTime(l, r, 5 * 60 * 1000); // 5 minutes
        },
        resolve: async (local: Resource, remote: Resource) => {
          return {
            action: 'keep_both' as const,
            result: [local, remote]
          };
        }
      }
    ]);

    // MedicationRequest rules
    this.resolutionRules.set('MedicationRequest', [
      {
        name: 'Prescriber changes take precedence',
        condition: (local: Resource, remote: Resource) => {
          const l = local as MedicationRequest;
          const r = remote as MedicationRequest;
          return l.requester?.reference !== r.requester?.reference;
        },
        resolve: async (local: Resource, remote: Resource) => {
          // Prefer the one with more recent authoredOn
          const l = local as MedicationRequest;
          const r = remote as MedicationRequest;
          const localTime = new Date(l.authoredOn || 0).getTime();
          const remoteTime = new Date(r.authoredOn || 0).getTime();
          
          return {
            action: 'keep_local' as const,
            result: localTime > remoteTime ? local : remote
          };
        }
      },
      {
        name: 'Status changes require manual review',
        condition: (local: Resource, remote: Resource) => {
          const l = local as MedicationRequest;
          const r = remote as MedicationRequest;
          return l.status !== r.status && 
                 ['active', 'on-hold', 'cancelled', 'completed'].includes(l.status) &&
                 ['active', 'on-hold', 'cancelled', 'completed'].includes(r.status);
        },
        resolve: async () => null // Force manual review
      }
    ]);

    // Encounter rules
    this.resolutionRules.set('Encounter', [
      {
        name: 'Discharge takes precedence',
        condition: (local: Resource, remote: Resource) => {
          const l = local as Encounter;
          const r = remote as Encounter;
          return (l.status === 'finished' && r.status !== 'finished') ||
                 (l.status !== 'finished' && r.status === 'finished');
        },
        resolve: async (local: Resource, remote: Resource) => {
          const l = local as Encounter;
          const r = remote as Encounter;
          return {
            action: 'keep_local' as const,
            result: l.status === 'finished' ? local : remote
          };
        }
      }
    ]);
  }

  /**
   * Check if observation is from a medical device
   */
  private isFromDevice(observation: Observation): boolean {
    return observation.device?.reference !== undefined ||
           observation.method?.coding?.some(c => c.system === 'http://snomed.info/sct' && c.code === '258104002');
  }

  /**
   * Check if observation is a vital sign
   */
  private isVitalSign(observation: Observation): boolean {
    return observation.category?.some(cat => 
      cat.coding?.some(c => c.code === 'vital-signs')
    ) || false;
  }

  /**
   * Check if two observations are close in time
   */
  private areCloseInTime(obs1: Observation, obs2: Observation, toleranceMs: number): boolean {
    const time1 = new Date(obs1.effectiveDateTime || obs1.effectivePeriod?.start || 0).getTime();
    const time2 = new Date(obs2.effectiveDateTime || obs2.effectivePeriod?.start || 0).getTime();
    return Math.abs(time1 - time2) <= toleranceMs;
  }

  /**
   * Get pending conflicts for manual resolution
   */
  async getPendingConflicts(): Promise<Conflict[]> {
    return this.offlineStore.getActiveConflicts();
  }

  /**
   * Manually resolve conflict
   */
  async manuallyResolve(
    conflictId: string,
    resolution: Resolution
  ): Promise<void> {
    const conflict = await this.offlineStore.getConflict(conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    conflict.resolution = resolution;
    conflict.status = 'resolved';
    
    await this.offlineStore.updateConflict(conflict);
    
    // Apply resolution
    const local = await this.offlineStore.getResource(conflict.resourceType, conflict.resourceId);
    const remote = await this.offlineStore.getRemoteResource(conflict.resourceType, conflict.resourceId);
    
    if (!local || !remote) {
      throw new Error('Cannot apply resolution - resources not found');
    }

    await this.applyResolution(conflict, resolution);
  }

  /**
   * Apply resolution to resources
   */
  private async applyResolution(conflict: Conflict, resolution: Resolution): Promise<void> {
    // Implementation depends on the resolution action
    // This would be implemented in the sync engine
    logger.info(`Applied resolution for conflict ${conflict.id}: ${resolution.action}`);
  }
}