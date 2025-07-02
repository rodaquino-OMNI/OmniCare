/**
 * OmniCare EMR Backend - Materialized View Service
 * Manages database materialized views for performance optimization
 */

import { databaseService } from './database.service';
import { redisCacheService } from './redis-cache.service';

import logger from '@/utils/logger';

export interface MaterializedView {
  name: string;
  schema: string;
  definition: string;
  refreshStrategy: 'CONCURRENT' | 'COMPLETE';
  refreshInterval: number; // minutes
  lastRefreshed?: Date;
  dependencies?: string[];
  indexes?: string[];
}

export interface RefreshStatus {
  viewName: string;
  success: boolean;
  duration: number;
  rowsAffected?: number;
  error?: string;
  timestamp: Date;
}

export class MaterializedViewService {
  private readonly views: MaterializedView[] = [
    {
      name: 'mv_patient_summary',
      schema: 'public',
      definition: `
        SELECT 
          p.id as patient_id,
          p.name,
          p.birth_date,
          p.gender,
          COUNT(DISTINCT e.id) as encounter_count,
          COUNT(DISTINCT o.id) as observation_count,
          COUNT(DISTINCT m.id) as medication_count,
          MAX(e.period_start) as last_encounter_date,
          AVG(EXTRACT(epoch FROM (e.period_end - e.period_start))/3600) as avg_encounter_duration_hours
        FROM patient p
        LEFT JOIN encounter e ON e.patient_id = p.id
        LEFT JOIN observation o ON o.patient_id = p.id
        LEFT JOIN medication_request m ON m.patient_id = p.id
        WHERE p.active = true
        GROUP BY p.id, p.name, p.birth_date, p.gender
      `,
      refreshStrategy: 'CONCURRENT',
      refreshInterval: 60, // 1 hour
      indexes: [
        'CREATE INDEX idx_mv_patient_summary_patient_id ON mv_patient_summary(patient_id)',
        'CREATE INDEX idx_mv_patient_summary_last_encounter ON mv_patient_summary(last_encounter_date DESC)'
      ]
    },
    {
      name: 'mv_vital_signs_latest',
      schema: 'public',
      definition: `
        WITH ranked_vitals AS (
          SELECT 
            o.patient_id,
            o.code,
            o.value_quantity,
            o.value_unit,
            o.effective_date_time,
            ROW_NUMBER() OVER (PARTITION BY o.patient_id, o.code ORDER BY o.effective_date_time DESC) as rn
          FROM observation o
          WHERE o.category = 'vital-signs'
            AND o.status = 'final'
        )
        SELECT 
          patient_id,
          MAX(CASE WHEN code = '8867-4' THEN value_quantity END) as heart_rate,
          MAX(CASE WHEN code = '9279-1' THEN value_quantity END) as respiratory_rate,
          MAX(CASE WHEN code = '8310-5' THEN value_quantity END) as body_temperature,
          MAX(CASE WHEN code = '85354-9' THEN CONCAT(
            MAX(CASE WHEN code = '8480-6' THEN value_quantity END), '/',
            MAX(CASE WHEN code = '8462-4' THEN value_quantity END)
          ) END) as blood_pressure,
          MAX(CASE WHEN code = '2708-6' THEN value_quantity END) as oxygen_saturation,
          MAX(effective_date_time) as last_updated
        FROM ranked_vitals
        WHERE rn = 1
        GROUP BY patient_id
      `,
      refreshStrategy: 'CONCURRENT',
      refreshInterval: 15, // 15 minutes
      indexes: [
        'CREATE INDEX idx_mv_vital_signs_patient_id ON mv_vital_signs_latest(patient_id)',
        'CREATE INDEX idx_mv_vital_signs_last_updated ON mv_vital_signs_latest(last_updated DESC)'
      ]
    },
    {
      name: 'mv_medication_active',
      schema: 'public',
      definition: `
        SELECT 
          m.patient_id,
          m.id as medication_request_id,
          m.medication_codeable_concept,
          m.dosage_instruction,
          m.authored_on,
          m.valid_period_start,
          m.valid_period_end,
          m.status,
          m.intent,
          p.name as prescriber_name,
          pat.name as patient_name
        FROM medication_request m
        JOIN practitioner p ON p.id = m.requester_id
        JOIN patient pat ON pat.id = m.patient_id
        WHERE m.status IN ('active', 'on-hold')
          AND (m.valid_period_end IS NULL OR m.valid_period_end > CURRENT_TIMESTAMP)
      `,
      refreshStrategy: 'CONCURRENT',
      refreshInterval: 30, // 30 minutes
      indexes: [
        'CREATE INDEX idx_mv_medication_active_patient_id ON mv_medication_active(patient_id)',
        'CREATE INDEX idx_mv_medication_active_status ON mv_medication_active(status)',
        'CREATE INDEX idx_mv_medication_active_authored ON mv_medication_active(authored_on DESC)'
      ]
    },
    {
      name: 'mv_appointment_schedule',
      schema: 'public',
      definition: `
        SELECT 
          a.id as appointment_id,
          a.patient_id,
          a.practitioner_id,
          a.start_time,
          a.end_time,
          a.status,
          a.service_type,
          p.name as patient_name,
          pr.name as practitioner_name,
          DATE(a.start_time) as appointment_date,
          EXTRACT(hour FROM a.start_time) as appointment_hour
        FROM appointment a
        JOIN patient p ON p.id = a.patient_id
        JOIN practitioner pr ON pr.id = a.practitioner_id
        WHERE a.start_time >= CURRENT_DATE - INTERVAL '7 days'
          AND a.start_time <= CURRENT_DATE + INTERVAL '30 days'
      `,
      refreshStrategy: 'CONCURRENT',
      refreshInterval: 10, // 10 minutes
      indexes: [
        'CREATE INDEX idx_mv_appointment_schedule_date ON mv_appointment_schedule(appointment_date)',
        'CREATE INDEX idx_mv_appointment_schedule_patient ON mv_appointment_schedule(patient_id, appointment_date)',
        'CREATE INDEX idx_mv_appointment_schedule_practitioner ON mv_appointment_schedule(practitioner_id, appointment_date)'
      ]
    }
  ];

  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;

  /**
   * Initialize all materialized views
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Materialized view service already initialized');
      return;
    }

    logger.info('Initializing materialized views...');

    for (const view of this.views) {
      try {
        await this.createOrUpdateView(view);
        this.scheduleRefresh(view);
      } catch (error) {
        logger.error(`Failed to initialize materialized view ${view.name}:`, error);
      }
    }

    this.isInitialized = true;
    logger.info('Materialized view service initialized');
  }

  /**
   * Create or update a materialized view
   */
  private async createOrUpdateView(view: MaterializedView): Promise<void> {
    const startTime = Date.now();
    const viewFullName = `${view.schema}.${view.name}`;

    try {
      // Check if view exists
      const existsQuery = `
        SELECT matviewname 
        FROM pg_matviews 
        WHERE schemaname = $1 AND matviewname = $2
      `;
      const exists = await databaseService.query(existsQuery, [view.schema, view.name]);

      if (exists.rows.length === 0) {
        logger.info(`Creating materialized view ${viewFullName}`);
        
        // Create the view
        await databaseService.query(`
          CREATE MATERIALIZED VIEW ${viewFullName} AS
          ${view.definition}
          WITH DATA
        `);

        // Create indexes
        if (view.indexes) {
          for (const indexSql of view.indexes) {
            await databaseService.query(indexSql);
          }
        }

        logger.info(`Materialized view ${viewFullName} created successfully`);
      } else {
        // Refresh existing view
        await this.refreshView(view);
      }

      const duration = Date.now() - startTime;
      logger.info(`Materialized view ${viewFullName} initialized in ${duration}ms`);

    } catch (error) {
      logger.error(`Failed to create/update materialized view ${viewFullName}:`, error);
      throw error;
    }
  }

  /**
   * Refresh a materialized view
   */
  async refreshView(view: MaterializedView): Promise<RefreshStatus> {
    const startTime = Date.now();
    const viewFullName = `${view.schema}.${view.name}`;
    const status: RefreshStatus = {
      viewName: viewFullName,
      success: false,
      duration: 0,
      timestamp: new Date()
    };

    try {
      logger.info(`Refreshing materialized view ${viewFullName}`);

      // Clear related cache entries
      await this.clearViewCache(view.name);

      // Refresh the view
      const refreshMode = view.refreshStrategy === 'CONCURRENT' ? 'CONCURRENTLY' : '';
      const result = await databaseService.query(`
        REFRESH MATERIALIZED VIEW ${refreshMode} ${viewFullName}
      `);

      status.success = true;
      status.duration = Date.now() - startTime;
      status.rowsAffected = result.rowCount;

      // Update last refresh time in cache
      await redisCacheService.set(
        `mv:last_refresh:${view.name}`,
        new Date().toISOString(),
        { ttl: 86400 } // 24 hours
      );

      logger.info(`Materialized view ${viewFullName} refreshed successfully in ${status.duration}ms`);

      // Emit refresh event for monitoring
      this.trackRefreshMetrics(status);

    } catch (error) {
      status.success = false;
      status.duration = Date.now() - startTime;
      status.error = (error as Error).message;
      
      logger.error(`Failed to refresh materialized view ${viewFullName}:`, error);
    }

    return status;
  }

  /**
   * Schedule automatic refresh for a view
   */
  private scheduleRefresh(view: MaterializedView): void {
    const viewFullName = `${view.schema}.${view.name}`;
    
    // Clear existing timer if any
    const existingTimer = this.refreshTimers.get(view.name);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Schedule new refresh
    const timer = setInterval(async () => {
      try {
        await this.refreshView(view);
      } catch (error) {
        logger.error(`Scheduled refresh failed for ${viewFullName}:`, error);
      }
    }, view.refreshInterval * 60 * 1000); // Convert minutes to milliseconds

    this.refreshTimers.set(view.name, timer);
    logger.info(`Scheduled refresh for ${viewFullName} every ${view.refreshInterval} minutes`);
  }

  /**
   * Manually refresh all views
   */
  async refreshAllViews(): Promise<RefreshStatus[]> {
    logger.info('Refreshing all materialized views...');
    const results: RefreshStatus[] = [];

    for (const view of this.views) {
      const status = await this.refreshView(view);
      results.push(status);
    }

    return results;
  }

  /**
   * Get refresh status for all views
   */
  async getRefreshStatus(): Promise<{
    views: Array<{
      name: string;
      lastRefreshed: string | null;
      nextRefresh: string;
      refreshInterval: number;
    }>;
    overallHealth: 'healthy' | 'warning' | 'critical';
  }> {
    const viewStatuses = await Promise.all(
      this.views.map(async (view) => {
        const lastRefreshed = await redisCacheService.get<string>(`mv:last_refresh:${view.name}`);
        const nextRefresh = lastRefreshed
          ? new Date(new Date(lastRefreshed).getTime() + view.refreshInterval * 60000).toISOString()
          : new Date(Date.now() + view.refreshInterval * 60000).toISOString();

        return {
          name: view.name,
          lastRefreshed,
          nextRefresh,
          refreshInterval: view.refreshInterval
        };
      })
    );

    // Determine overall health
    const now = Date.now();
    let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';

    for (const status of viewStatuses) {
      if (status.lastRefreshed) {
        const timeSinceRefresh = now - new Date(status.lastRefreshed).getTime();
        const expectedInterval = status.refreshInterval * 60000;

        if (timeSinceRefresh > expectedInterval * 2) {
          overallHealth = 'critical';
          break;
        } else if (timeSinceRefresh > expectedInterval * 1.5) {
          overallHealth = 'warning';
        }
      }
    }

    return {
      views: viewStatuses,
      overallHealth
    };
  }

  /**
   * Clear cache entries related to a materialized view
   */
  private async clearViewCache(viewName: string): Promise<void> {
    try {
      // Clear cache entries that might be related to this view
      const patterns = [
        `fhir:*:${viewName}*`,
        `db_opt:query:*${viewName}*`,
        `patient:*:${viewName}*`
      ];

      for (const pattern of patterns) {
        await redisCacheService.clearPattern(pattern);
      }

      logger.debug(`Cleared cache for materialized view ${viewName}`);
    } catch (error) {
      logger.error(`Failed to clear cache for materialized view ${viewName}:`, error);
    }
  }

  /**
   * Track refresh metrics for monitoring
   */
  private trackRefreshMetrics(status: RefreshStatus): void {
    const metricsKey = `mv:metrics:${status.viewName}`;
    
    // Store metrics in Redis for monitoring
    redisCacheService.set(metricsKey, {
      lastRefresh: status.timestamp,
      duration: status.duration,
      success: status.success,
      error: status.error
    }, { ttl: 86400 }); // 24 hours
  }

  /**
   * Analyze view usage and suggest optimizations
   */
  async analyzeViewUsage(): Promise<{
    viewName: string;
    queryCount: number;
    avgQueryTime: number;
    suggestions: string[];
  }[]> {
    const analysis = [];

    for (const view of this.views) {
      const viewFullName = `${view.schema}.${view.name}`;
      
      try {
        // Get view statistics
        const statsQuery = `
          SELECT 
            n_tup_ins as rows_inserted,
            n_tup_upd as rows_updated,
            n_tup_del as rows_deleted,
            n_live_tup as live_rows,
            n_dead_tup as dead_rows,
            last_vacuum,
            last_analyze
          FROM pg_stat_user_tables
          WHERE schemaname = $1 AND tablename = $2
        `;
        
        const stats = await databaseService.query(statsQuery, [view.schema, view.name]);
        
        const suggestions: string[] = [];
        
        if (stats.rows.length > 0) {
          const row = stats.rows[0];
          
          // Check for bloat
          if (row.dead_rows > row.live_rows * 0.2) {
            suggestions.push('High dead row ratio - consider VACUUM');
          }
          
          // Check refresh frequency
          if (view.refreshInterval > 60 && row.live_rows < 1000) {
            suggestions.push('Small dataset - consider more frequent refreshes');
          } else if (view.refreshInterval < 30 && row.live_rows > 100000) {
            suggestions.push('Large dataset - consider less frequent refreshes');
          }
        }

        analysis.push({
          viewName: viewFullName,
          queryCount: 0, // Would need query logging to get actual count
          avgQueryTime: 0, // Would need query logging to get actual time
          suggestions
        });

      } catch (error) {
        logger.error(`Failed to analyze view ${viewFullName}:`, error);
      }
    }

    return analysis;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down materialized view service...');

    // Clear all refresh timers
    for (const [viewName, timer] of this.refreshTimers.entries()) {
      clearInterval(timer);
      logger.debug(`Cleared refresh timer for ${viewName}`);
    }

    this.refreshTimers.clear();
    this.isInitialized = false;

    logger.info('Materialized view service shut down');
  }
}

// Export singleton instance
export const materializedViewService = new MaterializedViewService();