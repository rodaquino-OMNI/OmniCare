/**
 * OmniCare EMR Backend - Base Repository
 * Base class for all database repositories with common CRUD operations
 */

import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { databaseService } from '@/services/database.service';
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
}

export abstract class BaseRepository<T extends BaseEntity> {
  protected abstract tableName: string;
  protected abstract schema: string;

  /**
   * Get fully qualified table name
   */
  protected get fullTableName(): string {
    return `${this.schema}.${this.tableName}`;
  }

  /**
   * Execute a query with optional transaction client
   */
  protected async query<R extends QueryResultRow = any>(
    text: string,
    params?: any[],
    options?: QueryOptions
  ): Promise<QueryResult<R>> {
    if (options?.client) {
      return options.client.query<R>(text, params);
    }
    return databaseService.query<R>(text, params);
  }

  /**
   * Find a record by ID
   */
  async findById(id: string, options?: QueryOptions): Promise<T | null> {
    const query = `SELECT * FROM ${this.fullTableName} WHERE id = $1`;
    const result = await this.query<T>(query, [id], options);
    
    return result.rows[0] || null;
  }

  /**
   * Find all records with optional filtering
   */
  async findAll(
    filters?: Record<string, any>,
    findOptions?: FindOptions,
    queryOptions?: QueryOptions
  ): Promise<T[]> {
    let query = `SELECT * FROM ${this.fullTableName}`;
    const params: any[] = [];
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

    const result = await this.query<T>(query, params, queryOptions);
    return result.rows;
  }

  /**
   * Count records with optional filtering
   */
  async count(
    filters?: Record<string, any>,
    options?: QueryOptions
  ): Promise<number> {
    let query = `SELECT COUNT(*) FROM ${this.fullTableName}`;
    const params: any[] = [];
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
   * Create a new record
   */
  async create(data: Partial<T>, options?: QueryOptions): Promise<T> {
    const fields = Object.keys(data).filter(key => data[key as keyof T] !== undefined);
    const values = fields.map(key => data[key as keyof T]);
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');

    const query = `
      INSERT INTO ${this.fullTableName} (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.query<T>(query, values, options);
    if (!result.rows[0]) {
      throw new Error('Failed to create record');
    }
    return result.rows[0];
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
    const values = [id, ...fields.map(key => data[key as keyof T])];

    const query = `
      UPDATE ${this.fullTableName}
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.query<T>(query, values, options);
    return result.rows[0] ?? null;
  }

  /**
   * Delete a record
   */
  async delete(id: string, options?: QueryOptions): Promise<boolean> {
    const query = `DELETE FROM ${this.fullTableName} WHERE id = $1`;
    const result = await this.query(query, [id], options);
    
    return (result.rowCount ?? 0) > 0;
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
  async rawQuery<R extends QueryResultRow = any>(
    query: string,
    params?: any[],
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
    const values: any[] = [];
    const valueRows: string[] = [];

    records.forEach((record, recordIndex) => {
      const recordValues = fields.map((field, fieldIndex) => {
        const value = record[field as keyof T];
        const paramIndex = recordIndex * fields.length + fieldIndex + 1;
        values.push(value !== undefined ? value : null);
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
    filters: Record<string, any>,
    options?: QueryOptions
  ): Promise<number> {
    const whereConditions: string[] = [];
    const params: any[] = [];
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