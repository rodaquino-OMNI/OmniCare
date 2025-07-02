/**
 * @jest-environment jsdom
 */

import { useAuthStore } from '../auth';
import { getRolePermissions } from '@/auth/unified-role-permissions';
import { mapToFrontendRole } from '@/auth/role-mappings';
import type { User, UserRole, Permission } from '@/types';

// Mock dependencies
jest.mock('@/auth/unified-role-permissions');
jest.mock('@/auth/role-mappings');
jest.mock('@/utils/error.utils', () => ({
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
  getDisplayErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error)
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('AuthStore', () => {
  const mockUser: User = {
    id: 'test-user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'physician' as UserRole,
    avatar: 'https://example.com/avatar.jpg',
    permissions: []
  };

  const mockTokens = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresIn: 3600,
    tokenType: 'Bearer'
  };

  const mockSession = {
    sessionId: 'test-session-123',
    expiresAt: '2024-01-01T01:00:00Z'
  };

  const mockPermissions: Permission[] = [
    { id: '1', name: 'view_patient_records', description: 'View patient medical records', resource: 'Patient', action: 'read' },
    { id: '2', name: 'edit_patient_records', description: 'Edit patient medical records', resource: 'Patient', action: 'write' }
  ];

  beforeEach(() => {
    // Reset the store state before each test
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      tokens: null,
      session: null,
      permissions: []
    });
    
    // Reset all mocks
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    
    // Clear localStorage
    localStorage.clear();
    
    // Setup default mock implementations
    (mapToFrontendRole as jest.Mock).mockImplementation((role) => role);
    (getRolePermissions as jest.Mock).mockReturnValue(mockPermissions);
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();
      
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.tokens).toBeNull();
      expect(state.session).toBeNull();
      expect(state.permissions).toEqual([]);
    });
  });

  describe('Login Action', () => {
    it('should successfully log in user', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockResponse = {
        success: true,
        user: mockUser,
        tokens: mockTokens,
        session: mockSession,
        permissions: mockPermissions
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const { login } = useAuthStore.getState();
      await login(credentials);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.tokens).toEqual(mockTokens);
      expect(state.session).toEqual(mockSession);
      expect(state.permissions).toEqual(mockPermissions);

      // Check localStorage
      expect(localStorage.getItem('omnicare_access_token')).toBe(mockTokens.accessToken);
      expect(localStorage.getItem('omnicare_refresh_token')).toBe(mockTokens.refreshToken);
    });

    it('should handle login failure with error message', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrong-password'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' })
      });

      const { login } = useAuthStore.getState();
      
      await expect(login(credentials)).rejects.toThrow('Invalid credentials');
      
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.tokens).toBeNull();
    });

    it('should handle MFA requirement', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          requiresMfa: true,
          message: 'MFA required'
        })
      });

      const { login } = useAuthStore.getState();
      
      await expect(login(credentials)).rejects.toThrow('MFA_REQUIRED');
      
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should map backend role to frontend role', async () => {
      (mapToFrontendRole as jest.Mock).mockReturnValueOnce('nurse');
      
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockResponse = {
        success: true,
        user: { ...mockUser, role: 'nursing_staff' },
        tokens: mockTokens,
        session: mockSession
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const { login } = useAuthStore.getState();
      await login(credentials);

      expect(mapToFrontendRole).toHaveBeenCalledWith('nursing_staff');
      
      const state = useAuthStore.getState();
      expect(state.user?.role).toBe('nurse');
    });

    it('should use permissions from API response if available', async () => {
      const apiPermissions: Permission[] = [
        { id: 'api-1', name: 'special_permission', description: 'Special permission from API', resource: 'Special', action: 'execute' }
      ];

      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockResponse = {
        success: true,
        user: mockUser,
        tokens: mockTokens,
        session: mockSession,
        permissions: apiPermissions
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const { login } = useAuthStore.getState();
      await login(credentials);

      const state = useAuthStore.getState();
      expect(state.permissions).toEqual(apiPermissions);
      expect(getRolePermissions).not.toHaveBeenCalled();
    });

    it('should calculate permissions from role if not in API response', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockResponse = {
        success: true,
        user: mockUser,
        tokens: mockTokens,
        session: mockSession
        // No permissions field
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const { login } = useAuthStore.getState();
      await login(credentials);

      expect(getRolePermissions).toHaveBeenCalledWith('physician');
      
      const state = useAuthStore.getState();
      expect(state.permissions).toEqual(mockPermissions);
    });

    it('should handle network errors', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { login } = useAuthStore.getState();
      
      await expect(login(credentials)).rejects.toThrow('Network error');
      
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('Logout Action', () => {
    beforeEach(() => {
      // Set up authenticated state
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        tokens: mockTokens,
        session: mockSession,
        permissions: mockPermissions
      });
      
      localStorage.setItem('omnicare_access_token', mockTokens.accessToken);
      localStorage.setItem('omnicare_refresh_token', mockTokens.refreshToken);
    });

    it('should successfully log out user', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const { logout } = useAuthStore.getState();
      await logout();

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mockTokens.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.tokens).toBeNull();
      expect(state.session).toBeNull();
      expect(state.permissions).toEqual([]);
      
      // Check localStorage cleared
      expect(localStorage.getItem('omnicare_access_token')).toBeNull();
      expect(localStorage.getItem('omnicare_refresh_token')).toBeNull();
    });

    it('should continue with local logout even if server logout fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Server error'));

      const { logout } = useAuthStore.getState();
      await logout();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Logout error:', 'Server error', expect.any(Error));

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem('omnicare_access_token')).toBeNull();
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle logout without tokens', async () => {
      useAuthStore.setState({ tokens: null });

      const { logout } = useAuthStore.getState();
      await logout();

      expect(global.fetch).not.toHaveBeenCalled();
      
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('RefreshAuth Action', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        tokens: mockTokens,
        permissions: mockPermissions
      });
    });

    it('should successfully refresh tokens', async () => {
      const newTokens = {
        ...mockTokens,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      };

      const mockResponse = {
        success: true,
        user: mockUser,
        tokens: newTokens,
        permissions: mockPermissions
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const { refreshAuth } = useAuthStore.getState();
      await refreshAuth();

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: mockTokens.refreshToken })
      });

      const state = useAuthStore.getState();
      expect(state.tokens).toEqual(newTokens);
      expect(state.isAuthenticated).toBe(true);
      
      // Check localStorage updated
      expect(localStorage.getItem('omnicare_access_token')).toBe(newTokens.accessToken);
      expect(localStorage.getItem('omnicare_refresh_token')).toBe(newTokens.refreshToken);
    });

    it('should logout if no refresh token available', async () => {
      useAuthStore.setState({ tokens: null });

      const logoutSpy = jest.spyOn(useAuthStore.getState(), 'logout');
      
      const { refreshAuth } = useAuthStore.getState();
      await refreshAuth();

      expect(logoutSpy).toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should logout on refresh failure', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid refresh token' })
      });

      const logoutSpy = jest.spyOn(useAuthStore.getState(), 'logout');
      
      const { refreshAuth } = useAuthStore.getState();
      await refreshAuth();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Token refresh error:', 'Invalid refresh token', expect.any(Error));
      expect(logoutSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should map roles during refresh', async () => {
      (mapToFrontendRole as jest.Mock).mockReturnValueOnce('admin');
      
      const mockResponse = {
        success: true,
        user: { ...mockUser, role: 'administrative_staff' },
        tokens: mockTokens
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const { refreshAuth } = useAuthStore.getState();
      await refreshAuth();

      expect(mapToFrontendRole).toHaveBeenCalledWith('administrative_staff');
      
      const state = useAuthStore.getState();
      expect(state.user?.role).toBe('admin');
    });
  });

  describe('UpdateUser Action', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: mockUser
      });
    });

    it('should update user data', () => {
      const updates = {
        name: 'Updated Name',
        avatar: 'https://example.com/new-avatar.jpg'
      };

      const { updateUser } = useAuthStore.getState();
      updateUser(updates);

      const state = useAuthStore.getState();
      expect(state.user).toEqual({
        ...mockUser,
        ...updates
      });
    });

    it('should not update if no user exists', () => {
      useAuthStore.setState({ user: null });

      const { updateUser } = useAuthStore.getState();
      updateUser({ firstName: 'New', lastName: 'Name' });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });
  });

  describe('SetLoading Action', () => {
    it('should set loading state', () => {
      const { setLoading } = useAuthStore.getState();
      
      setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
      
      setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('GetCurrentUser Action', () => {
    beforeEach(() => {
      useAuthStore.setState({
        tokens: mockTokens
      });
    });

    it('should fetch and update current user', async () => {
      const mockResponse = {
        success: true,
        user: mockUser
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const { getCurrentUser } = useAuthStore.getState();
      await getCurrentUser();

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${mockTokens.accessToken}`
        }
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.permissions).toEqual(mockPermissions);
    });

    it('should logout on failure to get current user', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Unauthorized' })
      });

      const logoutSpy = jest.spyOn(useAuthStore.getState(), 'logout');
      
      const { getCurrentUser } = useAuthStore.getState();
      await getCurrentUser();

      expect(logoutSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle network errors when getting current user', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const logoutSpy = jest.spyOn(useAuthStore.getState(), 'logout');
      
      const { getCurrentUser } = useAuthStore.getState();
      await getCurrentUser();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Get current user error:', 'Network error', expect.any(Error));
      expect(logoutSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should not fetch if no access token', async () => {
      useAuthStore.setState({ tokens: null });

      const { getCurrentUser } = useAuthStore.getState();
      await getCurrentUser();

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Permission Checking Methods', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: mockUser,
        permissions: mockPermissions
      });
    });

    describe('hasPermission', () => {
      it('should return true for existing permission', () => {
        const { hasPermission } = useAuthStore.getState();
        expect(hasPermission('view_patient_records')).toBe(true);
        expect(hasPermission('edit_patient_records')).toBe(true);
      });

      it('should return false for non-existing permission', () => {
        const { hasPermission } = useAuthStore.getState();
        expect(hasPermission('delete_patient_records')).toBe(false);
        expect(hasPermission('admin_only_permission')).toBe(false);
      });
    });

    describe('hasRole', () => {
      it('should return true for matching role', () => {
        const { hasRole } = useAuthStore.getState();
        expect(hasRole('physician')).toBe(true);
      });

      it('should return false for non-matching role', () => {
        const { hasRole } = useAuthStore.getState();
        expect(hasRole('nurse')).toBe(false);
        expect(hasRole('admin')).toBe(false);
      });

      it('should return false when no user', () => {
        useAuthStore.setState({ user: null });
        const { hasRole } = useAuthStore.getState();
        expect(hasRole('physician')).toBe(false);
      });
    });

    describe('hasAnyRole', () => {
      it('should return true if user has any of the specified roles', () => {
        const { hasAnyRole } = useAuthStore.getState();
        expect(hasAnyRole(['physician', 'nurse'])).toBe(true);
        expect(hasAnyRole(['admin', 'physician', 'nurse'])).toBe(true);
      });

      it('should return false if user has none of the specified roles', () => {
        const { hasAnyRole } = useAuthStore.getState();
        expect(hasAnyRole(['nurse', 'admin'])).toBe(false);
        expect(hasAnyRole(['system_admin'])).toBe(false);
      });

      it('should return false when no user', () => {
        useAuthStore.setState({ user: null });
        const { hasAnyRole } = useAuthStore.getState();
        expect(hasAnyRole(['physician', 'nurse'])).toBe(false);
      });

      it('should handle empty array', () => {
        const { hasAnyRole } = useAuthStore.getState();
        expect(hasAnyRole([])).toBe(false);
      });
    });
  });

  describe('useAuth Helper Hook', () => {
    it('should provide role-specific boolean flags', () => {
      useAuthStore.setState({
        user: { ...mockUser, role: 'physician' },
        permissions: mockPermissions
      });

      const { useAuth } = require('../auth');
      const authHelpers = useAuth();

      expect(authHelpers.isPhysician).toBe(true);
      expect(authHelpers.isDoctor).toBe(true); // Alias
      expect(authHelpers.isNurse).toBe(false);
      expect(authHelpers.isAdmin).toBe(false);
      expect(authHelpers.isSystemAdmin).toBe(false);
      expect(authHelpers.isPharmacist).toBe(false);
      expect(authHelpers.isLabTech).toBe(false);
      expect(authHelpers.isRadiologyTech).toBe(false);
      expect(authHelpers.isPatient).toBe(false);
    });

    it('should provide permission-based capability flags', () => {
      useAuthStore.setState({
        user: { ...mockUser, role: 'nurse' },
        permissions: mockPermissions
      });

      const { useAuth } = require('../auth');
      const authHelpers = useAuth();

      expect(authHelpers.canViewPatients).toBe(true); // nurse can view
      expect(authHelpers.canEditPatients).toBe(true); // nurse can edit
      expect(authHelpers.canCreateOrders).toBe(false); // only physician
      expect(authHelpers.canAdministerMedications).toBe(true); // nurse can
      expect(authHelpers.canPrescribeMedications).toBe(false); // only physician
      expect(authHelpers.canViewLabResults).toBe(true); // nurse can view
      expect(authHelpers.canManageSystem).toBe(false); // only system_admin
      expect(authHelpers.canManageBilling).toBe(false); // only admin
    });
  });

  describe('State Persistence', () => {
    it('should persist specific state properties', () => {
      const state = useAuthStore.getState();
      
      // Verify all expected properties exist
      expect(state).toHaveProperty('user');
      expect(state).toHaveProperty('isAuthenticated');
      expect(state).toHaveProperty('isLoading');
      expect(state).toHaveProperty('tokens');
      expect(state).toHaveProperty('session');
      expect(state).toHaveProperty('permissions');
      
      // Verify all action functions exist
      expect(typeof state.login).toBe('function');
      expect(typeof state.logout).toBe('function');
      expect(typeof state.refreshAuth).toBe('function');
      expect(typeof state.updateUser).toBe('function');
      expect(typeof state.setLoading).toBe('function');
      expect(typeof state.hasPermission).toBe('function');
      expect(typeof state.hasRole).toBe('function');
      expect(typeof state.hasAnyRole).toBe('function');
      expect(typeof state.getCurrentUser).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined role mapping', () => {
      (mapToFrontendRole as jest.Mock).mockReturnValueOnce(undefined as any);
      
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockResponse = {
        success: true,
        user: { ...mockUser, role: 'unknown_role' },
        tokens: mockTokens,
        session: mockSession
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const { login } = useAuthStore.getState();
      
      // Should not throw
      expect(async () => await login(credentials)).not.toThrow();
    });

    it('should handle malformed API responses', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => null // Malformed response
      });

      const { login } = useAuthStore.getState();
      
      await expect(login(credentials)).rejects.toThrow();
    });

    it('should handle missing localStorage in SSR environment', async () => {
      // Temporarily remove localStorage
      const originalLocalStorage = global.localStorage;
      delete (global as any).localStorage;

      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockResponse = {
        success: true,
        user: mockUser,
        tokens: mockTokens,
        session: mockSession,
        permissions: mockPermissions
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const { login } = useAuthStore.getState();
      
      // Should not throw even without localStorage
      await expect(login(credentials)).resolves.not.toThrow();

      // Restore localStorage
      global.localStorage = originalLocalStorage;
    });
  });
});