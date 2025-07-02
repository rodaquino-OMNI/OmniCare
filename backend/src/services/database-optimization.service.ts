/**
 * OmniCare EMR Backend - Database Optimization Service
 * Provides advanced database optimization features and query analysis
 */

import { QueryResult, QueryResultRow } from 'pg';

import { databaseService } from './database.service';
import { redisCacheService } from './redis-cache.service';

import logger from '@/utils/logger';

export interface QueryOptimizationOptions {
  enableCache?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  useReadReplica?: boolean;
  timeout?: number;
}

export interface QueryPerformanceMetrics {
  queryHash: string;
  averageExecutionTime: number;
  executionCount: number;
  slowQueryCount: number;
  errorCount: number;
  cacheHitRate: number;
}

export interface DatabaseIndexSuggestion {
  table: string;
  columns: string[];
  reason: string;
  estimatedImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  createStatement: string;
}

export class DatabaseOptimizationService {
  private queryMetrics = new Map<string, QueryPerformanceMetrics>();
  private readonly slowQueryThreshold = 1000; // 1 second
  private readonly cachePrefix = 'db_opt';

  /**
   * Execute optimized query with caching and performance tracking
   */
  async executeOptimizedQuery<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
    options: QueryOptimizationOptions = {}
  ): Promise<QueryResult<T>> {
    const {
      enableCache = false,
      maxRetries = 3,
      retryDelay = 1000,
      useReadReplica = false,
      timeout = 30000
    } = options;

    const queryHash = this.generateQueryHash(sql, params);
    const startTime = Date.now();

    // Try cache first for read queries
    if (enableCache && this.isReadOnlyQuery(sql)) {
      const cacheKey = `${this.cachePrefix}:query:${queryHash}`;
      const cached = await redisCacheService.get<QueryResult<T>>(cacheKey);
      
      if (cached) {
        this.updateCacheMetrics(queryHash, true);
        logger.debug('Query served from cache', { queryHash, sql: sql.substring(0, 50) });
        return cached;
      }
    }

    let lastError: Error | null = null;
    let result: QueryResult<T> | null = null;

    // Execute with retries
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const queryPromise = useReadReplica && this.isReadOnlyQuery(sql)
          ? this.executeReadReplicaQuery<T>(sql, params)
          : databaseService.query<T>(sql, params);

        // Add timeout
        result = await Promise.race([
          queryPromise,
          this.createTimeoutPromise<QueryResult<T>>(timeout)
        ]);

        break; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;
        
        if (this.isNonRetryableError(error) || attempt === maxRetries) {
          break;
        }
        
        logger.warn(`Query failed, retrying (attempt ${attempt + 1}/${maxRetries})`, {
          queryHash,
          error: (error as Error).message,
          sql: sql.substring(0, 50)
        });
        
        await this.delay(retryDelay * (attempt + 1));
      }
    }

    if (!result) {
      this.updateQueryMetrics(queryHash, Date.now() - startTime, true);
      throw lastError || new Error('Query execution failed');
    }

    const executionTime = Date.now() - startTime;
    this.updateQueryMetrics(queryHash, executionTime, false);

    // Cache successful read queries
    if (enableCache && this.isReadOnlyQuery(sql) && result) {
      const cacheKey = `${this.cachePrefix}:query:${queryHash}`;
      const cacheTtl = this.calculateCacheTtl(sql, executionTime);
      await redisCacheService.set(cacheKey, result, { ttl: cacheTtl });
      this.updateCacheMetrics(queryHash, false);
    }

    return result;
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  async analyzeQueryPerformance(sql: string, params?: unknown[]): Promise<{
    executionPlan: any;
    suggestions: string[];
    estimatedCost: number;
  }> {
    try {
      // Get query execution plan
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
      const explainResult = await databaseService.query(explainQuery, params);
      const plan = explainResult.rows[0]?.['QUERY PLAN']?.[0];

      const suggestions: string[] = [];
      let estimatedCost = 0;

      if (plan) {
        estimatedCost = plan['Total Cost'] || 0;
        
        // Analyze for optimization opportunities
        this.analyzePlanForOptimizations(plan, suggestions);
      }

      return {
        executionPlan: plan,
        suggestions,
        estimatedCost
      };
    } catch (error) {
      logger.error('Failed to analyze query performance:', error);
      return {
        executionPlan: null,
        suggestions: ['Unable to analyze query - check syntax'],
        estimatedCost: 0
      };
    }
  }

  /**
   * Get database index suggestions based on query patterns
   */
  async generateIndexSuggestions(): Promise<DatabaseIndexSuggestion[]> {
    const suggestions: DatabaseIndexSuggestion[] = [];

    try {
      // Find missing indexes based on slow queries
      const slowQueriesQuery = `
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation,
          most_common_vals
        FROM pg_stats 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
        ORDER BY tablename, attname;
      `;

      const stats = await databaseService.query(slowQueriesQuery);
      
      // Analyze query patterns and suggest indexes
      for (const queryHash of this.queryMetrics.keys()) {
        const metrics = this.queryMetrics.get(queryHash);
        if (metrics && metrics.slowQueryCount > 5) {
          // This is a frequently slow query, suggest optimization
          suggestions.push({
            table: 'unknown', // Would need query parsing to determine
            columns: ['unknown'],
            reason: `Query executed ${metrics.executionCount} times with ${metrics.slowQueryCount} slow executions`,
            estimatedImpact: metrics.slowQueryCount > 20 ? 'HIGH' : 'MEDIUM',
            createStatement: '-- Query analysis needed to generate specific index'
          });
        }
      }

      // Add common index suggestions
      suggestions.push(...this.getCommonIndexSuggestions());

    } catch (error) {
      logger.error('Failed to generate index suggestions:', error);
    }

    return suggestions;
  }

  /**
   * Optimize database connection pool based on usage patterns
   */
  async optimizeConnectionPool(): Promise<{
    currentSettings: any;
    recommendations: string[];
    suggestedChanges: Record<string, number>;
  }> {
    const poolStats = databaseService.getPoolStats();
    const queryMetrics = this.getOverallQueryMetrics();
    
    const recommendations: string[] = [];
    const suggestedChanges: Record<string, number> = {};

    // Analyze pool utilization
    const utilizationRate = poolStats.total > 0 
      ? (poolStats.total - poolStats.idle) / poolStats.total 
      : 0;

    if (utilizationRate > 0.8) {
      recommendations.push('High pool utilization detected - consider increasing pool size');
      suggestedChanges.maxConnections = Math.ceil(poolStats.total * 1.5);
    } else if (utilizationRate < 0.3) {
      recommendations.push('Low pool utilization - consider reducing pool size');
      suggestedChanges.maxConnections = Math.max(5, Math.ceil(poolStats.total * 0.7));
    }

    if (poolStats.waiting > 0) {
      recommendations.push('Connections waiting - increase pool size or optimize queries');
    }

    if (queryMetrics.averageLatency > 500) {
      recommendations.push('High average query latency - review slow queries and add indexes');
    }

    return {
      currentSettings: {
        totalConnections: poolStats.total,
        idleConnections: poolStats.idle,
        waitingConnections: poolStats.waiting,
        utilizationRate: Math.round(utilizationRate * 100)
      },
      recommendations,
      suggestedChanges
    };
  }

  /**
   * Run database maintenance tasks
   */
  async runMaintenance(): Promise<{
    tablesAnalyzed: number;
    indexesRebuilt: number;
    vacuumCompleted: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let tablesAnalyzed = 0;
    const indexesRebuilt = 0;
    let vacuumCompleted = false;

    try {
      // Get list of tables to maintain
      const tablesQuery = `
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      `;
      
      const tables = await databaseService.query(tablesQuery);

      // Analyze tables for better query planning
      for (const table of tables.rows) {
        try {
          await databaseService.query(`ANALYZE "${table.schemaname}"."${table.tablename}"`);
          tablesAnalyzed++;
        } catch (error) {
          errors.push(`Failed to analyze ${table.schemaname}.${table.tablename}: ${(error as Error).message}`);
        }
      }

      // Run vacuum to reclaim space and update statistics
      try {
        await databaseService.query('VACUUM (ANALYZE, VERBOSE)');
        vacuumCompleted = true;
      } catch (error) {
        errors.push(`Vacuum failed: ${(error as Error).message}`);
      }

      logger.info('Database maintenance completed', {
        tablesAnalyzed,
        indexesRebuilt,
        vacuumCompleted,
        errorCount: errors.length
      });

    } catch (error) {
      errors.push(`Maintenance failed: ${(error as Error).message}`);
    }

    return {
      tablesAnalyzed,
      indexesRebuilt,
      vacuumCompleted,
      errors
    };
  }

  /**
   * Get overall query performance metrics
   */
  getOverallQueryMetrics() {
    let totalQueries = 0;
    let totalSlowQueries = 0;
    let totalErrors = 0;
    let totalExecutionTime = 0;
    let totalCacheHits = 0;
    let totalCacheAttempts = 0;

    for (const metrics of this.queryMetrics.values()) {
      totalQueries += metrics.executionCount;
      totalSlowQueries += metrics.slowQueryCount;
      totalErrors += metrics.errorCount;
      totalExecutionTime += metrics.averageExecutionTime * metrics.executionCount;
      totalCacheHits += metrics.cacheHitRate * metrics.executionCount;
      totalCacheAttempts += metrics.executionCount;
    }

    return {
      totalQueries,
      slowQueryCount: totalSlowQueries,
      errorCount: totalErrors,
      averageLatency: totalQueries > 0 ? totalExecutionTime / totalQueries : 0,
      slowQueryRate: totalQueries > 0 ? totalSlowQueries / totalQueries : 0,
      errorRate: totalQueries > 0 ? totalErrors / totalQueries : 0,
      cacheHitRate: totalCacheAttempts > 0 ? totalCacheHits / totalCacheAttempts : 0
    };
  }

  /**
   * Clear all performance metrics
   */
  clearMetrics(): void {
    this.queryMetrics.clear();
    logger.info('Database optimization metrics cleared');
  }

  // Private helper methods

  private generateQueryHash(sql: string, params?: unknown[]): string {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();
    const paramsStr = params ? JSON.stringify(params) : '';
    return Buffer.from(`${normalizedSql}:${paramsStr}`).toString('base64').slice(0, 32);
  }

  private isReadOnlyQuery(sql: string): boolean {
    const trimmed = sql.trim().toLowerCase();
    return trimmed.startsWith('select') || 
           trimmed.startsWith('with') || 
           trimmed.startsWith('show') ||
           trimmed.startsWith('explain');
  }

  private isNonRetryableError(error: unknown): boolean {
    const message = (error as Error).message?.toLowerCase() || '';
    return message.includes('syntax error') ||
           message.includes('constraint') ||
           message.includes('duplicate key') ||
           message.includes('foreign key') ||
           message.includes('not null violation');
  }

  private async executeReadReplicaQuery<T extends QueryResultRow = QueryResultRow>(
    sql: string, 
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    // For now, use the main database
    // In production, this would route to read replicas
    return databaseService.query<T>(sql, params);
  }

  private createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateQueryMetrics(queryHash: string, executionTime: number, isError: boolean): void {
    const existing = this.queryMetrics.get(queryHash) || {
      queryHash,
      averageExecutionTime: 0,
      executionCount: 0,
      slowQueryCount: 0,
      errorCount: 0,
      cacheHitRate: 0
    };

    existing.executionCount++;
    
    if (isError) {
      existing.errorCount++;
    } else {
      // Update average execution time
      existing.averageExecutionTime = 
        (existing.averageExecutionTime * (existing.executionCount - 1) + executionTime) / 
        existing.executionCount;
      
      if (executionTime > this.slowQueryThreshold) {
        existing.slowQueryCount++;
      }
    }

    this.queryMetrics.set(queryHash, existing);
  }

  private updateCacheMetrics(queryHash: string, wasHit: boolean): void {
    const existing = this.queryMetrics.get(queryHash);
    if (existing) {
      const totalAttempts = existing.executionCount || 1;
      const currentHits = existing.cacheHitRate * totalAttempts;
      existing.cacheHitRate = wasHit 
        ? (currentHits + 1) / (totalAttempts + 1)
        : currentHits / (totalAttempts + 1);
      
      this.queryMetrics.set(queryHash, existing);
    }
  }

  private calculateCacheTtl(sql: string, executionTime: number): number {
    // Base TTL on query execution time and type
    let baseTtl = 300; // 5 minutes default

    // Longer cache for expensive queries
    if (executionTime > 5000) {
      baseTtl = 1800; // 30 minutes
    } else if (executionTime > 1000) {
      baseTtl = 900; // 15 minutes
    }

    // Adjust based on query patterns
    if (sql.toLowerCase().includes('order by')) {
      baseTtl *= 0.5; // Shorter cache for sorted results
    }

    if (sql.toLowerCase().includes('limit')) {
      baseTtl *= 0.7; // Shorter cache for paginated results
    }

    return Math.floor(baseTtl);
  }

  private analyzePlanForOptimizations(plan: any, suggestions: string[]): void {
    if (!plan) return;

    // Check for sequential scans
    if (plan['Node Type'] === 'Seq Scan') {
      suggestions.push(`Sequential scan detected on ${plan['Relation Name']} - consider adding an index`);
    }

    // Check for high cost operations
    if (plan['Total Cost'] > 1000) {
      suggestions.push('High-cost operation detected - review query structure and indexes');
    }

    // Check for sort operations
    if (plan['Node Type'] === 'Sort' && plan['Sort Method'] === 'external sort') {
      suggestions.push('External sort detected - consider increasing work_mem or adding an index');
    }

    // Recursively analyze child nodes
    if (plan.Plans) {
      for (const childPlan of plan.Plans) {
        this.analyzePlanForOptimizations(childPlan, suggestions);
      }
    }
  }

  private getCommonIndexSuggestions(): DatabaseIndexSuggestion[] {
    return [
      {
        table: 'audit.transaction_checkpoints',
        columns: ['transaction_id', 'created_at'],
        reason: 'Frequently queried for transaction resume operations',
        estimatedImpact: 'HIGH',
        createStatement: 'CREATE INDEX CONCURRENTLY idx_transaction_checkpoints_composite ON audit.transaction_checkpoints(transaction_id, created_at);'
      },
      {
        table: 'fhir_resources',
        columns: ['resource_type', 'last_updated'],
        reason: 'Common filtering pattern for FHIR resource queries',
        estimatedImpact: 'HIGH',
        createStatement: 'CREATE INDEX CONCURRENTLY idx_fhir_resources_type_updated ON fhir_resources(resource_type, last_updated);'
      },
      {
        table: 'patient_data',
        columns: ['patient_id', 'encounter_id'],
        reason: 'Patient-specific data access patterns',
        estimatedImpact: 'MEDIUM',
        createStatement: 'CREATE INDEX CONCURRENTLY idx_patient_data_composite ON patient_data(patient_id, encounter_id);'
      }
    ];
  }
}

// Export singleton instance
export const databaseOptimizationService = new DatabaseOptimizationService();