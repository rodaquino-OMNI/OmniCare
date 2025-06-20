-- =====================================================
-- OmniCare EMR - FHIR Optimized Migrations
-- Author: Database Engineer
-- Purpose: Enhanced FHIR migrations with performance optimizations
-- Version: 1.0.0
-- Date: 2025-01-20
-- =====================================================

-- =====================================================
-- Migration Metadata
-- =====================================================

CREATE TABLE IF NOT EXISTS migration.applied_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    applied_by VARCHAR(100),
    execution_time_ms INTEGER,
    checksum VARCHAR(64),
    rollback_sql TEXT,
    status VARCHAR(20) DEFAULT 'applied'
);

-- Record this migration
INSERT INTO migration.applied_migrations (version, name, applied_by) 
VALUES ('001', 'fhir_optimized_migrations', 'database_engineer');

-- =====================================================
-- Enhanced Partitioning Strategy
-- =====================================================

-- Convert resource_base to partitioned table by resource_type and date
-- This requires recreating the table with partitioning support

-- First, rename the existing table
ALTER TABLE fhir.resource_base RENAME TO resource_base_old;

-- Create new partitioned resource_base table
CREATE TABLE fhir.resource_base (
    id UUID DEFAULT uuid_generate_v4(),
    resource_type VARCHAR(50) NOT NULL,
    version_id UUID DEFAULT uuid_generate_v4(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- FHIR Meta elements
    profile TEXT[],
    security JSONB,
    tag JSONB,
    
    -- Full FHIR resource as JSONB
    resource_data JSONB NOT NULL,
    
    -- Text search optimization
    search_text TSVECTOR,
    
    -- Status and lifecycle
    status VARCHAR(20) DEFAULT 'active',
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_by UUID,
    updated_by UUID,
    
    -- Partitioning helper
    partition_key VARCHAR(50) GENERATED ALWAYS AS (resource_type) STORED,
    
    -- Primary key constraint will be created on partitions
    CONSTRAINT valid_resource_type CHECK (resource_type IN (
        'Patient', 'Practitioner', 'Organization', 'Location', 'Device',
        'Encounter', 'Observation', 'Condition', 'Procedure', 'DiagnosticReport',
        'MedicationRequest', 'MedicationAdministration', 'MedicationStatement',
        'AllergyIntolerance', 'CarePlan', 'ServiceRequest', 'Task',
        'Communication', 'CommunicationRequest', 'Appointment', 'Schedule',
        'Slot', 'Coverage', 'Claim', 'ExplanationOfBenefit',
        'DocumentReference', 'Binary', 'Media', 'QuestionnaireResponse',
        'Questionnaire', 'List', 'Group', 'Flag', 'Goal', 'RiskAssessment'
    ))
) PARTITION BY LIST (resource_type);

-- Create partitions for each resource type
CREATE TABLE fhir.resource_base_patient PARTITION OF fhir.resource_base
    FOR VALUES IN ('Patient');
    
CREATE TABLE fhir.resource_base_encounter PARTITION OF fhir.resource_base 
    FOR VALUES IN ('Encounter');
    
CREATE TABLE fhir.resource_base_observation PARTITION OF fhir.resource_base
    FOR VALUES IN ('Observation');
    
CREATE TABLE fhir.resource_base_condition PARTITION OF fhir.resource_base
    FOR VALUES IN ('Condition');
    
CREATE TABLE fhir.resource_base_medication PARTITION OF fhir.resource_base
    FOR VALUES IN ('MedicationRequest', 'MedicationAdministration', 'MedicationStatement');
    
CREATE TABLE fhir.resource_base_diagnostic PARTITION OF fhir.resource_base
    FOR VALUES IN ('DiagnosticReport', 'Procedure');
    
CREATE TABLE fhir.resource_base_allergy PARTITION OF fhir.resource_base
    FOR VALUES IN ('AllergyIntolerance');
    
CREATE TABLE fhir.resource_base_admin PARTITION OF fhir.resource_base
    FOR VALUES IN ('Practitioner', 'Organization', 'Location', 'Device');
    
CREATE TABLE fhir.resource_base_workflow PARTITION OF fhir.resource_base
    FOR VALUES IN ('CarePlan', 'ServiceRequest', 'Task', 'Communication', 
                    'CommunicationRequest', 'Appointment', 'Schedule', 'Slot');
    
CREATE TABLE fhir.resource_base_financial PARTITION OF fhir.resource_base
    FOR VALUES IN ('Coverage', 'Claim', 'ExplanationOfBenefit');
    
CREATE TABLE fhir.resource_base_document PARTITION OF fhir.resource_base
    FOR VALUES IN ('DocumentReference', 'Binary', 'Media', 'QuestionnaireResponse', 
                    'Questionnaire', 'List', 'Group', 'Flag', 'Goal', 'RiskAssessment');

-- Add primary key constraints to partitions
ALTER TABLE fhir.resource_base_patient ADD PRIMARY KEY (id);
ALTER TABLE fhir.resource_base_encounter ADD PRIMARY KEY (id);
ALTER TABLE fhir.resource_base_observation ADD PRIMARY KEY (id);
ALTER TABLE fhir.resource_base_condition ADD PRIMARY KEY (id);
ALTER TABLE fhir.resource_base_medication ADD PRIMARY KEY (id);
ALTER TABLE fhir.resource_base_diagnostic ADD PRIMARY KEY (id);
ALTER TABLE fhir.resource_base_allergy ADD PRIMARY KEY (id);
ALTER TABLE fhir.resource_base_admin ADD PRIMARY KEY (id);
ALTER TABLE fhir.resource_base_workflow ADD PRIMARY KEY (id);
ALTER TABLE fhir.resource_base_financial ADD PRIMARY KEY (id);
ALTER TABLE fhir.resource_base_document ADD PRIMARY KEY (id);

-- Migrate data from old table
INSERT INTO fhir.resource_base SELECT * FROM fhir.resource_base_old;

-- Drop old table after verification
-- DROP TABLE fhir.resource_base_old;

-- =====================================================
-- Enhanced Observation Partitioning by Date
-- =====================================================

-- Convert observation table to range partitioned by effective_datetime
ALTER TABLE fhir.observation RENAME TO observation_old;

CREATE TABLE fhir.observation (
    id UUID DEFAULT uuid_generate_v4(),
    
    -- References
    patient_id UUID NOT NULL,
    encounter_id UUID,
    practitioner_id UUID,
    device_id UUID,
    
    -- Classification
    category JSONB NOT NULL,
    code JSONB NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'preliminary',
    
    -- Timing
    effective_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    effective_period JSONB,
    issued TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Values (supporting multiple value types)
    value_quantity JSONB,
    value_codeable_concept JSONB,
    value_string TEXT,
    value_boolean BOOLEAN,
    value_integer INTEGER,
    value_range JSONB,
    value_ratio JSONB,
    value_sampled_data JSONB,
    value_time TIME,
    value_datetime TIMESTAMP WITH TIME ZONE,
    value_period JSONB,
    
    -- Clinical context
    body_site JSONB,
    method JSONB,
    specimen_id UUID,
    device_reference UUID,
    
    -- Reference ranges and interpretation
    reference_range JSONB,
    interpretation JSONB,
    
    -- Derived observations
    has_member UUID[],
    derived_from UUID[],
    
    -- Components for complex observations
    component JSONB,
    
    -- Notes
    note JSONB,
    
    CONSTRAINT valid_observation_status CHECK (status IN (
        'registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error'
    ))
) PARTITION BY RANGE (effective_datetime);

-- Create monthly partitions for observations (2024-2025)
CREATE TABLE fhir.observation_2024_01 PARTITION OF fhir.observation
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE fhir.observation_2024_02 PARTITION OF fhir.observation
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE fhir.observation_2024_03 PARTITION OF fhir.observation
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE fhir.observation_2024_04 PARTITION OF fhir.observation
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE fhir.observation_2024_05 PARTITION OF fhir.observation
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE fhir.observation_2024_06 PARTITION OF fhir.observation
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE fhir.observation_2024_07 PARTITION OF fhir.observation
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE fhir.observation_2024_08 PARTITION OF fhir.observation
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE fhir.observation_2024_09 PARTITION OF fhir.observation
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE fhir.observation_2024_10 PARTITION OF fhir.observation
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE fhir.observation_2024_11 PARTITION OF fhir.observation
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE fhir.observation_2024_12 PARTITION OF fhir.observation
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Add primary keys to observation partitions
DO $$
DECLARE
    partition_name TEXT;
BEGIN
    FOR partition_name IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'fhir' 
        AND tablename LIKE 'observation_2024_%'
    LOOP
        EXECUTE format('ALTER TABLE fhir.%I ADD PRIMARY KEY (id)', partition_name);
    END LOOP;
END $$;

-- =====================================================
-- Optimized Indexes for Performance
-- =====================================================

-- Composite indexes for common query patterns
CREATE INDEX idx_patient_search_composite ON fhir.patient(mrn, family_name, given_names) 
    INCLUDE (birth_date, phone_primary, email_primary);

CREATE INDEX idx_encounter_patient_date ON fhir.encounter(patient_id, start_time DESC)
    INCLUDE (status, encounter_class);

CREATE INDEX idx_observation_patient_code_date ON fhir.observation(patient_id, effective_datetime DESC)
    INCLUDE (code, status, value_quantity);

-- BRIN indexes for time-series data
CREATE INDEX idx_observation_effective_brin ON fhir.observation 
    USING brin(effective_datetime) WITH (pages_per_range = 128);

CREATE INDEX idx_encounter_start_brin ON fhir.encounter 
    USING brin(start_time) WITH (pages_per_range = 128);

-- GIN indexes for JSONB searching with specific paths
CREATE INDEX idx_observation_code_loinc ON fhir.observation 
    USING gin((code->'coding')) WHERE code IS NOT NULL;

CREATE INDEX idx_patient_identifier_gin ON fhir.patient 
    USING gin((resource_data->'identifier'));

-- Partial indexes for common filters
CREATE INDEX idx_encounter_active ON fhir.encounter(patient_id, start_time) 
    WHERE status IN ('in-progress', 'arrived', 'triaged');

CREATE INDEX idx_observation_final ON fhir.observation(patient_id, effective_datetime DESC) 
    WHERE status = 'final';

CREATE INDEX idx_condition_active ON fhir.condition(patient_id, onset_datetime) 
    WHERE clinical_status = 'active';

-- Expression indexes for computed values
CREATE INDEX idx_patient_age ON fhir.patient((EXTRACT(YEAR FROM AGE(birth_date))));

-- =====================================================
-- Materialized Views for Reporting
-- =====================================================

-- Patient summary with latest vitals
CREATE MATERIALIZED VIEW reporting.patient_summary AS
SELECT 
    p.id as patient_id,
    p.mrn,
    p.family_name,
    p.given_names,
    p.birth_date,
    EXTRACT(YEAR FROM AGE(p.birth_date)) as age,
    p.gender,
    p.phone_primary,
    p.email_primary,
    
    -- Latest vitals
    vitals.blood_pressure_systolic,
    vitals.blood_pressure_diastolic,
    vitals.heart_rate,
    vitals.temperature,
    vitals.respiratory_rate,
    vitals.oxygen_saturation,
    vitals.weight,
    vitals.height,
    vitals.bmi,
    
    -- Active conditions count
    (SELECT COUNT(*) FROM fhir.condition c 
     WHERE c.patient_id = p.id 
     AND c.clinical_status = 'active') as active_conditions_count,
    
    -- Active medications count
    (SELECT COUNT(*) FROM fhir.medication_request mr 
     WHERE mr.patient_id = p.id 
     AND mr.status = 'active') as active_medications_count,
    
    -- Allergies count
    (SELECT COUNT(*) FROM fhir.allergy_intolerance ai 
     WHERE ai.patient_id = p.id 
     AND ai.clinical_status = 'active') as active_allergies_count,
    
    -- Last encounter
    (SELECT MAX(e.start_time) FROM fhir.encounter e 
     WHERE e.patient_id = p.id) as last_encounter_date
     
FROM fhir.patient p
LEFT JOIN LATERAL (
    SELECT 
        MAX(CASE WHEN o.code->>'system' = 'http://loinc.org' 
                 AND o.code->>'code' = '8480-6' 
                 THEN (o.value_quantity->>'value')::NUMERIC END) as blood_pressure_systolic,
        MAX(CASE WHEN o.code->>'system' = 'http://loinc.org' 
                 AND o.code->>'code' = '8462-4' 
                 THEN (o.value_quantity->>'value')::NUMERIC END) as blood_pressure_diastolic,
        MAX(CASE WHEN o.code->>'system' = 'http://loinc.org' 
                 AND o.code->>'code' = '8867-4' 
                 THEN (o.value_quantity->>'value')::NUMERIC END) as heart_rate,
        MAX(CASE WHEN o.code->>'system' = 'http://loinc.org' 
                 AND o.code->>'code' = '8310-5' 
                 THEN (o.value_quantity->>'value')::NUMERIC END) as temperature,
        MAX(CASE WHEN o.code->>'system' = 'http://loinc.org' 
                 AND o.code->>'code' = '9279-1' 
                 THEN (o.value_quantity->>'value')::NUMERIC END) as respiratory_rate,
        MAX(CASE WHEN o.code->>'system' = 'http://loinc.org' 
                 AND o.code->>'code' = '2708-6' 
                 THEN (o.value_quantity->>'value')::NUMERIC END) as oxygen_saturation,
        MAX(CASE WHEN o.code->>'system' = 'http://loinc.org' 
                 AND o.code->>'code' = '29463-7' 
                 THEN (o.value_quantity->>'value')::NUMERIC END) as weight,
        MAX(CASE WHEN o.code->>'system' = 'http://loinc.org' 
                 AND o.code->>'code' = '8302-2' 
                 THEN (o.value_quantity->>'value')::NUMERIC END) as height,
        MAX(CASE WHEN o.code->>'system' = 'http://loinc.org' 
                 AND o.code->>'code' = '39156-5' 
                 THEN (o.value_quantity->>'value')::NUMERIC END) as bmi
    FROM fhir.observation o
    WHERE o.patient_id = p.id
      AND o.status = 'final'
      AND o.effective_datetime > CURRENT_DATE - INTERVAL '30 days'
) vitals ON true
WHERE p.active = TRUE;

-- Create indexes on materialized view
CREATE UNIQUE INDEX idx_patient_summary_patient_id ON reporting.patient_summary(patient_id);
CREATE INDEX idx_patient_summary_mrn ON reporting.patient_summary(mrn);
CREATE INDEX idx_patient_summary_name ON reporting.patient_summary(family_name, given_names);

-- Active encounters view
CREATE MATERIALIZED VIEW reporting.active_encounters AS
SELECT 
    e.id as encounter_id,
    e.visit_number,
    e.patient_id,
    p.mrn,
    p.family_name || ', ' || p.given_names as patient_name,
    e.encounter_class,
    e.status,
    e.start_time,
    e.location_id,
    l.name as location_name,
    e.practitioner_id,
    pr.family_name || ', ' || pr.given_names as practitioner_name,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - e.start_time))/3600 as hours_since_start
FROM fhir.encounter e
JOIN fhir.patient p ON e.patient_id = p.id
LEFT JOIN fhir.location l ON e.location_id = l.id
LEFT JOIN fhir.practitioner pr ON e.practitioner_id = pr.id
WHERE e.status IN ('in-progress', 'arrived', 'triaged')
  AND e.end_time IS NULL;

CREATE UNIQUE INDEX idx_active_encounters_encounter_id ON reporting.active_encounters(encounter_id);
CREATE INDEX idx_active_encounters_location ON reporting.active_encounters(location_id);
CREATE INDEX idx_active_encounters_practitioner ON reporting.active_encounters(practitioner_id);

-- Lab results trending view
CREATE MATERIALIZED VIEW reporting.lab_results_trending AS
WITH lab_codes AS (
    SELECT 
        unnest(ARRAY[
            '2339-0', -- Glucose
            '2823-3', -- Potassium
            '2951-2', -- Sodium
            '2160-0', -- Creatinine
            '1742-6', -- ALT
            '1920-8', -- AST
            '17861-6', -- Calcium
            '718-7', -- Hemoglobin
            '4544-3', -- Hematocrit
            '777-3', -- Platelet count
            '6690-2'  -- WBC
        ]) as loinc_code,
        unnest(ARRAY[
            'Glucose',
            'Potassium',
            'Sodium',
            'Creatinine',
            'ALT',
            'AST',
            'Calcium',
            'Hemoglobin',
            'Hematocrit',
            'Platelet count',
            'WBC'
        ]) as display_name
)
SELECT 
    o.patient_id,
    p.mrn,
    p.family_name || ', ' || p.given_names as patient_name,
    lc.display_name as lab_test,
    o.effective_datetime,
    (o.value_quantity->>'value')::NUMERIC as result_value,
    o.value_quantity->>'unit' as unit,
    o.interpretation->0->>'text' as interpretation,
    o.reference_range->0->>'text' as reference_range,
    o.status
FROM fhir.observation o
JOIN fhir.patient p ON o.patient_id = p.id
JOIN lab_codes lc ON o.code->>'code' = lc.loinc_code
WHERE o.code->>'system' = 'http://loinc.org'
  AND o.status = 'final'
  AND o.effective_datetime > CURRENT_DATE - INTERVAL '90 days'
  AND o.value_quantity IS NOT NULL
ORDER BY o.patient_id, lc.display_name, o.effective_datetime DESC;

CREATE INDEX idx_lab_results_patient ON reporting.lab_results_trending(patient_id);
CREATE INDEX idx_lab_results_date ON reporting.lab_results_trending(effective_datetime DESC);
CREATE INDEX idx_lab_results_test ON reporting.lab_results_trending(lab_test);

-- =====================================================
-- Performance Monitoring Functions
-- =====================================================

-- Function to analyze query performance for FHIR resources
CREATE OR REPLACE FUNCTION admin.analyze_fhir_query_performance()
RETURNS TABLE(
    query_pattern TEXT,
    avg_time_ms NUMERIC,
    max_time_ms NUMERIC,
    call_count BIGINT,
    total_time_ms NUMERIC,
    mean_rows NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN query LIKE '%fhir.patient%' THEN 'Patient queries'
            WHEN query LIKE '%fhir.encounter%' THEN 'Encounter queries'
            WHEN query LIKE '%fhir.observation%' THEN 'Observation queries'
            WHEN query LIKE '%fhir.condition%' THEN 'Condition queries'
            WHEN query LIKE '%fhir.medication%' THEN 'Medication queries'
            ELSE 'Other FHIR queries'
        END as query_pattern,
        ROUND(mean_exec_time::NUMERIC, 2) as avg_time_ms,
        ROUND(max_exec_time::NUMERIC, 2) as max_time_ms,
        calls as call_count,
        ROUND(total_exec_time::NUMERIC, 2) as total_time_ms,
        ROUND(mean_rows::NUMERIC, 2) as mean_rows
    FROM pg_stat_statements
    WHERE query LIKE '%fhir.%'
      AND query NOT LIKE '%pg_stat_statements%'
    ORDER BY total_exec_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to suggest missing indexes
CREATE OR REPLACE FUNCTION admin.suggest_missing_indexes()
RETURNS TABLE(
    schemaname TEXT,
    tablename TEXT,
    attname TEXT,
    n_distinct NUMERIC,
    correlation NUMERIC,
    index_suggestion TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH table_stats AS (
        SELECT 
            n.nspname as schemaname,
            c.relname as tablename,
            a.attname,
            s.n_distinct,
            s.correlation,
            pg_relation_size(c.oid) as table_size
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        JOIN pg_stats s ON s.schemaname = n.nspname 
            AND s.tablename = c.relname 
            AND s.attname = a.attname
        WHERE n.nspname = 'fhir'
          AND c.relkind = 'r'
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND s.n_distinct > 100
          AND abs(s.correlation) < 0.1
          AND NOT EXISTS (
              SELECT 1 FROM pg_index i
              JOIN pg_attribute ia ON ia.attrelid = i.indrelid
              WHERE i.indrelid = c.oid
                AND ia.attnum = ANY(i.indkey)
                AND ia.attname = a.attname
          )
    )
    SELECT 
        ts.schemaname,
        ts.tablename,
        ts.attname,
        ts.n_distinct,
        ts.correlation,
        format('CREATE INDEX idx_%s_%s ON %I.%I(%I);', 
               ts.tablename, ts.attname, ts.schemaname, ts.tablename, ts.attname) as index_suggestion
    FROM table_stats ts
    WHERE ts.table_size > 1024 * 1024 -- Only for tables > 1MB
    ORDER BY ts.table_size DESC, ts.n_distinct DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Data Quality Functions
-- =====================================================

-- Function to validate FHIR data integrity
CREATE OR REPLACE FUNCTION fhir.validate_data_integrity()
RETURNS TABLE(
    check_name TEXT,
    table_name TEXT,
    issue_count BIGINT,
    severity TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check for orphaned encounters
    RETURN QUERY
    SELECT 
        'Orphaned encounters'::TEXT,
        'fhir.encounter'::TEXT,
        COUNT(*)::BIGINT,
        'HIGH'::TEXT,
        'Encounters without valid patient references'::TEXT
    FROM fhir.encounter e
    WHERE NOT EXISTS (
        SELECT 1 FROM fhir.patient p WHERE p.id = e.patient_id
    );
    
    -- Check for orphaned observations
    RETURN QUERY
    SELECT 
        'Orphaned observations'::TEXT,
        'fhir.observation'::TEXT,
        COUNT(*)::BIGINT,
        'HIGH'::TEXT,
        'Observations without valid patient references'::TEXT
    FROM fhir.observation o
    WHERE NOT EXISTS (
        SELECT 1 FROM fhir.patient p WHERE p.id = o.patient_id
    );
    
    -- Check for duplicate MRNs
    RETURN QUERY
    SELECT 
        'Duplicate MRNs'::TEXT,
        'fhir.patient'::TEXT,
        COUNT(*)::BIGINT,
        'CRITICAL'::TEXT,
        'Patients with duplicate Medical Record Numbers'::TEXT
    FROM (
        SELECT mrn, COUNT(*) as cnt
        FROM fhir.patient
        WHERE active = TRUE
        GROUP BY mrn
        HAVING COUNT(*) > 1
    ) dups;
    
    -- Check for future dated observations
    RETURN QUERY
    SELECT 
        'Future dated observations'::TEXT,
        'fhir.observation'::TEXT,
        COUNT(*)::BIGINT,
        'MEDIUM'::TEXT,
        'Observations with effective dates in the future'::TEXT
    FROM fhir.observation
    WHERE effective_datetime > CURRENT_TIMESTAMP;
    
    -- Check for missing required fields
    RETURN QUERY
    SELECT 
        'Missing patient names'::TEXT,
        'fhir.patient'::TEXT,
        COUNT(*)::BIGINT,
        'HIGH'::TEXT,
        'Patients without family or given names'::TEXT
    FROM fhir.patient
    WHERE (family_name IS NULL OR family_name = '')
       OR (given_names IS NULL OR given_names = '');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Automated Partition Management
-- =====================================================

-- Function to create future partitions automatically
CREATE OR REPLACE FUNCTION admin.create_future_partitions()
RETURNS VOID AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_date DATE;
    partition_name TEXT;
BEGIN
    -- Create partitions for next 3 months
    start_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    end_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '4 months');
    
    partition_date := start_date;
    WHILE partition_date < end_date LOOP
        -- For observation table
        partition_name := format('observation_%s', TO_CHAR(partition_date, 'YYYY_MM'));
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'fhir' 
            AND tablename = partition_name
        ) THEN
            EXECUTE format(
                'CREATE TABLE fhir.%I PARTITION OF fhir.observation 
                 FOR VALUES FROM (%L) TO (%L)',
                partition_name,
                partition_date,
                partition_date + INTERVAL '1 month'
            );
            
            EXECUTE format('ALTER TABLE fhir.%I ADD PRIMARY KEY (id)', partition_name);
            
            RAISE NOTICE 'Created partition: %', partition_name;
        END IF;
        
        -- For audit activity_log table
        partition_name := format('activity_log_y%sm%s', 
                               TO_CHAR(partition_date, 'YYYY'), 
                               TO_CHAR(partition_date, 'MM'));
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'audit' 
            AND tablename = partition_name
        ) THEN
            EXECUTE format(
                'CREATE TABLE audit.%I PARTITION OF audit.activity_log 
                 FOR VALUES FROM (%L) TO (%L)',
                partition_name,
                partition_date,
                partition_date + INTERVAL '1 month'
            );
            
            RAISE NOTICE 'Created partition: %', partition_name;
        END IF;
        
        partition_date := partition_date + INTERVAL '1 month';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule automated partition creation (using pg_cron if available)
-- SELECT cron.schedule('create-partitions', '0 0 1 * *', 'SELECT admin.create_future_partitions();');

-- =====================================================
-- Migration Completion
-- =====================================================

-- Update migration record
UPDATE migration.applied_migrations 
SET execution_time_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - applied_at)) * 1000,
    status = 'completed'
WHERE version = '001';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA reporting TO omnicare_app;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO omnicare_app;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO omnicare_readonly;

-- Analyze tables for query optimizer
ANALYZE fhir.resource_base;
ANALYZE fhir.patient;
ANALYZE fhir.encounter;
ANALYZE fhir.observation;
ANALYZE fhir.condition;
ANALYZE fhir.medication_request;
ANALYZE fhir.allergy_intolerance;

-- Display migration summary
SELECT 
    'Migration 001 completed successfully' as status,
    COUNT(*) as tables_created,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'fhir') as indexes_created,
    (SELECT COUNT(*) FROM pg_matviews WHERE schemaname = 'reporting') as materialized_views_created
FROM pg_tables 
WHERE schemaname IN ('fhir', 'audit', 'admin', 'reporting', 'migration');