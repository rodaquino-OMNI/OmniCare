-- =====================================================
-- OmniCare EMR - Data Migration Framework
-- Author: Database Integration Developer
-- Purpose: Data migration tools for existing systems integration
-- =====================================================

-- =====================================================
-- Migration Management Schema
-- =====================================================

CREATE SCHEMA IF NOT EXISTS migration;

-- Migration jobs tracking
CREATE TABLE migration.migration_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Job identification
    job_name VARCHAR(200) NOT NULL,
    migration_type VARCHAR(50) NOT NULL,
    source_system VARCHAR(100) NOT NULL,
    
    -- Status tracking
    job_status VARCHAR(20) DEFAULT 'pending',
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    
    -- Timing
    scheduled_time TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_completion TIMESTAMP WITH TIME ZONE,
    
    -- Source and target information
    source_connection_string TEXT,
    source_query TEXT,
    target_table VARCHAR(100),
    
    -- Data counts
    source_record_count BIGINT,
    target_record_count BIGINT,
    processed_record_count BIGINT DEFAULT 0,
    error_record_count BIGINT DEFAULT 0,
    skipped_record_count BIGINT DEFAULT 0,
    
    -- Configuration
    batch_size INTEGER DEFAULT 1000,
    parallel_workers INTEGER DEFAULT 1,
    transformation_rules JSONB,
    validation_rules JSONB,
    
    -- Error handling
    continue_on_error BOOLEAN DEFAULT FALSE,
    max_error_threshold DECIMAL(5,2) DEFAULT 5.00,
    error_details JSONB,
    
    -- Performance metrics
    records_per_second DECIMAL(10,2),
    average_batch_time_ms INTEGER,
    
    -- Dependencies
    depends_on_jobs UUID[],
    blocking_jobs UUID[],
    
    -- Rollback information
    rollback_supported BOOLEAN DEFAULT TRUE,
    rollback_script TEXT,
    rollback_data_backup_location TEXT,
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_migration_type CHECK (migration_type IN (
        'patient_data', 'encounter_data', 'clinical_data', 'medication_data',
        'lab_results', 'imaging_data', 'scheduling_data', 'billing_data'
    )),
    CONSTRAINT valid_job_status CHECK (job_status IN (
        'pending', 'running', 'completed', 'failed', 'cancelled', 'paused', 'rollback'
    ))
);

-- Migration job indexes
CREATE INDEX idx_migration_jobs_status ON migration.migration_jobs(job_status);
CREATE INDEX idx_migration_jobs_type ON migration.migration_jobs(migration_type);
CREATE INDEX idx_migration_jobs_source_system ON migration.migration_jobs(source_system);
CREATE INDEX idx_migration_jobs_scheduled_time ON migration.migration_jobs(scheduled_time);
CREATE INDEX idx_migration_jobs_created_at ON migration.migration_jobs(created_at);

-- Data mapping configuration
CREATE TABLE migration.field_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Mapping identification
    mapping_name VARCHAR(100) NOT NULL,
    source_system VARCHAR(100) NOT NULL,
    target_resource_type VARCHAR(50) NOT NULL,
    
    -- Field mapping
    source_field VARCHAR(200) NOT NULL,
    target_field VARCHAR(200) NOT NULL,
    
    -- Transformation
    transformation_type VARCHAR(50) DEFAULT 'direct',
    transformation_expression TEXT,
    default_value TEXT,
    
    -- Validation
    required_field BOOLEAN DEFAULT FALSE,
    validation_pattern VARCHAR(500),
    validation_function VARCHAR(100),
    
    -- Data type conversion
    source_data_type VARCHAR(50),
    target_data_type VARCHAR(50),
    format_pattern VARCHAR(200),
    
    -- Conditional mapping
    mapping_condition TEXT,
    conditional_value_maps JSONB,
    
    -- Metadata
    mapping_priority INTEGER DEFAULT 100,
    active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    
    CONSTRAINT valid_transformation_type CHECK (transformation_type IN (
        'direct', 'computed', 'lookup', 'conditional', 'concatenate', 'split', 'format'
    ))
);

-- Field mappings indexes
CREATE INDEX idx_field_mappings_source_system ON migration.field_mappings(source_system);
CREATE INDEX idx_field_mappings_target_resource ON migration.field_mappings(target_resource_type);
CREATE INDEX idx_field_mappings_active ON migration.field_mappings(active) WHERE active = TRUE;

-- Data validation rules
CREATE TABLE migration.validation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Rule identification
    rule_name VARCHAR(100) NOT NULL,
    rule_category VARCHAR(50) NOT NULL,
    target_resource_type VARCHAR(50),
    target_field VARCHAR(200),
    
    -- Rule definition
    rule_type VARCHAR(50) NOT NULL,
    rule_expression TEXT NOT NULL,
    error_message TEXT,
    
    -- Rule behavior
    severity VARCHAR(20) DEFAULT 'error',
    stop_on_failure BOOLEAN DEFAULT TRUE,
    
    -- Rule scope
    applies_to_source_systems TEXT[],
    migration_types TEXT[],
    
    -- Metadata
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_rule_type CHECK (rule_type IN (
        'format', 'range', 'lookup', 'uniqueness', 'referential_integrity', 'business_logic'
    )),
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

-- Migration error log
CREATE TABLE migration.error_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Job and batch reference
    migration_job_id UUID NOT NULL REFERENCES migration.migration_jobs(id),
    batch_number INTEGER,
    record_identifier TEXT,
    
    -- Error details
    error_type VARCHAR(50) NOT NULL,
    error_category VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    error_details JSONB,
    
    -- Source data
    source_record JSONB,
    problematic_field VARCHAR(200),
    problematic_value TEXT,
    
    -- Resolution
    error_resolved BOOLEAN DEFAULT FALSE,
    resolution_method VARCHAR(100),
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    -- Timing
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_error_type CHECK (error_type IN (
        'validation_error', 'transformation_error', 'constraint_violation', 'system_error'
    ))
);

-- Error log indexes
CREATE INDEX idx_error_log_migration_job ON migration.error_log(migration_job_id);
CREATE INDEX idx_error_log_error_type ON migration.error_log(error_type);
CREATE INDEX idx_error_log_resolved ON migration.error_log(error_resolved) WHERE error_resolved = FALSE;
CREATE INDEX idx_error_log_occurred_at ON migration.error_log(occurred_at);

-- =====================================================
-- Migration Functions and Procedures
-- =====================================================

-- Function to create migration job
CREATE OR REPLACE FUNCTION migration.create_migration_job(
    p_job_name VARCHAR(200),
    p_migration_type VARCHAR(50),
    p_source_system VARCHAR(100),
    p_source_query TEXT,
    p_target_table VARCHAR(100),
    p_transformation_rules JSONB DEFAULT NULL,
    p_batch_size INTEGER DEFAULT 1000,
    p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    job_id UUID;
    source_count BIGINT;
BEGIN
    job_id := uuid_generate_v4();
    
    -- Estimate source record count (would typically connect to source system)
    source_count := 0; -- Placeholder
    
    -- Insert migration job
    INSERT INTO migration.migration_jobs (
        id, job_name, migration_type, source_system, source_query,
        target_table, transformation_rules, batch_size, source_record_count,
        created_by
    ) VALUES (
        job_id, p_job_name, p_migration_type, p_source_system, p_source_query,
        p_target_table, p_transformation_rules, p_batch_size, source_count,
        p_created_by
    );
    
    -- Log job creation
    INSERT INTO audit.activity_log (
        user_id, event_type, event_category, event_action, event_description,
        additional_context
    ) VALUES (
        p_created_by, 'migration', 'job_management', 'create_migration_job',
        format('Migration job created: %s', p_job_name),
        jsonb_build_object(
            'job_id', job_id,
            'migration_type', p_migration_type,
            'source_system', p_source_system
        )
    );
    
    RETURN job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to execute patient data migration
CREATE OR REPLACE FUNCTION migration.migrate_patient_data(
    p_job_id UUID,
    p_batch_start INTEGER DEFAULT 0,
    p_batch_size INTEGER DEFAULT 1000
) RETURNS TABLE(processed_count INTEGER, error_count INTEGER, batch_time_ms INTEGER) AS $$
DECLARE
    job_record RECORD;
    start_time TIMESTAMP WITH TIME ZONE;
    end_time TIMESTAMP WITH TIME ZONE;
    batch_duration INTEGER;
    processed_records INTEGER := 0;
    error_records INTEGER := 0;
    source_record RECORD;
    mapped_data JSONB;
    new_patient_id UUID;
    validation_result BOOLEAN;
BEGIN
    start_time := CURRENT_TIMESTAMP;
    
    -- Get job details
    SELECT * INTO job_record FROM migration.migration_jobs WHERE id = p_job_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Migration job not found: %', p_job_id;
    END IF;
    
    -- Update job status to running
    UPDATE migration.migration_jobs SET
        job_status = 'running',
        started_at = CASE WHEN started_at IS NULL THEN start_time ELSE started_at END
    WHERE id = p_job_id;
    
    -- Process patient records (simulated - would connect to actual source)
    FOR i IN 1..p_batch_size LOOP
        BEGIN
            -- Simulate source record
            source_record := (
                SELECT row(
                    'P' || (p_batch_start + i)::TEXT,  -- source_patient_id
                    'Smith',                           -- last_name
                    'John',                            -- first_name
                    '1980-01-01'::DATE,               -- birth_date
                    'M'                                -- gender
                )
            );
            
            -- Apply field mappings and transformations
            mapped_data := migration.apply_patient_mappings(
                job_record.source_system,
                row_to_json(source_record)::JSONB,
                job_record.transformation_rules
            );
            
            -- Validate mapped data
            validation_result := migration.validate_patient_data(mapped_data);
            
            IF validation_result THEN
                -- Insert patient record
                new_patient_id := uuid_generate_v4();
                
                INSERT INTO fhir.patient (
                    id, mrn, family_name, given_names, birth_date, gender,
                    resource_data
                ) VALUES (
                    new_patient_id,
                    mapped_data->>'mrn',
                    mapped_data->>'family_name',
                    mapped_data->>'given_names',
                    (mapped_data->>'birth_date')::DATE,
                    mapped_data->>'gender',
                    mapped_data
                );
                
                processed_records := processed_records + 1;
            ELSE
                error_records := error_records + 1;
                
                -- Log validation error
                INSERT INTO migration.error_log (
                    migration_job_id, batch_number, record_identifier,
                    error_type, error_category, error_message, source_record
                ) VALUES (
                    p_job_id, p_batch_start / p_batch_size + 1,
                    source_record::TEXT,
                    'validation_error', 'data_quality', 'Patient data validation failed',
                    row_to_json(source_record)::JSONB
                );
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            error_records := error_records + 1;
            
            -- Log processing error
            INSERT INTO migration.error_log (
                migration_job_id, batch_number, record_identifier,
                error_type, error_category, error_message, error_details, source_record
            ) VALUES (
                p_job_id, p_batch_start / p_batch_size + 1,
                COALESCE(source_record::TEXT, 'unknown'),
                'system_error', 'processing', 'Record processing failed',
                jsonb_build_object('error_message', SQLERRM, 'error_state', SQLSTATE),
                COALESCE(row_to_json(source_record)::JSONB, '{}')
            );
        END;
    END LOOP;
    
    end_time := CURRENT_TIMESTAMP;
    batch_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    -- Update job progress
    UPDATE migration.migration_jobs SET
        processed_record_count = processed_record_count + processed_records,
        error_record_count = error_record_count + error_records,
        progress_percentage = LEAST(
            ((processed_record_count + processed_records) * 100.0 / GREATEST(source_record_count, 1)), 
            100.0
        ),
        records_per_second = (processed_record_count + processed_records) / 
                           GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)), 1),
        average_batch_time_ms = (
            COALESCE(average_batch_time_ms, 0) + batch_duration
        ) / 2,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_job_id;
    
    -- Return batch results
    processed_count := processed_records;
    error_count := error_records;
    batch_time_ms := batch_duration;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to apply patient field mappings
CREATE OR REPLACE FUNCTION migration.apply_patient_mappings(
    p_source_system VARCHAR(100),
    p_source_data JSONB,
    p_transformation_rules JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    mapped_data JSONB := '{}';
    mapping_record RECORD;
    source_value TEXT;
    mapped_value TEXT;
BEGIN
    -- Apply field mappings for patient data
    FOR mapping_record IN
        SELECT *
        FROM migration.field_mappings
        WHERE source_system = p_source_system
          AND target_resource_type = 'Patient'
          AND active = TRUE
        ORDER BY mapping_priority
    LOOP
        -- Extract source value
        source_value := p_source_data->>mapping_record.source_field;
        
        -- Apply transformation
        CASE mapping_record.transformation_type
            WHEN 'direct' THEN
                mapped_value := source_value;
            
            WHEN 'format' THEN
                -- Apply format transformation (e.g., phone number formatting)
                mapped_value := migration.apply_format_transformation(
                    source_value, mapping_record.format_pattern
                );
            
            WHEN 'lookup' THEN
                -- Apply lookup transformation (e.g., gender code mapping)
                mapped_value := migration.apply_lookup_transformation(
                    source_value, mapping_record.conditional_value_maps
                );
            
            WHEN 'computed' THEN
                -- Apply computed transformation (e.g., full name from first/last)
                mapped_value := migration.apply_computed_transformation(
                    p_source_data, mapping_record.transformation_expression
                );
            
            ELSE
                mapped_value := source_value;
        END CASE;
        
        -- Apply default value if needed
        IF mapped_value IS NULL AND mapping_record.default_value IS NOT NULL THEN
            mapped_value := mapping_record.default_value;
        END IF;
        
        -- Add to mapped data
        mapped_data := jsonb_set(mapped_data, 
                                ARRAY[mapping_record.target_field], 
                                to_jsonb(mapped_value));
    END LOOP;
    
    -- Generate FHIR-compliant structure
    mapped_data := jsonb_set(mapped_data, ARRAY['resourceType'], '"Patient"');
    mapped_data := jsonb_set(mapped_data, ARRAY['id'], to_jsonb(uuid_generate_v4()::TEXT));
    
    RETURN mapped_data;
END;
$$ LANGUAGE plpgsql;

-- Function to validate patient data
CREATE OR REPLACE FUNCTION migration.validate_patient_data(
    p_patient_data JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    validation_rule RECORD;
    validation_result BOOLEAN;
BEGIN
    -- Apply validation rules
    FOR validation_rule IN
        SELECT *
        FROM migration.validation_rules
        WHERE target_resource_type = 'Patient'
          AND active = TRUE
          AND severity IN ('error', 'critical')
    LOOP
        -- Perform validation based on rule type
        CASE validation_rule.rule_type
            WHEN 'format' THEN
                validation_result := migration.validate_format(
                    p_patient_data->>validation_rule.target_field,
                    validation_rule.rule_expression
                );
            
            WHEN 'range' THEN
                validation_result := migration.validate_range(
                    p_patient_data->>validation_rule.target_field,
                    validation_rule.rule_expression
                );
            
            WHEN 'uniqueness' THEN
                validation_result := migration.validate_uniqueness(
                    'fhir.patient',
                    validation_rule.target_field,
                    p_patient_data->>validation_rule.target_field
                );
            
            ELSE
                validation_result := TRUE; -- Skip unknown rule types
        END CASE;
        
        -- If validation fails and rule is critical, return false
        IF NOT validation_result AND validation_rule.stop_on_failure THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Helper function for format transformation
CREATE OR REPLACE FUNCTION migration.apply_format_transformation(
    p_value TEXT,
    p_format_pattern VARCHAR(200)
) RETURNS TEXT AS $$
BEGIN
    -- Apply common format transformations
    CASE p_format_pattern
        WHEN 'phone_us' THEN
            -- Format US phone number: (123) 456-7890
            RETURN regexp_replace(
                regexp_replace(p_value, '[^\d]', '', 'g'),
                '^(\d{3})(\d{3})(\d{4})$',
                '(\1) \2-\3'
            );
        
        WHEN 'ssn_us' THEN
            -- Format US SSN: 123-45-6789
            RETURN regexp_replace(
                regexp_replace(p_value, '[^\d]', '', 'g'),
                '^(\d{3})(\d{2})(\d{4})$',
                '\1-\2-\3'
            );
        
        WHEN 'upper_case' THEN
            RETURN UPPER(p_value);
        
        WHEN 'lower_case' THEN
            RETURN LOWER(p_value);
        
        WHEN 'title_case' THEN
            RETURN initcap(p_value);
        
        ELSE
            RETURN p_value;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Helper function for lookup transformation
CREATE OR REPLACE FUNCTION migration.apply_lookup_transformation(
    p_value TEXT,
    p_lookup_map JSONB
) RETURNS TEXT AS $$
BEGIN
    -- Apply lookup transformation using the provided mapping
    RETURN COALESCE(p_lookup_map->>p_value, p_value);
END;
$$ LANGUAGE plpgsql;

-- Helper function for computed transformation
CREATE OR REPLACE FUNCTION migration.apply_computed_transformation(
    p_source_data JSONB,
    p_expression TEXT
) RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    -- Apply computed transformations (simplified examples)
    CASE p_expression
        WHEN 'full_name' THEN
            result := TRIM(
                COALESCE(p_source_data->>'first_name', '') || ' ' || 
                COALESCE(p_source_data->>'last_name', '')
            );
        
        WHEN 'age_from_birthdate' THEN
            result := EXTRACT(YEAR FROM AGE((p_source_data->>'birth_date')::DATE))::TEXT;
        
        WHEN 'mrn_with_prefix' THEN
            result := 'EMR' || LPAD(p_source_data->>'patient_id', 8, '0');
        
        ELSE
            result := NULL;
    END CASE;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Helper function for format validation
CREATE OR REPLACE FUNCTION migration.validate_format(
    p_value TEXT,
    p_pattern TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    IF p_value IS NULL THEN
        RETURN TRUE; -- Allow NULL values
    END IF;
    
    -- Validate common patterns
    CASE p_pattern
        WHEN 'email' THEN
            RETURN p_value ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
        
        WHEN 'phone_us' THEN
            RETURN p_value ~ '^\(\d{3}\) \d{3}-\d{4}$';
        
        WHEN 'ssn_us' THEN
            RETURN p_value ~ '^\d{3}-\d{2}-\d{4}$';
        
        WHEN 'date_iso' THEN
            RETURN p_value ~ '^\d{4}-\d{2}-\d{2}$';
        
        ELSE
            RETURN p_value ~ p_pattern;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Helper function for range validation
CREATE OR REPLACE FUNCTION migration.validate_range(
    p_value TEXT,
    p_range_expression TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    numeric_value NUMERIC;
    min_value NUMERIC;
    max_value NUMERIC;
    range_parts TEXT[];
BEGIN
    IF p_value IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Parse range expression (e.g., "0,150" for age range)
    range_parts := string_to_array(p_range_expression, ',');
    
    IF array_length(range_parts, 1) = 2 THEN
        BEGIN
            numeric_value := p_value::NUMERIC;
            min_value := range_parts[1]::NUMERIC;
            max_value := range_parts[2]::NUMERIC;
            
            RETURN numeric_value BETWEEN min_value AND max_value;
        EXCEPTION WHEN OTHERS THEN
            RETURN FALSE;
        END;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Helper function for uniqueness validation
CREATE OR REPLACE FUNCTION migration.validate_uniqueness(
    p_table_name TEXT,
    p_field_name TEXT,
    p_value TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    record_count INTEGER;
BEGIN
    IF p_value IS NULL THEN
        RETURN TRUE;
    END IF;
    
    EXECUTE format('SELECT COUNT(*) FROM %s WHERE %I = $1', p_table_name, p_field_name)
    INTO record_count
    USING p_value;
    
    RETURN record_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to complete migration job
CREATE OR REPLACE FUNCTION migration.complete_migration_job(
    p_job_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    job_record RECORD;
    error_rate DECIMAL(5,2);
BEGIN
    -- Get job details
    SELECT * INTO job_record FROM migration.migration_jobs WHERE id = p_job_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Migration job not found: %', p_job_id;
    END IF;
    
    -- Calculate error rate
    error_rate := CASE 
        WHEN job_record.processed_record_count > 0 THEN
            (job_record.error_record_count * 100.0) / 
            (job_record.processed_record_count + job_record.error_record_count)
        ELSE 0
    END;
    
    -- Check if error rate exceeds threshold
    IF error_rate > job_record.max_error_threshold THEN
        UPDATE migration.migration_jobs SET
            job_status = 'failed',
            completed_at = CURRENT_TIMESTAMP,
            error_details = jsonb_build_object(
                'error_rate', error_rate,
                'threshold_exceeded', true,
                'reason', 'Error rate exceeded maximum threshold'
            )
        WHERE id = p_job_id;
        
        RETURN FALSE;
    END IF;
    
    -- Mark job as completed
    UPDATE migration.migration_jobs SET
        job_status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        progress_percentage = 100.0,
        target_record_count = processed_record_count
    WHERE id = p_job_id;
    
    -- Log completion
    INSERT INTO audit.activity_log (
        event_type, event_category, event_action, event_description,
        additional_context
    ) VALUES (
        'migration', 'job_management', 'complete_migration_job',
        format('Migration job completed: %s', job_record.job_name),
        jsonb_build_object(
            'job_id', p_job_id,
            'processed_records', job_record.processed_record_count,
            'error_records', job_record.error_record_count,
            'error_rate', error_rate
        )
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Insert default field mappings for common EHR systems
INSERT INTO migration.field_mappings (
    mapping_name, source_system, target_resource_type, source_field, target_field,
    transformation_type, format_pattern
) VALUES
-- Epic EHR mappings
('epic_patient_mrn', 'Epic', 'Patient', 'PATIENT_ID', 'mrn', 'computed', 'mrn_with_prefix'),
('epic_patient_last_name', 'Epic', 'Patient', 'LAST_NAME', 'family_name', 'title_case', NULL),
('epic_patient_first_name', 'Epic', 'Patient', 'FIRST_NAME', 'given_names', 'title_case', NULL),
('epic_patient_birth_date', 'Epic', 'Patient', 'BIRTH_DATE', 'birth_date', 'direct', NULL),
('epic_patient_gender', 'Epic', 'Patient', 'SEX', 'gender', 'lookup', NULL),
('epic_patient_phone', 'Epic', 'Patient', 'HOME_PHONE', 'phone_primary', 'format', 'phone_us'),
('epic_patient_email', 'Epic', 'Patient', 'EMAIL_ADDRESS', 'email_primary', 'lower_case', NULL),

-- Cerner mappings
('cerner_patient_mrn', 'Cerner', 'Patient', 'MRN', 'mrn', 'direct', NULL),
('cerner_patient_last_name', 'Cerner', 'Patient', 'NAME_LAST', 'family_name', 'title_case', NULL),
('cerner_patient_first_name', 'Cerner', 'Patient', 'NAME_FIRST', 'given_names', 'title_case', NULL),
('cerner_patient_birth_date', 'Cerner', 'Patient', 'BIRTH_DT_TM', 'birth_date', 'direct', NULL),
('cerner_patient_gender', 'Cerner', 'Patient', 'SEX_CD', 'gender', 'lookup', NULL);

-- Insert validation rules
INSERT INTO migration.validation_rules (
    rule_name, rule_category, target_resource_type, target_field,
    rule_type, rule_expression, severity, error_message
) VALUES
('patient_mrn_required', 'data_completeness', 'Patient', 'mrn', 
 'format', '^.+$', 'error', 'MRN is required for all patients'),
('patient_name_required', 'data_completeness', 'Patient', 'family_name',
 'format', '^.+$', 'error', 'Family name is required'),
('patient_birth_date_format', 'data_format', 'Patient', 'birth_date',
 'format', 'date_iso', 'error', 'Birth date must be in YYYY-MM-DD format'),
('patient_birth_date_range', 'data_quality', 'Patient', 'birth_date',
 'range', '1900,2024', 'error', 'Birth date must be between 1900 and current year'),
('patient_email_format', 'data_format', 'Patient', 'email_primary',
 'format', 'email', 'warning', 'Email address format is invalid'),
('patient_mrn_unique', 'data_integrity', 'Patient', 'mrn',
 'uniqueness', '', 'error', 'MRN must be unique across all patients');

-- Comments for documentation
COMMENT ON SCHEMA migration IS 'Data migration framework for EHR system integration';
COMMENT ON TABLE migration.migration_jobs IS 'Tracking and management of data migration jobs';
COMMENT ON TABLE migration.field_mappings IS 'Field mapping configuration between source and target systems';
COMMENT ON TABLE migration.validation_rules IS 'Data validation rules for migration quality assurance';
COMMENT ON TABLE migration.error_log IS 'Detailed error logging for migration troubleshooting';
COMMENT ON FUNCTION migration.create_migration_job(VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, JSONB, INTEGER, UUID) IS 'Create new data migration job';
COMMENT ON FUNCTION migration.migrate_patient_data(UUID, INTEGER, INTEGER) IS 'Execute patient data migration in batches';
COMMENT ON FUNCTION migration.apply_patient_mappings(VARCHAR, JSONB, JSONB) IS 'Apply field mappings and transformations for patient data';