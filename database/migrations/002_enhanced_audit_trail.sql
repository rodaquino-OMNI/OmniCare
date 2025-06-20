-- =====================================================
-- OmniCare EMR - Enhanced Audit Trail Migration
-- Author: Database Engineer  
-- Purpose: Comprehensive audit trail with HIPAA compliance
-- Version: 1.0.0
-- Date: 2025-01-20
-- =====================================================

-- Record this migration
INSERT INTO migration.applied_migrations (version, name, applied_by) 
VALUES ('002', 'enhanced_audit_trail', 'database_engineer');

-- =====================================================
-- Enhanced Audit Tables
-- =====================================================

-- Create detailed resource change tracking table
CREATE TABLE audit.resource_change_detail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Change identification
    change_id UUID NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    
    -- Change details
    field_path TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    value_type VARCHAR(50),
    
    -- Change metadata
    change_type VARCHAR(20) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    changed_by UUID NOT NULL,
    
    -- Validation
    is_sensitive BOOLEAN DEFAULT FALSE,
    requires_justification BOOLEAN DEFAULT FALSE,
    justification TEXT,
    
    CONSTRAINT valid_change_type CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE', 'VIEW'))
);

-- Create HIPAA-specific disclosure tracking
CREATE TABLE audit.hipaa_disclosure_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Disclosure identification
    disclosure_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    patient_id UUID NOT NULL,
    
    -- Recipient information
    recipient_type VARCHAR(50) NOT NULL,
    recipient_name VARCHAR(200) NOT NULL,
    recipient_organization VARCHAR(200),
    recipient_address TEXT,
    
    -- Disclosure details
    purpose_of_disclosure VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Data disclosed
    resources_disclosed JSONB NOT NULL,
    fields_disclosed TEXT[],
    date_range_start DATE,
    date_range_end DATE,
    
    -- Authorization
    authorization_type VARCHAR(50) NOT NULL,
    authorization_reference VARCHAR(200),
    authorized_by UUID,
    
    -- Compliance
    accounting_required BOOLEAN DEFAULT TRUE,
    patient_notified BOOLEAN DEFAULT FALSE,
    notification_date DATE,
    
    -- Metadata
    disclosed_by UUID NOT NULL,
    disclosure_method VARCHAR(50),
    
    CONSTRAINT valid_recipient_type CHECK (recipient_type IN (
        'healthcare_provider', 'insurance', 'patient', 'legal', 'research', 'public_health', 'other'
    )),
    CONSTRAINT valid_authorization_type CHECK (authorization_type IN (
        'patient_consent', 'treatment', 'payment', 'operations', 'legal_requirement', 'emergency'
    ))
);

-- Create consent management table
CREATE TABLE audit.patient_consent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Patient identification
    patient_id UUID NOT NULL,
    
    -- Consent details
    consent_type VARCHAR(50) NOT NULL,
    consent_status VARCHAR(20) NOT NULL,
    
    -- Scope
    scope_resources TEXT[],
    scope_actions TEXT[],
    scope_purposes TEXT[],
    
    -- Recipients
    allowed_recipients TEXT[],
    denied_recipients TEXT[],
    
    -- Validity period
    effective_date DATE NOT NULL,
    expiration_date DATE,
    
    -- Consent capture
    consent_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    consent_method VARCHAR(50),
    consent_reference VARCHAR(200),
    
    -- Revocation
    revoked BOOLEAN DEFAULT FALSE,
    revocation_date TIMESTAMP WITH TIME ZONE,
    revocation_reason TEXT,
    
    -- Metadata
    created_by UUID NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_consent_type CHECK (consent_type IN (
        'general', 'research', 'mental_health', 'substance_abuse', 'hiv', 'genetic', 'reproductive'
    )),
    CONSTRAINT valid_consent_status CHECK (consent_status IN (
        'proposed', 'active', 'inactive', 'expired', 'revoked'
    ))
);

-- Create access attempt logging for security
CREATE TABLE audit.access_attempt_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Attempt details
    attempt_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    username VARCHAR(100),
    
    -- Access details
    resource_type VARCHAR(50),
    resource_id UUID,
    action_attempted VARCHAR(50),
    
    -- Result
    access_granted BOOLEAN NOT NULL,
    denial_reason VARCHAR(100),
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(128),
    
    -- Security flags
    suspicious_activity BOOLEAN DEFAULT FALSE,
    security_alert_raised BOOLEAN DEFAULT FALSE,
    
    -- Response
    response_action VARCHAR(50),
    
    CONSTRAINT valid_response_action CHECK (response_action IN (
        'none', 'warning_issued', 'account_locked', 'admin_notified', 'security_alert'
    ))
);

-- Create integrity monitoring table
CREATE TABLE audit.data_integrity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Check details
    check_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    check_type VARCHAR(50) NOT NULL,
    
    -- Target
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    
    -- Results
    integrity_valid BOOLEAN NOT NULL,
    issues_found TEXT[],
    
    -- Hash verification
    expected_hash VARCHAR(64),
    actual_hash VARCHAR(64),
    
    -- Resolution
    auto_corrected BOOLEAN DEFAULT FALSE,
    correction_details JSONB,
    manual_review_required BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    checked_by VARCHAR(100) DEFAULT 'system',
    
    CONSTRAINT valid_check_type CHECK (check_type IN (
        'hash_verification', 'referential_integrity', 'data_validation', 'consistency_check'
    ))
);

-- =====================================================
-- Enhanced Audit Indexes
-- =====================================================

-- Resource change detail indexes
CREATE INDEX idx_resource_change_detail_resource ON audit.resource_change_detail(resource_type, resource_id);
CREATE INDEX idx_resource_change_detail_changed_at ON audit.resource_change_detail(changed_at);
CREATE INDEX idx_resource_change_detail_changed_by ON audit.resource_change_detail(changed_by);
CREATE INDEX idx_resource_change_detail_sensitive ON audit.resource_change_detail(is_sensitive) WHERE is_sensitive = TRUE;

-- HIPAA disclosure log indexes
CREATE INDEX idx_hipaa_disclosure_patient ON audit.hipaa_disclosure_log(patient_id);
CREATE INDEX idx_hipaa_disclosure_date ON audit.hipaa_disclosure_log(disclosure_date);
CREATE INDEX idx_hipaa_disclosure_recipient ON audit.hipaa_disclosure_log(recipient_type, recipient_name);
CREATE INDEX idx_hipaa_disclosure_accounting ON audit.hipaa_disclosure_log(accounting_required) WHERE accounting_required = TRUE;

-- Patient consent indexes
CREATE INDEX idx_patient_consent_patient ON audit.patient_consent(patient_id);
CREATE INDEX idx_patient_consent_type_status ON audit.patient_consent(consent_type, consent_status);
CREATE INDEX idx_patient_consent_effective ON audit.patient_consent(effective_date, expiration_date);
CREATE INDEX idx_patient_consent_active ON audit.patient_consent(patient_id, consent_status) WHERE consent_status = 'active';

-- Access attempt log indexes
CREATE INDEX idx_access_attempt_time ON audit.access_attempt_log(attempt_time);
CREATE INDEX idx_access_attempt_user ON audit.access_attempt_log(user_id);
CREATE INDEX idx_access_attempt_denied ON audit.access_attempt_log(access_granted) WHERE access_granted = FALSE;
CREATE INDEX idx_access_attempt_suspicious ON audit.access_attempt_log(suspicious_activity) WHERE suspicious_activity = TRUE;

-- Data integrity log indexes
CREATE INDEX idx_data_integrity_check_time ON audit.data_integrity_log(check_time);
CREATE INDEX idx_data_integrity_table ON audit.data_integrity_log(table_name);
CREATE INDEX idx_data_integrity_invalid ON audit.data_integrity_log(integrity_valid) WHERE integrity_valid = FALSE;
CREATE INDEX idx_data_integrity_review ON audit.data_integrity_log(manual_review_required) WHERE manual_review_required = TRUE;

-- =====================================================
-- Enhanced Audit Trigger Functions
-- =====================================================

-- Function to capture detailed field changes
CREATE OR REPLACE FUNCTION audit.capture_field_changes()
RETURNS TRIGGER AS $$
DECLARE
    change_id UUID := uuid_generate_v4();
    field_record RECORD;
    old_json JSONB;
    new_json JSONB;
    current_user_id UUID;
BEGIN
    -- Get current user context
    current_user_id := current_setting('app.current_user_id', true)::UUID;
    
    IF TG_OP = 'UPDATE' THEN
        old_json := row_to_json(OLD)::JSONB;
        new_json := row_to_json(NEW)::JSONB;
        
        -- Iterate through all fields
        FOR field_record IN 
            SELECT key, old_json->key as old_val, new_json->key as new_val
            FROM jsonb_object_keys(old_json) key
            WHERE old_json->key IS DISTINCT FROM new_json->key
        LOOP
            INSERT INTO audit.resource_change_detail (
                change_id, resource_type, resource_id, field_path,
                old_value, new_value, change_type, changed_by,
                is_sensitive
            ) VALUES (
                change_id, TG_TABLE_NAME, NEW.id, field_record.key,
                field_record.old_val::TEXT, field_record.new_val::TEXT,
                'UPDATE', current_user_id,
                -- Mark sensitive fields
                field_record.key IN ('ssn', 'dea_number', 'password_hash')
            );
        END LOOP;
    ELSIF TG_OP = 'INSERT' THEN
        new_json := row_to_json(NEW)::JSONB;
        
        INSERT INTO audit.resource_change_detail (
            change_id, resource_type, resource_id, field_path,
            new_value, change_type, changed_by
        ) VALUES (
            change_id, TG_TABLE_NAME, NEW.id, 'record',
            new_json::TEXT, 'CREATE', current_user_id
        );
    ELSIF TG_OP = 'DELETE' THEN
        old_json := row_to_json(OLD)::JSONB;
        
        INSERT INTO audit.resource_change_detail (
            change_id, resource_type, resource_id, field_path,
            old_value, change_type, changed_by
        ) VALUES (
            change_id, TG_TABLE_NAME, OLD.id, 'record',
            old_json::TEXT, 'DELETE', current_user_id
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to track patient data access
CREATE OR REPLACE FUNCTION audit.track_patient_access()
RETURNS TRIGGER AS $$
DECLARE
    patient_id_val UUID;
    current_user_id UUID;
    current_session_id VARCHAR(128);
BEGIN
    -- Only track SELECT operations (this would be called from application layer)
    IF TG_OP != 'SELECT' THEN
        RETURN NEW;
    END IF;
    
    -- Get current context
    current_user_id := current_setting('app.current_user_id', true)::UUID;
    current_session_id := current_setting('app.current_session_id', true);
    
    -- Extract patient_id
    IF TG_TABLE_NAME = 'patient' THEN
        patient_id_val := NEW.id;
    ELSIF (NEW.*) ? 'patient_id' THEN
        patient_id_val := NEW.patient_id;
    ELSE
        RETURN NEW;
    END IF;
    
    -- Log the access
    INSERT INTO audit.patient_access_log (
        user_id, patient_id, access_type, session_id,
        resources_accessed, legitimate_relationship
    ) VALUES (
        current_user_id, patient_id_val, 'view', current_session_id,
        jsonb_build_array(jsonb_build_object('resource', TG_TABLE_NAME, 'id', NEW.id)),
        TRUE -- This would be determined by checking user-patient relationship
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to verify consent before access
CREATE OR REPLACE FUNCTION audit.verify_consent(
    p_patient_id UUID,
    p_user_id UUID,
    p_resource_type VARCHAR(50),
    p_action VARCHAR(50)
) RETURNS BOOLEAN AS $$
DECLARE
    has_consent BOOLEAN := FALSE;
    consent_record RECORD;
BEGIN
    -- Check for active consent
    FOR consent_record IN
        SELECT *
        FROM audit.patient_consent
        WHERE patient_id = p_patient_id
          AND consent_status = 'active'
          AND (scope_resources IS NULL OR p_resource_type = ANY(scope_resources))
          AND (scope_actions IS NULL OR p_action = ANY(scope_actions))
          AND effective_date <= CURRENT_DATE
          AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
          AND NOT revoked
    LOOP
        has_consent := TRUE;
        EXIT;
    END LOOP;
    
    -- Log access attempt
    INSERT INTO audit.access_attempt_log (
        user_id, resource_type, action_attempted,
        access_granted, denial_reason
    ) VALUES (
        p_user_id, p_resource_type, p_action,
        has_consent, 
        CASE WHEN NOT has_consent THEN 'No active consent' ELSE NULL END
    );
    
    RETURN has_consent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log HIPAA disclosures
CREATE OR REPLACE FUNCTION audit.log_hipaa_disclosure(
    p_patient_id UUID,
    p_recipient_type VARCHAR(50),
    p_recipient_name VARCHAR(200),
    p_purpose VARCHAR(100),
    p_resources JSONB,
    p_authorization_type VARCHAR(50),
    p_disclosed_by UUID
) RETURNS UUID AS $$
DECLARE
    disclosure_id UUID;
BEGIN
    INSERT INTO audit.hipaa_disclosure_log (
        patient_id, recipient_type, recipient_name,
        purpose_of_disclosure, resources_disclosed,
        authorization_type, disclosed_by
    ) VALUES (
        p_patient_id, p_recipient_type, p_recipient_name,
        p_purpose, p_resources, p_authorization_type, p_disclosed_by
    ) RETURNING id INTO disclosure_id;
    
    -- Check if patient notification is required
    IF p_authorization_type NOT IN ('treatment', 'payment', 'operations') THEN
        UPDATE audit.hipaa_disclosure_log
        SET accounting_required = TRUE
        WHERE id = disclosure_id;
    END IF;
    
    RETURN disclosure_id;
END;
$$ LANGUAGE plpgsql;

-- Function to perform data integrity checks
CREATE OR REPLACE FUNCTION audit.check_data_integrity(
    p_table_name VARCHAR(100),
    p_record_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    integrity_valid BOOLEAN := TRUE;
    issues TEXT[] := '{}';
    record_hash VARCHAR(64);
BEGIN
    -- Perform various integrity checks based on table
    CASE p_table_name
        WHEN 'fhir.patient' THEN
            -- Check for required fields
            IF EXISTS (
                SELECT 1 FROM fhir.patient
                WHERE (p_record_id IS NULL OR id = p_record_id)
                  AND (mrn IS NULL OR family_name IS NULL OR given_names IS NULL)
            ) THEN
                integrity_valid := FALSE;
                issues := array_append(issues, 'Missing required fields');
            END IF;
            
        WHEN 'fhir.observation' THEN
            -- Check for orphaned observations
            IF EXISTS (
                SELECT 1 FROM fhir.observation o
                WHERE (p_record_id IS NULL OR o.id = p_record_id)
                  AND NOT EXISTS (
                      SELECT 1 FROM fhir.patient p WHERE p.id = o.patient_id
                  )
            ) THEN
                integrity_valid := FALSE;
                issues := array_append(issues, 'Orphaned observation records');
            END IF;
    END CASE;
    
    -- Log the integrity check
    INSERT INTO audit.data_integrity_log (
        check_type, table_name, record_id,
        integrity_valid, issues_found
    ) VALUES (
        'data_validation', p_table_name, p_record_id,
        integrity_valid, issues
    );
    
    RETURN integrity_valid;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Apply Audit Triggers to Sensitive Tables
-- =====================================================

-- Apply detailed change tracking to sensitive tables
CREATE TRIGGER trigger_audit_patient_changes
    AFTER INSERT OR UPDATE OR DELETE ON fhir.patient
    FOR EACH ROW EXECUTE FUNCTION audit.capture_field_changes();

CREATE TRIGGER trigger_audit_practitioner_changes
    AFTER INSERT OR UPDATE OR DELETE ON fhir.practitioner
    FOR EACH ROW EXECUTE FUNCTION audit.capture_field_changes();

CREATE TRIGGER trigger_audit_observation_changes
    AFTER INSERT OR UPDATE OR DELETE ON fhir.observation
    FOR EACH ROW EXECUTE FUNCTION audit.capture_field_changes();

CREATE TRIGGER trigger_audit_medication_changes
    AFTER INSERT OR UPDATE OR DELETE ON fhir.medication_request
    FOR EACH ROW EXECUTE FUNCTION audit.capture_field_changes();

-- =====================================================
-- Audit Reporting Views
-- =====================================================

-- View for HIPAA accounting of disclosures
CREATE VIEW audit.hipaa_accounting_report AS
SELECT 
    d.disclosure_date,
    p.mrn,
    p.family_name || ', ' || p.given_names as patient_name,
    d.recipient_type,
    d.recipient_name,
    d.recipient_organization,
    d.purpose_of_disclosure,
    d.authorization_type,
    jsonb_array_length(d.resources_disclosed) as resources_count,
    u.name as disclosed_by_name,
    d.patient_notified,
    d.notification_date
FROM audit.hipaa_disclosure_log d
JOIN fhir.patient p ON d.patient_id = p.id
LEFT JOIN admin.users u ON d.disclosed_by = u.id
WHERE d.accounting_required = TRUE
ORDER BY d.disclosure_date DESC;

-- View for suspicious access patterns
CREATE VIEW audit.suspicious_access_patterns AS
WITH access_stats AS (
    SELECT 
        user_id,
        DATE_TRUNC('hour', access_time) as access_hour,
        COUNT(*) as access_count,
        COUNT(DISTINCT patient_id) as unique_patients
    FROM audit.patient_access_log
    WHERE access_time > CURRENT_TIMESTAMP - INTERVAL '24 hours'
    GROUP BY user_id, DATE_TRUNC('hour', access_time)
)
SELECT 
    a.user_id,
    u.name as user_name,
    a.access_hour,
    a.access_count,
    a.unique_patients,
    CASE 
        WHEN a.access_count > 100 THEN 'High volume access'
        WHEN a.unique_patients > 50 THEN 'Accessing many patients'
        WHEN EXTRACT(HOUR FROM a.access_hour) NOT BETWEEN 6 AND 22 THEN 'After hours access'
        ELSE 'Normal'
    END as access_pattern
FROM access_stats a
LEFT JOIN admin.users u ON a.user_id = u.id
WHERE a.access_count > 100 
   OR a.unique_patients > 50
   OR EXTRACT(HOUR FROM a.access_hour) NOT BETWEEN 6 AND 22
ORDER BY a.access_hour DESC, a.access_count DESC;

-- View for consent compliance
CREATE VIEW audit.consent_compliance_summary AS
SELECT 
    p.id as patient_id,
    p.mrn,
    p.family_name || ', ' || p.given_names as patient_name,
    COALESCE(c.total_consents, 0) as total_consents,
    COALESCE(c.active_consents, 0) as active_consents,
    COALESCE(c.expired_consents, 0) as expired_consents,
    COALESCE(c.revoked_consents, 0) as revoked_consents,
    c.last_consent_date,
    CASE 
        WHEN COALESCE(c.active_consents, 0) = 0 THEN 'No active consent'
        WHEN c.needs_renewal THEN 'Renewal needed'
        ELSE 'Compliant'
    END as consent_status
FROM fhir.patient p
LEFT JOIN (
    SELECT 
        patient_id,
        COUNT(*) as total_consents,
        COUNT(*) FILTER (WHERE consent_status = 'active') as active_consents,
        COUNT(*) FILTER (WHERE consent_status = 'expired') as expired_consents,
        COUNT(*) FILTER (WHERE revoked = TRUE) as revoked_consents,
        MAX(consent_date) as last_consent_date,
        BOOL_OR(expiration_date < CURRENT_DATE + INTERVAL '30 days') as needs_renewal
    FROM audit.patient_consent
    GROUP BY patient_id
) c ON p.id = c.patient_id
WHERE p.active = TRUE;

-- =====================================================
-- Scheduled Audit Jobs
-- =====================================================

-- Function to perform daily audit summary
CREATE OR REPLACE FUNCTION audit.daily_audit_summary()
RETURNS TABLE(
    summary_date DATE,
    total_accesses BIGINT,
    unique_users BIGINT,
    unique_patients BIGINT,
    suspicious_activities BIGINT,
    failed_access_attempts BIGINT,
    data_modifications BIGINT,
    hipaa_disclosures BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CURRENT_DATE as summary_date,
        (SELECT COUNT(*) FROM audit.patient_access_log 
         WHERE access_time::DATE = CURRENT_DATE) as total_accesses,
        (SELECT COUNT(DISTINCT user_id) FROM audit.patient_access_log 
         WHERE access_time::DATE = CURRENT_DATE) as unique_users,
        (SELECT COUNT(DISTINCT patient_id) FROM audit.patient_access_log 
         WHERE access_time::DATE = CURRENT_DATE) as unique_patients,
        (SELECT COUNT(*) FROM audit.access_attempt_log 
         WHERE attempt_time::DATE = CURRENT_DATE 
         AND suspicious_activity = TRUE) as suspicious_activities,
        (SELECT COUNT(*) FROM audit.access_attempt_log 
         WHERE attempt_time::DATE = CURRENT_DATE 
         AND access_granted = FALSE) as failed_access_attempts,
        (SELECT COUNT(*) FROM audit.data_modification_log 
         WHERE modification_time::DATE = CURRENT_DATE) as data_modifications,
        (SELECT COUNT(*) FROM audit.hipaa_disclosure_log 
         WHERE disclosure_date::DATE = CURRENT_DATE) as hipaa_disclosures;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old audit logs
CREATE OR REPLACE FUNCTION audit.archive_old_audit_logs(
    p_retention_days INTEGER DEFAULT 2555 -- 7 years for HIPAA
) RETURNS TABLE(
    archived_activity_logs BIGINT,
    archived_access_logs BIGINT,
    archived_modification_logs BIGINT
) AS $$
DECLARE
    cutoff_date TIMESTAMP WITH TIME ZONE;
    activity_count BIGINT;
    access_count BIGINT;
    modification_count BIGINT;
BEGIN
    cutoff_date := CURRENT_TIMESTAMP - (p_retention_days || ' days')::INTERVAL;
    
    -- Archive activity logs
    WITH archived AS (
        DELETE FROM audit.activity_log
        WHERE event_time < cutoff_date
        RETURNING *
    )
    INSERT INTO audit.activity_log_archive
    SELECT * FROM archived;
    
    GET DIAGNOSTICS activity_count = ROW_COUNT;
    
    -- Archive access logs
    WITH archived AS (
        DELETE FROM audit.patient_access_log
        WHERE access_time < cutoff_date
        RETURNING *
    )
    INSERT INTO audit.patient_access_log_archive
    SELECT * FROM archived;
    
    GET DIAGNOSTICS access_count = ROW_COUNT;
    
    -- Archive modification logs
    WITH archived AS (
        DELETE FROM audit.data_modification_log
        WHERE modification_time < cutoff_date
        RETURNING *
    )
    INSERT INTO audit.data_modification_log_archive
    SELECT * FROM archived;
    
    GET DIAGNOSTICS modification_count = ROW_COUNT;
    
    RETURN QUERY SELECT activity_count, access_count, modification_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Compliance Reports
-- =====================================================

-- Function to generate HIPAA compliance report
CREATE OR REPLACE FUNCTION audit.generate_hipaa_compliance_report(
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE(
    metric_name TEXT,
    metric_value BIGINT,
    compliance_status TEXT
) AS $$
BEGIN
    -- Total patient records accessed
    RETURN QUERY
    SELECT 
        'Total Patient Records Accessed'::TEXT,
        COUNT(DISTINCT patient_id)::BIGINT,
        'Tracked'::TEXT
    FROM audit.patient_access_log
    WHERE access_time BETWEEN p_start_date AND p_end_date;
    
    -- Unauthorized access attempts
    RETURN QUERY
    SELECT 
        'Unauthorized Access Attempts'::TEXT,
        COUNT(*)::BIGINT,
        CASE 
            WHEN COUNT(*) > 0 THEN 'Review Required'
            ELSE 'Compliant'
        END::TEXT
    FROM audit.access_attempt_log
    WHERE attempt_time BETWEEN p_start_date AND p_end_date
      AND access_granted = FALSE;
    
    -- Break-glass accesses
    RETURN QUERY
    SELECT 
        'Emergency/Break-Glass Accesses'::TEXT,
        COUNT(*)::BIGINT,
        'Audit Required'::TEXT
    FROM audit.patient_access_log
    WHERE access_time BETWEEN p_start_date AND p_end_date
      AND break_glass_access = TRUE;
    
    -- Disclosures requiring accounting
    RETURN QUERY
    SELECT 
        'Disclosures Requiring Accounting'::TEXT,
        COUNT(*)::BIGINT,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM audit.hipaa_disclosure_log
                WHERE disclosure_date BETWEEN p_start_date AND p_end_date
                  AND accounting_required = TRUE
                  AND NOT patient_notified
            ) THEN 'Action Required'
            ELSE 'Compliant'
        END::TEXT
    FROM audit.hipaa_disclosure_log
    WHERE disclosure_date BETWEEN p_start_date AND p_end_date
      AND accounting_required = TRUE;
    
    -- Consent compliance
    RETURN QUERY
    SELECT 
        'Patients Without Active Consent'::TEXT,
        COUNT(*)::BIGINT,
        CASE 
            WHEN COUNT(*) > 0 THEN 'Review Required'
            ELSE 'Compliant'
        END::TEXT
    FROM fhir.patient p
    WHERE p.active = TRUE
      AND NOT EXISTS (
          SELECT 1 FROM audit.patient_consent c
          WHERE c.patient_id = p.id
            AND c.consent_status = 'active'
            AND c.effective_date <= CURRENT_DATE
            AND (c.expiration_date IS NULL OR c.expiration_date >= CURRENT_DATE)
      );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Migration Completion
-- =====================================================

-- Grant permissions
GRANT SELECT ON ALL TABLES IN SCHEMA audit TO omnicare_app;
GRANT INSERT ON audit.activity_log, audit.patient_access_log, 
               audit.data_modification_log, audit.access_attempt_log TO omnicare_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA audit TO omnicare_app;

-- Update migration record
UPDATE migration.applied_migrations 
SET execution_time_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - applied_at)) * 1000,
    status = 'completed'
WHERE version = '002';

-- Display summary
SELECT 
    'Enhanced Audit Trail Migration completed' as status,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'audit') as audit_tables,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'audit') as audit_indexes,
    (SELECT COUNT(*) FROM pg_proc WHERE pronamespace = 'audit'::regnamespace) as audit_functions;