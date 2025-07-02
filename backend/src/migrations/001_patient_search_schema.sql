-- Migration: 001_patient_search_schema
-- Description: Optimized patient search schema with full-text search and performance indexes
-- Author: Database Architect
-- Date: 2025-01-17

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For composite GIN indexes
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- For query performance monitoring

-- Create schema for patient data
CREATE SCHEMA IF NOT EXISTS patient_data;
CREATE SCHEMA IF NOT EXISTS search_cache;

-- Main patients table with optimized structure
CREATE TABLE IF NOT EXISTS patient_data.patients (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    omnicare_patient_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- FHIR resource metadata
    resource_type VARCHAR(50) DEFAULT 'Patient' NOT NULL,
    version_id INTEGER DEFAULT 1 NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Core demographics
    active BOOLEAN DEFAULT true NOT NULL,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'unknown')),
    birth_date DATE NOT NULL,
    deceased_boolean BOOLEAN DEFAULT false,
    deceased_date_time TIMESTAMP WITH TIME ZONE,
    
    -- Names (denormalized for search performance)
    name_given_first VARCHAR(100),
    name_given_middle VARCHAR(100),
    name_family VARCHAR(100) NOT NULL,
    name_full_text VARCHAR(300) GENERATED ALWAYS AS (
        TRIM(COALESCE(name_given_first, '') || ' ' || 
             COALESCE(name_given_middle, '') || ' ' || 
             COALESCE(name_family, ''))
    ) STORED,
    
    -- Contact information
    phone_primary VARCHAR(50),
    phone_mobile VARCHAR(50),
    email_primary VARCHAR(255),
    
    -- Address (denormalized for search)
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    address_city VARCHAR(100),
    address_state VARCHAR(50),
    address_postal_code VARCHAR(20),
    address_country VARCHAR(50) DEFAULT 'US',
    
    -- Full address for text search
    address_full_text VARCHAR(500) GENERATED ALWAYS AS (
        TRIM(COALESCE(address_line1, '') || ' ' || 
             COALESCE(address_line2, '') || ' ' || 
             COALESCE(address_city, '') || ' ' || 
             COALESCE(address_state, '') || ' ' || 
             COALESCE(address_postal_code, '') || ' ' || 
             COALESCE(address_country, ''))
    ) STORED,
    
    -- Registration and tracking
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    preferred_language VARCHAR(10) DEFAULT 'en',
    marital_status VARCHAR(50),
    
    -- JSONB fields for complex data
    identifiers JSONB DEFAULT '[]'::jsonb,
    telecom JSONB DEFAULT '[]'::jsonb,
    addresses JSONB DEFAULT '[]'::jsonb,
    names JSONB DEFAULT '[]'::jsonb,
    
    -- References
    managing_organization_id UUID,
    primary_practitioner_id UUID,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by VARCHAR(255),
    
    -- Search optimization fields
    search_tokens TSVECTOR,
    
    -- Data integrity constraints
    CONSTRAINT chk_deceased CHECK (
        (deceased_boolean = false AND deceased_date_time IS NULL) OR
        (deceased_boolean = true)
    ),
    CONSTRAINT chk_birth_date CHECK (birth_date <= CURRENT_DATE)
);

-- Emergency contacts table
CREATE TABLE IF NOT EXISTS patient_data.emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient_data.patients(id) ON DELETE CASCADE,
    relationship VARCHAR(100) NOT NULL,
    name_given VARCHAR(100),
    name_family VARCHAR(100) NOT NULL,
    phone_primary VARCHAR(50) NOT NULL,
    phone_secondary VARCHAR(50),
    email VARCHAR(255),
    address_line1 VARCHAR(255),
    address_city VARCHAR(100),
    address_state VARCHAR(50),
    address_postal_code VARCHAR(20),
    priority INTEGER DEFAULT 1 CHECK (priority > 0),
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT unq_patient_priority UNIQUE(patient_id, priority)
);

-- Insurance information table
CREATE TABLE IF NOT EXISTS patient_data.insurance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient_data.patients(id) ON DELETE CASCADE,
    subscriber_id VARCHAR(100) NOT NULL,
    payor_name VARCHAR(255) NOT NULL,
    payor_id VARCHAR(100),
    plan_name VARCHAR(255),
    group_number VARCHAR(100),
    policy_number VARCHAR(100),
    relationship_to_subscriber VARCHAR(50) CHECK (
        relationship_to_subscriber IN ('self', 'spouse', 'child', 'other')
    ),
    effective_date DATE NOT NULL,
    termination_date DATE,
    copay_amount DECIMAL(10, 2),
    deductible_amount DECIMAL(10, 2),
    active BOOLEAN DEFAULT true NOT NULL,
    priority INTEGER DEFAULT 1 CHECK (priority > 0),
    verification_status VARCHAR(50) DEFAULT 'unverified',
    last_verified_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT unq_patient_insurance_priority UNIQUE(patient_id, priority),
    CONSTRAINT chk_insurance_dates CHECK (
        termination_date IS NULL OR termination_date >= effective_date
    )
);

-- Patient alerts table
CREATE TABLE IF NOT EXISTS patient_data.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient_data.patients(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (
        type IN ('allergy', 'medical', 'behavioral', 'infection-control', 'safety', 'other')
    ),
    severity VARCHAR(20) NOT NULL CHECK (
        severity IN ('low', 'medium', 'high', 'critical')
    ),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expiration_date TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT true NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_alert_dates CHECK (
        expiration_date IS NULL OR expiration_date > effective_date
    )
);

-- Full-text search configuration
ALTER TABLE patient_data.patients ADD COLUMN IF NOT EXISTS search_tokens TSVECTOR
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', COALESCE(name_full_text, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(omnicare_patient_id, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(phone_primary, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(email_primary, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(address_full_text, '')), 'C')
    ) STORED;

-- Primary indexes for patient search
CREATE INDEX idx_patients_search_tokens ON patient_data.patients USING GIN(search_tokens);
CREATE INDEX idx_patients_name_trgm ON patient_data.patients USING GIN(name_full_text gin_trgm_ops);
CREATE INDEX idx_patients_active ON patient_data.patients(active) WHERE active = true;
CREATE INDEX idx_patients_birth_date ON patient_data.patients(birth_date);
CREATE INDEX idx_patients_gender ON patient_data.patients(gender);
CREATE INDEX idx_patients_registration_date ON patient_data.patients(registration_date);

-- Composite indexes for common query patterns
CREATE INDEX idx_patients_active_name ON patient_data.patients(active, name_family, name_given_first) 
    WHERE active = true;
CREATE INDEX idx_patients_city_state ON patient_data.patients(address_city, address_state) 
    WHERE active = true;
CREATE INDEX idx_patients_postal_code ON patient_data.patients(address_postal_code) 
    WHERE active = true;

-- Phone and email indexes
CREATE INDEX idx_patients_phone_primary ON patient_data.patients(phone_primary) 
    WHERE phone_primary IS NOT NULL;
CREATE INDEX idx_patients_phone_mobile ON patient_data.patients(phone_mobile) 
    WHERE phone_mobile IS NOT NULL;
CREATE INDEX idx_patients_email ON patient_data.patients(email_primary) 
    WHERE email_primary IS NOT NULL;

-- JSONB indexes for identifier searches
CREATE INDEX idx_patients_identifiers ON patient_data.patients USING GIN(identifiers);

-- Emergency contacts indexes
CREATE INDEX idx_emergency_contacts_patient ON patient_data.emergency_contacts(patient_id);
CREATE INDEX idx_emergency_contacts_active ON patient_data.emergency_contacts(patient_id, active) 
    WHERE active = true;

-- Insurance indexes
CREATE INDEX idx_insurance_patient ON patient_data.insurance(patient_id);
CREATE INDEX idx_insurance_active ON patient_data.insurance(patient_id, active) 
    WHERE active = true;
CREATE INDEX idx_insurance_subscriber ON patient_data.insurance(subscriber_id);
CREATE INDEX idx_insurance_verification ON patient_data.insurance(verification_status, last_verified_date);

-- Alerts indexes
CREATE INDEX idx_alerts_patient ON patient_data.alerts(patient_id);
CREATE INDEX idx_alerts_active ON patient_data.alerts(patient_id, active) 
    WHERE active = true;
CREATE INDEX idx_alerts_severity ON patient_data.alerts(severity, active) 
    WHERE active = true;
CREATE INDEX idx_alerts_type ON patient_data.alerts(type, active) 
    WHERE active = true;

-- Materialized view for patient search cache
CREATE MATERIALIZED VIEW search_cache.patient_search_view AS
SELECT 
    p.id,
    p.omnicare_patient_id,
    p.name_full_text,
    p.birth_date,
    p.gender,
    p.phone_primary,
    p.email_primary,
    p.address_city,
    p.address_state,
    p.registration_date,
    p.active,
    COUNT(DISTINCT ec.id) as emergency_contact_count,
    COUNT(DISTINCT i.id) FILTER (WHERE i.active = true) as active_insurance_count,
    COUNT(DISTINCT a.id) FILTER (WHERE a.active = true AND a.severity IN ('high', 'critical')) as critical_alert_count,
    MAX(i.last_verified_date) as last_insurance_verification
FROM patient_data.patients p
LEFT JOIN patient_data.emergency_contacts ec ON p.id = ec.patient_id AND ec.active = true
LEFT JOIN patient_data.insurance i ON p.id = i.patient_id
LEFT JOIN patient_data.alerts a ON p.id = a.patient_id
GROUP BY p.id;

-- Index on materialized view
CREATE INDEX idx_patient_search_view_active ON search_cache.patient_search_view(active);
CREATE INDEX idx_patient_search_view_name ON search_cache.patient_search_view(name_full_text);
CREATE INDEX idx_patient_search_view_city ON search_cache.patient_search_view(address_city);

-- Function to refresh patient search cache
CREATE OR REPLACE FUNCTION search_cache.refresh_patient_search_view()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY search_cache.patient_search_view;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION patient_data.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patient_data.patients
    FOR EACH ROW EXECUTE FUNCTION patient_data.update_updated_at_column();

CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON patient_data.emergency_contacts
    FOR EACH ROW EXECUTE FUNCTION patient_data.update_updated_at_column();

CREATE TRIGGER update_insurance_updated_at BEFORE UPDATE ON patient_data.insurance
    FOR EACH ROW EXECUTE FUNCTION patient_data.update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON patient_data.alerts
    FOR EACH ROW EXECUTE FUNCTION patient_data.update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE patient_data.patients IS 'Main patient demographics table optimized for search performance';
COMMENT ON COLUMN patient_data.patients.search_tokens IS 'Full-text search tokens for fast patient lookup';
COMMENT ON COLUMN patient_data.patients.name_full_text IS 'Computed full name for efficient searching';
COMMENT ON COLUMN patient_data.patients.address_full_text IS 'Computed full address for text search';

-- Grant permissions (adjust as needed)
GRANT USAGE ON SCHEMA patient_data TO omnicare_app;
GRANT USAGE ON SCHEMA search_cache TO omnicare_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA patient_data TO omnicare_app;
GRANT SELECT ON ALL TABLES IN SCHEMA search_cache TO omnicare_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA patient_data TO omnicare_app;