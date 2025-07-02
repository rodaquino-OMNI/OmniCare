/**
 * OmniCare EMR Backend - Audit Repository
 * Database operations for audit logging and security events
 */

import { BaseRepository, QueryOptions } from './base.repository';

import { AuditLogEntry, SecurityEvent } from '@/types/auth.types';
import { QueryParameters } from '@/types/database.types';
import logger from '@/utils/logger';


// Database models that match the audit schema
export interface ActivityLogRecord {
  id: string;
  event_time: Date;
  session_id?: string;
  user_id: string;
  event_type: string;
  event_category: string;
  event_action: string;
  resource_type?: string;
  resource_id?: string;
  patient_id?: string;
  event_description?: string;
  event_outcome: 'success' | 'failure' | 'partial' | 'error';
  failure_reason?: string;
  ip_address?: string;
  user_agent?: string;
  request_method?: string;
  request_url?: string;
  request_payload?: Record<string, unknown>;
  response_status?: number;
  response_time_ms?: number;
  data_before?: Record<string, unknown>;
  data_after?: Record<string, unknown>;
  additional_context?: Record<string, unknown>;
  hipaa_compliant: boolean;
  security_level: 'low' | 'normal' | 'high' | 'critical';
  requires_review: boolean;
}

export interface UserSessionRecord {
  id: string;
  user_id: string;
  session_id: string;
  login_time: Date;
  logout_time?: Date;
  last_activity: Date;
  auth_method: string;
  two_factor_used: boolean;
  ip_address?: string;
  user_agent?: string;
  device_fingerprint?: string;
  location_country?: string;
  location_region?: string;
  location_city?: string;
  session_status: 'active' | 'expired' | 'terminated' | 'locked';
  termination_reason?: string;
  suspicious_activity: boolean;
  concurrent_sessions: number;
}

interface AuditStatsRow {
  total_events: string;
  successful_events: string;
  failed_events: string;
  unique_users: string;
  security_incidents: string;
  critical_incidents: string;
  events_by_type: Record<string, number>;
}

export interface PatientAccessLogRecord {
  id: string;
  access_time: Date;
  user_id: string;
  user_role?: string;
  patient_id: string;
  access_type: 'view' | 'create' | 'update' | 'delete' | 'print' | 'export' | 'search' | 'query';
  access_reason?: string;
  access_purpose?: 'treatment' | 'payment' | 'operations' | 'disclosure' | 'emergency' | 'other';
  justification?: string;
  legitimate_relationship: boolean;
  session_id?: string;
  ip_address?: string;
  resources_accessed?: string[];
  fields_accessed?: string[];
  data_accessed?: string[];
  session_duration_seconds?: number;
  emergency_access: boolean;
  break_glass_access: boolean;
  authorized_access: boolean;
  reviewed: boolean;
  reviewed_by?: string;
  reviewed_at?: Date;
  review_notes?: string;
  integrity_hash?: string;
  block_number?: number;
  consent_verified?: boolean;
  minimum_necessary_verified?: boolean;
}

export interface DataModificationLogRecord {
  id: string;
  modification_time: Date;
  user_id: string;
  session_id?: string;
  table_name: string;
  record_id: string;
  patient_id?: string;
  operation_type: 'INSERT' | 'UPDATE' | 'DELETE' | 'RESTORE';
  field_changes: Record<string, { old: unknown; new: unknown }>;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  reason_for_change?: string;
  business_justification?: string;
  application_name?: string;
  ip_address?: string;
  requires_patient_notification: boolean;
  patient_notified: boolean;
  notification_date?: Date;
}

export class AuditRepository extends BaseRepository<ActivityLogRecord> {
  protected tableName = 'activity_log';
  protected schema = 'audit';

  /**
   * Convert AuditLogEntry to database record
   */
  private toActivityLogRecord(entry: AuditLogEntry, sessionId?: string): Partial<ActivityLogRecord> {
    return {
      id: entry.id,
      event_time: entry.timestamp,
      session_id: sessionId,
      user_id: entry.userId,
      event_type: 'USER_ACTION',
      event_category: this.categorizeAction(entry.action),
      event_action: entry.action,
      resource_type: entry.resource,
      resource_id: entry.resourceId,
      patient_id: entry.patientId,
      event_description: `${entry.action} on ${entry.resource}`,
      event_outcome: entry.success ? 'success' : 'failure',
      failure_reason: entry.errorMessage,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      additional_context: entry.additionalData,
      hipaa_compliant: true,
      security_level: this.determineSecurityLevel(entry.action, entry.success),
      requires_review: !entry.success && this.requiresReview(entry.action)
    };
  }

  /**
   * Convert database record to AuditLogEntry
   */
  private toAuditLogEntry(record: ActivityLogRecord): AuditLogEntry {
    return {
      id: record.id,
      userId: record.user_id,
      action: record.event_action,
      resource: record.resource_type || 'system',
      resourceId: record.resource_id,
      patientId: record.patient_id,
      ipAddress: record.ip_address || '0.0.0.0',
      userAgent: record.user_agent || 'unknown',
      timestamp: record.event_time,
      success: record.event_outcome === 'success',
      errorMessage: record.failure_reason,
      additionalData: record.additional_context
    };
  }

  /**
   * Log user activity
   */
  async logActivity(entry: AuditLogEntry, sessionId?: string, options?: QueryOptions): Promise<string> {
    const record = this.toActivityLogRecord(entry, sessionId);
    const result = await this.create(record, options);
    
    logger.debug('Activity logged to database', {
      id: result.id,
      action: entry.action,
      userId: entry.userId
    });
    
    return result.id;
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event: SecurityEvent, userId: string, sessionId?: string, options?: QueryOptions): Promise<string> {
    const record: Partial<ActivityLogRecord> = {
      event_time: new Date(),
      session_id: sessionId,
      user_id: userId,
      event_type: 'SECURITY_EVENT',
      event_category: 'SECURITY',
      event_action: event.type,
      event_description: event.description,
      event_outcome: 'success',
      additional_context: event.metadata,
      hipaa_compliant: true,
      security_level: event.severity.toLowerCase() as 'low' | 'normal' | 'high' | 'critical',
      requires_review: event.severity === 'CRITICAL' || event.severity === 'HIGH'
    };

    const result = await this.create(record, options);
    
    logger.info('Security event logged to database', {
      id: result.id,
      type: event.type,
      severity: event.severity
    });
    
    return result.id;
  }

  /**
   * Log patient access with enhanced HIPAA compliance
   */
  async logPatientAccess(
    userId: string,
    patientId: string,
    accessType: PatientAccessLogRecord['access_type'],
    sessionId?: string,
    metadata?: Record<string, unknown>,
    options?: QueryOptions
  ): Promise<string> {
    const query = `
      INSERT INTO audit.patient_access_log (
        user_id, user_role, patient_id, access_type, access_purpose,
        justification, session_id, ip_address, resources_accessed,
        data_accessed, legitimate_relationship, integrity_hash,
        block_number, consent_verified, minimum_necessary_verified,
        access_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    const result = await this.query<{ id: string }>(
      query,
      [
        userId,
        metadata?.userRole as string || 'unknown',
        patientId,
        accessType,
        metadata?.accessPurpose as string || 'treatment',
        metadata?.justification as string | undefined,
        sessionId,
        metadata?.ipAddress as string | undefined,
        JSON.stringify(metadata?.resources || []),
        JSON.stringify(metadata?.dataAccessed || []),
        true, // Default to legitimate relationship
        metadata?.integrityHash as string | undefined,
        metadata?.blockNumber as number | undefined,
        metadata?.consentVerified as boolean || false,
        metadata?.minimumNecessaryVerified as boolean || false
      ],
      options
    );

    if (!result.rows[0]) {
      throw new Error('Failed to log patient access');
    }
    return result.rows[0].id;
  }

  /**
   * Log data modification
   */
  async logDataModification(
    userId: string,
    tableName: string,
    recordId: string,
    operationType: DataModificationLogRecord['operation_type'],
    changes: Record<string, { old: unknown; new: unknown }>,
    sessionId?: string,
    options?: QueryOptions
  ): Promise<string> {
    const query = `
      INSERT INTO audit.data_modification_log (
        user_id, session_id, table_name, record_id,
        operation_type, field_changes, old_values, new_values
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const result = await this.query<{ id: string }>(
      query,
      [
        userId,
        sessionId,
        tableName,
        recordId,
        operationType,
        JSON.stringify(changes.fieldChanges || {}),
        JSON.stringify(changes.oldValues || null),
        JSON.stringify(changes.newValues || null)
      ],
      options
    );

    if (!result.rows[0]) {
      throw new Error('Failed to log data modification');
    }
    return result.rows[0].id;
  }

  /**
   * Search audit logs
   */
  async searchLogs(
    filters: {
      userId?: string;
      action?: string;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
      success?: boolean;
      ipAddress?: string;
      patientId?: string;
      securityLevel?: string;
    },
    limit?: number,
    offset?: number,
    options?: QueryOptions
  ): Promise<AuditLogEntry[]> {
    let query = 'SELECT * FROM audit.activity_log WHERE 1=1';
    const params: unknown[] = [];
    let paramCount = 0;

    if (filters.userId) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      params.push(filters.userId);
    }

    if (filters.action) {
      paramCount++;
      query += ` AND event_action ILIKE $${paramCount}`;
      params.push(`%${filters.action}%`);
    }

    if (filters.resource) {
      paramCount++;
      query += ` AND resource_type = $${paramCount}`;
      params.push(filters.resource);
    }

    if (filters.startDate) {
      paramCount++;
      query += ` AND event_time >= $${paramCount}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      paramCount++;
      query += ` AND event_time <= $${paramCount}`;
      params.push(filters.endDate);
    }

    if (filters.success !== undefined) {
      paramCount++;
      query += ` AND event_outcome = $${paramCount}`;
      params.push(filters.success ? 'success' : 'failure');
    }

    if (filters.ipAddress) {
      paramCount++;
      query += ` AND ip_address = $${paramCount}`;
      params.push(filters.ipAddress);
    }

    if (filters.patientId) {
      paramCount++;
      query += ` AND patient_id = $${paramCount}`;
      params.push(filters.patientId);
    }

    if (filters.securityLevel) {
      paramCount++;
      query += ` AND security_level = $${paramCount}`;
      params.push(filters.securityLevel);
    }

    query += ' ORDER BY event_time DESC';

    if (limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(limit);
    }

    if (offset) {
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(offset);
    }

    const result = await this.query<ActivityLogRecord>(query, params as QueryParameters, options);
    return result.rows.map(record => this.toAuditLogEntry(record));
  }

  /**
   * Get activity statistics with HIPAA compliance metrics
   */
  async getStatistics(
    startDate: Date,
    endDate: Date,
    options?: QueryOptions
  ): Promise<{
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    uniqueUsers: number;
    eventsByType: Record<string, number>;
    securityIncidents: number;
    phiAccessCount?: number;
    breachDetections?: number;
  }> {
    const query = `
      WITH stats AS (
        SELECT 
          COUNT(*) as total_events,
          COUNT(CASE WHEN event_outcome = 'success' THEN 1 END) as successful_events,
          COUNT(CASE WHEN event_outcome != 'success' THEN 1 END) as failed_events,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(CASE WHEN security_level IN ('high', 'critical') AND event_outcome != 'success' THEN 1 END) as security_incidents
        FROM audit.activity_log
        WHERE event_time BETWEEN $1 AND $2
      ),
      event_types AS (
        SELECT event_action, COUNT(*) as count
        FROM audit.activity_log
        WHERE event_time BETWEEN $1 AND $2
        GROUP BY event_action
      )
      SELECT 
        s.*,
        json_object_agg(et.event_action, et.count) as events_by_type
      FROM stats s, event_types et
      GROUP BY s.total_events, s.successful_events, s.failed_events, s.unique_users, s.security_incidents
    `;

    // Additional query for PHI access statistics
    const phiQuery = `
      SELECT 
        COUNT(*) as phi_access_count,
        COUNT(CASE WHEN reviewed = false AND legitimate_relationship = false THEN 1 END) as potential_breaches
      FROM audit.patient_access_log
      WHERE access_time BETWEEN $1 AND $2
    `;

    const result = await this.query<AuditStatsRow>(query, [startDate, endDate], options);
    const phiResult = await this.query<{ phi_access_count: string; potential_breaches: string }>(
      phiQuery, 
      [startDate, endDate], 
      options
    );
    const row = result.rows[0];

    if (!row) {
      return {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        uniqueUsers: 0,
        eventsByType: {},
        securityIncidents: 0
      };
    }

    const phiRow = phiResult.rows[0];
    
    return {
      totalEvents: parseInt(row.total_events, 10),
      successfulEvents: parseInt(row.successful_events, 10),
      failedEvents: parseInt(row.failed_events, 10),
      uniqueUsers: parseInt(row.unique_users, 10),
      eventsByType: row.events_by_type || {},
      securityIncidents: parseInt(row.security_incidents, 10),
      phiAccessCount: phiRow ? parseInt(phiRow.phi_access_count, 10) : 0,
      breachDetections: phiRow ? parseInt(phiRow.potential_breaches, 10) : 0
    };
  }

  /**
   * Get patient access logs for consent verification
   */
  async getPatientAccessLogs(
    patientId: string,
    startDate?: Date,
    endDate?: Date,
    options?: QueryOptions
  ): Promise<PatientAccessLogRecord[]> {
    let query = `
      SELECT * FROM audit.patient_access_log
      WHERE patient_id = $1
    `;
    const params: unknown[] = [patientId];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      query += ` AND access_time >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND access_time <= $${paramCount}`;
      params.push(endDate);
    }

    query += ' ORDER BY access_time DESC';

    const result = await this.query<PatientAccessLogRecord>(query, params as QueryParameters, options);
    return result.rows;
  }

  /**
   * Verify audit log integrity
   */
  async verifyAuditIntegrity(
    startDate: Date,
    endDate: Date,
    options?: QueryOptions
  ): Promise<{ valid: boolean; tamperedEntries: string[] }> {
    const query = `
      SELECT id, additional_context->>'integrityHash' as integrity_hash
      FROM audit.activity_log
      WHERE event_time BETWEEN $1 AND $2
        AND additional_context->>'integrityHash' IS NOT NULL
      ORDER BY event_time ASC
    `;

    const result = await this.query<{ id: string; integrity_hash: string }>(
      query,
      [startDate, endDate],
      options
    );

    const tamperedEntries: string[] = [];
    
    // In a real implementation, we would recalculate hashes and verify the chain
    // For now, we'll check for null or empty hashes as a basic check
    result.rows.forEach(row => {
      if (!row.integrity_hash || row.integrity_hash.length !== 64) {
        tamperedEntries.push(row.id);
      }
    });

    return {
      valid: tamperedEntries.length === 0,
      tamperedEntries
    };
  }

  /**
   * Log consent verification
   */
  async logConsentVerification(
    userId: string,
    patientId: string,
    consentType: string,
    verified: boolean,
    sessionId?: string,
    options?: QueryOptions
  ): Promise<string> {
    const record: Partial<ActivityLogRecord> = {
      event_time: new Date(),
      session_id: sessionId,
      user_id: userId,
      event_type: 'CONSENT_VERIFICATION',
      event_category: 'COMPLIANCE',
      event_action: 'verify_consent',
      resource_type: 'consent',
      patient_id: patientId,
      event_description: `Consent verification for ${consentType}`,
      event_outcome: verified ? 'success' : 'failure',
      additional_context: {
        consentType,
        verified,
        timestamp: new Date().toISOString()
      },
      hipaa_compliant: true,
      security_level: 'normal',
      requires_review: !verified
    };

    const result = await this.create(record, options);
    return result.id;
  }

  /**
   * Create or update user session
   */
  async createSession(
    userId: string,
    sessionId: string,
    authMethod: string,
    ipAddress?: string,
    userAgent?: string,
    options?: QueryOptions
  ): Promise<UserSessionRecord> {
    const query = `
      INSERT INTO audit.user_session (
        user_id, session_id, auth_method, ip_address, user_agent,
        session_status, two_factor_used, suspicious_activity
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await this.query<UserSessionRecord>(
      query,
      [userId, sessionId, authMethod, ipAddress, userAgent, 'active', false, false],
      options
    );

    if (!result.rows[0]) {
      throw new Error('Failed to create session');
    }
    return result.rows[0];
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string, options?: QueryOptions): Promise<void> {
    const query = `
      UPDATE audit.user_session 
      SET last_activity = CURRENT_TIMESTAMP 
      WHERE session_id = $1 AND session_status = 'active'
    `;

    await this.query(query, [sessionId], options);
  }

  /**
   * End user session
   */
  async endSession(
    sessionId: string,
    reason: string = 'logout',
    options?: QueryOptions
  ): Promise<void> {
    const query = `
      UPDATE audit.user_session 
      SET 
        logout_time = CURRENT_TIMESTAMP,
        session_status = 'terminated',
        termination_reason = $2
      WHERE session_id = $1
    `;

    await this.query(query, [sessionId, reason], options);
  }

  /**
   * Log transaction resume event
   */
  async logTransactionResume(
    userId: string,
    transactionId: string,
    checkpointName: string,
    operationType: string,
    sessionId?: string,
    options?: QueryOptions
  ): Promise<string> {
    const record: Partial<ActivityLogRecord> = {
      event_time: new Date(),
      session_id: sessionId,
      user_id: userId,
      event_type: 'TRANSACTION_RESUME',
      event_category: 'DATABASE',
      event_action: 'transaction_resume',
      resource_type: 'transaction',
      resource_id: transactionId,
      event_description: `Transaction resumed from checkpoint: ${checkpointName}`,
      event_outcome: 'success',
      additional_context: {
        transactionId,
        checkpointName,
        operationType,
        resumeTimestamp: new Date().toISOString()
      },
      hipaa_compliant: true,
      security_level: 'normal',
      requires_review: false
    };

    const result = await this.create(record, options);
    
    logger.info('Transaction resume logged', {
      id: result.id,
      transactionId,
      checkpointName,
      userId
    });
    
    return result.id;
  }

  /**
   * Log sync operation resume event
   */
  async logSyncResume(
    userId: string,
    syncOperation: string,
    resumePoint: string,
    resourceCount: number,
    sessionId?: string,
    options?: QueryOptions
  ): Promise<string> {
    const record: Partial<ActivityLogRecord> = {
      event_time: new Date(),
      session_id: sessionId,
      user_id: userId,
      event_type: 'SYNC_RESUME',
      event_category: 'SYNCHRONIZATION',
      event_action: 'sync_resume',
      resource_type: 'sync_operation',
      resource_id: syncOperation,
      event_description: `Sync operation resumed from: ${resumePoint}`,
      event_outcome: 'success',
      additional_context: {
        syncOperation,
        resumePoint,
        resourceCount,
        resumeTimestamp: new Date().toISOString()
      },
      hipaa_compliant: true,
      security_level: 'normal',
      requires_review: false
    };

    const result = await this.create(record, options);
    
    logger.info('Sync resume logged', {
      id: result.id,
      syncOperation,
      resumePoint,
      userId
    });
    
    return result.id;
  }

  /**
   * Log query resumption event
   */
  async logQueryResume(
    userId: string,
    queryType: string,
    resumeToken: string,
    resourceType: string,
    sessionId?: string,
    options?: QueryOptions
  ): Promise<string> {
    const record: Partial<ActivityLogRecord> = {
      event_time: new Date(),
      session_id: sessionId,
      user_id: userId,
      event_type: 'QUERY_RESUME',
      event_category: 'DATA_ACCESS',
      event_action: 'query_resume',
      resource_type: resourceType,
      event_description: `Query resumed with token: ${resumeToken.substring(0, 20)}...`,
      event_outcome: 'success',
      additional_context: {
        queryType,
        resumeTokenHash: this.hashToken(resumeToken),
        resourceType,
        resumeTimestamp: new Date().toISOString()
      },
      hipaa_compliant: true,
      security_level: 'low',
      requires_review: false
    };

    const result = await this.create(record, options);
    
    logger.debug('Query resume logged', {
      id: result.id,
      queryType,
      resourceType,
      userId
    });
    
    return result.id;
  }

  /**
   * Log cache operation resume event
   */
  async logCacheResume(
    userId: string,
    cacheOperation: string,
    cacheKey: string,
    resumeProgress: number,
    sessionId?: string,
    options?: QueryOptions
  ): Promise<string> {
    const record: Partial<ActivityLogRecord> = {
      event_time: new Date(),
      session_id: sessionId,
      user_id: userId,
      event_type: 'CACHE_RESUME',
      event_category: 'CACHE_MANAGEMENT',
      event_action: 'cache_resume',
      resource_type: 'cache',
      resource_id: cacheKey,
      event_description: `Cache operation resumed at ${resumeProgress}% completion`,
      event_outcome: 'success',
      additional_context: {
        cacheOperation,
        cacheKey,
        resumeProgress,
        resumeTimestamp: new Date().toISOString()
      },
      hipaa_compliant: true,
      security_level: 'low',
      requires_review: false
    };

    const result = await this.create(record, options);
    
    logger.debug('Cache resume logged', {
      id: result.id,
      cacheOperation,
      cacheKey,
      userId
    });
    
    return result.id;
  }

  /**
   * Hash resume token for audit logging (don't store actual token)
   */
  private hashToken(token: string): string {
    // Simple hash for audit trail without exposing token
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Helper: Categorize action
   */
  private categorizeAction(action: string): string {
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('login') || actionLower.includes('auth')) return 'AUTHENTICATION';
    if (actionLower.includes('patient')) return 'PATIENT_DATA';
    if (actionLower.includes('create') || actionLower.includes('add')) return 'CREATE';
    if (actionLower.includes('update') || actionLower.includes('modify')) return 'UPDATE';
    if (actionLower.includes('delete') || actionLower.includes('remove')) return 'DELETE';
    if (actionLower.includes('view') || actionLower.includes('read')) return 'READ';
    if (actionLower.includes('export') || actionLower.includes('download')) return 'EXPORT';
    if (actionLower.includes('config') || actionLower.includes('setting')) return 'CONFIGURATION';
    
    return 'OTHER';
  }

  /**
   * Helper: Determine security level
   */
  private determineSecurityLevel(action: string, success: boolean): 'low' | 'normal' | 'high' | 'critical' {
    if (!success) {
      if (action.toLowerCase().includes('login') || action.toLowerCase().includes('unauthorized')) {
        return 'high';
      }
      return 'normal';
    }
    
    if (action.toLowerCase().includes('config') || action.toLowerCase().includes('admin')) {
      return 'normal';
    }
    
    return 'low';
  }

  /**
   * Helper: Check if action requires review
   */
  private requiresReview(action: string): boolean {
    const reviewActions = [
      'unauthorized', 'breach', 'violation', 'suspicious',
      'admin', 'config', 'system', 'critical', 'resume'
    ];
    
    const actionLower = action.toLowerCase();
    return reviewActions.some(reviewAction => actionLower.includes(reviewAction));
  }
}

// Export singleton instance
export const auditRepository = new AuditRepository();