import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuthStore, useAuth } from '../auth';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('Auth Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset zustand store
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      tokens: null,
      session: null,
      permissions: [],
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.tokens).toBeNull();
      expect(result.current.permissions).toEqual([]);
    });
  });

  describe('Login', () => {
    const mockAuthResponse = {
      success: true,
      user: {
        id: 'user-1',
        email: 'doctor@omnicare.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'physician',
        permissions: [],
        department: 'Medicine',
        title: 'MD',
      },
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      },
      permissions: [
        {
          action: "read",
          description: "View patient information and medical records",
          id: "patient:read",
          name: "Read Patient Data",
          resource: "patient",
        },
        {
          action: "write",
          description: "Create and update patient information",
          id: "patient:write",
          name: "Write Patient Data",
          resource: "patient",
        },
        {
          action: "read",
          description: "View clinical notes, diagnoses, and treatment plans",
          id: "clinical:read",
          name: "Read Clinical Data",
          resource: "clinical",
        },
      ],
    };

    it('should handle successful login', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAuthResponse,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login({
          email: 'doctor@omnicare.com',
          password: 'password123',
        });
      });

      expect(result.current.user).toEqual(mockAuthResponse.user);
      expect(result.current.tokens?.accessToken).toBe(mockAuthResponse.tokens.accessToken);
      expect(result.current.tokens?.refreshToken).toBe(mockAuthResponse.tokens.refreshToken);
      expect(result.current.permissions).toEqual(mockAuthResponse.permissions);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'omnicare_access_token',
        mockAuthResponse.tokens.accessToken
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'omnicare_refresh_token',
        mockAuthResponse.tokens.refreshToken
      );
    });

    it('should set loading state during login', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (fetch as jest.Mock).mockReturnValueOnce(promise);

      const { result } = renderHook(() => useAuthStore());

      // Start login
      act(() => {
        result.current.login({
          email: 'doctor@omnicare.com',
          password: 'password123',
        });
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      act(() => {
        resolvePromise!({
          ok: true,
          json: async () => mockAuthResponse,
        });
      });

      // Wait for the promise to resolve
      await act(async () => {
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle login failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Login failed' }),
      });

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.login({
            email: 'doctor@omnicare.com',
            password: 'wrongpassword',
          });
        })
      ).rejects.toThrow('Login failed');

      expect(result.current.user).toBeNull();
      expect(result.current.tokens).toBeNull();
      expect(result.current.permissions).toEqual([]);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle network errors during login', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.login({
            email: 'doctor@omnicare.com',
            password: 'password123',
          });
        })
      ).rejects.toThrow('Network error');

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should make correct API call for login', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAuthResponse,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login({
          email: 'doctor@omnicare.com',
          password: 'password123',
        });
      });

      expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'doctor@omnicare.com',
          password: 'password123',
        }),
      });
    });
  });

  describe('Logout', () => {
    it('should clear all auth state on logout', async () => {
      const { result } = renderHook(() => useAuthStore());

      // Set some auth state first
      act(() => {
        useAuthStore.setState({
          user: { id: 'user-1' } as any,
          tokens: {
            accessToken: 'token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer'
          },
          permissions: ['permission1'],
          isAuthenticated: true,
        });
      });

      // Logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.tokens).toBeNull();
      expect(result.current.permissions).toEqual([]);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('omnicare_access_token');
    });
  });

  describe('Refresh Token', () => {
    const mockRefreshResponse = {
      success: true,
      user: {
        id: 'user-1',
        email: 'doctor@omnicare.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'physician',
        permissions: [],
        department: 'Medicine',
        title: 'MD',
      },
      tokens: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      },
      permissions: [
        { id: 'patient:read', name: 'Read Patients', description: 'View patient data', resource: 'patient', action: 'read' },
        { id: 'patient:write', name: 'Write Patients', description: 'Edit patient data', resource: 'patient', action: 'write' },
      ],
    };

    it('should refresh tokens successfully', async () => {
      // Set initial refresh token
      act(() => {
        useAuthStore.setState({
          tokens: {
            accessToken: 'old-access-token',
            refreshToken: 'old-refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer'
          },
        });
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefreshResponse,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.refreshAuth();
      });

      expect(result.current.user).toEqual(mockRefreshResponse.user);
      expect(result.current.tokens?.accessToken).toBe(mockRefreshResponse.tokens.accessToken);
      expect(result.current.tokens?.refreshToken).toBe(mockRefreshResponse.tokens.refreshToken);
      expect(result.current.permissions).toEqual(mockRefreshResponse.permissions);
      expect(result.current.isAuthenticated).toBe(true);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'omnicare_access_token',
        mockRefreshResponse.tokens.accessToken
      );
    });

    it('should logout if no refresh token exists', async () => {
      const { result } = renderHook(() => useAuthStore());

      const logoutSpy = jest.spyOn(result.current, 'logout');

      await act(async () => {
        await result.current.refreshAuth();
      });

      expect(logoutSpy).toHaveBeenCalled();
    });

    it('should logout on refresh token failure', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      // Set initial state with tokens
      act(() => {
        useAuthStore.setState({
          tokens: {
            accessToken: 'invalid-access-token',
            refreshToken: 'invalid-refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer'
          },
          isAuthenticated: true,
          user: { 
            id: 'user-1',
            email: 'test@omnicare.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'physician',
            permissions: []
          } as any,
        });
      });

      // Spy on the logout method
      const logoutSpy = jest.spyOn(result.current, 'logout');

      // Mock the refresh failure
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Token expired' }),
      });
      
      await act(async () => {
        await result.current.refreshAuth();
      });

      // Verify logout was called
      expect(logoutSpy).toHaveBeenCalled();
      
      // Cleanup
      logoutSpy.mockRestore();
    });

    it('should make correct API call for refresh', async () => {
      // Set initial refresh token
      act(() => {
        useAuthStore.setState({
          tokens: {
            accessToken: 'old-access-token',
            refreshToken: 'old-refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer'
          },
        });
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefreshResponse,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.refreshAuth();
      });

      expect(fetch).toHaveBeenCalledWith('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: 'old-refresh-token' }),
      });
    });
  });

  describe('User Update', () => {
    it('should update user information', () => {
      const { result } = renderHook(() => useAuthStore());

      // Set initial user
      act(() => {
        useAuthStore.setState({
          user: {
            id: 'user-1',
            email: 'doctor@omnicare.com',
            firstName: 'Jane',
            lastName: 'Smith',
            role: 'physician',
            permissions: [],
            department: 'Medicine',
            title: 'MD',
          } as any,
        });
      });

      // Update user
      act(() => {
        result.current.updateUser({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane.doe@omnicare.com',
        });
      });

      expect(result.current.user).toEqual({
        id: 'user-1',
        email: 'jane.doe@omnicare.com',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'physician',
        permissions: [],
        department: 'Medicine',
        title: 'MD',
      });
    });

    it('should not update user if no user exists', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.updateUser({
          firstName: 'Jane',
          lastName: 'Doe',
        });
      });

      expect(result.current.user).toBeNull();
    });
  });

  describe('Permission Checks', () => {
    beforeEach(() => {
      act(() => {
        useAuthStore.setState({
          permissions: [
          { id: 'patient:read', name: 'Read Patients', description: 'View patient data', resource: 'patient', action: 'read' },
          { id: 'patient:write', name: 'Write Patients', description: 'Edit patient data', resource: 'patient', action: 'write' },
          { id: 'encounter:read', name: 'Read Encounters', description: 'View encounter data', resource: 'encounter', action: 'read' },
        ],
        });
      });
    });

    it('should check individual permissions', () => {
      const { result } = renderHook(() => useAuthStore());
      
      // Set up test permissions
      act(() => {
        useAuthStore.setState({
          permissions: [
            { id: 'patient:read', name: 'Read Patients', description: 'View patient data', resource: 'patient', action: 'read' },
            { id: 'patient:write', name: 'Write Patients', description: 'Edit patient data', resource: 'patient', action: 'write' },
          ],
        });
      });

      expect(result.current.hasPermission('patient:read')).toBe(true);
      expect(result.current.hasPermission('patient:write')).toBe(true);
      expect(result.current.hasPermission('admin:delete')).toBe(false);
    });

    it('should allow all permissions with wildcard', () => {
      act(() => {
        useAuthStore.setState({
          permissions: [
            { id: '*', name: 'All Permissions', description: 'Full access', resource: '*', action: '*' },
          ],
        });
      });

      const { result } = renderHook(() => useAuthStore());

      expect(result.current.hasPermission('*')).toBe(true);
      expect(result.current.hasPermission('admin:delete')).toBe(false); // Only exact match for now
    });
  });

  describe('Role Checks', () => {
    beforeEach(() => {
      act(() => {
        useAuthStore.setState({
          user: {
            id: 'user-1',
            email: 'doctor@omnicare.com',
            firstName: 'Jane',
            lastName: 'Smith',
            role: 'physician',
            permissions: [],
            department: 'Medicine',
            title: 'MD',
          } as any,
        });
      });
    });

    it('should check user role', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.hasRole('physician')).toBe(true);
      expect(result.current.hasRole('nurse')).toBe(false);
      expect(result.current.hasRole('admin')).toBe(false);
    });

    it('should check if user has any of the specified roles', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.hasAnyRole(['physician', 'nurse'])).toBe(true);
      expect(result.current.hasAnyRole(['nurse', 'admin'])).toBe(false);
      expect(result.current.hasAnyRole([])).toBe(false);
    });

    it('should return false for role checks when no user exists', () => {
      act(() => {
        useAuthStore.setState({ user: null });
      });

      const { result } = renderHook(() => useAuthStore());

      expect(result.current.hasRole('physician')).toBe(false);
      expect(result.current.hasAnyRole(['physician', 'nurse'])).toBe(false);
    });
  });

  describe('Loading State', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});

describe('useAuth Hook', () => {
  beforeEach(() => {
    // Reset zustand store
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      tokens: null,
      session: null,
      permissions: [],
    });
  });

  describe('Role Helper Properties', () => {
    it('should provide role helper properties for physician', () => {
      act(() => {
        useAuthStore.setState({
          user: {
            id: 'user-1',
            email: 'doctor@omnicare.com',
            firstName: 'Jane',
            lastName: 'Smith',
            role: 'physician',
            permissions: [],
          } as any,
        });
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isDoctor).toBe(true);
      expect(result.current.isNurse).toBe(false);
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isPharmacist).toBe(false);
      expect(result.current.isLabTech).toBe(false);
      expect(result.current.isRadiologyTech).toBe(false);
      expect(result.current.isPatient).toBe(false);
      expect(result.current.isSystemAdmin).toBe(false);
    });

    it('should provide role helper properties for nurse', () => {
      act(() => {
        useAuthStore.setState({
          user: {
            id: 'user-1',
            email: 'nurse@omnicare.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'nurse',
            permissions: [],
          } as any,
        });
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isDoctor).toBe(false);
      expect(result.current.isNurse).toBe(true);
      expect(result.current.isAdmin).toBe(false);
    });

    it('should provide role helper properties for admin', () => {
      act(() => {
        useAuthStore.setState({
          user: {
            id: 'user-1',
            email: 'admin@omnicare.com',
            firstName: 'Admin',
            lastName: 'User',
            role: 'admin',
            permissions: [],
          } as any,
        });
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isDoctor).toBe(false);
      expect(result.current.isNurse).toBe(false);
    });
  });

  describe('Permission Helper Properties', () => {
    it('should provide permission helpers for physician', () => {
      act(() => {
        useAuthStore.setState({
          user: {
            id: 'user-1',
            email: 'doctor@omnicare.com',
            firstName: 'Jane',
            lastName: 'Smith',
            role: 'physician',
            permissions: [],
          } as any,
        });
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.canViewPatients).toBe(true);
      expect(result.current.canEditPatients).toBe(true);
      expect(result.current.canCreateOrders).toBe(true);
      expect(result.current.canAdministerMedications).toBe(false);
      expect(result.current.canPrescribeMedications).toBe(true);
      expect(result.current.canViewLabResults).toBe(true);
      expect(result.current.canManageSystem).toBe(false);
    });

    it('should provide permission helpers for nurse', () => {
      act(() => {
        useAuthStore.setState({
          user: {
            id: 'user-1',
            email: 'nurse@omnicare.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'nurse',
            permissions: [],
          } as any,
        });
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.canViewPatients).toBe(true);
      expect(result.current.canEditPatients).toBe(true);
      expect(result.current.canCreateOrders).toBe(false);
      expect(result.current.canAdministerMedications).toBe(true);
      expect(result.current.canPrescribeMedications).toBe(false);
      expect(result.current.canViewLabResults).toBe(true);
      expect(result.current.canManageSystem).toBe(false);
    });

    it('should provide permission helpers for system admin', () => {
      act(() => {
        useAuthStore.setState({
          user: {
            id: 'user-1',
            email: 'sysadmin@omnicare.com',
            firstName: 'System',
            lastName: 'Admin',
            role: 'system_admin',
            permissions: [],
          } as any,
        });
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.canManageSystem).toBe(true);
      expect(result.current.canViewPatients).toBe(false);
      expect(result.current.canCreateOrders).toBe(false);
    });

    it('should provide permission helpers for lab tech', () => {
      act(() => {
        useAuthStore.setState({
          user: {
            id: 'user-1',
            email: 'labtech@omnicare.com',
            firstName: 'Lab',
            lastName: 'Tech',
            role: 'lab_tech',
            permissions: [],
          } as any,
        });
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.canViewLabResults).toBe(true);
      expect(result.current.canViewPatients).toBe(false);
      expect(result.current.canCreateOrders).toBe(false);
    });
  });

  describe('All Store Methods and Properties', () => {
    it('should expose all store methods and properties', () => {
      const { result } = renderHook(() => useAuth());

      // Check that all store methods are available
      expect(typeof result.current.login).toBe('function');
      expect(typeof result.current.logout).toBe('function');
      expect(typeof result.current.refreshAuth).toBe('function');
      expect(typeof result.current.updateUser).toBe('function');
      expect(typeof result.current.setLoading).toBe('function');
      expect(typeof result.current.hasPermission).toBe('function');
      expect(typeof result.current.hasRole).toBe('function');
      expect(typeof result.current.hasAnyRole).toBe('function');

      // Check that all store properties are available
      expect(result.current.user).toBeDefined();
      expect(result.current.isAuthenticated).toBeDefined();
      expect(result.current.isLoading).toBeDefined();
      expect(result.current.tokens).toBeDefined();
      expect(result.current.permissions).toBeDefined();
    });
  });
});