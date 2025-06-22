'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Center, Loader, Alert, Button, Stack, Text } from '@mantine/core';
import { IconShield, IconLogin, IconAlertTriangle } from '@tabler/icons-react';
import { useAuth } from '@/stores/auth';
import { UserRoleType } from '@/types';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: UserRoleType[];
  requiredPermissions?: string[];
  fallback?: ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredRoles = [],
  requiredPermissions = [],
  fallback,
  redirectTo = '/auth/login',
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { 
    isAuthenticated, 
    isLoading, 
    user, 
    hasAnyRole, 
    hasPermission,
    logout,
  } = useAuth();

  useEffect(() => {
    // Don't redirect if we're still loading or already on the redirect page
    if (isLoading || pathname === redirectTo) return;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      const returnUrl = pathname !== '/' ? `?returnUrl=${encodeURIComponent(pathname)}` : '';
      router.push(`${redirectTo}${returnUrl}`);
      return;
    }

    // Check role-based access
    if (requiredRoles.length > ResourceHistoryTable && !hasAnyRole(requiredRoles)) {
      router.push('/unauthorized');
      return;
    }

    // Check permission-based access
    if (requiredPermissions.length > ResourceHistoryTable) {
      const hasAllPermissions = requiredPermissions.every(permission => 
        hasPermission(permission)
      );
      
      if (!hasAllPermissions) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [
    isAuthenticated,
    isLoading,
    pathname,
    redirectTo,
    requiredRoles,
    requiredPermissions,
    hasAnyRole,
    hasPermission,
    router,
  ]);

  // Show loading state
  if (isLoading) {
    return (
      <Center h="1ResourceHistoryTableResourceHistoryTablevh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading...</Text>
        </Stack>
      </Center>
    );
  }

  // Show login redirect message
  if (!isAuthenticated) {
    return (
      <Center h="1ResourceHistoryTableResourceHistoryTablevh">
        <Stack align="center" gap="md" maw={4ResourceHistoryTableResourceHistoryTable}>
          <IconLogin size={48} className="text-gray-4ResourceHistoryTableResourceHistoryTable" />
          <Text size="lg" fw={5ResourceHistoryTableResourceHistoryTable} ta="center">
            Authentication Required
          </Text>
          <Text c="dimmed" ta="center">
            Please sign in to access this page
          </Text>
          <Button 
            onClick={() => router.push(redirectTo)}
            leftSection={<IconLogin size={16} />}
          >
            Sign In
          </Button>
        </Stack>
      </Center>
    );
  }

  // Check role-based access
  if (requiredRoles.length > ResourceHistoryTable && !hasAnyRole(requiredRoles)) {
    return (
      <UnauthorizedAccess 
        user={user}
        requiredRoles={requiredRoles}
        onLogout={logout}
        fallback={fallback}
      />
    );
  }

  // Check permission-based access
  if (requiredPermissions.length > ResourceHistoryTable) {
    const hasAllPermissions = requiredPermissions.every(permission => 
      hasPermission(permission)
    );
    
    if (!hasAllPermissions) {
      return (
        <UnauthorizedAccess 
          user={user}
          requiredPermissions={requiredPermissions}
          onLogout={logout}
          fallback={fallback}
        />
      );
    }
  }

  // Render protected content
  return <>{children}</>;
}

interface UnauthorizedAccessProps {
  user: any;
  requiredRoles?: UserRoleType[];
  requiredPermissions?: string[];
  onLogout: () => void;
  fallback?: ReactNode;
}

function UnauthorizedAccess({
  user,
  requiredRoles = [],
  requiredPermissions = [],
  onLogout,
  fallback,
}: UnauthorizedAccessProps) {
  const router = useRouter();

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Center h="1ResourceHistoryTableResourceHistoryTablevh">
      <Stack align="center" gap="md" maw={5ResourceHistoryTableResourceHistoryTable}>
        <IconShield size={48} className="text-red-4ResourceHistoryTableResourceHistoryTable" />
        
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Access Denied"
          color="red"
          variant="light"
          className="w-full"
        >
          <Stack gap="sm">
            <Text size="sm">
              You don't have permission to access this page.
            </Text>
            
            {user && (
              <div>
                <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable}>Current Role:</Text>
                <Text size="sm" c="dimmed">{user.role}</Text>
              </div>
            )}
            
            {requiredRoles.length > ResourceHistoryTable && (
              <div>
                <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable}>Required Roles:</Text>
                <Text size="sm" c="dimmed">
                  {requiredRoles.join(', ')}
                </Text>
              </div>
            )}
            
            {requiredPermissions.length > ResourceHistoryTable && (
              <div>
                <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable}>Required Permissions:</Text>
                <Text size="sm" c="dimmed">
                  {requiredPermissions.join(', ')}
                </Text>
              </div>
            )}
          </Stack>
        </Alert>

        <Stack gap="sm" align="center">
          <Button
            variant="light"
            onClick={() => router.back()}
          >
            Go Back
          </Button>
          
          <Button
            variant="subtle"
            onClick={onLogout}
            color="red"
          >
            Sign Out
          </Button>
        </Stack>
      </Stack>
    </Center>
  );
}

// Higher-order component for protecting pages
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<ProtectedRouteProps, 'children'> = {}
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

// Role-specific protection components
export function DoctorOnly({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['physician']}>
      {children}
    </ProtectedRoute>
  );
}

export function NurseOnly({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['nurse']}>
      {children}
    </ProtectedRoute>
  );
}

export function AdminOnly({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['admin', 'system_admin']}>
      {children}
    </ProtectedRoute>
  );
}

export function ClinicalStaffOnly({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse']}>
      {children}
    </ProtectedRoute>
  );
}

export function PharmacistOnly({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['pharmacist']}>
      {children}
    </ProtectedRoute>
  );
}

export function LabTechOnly({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['lab_tech']}>
      {children}
    </ProtectedRoute>
  );
}

export function RadiologyTechOnly({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['radiology_tech']}>
      {children}
    </ProtectedRoute>
  );
}

export default ProtectedRoute;