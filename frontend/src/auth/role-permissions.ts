/**
 * Role-based permissions system
 * Defines user roles and their associated permissions
 */

export type UserRole = 'admin' | 'physician' | 'nurse' | 'patient' | 'billing' | 'receptionist';

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface RolePermissions {
  role: UserRole;
  description: string;
  permissions: Permission[];
  restrictions?: string[];
}

// Define all available permissions
export const PERMISSIONS: Record<string, Permission> = {
  // Patient permissions
  PATIENT_READ: {
    id: 'patient:read',
    name: 'Read Patient Data',
    description: 'View patient information and medical records',
    resource: 'patient',
    action: 'read'
  },
  PATIENT_WRITE: {
    id: 'patient:write',
    name: 'Write Patient Data',
    description: 'Create and update patient information',
    resource: 'patient',
    action: 'write'
  },
  PATIENT_DELETE: {
    id: 'patient:delete',
    name: 'Delete Patient Data',
    description: 'Delete patient records (admin only)',
    resource: 'patient',
    action: 'delete'
  },

  // Clinical permissions
  CLINICAL_READ: {
    id: 'clinical:read',
    name: 'Read Clinical Data',
    description: 'View clinical notes, diagnoses, and treatment plans',
    resource: 'clinical',
    action: 'read'
  },
  CLINICAL_WRITE: {
    id: 'clinical:write',
    name: 'Write Clinical Data',
    description: 'Create and update clinical documentation',
    resource: 'clinical',
    action: 'write'
  },

  // Medication permissions
  MEDICATION_READ: {
    id: 'medication:read',
    name: 'Read Medications',
    description: 'View medication lists and prescriptions',
    resource: 'medication',
    action: 'read'
  },
  MEDICATION_PRESCRIBE: {
    id: 'medication:prescribe',
    name: 'Prescribe Medications',
    description: 'Create and manage medication prescriptions',
    resource: 'medication',
    action: 'prescribe'
  },
  MEDICATION_ADMINISTER: {
    id: 'medication:administer',
    name: 'Administer Medications',
    description: 'Record medication administration',
    resource: 'medication',
    action: 'administer'
  },

  // Order permissions
  ORDER_READ: {
    id: 'order:read',
    name: 'Read Orders',
    description: 'View medical orders and lab requests',
    resource: 'order',
    action: 'read'
  },
  ORDER_WRITE: {
    id: 'order:write',
    name: 'Write Orders',
    description: 'Create and manage medical orders',
    resource: 'order',
    action: 'write'
  },

  // Billing permissions
  BILLING_READ: {
    id: 'billing:read',
    name: 'Read Billing Data',
    description: 'View billing information and insurance details',
    resource: 'billing',
    action: 'read'
  },
  BILLING_WRITE: {
    id: 'billing:write',
    name: 'Write Billing Data',
    description: 'Create and update billing records',
    resource: 'billing',
    action: 'write'
  },

  // Administrative permissions
  ADMIN_READ: {
    id: 'admin:read',
    name: 'Read Admin Data',
    description: 'View system configuration and user management',
    resource: 'admin',
    action: 'read'
  },
  ADMIN_WRITE: {
    id: 'admin:write',
    name: 'Write Admin Data',
    description: 'Manage system settings and user accounts',
    resource: 'admin',
    action: 'write'
  },

  // Scheduling permissions
  SCHEDULE_READ: {
    id: 'schedule:read',
    name: 'Read Schedule',
    description: 'View appointment schedules',
    resource: 'schedule',
    action: 'read'
  },
  SCHEDULE_WRITE: {
    id: 'schedule:write',
    name: 'Write Schedule',
    description: 'Create and manage appointments',
    resource: 'schedule',
    action: 'write'
  }
};

// Define role permissions
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    role: 'admin',
    description: 'System administrator with full access',
    permissions: Object.values(PERMISSIONS)
  },

  physician: {
    role: 'physician',
    description: 'Licensed physician with clinical privileges',
    permissions: [
      PERMISSIONS.PATIENT_READ,
      PERMISSIONS.PATIENT_WRITE,
      PERMISSIONS.CLINICAL_READ,
      PERMISSIONS.CLINICAL_WRITE,
      PERMISSIONS.MEDICATION_READ,
      PERMISSIONS.MEDICATION_PRESCRIBE,
      PERMISSIONS.ORDER_READ,
      PERMISSIONS.ORDER_WRITE,
      PERMISSIONS.BILLING_READ,
      PERMISSIONS.SCHEDULE_READ,
      PERMISSIONS.SCHEDULE_WRITE
    ]
  },

  nurse: {
    role: 'nurse',
    description: 'Licensed nurse with patient care responsibilities',
    permissions: [
      PERMISSIONS.PATIENT_READ,
      PERMISSIONS.PATIENT_WRITE,
      PERMISSIONS.CLINICAL_READ,
      PERMISSIONS.CLINICAL_WRITE,
      PERMISSIONS.MEDICATION_READ,
      PERMISSIONS.MEDICATION_ADMINISTER,
      PERMISSIONS.ORDER_READ,
      PERMISSIONS.SCHEDULE_READ
    ]
  },

  patient: {
    role: 'patient',
    description: 'Patient with access to own medical records',
    permissions: [
      PERMISSIONS.PATIENT_READ,
      PERMISSIONS.CLINICAL_READ,
      PERMISSIONS.MEDICATION_READ,
      PERMISSIONS.SCHEDULE_READ
    ],
    restrictions: ['own_records_only']
  },

  billing: {
    role: 'billing',
    description: 'Billing staff with financial data access',
    permissions: [
      PERMISSIONS.PATIENT_READ,
      PERMISSIONS.BILLING_READ,
      PERMISSIONS.BILLING_WRITE,
      PERMISSIONS.SCHEDULE_READ
    ]
  },

  receptionist: {
    role: 'receptionist',
    description: 'Front desk staff with scheduling and basic patient access',
    permissions: [
      PERMISSIONS.PATIENT_READ,
      PERMISSIONS.PATIENT_WRITE,
      PERMISSIONS.SCHEDULE_READ,
      PERMISSIONS.SCHEDULE_WRITE
    ],
    restrictions: ['limited_clinical_access']
  }
};

// Helper functions
export function hasPermission(userRole: UserRole, permission: string): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  return rolePermissions.permissions.some(p => p.id === permission);
}

export function hasResourceAccess(userRole: UserRole, resource: string, action: string): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  return rolePermissions.permissions.some(p => p.resource === resource && p.action === action);
}

export function getUserPermissions(userRole: UserRole): Permission[] {
  return ROLE_PERMISSIONS[userRole]?.permissions || [];
}

export function getRolePermissions(userRole: UserRole): Permission[] {
  return getUserPermissions(userRole);
}

export function getRoleRestrictions(userRole: UserRole): string[] {
  return ROLE_PERMISSIONS[userRole]?.restrictions || [];
}

export function canAccessPatientData(userRole: UserRole, patientId: string, currentUserId: string): boolean {
  const restrictions = getRoleRestrictions(userRole);
  
  // If role has own_records_only restriction, only allow access to own records
  if (restrictions.includes('own_records_only')) {
    return patientId === currentUserId;
  }
  
  // Otherwise check if role has patient read permission
  return hasPermission(userRole, 'patient:read');
}

export function canPrescribeMedications(userRole: UserRole): boolean {
  return hasPermission(userRole, 'medication:prescribe');
}

export function canAdministerMedications(userRole: UserRole): boolean {
  return hasPermission(userRole, 'medication:administer');
}

export function canManageUsers(userRole: UserRole): boolean {
  return hasPermission(userRole, 'admin:write');
}