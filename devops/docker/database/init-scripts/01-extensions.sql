-- Initialize PostgreSQL extensions for OmniCare EMR
-- This script runs after database creation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Performance monitoring extension
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Audit logging extension (if available)
-- CREATE EXTENSION IF NOT EXISTS "pg_audit";

-- Full-text search
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Create schemas for organization
CREATE SCHEMA IF NOT EXISTS fhir;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS monitoring;
CREATE SCHEMA IF NOT EXISTS security;

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA fhir TO omnicare_user;
GRANT USAGE ON SCHEMA audit TO omnicare_user;
GRANT USAGE ON SCHEMA monitoring TO omnicare_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA fhir GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO omnicare_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA fhir GRANT USAGE, SELECT ON SEQUENCES TO omnicare_user;

-- Create audit logging infrastructure
CREATE TABLE IF NOT EXISTS audit.application_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit.application_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit.application_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit.application_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit.application_logs(resource_type, resource_id);

-- Create monitoring tables
CREATE TABLE IF NOT EXISTS monitoring.health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_checks_service ON monitoring.health_checks(service_name);
CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp ON monitoring.health_checks(checked_at);

-- Create function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function for audit logging
CREATE OR REPLACE FUNCTION audit_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit.application_logs (
            action, 
            resource_type, 
            resource_id, 
            new_values
        ) VALUES (
            'INSERT',
            TG_TABLE_NAME,
            NEW.id,
            row_to_json(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit.application_logs (
            action, 
            resource_type, 
            resource_id, 
            old_values,
            new_values
        ) VALUES (
            'UPDATE',
            TG_TABLE_NAME,
            NEW.id,
            row_to_json(OLD),
            row_to_json(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit.application_logs (
            action, 
            resource_type, 
            resource_id, 
            old_values
        ) VALUES (
            'DELETE',
            TG_TABLE_NAME,
            OLD.id,
            row_to_json(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Set timezone to UTC
SET timezone = 'UTC';