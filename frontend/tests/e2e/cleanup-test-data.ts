/**
 * Test Data Cleanup Utilities
 * Provides typed cleanup functions and data structures for E2E tests
 */

// TypeScript interfaces for cleanup operations
export interface CleanupResult {
  success: boolean;
  message: string;
  itemsRemoved: number;
  errors?: string[];
}

export interface TestDataItem {
  id: string;
  type: 'patient' | 'encounter' | 'medication' | 'lab-result' | 'file' | 'session';
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface CleanupConfig {
  dryRun?: boolean;
  maxAge?: number; // milliseconds
  types?: TestDataItem['type'][];
  batchSize?: number;
}

export interface CleanupSummary {
  totalItems: number;
  successfulCleanups: number;
  failedCleanups: number;
  duration: number;
  results: CleanupResult[];
}

// Cleanup registry to track test data across sessions
class TestDataRegistry {
  private items: Map<string, TestDataItem> = new Map();

  register(item: TestDataItem): void {
    this.items.set(item.id, item);
  }

  unregister(id: string): boolean {
    return this.items.delete(id);
  }

  getItems(filter?: { type?: TestDataItem['type']; maxAge?: number }): TestDataItem[] {
    const items = Array.from(this.items.values());
    
    if (!filter) {
      return items;
    }

    return items.filter(item => {
      if (filter.type && item.type !== filter.type) {
        return false;
      }
      
      if (filter.maxAge) {
        const age = Date.now() - new Date(item.timestamp).getTime();
        if (age > filter.maxAge) {
          return false;
        }
      }
      
      return true;
    });
  }

  clear(): void {
    this.items.clear();
  }

  size(): number {
    return this.items.size;
  }
}

// Global registry instance
const registry = new TestDataRegistry();

/**
 * Register test data for cleanup tracking
 */
export function registerTestData(item: TestDataItem): void {
  registry.register(item);
}

/**
 * Clean up patient test data
 */
export async function cleanupPatientData(patientIds: string[]): Promise<CleanupResult> {
  try {
    const removedIds: string[] = [];
    const errors: string[] = [];

    for (const id of patientIds) {
      try {
        // In a real implementation, this would call API endpoints to remove data
        // For now, we'll simulate the cleanup
        const removed = registry.unregister(id);
        if (removed) {
          removedIds.push(id);
        }
      } catch (error) {
        errors.push(`Failed to cleanup patient ${id}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      message: `Cleaned up ${removedIds.length} patient records`,
      itemsRemoved: removedIds.length,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    return {
      success: false,
      message: `Patient cleanup failed: ${error}`,
      itemsRemoved: 0,
      errors: [String(error)]
    };
  }
}

/**
 * Clean up encounter test data
 */
export async function cleanupEncounterData(encounterIds: string[]): Promise<CleanupResult> {
  try {
    const removedIds: string[] = [];
    const errors: string[] = [];

    for (const id of encounterIds) {
      try {
        const removed = registry.unregister(id);
        if (removed) {
          removedIds.push(id);
        }
      } catch (error) {
        errors.push(`Failed to cleanup encounter ${id}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      message: `Cleaned up ${removedIds.length} encounter records`,
      itemsRemoved: removedIds.length,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    return {
      success: false,
      message: `Encounter cleanup failed: ${error}`,
      itemsRemoved: 0,
      errors: [String(error)]
    };
  }
}

/**
 * Clean up medication test data
 */
export async function cleanupMedicationData(medicationIds: string[]): Promise<CleanupResult> {
  try {
    const removedIds: string[] = [];
    const errors: string[] = [];

    for (const id of medicationIds) {
      try {
        const removed = registry.unregister(id);
        if (removed) {
          removedIds.push(id);
        }
      } catch (error) {
        errors.push(`Failed to cleanup medication ${id}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      message: `Cleaned up ${removedIds.length} medication records`,
      itemsRemoved: removedIds.length,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    return {
      success: false,
      message: `Medication cleanup failed: ${error}`,
      itemsRemoved: 0,
      errors: [String(error)]
    };
  }
}

/**
 * Clean up temporary files
 */
export async function cleanupTemporaryFiles(filePaths: string[]): Promise<CleanupResult> {
  try {
    const fs = require('fs');
    const removedFiles: string[] = [];
    const errors: string[] = [];

    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          removedFiles.push(filePath);
          registry.unregister(filePath);
        }
      } catch (error) {
        errors.push(`Failed to cleanup file ${filePath}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      message: `Cleaned up ${removedFiles.length} temporary files`,
      itemsRemoved: removedFiles.length,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    return {
      success: false,
      message: `File cleanup failed: ${error}`,
      itemsRemoved: 0,
      errors: [String(error)]
    };
  }
}

/**
 * Clean up session data
 */
export async function cleanupSessionData(sessionIds: string[]): Promise<CleanupResult> {
  try {
    const removedIds: string[] = [];
    const errors: string[] = [];

    for (const id of sessionIds) {
      try {
        const removed = registry.unregister(id);
        if (removed) {
          removedIds.push(id);
        }
      } catch (error) {
        errors.push(`Failed to cleanup session ${id}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      message: `Cleaned up ${removedIds.length} session records`,
      itemsRemoved: removedIds.length,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    return {
      success: false,
      message: `Session cleanup failed: ${error}`,
      itemsRemoved: 0,
      errors: [String(error)]
    };
  }
}

/**
 * Comprehensive cleanup of all test data
 */
export async function cleanupAllTestData(config: CleanupConfig = {}): Promise<CleanupSummary> {
  const startTime = Date.now();
  const results: CleanupResult[] = [];
  
  const {
    dryRun = false,
    maxAge = 24 * 60 * 60 * 1000, // 24 hours default
    types = ['patient', 'encounter', 'medication', 'lab-result', 'file', 'session'],
    batchSize = 100
  } = config;

  try {
    // Get items to cleanup based on config
    const itemsToCleanup = registry.getItems({ maxAge });
    const filteredItems = itemsToCleanup.filter(item => types.includes(item.type));

    console.log(`🧹 Starting cleanup of ${filteredItems.length} items...`);
    
    if (dryRun) {
      console.log('📋 DRY RUN - No actual cleanup will be performed');
    }

    // Group items by type for batch processing
    const groupedItems = filteredItems.reduce((groups, item) => {
      if (!groups[item.type]) {
        groups[item.type] = [];
      }
      groups[item.type].push(item.id);
      return groups;
    }, {} as Record<TestDataItem['type'], string[]>);

    // Process each type
    for (const [type, ids] of Object.entries(groupedItems)) {
      // Process in batches
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        
        if (!dryRun) {
          let result: CleanupResult;
          
          switch (type) {
            case 'patient':
              result = await cleanupPatientData(batch);
              break;
            case 'encounter':
              result = await cleanupEncounterData(batch);
              break;
            case 'medication':
              result = await cleanupMedicationData(batch);
              break;
            case 'file':
              result = await cleanupTemporaryFiles(batch);
              break;
            case 'session':
              result = await cleanupSessionData(batch);
              break;
            default:
              result = {
                success: false,
                message: `Unknown cleanup type: ${type}`,
                itemsRemoved: 0,
                errors: [`Unknown cleanup type: ${type}`]
              };
          }
          
          results.push(result);
        } else {
          results.push({
            success: true,
            message: `[DRY RUN] Would cleanup ${batch.length} ${type} items`,
            itemsRemoved: batch.length
          });
        }
      }
    }

    const totalItems = filteredItems.length;
    const successfulCleanups = results.filter(r => r.success).reduce((sum, r) => sum + r.itemsRemoved, 0);
    const failedCleanups = totalItems - successfulCleanups;

    return {
      totalItems,
      successfulCleanups,
      failedCleanups,
      duration: Date.now() - startTime,
      results
    };

  } catch (error) {
    return {
      totalItems: 0,
      successfulCleanups: 0,
      failedCleanups: 1,
      duration: Date.now() - startTime,
      results: [{
        success: false,
        message: `Cleanup failed: ${error}`,
        itemsRemoved: 0,
        errors: [String(error)]
      }]
    };
  }
}

/**
 * Get cleanup statistics
 */
export function getCleanupStats(): {
  totalRegistered: number;
  byType: Record<TestDataItem['type'], number>;
} {
  const items = registry.getItems();
  const byType = items.reduce((counts, item) => {
    counts[item.type] = (counts[item.type] || 0) + 1;
    return counts;
  }, {} as Record<TestDataItem['type'], number>);

  return {
    totalRegistered: registry.size(),
    byType
  };
}

/**
 * Clear all tracked test data (for test isolation)
 */
export function clearRegistry(): void {
  registry.clear();
}

// Export the registry for advanced usage
export { registry as testDataRegistry };