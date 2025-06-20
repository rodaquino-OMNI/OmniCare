import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, UserRole, Permission } from '@/types';
import { getRolePermissions, hasPermission } from '@/auth/role-permissions';

interface SessionInfo {
  sessionId: string;
  expiresAt: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tokens: AuthTokens | null;
  session: SessionInfo | null;
  permissions: Permission[];
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  getCurrentUser: () => Promise<void>;
}

interface LoginCredentials {
  username: string;
  password: string;
  mfaToken?: string;
}

interface AuthResponse {
  success: boolean;
  tokens: AuthTokens;
  user: User;
  session: SessionInfo;
  requiresMfa?: boolean;
  message?: string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      tokens: null,
      session: null,
      permissions: [],

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true });
        
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Login failed');
          }

          if (!data.success) {
            if (data.requiresMfa) {
              set({ isLoading: false });
              throw new Error('MFA_REQUIRED');
            }
            throw new Error(data.message || 'Login failed');
          }

          // Calculate user permissions
          const userPermissions = getRolePermissions(data.user.role);

          set({
            user: data.user,
            tokens: data.tokens,
            session: data.session,
            permissions: userPermissions,
            isAuthenticated: true,
            isLoading: false,
          });

          // Store tokens for API requests
          if (typeof window !== 'undefined') {
            localStorage.setItem('omnicare_access_token', data.tokens.accessToken);
            localStorage.setItem('omnicare_refresh_token', data.tokens.refreshToken);
          }
        } catch (error) {
          console.error('Login error:', error);
          set({
            user: null,
            tokens: null,
            session: null,
            permissions: [],
            isAuthenticated: false,
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        const { tokens } = get();
        
        try {
          // Call logout endpoint to destroy session
          if (tokens?.accessToken) {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json',
              },
            });
          }
        } catch (error) {
          console.error('Logout error:', error);
          // Continue with local logout even if server logout fails
        }

        set({
          user: null,
          tokens: null,
          session: null,
          permissions: [],
          isAuthenticated: false,
          isLoading: false,
        });

        // Clear tokens from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('omnicare_access_token');
          localStorage.removeItem('omnicare_refresh_token');
        }
      },

      refreshAuth: async () => {
        const { tokens } = get();
        
        if (!tokens?.refreshToken) {
          await get().logout();
          return;
        }

        try {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken: tokens.refreshToken }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || 'Token refresh failed');
          }

          set({
            tokens: data.tokens,
            isAuthenticated: true,
          });

          // Update tokens in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('omnicare_access_token', data.tokens.accessToken);
            localStorage.setItem('omnicare_refresh_token', data.tokens.refreshToken);
          }
        } catch (error) {
          console.error('Token refresh error:', error);
          await get().logout();
        }
      },

      updateUser: (userUpdate: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({
            user: { ...user, ...userUpdate },
          });
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      getCurrentUser: async () => {
        const { tokens } = get();
        
        if (!tokens?.accessToken) {
          return;
        }

        try {
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${tokens.accessToken}`,
            },
          });

          const data = await response.json();

          if (response.ok && data.success) {
            const userPermissions = getRolePermissions(data.user.role);
            
            set({
              user: data.user,
              permissions: userPermissions,
              isAuthenticated: true,
            });
          } else {
            await get().logout();
          }
        } catch (error) {
          console.error('Get current user error:', error);
          await get().logout();
        }
      },

      hasPermission: (permission: Permission) => {
        const { permissions, user } = get();
        return user ? hasPermission(user.role, permission) : false;
      },

      hasRole: (role: UserRole) => {
        const { user } = get();
        return user?.role === role;
      },

      hasAnyRole: (roles: UserRole[]) => {
        const { user } = get();
        return user ? roles.includes(user.role) : false;
      },
    }),
    {
      name: 'omnicare-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        session: state.session,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Helper hook for checking authentication status
export const useAuth = () => {
  const store = useAuthStore();
  
  return {
    ...store,
    isPhysician: store.hasRole(UserRole.PHYSICIAN),
    isNurse: store.hasRole(UserRole.NURSING_STAFF),
    isAdmin: store.hasRole(UserRole.ADMINISTRATIVE_STAFF),
    isSystemAdmin: store.hasRole(UserRole.SYSTEM_ADMINISTRATOR),
    isPharmacist: store.hasRole(UserRole.PHARMACIST),
    isLabTech: store.hasRole(UserRole.LABORATORY_TECHNICIAN),
    isRadiologyTech: store.hasRole(UserRole.RADIOLOGY_TECHNICIAN),
    isPatient: store.hasRole(UserRole.PATIENT),
    
    // Common permission checks
    canViewPatients: store.hasAnyRole([UserRole.PHYSICIAN, UserRole.NURSING_STAFF, UserRole.SYSTEM_ADMINISTRATOR]),
    canEditPatients: store.hasAnyRole([UserRole.PHYSICIAN, UserRole.NURSING_STAFF]),
    canCreateOrders: store.hasRole(UserRole.PHYSICIAN),
    canAdministerMedications: store.hasRole(UserRole.NURSING_STAFF),
    canPrescribeMedications: store.hasRole(UserRole.PHYSICIAN),
    canViewLabResults: store.hasAnyRole([UserRole.PHYSICIAN, UserRole.NURSING_STAFF, UserRole.LABORATORY_TECHNICIAN]),
    canManageSystem: store.hasRole(UserRole.SYSTEM_ADMINISTRATOR),
    canManageBilling: store.hasRole(UserRole.ADMINISTRATIVE_STAFF),
  };
};

// Auto-refresh token on app load
if (typeof window !== 'undefined') {
  const store = useAuthStore.getState();
  const savedTokens = localStorage.getItem('omnicare_access_token');
  
  if (savedTokens && store.isAuthenticated) {
    // Get current user info on app load
    store.getCurrentUser();
    
    // Set up automatic token refresh
    const refreshInterval = setInterval(() => {
      const currentStore = useAuthStore.getState();
      if (currentStore.isAuthenticated && currentStore.tokens) {
        // Check if token is close to expiring (refresh 5 minutes before expiry)
        const expiryTime = Date.now() + (currentStore.tokens.expiresIn * 1000);
        const refreshThreshold = 5 * 60 * 1000; // 5 minutes
        
        if (expiryTime - Date.now() < refreshThreshold) {
          currentStore.refreshAuth();
        }
      } else {
        clearInterval(refreshInterval);
      }
    }, 60000); // Check every minute
  }
}