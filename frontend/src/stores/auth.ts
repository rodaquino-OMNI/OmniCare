import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, UserRole, Permission } from '@/types';
import { getRolePermissions } from '@/auth/unified-role-permissions';
import { mapToFrontendRole } from '@/auth/role-mappings';
import { getErrorMessage, getDisplayErrorMessage } from '@/utils/error.utils';

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
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  getCurrentUser: () => Promise<void>;
}

interface LoginCredentials {
  email: string;
  password: string;
  mfaToken?: string;
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

          // Map backend role to frontend role
          const frontendRole = mapToFrontendRole(data.user.role);
          const userData = {
            ...data.user,
            role: frontendRole,
            // Convert date string to Date object if present
            passwordChangedAt: data.user.passwordChangedAt ? new Date(data.user.passwordChangedAt) : undefined
          };
          
          // Use permissions from API response or calculate from role
          const userPermissions = data.permissions || getRolePermissions(frontendRole);

          set({
            user: userData,
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
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error);
          console.error('Login error:', errorMessage, error);
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
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error);
          console.error('Logout error:', errorMessage, error);
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

          // Map backend role to frontend role
          const frontendRole = mapToFrontendRole(data.user.role);
          const userData = {
            ...data.user,
            role: frontendRole,
            // Convert date string to Date object if present
            passwordChangedAt: data.user.passwordChangedAt ? new Date(data.user.passwordChangedAt) : undefined
          };
          
          set({
            user: userData,
            tokens: data.tokens,
            permissions: data.permissions || getRolePermissions(frontendRole),
            isAuthenticated: true,
          });

          // Update tokens in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('omnicare_access_token', data.tokens.accessToken);
            localStorage.setItem('omnicare_refresh_token', data.tokens.refreshToken);
          }
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error);
          console.error('Token refresh error:', errorMessage, error);
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
            // Map backend role to frontend role
            const frontendRole = mapToFrontendRole(data.user.role);
            const userData = {
              ...data.user,
              role: frontendRole,
              // Convert date string to Date object
              passwordChangedAt: data.user.passwordChangedAt ? new Date(data.user.passwordChangedAt) : new Date()
            };
            const userPermissions = getRolePermissions(frontendRole);
            
            set({
              user: userData,
              permissions: userPermissions,
              isAuthenticated: true,
            });
          } else {
            await get().logout();
          }
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error);
          console.error('Get current user error:', errorMessage, error);
          await get().logout();
        }
      },

      hasPermission: (permissionId: string) => {
        const { permissions } = get();
        return permissions.some(p => p.id === permissionId);
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
      storage: createJSONStorage(() => 
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        session: state.session,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
      skipHydration: true,
    }
  )
);

// Helper hook for checking authentication status
export const useAuth = () => {
  const store = useAuthStore();
  
  return {
    ...store,
    isPhysician: store.hasRole('physician'),
    isDoctor: store.hasRole('physician'), // Alias for compatibility
    isNurse: store.hasRole('nurse'),
    isAdmin: store.hasRole('admin'),
    isSystemAdmin: store.hasRole('system_admin'),
    isPharmacist: store.hasRole('pharmacist'),
    isLabTech: store.hasRole('lab_tech'),
    isRadiologyTech: store.hasRole('radiology_tech'),
    isPatient: store.hasRole('patient'),
    
    // Common permission checks
    canViewPatients: store.hasAnyRole(['physician', 'nurse']),
    canEditPatients: store.hasAnyRole(['physician', 'nurse']),
    canCreateOrders: store.hasRole('physician'),
    canAdministerMedications: store.hasRole('nurse'),
    canPrescribeMedications: store.hasRole('physician'),
    canViewLabResults: store.hasAnyRole(['physician', 'nurse', 'lab_tech']),
    canManageSystem: store.hasRole('system_admin'),
    canManageBilling: store.hasRole('admin'),
  };
};

// Initialize auth store with proper SSR handling
export const initializeAuthStore = () => {
  if (typeof window === 'undefined') return;
  
  const store = useAuthStore.getState();
  const savedTokens = localStorage.getItem('omnicare_access_token');
  
  // Check for interrupted session
  const sessionData = localStorage.getItem('auth_session_data');
  let wasInterrupted = false;
  
  if (sessionData) {
    try {
      const session = JSON.parse(sessionData);
      const timeSinceLastActivity = Date.now() - session.lastActivity;
      const maxResumeTime = 30 * 60 * 1000; // 30 minutes
      
      if (timeSinceLastActivity < maxResumeTime && session.wasAuthenticated) {
        wasInterrupted = true;
      }
    } catch (error) {
      console.error('Failed to parse session data:', error);
    }
  }
  
  if (savedTokens && (store.isAuthenticated || wasInterrupted)) {
    // Restore session if interrupted
    if (wasInterrupted && !store.isAuthenticated) {
      // Resuming interrupted authentication session
      // Try to refresh the token to restore session
      store.refreshAuth();
    } else {
      // Get current user info on app load
      store.getCurrentUser();
    }
    
    // Set up automatic token refresh with session monitoring
    const refreshInterval = setInterval(() => {
      const currentStore = useAuthStore.getState();
      if (currentStore.isAuthenticated && currentStore.tokens) {
        // Save session activity
        const sessionData = {
          lastActivity: Date.now(),
          wasAuthenticated: true,
          tokenExpiry: Date.now() + (currentStore.tokens.expiresIn * 1000)
        };
        localStorage.setItem('auth_session_data', JSON.stringify(sessionData));
        
        // Check if token is close to expiring (refresh 5 minutes before expiry)
        const expiryTime = Date.now() + (currentStore.tokens.expiresIn * 1000);
        const refreshThreshold = 5 * 60 * 1000; // 5 minutes
        
        if (expiryTime - Date.now() < refreshThreshold) {
          currentStore.refreshAuth();
        }
      } else {
        // Clear session data when not authenticated
        localStorage.removeItem('auth_session_data');
        clearInterval(refreshInterval);
      }
    }, 60000); // Check every minute
    
    // Handle page visibility for session management
    document.addEventListener('visibilitychange', () => {
      const currentStore = useAuthStore.getState();
      if (currentStore.isAuthenticated) {
        const sessionData = {
          lastActivity: Date.now(),
          wasAuthenticated: true,
          tokenExpiry: currentStore.tokens ? Date.now() + (currentStore.tokens.expiresIn * 1000) : 0,
          hidden: document.hidden
        };
        localStorage.setItem('auth_session_data', JSON.stringify(sessionData));
      }
    });
    
    // Handle before unload
    window.addEventListener('beforeunload', () => {
      const currentStore = useAuthStore.getState();
      if (currentStore.isAuthenticated) {
        const sessionData = {
          lastActivity: Date.now(),
          wasAuthenticated: true,
          tokenExpiry: currentStore.tokens ? Date.now() + (currentStore.tokens.expiresIn * 1000) : 0,
          isUnloading: true
        };
        localStorage.setItem('auth_session_data', JSON.stringify(sessionData));
      }
    });
  } else {
    // Clean up session data if no saved tokens
    localStorage.removeItem('auth_session_data');
  }
};