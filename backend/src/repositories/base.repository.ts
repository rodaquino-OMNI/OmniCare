/**
 * OmniCare EMR Backend - Base Repository
 * Base class for all database repositories with common CRUD operations
 */

import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import crypto from 'crypto';

import { databaseService } from '@/services/database.service';
import { databaseCacheService } from '@/services/database-cache.service';
import { DatabaseFilters, QueryParameters, QueryParameterValue } from '@/types/database.types';
import logger from '@/utils/logger';

export interface BaseEntity {
  id: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface FindOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface QueryOptions {
  client?: PoolClient;
  enableCache?: boolean;
  cacheTtl?: number;
  useRetry?: boolean;
  batchSize?: number;
}

export interface BatchQueryOptions extends QueryOptions {
  parallel?: boolean;
  maxConcurrency?: number;
}

interface BatchRequest<T> {
  resolve: (value: T | null) => void;
  reject: (error: Error) => void;
}

export abstract class BaseRepository<T extends BaseEntity> {
  protected abstract tableName: string;
  protected abstract schema: string;
  
  // Cache configuration per repository
  protected defaultCacheTtl: number = 300; // 5 minutes
  protected enableCacheByDefault: boolean = true;
  
  // Query batching configuration
  protected batchConfig = {
    maxBatchSize: 100,
    batchTimeout: 50, // milliseconds
    enableBatching: true,
  };
  
  // Pending batch operations
  private pendingBatchReads = new Map<string, BatchRequest<T>[]>();
  
  private batchTimer: NodeJS.Timeout | null = null;

  /**
   * Get fully qualified table name
   */
  protected get fullTableName(): string {
    return `${this.schema}.${this.tableName}`;
  }

  /**
   * Execute a query with optional transaction client
   */
  protected async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: QueryParameters,
    options?: QueryOptions
  ): Promise<QueryResult<R>> {
    if (options?.client) {
      return options.client.query<R>(text, params);
    }
    return databaseService.query<R>(text, params);
  }

  /**
   * Find a record by ID with intelligent caching
   */
  async findById(id: string, options?: QueryOptions): Promise<T | null> {
    const shouldCache = options?.enableCache ?? this.enableCacheByDefault;
    const useRetry = options?.useRetry ?? true;
    
    if (shouldCache) {
      // Try cache first
      const cacheKey = this.generateCacheKey('findById', [id]);
      const cached = await databaseCacheService.getCachedFHIRResource<T>(
        this.tableName, 
        id
      );
      
      if (cached) {
        logger.debug(`Cache HIT for ${this.tableName}:${id}`);
        return cached;
      }
    }
    
    // If batching is enabled and no client specified, try to batch
    if (this.batchConfig.enableBatching && !options?.client) {
      return this.batchedFindById(id, options);
    }
    
    const query = `SELECT * FROM ${this.fullTableName} WHERE id = $1`;
    const result = useRetry 
      ? await databaseService.queryWithRetry<T>(query, [id])
      : await this.query<T>(query, [id], options);
    
    const record = result.rows[0] || null;
    
    // Cache the result if found
    if (record && shouldCache) {
      const ttl = options?.cacheTtl ?? this.defaultCacheTtl;
      await databaseCacheService.cacheFHIRResource(
        this.tableName,
        id,
        record,
        ttl
      );
    }
    
    return record;
  }

  /**
   * Batched findById to reduce N+1 queries
   */
  private async batchedFindById(id: string, options?: QueryOptions): Promise<T | null> {
    return new Promise((resolve, reject) => {
      if (!this.pendingBatchReads.has(id)) {
        this.pendingBatchReads.set(id, []);
      }
      
      this.pendingBatchReads.get(id)!.push({ resolve, reject });
      
      // Start batch timer if not already running
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.executeBatchReads();
        }, this.batchConfig.batchTimeout);
      }
    });
  }
  
  /**
   * Execute batched read operations
   */
  private async executeBatchReads(): Promise<void> {
    const batchIds = Array.from(this.pendingBatchReads.keys());
    const batchRequests = new Map(this.pendingBatchReads);
    
    // Clear pending requests
    this.pendingBatchReads.clear();
    this.batchTimer = null;
    
    if (batchIds.length === 0) return;
    
    try {
      // Execute batch query
      const placeholders = batchIds.map((_, index) => `$${index + 1}`).join(', ');
      const query = `SELECT * FROM ${this.fullTableName} WHERE id IN (${placeholders})`;
      
      const result = await databaseService.queryWithRetry<T>(query, batchIds);
      const recordsMap = new Map<string, T>();
      
      // Index results by ID
      result.rows.forEach(record => {
        recordsMap.set(record.id, record);
      });
      
      // Resolve all pending requests
      for (const [id, requests] of batchRequests) {
        const record = recordsMap.get(id) || null;
        
        requests.forEach(({ resolve }) => {
          resolve(record);
        });
        
        // Cache individual records
        if (record) {
          await databaseCacheService.cacheFHIRResource(
            this.tableName,
            id,
            record,
            this.defaultCacheTtl
          );
        }
      }
      
      logger.debug(`Executed batch read for ${batchIds.length} ${this.tableName} records`);
      
    } catch (error) {
      logger.error(`Batch read failed for ${this.tableName}:`, error);
      
      // Reject all pending requests
      for (const requests of batchRequests.values()) {
        requests.forEach(({ reject }) => {
          reject(error as Error);
        });
      }
    }
  }
  
  /**
   * Find multiple records by IDs with batching
   */
  async findByIds(ids: string[], options?: QueryOptions): Promise<T[]> {
    if (ids.length === 0) return [];
    
    const shouldCache = options?.enableCache ?? this.enableCacheByDefault;
    const results: T[] = [];
    const uncachedIds: string[] = [];
    
    // Check cache for each ID if caching is enabled
    if (shouldCache) {
      for (const id of ids) {
        const cached = await databaseCacheService.getCachedFHIRResource<T>(
          this.tableName,
          id
        );
        
        if (cached) {
          results.push(cached);
        } else {
          uncachedIds.push(id);
        }
      }
    } else {
      uncachedIds.push(...ids);
    }
    
    // Fetch uncached records
    if (uncachedIds.length > 0) {
      const placeholders = uncachedIds.map((_, index) => `$${index + 1}`).join(', ');
      const query = `SELECT * FROM ${this.fullTableName} WHERE id IN (${placeholders})`;
      
      const result = await databaseService.queryWithRetry<T>(query, uncachedIds);
      results.push(...result.rows);
      
      // Cache new results
      if (shouldCache) {
        const ttl = options?.cacheTtl ?? this.defaultCacheTtl;
        for (const record of result.rows) {
          await databaseCacheService.cacheFHIRResource(
            this.tableName,
            record.id,
            record,
            ttl
          );
        }
      }
    }
    
    return results;
  }

  /**
   * Find all records with optional filtering and enhanced caching
   */
  async findAll(
    filters?: DatabaseFilters,
    findOptions?: FindOptions,
    queryOptions?: QueryOptions
  ): Promise<T[]> {
    let query = `SELECT * FROM ${this.fullTableName}`;
    const params: QueryParameters = [];
    let paramCount = 0;

    // Build WHERE clause
    if (filters && Object.keys(filters).length > 0) {
      const whereConditions = Object.entries(filters)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => {
          paramCount++;
          params.push(value);
          return `${key} = $${paramCount}`;
        });

      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }
    }

    // Add ORDER BY
    if (findOptions?.orderBy) {
      const direction = findOptions.orderDirection || 'ASC';
      query += ` ORDER BY ${findOptions.orderBy} ${direction}`;
    }

    // Add LIMIT and OFFSET
    if (findOptions?.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(findOptions.limit);
    }

    if (findOptions?.offset) {
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(findOptions.offset);
    }

    const shouldCache = queryOptions?.enableCache ?? (Object.keys(filters || {}).length === 0);
    
    // Generate cache key for the query
    let cacheKey: string | null = null;
    if (shouldCache) {
      cacheKey = this.generateCacheKey('findAll', [filters, findOptions]);
      
      // Try to get from cache
      const cached = await databaseCacheService.getCachedFHIRResource<T[]>(
        `${this.tableName}_list`,
        cacheKey
      );
      
      if (cached) {
        logger.debug(`Cache HIT for ${this.tableName} list query`);
        return cached;
      }
    }
    
    const useRetry = queryOptions?.useRetry ?? true;
    const result = useRetry 
      ? await databaseService.queryWithRetry<T>(query, params)
      : await this.query<T>(query, params, queryOptions);
    
    // Cache the results
    if (shouldCache && cacheKey && result.rows.length > 0) {
      const ttl = queryOptions?.cacheTtl ?? this.defaultCacheTtl;
      await databaseCacheService.cacheFHIRResource(
        `${this.tableName}_list`,
        cacheKey,
        result.rows,
        ttl
      );
    }
    
    return result.rows;
  }

  /**
   * Count records with optional filtering
   */
  async count(
    filters?: DatabaseFilters,
    options?: QueryOptions
  ): Promise<number> {
    let query = `SELECT COUNT(*) FROM ${this.fullTableName}`;
    const params: QueryParameters = [];
    let paramCount = 0;

    // Build WHERE clause
    if (filters && Object.keys(filters).length > 0) {
      const whereConditions = Object.entries(filters)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => {
          paramCount++;
          params.push(value);
          return `${key} = $${paramCount}`;
        });

      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }
    }

    const result = await this.query<{ count: string }>(query, params, options);
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  /**
   * Generate cache key for queries
   */
  private generateCacheKey(operation: string, params: any[]): string {
    const normalized = JSON.stringify({
      table: this.fullTableName,
      operation,
      params
    });
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32);
  }
  
  /**
   * Invalidate cache for a record
   */
  protected async invalidateCache(id: string): Promise<void> {
    await databaseCacheService.invalidateFHIRResource(this.tableName, id);
    // Also invalidate list caches (this is simplified - in production you'd be more selective)
    await databaseCacheService.invalidateByPattern(`${this.tableName}_list`);
  }

  /**
   * Create a new record with cache invalidation
   */
  async create(data: Partial<T>, options?: QueryOptions): Promise<T> {
    const fields = Object.keys(data).filter(key => data[key as keyof T] !== undefined);
    const values = fields.map(key => data[key as keyof T] as QueryParameterValue);
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');

    const query = `
      INSERT INTO ${this.fullTableName} (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const useRetry = options?.useRetry ?? false; // Don't retry writes by default
    const result = useRetry 
      ? await databaseService.queryWithRetry<T>(query, values)
      : await this.query<T>(query, values, options);
      
    if (!result.rows[0]) {
      throw new Error('Failed to create record');
    }
    
    const created = result.rows[0];
    
    // Cache the new record and invalidate list caches
    if (this.enableCacheByDefault) {
      await databaseCacheService.cacheFHIRResource(
        this.tableName,
        created.id,
        created,
        this.defaultCacheTtl
      );
      await databaseCacheService.invalidateByPattern(`${this.tableName}_list`);
    }
    
    return created;
  }

  /**
   * Update a record
   */
  async update(
    id: string,
    data: Partial<T>,
    options?: QueryOptions
  ): Promise<T | null> {
    const fields = Object.keys(data).filter(
      key => key !== 'id' && data[key as keyof T] !== undefined
    );
    
    if (fields.length === 0) {
      return this.findById(id, options);
    }

    const setClause = fields.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(key => data[key as keyof T] as QueryParameterValue)];

    const query = `
      UPDATE ${this.fullTableName}
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const useRetry = options?.useRetry ?? false;
    const result = useRetry 
      ? await databaseService.queryWithRetry<T>(query, values)
      : await this.query<T>(query, values, options);
      
    const updated = result.rows[0] ?? null;
    
    // Update cache and invalidate related caches
    if (updated && this.enableCacheByDefault) {
      await databaseCacheService.cacheFHIRResource(
        this.tableName,
        updated.id,
        updated,
        this.defaultCacheTtl
      );
      await databaseCacheService.invalidateByPattern(`${this.tableName}_list`);
    } else if (this.enableCacheByDefault) {
      await this.invalidateCache(id);
    }
    
    return updated;
  }

  /**
   * Delete a record
   */
  async delete(id: string, options?: QueryOptions): Promise<boolean> {
    const query = `DELETE FROM ${this.fullTableName} WHERE id = $1`;
    const useRetry = options?.useRetry ?? false;
    const result = useRetry 
      ? await databaseService.queryWithRetry(query, [id])
      : await this.query(query, [id], options);
    
    const deleted = (result.rowCount ?? 0) > 0;
    
    // Invalidate cache
    if (deleted && this.enableCacheByDefault) {
      await this.invalidateCache(id);
    }
    
    return deleted;
  }

  /**
   * Check if a record exists
   */
  async exists(id: string, options?: QueryOptions): Promise<boolean> {
    const query = `SELECT EXISTS(SELECT 1 FROM ${this.fullTableName} WHERE id = $1)`;
    const result = await this.query<{ exists: boolean }>(query, [id], options);
    
    return result.rows[0]?.exists ?? false;
  }

  /**
   * Execute a raw query
   */
  async rawQuery<R extends QueryResultRow = QueryResultRow>(
    query: string,
    params?: QueryParameters,
    options?: QueryOptions
  ): Promise<QueryResult<R>> {
    return this.query<R>(query, params, options);
  }

  /**
   * Batch insert records
   */
  async batchInsert(records: Partial<T>[], options?: QueryOptions): Promise<T[]> {
    if (records.length === 0) {
      return [];
    }

    // Get all unique fields from all records
    const allFields = new Set<string>();
    records.forEach(record => {
      Object.keys(record).forEach(key => {
        if (record[key as keyof T] !== undefined) {
          allFields.add(key);
        }
      });
    });

    const fields = Array.from(allFields);
    const values: QueryParameters = [];
    const valueRows: string[] = [];

    records.forEach((record, recordIndex) => {
      const recordValues = fields.map((field, fieldIndex) => {
        const value = record[field as keyof T];
        const paramIndex = recordIndex * fields.length + fieldIndex + 1;
        values.push(value !== undefined ? value as QueryParameterValue : null);
        return `$${paramIndex}`;
      });
      valueRows.push(`(${recordValues.join(', ')})`);
    });

    const query = `
      INSERT INTO ${this.fullTableName} (${fields.join(', ')})
      VALUES ${valueRows.join(', ')}
      RETURNING *
    `;

    const result = await this.query<T>(query, values, options);
    return result.rows;
  }

  /**
   * Delete records by filter
   */
  async deleteWhere(
    filters: DatabaseFilters,
    options?: QueryOptions
  ): Promise<number> {
    const whereConditions: string[] = [];
    const params: QueryParameters = [];
    let paramCount = 0;

    Object.entries(filters)
      .filter(([_, value]) => value !== undefined)
      .forEach(([key, value]) => {
        paramCount++;
        params.push(value);
        whereConditions.push(`${key} = $${paramCount}`);
      });

    if (whereConditions.length === 0) {
      throw new Error('No filters provided for deleteWhere operation');
    }

    const query = `
      DELETE FROM ${this.fullTableName}
      WHERE ${whereConditions.join(' AND ')}
    `;

    const result = await this.query(query, params, options);
    return result.rowCount ?? 0;
  }
}