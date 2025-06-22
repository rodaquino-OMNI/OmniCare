/**
 * Unified Role Permissions for OmniCare EMR Frontend
 * 
 * This module provides role-based permission mappings that work
 * with the unified user role system.
 */

import type { UserRole, Permission } from '@/types';

// Default permissions for each role
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  physician: [
    { id: '1', name: 'view_patient_records', description: 'View patient medical records', resource: 'Patient', action: 'read' },
    { id: '2', name: 'edit_patient_records', description: 'Edit patient medical records', resource: 'Patient', action: 'write' },
    { id: '3', name: 'create_prescriptions', description: 'Create medication prescriptions', resource: 'MedicationRequest', action: 'create' },
    { id: '4', name: 'view_clinical_notes', description: 'View clinical documentation', resource: 'DocumentReference', action: 'read' },
    { id: '5', name: 'create_clinical_notes', description: 'Create clinical documentation', resource: 'DocumentReference', action: 'create' },
    { id: '6', name: 'order_procedures', description: 'Order medical procedures', resource: 'ServiceRequest', action: 'create' },
    { id: '7', name: 'view_lab_results', description: 'View laboratory results', resource: 'DiagnosticReport', action: 'read' },
    { id: '8', name: 'manage_encounters', description: 'Manage patient encounters', resource: 'Encounter', action: 'write' }
  ],
  
  nurse: [
    { id: '1', name: 'view_patient_records', description: 'View patient medical records', resource: 'Patient', action: 'read' },
    { id: '2', name: 'edit_patient_records', description: 'Edit patient medical records', resource: 'Patient', action: 'write' },
    { id: '4', name: 'view_clinical_notes', description: 'View clinical documentation', resource: 'DocumentReference', action: 'read' },
    { id: '5', name: 'create_clinical_notes', description: 'Create clinical documentation', resource: 'DocumentReference', action: 'create' },
    { id: '7', name: 'view_lab_results', description: 'View laboratory results', resource: 'DiagnosticReport', action: 'read' },
    { id: '8', name: 'manage_encounters', description: 'Manage patient encounters', resource: 'Encounter', action: 'write' },
    { id: '9', name: 'administer_medications', description: 'Administer medications to patients', resource: 'MedicationAdministration', action: 'create' },
    { id: '1ResourceHistoryTable', name: 'record_vital_signs', description: 'Record patient vital signs', resource: 'Observation', action: 'create' }
  ],
  
  admin: [
    { id: '1', name: 'view_patient_records', description: 'View patient medical records', resource: 'Patient', action: 'read' },
    { id: '2', name: 'edit_patient_records', description: 'Edit patient medical records', resource: 'Patient', action: 'write' },
    { id: '11', name: 'manage_appointments', description: 'Manage patient appointments', resource: 'Appointment', action: 'write' },
    { id: '12', name: 'manage_billing', description: 'Manage billing and insurance', resource: 'Account', action: 'write' },
    { id: '13', name: 'view_reports', description: 'View administrative reports', resource: 'Report', action: 'read' },
    { id: '14', name: 'manage_users', description: 'Manage user accounts', resource: 'User', action: 'write' }
  ],
  
  system_admin: [
    { id: '1', name: 'view_patient_records', description: 'View patient medical records', resource: 'Patient', action: 'read' },
    { id: '2', name: 'edit_patient_records', description: 'Edit patient medical records', resource: 'Patient', action: 'write' },
    { id: '11', name: 'manage_appointments', description: 'Manage patient appointments', resource: 'Appointment', action: 'write' },
    { id: '12', name: 'manage_billing', description: 'Manage billing and insurance', resource: 'Account', action: 'write' },
    { id: '13', name: 'view_reports', description: 'View administrative reports', resource: 'Report', action: 'read' },
    { id: '14', name: 'manage_users', description: 'Manage user accounts', resource: 'User', action: 'write' },
    { id: '15', name: 'system_configuration', description: 'Configure system settings', resource: 'System', action: 'admin' },
    { id: '16', name: 'audit_logs', description: 'View audit logs', resource: 'AuditEvent', action: 'read' },
    { id: '17', name: 'backup_restore', description: 'Backup and restore data', resource: 'System', action: 'admin' }
  ],
  
  pharmacist: [
    { id: '1', name: 'view_patient_records', description: 'View patient medical records', resource: 'Patient', action: 'read' },
    { id: '3', name: 'create_prescriptions', description: 'Create medication prescriptions', resource: 'MedicationRequest', action: 'create' },
    { id: '18', name: 'dispense_medications', description: 'Dispense medications', resource: 'MedicationDispense', action: 'create' },
    { id: '19', name: 'verify_prescriptions', description: 'Verify medication prescriptions', resource: 'MedicationRequest', action: 'verify' },
    { id: '2ResourceHistoryTable', name: 'drug_interaction_check', description: 'Check drug interactions', resource: 'MedicationRequest', action: 'analyze' }
  ],
  
  lab_tech: [
    { id: '1', name: 'view_patient_records', description: 'View patient medical records', resource: 'Patient', action: 'read' },
    { id: '7', name: 'view_lab_results', description: 'View laboratory results', resource: 'DiagnosticReport', action: 'read' },
    { id: '21', name: 'enter_lab_results', description: 'Enter laboratory test results', resource: 'DiagnosticReport', action: 'create' },
    { id: '22', name: 'process_specimens', description: 'Process laboratory specimens', resource: 'Specimen', action: 'write' }
  ],
  
  radiology_tech: [
    { id: '1', name: 'view_patient_records', description: 'View patient medical records', resource: 'Patient', action: 'read' },
    { id: '23', name: 'perform_imaging', description: 'Perform imaging studies', resource: 'ImagingStudy', action: 'create' },
    { id: '24', name: 'view_imaging_results', description: 'View imaging results', resource: 'ImagingStudy', action: 'read' }
  ],
  
  patient: [
    { id: '25', name: 'view_own_records', description: 'View own medical records', resource: 'Patient', action: 'read' },
    { id: '26', name: 'request_appointments', description: 'Request appointments', resource: 'Appointment', action: 'request' },
    { id: '27', name: 'message_providers', description: 'Message healthcare providers', resource: 'Communication', action: 'create' }
  ],
  
  billing: [
    { id: '1', name: 'view_patient_records', description: 'View patient medical records', resource: 'Patient', action: 'read' },
    { id: '12', name: 'manage_billing', description: 'Manage billing and insurance', resource: 'Account', action: 'write' },
    { id: '28', name: 'process_payments', description: 'Process patient payments', resource: 'Account', action: 'payment' },
    { id: '29', name: 'insurance_verification', description: 'Verify insurance coverage', resource: 'Coverage', action: 'verify' }
  ],
  
  receptionist: [
    { id: '1', name: 'view_patient_records', description: 'View patient medical records', resource: 'Patient', action: 'read' },
    { id: '2', name: 'edit_patient_records', description: 'Edit patient medical records', resource: 'Patient', action: 'write' },
    { id: '11', name: 'manage_appointments', description: 'Manage patient appointments', resource: 'Appointment', action: 'write' },
    { id: '3ResourceHistoryTable', name: 'patient_checkin', description: 'Check in patients', resource: 'Encounter', action: 'checkin' }
  ]
};

export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(userPermissions: Permission[], resource: string, action: string): boolean {
  return userPermissions.some(permission => 
    permission.resource === resource && permission.action === action
  );
}

export function hasAnyPermission(userPermissions: Permission[], permissions: { resource: string; action: string }[]): boolean {
  return permissions.some(({ resource, action }) => 
    hasPermission(userPermissions, resource, action)
  );
}

export function hasAllPermissions(userPermissions: Permission[], permissions: { resource: string; action: string }[]): boolean {
  return permissions.every(({ resource, action }) => 
    hasPermission(userPermissions, resource, action)
  );
}