/**
 * Query Builder for IndexedDB FHIR Resource Queries
 * Provides a fluent interface for building complex queries
 */

import { Resource, Bundle } from '@medplum/fhirtypes';
import { indexedDBService, IndexedDBSearchParams } from './indexeddb.service';
import { QueryResumeState } from './indexeddb.schemas';

// Query operators
export enum QueryOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'ne',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'ge',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'le',
  CONTAINS = 'co',
  STARTS_WITH = 'sw',
  ENDS_WITH = 'ew',
  IN = 'in',
  NOT_IN = 'ni'
}

// Sort direction
export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc'
}

// Query condition
interface QueryCondition {
  field: string;
  operator: QueryOperator;
  value: any;
}

// Join configuration
interface JoinConfig {
  resourceType: string;
  localField: string;
  foreignField: string;
  as?: string;
}

/**
 * FHIR Query Builder for IndexedDB
 */
export class FHIRQueryBuilder<T extends Resource = Resource> {
  private resourceType: string;
  private conditions: QueryCondition[] = [];
  private includeFields: string[] = [];
  private revIncludeFields: string[] = [];
  private sortFields: Array<{ field: string; direction: SortDirection }> = [];
  private limitValue?: number;
  private offsetValue?: number;
  private summaryMode?: boolean;
  private elementFields?: string[];
  private joins: JoinConfig[] = [];

  constructor(resourceType: string) {
    this.resourceType = resourceType;
  }

  /**
   * Add a where condition
   */
  where(field: string, operator: QueryOperator = QueryOperator.EQUALS, value: any): this {
    this.conditions.push({ field, operator, value });
    return this;
  }

  /**
   * Convenience method for equality
   */
  whereEquals(field: string, value: any): this {
    return this.where(field, QueryOperator.EQUALS, value);
  }

  /**
   * Convenience method for contains
   */
  whereContains(field: string, value: string): this {
    return this.where(field, QueryOperator.CONTAINS, value);
  }

  /**
   * Convenience method for date range
   */
  whereBetween(field: string, start: Date | string, end: Date | string): this {
    this.where(field, QueryOperator.GREATER_THAN_OR_EQUAL, start);
    this.where(field, QueryOperator.LESS_THAN_OR_EQUAL, end);
    return this;
  }

  /**
   * Convenience method for IN operator
   */
  whereIn(field: string, values: any[]): this {
    return this.where(field, QueryOperator.IN, values);
  }

  /**
   * Add patient filter (common use case)
   */
  forPatient(patientId: string): this {
    // Handle different patient reference fields
    if (['Observation', 'Condition', 'MedicationRequest', 'Encounter'].includes(this.resourceType)) {
      this.whereEquals('patient', `Patient/${patientId}`);
    } else if (['DocumentReference', 'DiagnosticReport'].includes(this.resourceType)) {
      this.whereEquals('subject', `Patient/${patientId}`);
    }
    return this;
  }

  /**
   * Add encounter filter
   */
  forEncounter(encounterId: string): this {
    this.whereEquals('encounter', `Encounter/${encounterId}`);
    return this;
  }

  /**
   * Add status filter
   */
  withStatus(status: string | string[]): this {
    if (Array.isArray(status)) {
      this.whereIn('status', status);
    } else {
      this.whereEquals('status', status);
    }
    return this;
  }

  /**
   * Include related resources
   */
  include(resourceType: string, field?: string): this {
    const includeParam = field ? `${resourceType}:${field}` : resourceType;
    this.includeFields.push(includeParam);
    return this;
  }

  /**
   * Reverse include related resources
   */
  revInclude(resourceType: string, field: string): this {
    this.revIncludeFields.push(`${resourceType}:${field}`);
    return this;
  }

  /**
   * Add join (for complex queries)
   */
  join(config: JoinConfig): this {
    this.joins.push(config);
    return this;
  }

  /**
   * Sort results
   */
  orderBy(field: string, direction: SortDirection = SortDirection.ASC): this {
    this.sortFields.push({ field, direction });
    return this;
  }

  /**
   * Limit results
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * Skip results
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * Enable summary mode
   */
  summary(enabled = true): this {
    this.summaryMode = enabled;
    return this;
  }

  /**
   * Select specific elements
   */
  select(...fields: string[]): this {
    this.elementFields = fields;
    return this;
  }

  /**
   * Build the search parameters
   */
  private buildSearchParams(): IndexedDBSearchParams {
    const params: IndexedDBSearchParams = {};

    // Add conditions, but skip complex operators that need post-processing
    this.conditions.forEach(condition => {
      const paramName = this.mapFieldToSearchParam(condition.field);
      
      // Skip complex operators that IndexedDB doesn't understand
      if ([QueryOperator.NOT_EQUALS, QueryOperator.GREATER_THAN, 
           QueryOperator.GREATER_THAN_OR_EQUAL, QueryOperator.LESS_THAN,
           QueryOperator.LESS_THAN_OR_EQUAL, QueryOperator.NOT_IN].includes(condition.operator)) {
        return; // Skip adding to params - will handle in post-processing
      }
      
      switch (condition.operator) {
        case QueryOperator.EQUALS:
          params[paramName] = condition.value;
          break;
        
        case QueryOperator.CONTAINS:
          params[paramName] = `*${condition.value}*`;
          break;
        
        case QueryOperator.STARTS_WITH:
          params[paramName] = `${condition.value}*`;
          break;
        
        case QueryOperator.IN:
          params[paramName] = condition.value;
          break;
      }
    });

    // Add modifiers
    if (this.limitValue) params._count = this.limitValue;
    if (this.offsetValue) params._offset = this.offsetValue;
    if (this.includeFields.length) params._include = this.includeFields;
    if (this.revIncludeFields.length) params._revinclude = this.revIncludeFields;
    if (this.summaryMode) params._summary = true;
    if (this.elementFields) params._elements = this.elementFields;

    // Add sort
    if (this.sortFields.length) {
      params._sort = this.sortFields
        .map(sort => `${sort.direction === SortDirection.DESC ? '-' : ''}${sort.field}`)
        .join(',');
    }

    return params;
  }

  /**
   * Map field names to FHIR search parameters
   */
  private mapFieldToSearchParam(field: string): string {
    // Common mappings
    const mappings: Record<string, string> = {
      'patient': 'patient',
      'subject': 'subject',
      'encounter': 'encounter',
      'practitioner': 'practitioner',
      'organization': 'organization',
      'status': 'status',
      'category': 'category',
      'code': 'code',
      'date': 'date',
      'identifier': 'identifier',
      'name': 'name',
      'given': 'given',
      'family': 'family',
      'birthDate': 'birthdate',
      'gender': 'gender',
      'type': 'type'
    };

    return mappings[field] || field;
  }

  /**
   * Execute the query
   */
  async execute(): Promise<Bundle<T>> {
    const params = this.buildSearchParams();
    const bundle = await indexedDBService.searchResources<T>(this.resourceType, params);

    // Post-process results for complex operators
    if (this.hasComplexOperators()) {
      bundle.entry = bundle.entry?.filter(entry => 
        this.matchesComplexConditions(entry.resource!)
      );
      bundle.total = bundle.entry?.length || 0;
    }

    // Handle joins if specified
    if (this.joins.length > 0) {
      await this.processJoins(bundle);
    }

    return bundle;
  }

  /**
   * Execute and return first result
   */
  async first(): Promise<T | null> {
    this.limit(1);
    const bundle = await this.execute();
    return bundle.entry?.[0]?.resource || null;
  }

  /**
   * Execute and return array of resources
   */
  async toArray(): Promise<T[]> {
    const bundle = await this.execute();
    return bundle.entry?.map(entry => entry.resource!) || [];
  }

  /**
   * Count matching resources
   */
  async count(): Promise<number> {
    // Use summary mode for efficient counting
    this.summary(true);
    const bundle = await this.execute();
    return bundle.total || 0;
  }

  /**
   * Check if any results exist
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  /**
   * Stream results in batches
   */
  async *stream(batchSize = 10): AsyncGenerator<T[], void, unknown> {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      this.offset(offset).limit(batchSize);
      const bundle = await this.execute();
      const resources = bundle.entry?.map(entry => entry.resource!) || [];
      
      if (resources.length > 0) {
        yield resources;
        offset += resources.length;
        hasMore = resources.length === batchSize;
      } else {
        hasMore = false;
      }
    }
  }

  /**
   * Stream results with resume capability
   */
  async *streamWithResume(
    queryId: string,
    batchSize = 10,
    resumeToken?: string
  ): AsyncGenerator<{ resources: T[]; resumeToken: string; progress: number }, void, unknown> {
    let offset = 0;
    let totalProcessed = 0;
    let queryResumeState: any = null;

    // Check for existing resume state
    if (resumeToken) {
      queryResumeState = await this.getQueryResumeState(queryId);
      if (queryResumeState) {
        offset = queryResumeState.lastOffset;
        totalProcessed = queryResumeState.processedCount;
        console.log(`Resuming query ${queryId} from offset ${offset}`);
      }
    }

    // Get total count for progress calculation
    const totalCount = queryResumeState?.totalCount ?? await this.count();
    
    // Create or update resume state
    if (!queryResumeState) {
      queryResumeState = await this.createQueryResumeState(queryId, totalCount, batchSize);
    }

    let hasMore = true;
    while (hasMore) {
      try {
        this.offset(offset).limit(batchSize);
        const bundle = await this.execute();
        const resources = bundle.entry?.map(entry => entry.resource!) || [];
        
        if (resources.length > 0) {
          totalProcessed += resources.length;
          offset += resources.length;
          
          // Update resume state
          const currentResumeToken = await this.updateQueryResumeState(
            queryResumeState.id,
            totalProcessed,
            offset
          );
          
          const progress = totalCount > 0 ? (totalProcessed / totalCount) * 100 : 0;
          
          yield {
            resources,
            resumeToken: currentResumeToken,
            progress
          };
          
          hasMore = resources.length === batchSize;
        } else {
          hasMore = false;
        }
      } catch (error) {
        // Save current state for resume
        await this.pauseQueryResumeState(queryResumeState.id, error as Error);
        throw error;
      }
    }

    // Mark as completed
    await this.completeQueryResumeState(queryResumeState.id);
  }

  /**
   * Execute query with resume capability for large result sets
   */
  async executeWithResume(
    queryId: string,
    maxResults?: number,
    resumeToken?: string
  ): Promise<{
    results: T[];
    resumeToken?: string;
    hasMore: boolean;
    progress: number;
    totalCount: number;
  }> {
    let offset = 0;
    let totalProcessed = 0;
    let queryResumeState: any = null;

    // Check for existing resume state
    if (resumeToken) {
      queryResumeState = await this.getQueryResumeState(queryId);
      if (queryResumeState) {
        offset = queryResumeState.lastOffset;
        totalProcessed = queryResumeState.processedCount;
      }
    }

    // Get total count
    const totalCount = queryResumeState?.totalCount ?? await this.count();
    const limit = maxResults || Math.min(1000, totalCount - totalProcessed);

    // Create or update resume state
    if (!queryResumeState) {
      queryResumeState = await this.createQueryResumeState(queryId, totalCount, limit);
    }

    try {
      this.offset(offset).limit(limit);
      const bundle = await this.execute();
      const results = bundle.entry?.map(entry => entry.resource!) || [];
      
      totalProcessed += results.length;
      const hasMore = totalProcessed < totalCount && results.length === limit;
      
      // Update resume state
      let currentResumeToken: string | undefined;
      if (hasMore) {
        currentResumeToken = await this.updateQueryResumeState(
          queryResumeState.id,
          totalProcessed,
          offset + results.length
        );
      } else {
        await this.completeQueryResumeState(queryResumeState.id);
      }
      
      const progress = totalCount > 0 ? (totalProcessed / totalCount) * 100 : 100;
      
      return {
        results,
        resumeToken: currentResumeToken,
        hasMore,
        progress,
        totalCount
      };
    } catch (error) {
      await this.pauseQueryResumeState(queryResumeState.id, error as Error);
      throw error;
    }
  }

  /**
   * Create query resume state
   */
  private async createQueryResumeState(
    queryId: string,
    totalCount: number,
    batchSize: number
  ): Promise<any> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return { id: queryId, totalCount, processedCount: 0, lastOffset: 0 };
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OmniCareOfflineDB', 2);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['queryResumeStates'], 'readwrite');
        const store = transaction.objectStore('queryResumeStates');
        
        const resumeState = {
          queryId,
          resourceType: this.resourceType,
          filters: this.buildSearchParams(),
          totalCount,
          processedCount: 0,
          lastOffset: 0,
          resumeToken: this.generateResumeToken(),
          batchSize,
          status: 'in_progress',
          createdAt: Date.now()
        };
        
        const addRequest = store.add(resumeState);
        
        addRequest.onsuccess = () => {
          db.close();
          resolve({ ...resumeState, id: addRequest.result });
        };
        
        addRequest.onerror = () => {
          db.close();
          reject(addRequest.error);
        };
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get query resume state
   */
  private async getQueryResumeState(queryId: string): Promise<any> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OmniCareOfflineDB', 2);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['queryResumeStates'], 'readonly');
        const store = transaction.objectStore('queryResumeStates');
        const index = store.index('queryId');
        
        const getRequest = index.get(queryId);
        
        getRequest.onsuccess = () => {
          db.close();
          resolve(getRequest.result);
        };
        
        getRequest.onerror = () => {
          db.close();
          reject(getRequest.error);
        };
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update query resume state
   */
  private async updateQueryResumeState(
    id: any,
    processedCount: number,
    lastOffset: number
  ): Promise<string> {
    const resumeToken = this.generateResumeToken();
    
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return resumeToken;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OmniCareOfflineDB', 2);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['queryResumeStates'], 'readwrite');
        const store = transaction.objectStore('queryResumeStates');
        
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
          const state = getRequest.result;
          if (state) {
            state.processedCount = processedCount;
            state.lastOffset = lastOffset;
            state.resumeToken = resumeToken;
            state.lastResumeAt = Date.now();
            
            const putRequest = store.put(state);
            
            putRequest.onsuccess = () => {
              db.close();
              resolve(resumeToken);
            };
            
            putRequest.onerror = () => {
              db.close();
              reject(putRequest.error);
            };
          } else {
            db.close();
            resolve(resumeToken);
          }
        };
        
        getRequest.onerror = () => {
          db.close();
          reject(getRequest.error);
        };
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Pause query resume state
   */
  private async pauseQueryResumeState(id: any, error: Error): Promise<void> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OmniCareOfflineDB', 2);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['queryResumeStates'], 'readwrite');
        const store = transaction.objectStore('queryResumeStates');
        
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
          const state = getRequest.result;
          if (state) {
            state.status = 'paused';
            state.errorMessage = error.message;
            state.lastResumeAt = Date.now();
            
            store.put(state);
          }
          db.close();
          resolve();
        };
        
        getRequest.onerror = () => {
          db.close();
          reject(getRequest.error);
        };
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Complete query resume state
   */
  private async completeQueryResumeState(id: any): Promise<void> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OmniCareOfflineDB', 2);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['queryResumeStates'], 'readwrite');
        const store = transaction.objectStore('queryResumeStates');
        
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
          const state = getRequest.result;
          if (state) {
            state.status = 'completed';
            state.completedAt = Date.now();
            
            store.put(state);
          }
          db.close();
          resolve();
        };
        
        getRequest.onerror = () => {
          db.close();
          reject(getRequest.error);
        };
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generate resume token
   */
  private generateResumeToken(): string {
    return `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if query has complex operators that need post-processing
   */
  private hasComplexOperators(): boolean {
    return this.conditions.some(condition => 
      [QueryOperator.NOT_EQUALS, QueryOperator.GREATER_THAN, 
       QueryOperator.GREATER_THAN_OR_EQUAL, QueryOperator.LESS_THAN,
       QueryOperator.LESS_THAN_OR_EQUAL, QueryOperator.NOT_IN].includes(condition.operator)
    );
  }

  /**
   * Match resource against complex conditions
   */
  private matchesComplexConditions(resource: T): boolean {
    return this.conditions.every(condition => {
      const value = this.getResourceValue(resource, condition.field);
      
      switch (condition.operator) {
        case QueryOperator.NOT_EQUALS:
          return value !== condition.value;
        
        case QueryOperator.GREATER_THAN:
          return value > condition.value;
        
        case QueryOperator.GREATER_THAN_OR_EQUAL:
          return value >= condition.value;
        
        case QueryOperator.LESS_THAN:
          return value < condition.value;
        
        case QueryOperator.LESS_THAN_OR_EQUAL:
          return value <= condition.value;
        
        case QueryOperator.NOT_IN:
          return !condition.value.includes(value);
        
        default:
          return true; // Already handled by IndexedDB
      }
    });
  }

  /**
   * Get value from resource using field path
   */
  private getResourceValue(resource: any, field: string): any {
    const parts = field.split('.');
    let current = resource;

    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }

    return current;
  }

  /**
   * Process joins
   */
  private async processJoins(bundle: Bundle<T>): Promise<void> {
    if (!bundle.entry) return;

    for (const join of this.joins) {
      // Collect all foreign keys
      const foreignKeys = new Set<string>();
      bundle.entry.forEach(entry => {
        const key = this.getResourceValue(entry.resource, join.localField);
        if (key) foreignKeys.add(key);
      });

      // Fetch related resources
      const relatedQuery = new FHIRQueryBuilder(join.resourceType)
        .whereIn(join.foreignField, Array.from(foreignKeys));
      
      const relatedBundle = await relatedQuery.execute();
      const relatedMap = new Map<string, Resource>();

      relatedBundle.entry?.forEach(entry => {
        const key = this.getResourceValue(entry.resource, join.foreignField);
        if (key) relatedMap.set(key, entry.resource!);
      });

      // Attach related resources
      bundle.entry.forEach(entry => {
        const key = this.getResourceValue(entry.resource, join.localField);
        if (key && relatedMap.has(key)) {
          const asField = join.as || `_${join.resourceType.toLowerCase()}`;
          (entry as any)[asField] = relatedMap.get(key);
        }
      });
    }
  }
}

/**
 * Factory function to create a query builder
 */
export function query<T extends Resource = Resource>(resourceType: string): FHIRQueryBuilder<T> {
  return new FHIRQueryBuilder<T>(resourceType);
}

/**
 * Predefined queries for common use cases
 */
export const CommonQueries = {
  /**
   * Get recent vital signs for a patient
   */
  recentVitals(patientId: string, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    return query('Observation')
      .forPatient(patientId)
      .whereEquals('category', 'vital-signs')
      .whereBetween('effectiveDateTime', since.toISOString(), new Date().toISOString())
      .orderBy('effectiveDateTime', SortDirection.DESC);
  },

  /**
   * Get active medications for a patient
   */
  activeMedications(patientId: string) {
    return query('MedicationRequest')
      .forPatient(patientId)
      .whereIn('status', ['active', 'on-hold'])
      .orderBy('authoredOn', SortDirection.DESC);
  },

  /**
   * Get recent encounters for a patient
   */
  recentEncounters(patientId: string, limit = 10) {
    return query('Encounter')
      .forPatient(patientId)
      .whereIn('status', ['in-progress', 'finished'])
      .orderBy('period.start', SortDirection.DESC)
      .limit(limit);
  },

  /**
   * Get lab results for an encounter
   */
  encounterLabs(encounterId: string) {
    return query('Observation')
      .forEncounter(encounterId)
      .whereEquals('category', 'laboratory')
      .orderBy('effectiveDateTime', SortDirection.DESC);
  },

  /**
   * Get documents for a patient
   */
  patientDocuments(patientId: string, category?: string) {
    const q = query('DocumentReference')
      .whereEquals('subject', `Patient/${patientId}`)
      .whereEquals('status', 'current');
    
    if (category) {
      q.whereEquals('category', category);
    }
    
    return q.orderBy('date', SortDirection.DESC);
  },

  /**
   * Search patients by name
   */
  searchPatients(searchTerm: string) {
    return query('Patient')
      .whereContains('name', searchTerm)
      .orderBy('name.family')
      .limit(20);
  },

  /**
   * Get care team for a patient
   */
  patientCareTeam(patientId: string) {
    return query('CareTeam')
      .forPatient(patientId)
      .whereEquals('status', 'active')
      .include('Practitioner', 'participant.member');
  }
};

// Export query types
export type { QueryCondition, JoinConfig };