-- =====================================================
-- OmniCare EMR - Data Warehouse Design
-- Author: Database Integration Developer
-- Purpose: Analytics and reporting data warehouse architecture
-- =====================================================

-- =====================================================
-- Data Warehouse Schema Setup
-- =====================================================

CREATE SCHEMA IF NOT EXISTS warehouse;
CREATE SCHEMA IF NOT EXISTS etl;

-- =====================================================
-- Dimension Tables (SCD Type 2 for historical tracking)
-- =====================================================

-- Patient dimension with slowly changing dimensions
CREATE TABLE warehouse.dim_patient (
    patient_key BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL,
    
    -- Patient demographics
    mrn VARCHAR(50) NOT NULL,
    family_name VARCHAR(100),
    given_names VARCHAR(200),
    full_name VARCHAR(300),
    birth_date DATE,
    age_at_snapshot INTEGER,
    gender VARCHAR(20),
    gender_identity VARCHAR(50),
    race JSONB,
    ethnicity JSONB,
    
    -- Contact information
    phone_primary VARCHAR(20),
    email_primary VARCHAR(100),
    address_line1 VARCHAR(200),
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    
    -- Clinical attributes
    primary_language VARCHAR(10),
    deceased BOOLEAN DEFAULT FALSE,
    deceased_date DATE,
    
    -- SCD Type 2 fields
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE DEFAULT '9999-12-31',
    is_current BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    source_system VARCHAR(50) DEFAULT 'OmniCare',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint for current records
    UNIQUE(patient_id, is_current) DEFERRABLE INITIALLY DEFERRED
);

-- Patient dimension indexes
CREATE INDEX idx_dim_patient_patient_id ON warehouse.dim_patient(patient_id);
CREATE INDEX idx_dim_patient_mrn ON warehouse.dim_patient(mrn);
CREATE INDEX idx_dim_patient_current ON warehouse.dim_patient(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_dim_patient_effective_date ON warehouse.dim_patient(effective_date);

-- Practitioner dimension
CREATE TABLE warehouse.dim_practitioner (
    practitioner_key BIGSERIAL PRIMARY KEY,
    practitioner_id UUID NOT NULL,
    
    -- Practitioner details
    npi VARCHAR(10),
    family_name VARCHAR(100),
    given_names VARCHAR(200),
    full_name VARCHAR(300),
    specialties JSONB,
    credentials VARCHAR(200),
    
    -- Professional information
    license_number VARCHAR(50),
    license_state VARCHAR(2),
    board_certifications JSONB,
    
    -- Employment
    primary_organization VARCHAR(200),
    department VARCHAR(100),
    employment_status VARCHAR(20),
    
    -- SCD Type 2 fields
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE DEFAULT '9999-12-31',
    is_current BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    source_system VARCHAR(50) DEFAULT 'OmniCare',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(practitioner_id, is_current) DEFERRABLE INITIALLY DEFERRED
);

-- Practitioner dimension indexes
CREATE INDEX idx_dim_practitioner_practitioner_id ON warehouse.dim_practitioner(practitioner_id);
CREATE INDEX idx_dim_practitioner_npi ON warehouse.dim_practitioner(npi);
CREATE INDEX idx_dim_practitioner_current ON warehouse.dim_practitioner(is_current) WHERE is_current = TRUE;

-- Organization dimension
CREATE TABLE warehouse.dim_organization (
    organization_key BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL,
    
    -- Organization details
    name VARCHAR(200),
    organization_type VARCHAR(50),
    tax_id VARCHAR(20),
    npi VARCHAR(10),
    
    -- Address and contact
    address JSONB,
    phone VARCHAR(20),
    email VARCHAR(100),
    website VARCHAR(200),
    
    -- Hierarchy
    parent_organization_name VARCHAR(200),
    organization_level INTEGER,
    
    -- SCD Type 2 fields
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE DEFAULT '9999-12-31',
    is_current BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    source_system VARCHAR(50) DEFAULT 'OmniCare',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, is_current) DEFERRABLE INITIALLY DEFERRED
);

-- Location dimension
CREATE TABLE warehouse.dim_location (
    location_key BIGSERIAL PRIMARY KEY,
    location_id UUID NOT NULL,
    
    -- Location details
    name VARCHAR(200),
    location_type VARCHAR(50),
    description TEXT,
    
    -- Address
    address JSONB,
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    
    -- Coordinates
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Capacity and attributes
    capacity INTEGER,
    
    -- SCD Type 2 fields
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE DEFAULT '9999-12-31',
    is_current BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    source_system VARCHAR(50) DEFAULT 'OmniCare',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(location_id, is_current) DEFERRABLE INITIALLY DEFERRED
);

-- Date dimension for time-based analysis
CREATE TABLE warehouse.dim_date (
    date_key INTEGER PRIMARY KEY,
    full_date DATE NOT NULL UNIQUE,
    
    -- Date components
    year INTEGER NOT NULL,
    quarter INTEGER NOT NULL,
    month INTEGER NOT NULL,
    week INTEGER NOT NULL,
    day_of_year INTEGER NOT NULL,
    day_of_month INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    
    -- Date descriptions
    month_name VARCHAR(20) NOT NULL,
    day_name VARCHAR(20) NOT NULL,
    quarter_name VARCHAR(10) NOT NULL,
    
    -- Business calendar
    is_weekend BOOLEAN NOT NULL,
    is_holiday BOOLEAN DEFAULT FALSE,
    holiday_name VARCHAR(100),
    
    -- Fiscal year (assuming April-March)
    fiscal_year INTEGER NOT NULL,
    fiscal_quarter INTEGER NOT NULL,
    fiscal_month INTEGER NOT NULL,
    
    -- Relative indicators
    is_current_day BOOLEAN DEFAULT FALSE,
    is_current_month BOOLEAN DEFAULT FALSE,
    is_current_year BOOLEAN DEFAULT FALSE
);

-- Populate date dimension with 10 years of data
INSERT INTO warehouse.dim_date (
    date_key, full_date, year, quarter, month, week, day_of_year,
    day_of_month, day_of_week, month_name, day_name, quarter_name,
    is_weekend, fiscal_year, fiscal_quarter, fiscal_month
)
SELECT 
    to_char(d, 'YYYYMMDD')::INTEGER as date_key,
    d as full_date,
    EXTRACT(YEAR FROM d)::INTEGER as year,
    EXTRACT(QUARTER FROM d)::INTEGER as quarter,
    EXTRACT(MONTH FROM d)::INTEGER as month,
    EXTRACT(WEEK FROM d)::INTEGER as week,
    EXTRACT(DOY FROM d)::INTEGER as day_of_year,
    EXTRACT(DAY FROM d)::INTEGER as day_of_month,
    EXTRACT(DOW FROM d)::INTEGER as day_of_week,
    to_char(d, 'Month') as month_name,
    to_char(d, 'Day') as day_name,
    'Q' || EXTRACT(QUARTER FROM d)::TEXT as quarter_name,
    EXTRACT(DOW FROM d) IN (0, 6) as is_weekend,
    CASE 
        WHEN EXTRACT(MONTH FROM d) >= 4 THEN EXTRACT(YEAR FROM d)
        ELSE EXTRACT(YEAR FROM d) - 1 
    END as fiscal_year,
    CASE 
        WHEN EXTRACT(MONTH FROM d) >= 4 THEN EXTRACT(QUARTER FROM d + INTERVAL '9 months')
        ELSE EXTRACT(QUARTER FROM d + INTERVAL '3 months')
    END as fiscal_quarter,
    CASE 
        WHEN EXTRACT(MONTH FROM d) >= 4 THEN EXTRACT(MONTH FROM d) - 3
        ELSE EXTRACT(MONTH FROM d) + 9
    END as fiscal_month
FROM generate_series(
    '2020-01-01'::DATE,
    '2030-12-31'::DATE,
    '1 day'::INTERVAL
) as d;

-- Time dimension for intraday analysis
CREATE TABLE warehouse.dim_time (
    time_key INTEGER PRIMARY KEY,
    time_value TIME NOT NULL UNIQUE,
    
    -- Time components
    hour INTEGER NOT NULL,
    minute INTEGER NOT NULL,
    second INTEGER NOT NULL,
    
    -- Time periods
    hour_12 INTEGER NOT NULL,
    am_pm VARCHAR(2) NOT NULL,
    time_of_day VARCHAR(20) NOT NULL,
    shift VARCHAR(20) NOT NULL
);

-- Populate time dimension
INSERT INTO warehouse.dim_time (
    time_key, time_value, hour, minute, second,
    hour_12, am_pm, time_of_day, shift
)
SELECT 
    EXTRACT(HOUR FROM t) * 10000 + EXTRACT(MINUTE FROM t) * 100 + EXTRACT(SECOND FROM t) as time_key,
    t::TIME as time_value,
    EXTRACT(HOUR FROM t)::INTEGER as hour,
    EXTRACT(MINUTE FROM t)::INTEGER as minute,
    EXTRACT(SECOND FROM t)::INTEGER as second,
    CASE 
        WHEN EXTRACT(HOUR FROM t) = 0 THEN 12
        WHEN EXTRACT(HOUR FROM t) > 12 THEN EXTRACT(HOUR FROM t) - 12
        ELSE EXTRACT(HOUR FROM t)
    END as hour_12,
    CASE WHEN EXTRACT(HOUR FROM t) < 12 THEN 'AM' ELSE 'PM' END as am_pm,
    CASE 
        WHEN EXTRACT(HOUR FROM t) BETWEEN 0 AND 5 THEN 'Night'
        WHEN EXTRACT(HOUR FROM t) BETWEEN 6 AND 11 THEN 'Morning'
        WHEN EXTRACT(HOUR FROM t) BETWEEN 12 AND 17 THEN 'Afternoon'
        ELSE 'Evening'
    END as time_of_day,
    CASE 
        WHEN EXTRACT(HOUR FROM t) BETWEEN 7 AND 18 THEN 'Day Shift'
        WHEN EXTRACT(HOUR FROM t) BETWEEN 19 AND 6 THEN 'Night Shift'
        ELSE 'Other'
    END as shift
FROM generate_series(
    '00:00:00'::TIME,
    '23:59:59'::TIME,
    '1 minute'::INTERVAL
) as t;

-- =====================================================
-- Fact Tables
-- =====================================================

-- Encounters fact table
CREATE TABLE warehouse.fact_encounter (
    encounter_key BIGSERIAL PRIMARY KEY,
    encounter_id UUID NOT NULL,
    
    -- Dimension keys
    patient_key BIGINT NOT NULL REFERENCES warehouse.dim_patient(patient_key),
    practitioner_key BIGINT REFERENCES warehouse.dim_practitioner(practitioner_key),
    organization_key BIGINT REFERENCES warehouse.dim_organization(organization_key),
    location_key BIGINT REFERENCES warehouse.dim_location(location_key),
    
    -- Date and time keys
    admission_date_key INTEGER REFERENCES warehouse.dim_date(date_key),
    admission_time_key INTEGER REFERENCES warehouse.dim_time(time_key),
    discharge_date_key INTEGER REFERENCES warehouse.dim_date(date_key),
    discharge_time_key INTEGER REFERENCES warehouse.dim_time(time_key),
    
    -- Encounter attributes
    encounter_class VARCHAR(20),
    encounter_type VARCHAR(100),
    visit_number VARCHAR(50),
    encounter_status VARCHAR(20),
    
    -- Measures
    length_of_stay_hours DECIMAL(10,2),
    length_of_stay_days DECIMAL(10,2),
    
    -- Financial measures (if available)
    estimated_cost DECIMAL(12,2),
    estimated_revenue DECIMAL(12,2),
    
    -- Quality measures
    readmission_30_day BOOLEAN DEFAULT FALSE,
    patient_satisfaction_score DECIMAL(3,1),
    
    -- Timestamps
    encounter_start TIMESTAMP WITH TIME ZONE,
    encounter_end TIMESTAMP WITH TIME ZONE,
    
    -- ETL metadata
    source_system VARCHAR(50) DEFAULT 'OmniCare',
    etl_batch_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Encounter fact indexes
CREATE INDEX idx_fact_encounter_patient_key ON warehouse.fact_encounter(patient_key);
CREATE INDEX idx_fact_encounter_practitioner_key ON warehouse.fact_encounter(practitioner_key);
CREATE INDEX idx_fact_encounter_admission_date ON warehouse.fact_encounter(admission_date_key);
CREATE INDEX idx_fact_encounter_class ON warehouse.fact_encounter(encounter_class);
CREATE INDEX idx_fact_encounter_status ON warehouse.fact_encounter(encounter_status);

-- Clinical observations fact table
CREATE TABLE warehouse.fact_observation (
    observation_key BIGSERIAL PRIMARY KEY,
    observation_id UUID NOT NULL,
    
    -- Dimension keys
    patient_key BIGINT NOT NULL REFERENCES warehouse.dim_patient(patient_key),
    practitioner_key BIGINT REFERENCES warehouse.dim_practitioner(practitioner_key),
    encounter_key BIGINT REFERENCES warehouse.fact_encounter(encounter_key),
    
    -- Date and time keys
    observation_date_key INTEGER REFERENCES warehouse.dim_date(date_key),
    observation_time_key INTEGER REFERENCES warehouse.dim_time(time_key),
    
    -- Observation attributes
    observation_category VARCHAR(50),
    observation_code VARCHAR(100),
    observation_display VARCHAR(500),
    observation_status VARCHAR(20),
    
    -- Measurement values
    numeric_value DECIMAL(15,6),
    text_value TEXT,
    unit_of_measure VARCHAR(50),
    
    -- Reference ranges
    reference_low DECIMAL(15,6),
    reference_high DECIMAL(15,6),
    
    -- Flags and interpretation
    abnormal_flag BOOLEAN DEFAULT FALSE,
    critical_flag BOOLEAN DEFAULT FALSE,
    interpretation_code VARCHAR(50),
    
    -- Body site and method
    body_site VARCHAR(100),
    method VARCHAR(100),
    
    -- Timestamps
    observation_datetime TIMESTAMP WITH TIME ZONE,
    
    -- ETL metadata
    source_system VARCHAR(50) DEFAULT 'OmniCare',
    etl_batch_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Observation fact indexes
CREATE INDEX idx_fact_observation_patient_key ON warehouse.fact_observation(patient_key);
CREATE INDEX idx_fact_observation_encounter_key ON warehouse.fact_observation(encounter_key);
CREATE INDEX idx_fact_observation_date ON warehouse.fact_observation(observation_date_key);
CREATE INDEX idx_fact_observation_category ON warehouse.fact_observation(observation_category);
CREATE INDEX idx_fact_observation_code ON warehouse.fact_observation(observation_code);
CREATE INDEX idx_fact_observation_abnormal ON warehouse.fact_observation(abnormal_flag) WHERE abnormal_flag = TRUE;
CREATE INDEX idx_fact_observation_critical ON warehouse.fact_observation(critical_flag) WHERE critical_flag = TRUE;

-- Medication fact table
CREATE TABLE warehouse.fact_medication (
    medication_key BIGSERIAL PRIMARY KEY,
    medication_request_id UUID,
    medication_administration_id UUID,
    
    -- Dimension keys
    patient_key BIGINT NOT NULL REFERENCES warehouse.dim_patient(patient_key),
    practitioner_key BIGINT REFERENCES warehouse.dim_practitioner(practitioner_key),
    encounter_key BIGINT REFERENCES warehouse.fact_encounter(encounter_key),
    
    -- Date and time keys
    prescribed_date_key INTEGER REFERENCES warehouse.dim_date(date_key),
    prescribed_time_key INTEGER REFERENCES warehouse.dim_time(time_key),
    administered_date_key INTEGER REFERENCES warehouse.dim_date(date_key),
    administered_time_key INTEGER REFERENCES warehouse.dim_time(time_key),
    
    -- Medication attributes
    medication_name VARCHAR(500),
    medication_code VARCHAR(100),
    medication_class VARCHAR(100),
    route_of_administration VARCHAR(100),
    
    -- Dosage information
    dose_quantity DECIMAL(10,3),
    dose_unit VARCHAR(50),
    frequency VARCHAR(100),
    duration_days INTEGER,
    
    -- Status
    prescription_status VARCHAR(20),
    administration_status VARCHAR(20),
    
    -- Safety flags
    allergy_checked BOOLEAN DEFAULT FALSE,
    interaction_checked BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    prescribed_datetime TIMESTAMP WITH TIME ZONE,
    administered_datetime TIMESTAMP WITH TIME ZONE,
    
    -- ETL metadata
    source_system VARCHAR(50) DEFAULT 'OmniCare',
    etl_batch_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Medication fact indexes
CREATE INDEX idx_fact_medication_patient_key ON warehouse.fact_medication(patient_key);
CREATE INDEX idx_fact_medication_encounter_key ON warehouse.fact_medication(encounter_key);
CREATE INDEX idx_fact_medication_prescribed_date ON warehouse.fact_medication(prescribed_date_key);
CREATE INDEX idx_fact_medication_name ON warehouse.fact_medication(medication_name);
CREATE INDEX idx_fact_medication_class ON warehouse.fact_medication(medication_class);

-- Patient summary fact table (for dashboard KPIs)
CREATE TABLE warehouse.fact_patient_summary (
    patient_summary_key BIGSERIAL PRIMARY KEY,
    
    -- Dimension keys
    patient_key BIGINT NOT NULL REFERENCES warehouse.dim_patient(patient_key),
    snapshot_date_key INTEGER REFERENCES warehouse.dim_date(date_key),
    
    -- Patient measures
    active_conditions_count INTEGER DEFAULT 0,
    active_medications_count INTEGER DEFAULT 0,
    active_allergies_count INTEGER DEFAULT 0,
    
    -- Encounter measures (last 12 months)
    encounters_last_year INTEGER DEFAULT 0,
    admissions_last_year INTEGER DEFAULT 0,
    emergency_visits_last_year INTEGER DEFAULT 0,
    
    -- Clinical measures
    last_vital_signs_date DATE,
    last_lab_results_date DATE,
    overdue_screenings_count INTEGER DEFAULT 0,
    
    -- Risk scores
    fall_risk_score INTEGER,
    readmission_risk_score INTEGER,
    mortality_risk_score INTEGER,
    
    -- Care gaps
    care_gaps_count INTEGER DEFAULT 0,
    preventive_care_due INTEGER DEFAULT 0,
    
    -- Timestamps
    snapshot_date DATE DEFAULT CURRENT_DATE,
    
    -- ETL metadata
    source_system VARCHAR(50) DEFAULT 'OmniCare',
    etl_batch_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Patient summary fact indexes
CREATE INDEX idx_fact_patient_summary_patient_key ON warehouse.fact_patient_summary(patient_key);
CREATE INDEX idx_fact_patient_summary_snapshot_date ON warehouse.fact_patient_summary(snapshot_date_key);
CREATE INDEX idx_fact_patient_summary_care_gaps ON warehouse.fact_patient_summary(care_gaps_count) WHERE care_gaps_count > 0;

-- =====================================================
-- Data Quality and Lineage Tables
-- =====================================================

-- Data quality monitoring
CREATE TABLE warehouse.data_quality_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Target information
    table_name VARCHAR(100) NOT NULL,
    column_name VARCHAR(100),
    
    -- Quality metrics
    completeness_percentage DECIMAL(5,2),
    uniqueness_percentage DECIMAL(5,2),
    validity_percentage DECIMAL(5,2),
    consistency_percentage DECIMAL(5,2),
    
    -- Record counts
    total_records BIGINT,
    null_records BIGINT,
    duplicate_records BIGINT,
    invalid_records BIGINT,
    
    -- Quality rules violated
    rules_violated JSONB,
    
    -- Measurement details
    measurement_date DATE DEFAULT CURRENT_DATE,
    measurement_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- ETL batch context
    etl_batch_id UUID,
    
    -- Quality status
    quality_status VARCHAR(20) DEFAULT 'measured',
    quality_score DECIMAL(5,2),
    
    CONSTRAINT valid_quality_status CHECK (quality_status IN ('measured', 'passed', 'failed', 'warning'))
);

-- Data lineage tracking
CREATE TABLE warehouse.data_lineage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Source information
    source_system VARCHAR(100) NOT NULL,
    source_table VARCHAR(100) NOT NULL,
    source_column VARCHAR(100),
    
    -- Target information
    target_table VARCHAR(100) NOT NULL,
    target_column VARCHAR(100),
    
    -- Transformation details
    transformation_type VARCHAR(50),
    transformation_logic TEXT,
    
    -- Dependencies
    depends_on_tables TEXT[],
    affects_tables TEXT[],
    
    -- ETL process information
    etl_process_name VARCHAR(200),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Status
    active BOOLEAN DEFAULT TRUE
);

-- Comments for documentation
COMMENT ON SCHEMA warehouse IS 'OLAP data warehouse for analytics and reporting';
COMMENT ON TABLE warehouse.dim_patient IS 'Patient dimension with SCD Type 2 for historical tracking';
COMMENT ON TABLE warehouse.dim_practitioner IS 'Healthcare provider dimension';
COMMENT ON TABLE warehouse.dim_organization IS 'Healthcare organization dimension';
COMMENT ON TABLE warehouse.dim_location IS 'Physical location dimension';
COMMENT ON TABLE warehouse.dim_date IS 'Date dimension for time-based analysis';
COMMENT ON TABLE warehouse.dim_time IS 'Time dimension for intraday analysis';
COMMENT ON TABLE warehouse.fact_encounter IS 'Healthcare encounters fact table';
COMMENT ON TABLE warehouse.fact_observation IS 'Clinical observations and measurements fact table';
COMMENT ON TABLE warehouse.fact_medication IS 'Medication prescriptions and administrations fact table';
COMMENT ON TABLE warehouse.fact_patient_summary IS 'Patient summary metrics for dashboards';
COMMENT ON TABLE warehouse.data_quality_metrics IS 'Data quality monitoring and metrics';
COMMENT ON TABLE warehouse.data_lineage IS 'Data lineage and transformation tracking';