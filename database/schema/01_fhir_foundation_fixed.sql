-- =====================================================
-- OmniCare EMR - FHIR R4 Foundation Schema (Fixed)
-- Author: Database Integration Developer
-- Purpose: Core FHIR R4 compliant database foundation
-- =====================================================

-- Enable necessary PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create dedicated schemas for organization
CREATE SCHEMA IF NOT EXISTS fhir;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS reporting;

-- =====================================================
-- Base FHIR Resource Table Template
-- =====================================================

-- Core FHIR resource base table that all resources inherit from
CREATE TABLE fhir.resource_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type VARCHAR(50) NOT NULL,
    version_id UUID DEFAULT uuid_generate_v4(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- FHIR Meta elements
    profile TEXT[],
    security JSONB,
    tag JSONB,
    
    -- Full FHIR resource as JSONB for complete flexibility
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
    
    -- Indexes for performance
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
);

-- Indexes for resource_base
CREATE INDEX idx_resource_base_type ON fhir.resource_base(resource_type);
CREATE INDEX idx_resource_base_status ON fhir.resource_base(status) WHERE status != 'deleted';
CREATE INDEX idx_resource_base_updated ON fhir.resource_base(last_updated);
CREATE INDEX idx_resource_base_search ON fhir.resource_base USING gin(search_text);
CREATE INDEX idx_resource_base_data ON fhir.resource_base USING gin(resource_data);

-- =====================================================
-- Identity and Demographics Resources
-- =====================================================

-- Patient table with optimized FHIR structure
CREATE TABLE fhir.patient (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Identifiers
    mrn VARCHAR(50) UNIQUE NOT NULL,
    ssn_encrypted BYTEA, -- Store encrypted SSN
    drivers_license VARCHAR(50),
    
    -- Demographics
    family_name VARCHAR(100) NOT NULL,
    given_names VARCHAR(200) NOT NULL,
    prefix VARCHAR(20),
    suffix VARCHAR(20),
    
    -- Contact Information
    phone_primary VARCHAR(20),
    phone_secondary VARCHAR(20),
    email_primary VARCHAR(100),
    email_secondary VARCHAR(100),
    
    -- Address (current)
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'US',
    
    -- Demographics
    birth_date DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    gender_identity VARCHAR(50),
    sexual_orientation VARCHAR(50),
    
    -- Clinical attributes
    race JSONB,
    ethnicity JSONB,
    language_primary VARCHAR(10) DEFAULT 'en',
    languages_spoken JSONB,
    
    -- Emergency contact
    emergency_contact JSONB,
    
    -- Relationships
    primary_care_provider UUID,
    managing_organization UUID,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    deceased BOOLEAN DEFAULT FALSE,
    deceased_datetime TIMESTAMP WITH TIME ZONE,
    
    -- Search optimization
    name_search TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', 
            COALESCE(family_name, '') || ' ' || 
            COALESCE(given_names, '') || ' ' ||
            COALESCE(mrn, '')
        )
    ) STORED,
    
    CONSTRAINT valid_gender CHECK (gender IN ('male', 'female', 'other', 'unknown')),
    CONSTRAINT valid_language CHECK (language_primary ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

-- Patient indexes
CREATE UNIQUE INDEX idx_patient_mrn ON fhir.patient(mrn) WHERE active = TRUE;
CREATE INDEX idx_patient_name_search ON fhir.patient USING gin(name_search);
CREATE INDEX idx_patient_birth_date ON fhir.patient(birth_date);
CREATE INDEX idx_patient_phone ON fhir.patient(phone_primary);
CREATE INDEX idx_patient_email ON fhir.patient(email_primary);
CREATE INDEX idx_patient_postal_code ON fhir.patient(postal_code);

-- Practitioner table
CREATE TABLE fhir.practitioner (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Identifiers
    npi VARCHAR(10) UNIQUE,
    license_number VARCHAR(50),
    dea_number_encrypted BYTEA, -- Store encrypted DEA number
    
    -- Demographics
    family_name VARCHAR(100) NOT NULL,
    given_names VARCHAR(200) NOT NULL,
    prefix VARCHAR(20),
    suffix VARCHAR(20),
    
    -- Contact
    phone VARCHAR(20),
    email VARCHAR(100),
    
    -- Professional info
    specialties JSONB,
    qualifications JSONB,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    
    -- Search
    name_search TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', 
            COALESCE(family_name, '') || ' ' || 
            COALESCE(given_names, '') || ' ' ||
            COALESCE(npi, '')
        )
    ) STORED
);

-- Organization table
CREATE TABLE fhir.organization (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Identifiers
    tax_id VARCHAR(20),
    npi VARCHAR(10),
    
    -- Basic info
    name VARCHAR(200) NOT NULL,
    alias_names TEXT[],
    organization_type VARCHAR(50),
    
    -- Contact
    phone VARCHAR(20),
    email VARCHAR(100),
    website VARCHAR(200),
    
    -- Address
    address JSONB,
    
    -- Relationships
    parent_organization UUID,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    
    -- Search
    name_search TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', COALESCE(name, ''))
    ) STORED
);

-- Location table
CREATE TABLE fhir.location (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Basic info
    name VARCHAR(200) NOT NULL,
    description TEXT,
    location_type VARCHAR(50),
    
    -- Address
    address JSONB,
    
    -- Coordinates
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Capacity and attributes
    capacity INTEGER,
    attributes JSONB,
    
    -- Relationships
    managing_organization UUID,
    parent_location UUID,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',
    operational_status VARCHAR(20) DEFAULT 'active',
    
    CONSTRAINT valid_location_status CHECK (status IN ('active', 'suspended', 'inactive'))
);

-- =====================================================
-- Clinical Resources
-- =====================================================

-- Encounter table
CREATE TABLE fhir.encounter (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Identifiers
    visit_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- References
    patient_id UUID NOT NULL,
    practitioner_id UUID,
    organization_id UUID,
    location_id UUID,
    
    -- Classification
    encounter_class VARCHAR(20) NOT NULL,
    encounter_type JSONB,
    service_type JSONB,
    priority VARCHAR(20),
    
    -- Status and timeline
    status VARCHAR(20) NOT NULL DEFAULT 'planned',
    status_history JSONB,
    
    -- Period
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    
    -- Clinical details
    reason_code JSONB,
    reason_reference UUID[],
    diagnosis JSONB,
    
    -- Administrative
    admission JSONB,
    discharge JSONB,
    account_id UUID,
    
    CONSTRAINT valid_encounter_class CHECK (encounter_class IN (
        'inpatient', 'outpatient', 'ambulatory', 'emergency', 'home-health', 'virtual'
    )),
    CONSTRAINT valid_encounter_status CHECK (status IN (
        'planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled'
    )),
    CONSTRAINT valid_period CHECK (end_time IS NULL OR start_time <= end_time)
);

-- Encounter indexes
CREATE UNIQUE INDEX idx_encounter_visit_number ON fhir.encounter(visit_number);
CREATE INDEX idx_encounter_patient ON fhir.encounter(patient_id);
CREATE INDEX idx_encounter_practitioner ON fhir.encounter(practitioner_id);
CREATE INDEX idx_encounter_status ON fhir.encounter(status);
CREATE INDEX idx_encounter_class ON fhir.encounter(encounter_class);
CREATE INDEX idx_encounter_start_time ON fhir.encounter(start_time);
CREATE INDEX idx_encounter_patient_status ON fhir.encounter(patient_id, status);

-- Observation table
CREATE TABLE fhir.observation (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
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
    effective_datetime TIMESTAMP WITH TIME ZONE,
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
);

-- Observation indexes
CREATE INDEX idx_observation_patient ON fhir.observation(patient_id);
CREATE INDEX idx_observation_encounter ON fhir.observation(encounter_id);
CREATE INDEX idx_observation_status ON fhir.observation(status);
CREATE INDEX idx_observation_effective ON fhir.observation(effective_datetime);
CREATE INDEX idx_observation_category ON fhir.observation USING gin(category);
CREATE INDEX idx_observation_code ON fhir.observation USING gin(code);
CREATE INDEX idx_observation_patient_category ON fhir.observation(patient_id) INCLUDE (category, effective_datetime);

-- Condition (Problem List) table
CREATE TABLE fhir.condition (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- References
    patient_id UUID NOT NULL,
    encounter_id UUID,
    asserter_practitioner_id UUID,
    
    -- Clinical status
    clinical_status VARCHAR(20) NOT NULL DEFAULT 'active',
    verification_status VARCHAR(20) NOT NULL DEFAULT 'unconfirmed',
    
    -- Classification
    category JSONB,
    severity JSONB,
    code JSONB NOT NULL,
    body_site JSONB,
    
    -- Timeline
    onset_datetime TIMESTAMP WITH TIME ZONE,
    onset_age JSONB,
    onset_period JSONB,
    onset_range JSONB,
    onset_string TEXT,
    
    abatement_datetime TIMESTAMP WITH TIME ZONE,
    abatement_age JSONB,
    abatement_period JSONB,
    abatement_range JSONB,
    abatement_string TEXT,
    abatement_boolean BOOLEAN,
    
    recorded_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Clinical details
    stage JSONB,
    evidence JSONB,
    
    -- Notes
    note JSONB,
    
    CONSTRAINT valid_clinical_status CHECK (clinical_status IN (
        'active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'
    )),
    CONSTRAINT valid_verification_status CHECK (verification_status IN (
        'unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted', 'entered-in-error'
    ))
);

-- Condition indexes
CREATE INDEX idx_condition_patient ON fhir.condition(patient_id);
CREATE INDEX idx_condition_encounter ON fhir.condition(encounter_id);
CREATE INDEX idx_condition_clinical_status ON fhir.condition(clinical_status);
CREATE INDEX idx_condition_verification_status ON fhir.condition(verification_status);
CREATE INDEX idx_condition_code ON fhir.condition USING gin(code);
CREATE INDEX idx_condition_category ON fhir.condition USING gin(category);
CREATE INDEX idx_condition_onset ON fhir.condition(onset_datetime);
CREATE INDEX idx_condition_patient_status ON fhir.condition(patient_id, clinical_status);

-- =====================================================
-- Medication Resources
-- =====================================================

-- MedicationRequest table
CREATE TABLE fhir.medication_request (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Identifiers
    prescription_number VARCHAR(50) UNIQUE,
    
    -- References
    patient_id UUID NOT NULL,
    encounter_id UUID,
    practitioner_id UUID,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    status_reason JSONB,
    intent VARCHAR(20) NOT NULL DEFAULT 'order',
    
    -- Priority and category
    priority VARCHAR(20) DEFAULT 'routine',
    category JSONB,
    
    -- Medication
    medication_codeable_concept JSONB,
    medication_reference UUID,
    
    -- Dosage and administration
    dosage_instruction JSONB,
    dispense_request JSONB,
    
    -- Timing
    authored_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Substitution
    substitution JSONB,
    
    -- Prior prescription
    prior_prescription UUID,
    
    -- Clinical context
    reason_code JSONB,
    reason_reference UUID[],
    
    -- Supporting information
    supporting_information UUID[],
    
    -- Notes
    note JSONB,
    
    CONSTRAINT valid_medication_status CHECK (status IN (
        'draft', 'active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped'
    )),
    CONSTRAINT valid_medication_intent CHECK (intent IN (
        'proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'
    ))
);

-- MedicationRequest indexes
CREATE UNIQUE INDEX idx_medication_request_rx_number ON fhir.medication_request(prescription_number) WHERE prescription_number IS NOT NULL;
CREATE INDEX idx_medication_request_patient ON fhir.medication_request(patient_id);
CREATE INDEX idx_medication_request_encounter ON fhir.medication_request(encounter_id);
CREATE INDEX idx_medication_request_practitioner ON fhir.medication_request(practitioner_id);
CREATE INDEX idx_medication_request_status ON fhir.medication_request(status);
CREATE INDEX idx_medication_request_authored ON fhir.medication_request(authored_on);
CREATE INDEX idx_medication_request_medication ON fhir.medication_request USING gin(medication_codeable_concept);

-- MedicationAdministration table
CREATE TABLE fhir.medication_administration (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- References
    patient_id UUID NOT NULL,
    encounter_id UUID,
    practitioner_id UUID,
    medication_request_id UUID,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'in-progress',
    status_reason JSONB,
    
    -- Category
    category JSONB,
    
    -- Medication
    medication_codeable_concept JSONB,
    medication_reference UUID,
    
    -- Administration details
    effective_datetime TIMESTAMP WITH TIME ZONE,
    effective_period JSONB,
    
    -- Dosage
    dosage JSONB,
    
    -- Clinical context
    reason_code JSONB,
    reason_reference UUID[],
    
    -- Supporting information
    supporting_information UUID[],
    device_reference UUID[],
    
    -- Notes
    note JSONB,
    
    CONSTRAINT valid_administration_status CHECK (status IN (
        'in-progress', 'not-done', 'on-hold', 'completed', 'entered-in-error', 'stopped', 'unknown'
    ))
);

-- MedicationAdministration indexes
CREATE INDEX idx_medication_admin_patient ON fhir.medication_administration(patient_id);
CREATE INDEX idx_medication_admin_encounter ON fhir.medication_administration(encounter_id);
CREATE INDEX idx_medication_admin_practitioner ON fhir.medication_administration(practitioner_id);
CREATE INDEX idx_medication_admin_request ON fhir.medication_administration(medication_request_id);
CREATE INDEX idx_medication_admin_status ON fhir.medication_administration(status);
CREATE INDEX idx_medication_admin_effective ON fhir.medication_administration(effective_datetime);

-- AllergyIntolerance table
CREATE TABLE fhir.allergy_intolerance (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- References
    patient_id UUID NOT NULL,
    encounter_id UUID,
    asserter_practitioner_id UUID,
    
    -- Clinical status
    clinical_status VARCHAR(20) DEFAULT 'active',
    verification_status VARCHAR(20) NOT NULL DEFAULT 'unconfirmed',
    
    -- Type and category
    allergy_type VARCHAR(20),
    category VARCHAR(20)[],
    criticality VARCHAR(20),
    
    -- Substance
    code JSONB NOT NULL,
    
    -- Timeline
    onset_datetime TIMESTAMP WITH TIME ZONE,
    onset_age JSONB,
    onset_period JSONB,
    onset_range JSONB,
    onset_string TEXT,
    
    recorded_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Clinical details
    last_occurrence TIMESTAMP WITH TIME ZONE,
    
    -- Reactions
    reaction JSONB,
    
    -- Notes
    note JSONB,
    
    CONSTRAINT valid_allergy_clinical_status CHECK (clinical_status IN ('active', 'inactive', 'resolved')),
    CONSTRAINT valid_allergy_verification_status CHECK (verification_status IN (
        'unconfirmed', 'confirmed', 'refuted', 'entered-in-error'
    )),
    CONSTRAINT valid_allergy_type CHECK (allergy_type IN ('allergy', 'intolerance')),
    CONSTRAINT valid_allergy_criticality CHECK (criticality IN ('low', 'high', 'unable-to-assess'))
);

-- AllergyIntolerance indexes
CREATE INDEX idx_allergy_patient ON fhir.allergy_intolerance(patient_id);
CREATE INDEX idx_allergy_encounter ON fhir.allergy_intolerance(encounter_id);
CREATE INDEX idx_allergy_clinical_status ON fhir.allergy_intolerance(clinical_status);
CREATE INDEX idx_allergy_verification_status ON fhir.allergy_intolerance(verification_status);
CREATE INDEX idx_allergy_code ON fhir.allergy_intolerance USING gin(code);
CREATE INDEX idx_allergy_criticality ON fhir.allergy_intolerance(criticality);
CREATE INDEX idx_allergy_patient_status ON fhir.allergy_intolerance(patient_id, clinical_status);

-- Create triggers for automated timestamp updates
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all main tables
DO $$
DECLARE
    table_name TEXT;
    table_names TEXT[] := ARRAY[
        'fhir.resource_base', 'fhir.patient', 'fhir.practitioner', 'fhir.organization',
        'fhir.location', 'fhir.encounter', 'fhir.observation', 'fhir.condition',
        'fhir.medication_request', 'fhir.medication_administration', 'fhir.allergy_intolerance'
    ];
BEGIN
    FOREACH table_name IN ARRAY table_names
    LOOP
        EXECUTE format('CREATE TRIGGER trigger_update_timestamp 
                        BEFORE UPDATE ON %s 
                        FOR EACH ROW EXECUTE FUNCTION update_timestamp()', table_name);
    END LOOP;
END $$;

-- Comments for documentation
COMMENT ON SCHEMA fhir IS 'FHIR R4 compliant resource storage';
COMMENT ON TABLE fhir.resource_base IS 'Base table for all FHIR resources with common metadata';
COMMENT ON TABLE fhir.patient IS 'Patient demographic and administrative data';
COMMENT ON TABLE fhir.practitioner IS 'Healthcare provider information';
COMMENT ON TABLE fhir.organization IS 'Healthcare organization data';
COMMENT ON TABLE fhir.location IS 'Physical location information';
COMMENT ON TABLE fhir.encounter IS 'Healthcare encounters and visits';
COMMENT ON TABLE fhir.observation IS 'Clinical observations and measurements';
COMMENT ON TABLE fhir.condition IS 'Patient conditions and problems';
COMMENT ON TABLE fhir.medication_request IS 'Medication prescriptions and orders';
COMMENT ON TABLE fhir.medication_administration IS 'Medication administration records';
COMMENT ON TABLE fhir.allergy_intolerance IS 'Patient allergies and intolerances';