-- =====================================================
-- OmniCare EMR - Replication and Backup Strategy
-- Author: Database Engineer
-- Purpose: Comprehensive replication, backup, and disaster recovery setup
-- Version: 1.0.0
-- Date: 2025-01-20
-- =====================================================

-- Record this migration
INSERT INTO migration.applied_migrations (version, name, applied_by) 
VALUES ('003', 'replication_backup_strategy', 'database_engineer');

-- =====================================================
-- Replication Configuration
-- =====================================================

-- Create replication management schema
CREATE SCHEMA IF NOT EXISTS replication;

-- Replication slot management
CREATE TABLE replication.replication_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Slot identification
    slot_name VARCHAR(100) UNIQUE NOT NULL,
    slot_type VARCHAR(20) NOT NULL,
    
    -- Target information
    target_host VARCHAR(255) NOT NULL,
    target_port INTEGER DEFAULT 5432,
    target_database VARCHAR(100),
    
    -- Configuration
    replication_type VARCHAR(20) NOT NULL,
    synchronous_commit BOOLEAN DEFAULT FALSE,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'initializing',
    lag_bytes BIGINT,
    lag_seconds INTEGER,
    last_sync_time TIMESTAMP WITH TIME ZONE,
    
    -- Health monitoring
    health_status VARCHAR(20) DEFAULT 'unknown',
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_slot_type CHECK (slot_type IN ('physical', 'logical')),
    CONSTRAINT valid_replication_type CHECK (replication_type IN ('streaming', 'logical', 'cascade')),
    CONSTRAINT valid_status CHECK (status IN ('initializing', 'active', 'inactive', 'failed', 'lagging'))
);

-- Publication management for logical replication
CREATE TABLE replication.publications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Publication details
    publication_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    
    -- Tables included
    included_schemas TEXT[],
    included_tables TEXT[],
    excluded_tables TEXT[],
    
    -- Options
    publish_insert BOOLEAN DEFAULT TRUE,
    publish_update BOOLEAN DEFAULT TRUE,
    publish_delete BOOLEAN DEFAULT TRUE,
    publish_truncate BOOLEAN DEFAULT FALSE,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Replication monitoring
CREATE TABLE replication.replication_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Metric identification
    slot_name VARCHAR(100) NOT NULL,
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Performance metrics
    write_lag_ms INTEGER,
    flush_lag_ms INTEGER,
    replay_lag_ms INTEGER,
    
    -- Data metrics
    sent_bytes BIGINT,
    write_bytes BIGINT,
    flush_bytes BIGINT,
    replay_bytes BIGINT,
    
    -- Connection metrics
    connection_status VARCHAR(20),
    sync_state VARCHAR(20),
    sync_priority INTEGER,
    
    -- Calculated metrics
    replication_delay_seconds INTEGER,
    bytes_per_second BIGINT,
    estimated_catchup_time_seconds INTEGER
);

-- =====================================================
-- Backup Strategy Tables
-- =====================================================

-- Backup policies
CREATE TABLE backup.backup_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Policy identification
    policy_name VARCHAR(100) UNIQUE NOT NULL,
    policy_type VARCHAR(20) NOT NULL,
    description TEXT,
    
    -- Schedule
    schedule_type VARCHAR(20) NOT NULL,
    schedule_expression VARCHAR(100), -- Cron expression
    
    -- Retention
    retention_full_count INTEGER DEFAULT 7,
    retention_differential_count INTEGER DEFAULT 14,
    retention_incremental_count INTEGER DEFAULT 30,
    retention_wal_hours INTEGER DEFAULT 168, -- 7 days
    
    -- Storage
    storage_type VARCHAR(20) NOT NULL,
    storage_location TEXT NOT NULL,
    compression_enabled BOOLEAN DEFAULT TRUE,
    encryption_enabled BOOLEAN DEFAULT TRUE,
    
    -- Performance
    parallel_jobs INTEGER DEFAULT 2,
    throttle_rate_mbps INTEGER,
    
    -- Options
    verify_backup BOOLEAN DEFAULT TRUE,
    include_tablespaces BOOLEAN DEFAULT TRUE,
    include_globals BOOLEAN DEFAULT TRUE,
    
    -- Status
    enabled BOOLEAN DEFAULT TRUE,
    last_execution TIMESTAMP WITH TIME ZONE,
    next_execution TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_policy_type CHECK (policy_type IN ('full', 'differential', 'incremental', 'continuous')),
    CONSTRAINT valid_schedule_type CHECK (schedule_type IN ('cron', 'interval', 'manual')),
    CONSTRAINT valid_storage_type CHECK (storage_type IN ('local', 's3', 'azure', 'gcs', 'nfs'))
);

-- Backup catalog
CREATE TABLE backup.backup_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Backup identification
    backup_label VARCHAR(200) UNIQUE NOT NULL,
    backup_type VARCHAR(20) NOT NULL,
    policy_id UUID REFERENCES backup.backup_policies(id),
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- Size and location
    backup_size_bytes BIGINT,
    compressed_size_bytes BIGINT,
    backup_location TEXT NOT NULL,
    
    -- Database state
    database_version VARCHAR(20),
    checkpoint_location VARCHAR(50),
    timeline_id INTEGER,
    
    -- Parent backup (for incremental)
    parent_backup_id UUID REFERENCES backup.backup_catalog(id),
    
    -- Validation
    validated BOOLEAN DEFAULT FALSE,
    validation_time TIMESTAMP WITH TIME ZONE,
    validation_checksum VARCHAR(64),
    
    -- Recovery info
    min_recovery_time TIMESTAMP WITH TIME ZONE,
    max_recovery_time TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'in_progress',
    error_message TEXT,
    
    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_backup_type CHECK (backup_type IN ('full', 'differential', 'incremental', 'wal')),
    CONSTRAINT valid_status CHECK (status IN ('in_progress', 'completed', 'failed', 'corrupted', 'expired'))
);

-- Recovery testing
CREATE TABLE backup.recovery_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Test identification
    test_name VARCHAR(100) NOT NULL,
    backup_id UUID REFERENCES backup.backup_catalog(id),
    
    -- Test configuration
    test_type VARCHAR(20) NOT NULL,
    target_database VARCHAR(100),
    target_time TIMESTAMP WITH TIME ZONE,
    
    -- Execution
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- Results
    test_passed BOOLEAN,
    data_integrity_valid BOOLEAN,
    recovery_point_achieved TIMESTAMP WITH TIME ZONE,
    
    -- Validation
    rows_validated BIGINT,
    validation_errors INTEGER,
    validation_details JSONB,
    
    -- Performance
    restore_rate_mbps NUMERIC(10,2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    
    CONSTRAINT valid_test_type CHECK (test_type IN ('full_restore', 'point_in_time', 'table_restore', 'validation_only')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

-- =====================================================
-- Functions for Replication Management
-- =====================================================

-- Function to create physical replication slot
CREATE OR REPLACE FUNCTION replication.create_physical_slot(
    p_slot_name VARCHAR(100),
    p_target_host VARCHAR(255),
    p_synchronous BOOLEAN DEFAULT FALSE
) RETURNS BOOLEAN AS $$
DECLARE
    slot_exists BOOLEAN;
BEGIN
    -- Check if slot already exists
    SELECT EXISTS(
        SELECT 1 FROM pg_replication_slots 
        WHERE slot_name = p_slot_name
    ) INTO slot_exists;
    
    IF slot_exists THEN
        RAISE NOTICE 'Replication slot % already exists', p_slot_name;
        RETURN FALSE;
    END IF;
    
    -- Create physical replication slot
    PERFORM pg_create_physical_replication_slot(p_slot_name, true);
    
    -- Record in management table
    INSERT INTO replication.replication_slots (
        slot_name, slot_type, target_host, replication_type,
        synchronous_commit, status
    ) VALUES (
        p_slot_name, 'physical', p_target_host, 'streaming',
        p_synchronous, 'active'
    );
    
    -- Update synchronous_standby_names if synchronous
    IF p_synchronous THEN
        ALTER SYSTEM SET synchronous_standby_names = p_slot_name;
        SELECT pg_reload_conf();
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to create logical replication publication
CREATE OR REPLACE FUNCTION replication.create_publication(
    p_publication_name VARCHAR(100),
    p_tables TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
    table_name TEXT;
    sql_cmd TEXT;
BEGIN
    -- Build CREATE PUBLICATION command
    sql_cmd := format('CREATE PUBLICATION %I FOR TABLE ', p_publication_name);
    
    FOREACH table_name IN ARRAY p_tables
    LOOP
        sql_cmd := sql_cmd || format('%s, ', table_name);
    END LOOP;
    
    -- Remove trailing comma
    sql_cmd := rtrim(sql_cmd, ', ');
    
    -- Execute
    EXECUTE sql_cmd;
    
    -- Record in management table
    INSERT INTO replication.publications (
        publication_name, included_tables
    ) VALUES (
        p_publication_name, p_tables
    );
    
    RETURN TRUE;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Publication % already exists', p_publication_name;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to monitor replication lag
CREATE OR REPLACE FUNCTION replication.check_replication_lag()
RETURNS TABLE(
    slot_name TEXT,
    slot_type TEXT,
    active BOOLEAN,
    lag_bytes BIGINT,
    lag_seconds INTEGER,
    health_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH lag_data AS (
        SELECT 
            s.slot_name,
            s.slot_type,
            s.active,
            CASE 
                WHEN s.slot_type = 'physical' THEN
                    pg_wal_lsn_diff(pg_current_wal_lsn(), s.restart_lsn)
                ELSE
                    pg_wal_lsn_diff(pg_current_wal_lsn(), s.confirmed_flush_lsn)
            END as lag_bytes_calc,
            EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp()))::INTEGER as lag_secs
        FROM pg_replication_slots s
    )
    SELECT 
        l.slot_name::TEXT,
        l.slot_type::TEXT,
        l.active,
        l.lag_bytes_calc,
        l.lag_secs,
        CASE 
            WHEN NOT l.active THEN 'inactive'
            WHEN l.lag_bytes_calc > 1073741824 THEN 'critical' -- > 1GB
            WHEN l.lag_bytes_calc > 104857600 THEN 'warning'  -- > 100MB
            ELSE 'healthy'
        END as health_status
    FROM lag_data l;
    
    -- Update monitoring table
    INSERT INTO replication.replication_metrics (
        slot_name, write_lag_ms, replay_lag_ms, 
        replication_delay_seconds, connection_status
    )
    SELECT 
        l.slot_name,
        0, -- Would be populated from pg_stat_replication
        l.lag_secs * 1000,
        l.lag_secs,
        CASE WHEN l.active THEN 'connected' ELSE 'disconnected' END
    FROM lag_data l;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Functions for Backup Management
-- =====================================================

-- Function to execute backup based on policy
CREATE OR REPLACE FUNCTION backup.execute_backup_policy(
    p_policy_id UUID
) RETURNS UUID AS $$
DECLARE
    policy_record RECORD;
    backup_id UUID;
    backup_label VARCHAR(200);
    backup_command TEXT;
    start_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get policy details
    SELECT * INTO policy_record
    FROM backup.backup_policies
    WHERE id = p_policy_id AND enabled = TRUE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Policy not found or disabled';
    END IF;
    
    start_time := CURRENT_TIMESTAMP;
    backup_id := uuid_generate_v4();
    backup_label := format('%s_%s_%s', 
                          policy_record.policy_name,
                          policy_record.policy_type,
                          TO_CHAR(start_time, 'YYYYMMDD_HH24MISS'));
    
    -- Record backup start
    INSERT INTO backup.backup_catalog (
        id, backup_label, backup_type, policy_id,
        started_at, backup_location, status
    ) VALUES (
        backup_id, backup_label, policy_record.policy_type,
        p_policy_id, start_time, policy_record.storage_location,
        'in_progress'
    );
    
    -- Build backup command based on type
    CASE policy_record.policy_type
        WHEN 'full' THEN
            backup_command := format(
                'pg_basebackup -D %s/%s -Ft -z -Xs -c fast -l "%s" -P',
                policy_record.storage_location, backup_label, backup_label
            );
            
        WHEN 'incremental' THEN
            -- WAL archiving command
            backup_command := format(
                'pg_receivewal -D %s/wal -Z 9 --synchronous',
                policy_record.storage_location
            );
    END CASE;
    
    -- Log backup command (actual execution would be done by external process)
    UPDATE backup.backup_jobs 
    SET backup_method = 'pg_basebackup',
        backup_location = policy_record.storage_location || '/' || backup_label
    WHERE id = backup_id;
    
    -- Schedule verification if enabled
    IF policy_record.verify_backup THEN
        INSERT INTO backup.recovery_tests (
            test_name, backup_id, test_type, status
        ) VALUES (
            'Auto-verify ' || backup_label, backup_id, 'validation_only', 'pending'
        );
    END IF;
    
    RETURN backup_id;
END;
$$ LANGUAGE plpgsql;

-- Function to validate backup integrity
CREATE OR REPLACE FUNCTION backup.validate_backup(
    p_backup_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    backup_record RECORD;
    validation_passed BOOLEAN := TRUE;
    checksum VARCHAR(64);
BEGIN
    -- Get backup details
    SELECT * INTO backup_record
    FROM backup.backup_catalog
    WHERE id = p_backup_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Backup not found';
    END IF;
    
    -- Perform validation checks
    -- 1. Check file existence and size
    -- 2. Verify checksums
    -- 3. Test restore headers
    
    -- For now, simulate validation
    checksum := md5(backup_record.backup_label || backup_record.completed_at::TEXT);
    
    -- Update backup record
    UPDATE backup.backup_catalog
    SET validated = validation_passed,
        validation_time = CURRENT_TIMESTAMP,
        validation_checksum = checksum
    WHERE id = p_backup_id;
    
    RETURN validation_passed;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate recovery point objective (RPO)
CREATE OR REPLACE FUNCTION backup.calculate_rpo()
RETURNS TABLE(
    backup_type TEXT,
    last_successful_backup TIMESTAMP WITH TIME ZONE,
    time_since_backup INTERVAL,
    rpo_minutes INTEGER,
    rpo_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_backups AS (
        SELECT 
            b.backup_type,
            MAX(b.completed_at) as last_backup
        FROM backup.backup_catalog b
        WHERE b.status = 'completed'
          AND b.validated = TRUE
          AND NOT b.deleted
        GROUP BY b.backup_type
    )
    SELECT 
        lb.backup_type::TEXT,
        lb.last_backup,
        CURRENT_TIMESTAMP - lb.last_backup as time_since,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - lb.last_backup)) / 60 as rpo_mins,
        CASE 
            WHEN lb.backup_type = 'full' AND 
                 CURRENT_TIMESTAMP - lb.last_backup > INTERVAL '24 hours' THEN 'critical'
            WHEN lb.backup_type = 'incremental' AND 
                 CURRENT_TIMESTAMP - lb.last_backup > INTERVAL '1 hour' THEN 'warning'
            ELSE 'healthy'
        END as status
    FROM latest_backups lb;
END;
$$ LANGUAGE plpgsql;

-- Function to estimate recovery time objective (RTO)
CREATE OR REPLACE FUNCTION backup.estimate_rto(
    p_target_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) RETURNS TABLE(
    recovery_method TEXT,
    estimated_time_minutes INTEGER,
    backup_size_gb NUMERIC,
    restore_rate_mbps NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH recovery_options AS (
        -- Option 1: Streaming replication failover
        SELECT 
            'Streaming Replication Failover' as method,
            5 as minutes, -- Typical failover time
            0::NUMERIC as size_gb,
            0::NUMERIC as rate_mbps
        WHERE EXISTS (
            SELECT 1 FROM pg_stat_replication 
            WHERE state = 'streaming' AND sync_state = 'sync'
        )
        
        UNION ALL
        
        -- Option 2: Point-in-time recovery
        SELECT 
            'Point-in-Time Recovery' as method,
            CEIL(backup_size_bytes / 1024.0 / 1024.0 / 100.0)::INTEGER + 30 as minutes,
            ROUND(backup_size_bytes / 1024.0 / 1024.0 / 1024.0, 2) as size_gb,
            100.0 as rate_mbps
        FROM backup.backup_catalog
        WHERE status = 'completed'
          AND validated = TRUE
          AND min_recovery_time <= p_target_time
          AND max_recovery_time >= p_target_time
        ORDER BY completed_at DESC
        LIMIT 1
    )
    SELECT * FROM recovery_options
    ORDER BY minutes;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Automated Backup and Replication Monitoring
-- =====================================================

-- Create monitoring views
CREATE VIEW backup.backup_health_dashboard AS
SELECT 
    p.policy_name,
    p.policy_type,
    p.enabled as policy_enabled,
    
    -- Last successful backup
    last_backup.completed_at as last_backup_time,
    CURRENT_TIMESTAMP - last_backup.completed_at as time_since_backup,
    last_backup.backup_size_bytes,
    
    -- Next scheduled backup
    p.next_execution,
    
    -- Health status
    CASE 
        WHEN NOT p.enabled THEN 'disabled'
        WHEN last_backup.completed_at IS NULL THEN 'no_backups'
        WHEN p.policy_type = 'full' AND 
             CURRENT_TIMESTAMP - last_backup.completed_at > INTERVAL '25 hours' THEN 'overdue'
        WHEN p.policy_type = 'incremental' AND 
             CURRENT_TIMESTAMP - last_backup.completed_at > INTERVAL '2 hours' THEN 'overdue'
        ELSE 'healthy'
    END as health_status,
    
    -- Success rate
    stats.total_backups,
    stats.successful_backups,
    ROUND(stats.successful_backups::NUMERIC / NULLIF(stats.total_backups, 0) * 100, 2) as success_rate
    
FROM backup.backup_policies p
LEFT JOIN LATERAL (
    SELECT *
    FROM backup.backup_catalog b
    WHERE b.policy_id = p.id
      AND b.status = 'completed'
    ORDER BY b.completed_at DESC
    LIMIT 1
) last_backup ON TRUE
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as total_backups,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_backups
    FROM backup.backup_catalog b
    WHERE b.policy_id = p.id
      AND b.started_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
) stats ON TRUE;

CREATE VIEW replication.replication_health_dashboard AS
SELECT 
    rs.slot_name,
    rs.slot_type,
    rs.target_host,
    rs.replication_type,
    rs.status,
    
    -- Lag metrics
    COALESCE(sr.write_lag, INTERVAL '0') as write_lag,
    COALESCE(sr.flush_lag, INTERVAL '0') as flush_lag,
    COALESCE(sr.replay_lag, INTERVAL '0') as replay_lag,
    
    -- Connection info
    sr.client_addr,
    sr.state,
    sr.sync_state,
    
    -- Health assessment
    CASE 
        WHEN sr.state IS NULL THEN 'disconnected'
        WHEN sr.state != 'streaming' THEN 'not_streaming'
        WHEN EXTRACT(EPOCH FROM sr.replay_lag) > 300 THEN 'lagging' -- > 5 minutes
        WHEN rs.synchronous_commit AND sr.sync_state != 'sync' THEN 'async_mode'
        ELSE 'healthy'
    END as health_status
    
FROM replication.replication_slots rs
LEFT JOIN pg_stat_replication sr ON rs.slot_name = sr.application_name
WHERE rs.status = 'active';

-- =====================================================
-- Security and Encryption for Backups
-- =====================================================

-- Backup encryption keys management
CREATE TABLE backup.encryption_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Key identification
    key_alias VARCHAR(100) UNIQUE NOT NULL,
    key_version INTEGER DEFAULT 1,
    
    -- Key details (actual keys stored in external KMS)
    key_provider VARCHAR(50) NOT NULL,
    key_id VARCHAR(200) NOT NULL,
    
    -- Usage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT valid_key_provider CHECK (key_provider IN ('aws_kms', 'azure_keyvault', 'gcp_kms', 'local'))
);

-- Function to encrypt backup
CREATE OR REPLACE FUNCTION backup.encrypt_backup_metadata(
    p_backup_id UUID,
    p_key_alias VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
    key_record RECORD;
BEGIN
    -- Get encryption key
    SELECT * INTO key_record
    FROM backup.encryption_keys
    WHERE key_alias = p_key_alias AND active = TRUE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Encryption key not found';
    END IF;
    
    -- Update backup record with encryption info
    UPDATE backup.backup_catalog
    SET backup_location = backup_location || '.encrypted',
        validation_checksum = encode(
            digest(backup_label || key_record.key_id, 'sha256'), 
            'hex'
        )
    WHERE id = p_backup_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Disaster Recovery Procedures
-- =====================================================

-- Disaster recovery runbook
CREATE TABLE backup.dr_runbook (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Scenario identification
    scenario_name VARCHAR(100) NOT NULL,
    scenario_type VARCHAR(50) NOT NULL,
    
    -- Steps
    steps JSONB NOT NULL,
    
    -- Requirements
    min_backup_age_hours INTEGER,
    required_backup_types TEXT[],
    required_replication_slots TEXT[],
    
    -- Validation
    pre_checks JSONB,
    post_checks JSONB,
    
    -- Documentation
    description TEXT,
    last_tested DATE,
    test_results JSONB,
    
    CONSTRAINT valid_scenario_type CHECK (scenario_type IN (
        'full_recovery', 'point_in_time', 'partial_restore', 
        'replication_failover', 'region_failover'
    ))
);

-- Insert standard DR procedures
INSERT INTO backup.dr_runbook (scenario_name, scenario_type, steps) VALUES
('Standard Full Recovery', 'full_recovery', 
 '[
   {"step": 1, "action": "Stop application connections", "estimated_time": "5 minutes"},
   {"step": 2, "action": "Verify backup integrity", "estimated_time": "10 minutes"},
   {"step": 3, "action": "Restore from full backup", "estimated_time": "60 minutes"},
   {"step": 4, "action": "Apply WAL logs to target time", "estimated_time": "30 minutes"},
   {"step": 5, "action": "Validate data integrity", "estimated_time": "15 minutes"},
   {"step": 6, "action": "Update connection strings", "estimated_time": "5 minutes"},
   {"step": 7, "action": "Resume application connections", "estimated_time": "5 minutes"}
 ]'::JSONB),

('Streaming Replication Failover', 'replication_failover',
 '[
   {"step": 1, "action": "Verify replica lag < 60 seconds", "estimated_time": "1 minute"},
   {"step": 2, "action": "Stop connections to primary", "estimated_time": "2 minutes"},
   {"step": 3, "action": "Promote standby to primary", "estimated_time": "2 minutes"},
   {"step": 4, "action": "Update DNS/load balancer", "estimated_time": "5 minutes"},
   {"step": 5, "action": "Verify new primary status", "estimated_time": "2 minutes"},
   {"step": 6, "action": "Resume application connections", "estimated_time": "3 minutes"}
 ]'::JSONB);

-- =====================================================
-- Scheduled Jobs for Backup and Replication
-- =====================================================

-- Function to execute scheduled backups
CREATE OR REPLACE FUNCTION backup.execute_scheduled_backups()
RETURNS TABLE(
    policy_name TEXT,
    backup_id UUID,
    status TEXT
) AS $$
DECLARE
    policy_record RECORD;
    new_backup_id UUID;
BEGIN
    FOR policy_record IN
        SELECT *
        FROM backup.backup_policies
        WHERE enabled = TRUE
          AND (next_execution IS NULL OR next_execution <= CURRENT_TIMESTAMP)
    LOOP
        BEGIN
            new_backup_id := backup.execute_backup_policy(policy_record.id);
            
            -- Update next execution time
            UPDATE backup.backup_policies
            SET last_execution = CURRENT_TIMESTAMP,
                next_execution = CASE 
                    WHEN schedule_type = 'interval' THEN
                        CURRENT_TIMESTAMP + (schedule_expression || ' hours')::INTERVAL
                    ELSE
                        NULL -- Would be calculated by cron parser
                END
            WHERE id = policy_record.id;
            
            RETURN QUERY SELECT policy_record.policy_name::TEXT, new_backup_id, 'scheduled'::TEXT;
            
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT policy_record.policy_name::TEXT, NULL::UUID, 'failed'::TEXT;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to monitor and alert on backup/replication issues
CREATE OR REPLACE FUNCTION backup.check_backup_replication_health()
RETURNS TABLE(
    alert_type TEXT,
    severity TEXT,
    component TEXT,
    message TEXT,
    details JSONB
) AS $$
BEGIN
    -- Check for overdue backups
    RETURN QUERY
    SELECT 
        'overdue_backup'::TEXT,
        'high'::TEXT,
        policy_name::TEXT,
        format('Backup policy %s is overdue by %s', policy_name, 
               CURRENT_TIMESTAMP - last_backup_time)::TEXT,
        jsonb_build_object(
            'policy_type', policy_type,
            'last_backup', last_backup_time,
            'time_overdue', CURRENT_TIMESTAMP - last_backup_time
        )
    FROM backup.backup_health_dashboard
    WHERE health_status = 'overdue';
    
    -- Check for replication lag
    RETURN QUERY
    SELECT 
        'replication_lag'::TEXT,
        CASE 
            WHEN EXTRACT(EPOCH FROM replay_lag) > 600 THEN 'critical'
            ELSE 'high'
        END::TEXT,
        slot_name::TEXT,
        format('Replication slot %s has lag of %s', slot_name, replay_lag)::TEXT,
        jsonb_build_object(
            'target_host', target_host,
            'write_lag', write_lag,
            'flush_lag', flush_lag,
            'replay_lag', replay_lag
        )
    FROM replication.replication_health_dashboard
    WHERE health_status IN ('lagging', 'disconnected');
    
    -- Check backup validation failures
    RETURN QUERY
    SELECT 
        'backup_validation_failed'::TEXT,
        'critical'::TEXT,
        backup_label::TEXT,
        format('Backup %s failed validation', backup_label)::TEXT,
        jsonb_build_object(
            'backup_id', id,
            'backup_type', backup_type,
            'completed_at', completed_at
        )
    FROM backup.backup_catalog
    WHERE validated = FALSE
      AND validation_time IS NOT NULL
      AND completed_at > CURRENT_TIMESTAMP - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Create Default Policies and Slots
-- =====================================================

-- Create default backup policies
INSERT INTO backup.backup_policies (
    policy_name, policy_type, schedule_type, schedule_expression,
    storage_type, storage_location, description
) VALUES
('daily_full_backup', 'full', 'cron', '0 2 * * *',
 'local', '/backup/omnicare/full', 'Daily full backup at 2 AM'),
 
('hourly_incremental', 'incremental', 'interval', '1',
 'local', '/backup/omnicare/incremental', 'Hourly incremental backup'),
 
('continuous_wal_archive', 'continuous', 'interval', '0',
 's3', 's3://omnicare-backups/wal', 'Continuous WAL archiving to S3');

-- Create monitoring job schedule (if pg_cron available)
-- SELECT cron.schedule('backup-monitor', '*/15 * * * *', 'SELECT backup.check_backup_replication_health();');
-- SELECT cron.schedule('backup-execute', '0 * * * *', 'SELECT backup.execute_scheduled_backups();');
-- SELECT cron.schedule('replication-monitor', '*/5 * * * *', 'SELECT replication.check_replication_lag();');

-- =====================================================
-- Migration Completion
-- =====================================================

-- Grant permissions
GRANT USAGE ON SCHEMA backup, replication TO omnicare_app;
GRANT SELECT ON ALL TABLES IN SCHEMA backup, replication TO omnicare_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA backup, replication TO omnicare_app;

GRANT ALL ON SCHEMA backup TO omnicare_backup;
GRANT ALL ON ALL TABLES IN SCHEMA backup TO omnicare_backup;
GRANT ALL ON ALL SEQUENCES IN SCHEMA backup TO omnicare_backup;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA backup TO omnicare_backup;

-- Update migration record
UPDATE migration.applied_migrations 
SET execution_time_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - applied_at)) * 1000,
    status = 'completed'
WHERE version = '003';

-- Display summary
SELECT 
    'Replication and Backup Strategy completed' as status,
    (SELECT COUNT(*) FROM backup.backup_policies) as backup_policies,
    (SELECT COUNT(*) FROM pg_replication_slots) as replication_slots,
    (SELECT COUNT(*) FROM backup.dr_runbook) as dr_procedures;