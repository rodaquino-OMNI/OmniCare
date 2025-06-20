-- =====================================================
-- OmniCare EMR - FHIR R4 Workflow Resources Schema
-- Author: Database Integration Developer
-- Purpose: Care coordination, orders, and workflow resources
-- =====================================================

-- =====================================================
-- Care Coordination Resources
-- =====================================================

-- CarePlan table
CREATE TABLE fhir.care_plan (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- References
    patient_id UUID NOT NULL,
    encounter_id UUID,
    
    -- Identifiers
    care_plan_id VARCHAR(50),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    intent VARCHAR(20) NOT NULL DEFAULT 'plan',
    
    -- Classification
    category JSONB,
    title VARCHAR(200),
    description TEXT,
    
    -- Timeline
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Clinical context
    condition_references UUID[],
    goal_references UUID[],
    activity JSONB,
    
    -- Care team
    care_team_id UUID,
    author_practitioner_id UUID,
    contributor_practitioners UUID[],
    
    -- Notes
    note JSONB,
    
    CONSTRAINT valid_care_plan_status CHECK (status IN (
        'draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown'
    )),
    CONSTRAINT valid_care_plan_intent CHECK (intent IN (
        'proposal', 'plan', 'order', 'option'
    ))
);

-- CarePlan indexes
CREATE INDEX idx_care_plan_patient ON fhir.care_plan(patient_id);
CREATE INDEX idx_care_plan_encounter ON fhir.care_plan(encounter_id);
CREATE INDEX idx_care_plan_status ON fhir.care_plan(status);
CREATE INDEX idx_care_plan_period ON fhir.care_plan(period_start, period_end);
CREATE INDEX idx_care_plan_author ON fhir.care_plan(author_practitioner_id);

-- Goal table
CREATE TABLE fhir.goal (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- References
    patient_id UUID NOT NULL,
    encounter_id UUID,
    
    -- Identifiers
    goal_id VARCHAR(50),
    
    -- Status
    lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'proposed',
    achievement_status JSONB,
    
    -- Classification
    category JSONB,
    priority JSONB,
    description JSONB NOT NULL,
    
    -- Timeline
    start_date DATE,
    target_date DATE,
    status_date DATE,
    
    -- Clinical context
    condition_references UUID[],
    outcome_code JSONB,
    outcome_reference UUID[],
    
    -- Target/outcome
    target JSONB,
    
    -- Notes
    note JSONB,
    
    CONSTRAINT valid_goal_lifecycle_status CHECK (lifecycle_status IN (
        'proposed', 'planned', 'accepted', 'active', 'on-hold', 'completed', 'cancelled', 'entered-in-error', 'rejected'
    ))
);

-- Goal indexes
CREATE INDEX idx_goal_patient ON fhir.goal(patient_id);
CREATE INDEX idx_goal_encounter ON fhir.goal(encounter_id);
CREATE INDEX idx_goal_lifecycle_status ON fhir.goal(lifecycle_status);
CREATE INDEX idx_goal_target_date ON fhir.goal(target_date);
CREATE INDEX idx_goal_category ON fhir.goal USING gin(category);

-- Task table (for workflow management)
CREATE TABLE fhir.task (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Identifiers
    task_id VARCHAR(50),
    
    -- References
    patient_id UUID,
    encounter_id UUID,
    requester_practitioner_id UUID,
    owner_practitioner_id UUID,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    status_reason JSONB,
    intent VARCHAR(20) NOT NULL DEFAULT 'order',
    priority VARCHAR(20) DEFAULT 'routine',
    
    -- Classification
    code JSONB,
    description TEXT,
    focus_reference UUID,
    
    -- Timeline
    authored_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    execution_period JSONB,
    
    -- Task details
    input JSONB,
    output JSONB,
    
    -- Workflow context
    part_of_task UUID,
    group_identifier VARCHAR(50),
    business_status JSONB,
    
    -- Location
    location_id UUID,
    
    -- Restriction
    restriction JSONB,
    
    -- Notes
    note JSONB,
    
    CONSTRAINT valid_task_status CHECK (status IN (
        'draft', 'requested', 'received', 'accepted', 'rejected', 'ready', 'cancelled', 
        'in-progress', 'on-hold', 'failed', 'completed', 'entered-in-error'
    )),
    CONSTRAINT valid_task_intent CHECK (intent IN (
        'unknown', 'proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'
    )),
    CONSTRAINT valid_task_priority CHECK (priority IN ('routine', 'urgent', 'asap', 'stat'))
);

-- Task indexes
CREATE INDEX idx_task_patient ON fhir.task(patient_id);
CREATE INDEX idx_task_encounter ON fhir.task(encounter_id);
CREATE INDEX idx_task_requester ON fhir.task(requester_practitioner_id);
CREATE INDEX idx_task_owner ON fhir.task(owner_practitioner_id);
CREATE INDEX idx_task_status ON fhir.task(status);
CREATE INDEX idx_task_priority ON fhir.task(priority);
CREATE INDEX idx_task_authored ON fhir.task(authored_on);
CREATE INDEX idx_task_group ON fhir.task(group_identifier);

-- =====================================================
-- Orders and Requests
-- =====================================================

-- ServiceRequest table (for lab, imaging, procedures)
CREATE TABLE fhir.service_request (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Identifiers
    order_id VARCHAR(50) UNIQUE,
    requisition VARCHAR(50),
    
    -- References
    patient_id UUID NOT NULL,
    encounter_id UUID,
    requester_practitioner_id UUID,
    performer_practitioner_id UUID,
    performer_organization_id UUID,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    intent VARCHAR(20) NOT NULL DEFAULT 'order',
    priority VARCHAR(20) DEFAULT 'routine',
    
    -- Classification
    category JSONB,
    code JSONB NOT NULL,
    order_detail JSONB,
    
    -- Clinical context
    reason_code JSONB,
    reason_reference UUID[],
    
    -- Timeline
    authored_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    occurrence_datetime TIMESTAMP WITH TIME ZONE,
    occurrence_period JSONB,
    occurrence_timing JSONB,
    as_needed_boolean BOOLEAN DEFAULT FALSE,
    as_needed_codeable_concept JSONB,
    
    -- Instructions
    patient_instruction TEXT,
    note JSONB,
    
    -- Specimens
    specimen_id UUID[],
    body_site JSONB,
    
    -- Supporting information
    supporting_info UUID[],
    
    -- Location
    location_code JSONB,
    location_reference UUID[],
    
    CONSTRAINT valid_service_request_status CHECK (status IN (
        'draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown'
    )),
    CONSTRAINT valid_service_request_intent CHECK (intent IN (
        'proposal', 'plan', 'directive', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'
    )),
    CONSTRAINT valid_service_request_priority CHECK (priority IN ('routine', 'urgent', 'asap', 'stat'))
);

-- ServiceRequest indexes
CREATE UNIQUE INDEX idx_service_request_order_id ON fhir.service_request(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_service_request_patient ON fhir.service_request(patient_id);
CREATE INDEX idx_service_request_encounter ON fhir.service_request(encounter_id);
CREATE INDEX idx_service_request_requester ON fhir.service_request(requester_practitioner_id);
CREATE INDEX idx_service_request_performer ON fhir.service_request(performer_practitioner_id);
CREATE INDEX idx_service_request_status ON fhir.service_request(status);
CREATE INDEX idx_service_request_priority ON fhir.service_request(priority);
CREATE INDEX idx_service_request_authored ON fhir.service_request(authored_on);
CREATE INDEX idx_service_request_code ON fhir.service_request USING gin(code);
CREATE INDEX idx_service_request_category ON fhir.service_request USING gin(category);

-- DiagnosticReport table
CREATE TABLE fhir.diagnostic_report (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Identifiers
    report_id VARCHAR(50),
    
    -- References
    patient_id UUID NOT NULL,
    encounter_id UUID,
    service_request_id UUID,
    performer_practitioner_id UUID,
    results_interpreter_practitioner_id UUID,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'registered',
    
    -- Classification
    category JSONB NOT NULL,
    code JSONB NOT NULL,
    
    -- Timeline
    effective_datetime TIMESTAMP WITH TIME ZONE,
    effective_period JSONB,
    issued TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Results
    result_observation_ids UUID[],
    imaging_study_ids UUID[],
    media JSONB,
    
    -- Report content
    conclusion TEXT,
    conclusion_code JSONB,
    
    -- Supporting information
    specimen_id UUID[],
    
    -- Presentation
    presented_form JSONB,
    
    CONSTRAINT valid_diagnostic_report_status CHECK (status IN (
        'registered', 'partial', 'preliminary', 'final', 'amended', 'corrected', 'appended', 'cancelled', 'entered-in-error', 'unknown'
    ))
);

-- DiagnosticReport indexes
CREATE INDEX idx_diagnostic_report_patient ON fhir.diagnostic_report(patient_id);
CREATE INDEX idx_diagnostic_report_encounter ON fhir.diagnostic_report(encounter_id);
CREATE INDEX idx_diagnostic_report_service_request ON fhir.diagnostic_report(service_request_id);
CREATE INDEX idx_diagnostic_report_performer ON fhir.diagnostic_report(performer_practitioner_id);
CREATE INDEX idx_diagnostic_report_status ON fhir.diagnostic_report(status);
CREATE INDEX idx_diagnostic_report_issued ON fhir.diagnostic_report(issued);
CREATE INDEX idx_diagnostic_report_effective ON fhir.diagnostic_report(effective_datetime);
CREATE INDEX idx_diagnostic_report_category ON fhir.diagnostic_report USING gin(category);
CREATE INDEX idx_diagnostic_report_code ON fhir.diagnostic_report USING gin(code);

-- Procedure table
CREATE TABLE fhir.procedure (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Identifiers
    procedure_id VARCHAR(50),
    
    -- References
    patient_id UUID NOT NULL,
    encounter_id UUID,
    performer_practitioner_id UUID,
    service_request_id UUID,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'preparation',
    status_reason JSONB,
    
    -- Classification
    category JSONB,
    code JSONB NOT NULL,
    
    -- Timeline
    performed_datetime TIMESTAMP WITH TIME ZONE,
    performed_period JSONB,
    performed_string TEXT,
    performed_age JSONB,
    performed_range JSONB,
    
    -- Clinical details
    reason_code JSONB,
    reason_reference UUID[],
    body_site JSONB,
    outcome JSONB,
    report_reference UUID[],
    complication JSONB,
    complication_detail UUID[],
    follow_up JSONB,
    
    -- Devices and materials
    used_reference UUID[],
    used_code JSONB,
    
    -- Location
    location_id UUID,
    
    -- Notes
    note JSONB,
    
    CONSTRAINT valid_procedure_status CHECK (status IN (
        'preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'entered-in-error', 'unknown'
    ))
);

-- Procedure indexes
CREATE INDEX idx_procedure_patient ON fhir.procedure(patient_id);
CREATE INDEX idx_procedure_encounter ON fhir.procedure(encounter_id);
CREATE INDEX idx_procedure_performer ON fhir.procedure(performer_practitioner_id);
CREATE INDEX idx_procedure_service_request ON fhir.procedure(service_request_id);
CREATE INDEX idx_procedure_status ON fhir.procedure(status);
CREATE INDEX idx_procedure_performed ON fhir.procedure(performed_datetime);
CREATE INDEX idx_procedure_code ON fhir.procedure USING gin(code);
CREATE INDEX idx_procedure_category ON fhir.procedure USING gin(category);

-- =====================================================
-- Communication Resources
-- =====================================================

-- Communication table
CREATE TABLE fhir.communication (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Identifiers
    communication_id VARCHAR(50),
    
    -- References
    patient_id UUID,
    encounter_id UUID,
    sender_practitioner_id UUID,
    
    -- Recipients
    recipient_practitioner_ids UUID[],
    recipient_patient_id UUID,
    recipient_organization_id UUID,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'preparation',
    status_reason JSONB,
    
    -- Classification
    category JSONB,
    priority VARCHAR(20) DEFAULT 'routine',
    medium JSONB,
    
    -- Timeline
    sent TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    received TIMESTAMP WITH TIME ZONE,
    
    -- Content
    topic JSONB,
    about_reference UUID[],
    payload JSONB,
    
    -- Clinical context
    reason_code JSONB,
    reason_reference UUID[],
    
    -- Notes
    note JSONB,
    
    CONSTRAINT valid_communication_status CHECK (status IN (
        'preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'entered-in-error', 'unknown'
    )),
    CONSTRAINT valid_communication_priority CHECK (priority IN ('routine', 'urgent', 'asap', 'stat'))
);

-- Communication indexes
CREATE INDEX idx_communication_patient ON fhir.communication(patient_id);
CREATE INDEX idx_communication_encounter ON fhir.communication(encounter_id);
CREATE INDEX idx_communication_sender ON fhir.communication(sender_practitioner_id);
CREATE INDEX idx_communication_status ON fhir.communication(status);
CREATE INDEX idx_communication_priority ON fhir.communication(priority);
CREATE INDEX idx_communication_sent ON fhir.communication(sent);
CREATE INDEX idx_communication_category ON fhir.communication USING gin(category);

-- =====================================================
-- Scheduling Resources
-- =====================================================

-- Appointment table
CREATE TABLE fhir.appointment (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Identifiers
    appointment_id VARCHAR(50) UNIQUE,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'proposed',
    cancellation_reason JSONB,
    
    -- Classification
    service_category JSONB,
    service_type JSONB,
    specialty JSONB,
    appointment_type JSONB,
    
    -- Clinical context
    reason_code JSONB,
    reason_reference UUID[],
    indication UUID[],
    
    -- Priority and description
    priority INTEGER DEFAULT 5,
    description TEXT,
    
    -- Supporting information
    supporting_information UUID[],
    
    -- Timeline
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    minutes_duration INTEGER,
    
    -- Slots
    slot_ids UUID[],
    
    -- Creation info
    created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Comments
    comment TEXT,
    patient_instruction TEXT,
    
    -- Location
    location_id UUID,
    
    CONSTRAINT valid_appointment_status CHECK (status IN (
        'proposed', 'pending', 'booked', 'arrived', 'fulfilled', 'cancelled', 'noshow', 'entered-in-error', 'checked-in', 'waitlist'
    )),
    CONSTRAINT valid_appointment_times CHECK (start_time < end_time),
    CONSTRAINT valid_appointment_priority CHECK (priority BETWEEN 1 AND 9)
);

-- Appointment indexes
CREATE UNIQUE INDEX idx_appointment_id ON fhir.appointment(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX idx_appointment_status ON fhir.appointment(status);
CREATE INDEX idx_appointment_start_time ON fhir.appointment(start_time);
CREATE INDEX idx_appointment_end_time ON fhir.appointment(end_time);
CREATE INDEX idx_appointment_location ON fhir.appointment(location_id);
CREATE INDEX idx_appointment_service_type ON fhir.appointment USING gin(service_type);
CREATE INDEX idx_appointment_date_status ON fhir.appointment(DATE(start_time), status);

-- AppointmentParticipant table (for many-to-many relationship)
CREATE TABLE fhir.appointment_participant (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL REFERENCES fhir.appointment(id) ON DELETE CASCADE,
    
    -- Participant reference (one of these will be populated)
    patient_id UUID,
    practitioner_id UUID,
    related_person_id UUID,
    device_id UUID,
    healthcare_service_id UUID,
    location_id UUID,
    
    -- Participant details
    participant_type JSONB,
    required_status VARCHAR(20) DEFAULT 'required',
    participation_status VARCHAR(20) NOT NULL DEFAULT 'needs-action',
    
    -- Timeline
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_participant_required CHECK (required_status IN ('required', 'optional', 'information-only')),
    CONSTRAINT valid_participant_participation_status CHECK (participation_status IN (
        'accepted', 'declined', 'tentative', 'needs-action'
    )),
    CONSTRAINT participant_reference_check CHECK (
        (patient_id IS NOT NULL)::int + 
        (practitioner_id IS NOT NULL)::int + 
        (related_person_id IS NOT NULL)::int + 
        (device_id IS NOT NULL)::int + 
        (healthcare_service_id IS NOT NULL)::int + 
        (location_id IS NOT NULL)::int = 1
    )
);

-- AppointmentParticipant indexes
CREATE INDEX idx_appointment_participant_appointment ON fhir.appointment_participant(appointment_id);
CREATE INDEX idx_appointment_participant_patient ON fhir.appointment_participant(patient_id);
CREATE INDEX idx_appointment_participant_practitioner ON fhir.appointment_participant(practitioner_id);
CREATE INDEX idx_appointment_participant_status ON fhir.appointment_participant(participation_status);

-- Schedule table
CREATE TABLE fhir.schedule (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Identifiers
    schedule_id VARCHAR(50),
    
    -- References (one of these will be populated)
    practitioner_id UUID,
    practitioner_role_id UUID,
    healthcare_service_id UUID,
    location_id UUID,
    device_id UUID,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    
    -- Classification
    service_category JSONB,
    service_type JSONB,
    specialty JSONB,
    
    -- Timeline
    planning_horizon JSONB,
    
    -- Comments
    comment TEXT,
    
    CONSTRAINT schedule_actor_check CHECK (
        (practitioner_id IS NOT NULL)::int + 
        (practitioner_role_id IS NOT NULL)::int + 
        (healthcare_service_id IS NOT NULL)::int + 
        (location_id IS NOT NULL)::int + 
        (device_id IS NOT NULL)::int = 1
    )
);

-- Schedule indexes
CREATE INDEX idx_schedule_practitioner ON fhir.schedule(practitioner_id);
CREATE INDEX idx_schedule_location ON fhir.schedule(location_id);
CREATE INDEX idx_schedule_active ON fhir.schedule(active);
CREATE INDEX idx_schedule_service_type ON fhir.schedule USING gin(service_type);

-- Slot table
CREATE TABLE fhir.slot (
    id UUID PRIMARY KEY REFERENCES fhir.resource_base(id),
    
    -- Identifiers
    slot_id VARCHAR(50),
    
    -- References
    schedule_id UUID NOT NULL,
    
    -- Classification
    service_category JSONB,
    service_type JSONB,
    specialty JSONB,
    appointment_type JSONB,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'free',
    
    -- Timeline
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Overbooked indicator
    overbooked BOOLEAN DEFAULT FALSE,
    
    -- Comments
    comment TEXT,
    
    CONSTRAINT valid_slot_status CHECK (status IN ('busy', 'free', 'busy-unavailable', 'busy-tentative', 'entered-in-error')),
    CONSTRAINT valid_slot_times CHECK (start_time < end_time)
);

-- Slot indexes
CREATE INDEX idx_slot_schedule ON fhir.slot(schedule_id);
CREATE INDEX idx_slot_status ON fhir.slot(status);
CREATE INDEX idx_slot_start_time ON fhir.slot(start_time);
CREATE INDEX idx_slot_end_time ON fhir.slot(end_time);
CREATE INDEX idx_slot_date_status ON fhir.slot(DATE(start_time), status);
CREATE INDEX idx_slot_service_type ON fhir.slot USING gin(service_type);

-- Add triggers for workflow tables
DO $$
DECLARE
    table_name TEXT;
    table_names TEXT[] := ARRAY[
        'fhir.care_plan', 'fhir.goal', 'fhir.task', 'fhir.service_request',
        'fhir.diagnostic_report', 'fhir.procedure', 'fhir.communication',
        'fhir.appointment', 'fhir.schedule', 'fhir.slot'
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
COMMENT ON TABLE fhir.care_plan IS 'Patient care plans with goals and activities';
COMMENT ON TABLE fhir.goal IS 'Patient care goals and targets';
COMMENT ON TABLE fhir.task IS 'Workflow tasks and assignments';
COMMENT ON TABLE fhir.service_request IS 'Orders for labs, imaging, and procedures';
COMMENT ON TABLE fhir.diagnostic_report IS 'Results reports from diagnostic services';
COMMENT ON TABLE fhir.procedure IS 'Procedures performed on patients';
COMMENT ON TABLE fhir.communication IS 'Clinical communications and messages';
COMMENT ON TABLE fhir.appointment IS 'Patient appointments and scheduling';
COMMENT ON TABLE fhir.appointment_participant IS 'Appointment participants and their roles';
COMMENT ON TABLE fhir.schedule IS 'Provider schedules and availability';
COMMENT ON TABLE fhir.slot IS 'Available time slots for appointments';