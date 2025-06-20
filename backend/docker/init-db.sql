-- OmniCare FHIR Backend Database Initialization Script
-- This script sets up the initial database structure for the OmniCare EMR system

-- Set up database encoding and locale
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS fhir;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Set search path
SET search_path = public, fhir, audit, analytics;

-- ===============================
-- AUDIT TABLES
-- ===============================

-- Audit log table for tracking all API access
CREATE TABLE IF NOT EXISTS audit.api_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id VARCHAR(255),
    client_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    method VARCHAR(10) NOT NULL,
    path TEXT NOT NULL,
    query_params JSONB,
    status_code INTEGER,
    response_time_ms INTEGER,
    request_size INTEGER,
    response_size INTEGER,
    error_message TEXT,
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    CONSTRAINT valid_method CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'))
);

-- FHIR resource audit log
CREATE TABLE IF NOT EXISTS audit.fhir_resource_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id VARCHAR(255),
    client_id VARCHAR(255),
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    operation VARCHAR(20) NOT NULL,
    resource_version_id VARCHAR(255),
    old_resource JSONB,
    new_resource JSONB,
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(255),
    CONSTRAINT valid_operation CHECK (operation IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'SEARCH', 'VALIDATE'))
);

-- Security events audit log
CREATE TABLE IF NOT EXISTS audit.security_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    user_id VARCHAR(255),
    client_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    additional_data JSONB,
    risk_score INTEGER DEFAULT 0,
    CONSTRAINT valid_risk_score CHECK (risk_score >= 0 AND risk_score <= 100)
);

-- ===============================
-- ANALYTICS TABLES
-- ===============================

-- Performance metrics
CREATE TABLE IF NOT EXISTS analytics.performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    unit VARCHAR(20),
    tags JSONB,
    resource_type VARCHAR(50),
    endpoint VARCHAR(255)
);

-- Usage statistics
CREATE TABLE IF NOT EXISTS analytics.usage_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    resource_type VARCHAR(50),
    operation VARCHAR(20),
    count INTEGER NOT NULL DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    unique_clients INTEGER DEFAULT 0,
    avg_response_time_ms NUMERIC,
    error_rate NUMERIC,
    PRIMARY KEY (date, resource_type, operation)
);

-- System health metrics
CREATE TABLE IF NOT EXISTS analytics.system_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    component VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_time_ms INTEGER,
    error_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    memory_usage_mb NUMERIC,
    cpu_usage_percent NUMERIC,
    disk_usage_percent NUMERIC,
    active_connections INTEGER,
    details JSONB
);

-- ===============================
-- FHIR SUPPORT TABLES
-- ===============================

-- FHIR resource metadata cache
CREATE TABLE IF NOT EXISTS fhir.resource_metadata (
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    version_id VARCHAR(255) NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tags JSONB,
    security_labels JSONB,
    profile JSONB,
    checksum VARCHAR(64),
    PRIMARY KEY (resource_type, resource_id)
);

-- FHIR subscriptions tracking
CREATE TABLE IF NOT EXISTS fhir.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id VARCHAR(255) UNIQUE NOT NULL,
    criteria TEXT NOT NULL,
    channel_type VARCHAR(50) NOT NULL,
    channel_endpoint TEXT,
    channel_payload VARCHAR(100),
    channel_headers JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    reason TEXT,
    error_count INTEGER DEFAULT 0,
    last_notification TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    client_info JSONB,
    CONSTRAINT valid_status CHECK (status IN ('requested', 'active', 'error', 'off'))
);

-- FHIR search index for common searches
CREATE TABLE IF NOT EXISTS fhir.search_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    parameter_name VARCHAR(100) NOT NULL,
    parameter_value TEXT NOT NULL,
    parameter_type VARCHAR(20) NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_parameter_type CHECK (parameter_type IN ('string', 'token', 'reference', 'composite', 'number', 'date', 'quantity', 'uri'))
);

-- Clinical Decision Support rules cache
CREATE TABLE IF NOT EXISTS fhir.cds_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id VARCHAR(255) UNIQUE NOT NULL,
    hook_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    priority INTEGER DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    version VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_executed TIMESTAMPTZ,
    execution_count INTEGER DEFAULT 0
);

-- ===============================
-- INDEXES FOR PERFORMANCE
-- ===============================

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_api_audit_timestamp ON audit.api_audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_audit_user_id ON audit.api_audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_api_audit_path ON audit.api_audit_log USING gin (path gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_api_audit_status ON audit.api_audit_log (status_code);

CREATE INDEX IF NOT EXISTS idx_fhir_audit_timestamp ON audit.fhir_resource_audit (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fhir_audit_resource ON audit.fhir_resource_audit (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_fhir_audit_operation ON audit.fhir_resource_audit (operation);
CREATE INDEX IF NOT EXISTS idx_fhir_audit_user ON audit.fhir_resource_audit (user_id);

CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON audit.security_audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON audit.security_audit_log (event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_user ON audit.security_audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_ip ON audit.security_audit_log (ip_address);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_performance_timestamp ON analytics.performance_metrics (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_type ON analytics.performance_metrics (metric_type, metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_resource ON analytics.performance_metrics (resource_type);

CREATE INDEX IF NOT EXISTS idx_usage_date ON analytics.usage_statistics (date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_resource ON analytics.usage_statistics (resource_type, operation);

CREATE INDEX IF NOT EXISTS idx_system_health_timestamp ON analytics.system_health (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_component ON analytics.system_health (component, status);

-- FHIR indexes
CREATE INDEX IF NOT EXISTS idx_resource_metadata_type_id ON fhir.resource_metadata (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_metadata_updated ON fhir.resource_metadata (last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON fhir.subscriptions (status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_criteria ON fhir.subscriptions USING gin (criteria gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_search_index_resource ON fhir.search_index (resource_type, parameter_name);
CREATE INDEX IF NOT EXISTS idx_search_index_value ON fhir.search_index USING gin (parameter_value gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_search_index_composite ON fhir.search_index (resource_type, parameter_name, parameter_value);

CREATE INDEX IF NOT EXISTS idx_cds_rules_hook ON fhir.cds_rules (hook_type) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_cds_rules_priority ON fhir.cds_rules (priority DESC) WHERE enabled = true;

-- ===============================
-- FUNCTIONS AND TRIGGERS
-- ===============================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for CDS rules
CREATE TRIGGER update_cds_rules_updated_at 
    BEFORE UPDATE ON fhir.cds_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    -- Delete audit logs older than 1 year
    DELETE FROM audit.api_audit_log WHERE timestamp < NOW() - INTERVAL '1 year';
    DELETE FROM audit.fhir_resource_audit WHERE timestamp < NOW() - INTERVAL '1 year';
    DELETE FROM audit.security_audit_log WHERE timestamp < NOW() - INTERVAL '1 year';
    
    -- Delete performance metrics older than 6 months
    DELETE FROM analytics.performance_metrics WHERE timestamp < NOW() - INTERVAL '6 months';
    
    -- Delete usage statistics older than 2 years
    DELETE FROM analytics.usage_statistics WHERE date < CURRENT_DATE - INTERVAL '2 years';
    
    -- Delete system health records older than 3 months
    DELETE FROM analytics.system_health WHERE timestamp < NOW() - INTERVAL '3 months';
    
    -- Vacuum tables to reclaim space
    VACUUM ANALYZE audit.api_audit_log;
    VACUUM ANALYZE audit.fhir_resource_audit;
    VACUUM ANALYZE audit.security_audit_log;
    VACUUM ANALYZE analytics.performance_metrics;
    VACUUM ANALYZE analytics.usage_statistics;
    VACUUM ANALYZE analytics.system_health;
END;
$$ LANGUAGE plpgsql;

-- ===============================
-- ROLES AND PERMISSIONS
-- ===============================

-- Create application roles
DO $$
BEGIN
    -- Application service role
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'omnicare_app') THEN
        CREATE ROLE omnicare_app LOGIN PASSWORD 'change_me_in_production';
    END IF;
    
    -- Read-only analytics role
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'omnicare_analytics') THEN
        CREATE ROLE omnicare_analytics LOGIN PASSWORD 'change_me_in_production';
    END IF;
    
    -- Backup role
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'omnicare_backup') THEN
        CREATE ROLE omnicare_backup LOGIN PASSWORD 'change_me_in_production';
    END IF;
END
$$;

-- Grant permissions
GRANT USAGE ON SCHEMA fhir TO omnicare_app;
GRANT USAGE ON SCHEMA audit TO omnicare_app;
GRANT USAGE ON SCHEMA analytics TO omnicare_app;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA fhir TO omnicare_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA audit TO omnicare_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analytics TO omnicare_app;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA fhir TO omnicare_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA audit TO omnicare_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA analytics TO omnicare_app;

-- Analytics role permissions (read-only)
GRANT USAGE ON SCHEMA analytics TO omnicare_analytics;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO omnicare_analytics;
GRANT SELECT ON audit.api_audit_log TO omnicare_analytics;
GRANT SELECT ON audit.fhir_resource_audit TO omnicare_analytics;

-- Backup role permissions
GRANT USAGE ON SCHEMA fhir TO omnicare_backup;
GRANT USAGE ON SCHEMA audit TO omnicare_backup;
GRANT USAGE ON SCHEMA analytics TO omnicare_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA fhir TO omnicare_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA audit TO omnicare_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO omnicare_backup;

-- ===============================
-- INITIAL DATA
-- ===============================

-- Insert default CDS rules
INSERT INTO fhir.cds_rules (rule_id, hook_type, name, description, conditions, actions, priority, version) VALUES
('vital-signs-alert', 'patient-view', 'Vital Signs Alert', 'Alert for abnormal vital signs', 
 '{"resourceType": "Observation", "category": "vital-signs"}', 
 '{"type": "alert", "message": "Review abnormal vital signs"}', 
 1, '1.0'),
('medication-interaction', 'medication-prescribe', 'Drug Interaction Check', 'Check for dangerous drug interactions',
 '{"resourceType": "MedicationRequest"}',
 '{"type": "warning", "message": "Check for drug interactions"}',
 2, '1.0'),
('allergy-check', 'medication-prescribe', 'Allergy Alert', 'Check for patient allergies',
 '{"resourceType": "MedicationRequest"}',
 '{"type": "critical", "message": "Patient has documented allergies"}',
 3, '1.0')
ON CONFLICT (rule_id) DO NOTHING;

-- Create initial subscription for system monitoring
INSERT INTO fhir.subscriptions (subscription_id, criteria, channel_type, status, reason) VALUES
('system-monitoring', 'Patient', 'rest-hook', 'active', 'System monitoring subscription')
ON CONFLICT (subscription_id) DO NOTHING;

-- ===============================
-- COMPLETION MESSAGE
-- ===============================

-- Log completion
INSERT INTO analytics.system_health (component, status, details) VALUES
('database-init', 'UP', '{"message": "Database initialization completed successfully", "timestamp": "' || NOW() || '"}');

-- Show completion message
DO $$
BEGIN
    RAISE NOTICE 'OmniCare FHIR Backend database initialization completed successfully!';
    RAISE NOTICE 'Schemas created: fhir, audit, analytics';
    RAISE NOTICE 'Tables created: % in total', (
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema IN ('fhir', 'audit', 'analytics')
    );
    RAISE NOTICE 'Indexes created for optimal performance';
    RAISE NOTICE 'Default roles and permissions configured';
END
$$;