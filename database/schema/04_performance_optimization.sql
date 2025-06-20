-- =====================================================
-- OmniCare EMR - Performance Optimization Schema
-- Author: Database Integration Developer
-- Purpose: Database performance optimization and monitoring
-- =====================================================

-- =====================================================
-- Performance Monitoring Tables
-- =====================================================

-- Query performance tracking
CREATE TABLE admin.query_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Query identification
    query_hash VARCHAR(64) NOT NULL,
    query_text TEXT NOT NULL,
    query_type VARCHAR(50) NOT NULL,
    
    -- Performance metrics
    execution_time_ms INTEGER NOT NULL,
    planning_time_ms INTEGER,
    rows_returned INTEGER,
    rows_examined INTEGER,
    
    -- Resource usage
    cpu_time_ms INTEGER,
    io_reads INTEGER,
    io_writes INTEGER,
    memory_used_mb INTEGER,
    
    -- Context
    user_id UUID,
    session_id VARCHAR(128),
    database_name VARCHAR(100),
    schema_name VARCHAR(100),
    
    -- Timing
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Classification
    performance_category VARCHAR(20) DEFAULT 'normal',
    requires_optimization BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT valid_performance_category CHECK (performance_category IN ('excellent', 'good', 'normal', 'slow', 'critical'))
);

-- Query performance indexes
CREATE INDEX idx_query_performance_executed_at ON admin.query_performance(executed_at);
CREATE INDEX idx_query_performance_execution_time ON admin.query_performance(execution_time_ms);
CREATE INDEX idx_query_performance_hash ON admin.query_performance(query_hash);
CREATE INDEX idx_query_performance_category ON admin.query_performance(performance_category);
CREATE INDEX idx_query_performance_optimization ON admin.query_performance(requires_optimization) WHERE requires_optimization = TRUE;

-- Database statistics
CREATE TABLE admin.database_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Timestamp
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Database metrics
    database_size_bytes BIGINT,
    active_connections INTEGER,
    idle_connections INTEGER,
    total_connections INTEGER,
    max_connections INTEGER,
    
    -- Query metrics
    queries_per_second DECIMAL(10,2),
    average_query_time_ms DECIMAL(10,2),
    slow_query_count INTEGER,
    
    -- I/O metrics
    disk_reads_per_second DECIMAL(10,2),
    disk_writes_per_second DECIMAL(10,2),
    buffer_hit_ratio DECIMAL(5,2),
    
    -- Memory metrics
    shared_buffers_mb INTEGER,
    cache_hit_ratio DECIMAL(5,2),
    memory_usage_percent DECIMAL(5,2),
    
    -- Lock metrics
    lock_waits INTEGER,
    deadlocks INTEGER,
    
    -- Replication metrics (if applicable)
    replication_lag_seconds INTEGER,
    
    -- Health indicators
    health_status VARCHAR(20) DEFAULT 'healthy',
    alert_conditions TEXT[],
    
    CONSTRAINT valid_health_status CHECK (health_status IN ('healthy', 'warning', 'critical', 'unknown'))
);

-- Database stats indexes
CREATE INDEX idx_database_stats_collected_at ON admin.database_stats(collected_at);
CREATE INDEX idx_database_stats_health_status ON admin.database_stats(health_status);

-- Table statistics
CREATE TABLE admin.table_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Table identification
    schema_name VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    
    -- Size metrics
    table_size_bytes BIGINT,
    index_size_bytes BIGINT,
    total_size_bytes BIGINT,
    row_count BIGINT,
    
    -- Activity metrics
    sequential_scans BIGINT,
    index_scans BIGINT,
    inserts_per_hour DECIMAL(10,2),
    updates_per_hour DECIMAL(10,2),
    deletes_per_hour DECIMAL(10,2),
    
    -- Performance indicators
    avg_row_read_time_ms DECIMAL(10,4),
    avg_row_write_time_ms DECIMAL(10,4),
    fragmentation_percent DECIMAL(5,2),
    
    -- Maintenance info
    last_vacuum TIMESTAMP WITH TIME ZONE,
    last_analyze TIMESTAMP WITH TIME ZONE,
    last_autoanalyze TIMESTAMP WITH TIME ZONE,
    
    -- Collection timestamp
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(schema_name, table_name, collected_at)
);

-- Table stats indexes
CREATE INDEX idx_table_stats_collected_at ON admin.table_stats(collected_at);
CREATE INDEX idx_table_stats_table ON admin.table_stats(schema_name, table_name);
CREATE INDEX idx_table_stats_size ON admin.table_stats(total_size_bytes);
CREATE INDEX idx_table_stats_fragmentation ON admin.table_stats(fragmentation_percent) WHERE fragmentation_percent > 10;

-- =====================================================
-- Materialized Views for Performance
-- =====================================================

-- Patient summary for quick access
CREATE MATERIALIZED VIEW reporting.patient_summary AS
SELECT 
    p.id,
    p.mrn,
    p.family_name,
    p.given_names,
    p.birth_date,
    p.gender,
    p.phone_primary,
    p.email_primary,
    p.active,
    
    -- Latest encounter info
    e.id as latest_encounter_id,
    e.start_time as latest_encounter_date,
    e.encounter_class as latest_encounter_type,
    
    -- Active conditions count
    (SELECT COUNT(*) FROM fhir.condition c 
     WHERE c.patient_id = p.id AND c.clinical_status = 'active') as active_conditions_count,
    
    -- Active medications count
    (SELECT COUNT(*) FROM fhir.medication_request mr 
     WHERE mr.patient_id = p.id AND mr.status = 'active') as active_medications_count,
    
    -- Allergies count
    (SELECT COUNT(*) FROM fhir.allergy_intolerance ai 
     WHERE ai.patient_id = p.id AND ai.clinical_status = 'active') as active_allergies_count,
    
    -- Last updated
    GREATEST(p.last_updated, COALESCE(e.last_updated, p.last_updated)) as last_updated
FROM fhir.patient p
LEFT JOIN LATERAL (
    SELECT id, start_time, encounter_class, last_updated
    FROM fhir.encounter enc
    WHERE enc.patient_id = p.id
    ORDER BY enc.start_time DESC
    LIMIT 1
) e ON true
WHERE p.active = true;

-- Indexes for materialized view
CREATE UNIQUE INDEX idx_patient_summary_id ON reporting.patient_summary(id);
CREATE INDEX idx_patient_summary_mrn ON reporting.patient_summary(mrn);
CREATE INDEX idx_patient_summary_name ON reporting.patient_summary(family_name, given_names);
CREATE INDEX idx_patient_summary_birth_date ON reporting.patient_summary(birth_date);
CREATE INDEX idx_patient_summary_latest_encounter ON reporting.patient_summary(latest_encounter_date);

-- Active encounters view
CREATE MATERIALIZED VIEW reporting.active_encounters AS
SELECT 
    e.id,
    e.visit_number,
    e.patient_id,
    p.mrn,
    p.family_name,
    p.given_names,
    e.encounter_class,
    e.status,
    e.start_time,
    e.end_time,
    e.practitioner_id,
    pr.family_name as practitioner_family_name,
    pr.given_names as practitioner_given_names,
    e.location_id,
    l.name as location_name,
    
    -- Duration calculation
    CASE 
        WHEN e.end_time IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (e.end_time - e.start_time))/3600
        ELSE 
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - e.start_time))/3600
    END as duration_hours,
    
    -- Urgency indicators
    CASE 
        WHEN e.encounter_class = 'emergency' THEN 'high'
        WHEN e.priority = 'urgent' THEN 'medium'
        ELSE 'normal'
    END as urgency_level,
    
    e.last_updated
FROM fhir.encounter e
JOIN fhir.patient p ON e.patient_id = p.id
LEFT JOIN fhir.practitioner pr ON e.practitioner_id = pr.id
LEFT JOIN fhir.location l ON e.location_id = l.id
WHERE e.status IN ('arrived', 'triaged', 'in-progress', 'onleave')
  AND e.start_time >= CURRENT_DATE - INTERVAL '7 days';

-- Indexes for active encounters view
CREATE UNIQUE INDEX idx_active_encounters_id ON reporting.active_encounters(id);
CREATE INDEX idx_active_encounters_patient ON reporting.active_encounters(patient_id);
CREATE INDEX idx_active_encounters_practitioner ON reporting.active_encounters(practitioner_id);
CREATE INDEX idx_active_encounters_status ON reporting.active_encounters(status);
CREATE INDEX idx_active_encounters_class ON reporting.active_encounters(encounter_class);
CREATE INDEX idx_active_encounters_urgency ON reporting.active_encounters(urgency_level);

-- Lab results trending view
CREATE MATERIALIZED VIEW reporting.lab_results_trending AS
SELECT 
    o.patient_id,
    p.mrn,
    o.code->>'display' as test_name,
    o.code->>'code' as test_code,
    o.code->'coding'->0->>'system' as coding_system,
    o.effective_datetime,
    o.value_quantity->>'value' as numeric_value,
    o.value_quantity->>'unit' as unit,
    o.interpretation,
    o.reference_range,
    
    -- Trending calculations
    LAG(o.value_quantity->>'value') OVER (
        PARTITION BY o.patient_id, o.code->>'code' 
        ORDER BY o.effective_datetime
    ) as previous_value,
    
    -- Calculate percent change
    CASE 
        WHEN LAG(o.value_quantity->>'value') OVER (
            PARTITION BY o.patient_id, o.code->>'code' 
            ORDER BY o.effective_datetime
        ) IS NOT NULL 
        AND LAG(o.value_quantity->>'value') OVER (
            PARTITION BY o.patient_id, o.code->>'code' 
            ORDER BY o.effective_datetime
        )::numeric != 0 THEN
            ROUND(
                ((o.value_quantity->>'value')::numeric - 
                 LAG(o.value_quantity->>'value')::numeric OVER (
                    PARTITION BY o.patient_id, o.code->>'code' 
                    ORDER BY o.effective_datetime
                 )) / 
                LAG(o.value_quantity->>'value')::numeric OVER (
                    PARTITION BY o.patient_id, o.code->>'code' 
                    ORDER BY o.effective_datetime
                ) * 100, 2
            )
        ELSE NULL
    END as percent_change,
    
    o.last_updated
FROM fhir.observation o
JOIN fhir.patient p ON o.patient_id = p.id
WHERE o.category @> '[{"coding": [{"code": "laboratory"}]}]'
  AND o.value_quantity IS NOT NULL
  AND o.status = 'final'
  AND o.effective_datetime >= CURRENT_DATE - INTERVAL '2 years'
ORDER BY o.patient_id, o.code->>'code', o.effective_datetime;

-- Indexes for lab results trending view
CREATE INDEX idx_lab_results_trending_patient ON reporting.lab_results_trending(patient_id);
CREATE INDEX idx_lab_results_trending_test_code ON reporting.lab_results_trending(test_code);
CREATE INDEX idx_lab_results_trending_date ON reporting.lab_results_trending(effective_datetime);
CREATE INDEX idx_lab_results_trending_mrn ON reporting.lab_results_trending(mrn);

-- =====================================================
-- Advanced Indexing Strategies
-- =====================================================

-- Composite indexes for common query patterns
CREATE INDEX idx_encounter_patient_date_status ON fhir.encounter(patient_id, start_time DESC, status);
CREATE INDEX idx_observation_patient_category_date ON fhir.observation(patient_id, category, effective_datetime DESC);
CREATE INDEX idx_medication_request_patient_status_date ON fhir.medication_request(patient_id, status, authored_on DESC);
CREATE INDEX idx_condition_patient_status_onset ON fhir.condition(patient_id, clinical_status, onset_datetime);

-- Partial indexes for active records
CREATE INDEX idx_patient_active_name ON fhir.patient(family_name, given_names) WHERE active = TRUE;
CREATE INDEX idx_practitioner_active_name ON fhir.practitioner(family_name, given_names) WHERE active = TRUE;
CREATE INDEX idx_organization_active_name ON fhir.organization(name) WHERE active = TRUE;

-- GIN indexes for JSONB search optimization
CREATE INDEX idx_patient_resource_data_gin ON fhir.patient USING gin(resource_data);
CREATE INDEX idx_encounter_resource_data_gin ON fhir.encounter USING gin(resource_data);
CREATE INDEX idx_observation_resource_data_gin ON fhir.observation USING gin(resource_data);

-- Expression indexes for computed values
CREATE INDEX idx_patient_full_name ON fhir.patient((family_name || ', ' || given_names));
CREATE INDEX idx_patient_age ON fhir.patient((DATE_PART('year', CURRENT_DATE) - DATE_PART('year', birth_date)));

-- =====================================================
-- Performance Optimization Functions
-- =====================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION admin.refresh_materialized_views()
RETURNS TABLE(view_name TEXT, refresh_time_ms INTEGER) AS $$
DECLARE
    view_record RECORD;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    duration_ms INTEGER;
BEGIN
    FOR view_record IN 
        SELECT schemaname, matviewname 
        FROM pg_matviews 
        WHERE schemaname IN ('reporting')
    LOOP
        start_time := clock_timestamp();
        
        EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I.%I', 
                      view_record.schemaname, view_record.matviewname);
        
        end_time := clock_timestamp();
        duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
        
        view_name := view_record.schemaname || '.' || view_record.matviewname;
        refresh_time_ms := duration_ms;
        
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze query performance
CREATE OR REPLACE FUNCTION admin.analyze_query_performance(
    p_query_text TEXT,
    p_user_id UUID DEFAULT NULL
) RETURNS TABLE(
    execution_plan TEXT,
    execution_time_ms INTEGER,
    planning_time_ms INTEGER,
    total_cost NUMERIC,
    rows_estimate INTEGER
) AS $$
DECLARE
    explain_result TEXT;
    plan_json JSONB;
BEGIN
    -- Get query execution plan
    EXECUTE format('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) %s', p_query_text) 
    INTO explain_result;
    
    plan_json := explain_result::JSONB;
    
    -- Extract metrics from plan
    execution_plan := explain_result;
    execution_time_ms := (plan_json->'Execution Time')::INTEGER;
    planning_time_ms := (plan_json->'Planning Time')::INTEGER;
    total_cost := (plan_json->'Plan'->>'Total Cost')::NUMERIC;
    rows_estimate := (plan_json->'Plan'->>'Plan Rows')::INTEGER;
    
    -- Log the analysis
    INSERT INTO admin.query_performance (
        query_text, query_type, execution_time_ms, planning_time_ms,
        rows_returned, user_id, performance_category, requires_optimization
    ) VALUES (
        p_query_text, 'analysis', execution_time_ms, planning_time_ms,
        rows_estimate, p_user_id,
        CASE 
            WHEN execution_time_ms < 100 THEN 'excellent'
            WHEN execution_time_ms < 500 THEN 'good'
            WHEN execution_time_ms < 2000 THEN 'normal'
            WHEN execution_time_ms < 10000 THEN 'slow'
            ELSE 'critical'
        END,
        execution_time_ms > 2000
    );
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to collect database statistics
CREATE OR REPLACE FUNCTION admin.collect_database_stats()
RETURNS UUID AS $$
DECLARE
    stats_id UUID;
    db_size BIGINT;
    conn_stats RECORD;
    query_stats RECORD;
    io_stats RECORD;
    memory_stats RECORD;
BEGIN
    -- Get database size
    SELECT pg_database_size(current_database()) INTO db_size;
    
    -- Get connection statistics
    SELECT 
        COUNT(*) as total_connections,
        COUNT(*) FILTER (WHERE state = 'active') as active_connections,
        COUNT(*) FILTER (WHERE state = 'idle') as idle_connections
    INTO conn_stats
    FROM pg_stat_activity
    WHERE datname = current_database();
    
    -- Get query statistics
    SELECT 
        COALESCE(AVG(mean_exec_time), 0) as avg_query_time,
        COALESCE(SUM(calls), 0) as total_queries
    INTO query_stats
    FROM pg_stat_statements
    WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database());
    
    -- Insert statistics
    INSERT INTO admin.database_stats (
        database_size_bytes,
        active_connections,
        idle_connections,
        total_connections,
        average_query_time_ms,
        health_status
    ) VALUES (
        db_size,
        conn_stats.active_connections,
        conn_stats.idle_connections,
        conn_stats.total_connections,
        query_stats.avg_query_time,
        CASE 
            WHEN conn_stats.active_connections > 80 THEN 'warning'
            WHEN conn_stats.active_connections > 95 THEN 'critical'
            ELSE 'healthy'
        END
    ) RETURNING id INTO stats_id;
    
    RETURN stats_id;
END;
$$ LANGUAGE plpgsql;

-- Function to identify slow queries
CREATE OR REPLACE FUNCTION admin.identify_slow_queries(
    p_threshold_ms INTEGER DEFAULT 2000
) RETURNS TABLE(
    query_hash VARCHAR(64),
    query_text TEXT,
    avg_execution_time_ms NUMERIC,
    execution_count BIGINT,
    total_time_ms NUMERIC,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qp.query_hash,
        qp.query_text,
        AVG(qp.execution_time_ms)::NUMERIC as avg_execution_time_ms,
        COUNT(*)::BIGINT as execution_count,
        SUM(qp.execution_time_ms)::NUMERIC as total_time_ms,
        CASE 
            WHEN AVG(qp.execution_time_ms) > 10000 THEN 'Critical: Requires immediate optimization'
            WHEN AVG(qp.execution_time_ms) > 5000 THEN 'High: Consider query optimization and indexing'
            WHEN AVG(qp.execution_time_ms) > p_threshold_ms THEN 'Medium: Review query efficiency'
            ELSE 'Low: Monitor periodically'
        END as recommendation
    FROM admin.query_performance qp
    WHERE qp.executed_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    GROUP BY qp.query_hash, qp.query_text
    HAVING AVG(qp.execution_time_ms) > p_threshold_ms
    ORDER BY avg_execution_time_ms DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Automated Maintenance Procedures
-- =====================================================

-- Function to update table statistics
CREATE OR REPLACE FUNCTION admin.update_table_statistics()
RETURNS INTEGER AS $$
DECLARE
    table_record RECORD;
    stats_count INTEGER := 0;
BEGIN
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname IN ('fhir', 'audit', 'admin', 'reporting')
    LOOP
        -- Analyze table
        EXECUTE format('ANALYZE %I.%I', table_record.schemaname, table_record.tablename);
        
        -- Collect statistics
        INSERT INTO admin.table_stats (
            schema_name, table_name, table_size_bytes, row_count
        )
        SELECT 
            table_record.schemaname,
            table_record.tablename,
            pg_total_relation_size(format('%I.%I', table_record.schemaname, table_record.tablename)::regclass),
            COALESCE(c.reltuples::BIGINT, 0)
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = table_record.schemaname
          AND c.relname = table_record.tablename;
        
        stats_count := stats_count + 1;
    END LOOP;
    
    RETURN stats_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE admin.query_performance IS 'Query execution performance tracking and optimization';
COMMENT ON TABLE admin.database_stats IS 'Database-level performance and health metrics';
COMMENT ON TABLE admin.table_stats IS 'Table-level statistics and performance metrics';
COMMENT ON MATERIALIZED VIEW reporting.patient_summary IS 'Pre-computed patient summary for quick access';
COMMENT ON MATERIALIZED VIEW reporting.active_encounters IS 'Current active patient encounters';
COMMENT ON MATERIALIZED VIEW reporting.lab_results_trending IS 'Lab results with trending analysis';
COMMENT ON FUNCTION admin.refresh_materialized_views() IS 'Refresh all materialized views for current data';
COMMENT ON FUNCTION admin.collect_database_stats() IS 'Collect and store database performance statistics';
COMMENT ON FUNCTION admin.identify_slow_queries(INTEGER) IS 'Identify and analyze slow-performing queries';