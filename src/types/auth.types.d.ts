export interface User {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    department?: string;
    licenseNumber?: string;
    npiNumber?: string;
    isActive: boolean;
    isMfaEnabled: boolean;
    mfaSecret?: string;
    lastLogin?: Date;
    passwordChangedAt: Date;
    failedLoginAttempts: number;
    accountLockedUntil?: Date;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum UserRole {
    PHYSICIAN = "physician",
    NURSING_STAFF = "nursing_staff",
    ADMINISTRATIVE_STAFF = "administrative_staff",
    SYSTEM_ADMINISTRATOR = "system_administrator",
    PHARMACIST = "pharmacist",
    LABORATORY_TECHNICIAN = "laboratory_technician",
    RADIOLOGY_TECHNICIAN = "radiology_technician",
    PATIENT = "patient"
}
export declare enum Permission {
    CREATE_CLINICAL_NOTES = "create_clinical_notes",
    EDIT_CLINICAL_NOTES = "edit_clinical_notes",
    VIEW_CLINICAL_NOTES = "view_clinical_notes",
    FINALIZE_CLINICAL_NOTES = "finalize_clinical_notes",
    CREATE_PRESCRIPTIONS = "create_prescriptions",
    MODIFY_PRESCRIPTIONS = "modify_prescriptions",
    VIEW_PRESCRIPTIONS = "view_prescriptions",
    VERIFY_PRESCRIPTIONS = "verify_prescriptions",
    DISPENSE_MEDICATIONS = "dispense_medications",
    VIEW_PATIENT_RECORDS = "view_patient_records",
    EDIT_PATIENT_RECORDS = "edit_patient_records",
    CREATE_PATIENT_RECORDS = "create_patient_records",
    VIEW_PATIENT_DEMOGRAPHICS = "view_patient_demographics",
    EDIT_PATIENT_DEMOGRAPHICS = "edit_patient_demographics",
    CREATE_MEDICAL_ORDERS = "create_medical_orders",
    VIEW_LAB_RESULTS = "view_lab_results",
    ENTER_LAB_RESULTS = "enter_lab_results",
    ACKNOWLEDGE_CRITICAL_RESULTS = "acknowledge_critical_results",
    SCHEDULE_APPOINTMENTS = "schedule_appointments",
    MANAGE_BILLING = "manage_billing",
    PROCESS_INSURANCE = "process_insurance",
    GENERATE_REPORTS = "generate_reports",
    MANAGE_USERS = "manage_users",
    CONFIGURE_SYSTEM = "configure_system",
    VIEW_AUDIT_LOGS = "view_audit_logs",
    MANAGE_SECURITY_SETTINGS = "manage_security_settings",
    PERFORM_IMAGING_STUDIES = "perform_imaging_studies",
    VIEW_IMAGING_RESULTS = "view_imaging_results",
    MANAGE_IMAGING_EQUIPMENT = "manage_imaging_equipment",
    DOCUMENT_VITAL_SIGNS = "document_vital_signs",
    ADMINISTER_MEDICATIONS = "administer_medications",
    DOCUMENT_NURSING_CARE = "document_nursing_care",
    MANAGE_PATIENT_CARE_PLANS = "manage_patient_care_plans",
    VIEW_OWN_RECORDS = "view_own_records",
    REQUEST_APPOINTMENTS = "request_appointments",
    MESSAGE_CARE_TEAM = "message_care_team",
    UPDATE_PERSONAL_INFO = "update_personal_info"
}
export interface RolePermissions {
    role: UserRole;
    permissions: Permission[];
    description: string;
    restrictions?: string[];
}
export interface AuthToken {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
}
export interface LoginCredentials {
    username: string;
    password: string;
    mfaToken?: string;
}
export interface MfaSetup {
    secret: string;
    qrCode: string;
    backupCodes: string[];
}
export interface PasswordPolicy {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    preventReuse: number;
    maxAgeInDays: number;
    lockoutThreshold: number;
    lockoutDurationMinutes: number;
}
export interface SessionInfo {
    userId: string;
    sessionId: string;
    role: UserRole;
    permissions: Permission[];
    ipAddress: string;
    userAgent: string;
    lastActivity: Date;
    expiresAt: Date;
}
export interface AuditLogEntry {
    id: string;
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
    success: boolean;
    errorMessage?: string;
    additionalData?: Record<string, any>;
}
export interface SecurityEvent {
    type: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'PASSWORD_CHANGE' | 'MFA_ENABLED' | 'MFA_DISABLED' | 'ACCOUNT_LOCKED' | 'UNAUTHORIZED_ACCESS' | 'DATA_ACCESS' | 'DATA_MODIFICATION' | 'SYSTEM_CONFIGURATION_CHANGE';
    userId?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    metadata?: Record<string, any>;
}
export interface ComplianceReport {
    reportId: string;
    reportType: 'HIPAA_ACCESS_LOG' | 'USER_ACTIVITY' | 'SECURITY_INCIDENTS' | 'PASSWORD_COMPLIANCE';
    generatedBy: string;
    dateRange: {
        start: Date;
        end: Date;
    };
    data: any[];
    summary: Record<string, any>;
    createdAt: Date;
}
//# sourceMappingURL=auth.types.d.ts.map