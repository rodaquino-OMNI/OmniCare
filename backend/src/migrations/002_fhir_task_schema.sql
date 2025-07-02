-- Migration: 002_fhir_task_schema
-- Description: FHIR Task storage with workflow tracking and assignment management
-- Author: Database Architect
-- Date: 2025-01-17

-- Create schema for task management
CREATE SCHEMA IF NOT EXISTS task_management;
CREATE SCHEMA IF NOT EXISTS workflow_audit;

-- Main FHIR Task table
CREATE TABLE IF NOT EXISTS task_management.tasks (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- FHIR resource metadata
    resource_type VARCHAR(50) DEFAULT 'Task' NOT NULL,
    version_id INTEGER DEFAULT 1 NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Task status and lifecycle
    status VARCHAR(50) NOT NULL CHECK (
        status IN ('draft', 'requested', 'received', 'accepted', 'rejected', 
                  'ready', 'cancelled', 'in-progress', 'on-hold', 'failed', 
                  'completed', 'entered-in-error')
    ),
    status_reason JSONB,
    business_status JSONB,
    
    -- Task intent and priority
    intent VARCHAR(50) NOT NULL CHECK (
        intent IN ('unknown', 'proposal', 'plan', 'order', 'original-order',
                  'reflex-order', 'filler-order', 'instance-order', 'option')
    ),
    priority VARCHAR(20) CHECK (
        priority IN ('routine', 'urgent', 'asap', 'stat')
    ),
    
    -- Task code and description
    code JSONB NOT NULL, -- CodeableConcept
    description TEXT,
    focus_reference VARCHAR(255), -- Reference to the focus resource
    for_patient_id UUID, -- Direct reference to patient
    
    -- Task context
    encounter_id UUID,
    execution_period_start TIMESTAMP WITH TIME ZONE,
    execution_period_end TIMESTAMP WITH TIME ZONE,
    authored_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Task requestor and owner
    requester_reference VARCHAR(255),
    requester_type VARCHAR(50), -- Practitioner, Organization, Patient, etc.
    requester_id UUID,
    
    owner_reference VARCHAR(255),
    owner_type VARCHAR(50),
    owner_id UUID,
    
    -- Task assignment
    performer_type JSONB, -- CodeableConcept[]
    location_reference VARCHAR(255),
    
    -- Task reason and notes
    reason_code JSONB, -- CodeableConcept
    reason_reference VARCHAR(255),
    insurance JSONB, -- Reference[]
    note JSONB, -- Annotation[]
    
    -- Task constraints
    restriction JSONB, -- { repetitions: number, period: Period, recipients: Reference[] }
    
    -- Task input/output
    input JSONB DEFAULT '[]'::jsonb, -- Array of { type: CodeableConcept, value: any }
    output JSONB DEFAULT '[]'::jsonb, -- Array of { type: CodeableConcept, value: any }
    
    -- OmniCare extensions
    workflow_id UUID,
    parent_task_id UUID,
    task_template_id UUID,
    estimated_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,
    
    -- Assignment tracking
    assigned_to_user_id UUID,
    assigned_to_role VARCHAR(100),
    assigned_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Performance metrics
    sla_due_date TIMESTAMP WITH TIME ZONE,
    is_overdue BOOLEAN GENERATED ALWAYS AS (
        CASE 
            WHEN status IN ('completed', 'cancelled', 'failed', 'entered-in-error') THEN false
            WHEN sla_due_date IS NULL THEN false
            ELSE CURRENT_TIMESTAMP > sla_due_date
        END
    ) STORED,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    
    -- Data integrity constraints
    CONSTRAINT chk_execution_period CHECK (
        execution_period_end IS NULL OR execution_period_end >= execution_period_start
    ),
    CONSTRAINT chk_task_lifecycle CHECK (
        (status = 'completed' AND completed_at IS NOT NULL) OR
        (status != 'completed' AND completed_at IS NULL)
    )
);

-- Task assignments table for tracking assignment history
CREATE TABLE IF NOT EXISTS task_management.task_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES task_management.tasks(id) ON DELETE CASCADE,
    assigned_to_user_id UUID,
    assigned_to_role VARCHAR(100),
    assigned_by_user_id UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    unassigned_at TIMESTAMP WITH TIME ZONE,
    assignment_reason TEXT,
    assignment_type VARCHAR(50) CHECK (
        assignment_type IN ('initial', 'reassignment', 'escalation', 'delegation')
    ),
    is_current BOOLEAN DEFAULT true NOT NULL,
    
    CONSTRAINT chk_assignment_user_or_role CHECK (
        assigned_to_user_id IS NOT NULL OR assigned_to_role IS NOT NULL
    )
);

-- Task status transitions table
CREATE TABLE IF NOT EXISTS task_management.task_status_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES task_management.tasks(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    transition_reason TEXT,
    transitioned_by UUID NOT NULL,
    transitioned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    duration_in_status_minutes INTEGER
);

-- Task dependencies table
CREATE TABLE IF NOT EXISTS task_management.task_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES task_management.tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES task_management.tasks(id) ON DELETE RESTRICT,
    dependency_type VARCHAR(50) NOT NULL CHECK (
        dependency_type IN ('start-to-start', 'start-to-finish', 
                          'finish-to-start', 'finish-to-finish')
    ),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT unq_task_dependency UNIQUE(task_id, depends_on_task_id),
    CONSTRAINT chk_no_self_dependency CHECK (task_id != depends_on_task_id)
);

-- Task templates for recurring tasks
CREATE TABLE IF NOT EXISTS task_management.task_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(255) NOT NULL,
    template_code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    code JSONB NOT NULL,
    default_priority VARCHAR(20),
    default_performer_type JSONB,
    default_estimated_duration_minutes INTEGER,
    default_sla_minutes INTEGER,
    input_template JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Workflow definitions
CREATE TABLE IF NOT EXISTS task_management.workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_name VARCHAR(255) NOT NULL,
    workflow_code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    workflow_type VARCHAR(50) CHECK (
        workflow_type IN ('clinical', 'administrative', 'billing', 'quality')
    ),
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Workflow steps
CREATE TABLE IF NOT EXISTS task_management.workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES task_management.workflows(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    task_template_id UUID REFERENCES task_management.task_templates(id),
    step_name VARCHAR(255) NOT NULL,
    is_conditional BOOLEAN DEFAULT false NOT NULL,
    condition_expression JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT unq_workflow_step UNIQUE(workflow_id, step_number)
);

-- Workflow audit log
CREATE TABLE IF NOT EXISTS workflow_audit.task_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (
        action IN ('created', 'updated', 'assigned', 'unassigned', 'started', 
                  'completed', 'cancelled', 'failed', 'comment_added', 
                  'attachment_added', 'priority_changed')
    ),
    action_details JSONB,
    performed_by UUID NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    
    -- Partitioning by month for better performance
    partition_key DATE GENERATED ALWAYS AS (DATE_TRUNC('month', performed_at)) STORED
) PARTITION BY RANGE (partition_key);

-- Create partitions for the next 12 months
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..11 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'task_audit_log_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS workflow_audit.%I PARTITION OF workflow_audit.task_audit_log
            FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        
        start_date := end_date;
    END LOOP;
END $$;

-- Primary indexes for tasks
CREATE INDEX idx_tasks_status ON task_management.tasks(status);
CREATE INDEX idx_tasks_priority ON task_management.tasks(priority) WHERE priority IS NOT NULL;
CREATE INDEX idx_tasks_patient ON task_management.tasks(for_patient_id) WHERE for_patient_id IS NOT NULL;
CREATE INDEX idx_tasks_owner ON task_management.tasks(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_tasks_assigned_user ON task_management.tasks(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX idx_tasks_assigned_role ON task_management.tasks(assigned_to_role) WHERE assigned_to_role IS NOT NULL;
CREATE INDEX idx_tasks_workflow ON task_management.tasks(workflow_id) WHERE workflow_id IS NOT NULL;
CREATE INDEX idx_tasks_parent ON task_management.tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_tasks_overdue ON task_management.tasks(is_overdue) WHERE is_overdue = true;
CREATE INDEX idx_tasks_sla_due ON task_management.tasks(sla_due_date) WHERE sla_due_date IS NOT NULL;
CREATE INDEX idx_tasks_created_at ON task_management.tasks(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_tasks_status_priority ON task_management.tasks(status, priority);
CREATE INDEX idx_tasks_assigned_status ON task_management.tasks(assigned_to_user_id, status) 
    WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX idx_tasks_patient_status ON task_management.tasks(for_patient_id, status) 
    WHERE for_patient_id IS NOT NULL;

-- JSONB indexes
CREATE INDEX idx_tasks_code ON task_management.tasks USING GIN(code);
CREATE INDEX idx_tasks_input ON task_management.tasks USING GIN(input);
CREATE INDEX idx_tasks_output ON task_management.tasks USING GIN(output);

-- Assignment indexes
CREATE INDEX idx_assignments_task ON task_management.task_assignments(task_id);
CREATE INDEX idx_assignments_user ON task_management.task_assignments(assigned_to_user_id) 
    WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX idx_assignments_current ON task_management.task_assignments(task_id, is_current) 
    WHERE is_current = true;

-- Status transition indexes
CREATE INDEX idx_transitions_task ON task_management.task_status_transitions(task_id);
CREATE INDEX idx_transitions_date ON task_management.task_status_transitions(transitioned_at);

-- Dependency indexes
CREATE INDEX idx_dependencies_task ON task_management.task_dependencies(task_id);
CREATE INDEX idx_dependencies_depends_on ON task_management.task_dependencies(depends_on_task_id);

-- Audit log indexes
CREATE INDEX idx_audit_task ON workflow_audit.task_audit_log(task_id);
CREATE INDEX idx_audit_action ON workflow_audit.task_audit_log(action);
CREATE INDEX idx_audit_performed_by ON workflow_audit.task_audit_log(performed_by);
CREATE INDEX idx_audit_performed_at ON workflow_audit.task_audit_log(performed_at);

-- Functions for task management
CREATE OR REPLACE FUNCTION task_management.assign_task(
    p_task_id UUID,
    p_user_id UUID,
    p_role VARCHAR(100),
    p_assigned_by UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_assignment_id UUID;
BEGIN
    -- Mark current assignments as not current
    UPDATE task_management.task_assignments
    SET is_current = false, unassigned_at = CURRENT_TIMESTAMP
    WHERE task_id = p_task_id AND is_current = true;
    
    -- Create new assignment
    INSERT INTO task_management.task_assignments (
        task_id, assigned_to_user_id, assigned_to_role, 
        assigned_by_user_id, assignment_reason, assignment_type
    ) VALUES (
        p_task_id, p_user_id, p_role, p_assigned_by, p_reason,
        CASE 
            WHEN EXISTS (SELECT 1 FROM task_management.task_assignments WHERE task_id = p_task_id)
            THEN 'reassignment'
            ELSE 'initial'
        END
    );
    
    -- Update task table
    UPDATE task_management.tasks
    SET assigned_to_user_id = p_user_id,
        assigned_to_role = p_role,
        assigned_at = CURRENT_TIMESTAMP,
        updated_by = p_assigned_by::VARCHAR
    WHERE id = p_task_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to transition task status
CREATE OR REPLACE FUNCTION task_management.transition_task_status(
    p_task_id UUID,
    p_new_status VARCHAR(50),
    p_user_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_status VARCHAR(50);
    v_status_start TIMESTAMP WITH TIME ZONE;
    v_duration_minutes INTEGER;
BEGIN
    -- Get current status and when it started
    SELECT status, 
           COALESCE(
               (SELECT transitioned_at 
                FROM task_management.task_status_transitions 
                WHERE task_id = p_task_id 
                ORDER BY transitioned_at DESC 
                LIMIT 1),
               created_at
           )
    INTO v_current_status, v_status_start
    FROM task_management.tasks
    WHERE id = p_task_id;
    
    -- Calculate duration in current status
    v_duration_minutes := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_status_start)) / 60;
    
    -- Record transition
    INSERT INTO task_management.task_status_transitions (
        task_id, from_status, to_status, transition_reason,
        transitioned_by, duration_in_status_minutes
    ) VALUES (
        p_task_id, v_current_status, p_new_status, p_reason,
        p_user_id, v_duration_minutes
    );
    
    -- Update task status and related timestamps
    UPDATE task_management.tasks
    SET status = p_new_status,
        updated_by = p_user_id::VARCHAR,
        accepted_at = CASE 
            WHEN p_new_status = 'accepted' THEN CURRENT_TIMESTAMP 
            ELSE accepted_at 
        END,
        started_at = CASE 
            WHEN p_new_status = 'in-progress' THEN CURRENT_TIMESTAMP 
            ELSE started_at 
        END,
        completed_at = CASE 
            WHEN p_new_status = 'completed' THEN CURRENT_TIMESTAMP 
            ELSE completed_at 
        END
    WHERE id = p_task_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Materialized view for task performance metrics
CREATE MATERIALIZED VIEW task_management.task_performance_metrics AS
SELECT 
    t.assigned_to_user_id,
    t.assigned_to_role,
    DATE_TRUNC('day', t.created_at) as task_date,
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE t.status = 'completed') as completed_tasks,
    COUNT(*) FILTER (WHERE t.is_overdue) as overdue_tasks,
    AVG(t.actual_duration_minutes) FILTER (WHERE t.actual_duration_minutes IS NOT NULL) as avg_duration_minutes,
    AVG(
        CASE 
            WHEN t.status = 'completed' AND t.sla_due_date IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (t.completed_at - t.sla_due_date)) / 60
            ELSE NULL
        END
    ) as avg_sla_variance_minutes
FROM task_management.tasks t
WHERE t.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY t.assigned_to_user_id, t.assigned_to_role, DATE_TRUNC('day', t.created_at);

-- Index on performance metrics
CREATE INDEX idx_task_metrics_user ON task_management.task_performance_metrics(assigned_to_user_id);
CREATE INDEX idx_task_metrics_role ON task_management.task_performance_metrics(assigned_to_role);
CREATE INDEX idx_task_metrics_date ON task_management.task_performance_metrics(task_date);

-- Trigger for updating timestamps
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON task_management.tasks
    FOR EACH ROW EXECUTE FUNCTION patient_data.update_updated_at_column();

CREATE TRIGGER update_task_templates_updated_at BEFORE UPDATE ON task_management.task_templates
    FOR EACH ROW EXECUTE FUNCTION patient_data.update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON task_management.workflows
    FOR EACH ROW EXECUTE FUNCTION patient_data.update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE task_management.tasks IS 'FHIR Task resources with workflow management extensions';
COMMENT ON TABLE task_management.task_assignments IS 'Historical record of task assignments';
COMMENT ON TABLE task_management.task_status_transitions IS 'Audit trail of task status changes';
COMMENT ON TABLE workflow_audit.task_audit_log IS 'Comprehensive audit log for all task-related actions';

-- Grant permissions
GRANT USAGE ON SCHEMA task_management TO omnicare_app;
GRANT USAGE ON SCHEMA workflow_audit TO omnicare_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA task_management TO omnicare_app;
GRANT INSERT ON ALL TABLES IN SCHEMA workflow_audit TO omnicare_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA task_management TO omnicare_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA workflow_audit TO omnicare_app;