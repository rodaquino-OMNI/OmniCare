-- =====================================================
-- OmniCare EMR - ETL Processes for Data Warehouse
-- Author: Database Integration Developer
-- Purpose: Extract, Transform, Load processes for analytics
-- =====================================================

-- =====================================================
-- ETL Management and Control
-- =====================================================

-- ETL job control and monitoring
CREATE TABLE etl.job_control (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Job identification
    job_name VARCHAR(200) NOT NULL UNIQUE,
    job_category VARCHAR(50) NOT NULL,
    job_description TEXT,
    
    -- Scheduling
    job_schedule VARCHAR(100),
    enabled BOOLEAN DEFAULT TRUE,
    
    -- Dependencies
    depends_on_jobs TEXT[],
    
    -- Configuration
    source_query TEXT,
    target_table VARCHAR(100),
    batch_size INTEGER DEFAULT 1000,
    parallel_workers INTEGER DEFAULT 1,
    
    -- Data handling
    incremental_load BOOLEAN DEFAULT TRUE,
    incremental_column VARCHAR(100),
    full_refresh_schedule VARCHAR(100),
    
    -- Error handling
    max_retries INTEGER DEFAULT 3,
    retry_delay_minutes INTEGER DEFAULT 5,
    continue_on_error BOOLEAN DEFAULT FALSE,
    
    -- Quality checks
    data_quality_checks JSONB,
    quality_threshold DECIMAL(5,2) DEFAULT 95.0,
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_job_category CHECK (job_category IN (
        'dimension_load', 'fact_load', 'data_quality', 'maintenance', 'validation'
    ))
);

-- ETL job execution log
CREATE TABLE etl.job_execution_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Job reference
    job_control_id UUID NOT NULL REFERENCES etl.job_control(id),
    batch_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    
    -- Execution details
    execution_status VARCHAR(20) DEFAULT 'running',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- Processing statistics
    records_read BIGINT DEFAULT 0,
    records_processed BIGINT DEFAULT 0,
    records_inserted BIGINT DEFAULT 0,
    records_updated BIGINT DEFAULT 0,
    records_deleted BIGINT DEFAULT 0,
    records_rejected BIGINT DEFAULT 0,
    
    -- Quality metrics
    quality_score DECIMAL(5,2),
    quality_passed BOOLEAN,
    
    -- Error information
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    
    -- Resource usage
    cpu_time_seconds DECIMAL(10,3),
    memory_usage_mb INTEGER,
    
    -- Data freshness
    max_source_timestamp TIMESTAMP WITH TIME ZONE,
    min_source_timestamp TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_execution_status CHECK (execution_status IN (
        'running', 'completed', 'failed', 'cancelled', 'retrying'
    ))
);

-- ETL job execution indexes
CREATE INDEX idx_job_execution_log_job_control_id ON etl.job_execution_log(job_control_id);
CREATE INDEX idx_job_execution_log_batch_id ON etl.job_execution_log(batch_id);
CREATE INDEX idx_job_execution_log_started_at ON etl.job_execution_log(started_at);
CREATE INDEX idx_job_execution_log_status ON etl.job_execution_log(execution_status);

-- Data quality rules for ETL
CREATE TABLE etl.data_quality_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Rule identification
    rule_name VARCHAR(200) NOT NULL,
    rule_category VARCHAR(50) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    target_column VARCHAR(100),
    
    -- Rule definition
    rule_type VARCHAR(50) NOT NULL,
    rule_expression TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'error',
    
    -- Thresholds
    pass_threshold DECIMAL(5,2) DEFAULT 100.0,
    warn_threshold DECIMAL(5,2) DEFAULT 95.0,
    
    -- Rule behavior
    stop_on_failure BOOLEAN DEFAULT TRUE,
    notify_on_failure BOOLEAN DEFAULT TRUE,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT valid_rule_type CHECK (rule_type IN (
        'completeness', 'uniqueness', 'validity', 'consistency', 'accuracy', 'timeliness'
    )),
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

-- =====================================================
-- ETL Functions and Procedures
-- =====================================================

-- Function to execute ETL job
CREATE OR REPLACE FUNCTION etl.execute_job(
    p_job_name VARCHAR(200),
    p_force_full_refresh BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
    job_record RECORD;
    execution_id UUID;
    batch_id UUID;
    start_time TIMESTAMP WITH TIME ZONE;
    records_processed BIGINT := 0;
    quality_score DECIMAL(5,2);
    quality_passed BOOLEAN;
BEGIN
    start_time := CURRENT_TIMESTAMP;
    batch_id := uuid_generate_v4();
    
    -- Get job configuration
    SELECT * INTO job_record
    FROM etl.job_control
    WHERE job_name = p_job_name AND enabled = TRUE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ETL job not found or disabled: %', p_job_name;
    END IF;
    
    -- Create execution log entry
    INSERT INTO etl.job_execution_log (
        job_control_id, batch_id, execution_status
    ) VALUES (
        job_record.id, batch_id, 'running'
    ) RETURNING id INTO execution_id;
    
    -- Log job start
    INSERT INTO audit.activity_log (
        event_type, event_category, event_action, event_description,
        additional_context
    ) VALUES (
        'etl', 'job_execution', 'start_etl_job',
        format('ETL job started: %s', p_job_name),
        jsonb_build_object(
            'job_name', p_job_name,
            'batch_id', batch_id,
            'execution_id', execution_id
        )
    );
    
    -- Execute specific ETL job based on category
    CASE job_record.job_category
        WHEN 'dimension_load' THEN
            records_processed := etl.load_dimension_data(job_record, batch_id, p_force_full_refresh);
        
        WHEN 'fact_load' THEN
            records_processed := etl.load_fact_data(job_record, batch_id, p_force_full_refresh);
        
        WHEN 'data_quality' THEN
            records_processed := etl.run_data_quality_checks(job_record, batch_id);
        
        ELSE
            RAISE EXCEPTION 'Unknown job category: %', job_record.job_category;
    END CASE;
    
    -- Run data quality checks if configured
    IF job_record.data_quality_checks IS NOT NULL THEN
        SELECT * INTO quality_score, quality_passed
        FROM etl.validate_data_quality(job_record.target_table, job_record.data_quality_checks);
    ELSE
        quality_score := 100.0;
        quality_passed := TRUE;
    END IF;
    
    -- Update execution log
    UPDATE etl.job_execution_log SET
        execution_status = CASE 
            WHEN quality_passed THEN 'completed'
            ELSE 'failed'
        END,
        completed_at = CURRENT_TIMESTAMP,
        duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)),
        records_processed = records_processed,
        quality_score = quality_score,
        quality_passed = quality_passed
    WHERE id = execution_id;
    
    -- Log job completion
    INSERT INTO audit.activity_log (
        event_type, event_category, event_action, event_description,
        event_outcome, additional_context
    ) VALUES (
        'etl', 'job_execution', 'complete_etl_job',
        format('ETL job completed: %s', p_job_name),
        CASE WHEN quality_passed THEN 'success' ELSE 'failure' END,
        jsonb_build_object(
            'job_name', p_job_name,
            'batch_id', batch_id,
            'records_processed', records_processed,
            'quality_score', quality_score,
            'duration_seconds', EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))
        )
    );
    
    RETURN execution_id;
    
EXCEPTION WHEN OTHERS THEN
    -- Update execution log with error
    UPDATE etl.job_execution_log SET
        execution_status = 'failed',
        completed_at = CURRENT_TIMESTAMP,
        duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)),
        error_message = SQLERRM,
        error_details = jsonb_build_object(
            'error_state', SQLSTATE,
            'error_time', CURRENT_TIMESTAMP
        )
    WHERE id = execution_id;
    
    -- Log error
    INSERT INTO audit.activity_log (
        event_type, event_category, event_action, event_description,
        event_outcome, failure_reason
    ) VALUES (
        'etl', 'job_execution', 'failed_etl_job',
        format('ETL job failed: %s', p_job_name),
        'failure', SQLERRM
    );
    
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Function to load dimension data with SCD Type 2
CREATE OR REPLACE FUNCTION etl.load_dimension_data(
    p_job_record RECORD,
    p_batch_id UUID,
    p_force_full_refresh BOOLEAN DEFAULT FALSE
) RETURNS BIGINT AS $$
DECLARE
    records_processed BIGINT := 0;
    last_update_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Determine last update time for incremental load
    IF NOT p_force_full_refresh AND p_job_record.incremental_load THEN
        SELECT MAX(updated_at) INTO last_update_time
        FROM etl.job_execution_log
        WHERE job_control_id = p_job_record.id
          AND execution_status = 'completed';
    END IF;
    
    -- Load dimension data based on target table
    CASE p_job_record.target_table
        WHEN 'warehouse.dim_patient' THEN
            records_processed := etl.load_patient_dimension(p_batch_id, last_update_time);
        
        WHEN 'warehouse.dim_practitioner' THEN
            records_processed := etl.load_practitioner_dimension(p_batch_id, last_update_time);
        
        WHEN 'warehouse.dim_organization' THEN
            records_processed := etl.load_organization_dimension(p_batch_id, last_update_time);
        
        WHEN 'warehouse.dim_location' THEN
            records_processed := etl.load_location_dimension(p_batch_id, last_update_time);
        
        ELSE
            RAISE NOTICE 'Unknown dimension table: %', p_job_record.target_table;
    END CASE;
    
    RETURN records_processed;
END;
$$ LANGUAGE plpgsql;

-- Function to load patient dimension with SCD Type 2
CREATE OR REPLACE FUNCTION etl.load_patient_dimension(
    p_batch_id UUID,
    p_last_update_time TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    records_processed BIGINT := 0;
    patient_record RECORD;
    existing_record RECORD;
    patient_key BIGINT;
BEGIN
    -- Process changed patients since last update
    FOR patient_record IN
        SELECT 
            p.id as patient_id,
            p.mrn,
            p.family_name,
            p.given_names,
            TRIM(COALESCE(p.given_names, '') || ' ' || COALESCE(p.family_name, '')) as full_name,
            p.birth_date,
            EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.birth_date))::INTEGER as age_at_snapshot,
            p.gender,
            p.gender_identity,
            p.race,
            p.ethnicity,
            p.phone_primary,
            p.email_primary,
            p.address_line1,
            p.city,
            p.state,
            p.postal_code,
            p.language_primary,
            p.deceased,
            p.deceased_datetime::DATE as deceased_date,
            p.last_updated
        FROM fhir.patient p
        WHERE p.active = TRUE
          AND (p_last_update_time IS NULL OR p.last_updated > p_last_update_time)
    LOOP
        -- Check for existing current record
        SELECT * INTO existing_record
        FROM warehouse.dim_patient
        WHERE patient_id = patient_record.patient_id
          AND is_current = TRUE;
        
        IF FOUND THEN
            -- Check if data has changed (SCD Type 2)
            IF existing_record.family_name IS DISTINCT FROM patient_record.family_name OR
               existing_record.given_names IS DISTINCT FROM patient_record.given_names OR
               existing_record.phone_primary IS DISTINCT FROM patient_record.phone_primary OR
               existing_record.email_primary IS DISTINCT FROM patient_record.email_primary OR
               existing_record.address_line1 IS DISTINCT FROM patient_record.address_line1 OR
               existing_record.city IS DISTINCT FROM patient_record.city OR
               existing_record.state IS DISTINCT FROM patient_record.state OR
               existing_record.postal_code IS DISTINCT FROM patient_record.postal_code THEN
               
                -- Expire current record
                UPDATE warehouse.dim_patient SET
                    is_current = FALSE,
                    expiration_date = CURRENT_DATE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE patient_key = existing_record.patient_key;
                
                -- Insert new current record
                INSERT INTO warehouse.dim_patient (
                    patient_id, mrn, family_name, given_names, full_name,
                    birth_date, age_at_snapshot, gender, gender_identity,
                    race, ethnicity, phone_primary, email_primary,
                    address_line1, city, state, postal_code,
                    primary_language, deceased, deceased_date,
                    effective_date, is_current
                ) VALUES (
                    patient_record.patient_id,
                    patient_record.mrn,
                    patient_record.family_name,
                    patient_record.given_names,
                    patient_record.full_name,
                    patient_record.birth_date,
                    patient_record.age_at_snapshot,
                    patient_record.gender,
                    patient_record.gender_identity,
                    patient_record.race,
                    patient_record.ethnicity,
                    patient_record.phone_primary,
                    patient_record.email_primary,
                    patient_record.address_line1,
                    patient_record.city,
                    patient_record.state,
                    patient_record.postal_code,
                    patient_record.language_primary,
                    patient_record.deceased,
                    patient_record.deceased_date,
                    CURRENT_DATE,
                    TRUE
                );
                
                records_processed := records_processed + 1;
            END IF;
        ELSE
            -- Insert new patient record
            INSERT INTO warehouse.dim_patient (
                patient_id, mrn, family_name, given_names, full_name,
                birth_date, age_at_snapshot, gender, gender_identity,
                race, ethnicity, phone_primary, email_primary,
                address_line1, city, state, postal_code,
                primary_language, deceased, deceased_date,
                effective_date, is_current
            ) VALUES (
                patient_record.patient_id,
                patient_record.mrn,
                patient_record.family_name,
                patient_record.given_names,
                patient_record.full_name,
                patient_record.birth_date,
                patient_record.age_at_snapshot,
                patient_record.gender,
                patient_record.gender_identity,
                patient_record.race,
                patient_record.ethnicity,
                patient_record.phone_primary,
                patient_record.email_primary,
                patient_record.address_line1,
                patient_record.city,
                patient_record.state,
                patient_record.postal_code,
                patient_record.language_primary,
                patient_record.deceased,
                patient_record.deceased_date,
                CURRENT_DATE,
                TRUE
            );
            
            records_processed := records_processed + 1;
        END IF;
    END LOOP;
    
    RETURN records_processed;
END;
$$ LANGUAGE plpgsql;

-- Function to load fact data
CREATE OR REPLACE FUNCTION etl.load_fact_data(
    p_job_record RECORD,
    p_batch_id UUID,
    p_force_full_refresh BOOLEAN DEFAULT FALSE
) RETURNS BIGINT AS $$
DECLARE
    records_processed BIGINT := 0;
    last_update_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Determine last update time for incremental load
    IF NOT p_force_full_refresh AND p_job_record.incremental_load THEN
        SELECT MAX(updated_at) INTO last_update_time
        FROM etl.job_execution_log
        WHERE job_control_id = p_job_record.id
          AND execution_status = 'completed';
    END IF;
    
    -- Load fact data based on target table
    CASE p_job_record.target_table
        WHEN 'warehouse.fact_encounter' THEN
            records_processed := etl.load_encounter_facts(p_batch_id, last_update_time);
        
        WHEN 'warehouse.fact_observation' THEN
            records_processed := etl.load_observation_facts(p_batch_id, last_update_time);
        
        WHEN 'warehouse.fact_medication' THEN
            records_processed := etl.load_medication_facts(p_batch_id, last_update_time);
        
        WHEN 'warehouse.fact_patient_summary' THEN
            records_processed := etl.load_patient_summary_facts(p_batch_id);
        
        ELSE
            RAISE NOTICE 'Unknown fact table: %', p_job_record.target_table;
    END CASE;
    
    RETURN records_processed;
END;
$$ LANGUAGE plpgsql;

-- Function to load encounter facts
CREATE OR REPLACE FUNCTION etl.load_encounter_facts(
    p_batch_id UUID,
    p_last_update_time TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    records_processed BIGINT := 0;
BEGIN
    -- Insert/update encounter facts
    INSERT INTO warehouse.fact_encounter (
        encounter_id, patient_key, practitioner_key, organization_key, location_key,
        admission_date_key, admission_time_key, discharge_date_key, discharge_time_key,
        encounter_class, encounter_type, visit_number, encounter_status,
        length_of_stay_hours, length_of_stay_days,
        encounter_start, encounter_end, etl_batch_id
    )
    SELECT 
        e.id as encounter_id,
        dp.patient_key,
        dpr.practitioner_key,
        do.organization_key,
        dl.location_key,
        to_char(e.start_time, 'YYYYMMDD')::INTEGER as admission_date_key,
        EXTRACT(HOUR FROM e.start_time) * 10000 + 
        EXTRACT(MINUTE FROM e.start_time) * 100 as admission_time_key,
        to_char(e.end_time, 'YYYYMMDD')::INTEGER as discharge_date_key,
        EXTRACT(HOUR FROM e.end_time) * 10000 + 
        EXTRACT(MINUTE FROM e.end_time) * 100 as discharge_time_key,
        e.encounter_class,
        e.encounter_type::TEXT,
        e.visit_number,
        e.status,
        CASE 
            WHEN e.end_time IS NOT NULL THEN
                EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 3600
            ELSE NULL
        END as length_of_stay_hours,
        CASE 
            WHEN e.end_time IS NOT NULL THEN
                EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 86400
            ELSE NULL
        END as length_of_stay_days,
        e.start_time,
        e.end_time,
        p_batch_id
    FROM fhir.encounter e
    JOIN warehouse.dim_patient dp ON e.patient_id = dp.patient_id AND dp.is_current = TRUE
    LEFT JOIN warehouse.dim_practitioner dpr ON e.practitioner_id = dpr.practitioner_id AND dpr.is_current = TRUE
    LEFT JOIN warehouse.dim_organization do ON e.organization_id = do.organization_id AND do.is_current = TRUE
    LEFT JOIN warehouse.dim_location dl ON e.location_id = dl.location_id AND dl.is_current = TRUE
    WHERE (p_last_update_time IS NULL OR e.last_updated > p_last_update_time)
    ON CONFLICT (encounter_id) DO UPDATE SET
        encounter_status = EXCLUDED.encounter_status,
        length_of_stay_hours = EXCLUDED.length_of_stay_hours,
        length_of_stay_days = EXCLUDED.length_of_stay_days,
        encounter_end = EXCLUDED.encounter_end,
        discharge_date_key = EXCLUDED.discharge_date_key,
        discharge_time_key = EXCLUDED.discharge_time_key,
        updated_at = CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS records_processed = ROW_COUNT;
    
    RETURN records_processed;
END;
$$ LANGUAGE plpgsql;

-- Function to validate data quality
CREATE OR REPLACE FUNCTION etl.validate_data_quality(
    p_table_name VARCHAR(100),
    p_quality_checks JSONB
) RETURNS TABLE(quality_score DECIMAL(5,2), quality_passed BOOLEAN) AS $$
DECLARE
    check_record RECORD;
    total_checks INTEGER := 0;
    passed_checks INTEGER := 0;
    completeness_score DECIMAL(5,2);
    uniqueness_score DECIMAL(5,2);
    validity_score DECIMAL(5,2);
    overall_score DECIMAL(5,2);
BEGIN
    -- Check completeness
    IF p_quality_checks ? 'completeness' THEN
        FOR check_record IN 
            SELECT key as column_name, value::DECIMAL as threshold
            FROM jsonb_each_text(p_quality_checks->'completeness')
        LOOP
            EXECUTE format(
                'SELECT (COUNT(*) - COUNT(%I)) * 100.0 / COUNT(*) FROM %s',
                check_record.column_name, p_table_name
            ) INTO completeness_score;
            
            total_checks := total_checks + 1;
            IF completeness_score >= check_record.threshold THEN
                passed_checks := passed_checks + 1;
            END IF;
        END LOOP;
    END IF;
    
    -- Check uniqueness
    IF p_quality_checks ? 'uniqueness' THEN
        FOR check_record IN 
            SELECT key as column_name, value::DECIMAL as threshold
            FROM jsonb_each_text(p_quality_checks->'uniqueness')
        LOOP
            EXECUTE format(
                'SELECT (COUNT(*) - COUNT(DISTINCT %I)) * 100.0 / COUNT(*) FROM %s',
                check_record.column_name, p_table_name
            ) INTO uniqueness_score;
            
            total_checks := total_checks + 1;
            IF (100 - uniqueness_score) >= check_record.threshold THEN
                passed_checks := passed_checks + 1;
            END IF;
        END LOOP;
    END IF;
    
    -- Calculate overall quality score
    overall_score := CASE 
        WHEN total_checks > 0 THEN (passed_checks * 100.0) / total_checks
        ELSE 100.0
    END;
    
    -- Store quality metrics
    INSERT INTO warehouse.data_quality_metrics (
        table_name, completeness_percentage, uniqueness_percentage,
        quality_score, quality_status, total_records
    ) VALUES (
        p_table_name, completeness_score, uniqueness_score,
        overall_score, 
        CASE WHEN overall_score >= 95 THEN 'passed' ELSE 'failed' END,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = p_table_name)
    );
    
    quality_score := overall_score;
    quality_passed := overall_score >= 95.0;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to run full ETL pipeline
CREATE OR REPLACE FUNCTION etl.run_full_pipeline(
    p_force_refresh BOOLEAN DEFAULT FALSE
) RETURNS TABLE(job_name VARCHAR(200), execution_status VARCHAR(20), records_processed BIGINT) AS $$
DECLARE
    job_record RECORD;
    execution_id UUID;
BEGIN
    -- Run dimension loads first
    FOR job_record IN
        SELECT job_name
        FROM etl.job_control
        WHERE job_category = 'dimension_load'
          AND enabled = TRUE
        ORDER BY job_name
    LOOP
        execution_id := etl.execute_job(job_record.job_name, p_force_refresh);
        
        SELECT jel.job_name, jel.execution_status, jel.records_processed
        INTO job_name, execution_status, records_processed
        FROM etl.job_execution_log jel
        JOIN etl.job_control jc ON jel.job_control_id = jc.id
        WHERE jel.id = execution_id;
        
        RETURN NEXT;
    END LOOP;
    
    -- Run fact loads after dimensions
    FOR job_record IN
        SELECT job_name
        FROM etl.job_control
        WHERE job_category = 'fact_load'
          AND enabled = TRUE
        ORDER BY job_name
    LOOP
        execution_id := etl.execute_job(job_record.job_name, p_force_refresh);
        
        SELECT jel.job_name, jel.execution_status, jel.records_processed
        INTO job_name, execution_status, records_processed
        FROM etl.job_execution_log jel
        JOIN etl.job_control jc ON jel.job_control_id = jc.id
        WHERE jel.id = execution_id;
        
        RETURN NEXT;
    END LOOP;
    
    -- Run data quality checks
    FOR job_record IN
        SELECT job_name
        FROM etl.job_control
        WHERE job_category = 'data_quality'
          AND enabled = TRUE
        ORDER BY job_name
    LOOP
        execution_id := etl.execute_job(job_record.job_name, FALSE);
        
        SELECT jel.job_name, jel.execution_status, jel.records_processed
        INTO job_name, execution_status, records_processed
        FROM etl.job_execution_log jel
        JOIN etl.job_control jc ON jel.job_control_id = jc.id
        WHERE jel.id = execution_id;
        
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Insert default ETL job configurations
INSERT INTO etl.job_control (
    job_name, job_category, job_description, job_schedule,
    target_table, incremental_load, incremental_column,
    data_quality_checks
) VALUES
-- Dimension loads
('Load Patient Dimension', 'dimension_load', 'Load patient dimension with SCD Type 2', '0 1 * * *',
 'warehouse.dim_patient', TRUE, 'last_updated',
 '{"completeness": {"mrn": 100, "family_name": 95, "birth_date": 100}, "uniqueness": {"mrn": 100}}'),

('Load Practitioner Dimension', 'dimension_load', 'Load practitioner dimension', '0 1 * * *',
 'warehouse.dim_practitioner', TRUE, 'last_updated',
 '{"completeness": {"family_name": 95}, "uniqueness": {"npi": 100}}'),

('Load Organization Dimension', 'dimension_load', 'Load organization dimension', '0 1 * * *',
 'warehouse.dim_organization', TRUE, 'last_updated',
 '{"completeness": {"name": 100}}'),

('Load Location Dimension', 'dimension_load', 'Load location dimension', '0 1 * * *',
 'warehouse.dim_location', TRUE, 'last_updated',
 '{"completeness": {"name": 100}}'),

-- Fact loads
('Load Encounter Facts', 'fact_load', 'Load encounter fact table', '0 2 * * *',
 'warehouse.fact_encounter', TRUE, 'last_updated',
 '{"completeness": {"patient_key": 100, "encounter_class": 100}}'),

('Load Observation Facts', 'fact_load', 'Load observation fact table', '0 3 * * *',
 'warehouse.fact_observation', TRUE, 'last_updated',
 '{"completeness": {"patient_key": 100, "observation_category": 100}}'),

('Load Medication Facts', 'fact_load', 'Load medication fact table', '0 4 * * *',
 'warehouse.fact_medication', TRUE, 'last_updated',
 '{"completeness": {"patient_key": 100, "medication_name": 95}}'),

('Load Patient Summary Facts', 'fact_load', 'Load patient summary fact table', '0 5 * * *',
 'warehouse.fact_patient_summary', FALSE, NULL,
 '{"completeness": {"patient_key": 100}}');

-- Insert data quality rules
INSERT INTO etl.data_quality_rules (
    rule_name, rule_category, target_table, target_column,
    rule_type, rule_expression, severity, pass_threshold
) VALUES
('Patient MRN Completeness', 'completeness', 'warehouse.dim_patient', 'mrn',
 'completeness', 'mrn IS NOT NULL', 'error', 100.0),

('Patient MRN Uniqueness', 'uniqueness', 'warehouse.dim_patient', 'mrn',
 'uniqueness', 'COUNT(DISTINCT mrn) = COUNT(mrn)', 'error', 100.0),

('Encounter Patient Reference', 'consistency', 'warehouse.fact_encounter', 'patient_key',
 'consistency', 'patient_key IS NOT NULL', 'error', 100.0),

('Observation Numeric Value Validity', 'validity', 'warehouse.fact_observation', 'numeric_value',
 'validity', 'numeric_value IS NULL OR numeric_value BETWEEN -999999 AND 999999', 'warning', 95.0);

-- Comments for documentation
COMMENT ON SCHEMA etl IS 'ETL processes and job control for data warehouse';
COMMENT ON TABLE etl.job_control IS 'ETL job configuration and scheduling';
COMMENT ON TABLE etl.job_execution_log IS 'ETL job execution tracking and monitoring';
COMMENT ON TABLE etl.data_quality_rules IS 'Data quality validation rules for ETL';
COMMENT ON FUNCTION etl.execute_job(VARCHAR, BOOLEAN) IS 'Execute ETL job with monitoring and quality checks';
COMMENT ON FUNCTION etl.load_dimension_data(RECORD, UUID, BOOLEAN) IS 'Load dimension tables with SCD Type 2 support';
COMMENT ON FUNCTION etl.load_fact_data(RECORD, UUID, BOOLEAN) IS 'Load fact tables with incremental processing';
COMMENT ON FUNCTION etl.run_full_pipeline(BOOLEAN) IS 'Execute complete ETL pipeline in dependency order';