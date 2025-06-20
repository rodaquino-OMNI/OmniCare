-- =====================================================
-- OmniCare EMR - Database Setup and Configuration
-- Author: Database Integration Developer
-- Purpose: Complete PostgreSQL database initialization
-- =====================================================

-- =====================================================
-- Database Creation and Configuration
-- =====================================================

-- Create the OmniCare database (run as superuser)
-- Note: This should be run separately before other scripts
/*
CREATE DATABASE omnicare_emr
    WITH 
    OWNER = omnicare_admin
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF8'
    LC_CTYPE = 'en_US.UTF8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = 200;

COMMENT ON DATABASE omnicare_emr IS 'OmniCare EMR FHIR R4 Compliant Database';
*/

-- Connect to the database and configure
\c omnicare_emr;

-- =====================================================
-- Database Configuration Parameters
-- =====================================================

-- Performance tuning parameters
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET max_wal_size = '4GB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '32MB';
ALTER SYSTEM SET default_statistics_target = 500;

-- Connection and authentication
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET max_prepared_transactions = 50;

-- Logging configuration for audit and performance
ALTER SYSTEM SET log_destination = 'csvlog';
ALTER SYSTEM SET logging_collector = on;
ALTER SYSTEM SET log_directory = 'log';
ALTER SYSTEM SET log_filename = 'postgresql-%Y-%m-%d.log';
ALTER SYSTEM SET log_rotation_age = '1d';
ALTER SYSTEM SET log_rotation_size = '100MB';
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1 second
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_lock_waits = on;
ALTER SYSTEM SET log_statement = 'mod'; -- Log all data modifications

-- HIPAA and security configurations
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = 'server.crt';
ALTER SYSTEM SET ssl_key_file = 'server.key';
ALTER SYSTEM SET ssl_ca_file = 'ca.crt';
ALTER SYSTEM SET ssl_crl_file = 'server.crl';
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
ALTER SYSTEM SET log_statement_stats = on;

-- Query optimization
ALTER SYSTEM SET enable_partitionwise_join = on;
ALTER SYSTEM SET enable_partitionwise_aggregate = on;
ALTER SYSTEM SET jit = on;
ALTER SYSTEM SET random_page_cost = 1.1; -- For SSD storage

-- Replication (if needed)
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command = 'cp %p /var/lib/postgresql/archives/%f';
ALTER SYSTEM SET max_wal_senders = 3;
ALTER SYSTEM SET wal_keep_segments = 64;

-- Apply configuration (requires restart)
SELECT pg_reload_conf();

-- =====================================================
-- User and Role Management
-- =====================================================

-- Create roles for different access levels
CREATE ROLE omnicare_admin WITH LOGIN SUPERUSER PASSWORD 'change_this_password';
CREATE ROLE omnicare_app WITH LOGIN PASSWORD 'change_this_password';
CREATE ROLE omnicare_readonly WITH LOGIN PASSWORD 'change_this_password';
CREATE ROLE omnicare_backup WITH LOGIN PASSWORD 'change_this_password';
CREATE ROLE omnicare_monitor WITH LOGIN PASSWORD 'change_this_password';

-- Create functional roles
CREATE ROLE physician_role;
CREATE ROLE nurse_role;
CREATE ROLE admin_staff_role;
CREATE ROLE pharmacist_role;
CREATE ROLE lab_tech_role;
CREATE ROLE radiology_tech_role;
CREATE ROLE patient_role;

-- Grant schema permissions
GRANT ALL ON SCHEMA fhir TO omnicare_app;
GRANT ALL ON SCHEMA audit TO omnicare_app;
GRANT ALL ON SCHEMA admin TO omnicare_app;
GRANT ALL ON SCHEMA reporting TO omnicare_app;

-- Read-only access
GRANT USAGE ON SCHEMA fhir TO omnicare_readonly;
GRANT USAGE ON SCHEMA reporting TO omnicare_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA fhir TO omnicare_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO omnicare_readonly;

-- Backup role permissions
GRANT USAGE ON SCHEMA fhir, audit, admin, reporting TO omnicare_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA fhir, audit, admin, reporting TO omnicare_backup;

-- Monitor role permissions
GRANT USAGE ON SCHEMA admin TO omnicare_monitor;
GRANT SELECT ON ALL TABLES IN SCHEMA admin TO omnicare_monitor;
GRANT pg_monitor TO omnicare_monitor;

-- =====================================================
-- Security Policies (Row Level Security)
-- =====================================================

-- Enable RLS on sensitive tables
ALTER TABLE fhir.patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir.encounter ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir.observation ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir.condition ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir.medication_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir.medication_administration ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir.allergy_intolerance ENABLE ROW LEVEL SECURITY;

-- Patient access policy - users can only see patients they have legitimate access to
CREATE POLICY patient_access_policy ON fhir.patient
    FOR ALL TO omnicare_app
    USING (
        -- System admin can see all
        current_setting('app.user_role', true) = 'system_admin' OR
        -- Healthcare providers can see patients in their care
        EXISTS (
            SELECT 1 FROM fhir.encounter e 
            WHERE e.patient_id = patient.id 
            AND e.practitioner_id = current_setting('app.user_id', true)::UUID
        ) OR
        -- Same organization patients
        EXISTS (
            SELECT 1 FROM admin.user_roles ur
            WHERE ur.user_id = current_setting('app.user_id', true)::UUID
            AND ur.scope_organization_id = patient.managing_organization
            AND ur.active = true
        )
    );

-- Encounter access policy
CREATE POLICY encounter_access_policy ON fhir.encounter
    FOR ALL TO omnicare_app
    USING (
        current_setting('app.user_role', true) = 'system_admin' OR
        practitioner_id = current_setting('app.user_id', true)::UUID OR
        EXISTS (
            SELECT 1 FROM admin.user_roles ur
            WHERE ur.user_id = current_setting('app.user_id', true)::UUID
            AND ur.scope_organization_id = organization_id
            AND ur.active = true
        )
    );

-- Clinical data access policy (observations, conditions, etc.)
CREATE POLICY clinical_data_access_policy ON fhir.observation
    FOR ALL TO omnicare_app
    USING (
        current_setting('app.user_role', true) = 'system_admin' OR
        practitioner_id = current_setting('app.user_id', true)::UUID OR
        EXISTS (
            SELECT 1 FROM fhir.encounter e
            WHERE e.patient_id = observation.patient_id
            AND e.practitioner_id = current_setting('app.user_id', true)::UUID
        )
    );

-- Apply similar policies to other clinical tables
CREATE POLICY clinical_data_access_policy ON fhir.condition
    FOR ALL TO omnicare_app
    USING (
        current_setting('app.user_role', true) = 'system_admin' OR
        asserter_practitioner_id = current_setting('app.user_id', true)::UUID OR
        EXISTS (
            SELECT 1 FROM fhir.encounter e
            WHERE e.patient_id = condition.patient_id
            AND e.practitioner_id = current_setting('app.user_id', true)::UUID
        )
    );

CREATE POLICY clinical_data_access_policy ON fhir.medication_request
    FOR ALL TO omnicare_app
    USING (
        current_setting('app.user_role', true) = 'system_admin' OR
        practitioner_id = current_setting('app.user_id', true)::UUID OR
        EXISTS (
            SELECT 1 FROM fhir.encounter e
            WHERE e.patient_id = medication_request.patient_id
            AND e.practitioner_id = current_setting('app.user_id', true)::UUID
        )
    );

-- =====================================================
-- Database Functions and Procedures
-- =====================================================

-- Function to set user context for RLS
CREATE OR REPLACE FUNCTION admin.set_user_context(
    p_user_id UUID,
    p_user_role VARCHAR(50),
    p_session_id VARCHAR(128) DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Set current user context for row level security
    PERFORM set_config('app.user_id', p_user_id::TEXT, true);
    PERFORM set_config('app.user_role', p_user_role, true);
    
    IF p_session_id IS NOT NULL THEN
        PERFORM set_config('app.session_id', p_session_id, true);
    END IF;
    
    -- Log the context setting
    INSERT INTO audit.activity_log (
        user_id, session_id, event_type, event_category, event_action,
        event_description
    ) VALUES (
        p_user_id, p_session_id, 'system', 'authentication', 'set_context',
        'User context set for session'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate FHIR resource structure
CREATE OR REPLACE FUNCTION fhir.validate_resource_structure(
    p_resource_type VARCHAR(50),
    p_resource_data JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    required_fields TEXT[];
    field_name TEXT;
BEGIN
    -- Define required fields by resource type
    CASE p_resource_type
        WHEN 'Patient' THEN
            required_fields := ARRAY['resourceType', 'identifier', 'name'];
        WHEN 'Encounter' THEN
            required_fields := ARRAY['resourceType', 'status', 'class', 'subject'];
        WHEN 'Observation' THEN
            required_fields := ARRAY['resourceType', 'status', 'category', 'code', 'subject'];
        WHEN 'Condition' THEN
            required_fields := ARRAY['resourceType', 'clinicalStatus', 'code', 'subject'];
        WHEN 'MedicationRequest' THEN
            required_fields := ARRAY['resourceType', 'status', 'intent', 'medication', 'subject'];
        ELSE
            required_fields := ARRAY['resourceType'];
    END CASE;
    
    -- Check if all required fields are present
    FOREACH field_name IN ARRAY required_fields
    LOOP
        IF NOT (p_resource_data ? field_name) THEN
            RAISE EXCEPTION 'Missing required field: %', field_name;
        END IF;
    END LOOP;
    
    -- Validate resourceType matches
    IF (p_resource_data->>'resourceType') != p_resource_type THEN
        RAISE EXCEPTION 'Resource type mismatch: expected %, got %', 
                       p_resource_type, (p_resource_data->>'resourceType');
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function for automated database maintenance
CREATE OR REPLACE FUNCTION admin.automated_maintenance()
RETURNS TABLE(task_name TEXT, status TEXT, duration_ms INTEGER) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    task_duration INTEGER;
BEGIN
    -- Vacuum and analyze critical tables
    start_time := clock_timestamp();
    
    VACUUM ANALYZE fhir.patient;
    VACUUM ANALYZE fhir.encounter;
    VACUUM ANALYZE fhir.observation;
    VACUUM ANALYZE audit.activity_log;
    
    end_time := clock_timestamp();
    task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    task_name := 'vacuum_analyze';
    status := 'completed';
    duration_ms := task_duration;
    RETURN NEXT;
    
    -- Refresh materialized views
    start_time := clock_timestamp();
    
    REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.patient_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.active_encounters;
    REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.lab_results_trending;
    
    end_time := clock_timestamp();
    task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    task_name := 'refresh_materialized_views';
    status := 'completed';
    duration_ms := task_duration;
    RETURN NEXT;
    
    -- Collect database statistics
    start_time := clock_timestamp();
    
    PERFORM admin.collect_database_stats();
    PERFORM admin.update_table_statistics();
    
    end_time := clock_timestamp();
    task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    task_name := 'collect_statistics';
    status := 'completed';
    duration_ms := task_duration;
    RETURN NEXT;
    
    -- Archive old audit logs (older than 7 years)
    start_time := clock_timestamp();
    
    DELETE FROM audit.activity_log 
    WHERE event_time < CURRENT_TIMESTAMP - INTERVAL '7 years';
    
    end_time := clock_timestamp();
    task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    task_name := 'archive_old_logs';
    status := 'completed';
    duration_ms := task_duration;
    RETURN NEXT;
    
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Monitoring and Health Checks
-- =====================================================

-- Function to check database health
CREATE OR REPLACE FUNCTION admin.health_check()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    value TEXT,
    threshold TEXT,
    recommendation TEXT
) AS $$
DECLARE
    conn_count INTEGER;
    db_size_mb NUMERIC;
    oldest_xact_age INTEGER;
    lock_count INTEGER;
BEGIN
    -- Connection count check
    SELECT COUNT(*) INTO conn_count FROM pg_stat_activity WHERE state = 'active';
    
    check_name := 'active_connections';
    value := conn_count::TEXT;
    threshold := '150';
    
    IF conn_count > 150 THEN
        status := 'warning';
        recommendation := 'High connection count - consider connection pooling';
    ELSIF conn_count > 180 THEN
        status := 'critical';
        recommendation := 'Critical connection count - immediate action required';
    ELSE
        status := 'healthy';
        recommendation := 'Connection count within normal range';
    END IF;
    
    RETURN NEXT;
    
    -- Database size check
    SELECT pg_database_size(current_database()) / 1024 / 1024 INTO db_size_mb;
    
    check_name := 'database_size_mb';
    value := db_size_mb::TEXT;
    threshold := '100000'; -- 100GB
    
    IF db_size_mb > 100000 THEN
        status := 'warning';
        recommendation := 'Large database size - consider archiving old data';
    ELSE
        status := 'healthy';
        recommendation := 'Database size within acceptable range';
    END IF;
    
    RETURN NEXT;
    
    -- Long running transaction check
    SELECT COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - xact_start))), 0)
    INTO oldest_xact_age
    FROM pg_stat_activity 
    WHERE state IN ('active', 'idle in transaction');
    
    check_name := 'oldest_transaction_seconds';
    value := oldest_xact_age::TEXT;
    threshold := '300'; -- 5 minutes
    
    IF oldest_xact_age > 300 THEN
        status := 'warning';
        recommendation := 'Long running transaction detected - investigate';
    ELSE
        status := 'healthy';
        recommendation := 'No long running transactions';
    END IF;
    
    RETURN NEXT;
    
    -- Lock count check
    SELECT COUNT(*) INTO lock_count FROM pg_locks WHERE NOT granted;
    
    check_name := 'waiting_locks';
    value := lock_count::TEXT;
    threshold := '10';
    
    IF lock_count > 10 THEN
        status := 'warning';
        recommendation := 'High number of waiting locks - check for contention';
    ELSE
        status := 'healthy';
        recommendation := 'Lock contention within normal range';
    END IF;
    
    RETURN NEXT;
    
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Scheduled Jobs Setup (using pg_cron if available)
-- =====================================================

-- Note: These require pg_cron extension
-- SELECT cron.schedule('omnicare-maintenance', '0 2 * * *', 'SELECT admin.automated_maintenance();');
-- SELECT cron.schedule('omnicare-stats', '*/15 * * * *', 'SELECT admin.collect_database_stats();');
-- SELECT cron.schedule('omnicare-mv-refresh', '*/30 * * * *', 'SELECT admin.refresh_materialized_views();');

-- =====================================================
-- Initial Data Setup
-- =====================================================

-- Insert default system data
INSERT INTO admin.permissions (permission_name, permission_category, resource_type, action_type, risk_level) VALUES
('patient_read', 'clinical', 'Patient', 'read', 'medium'),
('patient_write', 'clinical', 'Patient', 'write', 'high'),
('encounter_read', 'clinical', 'Encounter', 'read', 'medium'),
('encounter_write', 'clinical', 'Encounter', 'write', 'high'),
('observation_read', 'clinical', 'Observation', 'read', 'medium'),
('observation_write', 'clinical', 'Observation', 'write', 'high'),
('condition_read', 'clinical', 'Condition', 'read', 'medium'),
('condition_write', 'clinical', 'Condition', 'write', 'high'),
('medication_read', 'clinical', 'MedicationRequest', 'read', 'medium'),
('medication_write', 'clinical', 'MedicationRequest', 'write', 'critical'),
('system_admin', 'administrative', 'System', 'admin', 'critical');

-- Insert role permissions
INSERT INTO admin.role_permissions (role_name, permission_id, assigned_by) 
SELECT 'physician', p.id, uuid_generate_v4()
FROM admin.permissions p
WHERE p.permission_name IN ('patient_read', 'patient_write', 'encounter_read', 'encounter_write', 
                           'observation_read', 'observation_write', 'condition_read', 'condition_write',
                           'medication_read', 'medication_write');

INSERT INTO admin.role_permissions (role_name, permission_id, assigned_by)
SELECT 'nurse', p.id, uuid_generate_v4()
FROM admin.permissions p
WHERE p.permission_name IN ('patient_read', 'encounter_read', 'observation_read', 'observation_write',
                           'condition_read', 'medication_read');

INSERT INTO admin.role_permissions (role_name, permission_id, assigned_by)
SELECT 'admin_staff', p.id, uuid_generate_v4()
FROM admin.permissions p
WHERE p.permission_name IN ('patient_read', 'patient_write', 'encounter_read');

-- Insert encryption keys references
INSERT INTO admin.encryption_keys (key_name, key_purpose, key_reference) VALUES
('patient_pii_key', 'Patient PII encryption', 'vault://keys/patient_pii'),
('ssn_encryption_key', 'SSN field encryption', 'vault://keys/ssn'),
('dea_encryption_key', 'DEA number encryption', 'vault://keys/dea');

-- Insert data classification
INSERT INTO admin.data_classification (table_name, column_name, classification_level, data_category, 
                                     encryption_required, hipaa_phi, pii_data) VALUES
('fhir.patient', 'ssn', 'restricted', 'PII', true, true, true),
('fhir.patient', 'family_name', 'confidential', 'PII', false, true, true),
('fhir.patient', 'given_names', 'confidential', 'PII', false, true, true),
('fhir.patient', 'birth_date', 'confidential', 'PHI', false, true, false),
('fhir.practitioner', 'dea_number', 'restricted', 'Professional', true, false, false),
('fhir.observation', 'value_quantity', 'confidential', 'PHI', false, true, false),
('fhir.condition', 'code', 'confidential', 'PHI', false, true, false),
('fhir.medication_request', 'medication_codeable_concept', 'confidential', 'PHI', false, true, false);

-- Create initial admin user (change password immediately)
DO $$
DECLARE
    admin_user_id UUID := uuid_generate_v4();
BEGIN
    -- This would typically be handled by the application
    INSERT INTO admin.user_roles (user_id, role_name, assigned_by, assignment_reason)
    VALUES (admin_user_id, 'system_admin', admin_user_id, 'Initial system setup');
END $$;

-- Final message
SELECT 'OmniCare EMR Database Setup Completed Successfully' as setup_status;

-- Display health check
SELECT * FROM admin.health_check();