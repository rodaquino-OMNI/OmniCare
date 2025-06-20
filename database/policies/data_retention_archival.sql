-- =====================================================
-- OmniCare EMR - Data Retention and Archival Policies
-- Author: Database Integration Developer
-- Purpose: Comprehensive data lifecycle management and compliance
-- =====================================================

-- =====================================================
-- Data Retention Management Schema
-- =====================================================

CREATE SCHEMA IF NOT EXISTS retention;

-- Data retention policies configuration
CREATE TABLE retention.retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Policy identification
    policy_name VARCHAR(200) NOT NULL UNIQUE,
    policy_category VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    
    -- Retention rules
    retention_period_years INTEGER NOT NULL,
    retention_trigger VARCHAR(50) NOT NULL DEFAULT 'last_updated',
    
    -- Legal and compliance requirements
    legal_requirement VARCHAR(100),
    compliance_framework VARCHAR(50),
    regulatory_citation TEXT,
    
    -- Archival settings
    archive_enabled BOOLEAN DEFAULT TRUE,
    archive_after_years INTEGER,
    archive_location VARCHAR(200),
    archive_compression BOOLEAN DEFAULT TRUE,
    
    -- Purge settings
    purge_enabled BOOLEAN DEFAULT FALSE,
    purge_after_years INTEGER,
    purge_requires_approval BOOLEAN DEFAULT TRUE,
    
    -- Conditions and exceptions
    retention_conditions JSONB,
    exception_rules JSONB,
    
    -- Status and lifecycle
    policy_status VARCHAR(20) DEFAULT 'active',
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE,
    
    -- Automation settings
    automated_processing BOOLEAN DEFAULT TRUE,
    processing_schedule VARCHAR(50) DEFAULT 'monthly',
    batch_size INTEGER DEFAULT 1000,
    
    -- Metadata
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_policy_category CHECK (policy_category IN (
        'clinical_data', 'administrative_data', 'audit_data', 'system_data', 'backup_data'
    )),
    CONSTRAINT valid_retention_trigger CHECK (retention_trigger IN (
        'last_updated', 'created_date', 'encounter_date', 'patient_deceased', 'custom'
    )),
    CONSTRAINT valid_policy_status CHECK (policy_status IN ('active', 'inactive', 'draft', 'suspended'))
);

-- Retention policies indexes
CREATE INDEX idx_retention_policies_resource_type ON retention.retention_policies(resource_type);
CREATE INDEX idx_retention_policies_status ON retention.retention_policies(policy_status);
CREATE INDEX idx_retention_policies_effective_date ON retention.retention_policies(effective_date);

-- Data archival jobs tracking
CREATE TABLE retention.archival_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Job identification
    job_name VARCHAR(200) NOT NULL,
    retention_policy_id UUID NOT NULL REFERENCES retention.retention_policies(id),
    
    -- Job status and timing
    job_status VARCHAR(20) DEFAULT 'pending',
    scheduled_time TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Processing scope
    target_table VARCHAR(100) NOT NULL,
    date_criteria_field VARCHAR(100) NOT NULL,
    cutoff_date DATE NOT NULL,
    
    -- Processing results
    records_evaluated INTEGER DEFAULT 0,
    records_archived INTEGER DEFAULT 0,
    records_purged INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    
    -- Storage information
    archive_location TEXT,
    archive_size_bytes BIGINT,
    compression_ratio DECIMAL(5,2),
    
    -- Error handling
    error_details JSONB,
    continue_on_error BOOLEAN DEFAULT TRUE,
    max_error_threshold DECIMAL(5,2) DEFAULT 5.0,
    
    -- Performance metrics
    processing_rate_per_second DECIMAL(10,2),
    estimated_completion TIMESTAMP WITH TIME ZONE,
    
    -- Approval workflow
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    
    -- Verification
    verification_completed BOOLEAN DEFAULT FALSE,
    verification_details JSONB,
    
    CONSTRAINT valid_archival_job_status CHECK (job_status IN (
        'pending', 'approved', 'running', 'completed', 'failed', 'cancelled', 'suspended'
    ))
);

-- Archival jobs indexes
CREATE INDEX idx_archival_jobs_policy_id ON retention.archival_jobs(retention_policy_id);
CREATE INDEX idx_archival_jobs_status ON retention.archival_jobs(job_status);
CREATE INDEX idx_archival_jobs_scheduled_time ON retention.archival_jobs(scheduled_time);
CREATE INDEX idx_archival_jobs_target_table ON retention.archival_jobs(target_table);

-- Archived data inventory
CREATE TABLE retention.archived_data_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Archive identification
    archive_id VARCHAR(100) UNIQUE NOT NULL,
    archival_job_id UUID REFERENCES retention.archival_jobs(id),
    
    -- Data identification
    source_table VARCHAR(100) NOT NULL,
    source_schema VARCHAR(50) NOT NULL,
    record_count BIGINT NOT NULL,
    
    -- Time period covered
    data_period_start DATE,
    data_period_end DATE,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Storage details
    archive_format VARCHAR(20) DEFAULT 'jsonl',
    storage_location TEXT NOT NULL,
    file_size_bytes BIGINT,
    checksum VARCHAR(64),
    encryption_enabled BOOLEAN DEFAULT TRUE,
    
    -- Retention information
    retention_policy_id UUID REFERENCES retention.retention_policies(id),
    archive_expiration_date DATE,
    
    -- Restoration capability
    restorable BOOLEAN DEFAULT TRUE,
    restoration_complexity VARCHAR(20) DEFAULT 'medium',
    estimated_restoration_time_hours INTEGER,
    
    -- Compliance and audit
    compliance_tags TEXT[],
    legal_hold BOOLEAN DEFAULT FALSE,
    legal_hold_reason TEXT,
    legal_hold_expires DATE,
    
    -- Verification
    integrity_verified BOOLEAN DEFAULT FALSE,
    last_integrity_check TIMESTAMP WITH TIME ZONE,
    integrity_check_result JSONB,
    
    CONSTRAINT valid_archive_format CHECK (archive_format IN ('jsonl', 'parquet', 'csv', 'sql_dump')),
    CONSTRAINT valid_restoration_complexity CHECK (restoration_complexity IN ('low', 'medium', 'high', 'complex'))
);

-- Archived data inventory indexes
CREATE INDEX idx_archived_data_inventory_archive_id ON retention.archived_data_inventory(archive_id);
CREATE INDEX idx_archived_data_inventory_source_table ON retention.archived_data_inventory(source_table);
CREATE INDEX idx_archived_data_inventory_archived_at ON retention.archived_data_inventory(archived_at);
CREATE INDEX idx_archived_data_inventory_expiration ON retention.archived_data_inventory(archive_expiration_date);
CREATE INDEX idx_archived_data_inventory_legal_hold ON retention.archived_data_inventory(legal_hold) WHERE legal_hold = TRUE;

-- Data purge log for compliance tracking
CREATE TABLE retention.purge_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Purge identification
    purge_id VARCHAR(100) UNIQUE NOT NULL,
    archival_job_id UUID REFERENCES retention.archival_jobs(id),
    retention_policy_id UUID REFERENCES retention.retention_policies(id),
    
    -- Purged data details
    source_table VARCHAR(100) NOT NULL,
    record_count BIGINT NOT NULL,
    purge_criteria TEXT NOT NULL,
    
    -- Time information
    data_period_start DATE,
    data_period_end DATE,
    purged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Authorization and approval
    authorized_by UUID NOT NULL,
    approval_reference VARCHAR(200),
    business_justification TEXT NOT NULL,
    
    -- Compliance documentation
    regulatory_basis TEXT,
    patient_notification_required BOOLEAN DEFAULT FALSE,
    patients_notified INTEGER DEFAULT 0,
    notification_date DATE,
    
    -- Verification and audit
    purge_method VARCHAR(50) NOT NULL,
    verification_method VARCHAR(50),
    verification_completed BOOLEAN DEFAULT FALSE,
    witness_signatures JSONB,
    
    -- Irreversibility confirmation
    data_irretrievable BOOLEAN DEFAULT FALSE,
    irretrievable_confirmed_by UUID,
    irretrievable_confirmed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_purge_method CHECK (purge_method IN (
        'secure_delete', 'cryptographic_erasure', 'physical_destruction', 'overwrite'
    ))
);

-- Purge log indexes
CREATE INDEX idx_purge_log_purge_id ON retention.purge_log(purge_id);
CREATE INDEX idx_purge_log_source_table ON retention.purge_log(source_table);
CREATE INDEX idx_purge_log_purged_at ON retention.purge_log(purged_at);
CREATE INDEX idx_purge_log_authorized_by ON retention.purge_log(authorized_by);

-- =====================================================
-- Retention Policy Functions
-- =====================================================

-- Function to create retention policy
CREATE OR REPLACE FUNCTION retention.create_retention_policy(
    p_policy_name VARCHAR(200),
    p_policy_category VARCHAR(50),
    p_resource_type VARCHAR(50),
    p_retention_period_years INTEGER,
    p_legal_requirement VARCHAR(100) DEFAULT NULL,
    p_archive_after_years INTEGER DEFAULT NULL,
    p_purge_after_years INTEGER DEFAULT NULL,
    p_created_by UUID
) RETURNS UUID AS $$
DECLARE
    policy_id UUID;
BEGIN
    policy_id := uuid_generate_v4();
    
    -- Validate retention periods
    IF p_archive_after_years IS NOT NULL AND p_archive_after_years >= p_retention_period_years THEN
        RAISE EXCEPTION 'Archive period must be less than retention period';
    END IF;
    
    IF p_purge_after_years IS NOT NULL AND p_purge_after_years <= p_retention_period_years THEN
        RAISE EXCEPTION 'Purge period must be greater than retention period';
    END IF;
    
    -- Insert retention policy
    INSERT INTO retention.retention_policies (
        id, policy_name, policy_category, resource_type, retention_period_years,
        legal_requirement, archive_after_years, purge_after_years, created_by
    ) VALUES (
        policy_id, p_policy_name, p_policy_category, p_resource_type, p_retention_period_years,
        p_legal_requirement, p_archive_after_years, p_purge_after_years, p_created_by
    );
    
    -- Log policy creation
    INSERT INTO audit.activity_log (
        user_id, event_type, event_category, event_action, event_description,
        additional_context
    ) VALUES (
        p_created_by, 'retention', 'policy_management', 'create_retention_policy',
        format('Retention policy created: %s', p_policy_name),
        jsonb_build_object(
            'policy_id', policy_id,
            'resource_type', p_resource_type,
            'retention_years', p_retention_period_years
        )
    );
    
    RETURN policy_id;
END;
$$ LANGUAGE plpgsql;

-- Function to identify records for archival
CREATE OR REPLACE FUNCTION retention.identify_archival_candidates(
    p_policy_id UUID,
    p_evaluation_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE(
    table_name VARCHAR(100),
    candidate_count BIGINT,
    earliest_date DATE,
    latest_date DATE,
    estimated_archive_size_mb NUMERIC
) AS $$
DECLARE
    policy_record RECORD;
    cutoff_date DATE;
    query_text TEXT;
    result_record RECORD;
BEGIN
    -- Get policy details
    SELECT * INTO policy_record
    FROM retention.retention_policies
    WHERE id = p_policy_id AND policy_status = 'active';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active retention policy not found: %', p_policy_id;
    END IF;
    
    -- Calculate cutoff date for archival
    cutoff_date := p_evaluation_date - INTERVAL '1 year' * policy_record.archive_after_years;
    
    -- Query based on resource type and policy
    IF policy_record.resource_type = 'Patient' THEN
        SELECT 'fhir.patient', COUNT(*), MIN(last_updated::DATE), MAX(last_updated::DATE),
               (COUNT(*) * 5)::NUMERIC -- Estimate 5KB per patient record
        INTO result_record
        FROM fhir.patient
        WHERE last_updated::DATE <= cutoff_date
          AND active = TRUE;
    
    ELSIF policy_record.resource_type = 'Encounter' THEN
        SELECT 'fhir.encounter', COUNT(*), MIN(start_time::DATE), MAX(start_time::DATE),
               (COUNT(*) * 10)::NUMERIC -- Estimate 10KB per encounter
        INTO result_record
        FROM fhir.encounter
        WHERE start_time::DATE <= cutoff_date
          AND status = 'finished';
    
    ELSIF policy_record.resource_type = 'Observation' THEN
        SELECT 'fhir.observation', COUNT(*), MIN(effective_datetime::DATE), MAX(effective_datetime::DATE),
               (COUNT(*) * 3)::NUMERIC -- Estimate 3KB per observation
        INTO result_record
        FROM fhir.observation
        WHERE effective_datetime::DATE <= cutoff_date
          AND status = 'final';
    
    ELSIF policy_record.resource_type = 'AuditLog' THEN
        SELECT 'audit.activity_log', COUNT(*), MIN(event_time::DATE), MAX(event_time::DATE),
               (COUNT(*) * 2)::NUMERIC -- Estimate 2KB per audit log
        INTO result_record
        FROM audit.activity_log
        WHERE event_time::DATE <= cutoff_date;
    
    ELSE
        -- Generic handling for other resource types
        result_record := (policy_record.resource_type, 0, NULL, NULL, 0);
    END IF;
    
    -- Return results
    table_name := result_record.column1;
    candidate_count := result_record.column2;
    earliest_date := result_record.column3;
    latest_date := result_record.column4;
    estimated_archive_size_mb := result_record.column5;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to create archival job
CREATE OR REPLACE FUNCTION retention.create_archival_job(
    p_policy_id UUID,
    p_cutoff_date DATE,
    p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    job_id UUID;
    policy_record RECORD;
    job_name VARCHAR(200);
    target_table VARCHAR(100);
    candidate_count BIGINT;
BEGIN
    job_id := uuid_generate_v4();
    
    -- Get policy details
    SELECT * INTO policy_record
    FROM retention.retention_policies
    WHERE id = p_policy_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Retention policy not found: %', p_policy_id;
    END IF;
    
    -- Determine target table based on resource type
    target_table := CASE policy_record.resource_type
        WHEN 'Patient' THEN 'fhir.patient'
        WHEN 'Encounter' THEN 'fhir.encounter'
        WHEN 'Observation' THEN 'fhir.observation'
        WHEN 'AuditLog' THEN 'audit.activity_log'
        ELSE 'unknown'
    END;
    
    -- Generate job name
    job_name := format('Archive_%s_%s_%s', 
                      policy_record.resource_type,
                      target_table,
                      to_char(p_cutoff_date, 'YYYY_MM_DD'));
    
    -- Get candidate count for planning
    SELECT COUNT(*) INTO candidate_count
    FROM retention.identify_archival_candidates(p_policy_id, p_cutoff_date);
    
    -- Insert archival job
    INSERT INTO retention.archival_jobs (
        id, job_name, retention_policy_id, target_table,
        date_criteria_field, cutoff_date, records_evaluated,
        requires_approval
    ) VALUES (
        job_id, job_name, p_policy_id, target_table,
        'last_updated', p_cutoff_date, candidate_count,
        policy_record.purge_requires_approval
    );
    
    -- Log job creation
    INSERT INTO audit.activity_log (
        user_id, event_type, event_category, event_action, event_description,
        additional_context
    ) VALUES (
        p_created_by, 'retention', 'archival', 'create_archival_job',
        format('Archival job created: %s', job_name),
        jsonb_build_object(
            'job_id', job_id,
            'policy_id', p_policy_id,
            'cutoff_date', p_cutoff_date,
            'estimated_records', candidate_count
        )
    );
    
    RETURN job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to execute archival job
CREATE OR REPLACE FUNCTION retention.execute_archival_job(
    p_job_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    job_record RECORD;
    policy_record RECORD;
    archive_id VARCHAR(100);
    archive_location TEXT;
    start_time TIMESTAMP WITH TIME ZONE;
    processed_count INTEGER := 0;
    archived_count INTEGER := 0;
    archive_size BIGINT := 0;
BEGIN
    start_time := CURRENT_TIMESTAMP;
    
    -- Get job and policy details
    SELECT aj.*, rp.*
    INTO job_record
    FROM retention.archival_jobs aj
    JOIN retention.retention_policies rp ON aj.retention_policy_id = rp.id
    WHERE aj.id = p_job_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Archival job not found: %', p_job_id;
    END IF;
    
    -- Check if job requires approval
    IF job_record.requires_approval AND job_record.approved_by IS NULL THEN
        RAISE EXCEPTION 'Archival job requires approval before execution';
    END IF;
    
    -- Update job status to running
    UPDATE retention.archival_jobs SET
        job_status = 'running',
        started_at = start_time
    WHERE id = p_job_id;
    
    -- Generate archive ID and location
    archive_id := format('ARCH_%s_%s', 
                        to_char(start_time, 'YYYYMMDD_HH24MISS'),
                        replace(p_job_id::TEXT, '-', ''));
    archive_location := format('%s/%s.jsonl', 
                              COALESCE(job_record.archive_location, '/archives/omnicare'),
                              archive_id);
    
    -- Perform archival based on target table
    IF job_record.target_table = 'fhir.patient' THEN
        -- Archive patient records
        WITH archived_patients AS (
            UPDATE fhir.patient SET 
                active = FALSE,
                updated_at = CURRENT_TIMESTAMP
            WHERE last_updated::DATE <= job_record.cutoff_date
              AND active = TRUE
            RETURNING *
        )
        SELECT COUNT(*), pg_column_size(array_agg(resource_data))
        INTO archived_count, archive_size
        FROM archived_patients;
        
    ELSIF job_record.target_table = 'fhir.encounter' THEN
        -- Archive encounter records
        WITH archived_encounters AS (
            DELETE FROM fhir.encounter
            WHERE start_time::DATE <= job_record.cutoff_date
              AND status = 'finished'
            RETURNING *
        )
        SELECT COUNT(*), pg_column_size(array_agg(resource_data))
        INTO archived_count, archive_size
        FROM archived_encounters;
        
    ELSIF job_record.target_table = 'audit.activity_log' THEN
        -- Archive old audit logs
        WITH archived_logs AS (
            DELETE FROM audit.activity_log
            WHERE event_time::DATE <= job_record.cutoff_date
            RETURNING *
        )
        SELECT COUNT(*), pg_column_size(array_agg(to_jsonb(archived_logs.*)))
        INTO archived_count, archive_size
        FROM archived_logs;
    END IF;
    
    processed_count := archived_count;
    
    -- Update job completion
    UPDATE retention.archival_jobs SET
        job_status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        records_evaluated = processed_count,
        records_archived = archived_count,
        archive_location = archive_location,
        archive_size_bytes = archive_size,
        processing_rate_per_second = CASE 
            WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)) > 0 THEN
                processed_count / EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))
            ELSE processed_count
        END
    WHERE id = p_job_id;
    
    -- Create archive inventory entry
    INSERT INTO retention.archived_data_inventory (
        archive_id, archival_job_id, source_table, source_schema,
        record_count, data_period_end, storage_location, file_size_bytes,
        retention_policy_id, archive_expiration_date
    ) VALUES (
        archive_id, p_job_id, job_record.target_table, 
        split_part(job_record.target_table, '.', 1),
        archived_count, job_record.cutoff_date, archive_location, archive_size,
        job_record.retention_policy_id,
        CURRENT_DATE + INTERVAL '1 year' * job_record.retention_period_years
    );
    
    -- Log archival completion
    INSERT INTO audit.activity_log (
        event_type, event_category, event_action, event_description,
        additional_context
    ) VALUES (
        'retention', 'archival', 'execute_archival_job',
        format('Archival job completed: %s', job_record.job_name),
        jsonb_build_object(
            'job_id', p_job_id,
            'records_archived', archived_count,
            'archive_size_bytes', archive_size,
            'archive_id', archive_id
        )
    );
    
    RETURN TRUE;
    
EXCEPTION WHEN OTHERS THEN
    -- Update job status on failure
    UPDATE retention.archival_jobs SET
        job_status = 'failed',
        completed_at = CURRENT_TIMESTAMP,
        error_details = jsonb_build_object(
            'error_message', SQLERRM,
            'error_state', SQLSTATE,
            'error_time', CURRENT_TIMESTAMP
        )
    WHERE id = p_job_id;
    
    -- Log failure
    INSERT INTO audit.activity_log (
        event_type, event_category, event_action, event_description,
        event_outcome, failure_reason
    ) VALUES (
        'retention', 'archival', 'execute_archival_job',
        format('Archival job failed: %s', job_record.job_name),
        'failure', SQLERRM
    );
    
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Function to perform data purge
CREATE OR REPLACE FUNCTION retention.perform_data_purge(
    p_archive_id VARCHAR(100),
    p_authorized_by UUID,
    p_business_justification TEXT,
    p_approval_reference VARCHAR(200) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    purge_id UUID;
    archive_record RECORD;
    purge_log_id VARCHAR(100);
BEGIN
    purge_id := uuid_generate_v4();
    
    -- Get archive details
    SELECT * INTO archive_record
    FROM retention.archived_data_inventory
    WHERE archive_id = p_archive_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Archive not found: %', p_archive_id;
    END IF;
    
    -- Check for legal hold
    IF archive_record.legal_hold THEN
        RAISE EXCEPTION 'Cannot purge data under legal hold: %', p_archive_id;
    END IF;
    
    -- Generate purge log ID
    purge_log_id := format('PURGE_%s_%s', 
                          to_char(CURRENT_TIMESTAMP, 'YYYYMMDD_HH24MISS'),
                          substring(replace(purge_id::TEXT, '-', ''), 1, 8));
    
    -- Insert purge log entry
    INSERT INTO retention.purge_log (
        id, purge_id, archival_job_id, retention_policy_id,
        source_table, record_count, purge_criteria,
        data_period_end, authorized_by, approval_reference,
        business_justification, purge_method
    ) VALUES (
        purge_id, purge_log_id, archive_record.archival_job_id, archive_record.retention_policy_id,
        archive_record.source_table, archive_record.record_count,
        format('Archive expiration date: %s', archive_record.archive_expiration_date),
        archive_record.data_period_end, p_authorized_by, p_approval_reference,
        p_business_justification, 'secure_delete'
    );
    
    -- Mark archive as purged (in practice, would securely delete the archive file)
    UPDATE retention.archived_data_inventory SET
        restorable = FALSE,
        integrity_verified = FALSE
    WHERE archive_id = p_archive_id;
    
    -- Log purge action
    INSERT INTO audit.activity_log (
        user_id, event_type, event_category, event_action, event_description,
        additional_context, security_level
    ) VALUES (
        p_authorized_by, 'retention', 'purge', 'perform_data_purge',
        format('Data purge performed for archive: %s', p_archive_id),
        jsonb_build_object(
            'purge_id', purge_log_id,
            'archive_id', p_archive_id,
            'record_count', archive_record.record_count,
            'authorization', p_approval_reference
        ),
        'high'
    );
    
    RETURN purge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore archived data
CREATE OR REPLACE FUNCTION retention.restore_archived_data(
    p_archive_id VARCHAR(100),
    p_requested_by UUID,
    p_restoration_reason TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    archive_record RECORD;
    restoration_id UUID;
BEGIN
    restoration_id := uuid_generate_v4();
    
    -- Get archive details
    SELECT * INTO archive_record
    FROM retention.archived_data_inventory
    WHERE archive_id = p_archive_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Archive not found: %', p_archive_id;
    END IF;
    
    -- Check if restoration is possible
    IF NOT archive_record.restorable THEN
        RAISE EXCEPTION 'Archive is not restorable: %', p_archive_id;
    END IF;
    
    -- Log restoration request
    INSERT INTO audit.activity_log (
        user_id, event_type, event_category, event_action, event_description,
        additional_context, security_level, requires_review
    ) VALUES (
        p_requested_by, 'retention', 'restoration', 'restore_archived_data',
        format('Data restoration requested for archive: %s', p_archive_id),
        jsonb_build_object(
            'restoration_id', restoration_id,
            'archive_id', p_archive_id,
            'reason', p_restoration_reason,
            'estimated_time_hours', archive_record.estimated_restoration_time_hours
        ),
        'high', TRUE
    );
    
    -- In practice, this would initiate the actual restoration process
    -- For this schema, we'll just mark the request as logged
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default retention policies
INSERT INTO retention.retention_policies (
    policy_name, policy_category, resource_type, retention_period_years,
    legal_requirement, archive_after_years, purge_after_years,
    compliance_framework, created_by
) VALUES
-- HIPAA-compliant medical records retention
('HIPAA_Patient_Records', 'clinical_data', 'Patient', 6, 'HIPAA', 2, 10, 'HIPAA', uuid_generate_v4()),
('HIPAA_Encounter_Records', 'clinical_data', 'Encounter', 6, 'HIPAA', 1, 10, 'HIPAA', uuid_generate_v4()),
('HIPAA_Clinical_Observations', 'clinical_data', 'Observation', 6, 'HIPAA', 1, 10, 'HIPAA', uuid_generate_v4()),
('HIPAA_Medication_Records', 'clinical_data', 'MedicationRequest', 6, 'HIPAA', 1, 10, 'HIPAA', uuid_generate_v4()),

-- Audit log retention (SOX compliance)
('SOX_Audit_Logs', 'audit_data', 'AuditLog', 7, 'SOX', 2, 10, 'SOX', uuid_generate_v4()),
('HIPAA_Access_Logs', 'audit_data', 'PatientAccessLog', 6, 'HIPAA', 2, 10, 'HIPAA', uuid_generate_v4()),

-- Administrative data
('Administrative_Billing', 'administrative_data', 'Billing', 7, 'Tax Law', 3, 10, 'IRS', uuid_generate_v4()),
('System_Performance_Logs', 'system_data', 'SystemLogs', 2, 'Internal Policy', 1, 5, 'Internal', uuid_generate_v4()),

-- Backup retention
('Database_Backups', 'backup_data', 'Backup', 1, 'Business Continuity', NULL, 3, 'Internal', uuid_generate_v4());

-- Comments for documentation
COMMENT ON SCHEMA retention IS 'Comprehensive data retention and archival management';
COMMENT ON TABLE retention.retention_policies IS 'Data retention policies with legal and compliance requirements';
COMMENT ON TABLE retention.archival_jobs IS 'Tracking of data archival operations';
COMMENT ON TABLE retention.archived_data_inventory IS 'Catalog of archived data with metadata';
COMMENT ON TABLE retention.purge_log IS 'Audit trail of data purge operations for compliance';
COMMENT ON FUNCTION retention.create_retention_policy(VARCHAR, VARCHAR, VARCHAR, INTEGER, VARCHAR, INTEGER, INTEGER, UUID) IS 'Create new data retention policy';
COMMENT ON FUNCTION retention.identify_archival_candidates(UUID, DATE) IS 'Identify records eligible for archival based on policy';
COMMENT ON FUNCTION retention.execute_archival_job(UUID) IS 'Execute data archival process with full audit trail';
COMMENT ON FUNCTION retention.perform_data_purge(VARCHAR, UUID, TEXT, VARCHAR) IS 'Securely purge data with authorization and audit';
COMMENT ON FUNCTION retention.restore_archived_data(VARCHAR, UUID, TEXT) IS 'Request restoration of archived data with approval workflow';