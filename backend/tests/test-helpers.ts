/**
 * Test Helper Functions for OmniCare Backend Tests
 * Provides common utilities and mock factories for consistent test data
 */

import { User } from '@/types/auth.types';
import { UserRoleLong } from '@/types/unified-user-roles';

/**
 * Creates a complete User mock with all required properties
 * @param overrides - Partial user properties to override defaults
 * @returns Complete User object
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  const defaultUser: User = {
    id: 'test-user-123',
    username: 'testuser',
    email: 'testuser@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'physician' as UserRoleLong,
    department: 'General Medicine',
    isActive: true,
    isMfaEnabled: false,
    lastLogin: now,
    passwordChangedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    failedLoginAttempts: 0,
    createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    updatedAt: now,
    ...overrides
  };

  return defaultUser;
}

/**
 * Creates mock users for different roles
 */
export const mockUsers = {
  physician: createMockUser({
    id: 'physician-123',
    username: 'dr.smith',
    email: 'dr.smith@hospital.com',
    firstName: 'John',
    lastName: 'Smith',
    role: 'physician',
    department: 'Cardiology',
    licenseNumber: 'MD123456',
    npiNumber: '1234567890'
  }),

  nurse: createMockUser({
    id: 'nurse-456',
    username: 'nurse.jones',
    email: 'nurse.jones@hospital.com',
    firstName: 'Jane',
    lastName: 'Jones',
    role: 'nursing_staff',
    department: 'Emergency',
    licenseNumber: 'RN789012'
  }),

  admin: createMockUser({
    id: 'admin-789',
    username: 'admin.wilson',
    email: 'admin.wilson@hospital.com',
    firstName: 'Bob',
    lastName: 'Wilson',
    role: 'administrative_staff',
    department: 'Administration'
  }),

  systemAdmin: createMockUser({
    id: 'sysadmin-001',
    username: 'sysadmin',
    email: 'sysadmin@hospital.com',
    firstName: 'System',
    lastName: 'Admin',
    role: 'system_administrator',
    department: 'IT',
    isMfaEnabled: true
  }),

  patient: createMockUser({
    id: 'patient-111',
    username: 'patient.doe',
    email: 'patient.doe@email.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'patient'
  }),

  labTech: createMockUser({
    id: 'labtech-222',
    username: 'lab.tech',
    email: 'lab.tech@hospital.com',
    firstName: 'Lab',
    lastName: 'Tech',
    role: 'laboratory_technician',
    department: 'Laboratory'
  })
};

/**
 * Creates a mock Express Request with authenticated user
 */
export function createMockRequest(user: Partial<User> = {}, options: any = {}): any {
  return {
    headers: {},
    params: {},
    query: {},
    body: {},
    user: createMockUser(user),
    ...options
  };
}

/**
 * Creates a mock authentication token for testing
 */
export function createMockAuthToken(userId: string = 'test-user-123'): string {
  // This is a mock token - in real tests you might want to generate a proper JWT
  return `mock-jwt-token-${userId}`;
}

/**
 * Common test database service mock
 */
export const mockDatabaseService = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  cleanup: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue({ rows: [] }),
  transaction: jest.fn().mockImplementation(async (callback) => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  })
};

/**
 * Common test Medplum service mock
 */
export const mockMedplumService = {
  getClient: jest.fn().mockReturnValue({
    createResource: jest.fn().mockResolvedValue({ id: 'resource-123' }),
    updateResource: jest.fn().mockResolvedValue({ id: 'resource-123' }),
    deleteResource: jest.fn().mockResolvedValue(undefined),
    readResource: jest.fn().mockResolvedValue({ id: 'resource-123' }),
    search: jest.fn().mockResolvedValue({ entry: [] })
  }),
  search: jest.fn().mockResolvedValue({ entry: [] }),
  createResource: jest.fn().mockResolvedValue({ id: 'resource-123' }),
  updateResource: jest.fn().mockResolvedValue({ id: 'resource-123' }),
  readResource: jest.fn().mockResolvedValue({ id: 'resource-123' })
};

/**
 * Valid role mappings for tests
 */
export const validRoles: UserRoleLong[] = [
  'physician',
  'nursing_staff',
  'administrative_staff',
  'system_administrator',
  'pharmacist',
  'laboratory_technician',
  'radiology_technician',
  'patient',
  'billing',
  'receptionist',
  'guest'
];

/**
 * Role name corrections for common test mistakes
 */
export const roleCorrections: Record<string, UserRoleLong> = {
  'nurse': 'nursing_staff',
  'admin': 'administrative_staff',
  'system_admin': 'system_administrator',
  'lab_tech': 'laboratory_technician',
  'radiology_tech': 'radiology_technician',
  'provider': 'physician' // Common mistake in tests
};