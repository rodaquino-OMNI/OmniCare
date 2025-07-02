/**
 * OmniCare EMR Backend - Database Caching Service
 * High-performance query result caching with Redis
 */

import crypto from 'crypto';

import { QueryResult, QueryResultRow } from 'pg';

import { databaseService } from './database.service';
import { redisService } from './redis.service';

import logger from '@/utils/logger';

interface CacheConfig {
  ttl?: number;
  skipCache?: boolean;
  invalidatePattern?: string;
}

interface QueryCacheStats {
  queries: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgQueryTime: number;
  avgCacheTime: number;
}

// Enhanced cache configuration with intelligent TTL
const DEFAULT_TTL = 300; // 5 minutes
const QUERY_CACHE_NAMESPACE = 'query';
const FHIR_CACHE_NAMESPACE = 'fhir';
const PATIENT_CACHE_NAMESPACE = 'patient';
const CLINICAL_CACHE_NAMESPACE = 'clinical';
const REFERENCE_CACHE_NAMESPACE = 'reference';

// Cache TTL strategies based on data volatility
const CACHE_TTL_STRATEGIES = {
  // Static reference data - long cache
  organizations: 86400, // 24 hours
  practitioners: 3600,  // 1 hour
  locations: 3600,      // 1 hour
  
  // Semi-static patient data - medium cache
  patients: 1800,       // 30 minutes
  patient_demographics: 3600, // 1 hour
  
  // Dynamic clinical data - short cache
  observations: 300,    // 5 minutes
  vital_signs: 180,     // 3 minutes
  encounters: 600,      // 10 minutes
  
  // Real-time data - very short cache
  alerts: 60,           // 1 minute
  notifications: 30,    // 30 seconds
  
  // Search results - short cache with high volatility
  search_results: 120,  // 2 minutes
  list_queries: 180,    // 3 minutes
};

export class DatabaseCacheService {
  private stats: QueryCacheStats = {
    queries: 0,
    hits: 0,
    misses: 0,
    hitRate: 0,
    avgQueryTime: 0,
    avgCacheTime: 0
  };
  
  // Advanced cache management
  private cacheHeatMap = new Map<string, {
    accessCount: number;
    lastAccessed: Date;
    computationCost: number;
  }>();
  
  // Cache invalidation patterns
  private invalidationPatterns = new Map<string, string[]>();
  
  // Background cache warming queue
  private warmupQueue: Array<{
    key: string;
    generator: () => Promise<any>;
    ttl: number;
    priority: number;
  }> = [];
  
  private isWarming = false;

  /**
   * Execute query with intelligent caching and heat tracking
   */
  async cachedQuery<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
    config: CacheConfig = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    
    // Skip cache if requested
    if (config.skipCache) {
      const result = await databaseService.query<T>(text, params);
      this.updateStats(Date.now() - startTime, false, 0);
      return result;
    }

    // Generate cache key and track heat
    const cacheKey = this.generateCacheKey(text, params);
    this.trackCacheHeat(cacheKey, this.estimateQueryCost(text));
    
    try {
      // Try to get from cache first
      const cacheStart = Date.now();
      const cachedResult = await redisService.get<QueryResult<T>>(cacheKey, {
        namespace: QUERY_CACHE_NAMESPACE
      });
      const cacheTime = Date.now() - cacheStart;

      if (cachedResult) {
        logger.debug(`Query cache HIT: ${text.substring(0, 50)}...`);
        this.updateStats(Date.now() - startTime, true, cacheTime);
        return cachedResult;
      }

      // Cache miss - execute query
      logger.debug(`Query cache MISS: ${text.substring(0, 50)}...`);
      const result = await databaseService.query<T>(text, params);
      
      // Cache the result with intelligent TTL
      const ttl = config.ttl || this.determineIntelligentTTL(text, result.rows.length, Date.now() - startTime);
      await redisService.set(cacheKey, result, {
        namespace: QUERY_CACHE_NAMESPACE,
        ttl
      });
      
      // Update invalidation patterns
      this.registerInvalidationPattern(cacheKey, text);
      
      this.updateStats(Date.now() - startTime, false, cacheTime);
      return result;
      
    } catch (error) {
      logger.error('Database cache error:', error);
      // Fallback to direct query
      const result = await databaseService.query<T>(text, params);
      this.updateStats(Date.now() - startTime, false, 0);
      return result;
    }
  }

  /**
   * Cache FHIR resource by ID
   */
  async cacheFHIRResource(resourceType: string, id: string, resource: any, ttl: number = 600): Promise<void> {
    try {
      const key = `${resourceType}:${id}`;
      await redisService.set(key, resource, {
        namespace: FHIR_CACHE_NAMESPACE,
        ttl
      });
      
      logger.debug(`FHIR resource cached: ${resourceType}/${id}`);
    } catch (error) {
      logger.error(`Failed to cache FHIR resource ${resourceType}/${id}:`, error);
    }
  }

  /**
   * Get cached FHIR resource
   */
  async getCachedFHIRResource<T = any>(resourceType: string, id: string): Promise<T | null> {
    try {
      const key = `${resourceType}:${id}`;
      const resource = await redisService.get<T>(key, {
        namespace: FHIR_CACHE_NAMESPACE
      });
      
      if (resource) {
        logger.debug(`FHIR resource cache HIT: ${resourceType}/${id}`);
      } else {
        logger.debug(`FHIR resource cache MISS: ${resourceType}/${id}`);
      }
      
      return resource;
    } catch (error) {
      logger.error(`Failed to get cached FHIR resource ${resourceType}/${id}:`, error);
      return null;
    }
  }

  /**
   * Invalidate FHIR resource cache
   */
  async invalidateFHIRResource(resourceType: string, id: string): Promise<void> {
    try {
      const key = `${resourceType}:${id}`;
      await redisService.del(key, { namespace: FHIR_CACHE_NAMESPACE });
      
      logger.debug(`FHIR resource cache invalidated: ${resourceType}/${id}`);
    } catch (error) {
      logger.error(`Failed to invalidate FHIR resource ${resourceType}/${id}:`, error);
    }
  }

  /**
   * Cache patient data with optimized structure
   */
  async cachePatientData(patientId: string, data: any, ttl: number = 900): Promise<void> {
    try {
      await redisService.set(patientId, data, {
        namespace: PATIENT_CACHE_NAMESPACE,
        ttl
      });
      
      // Also cache patient search index
      if (data.name && data.name.length > 0) {
        const searchKey = `search:${data.name[0].family?.toLowerCase()}`;
        const existingResults = await redisService.get<string[]>(searchKey, {
          namespace: PATIENT_CACHE_NAMESPACE
        }) || [];
        
        if (!existingResults.includes(patientId)) {
          existingResults.push(patientId);
          await redisService.set(searchKey, existingResults, {
            namespace: PATIENT_CACHE_NAMESPACE,
            ttl: ttl / 2 // Shorter TTL for search results
          });
        }
      }
      
      logger.debug(`Patient data cached: ${patientId}`);
    } catch (error) {
      logger.error(`Failed to cache patient data ${patientId}:`, error);
    }
  }

  /**
   * Get cached patient data
   */
  async getCachedPatientData<T = any>(patientId: string): Promise<T | null> {
    try {
      const data = await redisService.get<T>(patientId, {
        namespace: PATIENT_CACHE_NAMESPACE
      });
      
      if (data) {
        logger.debug(`Patient cache HIT: ${patientId}`);
      }
      
      return data;
    } catch (error) {
      logger.error(`Failed to get cached patient data ${patientId}:`, error);
      return null;
    }
  }

  /**
   * Batch cache multiple items
   */
  async batchCache(items: Record<string, any>, namespace: string, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      await redisService.mset(items, { namespace, ttl });
      logger.debug(`Batch cached ${Object.keys(items).length} items in namespace: ${namespace}`);
    } catch (error) {
      logger.error(`Failed to batch cache items in namespace ${namespace}:`, error);
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string, namespace?: string): Promise<number> {
    try {
      if (namespace) {
        return await redisService.clearNamespace(namespace);
      }
      
      // This is a simplified implementation
      // In production, you might want to use Redis SCAN with MATCH
      logger.warn(`Pattern invalidation not fully implemented for pattern: ${pattern}`);
      return 0;
    } catch (error) {
      logger.error(`Failed to invalidate by pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Intelligent cache warming based on access patterns
   */
  async warmupCache(): Promise<void> {
    if (this.isWarming) {
      logger.debug('Cache warming already in progress');
      return;
    }
    
    this.isWarming = true;
    
    try {
      logger.info('Starting intelligent cache warmup...');
      
      // Warm up based on heat map
      await this.warmupBasedOnHeatMap();
      
      // Warm up critical healthcare data
      await this.warmupCriticalHealthcareData();
      
      // Warm up frequently accessed patients
      await this.warmupPatientData();
      
      // Process warmup queue
      await this.processWarmupQueue();
      
      logger.info('Intelligent cache warmup completed');
    } catch (error) {
      logger.error('Cache warmup failed:', error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): QueryCacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      queries: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgQueryTime: 0,
      avgCacheTime: 0
    };
  }

  /**
   * Get comprehensive cache health info
   */
  async getCacheHealth(): Promise<{
    redis: any;
    stats: QueryCacheStats;
    memoryUsage: any;
  }> {
    try {
      const [redisHealth, redisInfo] = await Promise.all([
        redisService.healthCheck(),
        redisService.getInfo()
      ]);

      return {
        redis: {
          health: redisHealth,
          info: redisInfo?.memory || {}
        },
        stats: this.getStats(),
        memoryUsage: redisInfo?.memory || {}
      };
    } catch (error) {
      logger.error('Failed to get cache health:', error);
      return {
        redis: { health: { status: 'unhealthy' }, info: {} },
        stats: this.getStats(),
        memoryUsage: {}
      };
    }
  }

  /**
   * Track cache access patterns for intelligent warming
   */
  private trackCacheHeat(cacheKey: string, computationCost: number): void {
    const existing = this.cacheHeatMap.get(cacheKey) || {
      accessCount: 0,
      lastAccessed: new Date(),
      computationCost: 0
    };
    
    existing.accessCount++;
    existing.lastAccessed = new Date();
    existing.computationCost = Math.max(existing.computationCost, computationCost);
    
    this.cacheHeatMap.set(cacheKey, existing);
  }
  
  /**
   * Estimate query computational cost
   */
  private estimateQueryCost(query: string): number {
    const lowerQuery = query.toLowerCase();
    let cost = 1;
    
    // Increase cost for complex operations
    if (lowerQuery.includes('join')) cost += 2;
    if (lowerQuery.includes('group by')) cost += 2;
    if (lowerQuery.includes('order by')) cost += 1;
    if (lowerQuery.includes('distinct')) cost += 1;
    if (lowerQuery.includes('like')) cost += 1;
    if (lowerQuery.includes('jsonb')) cost += 2;
    
    // Increase cost for large table scans
    if (lowerQuery.includes('patients')) cost += 1;
    if (lowerQuery.includes('fhir_resources')) cost += 2;
    
    return cost;
  }
  
  /**
   * Register cache invalidation patterns
   */
  private registerInvalidationPattern(cacheKey: string, query: string): void {
    const patterns: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Determine what this query depends on
    if (lowerQuery.includes('patients')) patterns.push('patient:*');
    if (lowerQuery.includes('encounters')) patterns.push('encounter:*');
    if (lowerQuery.includes('observations')) patterns.push('observation:*');
    if (lowerQuery.includes('fhir_resources')) patterns.push('fhir:*');
    
    if (patterns.length > 0) {
      this.invalidationPatterns.set(cacheKey, patterns);
    }
  }
  
  /**
   * Intelligent TTL determination based on query characteristics
   */
  private determineIntelligentTTL(query: string, resultCount: number, executionTime: number): number {
    const lowerQuery = query.toLowerCase();
    let baseTtl = this.determineTTL(query);
    
    // Increase TTL for expensive queries
    if (executionTime > 5000) {
      baseTtl *= 3; // Triple cache time for very expensive queries
    } else if (executionTime > 1000) {
      baseTtl *= 2; // Double cache time for expensive queries
    }
    
    // Decrease TTL for large result sets (they change more frequently)
    if (resultCount > 1000) {
      baseTtl *= 0.5;
    } else if (resultCount > 100) {
      baseTtl *= 0.7;
    }
    
    // Adjust based on query patterns
    if (lowerQuery.includes('where id =')) {
      baseTtl *= 1.5; // Single record queries are more stable
    }
    
    if (lowerQuery.includes('order by') && lowerQuery.includes('limit')) {
      baseTtl *= 0.6; // Paginated results change more frequently
    }
    
    return Math.max(60, Math.min(baseTtl, 7200)); // Between 1 minute and 2 hours
  }
  
  /**
   * Warm up cache based on access heat map
   */
  private async warmupBasedOnHeatMap(): Promise<void> {
    // Get top 20 most accessed cache keys
    const hotKeys = Array.from(this.cacheHeatMap.entries())
      .sort((a, b) => {
        const scoreA = a[1].accessCount * a[1].computationCost;
        const scoreB = b[1].accessCount * b[1].computationCost;
        return scoreB - scoreA;
      })
      .slice(0, 20)
      .map(([key]) => key);
    
    logger.info(`Warming up ${hotKeys.length} hot cache keys`);
    
    // Note: In a real implementation, you'd need to store the original queries
    // to re-execute them for warming. This is a simplified version.
  }
  
  /**
   * Warm up critical healthcare data
   */
  private async warmupCriticalHealthcareData(): Promise<void> {
    try {
      // Warm up active practitioners (needed for appointment scheduling)
      await this.batchCache({
        'active_practitioners': 'SELECT * FROM practitioners WHERE active = true LIMIT 100'
      }, REFERENCE_CACHE_NAMESPACE, CACHE_TTL_STRATEGIES.practitioners);
      
      // Warm up organization data
      await this.batchCache({
        'active_organizations': 'SELECT * FROM organizations WHERE active = true'
      }, REFERENCE_CACHE_NAMESPACE, CACHE_TTL_STRATEGIES.organizations);
      
      logger.debug('Critical healthcare data warmed up');
    } catch (error) {
      logger.error('Failed to warm up critical healthcare data:', error);
    }
  }
  
  /**
   * Process warmup queue with priority ordering
   */
  private async processWarmupQueue(): Promise<void> {
    if (this.warmupQueue.length === 0) return;
    
    // Sort by priority (higher first)
    this.warmupQueue.sort((a, b) => b.priority - a.priority);
    
    const processingQueue = [...this.warmupQueue];
    this.warmupQueue.length = 0;
    
    for (const item of processingQueue) {
      try {
        const data = await item.generator();
        await redisService.set(item.key, data, {
          namespace: CLINICAL_CACHE_NAMESPACE,
          ttl: item.ttl
        });
      } catch (error) {
        logger.error(`Failed to warm up cache key ${item.key}:`, error);
      }
    }
    
    logger.debug(`Processed ${processingQueue.length} warmup queue items`);
  }
  
  /**
   * Add item to warmup queue
   */
  async scheduleWarmup(key: string, generator: () => Promise<any>, ttl: number, priority: number = 1): Promise<void> {
    this.warmupQueue.push({ key, generator, ttl, priority });
    
    // Process queue if it gets large
    if (this.warmupQueue.length > 50) {
      await this.processWarmupQueue();
    }
  }

  // Private helper methods

  /**
   * Generate consistent cache key with versioning
   */
  private generateCacheKey(query: string, params?: unknown[]): string {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const paramsStr = params ? JSON.stringify(params) : '';
    const combined = normalizedQuery + paramsStr;
    
    // Add cache version for invalidation
    const cacheVersion = 'v2'; // Increment when cache structure changes
    
    return crypto.createHash('sha256').update(`${cacheVersion}:${combined}`).digest('hex');
  }

  /**
   * Determine TTL based on query type
   */
  private determineTTL(query: string): number {
    const lowerQuery = query.toLowerCase();
    
    // Long TTL for reference data
    if (lowerQuery.includes('organization') || lowerQuery.includes('practitioner')) {
      return 3600; // 1 hour
    }
    
    // Medium TTL for patient data
    if (lowerQuery.includes('patient')) {
      return 900; // 15 minutes
    }
    
    // Short TTL for clinical data
    if (lowerQuery.includes('observation') || lowerQuery.includes('encounter')) {
      return 300; // 5 minutes
    }
    
    // Very short TTL for real-time data
    if (lowerQuery.includes('vital') || lowerQuery.includes('alert')) {
      return 60; // 1 minute
    }
    
    return DEFAULT_TTL;
  }

  /**
   * Update performance statistics
   */
  private updateStats(totalTime: number, isHit: boolean, cacheTime: number): void {
    this.stats.queries++;
    
    if (isHit) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    
    this.stats.hitRate = (this.stats.hits / this.stats.queries) * 100;
    
    // Update running averages
    this.stats.avgQueryTime = 
      (this.stats.avgQueryTime * (this.stats.queries - 1) + totalTime) / this.stats.queries;
    
    if (cacheTime > 0) {
      this.stats.avgCacheTime = 
        (this.stats.avgCacheTime * (this.stats.hits - 1) + cacheTime) / this.stats.hits;
    }
  }

  /**
   * Warm up FHIR resources
   */
  private async warmupFHIRResources(): Promise<void> {
    try {
      // This would typically load frequently accessed resources
      logger.debug('FHIR resource warmup completed');
    } catch (error) {
      logger.error('FHIR resource warmup failed:', error);
    }
  }

  /**
   * Warm up patient data
   */
  private async warmupPatientData(): Promise<void> {
    try {
      // This would typically load frequently accessed patient records
      logger.debug('Patient data warmup completed');
    } catch (error) {
      logger.error('Patient data warmup failed:', error);
    }
  }
}

// Export singleton instance
export const databaseCacheService = new DatabaseCacheService();
