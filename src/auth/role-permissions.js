"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_HIERARCHY = exports.ROLE_PERMISSIONS = void 0;
exports.getRolePermissions = getRolePermissions;
exports.hasPermission = hasPermission;
exports.getRoleInfo = getRoleInfo;
exports.getAllRoles = getAllRoles;
exports.hasHigherRole = hasHigherRole;
const auth_types_1 = require("@/types/auth.types");
exports.ROLE_PERMISSIONS = {
    [auth_types_1.UserRole.PHYSICIAN]: {
        role: auth_types_1.UserRole.PHYSICIAN,
        description: 'Full clinical access with prescription authority and medical decision-making capabilities',
        permissions: [
            auth_types_1.Permission.CREATE_CLINICAL_NOTES,
            auth_types_1.Permission.EDIT_CLINICAL_NOTES,
            auth_types_1.Permission.VIEW_CLINICAL_NOTES,
            auth_types_1.Permission.FINALIZE_CLINICAL_NOTES,
            auth_types_1.Permission.CREATE_PRESCRIPTIONS,
            auth_types_1.Permission.MODIFY_PRESCRIPTIONS,
            auth_types_1.Permission.VIEW_PRESCRIPTIONS,
            auth_types_1.Permission.VIEW_PATIENT_RECORDS,
            auth_types_1.Permission.EDIT_PATIENT_RECORDS,
            auth_types_1.Permission.VIEW_PATIENT_DEMOGRAPHICS,
            auth_types_1.Permission.EDIT_PATIENT_DEMOGRAPHICS,
            auth_types_1.Permission.CREATE_MEDICAL_ORDERS,
            auth_types_1.Permission.VIEW_LAB_RESULTS,
            auth_types_1.Permission.ACKNOWLEDGE_CRITICAL_RESULTS,
            auth_types_1.Permission.VIEW_IMAGING_RESULTS,
            auth_types_1.Permission.SCHEDULE_APPOINTMENTS,
            auth_types_1.Permission.GENERATE_REPORTS
        ],
        restrictions: [
            'Cannot manage system users or security settings',
            'Cannot access billing functions directly',
            'Cannot perform technical imaging or lab procedures'
        ]
    },
    [auth_types_1.UserRole.NURSING_STAFF]: {
        role: auth_types_1.UserRole.NURSING_STAFF,
        description: 'Clinical documentation and patient care management with medication administration rights',
        permissions: [
            auth_types_1.Permission.CREATE_CLINICAL_NOTES,
            auth_types_1.Permission.EDIT_CLINICAL_NOTES,
            auth_types_1.Permission.VIEW_CLINICAL_NOTES,
            auth_types_1.Permission.VIEW_PATIENT_RECORDS,
            auth_types_1.Permission.EDIT_PATIENT_RECORDS,
            auth_types_1.Permission.VIEW_PATIENT_DEMOGRAPHICS,
            auth_types_1.Permission.DOCUMENT_VITAL_SIGNS,
            auth_types_1.Permission.ADMINISTER_MEDICATIONS,
            auth_types_1.Permission.DOCUMENT_NURSING_CARE,
            auth_types_1.Permission.MANAGE_PATIENT_CARE_PLANS,
            auth_types_1.Permission.VIEW_PRESCRIPTIONS,
            auth_types_1.Permission.VIEW_LAB_RESULTS,
            auth_types_1.Permission.ACKNOWLEDGE_CRITICAL_RESULTS,
            auth_types_1.Permission.SCHEDULE_APPOINTMENTS
        ],
        restrictions: [
            'Cannot create or modify prescriptions',
            'Cannot finalize physician documentation',
            'Cannot create medical orders',
            'Limited access to sensitive patient information'
        ]
    },
    [auth_types_1.UserRole.ADMINISTRATIVE_STAFF]: {
        role: auth_types_1.UserRole.ADMINISTRATIVE_STAFF,
        description: 'Patient registration, scheduling, billing, and non-clinical administrative functions',
        permissions: [
            auth_types_1.Permission.CREATE_PATIENT_RECORDS,
            auth_types_1.Permission.VIEW_PATIENT_DEMOGRAPHICS,
            auth_types_1.Permission.EDIT_PATIENT_DEMOGRAPHICS,
            auth_types_1.Permission.SCHEDULE_APPOINTMENTS,
            auth_types_1.Permission.MANAGE_BILLING,
            auth_types_1.Permission.PROCESS_INSURANCE,
            auth_types_1.Permission.GENERATE_REPORTS,
            auth_types_1.Permission.VIEW_CLINICAL_NOTES,
            auth_types_1.Permission.VIEW_PATIENT_RECORDS
        ],
        restrictions: [
            'Cannot access detailed clinical information',
            'Cannot create, edit, or finalize clinical documentation',
            'Cannot access prescription information',
            'Cannot view sensitive lab results or imaging',
            'Cannot administer medications or document clinical care'
        ]
    },
    [auth_types_1.UserRole.SYSTEM_ADMINISTRATOR]: {
        role: auth_types_1.UserRole.SYSTEM_ADMINISTRATOR,
        description: 'System configuration, user management, and technical administration with security oversight',
        permissions: [
            auth_types_1.Permission.MANAGE_USERS,
            auth_types_1.Permission.CONFIGURE_SYSTEM,
            auth_types_1.Permission.VIEW_AUDIT_LOGS,
            auth_types_1.Permission.MANAGE_SECURITY_SETTINGS,
            auth_types_1.Permission.GENERATE_REPORTS,
            auth_types_1.Permission.VIEW_PATIENT_DEMOGRAPHICS,
            auth_types_1.Permission.VIEW_CLINICAL_NOTES,
            auth_types_1.Permission.VIEW_PATIENT_RECORDS
        ],
        restrictions: [
            'Cannot create or modify clinical documentation',
            'Cannot prescribe medications or create medical orders',
            'Cannot perform clinical procedures',
            'Access to clinical data limited to system maintenance purposes',
            'Must document all administrative access for audit purposes'
        ]
    },
    [auth_types_1.UserRole.PHARMACIST]: {
        role: auth_types_1.UserRole.PHARMACIST,
        description: 'Medication verification, dispensing, and pharmaceutical care management',
        permissions: [
            auth_types_1.Permission.VIEW_PRESCRIPTIONS,
            auth_types_1.Permission.VERIFY_PRESCRIPTIONS,
            auth_types_1.Permission.DISPENSE_MEDICATIONS,
            auth_types_1.Permission.MODIFY_PRESCRIPTIONS,
            auth_types_1.Permission.VIEW_PATIENT_RECORDS,
            auth_types_1.Permission.VIEW_PATIENT_DEMOGRAPHICS,
            auth_types_1.Permission.VIEW_LAB_RESULTS,
            auth_types_1.Permission.CREATE_CLINICAL_NOTES,
            auth_types_1.Permission.VIEW_CLINICAL_NOTES,
            auth_types_1.Permission.GENERATE_REPORTS
        ],
        restrictions: [
            'Cannot create medical orders or diagnose',
            'Cannot finalize physician documentation',
            'Cannot access non-medication related clinical information',
            'Cannot schedule appointments or manage billing',
            'Prescription modifications limited to pharmaceutical parameters'
        ]
    },
    [auth_types_1.UserRole.LABORATORY_TECHNICIAN]: {
        role: auth_types_1.UserRole.LABORATORY_TECHNICIAN,
        description: 'Laboratory specimen processing, test result entry, and quality control management',
        permissions: [
            auth_types_1.Permission.VIEW_LAB_RESULTS,
            auth_types_1.Permission.ENTER_LAB_RESULTS,
            auth_types_1.Permission.ACKNOWLEDGE_CRITICAL_RESULTS,
            auth_types_1.Permission.VIEW_PATIENT_DEMOGRAPHICS,
            auth_types_1.Permission.VIEW_PATIENT_RECORDS,
            auth_types_1.Permission.CREATE_CLINICAL_NOTES,
            auth_types_1.Permission.VIEW_CLINICAL_NOTES,
            auth_types_1.Permission.GENERATE_REPORTS
        ],
        restrictions: [
            'Cannot create medical orders or prescriptions',
            'Cannot access clinical documentation unrelated to laboratory',
            'Cannot schedule appointments or manage billing',
            'Cannot administer medications or document patient care',
            'Access limited to laboratory workflow and results'
        ]
    },
    [auth_types_1.UserRole.RADIOLOGY_TECHNICIAN]: {
        role: auth_types_1.UserRole.RADIOLOGY_TECHNICIAN,
        description: 'Imaging study performance, equipment management, and radiology workflow coordination',
        permissions: [
            auth_types_1.Permission.PERFORM_IMAGING_STUDIES,
            auth_types_1.Permission.VIEW_IMAGING_RESULTS,
            auth_types_1.Permission.MANAGE_IMAGING_EQUIPMENT,
            auth_types_1.Permission.VIEW_PATIENT_DEMOGRAPHICS,
            auth_types_1.Permission.VIEW_PATIENT_RECORDS,
            auth_types_1.Permission.CREATE_CLINICAL_NOTES,
            auth_types_1.Permission.VIEW_CLINICAL_NOTES,
            auth_types_1.Permission.SCHEDULE_APPOINTMENTS,
            auth_types_1.Permission.GENERATE_REPORTS
        ],
        restrictions: [
            'Cannot create medical orders or prescriptions',
            'Cannot access clinical documentation unrelated to imaging',
            'Cannot manage billing or insurance processing',
            'Cannot administer medications or document patient care',
            'Cannot access lab results or other clinical data',
            'Appointment scheduling limited to imaging services'
        ]
    },
    [auth_types_1.UserRole.PATIENT]: {
        role: auth_types_1.UserRole.PATIENT,
        description: 'Personal health record access and patient portal functions for self-care management',
        permissions: [
            auth_types_1.Permission.VIEW_OWN_RECORDS,
            auth_types_1.Permission.UPDATE_PERSONAL_INFO,
            auth_types_1.Permission.REQUEST_APPOINTMENTS,
            auth_types_1.Permission.MESSAGE_CARE_TEAM,
            auth_types_1.Permission.VIEW_PRESCRIPTIONS,
            auth_types_1.Permission.VIEW_LAB_RESULTS,
            auth_types_1.Permission.VIEW_IMAGING_RESULTS,
            auth_types_1.Permission.VIEW_CLINICAL_NOTES
        ],
        restrictions: [
            'Can only access own medical records',
            'Cannot access other patients\' information',
            'Cannot create or modify clinical documentation',
            'Cannot prescribe medications or create medical orders',
            'Cannot access system administration functions',
            'Cannot view audit logs or system reports',
            'All access is limited to personal health information only'
        ]
    }
};
function getRolePermissions(role) {
    return exports.ROLE_PERMISSIONS[role]?.permissions || [];
}
function hasPermission(role, permission) {
    return getRolePermissions(role).includes(permission);
}
function getRoleInfo(role) {
    const roleData = exports.ROLE_PERMISSIONS[role];
    const result = {
        role: roleData.role,
        description: roleData.description
    };
    if (roleData.restrictions !== undefined) {
        result.restrictions = roleData.restrictions;
    }
    return result;
}
function getAllRoles() {
    return Object.values(auth_types_1.UserRole).map(role => getRoleInfo(role));
}
exports.ROLE_HIERARCHY = {
    [auth_types_1.UserRole.SYSTEM_ADMINISTRATOR]: 100,
    [auth_types_1.UserRole.PHYSICIAN]: 90,
    [auth_types_1.UserRole.PHARMACIST]: 70,
    [auth_types_1.UserRole.NURSING_STAFF]: 60,
    [auth_types_1.UserRole.LABORATORY_TECHNICIAN]: 50,
    [auth_types_1.UserRole.RADIOLOGY_TECHNICIAN]: 50,
    [auth_types_1.UserRole.ADMINISTRATIVE_STAFF]: 30,
    [auth_types_1.UserRole.PATIENT]: 10
};
function hasHigherRole(roleA, roleB) {
    return exports.ROLE_HIERARCHY[roleA] > exports.ROLE_HIERARCHY[roleB];
}
//# sourceMappingURL=role-permissions.js.map