-- Analytics and Reporting Database Schema
-- Comprehensive data warehouse and analytics structures for OmniCare EMR

-- =====================================================
-- ANALYTICS METADATA TABLES
-- =====================================================

-- Data source registry
CREATE TABLE analytics_data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_type VARCHAR(50) NOT NULL, -- 'database', 'api', 'file', 'external'
    connection_config JSONB,
    schema_definition JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Report configurations
CREATE TABLE report_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    report_type VARCHAR(100) NOT NULL,
    facility_id UUID,
    data_source_config JSONB NOT NULL,
    columns_config JSONB NOT NULL,
    filters_config JSONB,
    calculations_config JSONB,
    visualizations_config JSONB,
    schedule_config JSONB,
    recipients JSONB,
    format VARCHAR(20) DEFAULT 'PDF',
    is_template BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Generated reports
CREATE TABLE generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    configuration_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    facility_id UUID,
    status VARCHAR(50) DEFAULT 'Generating',
    report_data JSONB,
    metadata JSONB,
    file_path TEXT,
    download_url TEXT,
    generated_by UUID,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (configuration_id) REFERENCES report_configurations(id),
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (generated_by) REFERENCES users(id)
);

-- Report alerts
CREATE TABLE report_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    report_configuration_id UUID NOT NULL,
    conditions JSONB NOT NULL,
    recipients JSONB NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    last_triggered TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_configuration_id) REFERENCES report_configurations(id)
);

-- =====================================================
-- CLINICAL QUALITY MEASURES
-- =====================================================

-- Quality measure definitions
CREATE TABLE quality_measures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'HEDIS-CDC-HbA1c'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'Process', 'Outcome', 'Structure', 'Balancing'
    measure_type VARCHAR(50) NOT NULL, -- 'Proportion', 'Ratio', 'Continuous Variable', 'Cohort'
    steward VARCHAR(100),
    nqf_number VARCHAR(20),
    cms_number VARCHAR(20),
    version VARCHAR(20),
    calculation_logic JSONB,
    benchmark_target DECIMAL(5,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Quality measure results
CREATE TABLE quality_measure_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_id UUID NOT NULL,
    facility_id UUID NOT NULL,
    measurement_period_start DATE NOT NULL,
    measurement_period_end DATE NOT NULL,
    initial_population INTEGER DEFAULT 0,
    denominator INTEGER DEFAULT 0,
    numerator INTEGER DEFAULT 0,
    exclusions INTEGER DEFAULT 0,
    exceptions INTEGER DEFAULT 0,
    performance_rate DECIMAL(5,2),
    benchmark DECIMAL(5,2),
    target DECIMAL(5,2),
    trend VARCHAR(20), -- 'Improving', 'Stable', 'Declining'
    risk_adjusted BOOLEAN DEFAULT false,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    calculated_by UUID,
    FOREIGN KEY (measure_id) REFERENCES quality_measures(id),
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (calculated_by) REFERENCES users(id),
    UNIQUE(measure_id, facility_id, measurement_period_start, measurement_period_end)
);

-- Quality measure patient details
CREATE TABLE quality_measure_patient_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'numerator', 'denominator', 'exclusion', 'exception'
    reason TEXT,
    clinical_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (result_id) REFERENCES quality_measure_results(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Quality improvement initiatives
CREATE TABLE quality_improvement_initiatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    measure_ids JSONB, -- Array of measure IDs
    facility_id UUID,
    start_date DATE,
    target_completion_date DATE,
    actual_completion_date DATE,
    status VARCHAR(50) DEFAULT 'Planning',
    expected_impact JSONB,
    actual_impact JSONB,
    resources_allocated JSONB,
    responsible_staff JSONB,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- =====================================================
-- FINANCIAL ANALYTICS
-- =====================================================

-- Revenue cycle metrics
CREATE TABLE revenue_cycle_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL,
    metric_date DATE NOT NULL,
    gross_charges DECIMAL(15,2) DEFAULT 0,
    adjustments DECIMAL(15,2) DEFAULT 0,
    write_offs DECIMAL(15,2) DEFAULT 0,
    collections DECIMAL(15,2) DEFAULT 0,
    net_revenue DECIMAL(15,2) DEFAULT 0,
    accounts_receivable DECIMAL(15,2) DEFAULT 0,
    days_in_ar DECIMAL(5,2) DEFAULT 0,
    collection_rate DECIMAL(5,2) DEFAULT 0,
    denial_rate DECIMAL(5,2) DEFAULT 0,
    first_pass_resolution_rate DECIMAL(5,2) DEFAULT 0,
    cost_to_collect DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    UNIQUE(facility_id, metric_date)
);

-- Payer performance analytics
CREATE TABLE payer_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL,
    payer_name VARCHAR(255) NOT NULL,
    payer_type VARCHAR(50) NOT NULL,
    metric_period_start DATE NOT NULL,
    metric_period_end DATE NOT NULL,
    claim_volume INTEGER DEFAULT 0,
    total_charges DECIMAL(15,2) DEFAULT 0,
    total_payments DECIMAL(15,2) DEFAULT 0,
    total_denials DECIMAL(15,2) DEFAULT 0,
    average_reimbursement DECIMAL(10,2) DEFAULT 0,
    denial_rate DECIMAL(5,2) DEFAULT 0,
    average_days_to_payment DECIMAL(5,2) DEFAULT 0,
    appeal_success_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    UNIQUE(facility_id, payer_name, metric_period_start, metric_period_end)
);

-- Provider productivity metrics
CREATE TABLE provider_productivity_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL,
    facility_id UUID NOT NULL,
    metric_period_start DATE NOT NULL,
    metric_period_end DATE NOT NULL,
    total_encounters INTEGER DEFAULT 0,
    total_rvus DECIMAL(10,2) DEFAULT 0,
    work_rvus DECIMAL(10,2) DEFAULT 0,
    practice_expense_rvus DECIMAL(10,2) DEFAULT 0,
    malpractice_rvus DECIMAL(10,2) DEFAULT 0,
    total_charges DECIMAL(15,2) DEFAULT 0,
    total_collections DECIMAL(15,2) DEFAULT 0,
    average_rvu_per_encounter DECIMAL(5,2) DEFAULT 0,
    revenue_per_rvu DECIMAL(8,2) DEFAULT 0,
    collection_efficiency DECIMAL(5,2) DEFAULT 0,
    patient_satisfaction_score DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES providers(id),
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    UNIQUE(provider_id, facility_id, metric_period_start, metric_period_end)
);

-- Service line profitability
CREATE TABLE service_line_profitability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL,
    service_line_name VARCHAR(255) NOT NULL,
    metric_period_start DATE NOT NULL,
    metric_period_end DATE NOT NULL,
    total_revenue DECIMAL(15,2) DEFAULT 0,
    direct_costs DECIMAL(15,2) DEFAULT 0,
    indirect_costs DECIMAL(15,2) DEFAULT 0,
    gross_margin DECIMAL(15,2) DEFAULT 0,
    net_margin DECIMAL(15,2) DEFAULT 0,
    margin_percentage DECIMAL(5,2) DEFAULT 0,
    patient_volume INTEGER DEFAULT 0,
    revenue_per_patient DECIMAL(10,2) DEFAULT 0,
    cost_per_patient DECIMAL(10,2) DEFAULT 0,
    growth_rate DECIMAL(5,2) DEFAULT 0,
    market_share DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    UNIQUE(facility_id, service_line_name, metric_period_start, metric_period_end)
);

-- Financial forecasting
CREATE TABLE financial_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL,
    forecast_type VARCHAR(50) NOT NULL, -- 'revenue', 'expenses', 'profit'
    forecast_period VARCHAR(50) NOT NULL,
    forecast_date DATE NOT NULL,
    projected_value DECIMAL(15,2) NOT NULL,
    confidence_interval_lower DECIMAL(15,2),
    confidence_interval_upper DECIMAL(15,2),
    confidence_level DECIMAL(5,2) DEFAULT 85,
    assumptions JSONB,
    risk_factors JSONB,
    model_version VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id)
);

-- =====================================================
-- OPERATIONAL METRICS
-- =====================================================

-- Patient flow metrics
CREATE TABLE patient_flow_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL,
    metric_date DATE NOT NULL,
    metric_hour INTEGER, -- 0-23 for hourly metrics
    total_patients INTEGER DEFAULT 0,
    patients_waiting INTEGER DEFAULT 0,
    patients_in_progress INTEGER DEFAULT 0,
    patients_completed INTEGER DEFAULT 0,
    average_wait_time DECIMAL(5,2) DEFAULT 0,
    average_visit_duration DECIMAL(5,2) DEFAULT 0,
    patient_throughput DECIMAL(5,2) DEFAULT 0,
    bottleneck_locations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    UNIQUE(facility_id, metric_date, metric_hour)
);

-- Staff utilization metrics
CREATE TABLE staff_utilization_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL,
    facility_id UUID NOT NULL,
    department_id UUID,
    metric_date DATE NOT NULL,
    scheduled_hours DECIMAL(5,2) DEFAULT 0,
    actual_hours DECIMAL(5,2) DEFAULT 0,
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    utilization_rate DECIMAL(5,2) DEFAULT 0,
    patients_seen INTEGER DEFAULT 0,
    average_time_per_patient DECIMAL(5,2) DEFAULT 0,
    productivity_score DECIMAL(5,2) DEFAULT 0,
    patient_satisfaction_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES users(id),
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    UNIQUE(staff_id, facility_id, metric_date)
);

-- Appointment analytics
CREATE TABLE appointment_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL,
    provider_id UUID,
    appointment_type VARCHAR(100),
    metric_date DATE NOT NULL,
    scheduled_appointments INTEGER DEFAULT 0,
    completed_appointments INTEGER DEFAULT 0,
    cancelled_appointments INTEGER DEFAULT 0,
    no_show_appointments INTEGER DEFAULT 0,
    same_day_appointments INTEGER DEFAULT 0,
    average_lead_time DECIMAL(5,2) DEFAULT 0,
    average_duration DECIMAL(5,2) DEFAULT 0,
    provider_utilization_rate DECIMAL(5,2) DEFAULT 0,
    patient_satisfaction_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (provider_id) REFERENCES providers(id),
    UNIQUE(facility_id, provider_id, appointment_type, metric_date)
);

-- Resource utilization
CREATE TABLE resource_utilization_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- 'room', 'equipment'
    resource_id UUID NOT NULL,
    resource_name VARCHAR(255) NOT NULL,
    metric_date DATE NOT NULL,
    total_available_hours DECIMAL(5,2) DEFAULT 0,
    total_utilized_hours DECIMAL(5,2) DEFAULT 0,
    utilization_rate DECIMAL(5,2) DEFAULT 0,
    maintenance_hours DECIMAL(5,2) DEFAULT 0,
    downtime_hours DECIMAL(5,2) DEFAULT 0,
    efficiency_score DECIMAL(5,2) DEFAULT 0,
    revenue_generated DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    UNIQUE(facility_id, resource_type, resource_id, metric_date)
);

-- Quality and safety metrics
CREATE TABLE quality_safety_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL,
    metric_date DATE NOT NULL,
    patient_satisfaction_score DECIMAL(3,2) DEFAULT 0,
    patient_satisfaction_response_rate DECIMAL(5,2) DEFAULT 0,
    nps_score DECIMAL(5,2) DEFAULT 0,
    readmission_rate DECIMAL(5,2) DEFAULT 0,
    complication_rate DECIMAL(5,2) DEFAULT 0,
    infection_rate DECIMAL(5,2) DEFAULT 0,
    mortality_rate DECIMAL(5,2) DEFAULT 0,
    average_length_of_stay DECIMAL(5,2) DEFAULT 0,
    adverse_events INTEGER DEFAULT 0,
    near_misses INTEGER DEFAULT 0,
    safety_score DECIMAL(5,2) DEFAULT 0,
    incident_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    UNIQUE(facility_id, metric_date)
);

-- =====================================================
-- POPULATION HEALTH ANALYTICS
-- =====================================================

-- Population demographics
CREATE TABLE population_demographics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    total_population INTEGER DEFAULT 0,
    age_distribution JSONB,
    gender_distribution JSONB,
    race_ethnicity_distribution JSONB,
    insurance_distribution JSONB,
    geographic_distribution JSONB,
    chronic_conditions_prevalence JSONB,
    social_determinants_profile JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    UNIQUE(facility_id, snapshot_date)
);

-- Risk stratification results
CREATE TABLE risk_stratification_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    facility_id UUID NOT NULL,
    stratification_date DATE NOT NULL,
    risk_score DECIMAL(5,2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL, -- 'Low', 'Moderate', 'High', 'Very High'
    risk_factors JSONB,
    predicted_outcomes JSONB,
    recommended_interventions JSONB,
    model_version VARCHAR(20),
    confidence_score DECIMAL(5,2),
    next_review_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    UNIQUE(patient_id, facility_id, stratification_date)
);

-- Health outcomes tracking
CREATE TABLE health_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outcome_id VARCHAR(100) NOT NULL,
    outcome_name VARCHAR(255) NOT NULL,
    facility_id UUID NOT NULL,
    measurement_period_start DATE NOT NULL,
    measurement_period_end DATE NOT NULL,
    population_size INTEGER DEFAULT 0,
    outcome_value DECIMAL(10,4),
    target_value DECIMAL(10,4),
    benchmark_national DECIMAL(10,4),
    benchmark_regional DECIMAL(10,4),
    benchmark_peer_group DECIMAL(10,4),
    trend VARCHAR(20), -- 'Improving', 'Stable', 'Declining'
    disparity_analysis JSONB,
    contributing_factors JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    UNIQUE(outcome_id, facility_id, measurement_period_start, measurement_period_end)
);

-- Care gap analysis
CREATE TABLE care_gaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    facility_id UUID NOT NULL,
    gap_type VARCHAR(100) NOT NULL,
    gap_description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'Critical', 'High', 'Medium', 'Low'
    identified_date DATE NOT NULL,
    due_date DATE,
    days_overdue INTEGER DEFAULT 0,
    clinical_impact TEXT,
    financial_impact DECIMAL(10,2),
    recommended_action TEXT,
    assigned_provider_id UUID,
    status VARCHAR(50) DEFAULT 'Open', -- 'Open', 'In Progress', 'Resolved', 'Dismissed'
    resolution_date DATE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (assigned_provider_id) REFERENCES providers(id)
);

-- Population health interventions
CREATE TABLE population_health_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    intervention_type VARCHAR(100) NOT NULL,
    target_population JSONB,
    inclusion_criteria JSONB,
    exclusion_criteria JSONB,
    facility_id UUID NOT NULL,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'Planning',
    enrollment_target INTEGER,
    enrollment_actual INTEGER,
    completion_target INTEGER,
    completion_actual INTEGER,
    outcome_measures JSONB,
    baseline_metrics JSONB,
    current_metrics JSONB,
    cost_per_participant DECIMAL(10,2),
    total_cost DECIMAL(15,2),
    estimated_savings DECIMAL(15,2),
    roi DECIMAL(5,2),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Intervention participation tracking
CREATE TABLE intervention_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intervention_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    enrollment_date DATE NOT NULL,
    completion_date DATE,
    status VARCHAR(50) DEFAULT 'Enrolled',
    baseline_metrics JSONB,
    outcome_metrics JSONB,
    participation_rate DECIMAL(5,2),
    satisfaction_score DECIMAL(3,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (intervention_id) REFERENCES population_health_interventions(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    UNIQUE(intervention_id, patient_id)
);

-- =====================================================
-- ANALYTICS DASHBOARDS AND INSIGHTS
-- =====================================================

-- Dashboard configurations
CREATE TABLE dashboard_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    dashboard_type VARCHAR(100) NOT NULL,
    facility_id UUID,
    user_role VARCHAR(100),
    widget_configurations JSONB NOT NULL,
    layout_configuration JSONB,
    refresh_interval INTEGER DEFAULT 300, -- seconds
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Analytics insights
CREATE TABLE analytics_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_type VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    facility_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    impact_level VARCHAR(20) NOT NULL, -- 'High', 'Medium', 'Low'
    confidence_score DECIMAL(5,2),
    affected_population INTEGER,
    recommendations JSONB,
    supporting_metrics JSONB,
    trend_data JSONB,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (acknowledged_by) REFERENCES users(id)
);

-- Predictive analytics models
CREATE TABLE predictive_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(255) NOT NULL,
    model_type VARCHAR(100) NOT NULL,
    description TEXT,
    target_variable VARCHAR(100) NOT NULL,
    feature_variables JSONB NOT NULL,
    model_algorithm VARCHAR(100),
    model_parameters JSONB,
    training_data_period JSONB,
    model_performance JSONB,
    validation_metrics JSONB,
    facility_id UUID,
    is_active BOOLEAN DEFAULT true,
    version VARCHAR(20),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_retrained TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Model predictions
CREATE TABLE model_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'patient', 'population', 'facility'
    entity_id UUID,
    prediction_date DATE NOT NULL,
    predicted_value DECIMAL(10,4),
    confidence_interval_lower DECIMAL(10,4),
    confidence_interval_upper DECIMAL(10,4),
    probability_score DECIMAL(5,4),
    feature_values JSONB,
    risk_factors JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES predictive_models(id)
);

-- =====================================================
-- BENCHMARKING AND COMPARISONS
-- =====================================================

-- External benchmarks
CREATE TABLE external_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_name VARCHAR(255) NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    benchmark_type VARCHAR(50) NOT NULL, -- 'National', 'Regional', 'Peer Group'
    industry_segment VARCHAR(100),
    facility_type VARCHAR(100),
    time_period VARCHAR(50),
    benchmark_value DECIMAL(10,4),
    percentile_25 DECIMAL(10,4),
    percentile_50 DECIMAL(10,4),
    percentile_75 DECIMAL(10,4),
    percentile_90 DECIMAL(10,4),
    sample_size INTEGER,
    data_source VARCHAR(255),
    effective_date DATE,
    expiration_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Facility comparisons
CREATE TABLE facility_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_facility_id UUID NOT NULL,
    comparison_facility_id UUID NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    comparison_period_start DATE NOT NULL,
    comparison_period_end DATE NOT NULL,
    primary_value DECIMAL(10,4),
    comparison_value DECIMAL(10,4),
    difference DECIMAL(10,4),
    percentage_difference DECIMAL(5,2),
    statistical_significance BOOLEAN,
    ranking INTEGER,
    total_facilities INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (primary_facility_id) REFERENCES facilities(id),
    FOREIGN KEY (comparison_facility_id) REFERENCES facilities(id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Analytics metadata indexes
CREATE INDEX idx_report_configurations_facility ON report_configurations(facility_id);
CREATE INDEX idx_report_configurations_type ON report_configurations(report_type);
CREATE INDEX idx_generated_reports_config ON generated_reports(configuration_id);
CREATE INDEX idx_generated_reports_status ON generated_reports(status);

-- Quality measures indexes
CREATE INDEX idx_quality_measure_results_facility_period ON quality_measure_results(facility_id, measurement_period_start, measurement_period_end);
CREATE INDEX idx_quality_measure_results_measure ON quality_measure_results(measure_id);
CREATE INDEX idx_quality_measure_patient_details_result ON quality_measure_patient_details(result_id);

-- Financial analytics indexes
CREATE INDEX idx_revenue_cycle_metrics_facility_date ON revenue_cycle_metrics(facility_id, metric_date);
CREATE INDEX idx_payer_performance_facility_period ON payer_performance_metrics(facility_id, metric_period_start, metric_period_end);
CREATE INDEX idx_provider_productivity_provider_period ON provider_productivity_metrics(provider_id, metric_period_start, metric_period_end);

-- Operational metrics indexes
CREATE INDEX idx_patient_flow_facility_date ON patient_flow_metrics(facility_id, metric_date);
CREATE INDEX idx_staff_utilization_staff_date ON staff_utilization_metrics(staff_id, metric_date);
CREATE INDEX idx_appointment_analytics_facility_date ON appointment_analytics(facility_id, metric_date);

-- Population health indexes
CREATE INDEX idx_risk_stratification_patient_date ON risk_stratification_results(patient_id, stratification_date);
CREATE INDEX idx_risk_stratification_facility_level ON risk_stratification_results(facility_id, risk_level);
CREATE INDEX idx_care_gaps_patient_status ON care_gaps(patient_id, status);
CREATE INDEX idx_care_gaps_facility_severity ON care_gaps(facility_id, severity);

-- Dashboard and insights indexes
CREATE INDEX idx_analytics_insights_facility_type ON analytics_insights(facility_id, insight_type);
CREATE INDEX idx_model_predictions_model_date ON model_predictions(model_id, prediction_date);

-- Composite indexes for common queries
CREATE INDEX idx_quality_results_composite ON quality_measure_results(facility_id, measure_id, measurement_period_end DESC);
CREATE INDEX idx_revenue_metrics_composite ON revenue_cycle_metrics(facility_id, metric_date DESC);
CREATE INDEX idx_patient_flow_composite ON patient_flow_metrics(facility_id, metric_date DESC, metric_hour);

-- =====================================================
-- VIEWS FOR COMMON ANALYTICS QUERIES
-- =====================================================

-- Current quality measures performance view
CREATE VIEW current_quality_performance AS
SELECT 
    qm.measure_id,
    qm.name as measure_name,
    qm.category,
    qmr.facility_id,
    qmr.performance_rate,
    qmr.benchmark,
    qmr.target,
    qmr.trend,
    qmr.measurement_period_end,
    CASE 
        WHEN qmr.performance_rate >= qmr.target THEN 'Above Target'
        WHEN qmr.performance_rate >= qmr.benchmark THEN 'Above Benchmark'
        ELSE 'Below Benchmark'
    END as performance_status
FROM quality_measures qm
JOIN quality_measure_results qmr ON qm.id = qmr.measure_id
WHERE qmr.measurement_period_end = (
    SELECT MAX(measurement_period_end) 
    FROM quality_measure_results qmr2 
    WHERE qmr2.measure_id = qmr.measure_id 
    AND qmr2.facility_id = qmr.facility_id
);

-- Current financial performance view
CREATE VIEW current_financial_performance AS
SELECT 
    facility_id,
    metric_date,
    gross_charges,
    net_revenue,
    collections,
    collection_rate,
    days_in_ar,
    denial_rate,
    first_pass_resolution_rate,
    ROW_NUMBER() OVER (PARTITION BY facility_id ORDER BY metric_date DESC) as row_num
FROM revenue_cycle_metrics;

-- Patient flow summary view
CREATE VIEW patient_flow_summary AS
SELECT 
    pf.facility_id,
    pf.metric_date,
    SUM(pf.total_patients) as daily_total_patients,
    AVG(pf.average_wait_time) as daily_avg_wait_time,
    AVG(pf.average_visit_duration) as daily_avg_visit_duration,
    SUM(pf.patients_completed) as daily_completed_patients
FROM patient_flow_metrics pf
WHERE pf.metric_hour IS NOT NULL
GROUP BY pf.facility_id, pf.metric_date;

-- High-risk patients view
CREATE VIEW high_risk_patients AS
SELECT 
    rsr.patient_id,
    p.first_name,
    p.last_name,
    rsr.facility_id,
    rsr.risk_score,
    rsr.risk_level,
    rsr.stratification_date,
    rsr.predicted_outcomes,
    rsr.recommended_interventions,
    COUNT(cg.id) as open_care_gaps
FROM risk_stratification_results rsr
JOIN patients p ON rsr.patient_id = p.id
LEFT JOIN care_gaps cg ON rsr.patient_id = cg.patient_id AND cg.status = 'Open'
WHERE rsr.risk_level IN ('High', 'Very High')
AND rsr.stratification_date = (
    SELECT MAX(stratification_date) 
    FROM risk_stratification_results rsr2 
    WHERE rsr2.patient_id = rsr.patient_id
)
GROUP BY rsr.patient_id, p.first_name, p.last_name, rsr.facility_id, 
         rsr.risk_score, rsr.risk_level, rsr.stratification_date,
         rsr.predicted_outcomes, rsr.recommended_interventions;