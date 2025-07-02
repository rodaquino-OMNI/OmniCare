/**
 * OmniCare EMR Backend - Optimized Patient Service
 * Provides high-performance patient data operations with intelligent caching
 */

import { FHIRSearchParams } from '../types/fhir';
import logger from '../utils/logger';

import { databaseOptimizationService } from './database-optimization.service';
import { databaseService } from './database.service';
import { redisCacheService } from './redis-cache.service';


export interface PatientSummary {
  id: string;
  identifier: string;
  name: {
    family: string;
    given: string[];
  };
  birthDate: string;
  gender: string;
  contact?: {
    phone?: string;
    email?: string;
  };
  lastUpdated: string;
  encounterCount: number;
  activeProblems: number;
  activeMedications: number;
  recentVitals?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    weight?: number;
    timestamp: string;
  };
}

export interface PatientSearchResult {
  patients: PatientSummary[];
  total: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  searchTime: number;
  cacheHit: boolean;
}

export interface PatientCacheMetrics {
  totalCachedPatients: number;
  cacheHitRate: number;
  averageQueryTime: number;
  mostAccessedPatients: Array<{ patientId: string; accessCount: number }>;
}

export class OptimizedPatientService {
  private readonly cacheTtl = {
    patientSummary: 900,     // 15 minutes
    patientSearch: 300,      // 5 minutes  
    patientDetails: 1200,    // 20 minutes
    patientTimeline: 600,    // 10 minutes
    vitals: 180,             // 3 minutes
    demographics: 3600,      // 1 hour
  };

  private readonly cachePrefix = 'patient';

  /**
   * Get patient summary with intelligent caching
   */
  async getPatientSummary(patientId: string, forceRefresh = false): Promise<PatientSummary | null> {
    const startTime = Date.now();
    const cacheKey = `${this.cachePrefix}:summary:${patientId}`;

    try {
      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cached = await redisCacheService.get<PatientSummary>(cacheKey);
        if (cached) {
          await this.trackCacheAccess(patientId, 'summary', true);
          logger.debug('Patient summary served from cache', { patientId });
          return cached;
        }
      }

      // Build optimized query
      const query = `
        SELECT 
          p.id,
          p.identifier,
          p.family_name,
          p.given_names,
          p.birth_date,
          p.gender,
          p.phone,
          p.email,
          p.last_updated,
          COUNT(DISTINCT e.id) as encounter_count,
          COUNT(DISTINCT pr.id) as active_problems,
          COUNT(DISTINCT m.id) as active_medications
        FROM patients p
        LEFT JOIN encounters e ON p.id = e.patient_id AND e.status = 'active'
        LEFT JOIN problems pr ON p.id = pr.patient_id AND pr.status = 'active'
        LEFT JOIN medications m ON p.id = m.patient_id AND m.status = 'active'
        WHERE p.id = $1
        GROUP BY p.id, p.identifier, p.family_name, p.given_names, p.birth_date, 
                 p.gender, p.phone, p.email, p.last_updated
      `;

      const result = await databaseOptimizationService.executeOptimizedQuery(
        query,
        [patientId],
        { enableCache: true, maxRetries: 2 }
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Get recent vitals
      const vitalsQuery = `
        SELECT 
          blood_pressure,
          heart_rate,
          temperature,
          weight,
          recorded_at
        FROM patient_vitals 
        WHERE patient_id = $1 
        ORDER BY recorded_at DESC 
        LIMIT 1
      `;

      const vitalsResult = await databaseOptimizationService.executeOptimizedQuery(
        vitalsQuery,
        [patientId],
        { enableCache: true }
      );

      const patientSummary: PatientSummary = {
        id: row.id,
        identifier: row.identifier,
        name: {
          family: row.family_name,
          given: row.given_names?.split(' ') || [],
        },
        birthDate: row.birth_date,
        gender: row.gender,
        contact: {
          phone: row.phone,
          email: row.email,
        },
        lastUpdated: row.last_updated,
        encounterCount: parseInt(row.encounter_count, 10),
        activeProblems: parseInt(row.active_problems, 10),
        activeMedications: parseInt(row.active_medications, 10),
        recentVitals: vitalsResult.rows.length > 0 ? {
          bloodPressure: vitalsResult.rows[0].blood_pressure,
          heartRate: vitalsResult.rows[0].heart_rate,
          temperature: vitalsResult.rows[0].temperature,
          weight: vitalsResult.rows[0].weight,
          timestamp: vitalsResult.rows[0].recorded_at,
        } : undefined,
      };

      // Cache the result with adaptive TTL based on update frequency
      const adaptiveTtl = this.calculateAdaptiveTtl(patientSummary.lastUpdated, this.cacheTtl.patientSummary);
      await redisCacheService.set(cacheKey, patientSummary, { ttl: adaptiveTtl });

      await this.trackCacheAccess(patientId, 'summary', false);
      await this.trackQueryPerformance('getPatientSummary', Date.now() - startTime);

      return patientSummary;
    } catch (error) {
      logger.error('Failed to get patient summary:', error);
      throw error;
    }
  }

  /**
   * Search patients with intelligent caching and pagination
   */
  async searchPatients(
    searchParams: FHIRSearchParams,
    page = 1,
    pageSize = 20
  ): Promise<PatientSearchResult> {
    const startTime = Date.now();
    
    // Generate cache key based on search parameters
    const cacheKey = this.generateSearchCacheKey(searchParams, page, pageSize);
    
    try {
      // Check cache for non-real-time searches
      if (this.isCacheableSearch(searchParams)) {
        const cached = await redisCacheService.get<PatientSearchResult>(cacheKey);
        if (cached) {
          cached.cacheHit = true;
          cached.searchTime = Date.now() - startTime;
          logger.debug('Patient search served from cache', { searchParams });
          return cached;
        }
      }

      // Build optimized search query
      const { query, params, countQuery } = this.buildSearchQuery(searchParams, page, pageSize);

      // Execute queries in parallel
      const [searchResult, countResult] = await Promise.all([
        databaseOptimizationService.executeOptimizedQuery(query, params, { enableCache: true }),
        databaseOptimizationService.executeOptimizedQuery(countQuery, params.slice(0, -2), { enableCache: true })
      ]);

      const total = parseInt(countResult.rows[0]?.total || '0', 10);
      const totalPages = Math.ceil(total / pageSize);

      // Transform results to patient summaries
      const patients: PatientSummary[] = await this.transformSearchResults(searchResult.rows);

      const result: PatientSearchResult = {
        patients,
        total,
        pageSize,
        currentPage: page,
        totalPages,
        searchTime: Date.now() - startTime,
        cacheHit: false,
      };

      // Cache results if appropriate
      if (this.isCacheableSearch(searchParams)) {
        const searchCacheTtl = this.calculateSearchCacheTtl(searchParams);
        await redisCacheService.set(cacheKey, result, { ttl: searchCacheTtl });
      }

      await this.trackQueryPerformance('searchPatients', result.searchTime);

      return result;
    } catch (error) {
      logger.error('Failed to search patients:', error);
      throw error;
    }
  }

  /**
   * Get patient timeline with smart caching
   */
  async getPatientTimeline(
    patientId: string,
    fromDate?: string,
    toDate?: string,
    limit = 50
  ): Promise<any[]> {
    const cacheKey = `${this.cachePrefix}:timeline:${patientId}:${fromDate || 'all'}:${toDate || 'all'}:${limit}`;

    try {
      // Check cache
      const cached = await redisCacheService.get<any[]>(cacheKey);
      if (cached) {
        logger.debug('Patient timeline served from cache', { patientId });
        return cached;
      }

      // Build timeline query
      const query = `
        (
          SELECT 
            'encounter' as type,
            e.id,
            e.start_date as date,
            e.reason_code,
            e.status,
            json_build_object(
              'type', 'encounter',
              'reason', e.reason_code,
              'status', e.status,
              'provider', p.name
            ) as details
          FROM encounters e
          LEFT JOIN practitioners p ON e.practitioner_id = p.id
          WHERE e.patient_id = $1
          ${fromDate ? 'AND e.start_date >= $2' : ''}
          ${toDate ? `AND e.start_date <= $${fromDate ? '3' : '2'}` : ''}
        )
        UNION ALL
        (
          SELECT 
            'observation' as type,
            o.id,
            o.effective_date as date,
            o.code,
            'final' as status,
            json_build_object(
              'type', 'observation',
              'code', o.code,
              'value', o.value_quantity,
              'unit', o.value_unit
            ) as details
          FROM observations o
          WHERE o.patient_id = $1
          ${fromDate ? 'AND o.effective_date >= $2' : ''}
          ${toDate ? `AND o.effective_date <= $${fromDate ? '3' : '2'}` : ''}
        )
        ORDER BY date DESC
        LIMIT $${this.getParamIndex([patientId, fromDate, toDate].filter(Boolean).length)}
      `;

      const params = [patientId, fromDate, toDate, limit].filter(Boolean);
      const result = await databaseOptimizationService.executeOptimizedQuery(
        query,
        params,
        { enableCache: true }
      );

      const timeline = result.rows;

      // Cache with shorter TTL for recent data
      const timelineCacheTtl = this.calculateTimelineCacheTtl(fromDate, toDate);
      await redisCacheService.set(cacheKey, timeline, { ttl: timelineCacheTtl });

      return timeline;
    } catch (error) {
      logger.error('Failed to get patient timeline:', error);
      throw error;
    }
  }

  /**
   * Batch load patient summaries with optimized caching
   */
  async batchLoadPatientSummaries(patientIds: string[]): Promise<Map<string, PatientSummary>> {
    const result = new Map<string, PatientSummary>();
    
    if (patientIds.length === 0) {
      return result;
    }

    try {
      // Check cache for all patients
      const cacheKeys = patientIds.map(id => `${this.cachePrefix}:summary:${id}`);
      const cachedResults = await redisCacheService.mget<PatientSummary>(cacheKeys);

      const uncachedIds: string[] = [];
      
      // Process cached results
      patientIds.forEach((patientId, index) => {
        const cached = cachedResults[index];
        if (cached) {
          result.set(patientId, cached);
        } else {
          uncachedIds.push(patientId);
        }
      });

      // Fetch uncached patients in batch
      if (uncachedIds.length > 0) {
        const batchResults = await this.batchFetchPatientSummaries(uncachedIds);
        
        // Cache the results
        const cachePromises: Promise<boolean>[] = [];
        for (const [patientId, summary] of batchResults.entries()) {
          result.set(patientId, summary);
          
          const cacheKey = `${this.cachePrefix}:summary:${patientId}`;
          const adaptiveTtl = this.calculateAdaptiveTtl(summary.lastUpdated, this.cacheTtl.patientSummary);
          cachePromises.push(redisCacheService.set(cacheKey, summary, { ttl: adaptiveTtl }));
        }
        
        await Promise.all(cachePromises);
      }

      logger.info('Batch loaded patient summaries', {
        total: patientIds.length,
        cached: patientIds.length - uncachedIds.length,
        fetched: uncachedIds.length,
      });

      return result;
    } catch (error) {
      logger.error('Failed to batch load patient summaries:', error);
      throw error;
    }
  }

  /**
   * Invalidate patient cache
   */
  async invalidatePatientCache(patientId: string): Promise<void> {
    try {
      const patterns = [
        `${this.cachePrefix}:summary:${patientId}`,
        `${this.cachePrefix}:timeline:${patientId}:*`,
        `${this.cachePrefix}:details:${patientId}`,
        `${this.cachePrefix}:vitals:${patientId}:*`,
      ];

      for (const pattern of patterns) {
        if (pattern.includes('*')) {
          await redisCacheService.clearPattern(pattern);
        } else {
          await redisCacheService.del(pattern);
        }
      }

      logger.debug('Patient cache invalidated', { patientId });
    } catch (error) {
      logger.error('Failed to invalidate patient cache:', error);
    }
  }

  /**
   * Get cache metrics
   */
  async getCacheMetrics(): Promise<PatientCacheMetrics> {
    try {
      const cacheStats = await redisCacheService.getStats();
      
      // Get access patterns
      const accessKeys = await redisCacheService.keys('patient:access:*');
      const accessCounts: Array<{ patientId: string; accessCount: number }> = [];
      
      for (const key of accessKeys.slice(0, 100)) { // Limit for performance
        const count = await redisCacheService.get<number>(key);
        if (count) {
          const patientId = key.split(':')[2];
          accessCounts.push({ patientId, accessCount: count });
        }
      }

      accessCounts.sort((a, b) => b.accessCount - a.accessCount);

      // Get query performance metrics
      const queryMetrics = await this.getQueryPerformanceMetrics();

      return {
        totalCachedPatients: await this.countCachedPatients(),
        cacheHitRate: cacheStats.hitRatio,
        averageQueryTime: queryMetrics.averageQueryTime,
        mostAccessedPatients: accessCounts.slice(0, 10),
      };
    } catch (error) {
      logger.error('Failed to get cache metrics:', error);
      return {
        totalCachedPatients: 0,
        cacheHitRate: 0,
        averageQueryTime: 0,
        mostAccessedPatients: [],
      };
    }
  }

  // Private helper methods

  private async batchFetchPatientSummaries(patientIds: string[]): Promise<Map<string, PatientSummary>> {
    const result = new Map<string, PatientSummary>();
    
    if (patientIds.length === 0) {
      return result;
    }

    const placeholders = patientIds.map((_, index) => `$${index + 1}`).join(',');
    
    const query = `
      SELECT 
        p.id,
        p.identifier,
        p.family_name,
        p.given_names,
        p.birth_date,
        p.gender,
        p.phone,
        p.email,
        p.last_updated,
        COALESCE(e.encounter_count, 0) as encounter_count,
        COALESCE(pr.problem_count, 0) as active_problems,
        COALESCE(m.medication_count, 0) as active_medications
      FROM patients p
      LEFT JOIN (
        SELECT patient_id, COUNT(*) as encounter_count
        FROM encounters
        WHERE patient_id IN (${placeholders}) AND status = 'active'
        GROUP BY patient_id
      ) e ON p.id = e.patient_id
      LEFT JOIN (
        SELECT patient_id, COUNT(*) as problem_count
        FROM problems
        WHERE patient_id IN (${placeholders}) AND status = 'active'
        GROUP BY patient_id
      ) pr ON p.id = pr.patient_id
      LEFT JOIN (
        SELECT patient_id, COUNT(*) as medication_count
        FROM medications
        WHERE patient_id IN (${placeholders}) AND status = 'active'
        GROUP BY patient_id
      ) m ON p.id = m.patient_id
      WHERE p.id IN (${placeholders})
    `;

    const queryResult = await databaseOptimizationService.executeOptimizedQuery(
      query,
      patientIds,
      { enableCache: true }
    );

    for (const row of queryResult.rows) {
      const patientSummary: PatientSummary = {
        id: row.id,
        identifier: row.identifier,
        name: {
          family: row.family_name,
          given: row.given_names?.split(' ') || [],
        },
        birthDate: row.birth_date,
        gender: row.gender,
        contact: {
          phone: row.phone,
          email: row.email,
        },
        lastUpdated: row.last_updated,
        encounterCount: parseInt(row.encounter_count, 10),
        activeProblems: parseInt(row.active_problems, 10),
        activeMedications: parseInt(row.active_medications, 10),
      };

      result.set(row.id, patientSummary);
    }

    return result;
  }

  private buildSearchQuery(searchParams: FHIRSearchParams, page: number, pageSize: number) {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions based on search parameters
    if (searchParams.name) {
      conditions.push(`(p.family_name ILIKE $${paramIndex} OR p.given_names ILIKE $${paramIndex})`);
      params.push(`%${searchParams.name}%`);
      paramIndex++;
    }

    if (searchParams.identifier) {
      conditions.push(`p.identifier = $${paramIndex}`);
      params.push(searchParams.identifier);
      paramIndex++;
    }

    if (searchParams.birthdate) {
      conditions.push(`p.birth_date = $${paramIndex}`);
      params.push(searchParams.birthdate);
      paramIndex++;
    }

    if (searchParams.gender) {
      conditions.push(`p.gender = $${paramIndex}`);
      params.push(searchParams.gender);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        p.id,
        p.identifier,
        p.family_name,
        p.given_names,
        p.birth_date,
        p.gender,
        p.phone,
        p.email,
        p.last_updated
      FROM patients p
      ${whereClause}
      ORDER BY p.family_name, p.given_names
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM patients p
      ${whereClause}
    `;

    params.push(pageSize, (page - 1) * pageSize);

    return { query, params, countQuery };
  }

  private async transformSearchResults(rows: any[]): Promise<PatientSummary[]> {
    return rows.map(row => ({
      id: row.id,
      identifier: row.identifier,
      name: {
        family: row.family_name,
        given: row.given_names?.split(' ') || [],
      },
      birthDate: row.birth_date,
      gender: row.gender,
      contact: {
        phone: row.phone,
        email: row.email,
      },
      lastUpdated: row.last_updated,
      encounterCount: 0, // Will be populated by separate queries if needed
      activeProblems: 0,
      activeMedications: 0,
    }));
  }

  private generateSearchCacheKey(searchParams: FHIRSearchParams, page: number, pageSize: number): string {
    const searchKey = Object.keys(searchParams)
      .sort()
      .map(key => `${key}=${searchParams[key]}`)
      .join('&');
    
    return `${this.cachePrefix}:search:${Buffer.from(searchKey).toString('base64')}:${page}:${pageSize}`;
  }

  private isCacheableSearch(searchParams: FHIRSearchParams): boolean {
    // Don't cache searches with _lastUpdated or other time-sensitive parameters
    return !searchParams._lastUpdated && !searchParams._since;
  }

  private calculateAdaptiveTtl(lastUpdated: string, baseTtl: number): number {
    const now = Date.now();
    const lastUpdateTime = new Date(lastUpdated).getTime();
    const timeSinceUpdate = now - lastUpdateTime;
    
    // Longer cache for older data
    if (timeSinceUpdate > 7 * 24 * 60 * 60 * 1000) { // 7 days
      return baseTtl * 2;
    } else if (timeSinceUpdate > 24 * 60 * 60 * 1000) { // 1 day
      return baseTtl * 1.5;
    }
    
    return baseTtl;
  }

  private calculateSearchCacheTtl(searchParams: FHIRSearchParams): number {
    // Shorter cache for specific searches
    if (searchParams.identifier) {
      return this.cacheTtl.patientSearch * 2; // Identifier searches change less frequently
    }
    
    return this.cacheTtl.patientSearch;
  }

  private calculateTimelineCacheTtl(fromDate?: string, toDate?: string): number {
    // Shorter cache for recent timelines
    if (!fromDate || new Date(fromDate).getTime() > Date.now() - 24 * 60 * 60 * 1000) {
      return this.cacheTtl.vitals; // 3 minutes for recent data
    }
    
    return this.cacheTtl.patientTimeline;
  }

  private getParamIndex(params: any[]): number {
    return params.length + 1;
  }

  private async trackCacheAccess(patientId: string, operation: string, isHit: boolean): Promise<void> {
    try {
      const accessKey = `patient:access:${patientId}`;
      const hitKey = `patient:cache:${operation}:${isHit ? 'hits' : 'misses'}`;
      
      await Promise.all([
        redisCacheService.incr(accessKey),
        redisCacheService.incr(hitKey),
      ]);
    } catch (error) {
      // Don't throw - tracking is not critical
      logger.debug('Failed to track cache access:', error);
    }
  }

  private async trackQueryPerformance(operation: string, executionTime: number): Promise<void> {
    try {
      const performanceKey = `patient:performance:${operation}`;
      const currentData = await redisCacheService.get<{ count: number; totalTime: number }>(performanceKey);
      
      const newData = {
        count: (currentData?.count || 0) + 1,
        totalTime: (currentData?.totalTime || 0) + executionTime,
      };
      
      await redisCacheService.set(performanceKey, newData, { ttl: 3600 }); // 1 hour
    } catch (error) {
      logger.debug('Failed to track query performance:', error);
    }
  }

  private async countCachedPatients(): Promise<number> {
    try {
      const keys = await redisCacheService.keys(`${this.cachePrefix}:summary:*`);
      return keys.length;
    } catch (error) {
      return 0;
    }
  }

  private async getQueryPerformanceMetrics(): Promise<{ averageQueryTime: number }> {
    try {
      const performanceKeys = await redisCacheService.keys('patient:performance:*');
      let totalQueries = 0;
      let totalTime = 0;

      for (const key of performanceKeys) {
        const data = await redisCacheService.get<{ count: number; totalTime: number }>(key);
        if (data) {
          totalQueries += data.count;
          totalTime += data.totalTime;
        }
      }

      return {
        averageQueryTime: totalQueries > 0 ? totalTime / totalQueries : 0,
      };
    } catch (error) {
      return { averageQueryTime: 0 };
    }
  }
}

// Export singleton instance
export const optimizedPatientService = new OptimizedPatientService();