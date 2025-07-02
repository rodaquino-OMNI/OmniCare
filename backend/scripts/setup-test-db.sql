-- OmniCare Test Database Setup Script
-- This script sets up the initial schema and tables for testing

-- Create schemas if they don't exist
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS admin;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set search path
SET search_path TO public, audit;

-- Create enum types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'SYSTEM_ADMINISTRATOR',
        'HEALTHCARE_ADMINISTRATOR', 
        'PROVIDER',
        'NURSE',
        'MEDICAL_ASSISTANT',
        'FRONT_DESK',
        'BILLING_SPECIALIST',
        'PATIENT',
        'CAREGIVER',
        'INSURANCE_REVIEWER',
        'CLINICAL_RESEARCHER',
        'PHARMACY_TECH',
        'LAB_TECH',
        'QUALITY_ANALYST',
        'COMPLIANCE_OFFICER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM (
        'CREATE',
        'READ',
        'UPDATE',
        'DELETE',
        'LOGIN',
        'LOGOUT',
        'ACCESS_DENIED',
        'EXPORT',
        'PRINT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create audit log table in audit schema
CREATE TABLE IF NOT EXISTS audit.audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    session_id UUID REFERENCES public.sessions(id),
    action audit_action NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create patients table (simplified for testing)
CREATE TABLE IF NOT EXISTS patients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    mrn VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20),
    email VARCHAR(255),
    phone VARCHAR(20),
    address JSONB,
    emergency_contact JSONB,
    insurance_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(id),
    provider_id UUID NOT NULL REFERENCES users(id),
    appointment_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_provider_id ON appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to tables
DO $$ 
BEGIN
    -- Users table
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Patients table
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_patients_updated_at') THEN
        CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Appointments table
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_appointments_updated_at') THEN
        CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Insert test data for development/testing
-- Only insert if tables are empty
INSERT INTO users (username, email, password_hash, first_name, last_name, role)
SELECT 'admin@test.omnicare.com', 'admin@test.omnicare.com', 
       '$2b$10$XQq2o2Y8XU5JGEJ3qVpXkOZKKK2mTTHmMNoxHNYAMWiUUjVHFSZlK', -- Test123!@#
       'Test', 'Admin', 'SYSTEM_ADMINISTRATOR'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@test.omnicare.com');

INSERT INTO users (username, email, password_hash, first_name, last_name, role)
SELECT 'provider@test.omnicare.com', 'provider@test.omnicare.com',
       '$2b$10$XQq2o2Y8XU5JGEJ3qVpXkOZKKK2mTTHmMNoxHNYAMWiUUjVHFSZlK', -- Test123!@#
       'Dr. Test', 'Provider', 'PROVIDER'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'provider@test.omnicare.com');

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO omnicare;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA audit TO omnicare;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO omnicare;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA audit TO omnicare;

-- Display setup summary
DO $$
BEGIN
    RAISE NOTICE 'Test database setup completed!';
    RAISE NOTICE 'Created schemas: public, audit';
    RAISE NOTICE 'Created tables: users, sessions, patients, appointments, audit_logs';
    RAISE NOTICE 'Created test users: admin@test.omnicare.com, provider@test.omnicare.com';
    RAISE NOTICE 'Password for test users: Test123!@#';
END $$;