-- =====================================================
-- OmniCare EMR - Audit and Security Schema
-- Author: Database Integration Developer
-- Purpose: Comprehensive audit logging and security features
-- =====================================================

-- =====================================================
-- Audit Schema Setup
-- =====================================================

-- User sessions and authentication
CREATE TABLE audit.user_session (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    session_id VARCHAR(128) UNIQUE NOT NULL,
    
    -- Session details
    login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Authentication method
    auth_method VARCHAR(50) NOT NULL DEFAULT 'password',
    two_factor_used BOOLEAN DEFAULT FALSE,
    
    -- Session context
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(128),
    
    -- Location data
    location_country VARCHAR(2),
    location_region VARCHAR(100),
    location_city VARCHAR(100),
    
    -- Session status
    session_status VARCHAR(20) DEFAULT 'active',
    termination_reason VARCHAR(50),
    
    -- Security flags
    suspicious_activity BOOLEAN DEFAULT FALSE,
    concurrent_sessions INTEGER DEFAULT 1,
    
    CONSTRAINT valid_session_status CHECK (session_status IN ('active', 'expired', 'terminated', 'locked'))
);

-- Session indexes
CREATE INDEX idx_user_session_user_id ON audit.user_session(user_id);
CREATE INDEX idx_user_session_session_id ON audit.user_session(session_id);
CREATE INDEX idx_user_session_login_time ON audit.user_session(login_time);
CREATE INDEX idx_user_session_status ON audit.user_session(session_status);
CREATE INDEX idx_user_session_ip ON audit.user_session(ip_address);

-- Comprehensive audit log
CREATE TABLE audit.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Timestamp and session
    event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(128),
    user_id UUID,
    
    -- Event classification
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    event_action VARCHAR(100) NOT NULL,
    
    -- Resource information
    resource_type VARCHAR(50),
    resource_id UUID,
    patient_id UUID, -- Always capture for patient-related events
    
    -- Event details
    event_description TEXT,
    event_outcome VARCHAR(20) DEFAULT 'success',
    failure_reason TEXT,
    
    -- Technical details
    ip_address INET,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_url TEXT,
    request_payload JSONB,
    response_status INTEGER,
    response_time_ms INTEGER,
    
    -- Before/after data for changes
    data_before JSONB,
    data_after JSONB,
    
    -- Additional context
    additional_context JSONB,
    
    -- Compliance and security
    hipaa_compliant BOOLEAN DEFAULT TRUE,
    security_level VARCHAR(20) DEFAULT 'normal',
    requires_review BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT valid_event_outcome CHECK (event_outcome IN ('success', 'failure', 'partial', 'error')),
    CONSTRAINT valid_security_level CHECK (security_level IN ('low', 'normal', 'high', 'critical'))
);

-- Partition audit.activity_log by month for performance
CREATE TABLE audit.activity_log_y2024m01 PARTITION OF audit.activity_log
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE audit.activity_log_y2024m02 PARTITION OF audit.activity_log
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE audit.activity_log_y2024m03 PARTITION OF audit.activity_log
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE audit.activity_log_y2024m04 PARTITION OF audit.activity_log
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE audit.activity_log_y2024m05 PARTITION OF audit.activity_log
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE audit.activity_log_y2024m06 PARTITION OF audit.activity_log
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE audit.activity_log_y2024m07 PARTITION OF audit.activity_log
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE audit.activity_log_y2024m08 PARTITION OF audit.activity_log
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE audit.activity_log_y2024m09 PARTITION OF audit.activity_log
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE audit.activity_log_y2024m10 PARTITION OF audit.activity_log
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE audit.activity_log_y2024m11 PARTITION OF audit.activity_log
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE audit.activity_log_y2024m12 PARTITION OF audit.activity_log
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Activity log indexes
CREATE INDEX idx_activity_log_event_time ON audit.activity_log(event_time);
CREATE INDEX idx_activity_log_user_id ON audit.activity_log(user_id);
CREATE INDEX idx_activity_log_session_id ON audit.activity_log(session_id);
CREATE INDEX idx_activity_log_patient_id ON audit.activity_log(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_activity_log_event_type ON audit.activity_log(event_type);
CREATE INDEX idx_activity_log_event_category ON audit.activity_log(event_category);
CREATE INDEX idx_activity_log_resource ON audit.activity_log(resource_type, resource_id);
CREATE INDEX idx_activity_log_security_level ON audit.activity_log(security_level) WHERE security_level IN ('high', 'critical');
CREATE INDEX idx_activity_log_requires_review ON audit.activity_log(requires_review) WHERE requires_review = TRUE;

-- HIPAA-specific access tracking
CREATE TABLE audit.patient_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Access details
    access_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    
    -- Access context
    access_type VARCHAR(50) NOT NULL,
    access_reason VARCHAR(100),
    legitimate_relationship BOOLEAN DEFAULT TRUE,
    
    -- Technical details
    session_id VARCHAR(128),
    ip_address INET,
    
    -- Data accessed
    resources_accessed JSONB,
    fields_accessed TEXT[],
    
    -- Duration
    session_duration_seconds INTEGER,
    
    -- Compliance flags
    emergency_access BOOLEAN DEFAULT FALSE,
    break_glass_access BOOLEAN DEFAULT FALSE,
    authorized_access BOOLEAN DEFAULT TRUE,
    
    -- Review status
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    
    CONSTRAINT valid_access_type CHECK (access_type IN (
        'view', 'create', 'update', 'delete', 'print', 'export', 'search', 'query'
    ))
);

-- Patient access log indexes
CREATE INDEX idx_patient_access_log_access_time ON audit.patient_access_log(access_time);
CREATE INDEX idx_patient_access_log_user_id ON audit.patient_access_log(user_id);
CREATE INDEX idx_patient_access_log_patient_id ON audit.patient_access_log(patient_id);
CREATE INDEX idx_patient_access_log_emergency ON audit.patient_access_log(emergency_access) WHERE emergency_access = TRUE;
CREATE INDEX idx_patient_access_log_break_glass ON audit.patient_access_log(break_glass_access) WHERE break_glass_access = TRUE;
CREATE INDEX idx_patient_access_log_unauthorized ON audit.patient_access_log(authorized_access) WHERE authorized_access = FALSE;
CREATE INDEX idx_patient_access_log_review ON audit.patient_access_log(reviewed) WHERE reviewed = FALSE;

-- Data modification tracking
CREATE TABLE audit.data_modification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Modification details
    modification_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    session_id VARCHAR(128),
    
    -- Target resource
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    patient_id UUID, -- If applicable
    
    -- Modification type
    operation_type VARCHAR(10) NOT NULL,
    
    -- Data changes
    field_changes JSONB NOT NULL,
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    reason_for_change TEXT,
    business_justification TEXT,
    
    -- Technical details
    application_name VARCHAR(100),
    ip_address INET,
    
    -- Compliance
    requires_patient_notification BOOLEAN DEFAULT FALSE,
    patient_notified BOOLEAN DEFAULT FALSE,
    notification_date TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_operation_type CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE', 'RESTORE'))
);

-- Data modification log indexes
CREATE INDEX idx_data_modification_log_time ON audit.data_modification_log(modification_time);
CREATE INDEX idx_data_modification_log_user_id ON audit.data_modification_log(user_id);
CREATE INDEX idx_data_modification_log_table_record ON audit.data_modification_log(table_name, record_id);
CREATE INDEX idx_data_modification_log_patient_id ON audit.data_modification_log(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_data_modification_log_operation ON audit.data_modification_log(operation_type);

-- =====================================================
-- Security and Access Control
-- =====================================================

-- Role-based access control
CREATE TABLE admin.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    
    -- Role scope
    scope_type VARCHAR(20) DEFAULT 'global',
    scope_organization_id UUID,
    scope_location_id UUID,
    scope_department VARCHAR(100),
    
    -- Validity
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE,
    active BOOLEAN DEFAULT TRUE,
    
    -- Assignment details
    assigned_by UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assignment_reason TEXT,
    
    -- Review
    last_reviewed DATE,
    next_review_due DATE,
    
    CONSTRAINT valid_scope_type CHECK (scope_type IN ('global', 'organization', 'location', 'department')),
    CONSTRAINT valid_role_name CHECK (role_name IN (
        'physician', 'nurse', 'admin_staff', 'pharmacist', 'lab_tech', 'radiology_tech',
        'system_admin', 'security_admin', 'compliance_officer', 'patient'
    ))
);

-- User roles indexes
CREATE INDEX idx_user_roles_user_id ON admin.user_roles(user_id);
CREATE INDEX idx_user_roles_role_name ON admin.user_roles(role_name);
CREATE INDEX idx_user_roles_active ON admin.user_roles(active) WHERE active = TRUE;
CREATE INDEX idx_user_roles_expiration ON admin.user_roles(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX idx_user_roles_review ON admin.user_roles(next_review_due) WHERE next_review_due IS NOT NULL;

-- Permission definitions
CREATE TABLE admin.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    permission_category VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- Resource and action
    resource_type VARCHAR(50),
    action_type VARCHAR(50),
    
    -- Risk level
    risk_level VARCHAR(20) DEFAULT 'medium',
    requires_justification BOOLEAN DEFAULT FALSE,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT valid_risk_level CHECK (risk_level IN ('low', 'medium', 'high', 'critical'))
);

-- Role permissions mapping
CREATE TABLE admin.role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name VARCHAR(50) NOT NULL,
    permission_id UUID NOT NULL REFERENCES admin.permissions(id),
    
    -- Permission scope
    scope_conditions JSONB,
    
    -- Validity
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE,
    active BOOLEAN DEFAULT TRUE,
    
    -- Assignment
    assigned_by UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(role_name, permission_id)
);

-- Data encryption settings
CREATE TABLE admin.encryption_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_name VARCHAR(100) UNIQUE NOT NULL,
    key_purpose VARCHAR(50) NOT NULL,
    
    -- Key details
    key_algorithm VARCHAR(50) NOT NULL DEFAULT 'AES-256',
    key_size INTEGER NOT NULL DEFAULT 256,
    
    -- Key lifecycle
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expiration_date TIMESTAMP WITH TIME ZONE,
    
    -- Key rotation
    rotation_schedule VARCHAR(50),
    last_rotated TIMESTAMP WITH TIME ZONE,
    next_rotation TIMESTAMP WITH TIME ZONE,
    
    -- Status
    key_status VARCHAR(20) DEFAULT 'active',
    
    -- Encrypted key data (actual keys stored in secure key management system)
    key_reference VARCHAR(500) NOT NULL, -- Reference to external key store
    
    CONSTRAINT valid_key_status CHECK (key_status IN ('active', 'rotating', 'deprecated', 'revoked'))
);

-- Data classification
CREATE TABLE admin.data_classification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Resource identification
    table_name VARCHAR(100) NOT NULL,
    column_name VARCHAR(100),
    
    -- Classification
    classification_level VARCHAR(20) NOT NULL,
    data_category VARCHAR(50) NOT NULL,
    
    -- Handling requirements
    encryption_required BOOLEAN DEFAULT FALSE,
    encryption_key_id UUID REFERENCES admin.encryption_keys(id),
    
    -- Access controls
    restricted_access BOOLEAN DEFAULT FALSE,
    access_roles TEXT[],
    access_conditions JSONB,
    
    -- Retention
    retention_period_years INTEGER,
    purge_after_retention BOOLEAN DEFAULT FALSE,
    
    -- Compliance
    hipaa_phi BOOLEAN DEFAULT FALSE,
    pci_data BOOLEAN DEFAULT FALSE,
    pii_data BOOLEAN DEFAULT FALSE,
    
    -- Audit requirements
    access_logging_required BOOLEAN DEFAULT TRUE,
    modification_logging_required BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT valid_classification_level CHECK (classification_level IN (
        'public', 'internal', 'confidential', 'restricted', 'top_secret'
    ))
);

-- Data classification indexes
CREATE INDEX idx_data_classification_table ON admin.data_classification(table_name);
CREATE INDEX idx_data_classification_level ON admin.data_classification(classification_level);
CREATE INDEX idx_data_classification_hipaa ON admin.data_classification(hipaa_phi) WHERE hipaa_phi = TRUE;
CREATE INDEX idx_data_classification_encryption ON admin.data_classification(encryption_required) WHERE encryption_required = TRUE;

-- =====================================================
-- Automated Audit Functions
-- =====================================================

-- Function to log user activity
CREATE OR REPLACE FUNCTION audit.log_user_activity(
    p_user_id UUID,
    p_session_id VARCHAR(128),
    p_event_type VARCHAR(50),
    p_event_category VARCHAR(50),
    p_event_action VARCHAR(100),
    p_resource_type VARCHAR(50) DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_patient_id UUID DEFAULT NULL,
    p_event_description TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_additional_context JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO audit.activity_log (
        user_id, session_id, event_type, event_category, event_action,
        resource_type, resource_id, patient_id, event_description,
        ip_address, user_agent, additional_context
    ) VALUES (
        p_user_id, p_session_id, p_event_type, p_event_category, p_event_action,
        p_resource_type, p_resource_id, p_patient_id, p_event_description,
        p_ip_address, p_user_agent, p_additional_context
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log patient access
CREATE OR REPLACE FUNCTION audit.log_patient_access(
    p_user_id UUID,
    p_patient_id UUID,
    p_access_type VARCHAR(50),
    p_session_id VARCHAR(128) DEFAULT NULL,
    p_access_reason VARCHAR(100) DEFAULT NULL,
    p_emergency_access BOOLEAN DEFAULT FALSE,
    p_resources_accessed JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO audit.patient_access_log (
        user_id, patient_id, access_type, session_id, access_reason,
        emergency_access, resources_accessed, ip_address
    ) VALUES (
        p_user_id, p_patient_id, p_access_type, p_session_id, p_access_reason,
        p_emergency_access, p_resources_accessed, p_ip_address
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check user permissions
CREATE OR REPLACE FUNCTION admin.check_user_permission(
    p_user_id UUID,
    p_permission_name VARCHAR(100),
    p_resource_context JSONB DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := FALSE;
    user_role RECORD;
BEGIN
    -- Check if user has required permission through any of their active roles
    FOR user_role IN 
        SELECT ur.role_name
        FROM admin.user_roles ur
        JOIN admin.role_permissions rp ON ur.role_name = rp.role_name
        JOIN admin.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = p_user_id
          AND ur.active = TRUE
          AND (ur.expiration_date IS NULL OR ur.expiration_date > CURRENT_DATE)
          AND rp.active = TRUE
          AND (rp.expiration_date IS NULL OR rp.expiration_date > CURRENT_DATE)
          AND p.permission_name = p_permission_name
          AND p.active = TRUE
    LOOP
        has_permission := TRUE;
        EXIT; -- Found permission, exit loop
    END LOOP;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for automatic audit logging on data changes
CREATE OR REPLACE FUNCTION audit.trigger_data_modification_log()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    current_session_id VARCHAR(128);
    field_changes JSONB := '{}';
    old_values JSONB := '{}';
    new_values JSONB := '{}';
    patient_id_value UUID;
BEGIN
    -- Get current user context (would be set by application)
    current_user_id := current_setting('app.current_user_id', true)::UUID;
    current_session_id := current_setting('app.current_session_id', true);
    
    -- Extract patient_id if the table has it
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        IF (NEW.*) ? 'patient_id' THEN
            patient_id_value := (row_to_json(NEW)->>'patient_id')::UUID;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF (OLD.*) ? 'patient_id' THEN
            patient_id_value := (row_to_json(OLD)->>'patient_id')::UUID;
        END IF;
    END IF;
    
    -- Build field changes JSON
    IF TG_OP = 'UPDATE' THEN
        old_values := row_to_json(OLD);
        new_values := row_to_json(NEW);
        
        -- Compare fields and build change summary
        SELECT jsonb_object_agg(key, jsonb_build_object('old', old_values->key, 'new', new_values->key))
        INTO field_changes
        FROM jsonb_each(old_values) o(key, value)
        WHERE old_values->key IS DISTINCT FROM new_values->key;
    ELSIF TG_OP = 'INSERT' THEN
        new_values := row_to_json(NEW);
        field_changes := jsonb_build_object('operation', 'insert', 'new_record', new_values);
    ELSIF TG_OP = 'DELETE' THEN
        old_values := row_to_json(OLD);
        field_changes := jsonb_build_object('operation', 'delete', 'deleted_record', old_values);
    END IF;
    
    -- Log the modification
    INSERT INTO audit.data_modification_log (
        user_id, session_id, table_name, record_id, patient_id,
        operation_type, field_changes, old_values, new_values
    ) VALUES (
        current_user_id, current_session_id, TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
        COALESCE((row_to_json(NEW)->>'id')::UUID, (row_to_json(OLD)->>'id')::UUID),
        patient_id_value, TG_OP, field_changes, old_values, new_values
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON SCHEMA audit IS 'Comprehensive audit logging for compliance and security';
COMMENT ON TABLE audit.user_session IS 'User authentication sessions and activity tracking';
COMMENT ON TABLE audit.activity_log IS 'Comprehensive system activity and event logging';
COMMENT ON TABLE audit.patient_access_log IS 'HIPAA-compliant patient data access tracking';
COMMENT ON TABLE audit.data_modification_log IS 'Complete audit trail of data modifications';
COMMENT ON TABLE admin.user_roles IS 'Role-based access control assignments';
COMMENT ON TABLE admin.permissions IS 'System permission definitions';
COMMENT ON TABLE admin.role_permissions IS 'Role to permission mappings';
COMMENT ON TABLE admin.encryption_keys IS 'Data encryption key management';
COMMENT ON TABLE admin.data_classification IS 'Data classification and handling requirements';