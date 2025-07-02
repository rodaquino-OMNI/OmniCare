import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, usePathname } from 'next/navigation';
import { 
  ProtectedRoute, 
  withProtectedRoute,
  DoctorOnly,
  NurseOnly,
  AdminOnly,
  ClinicalStaffOnly,
  PharmacistOnly,
  LabTechOnly,
  RadiologyTechOnly
} from '../ProtectedRoute';
import { useAuth } from '@/stores/auth';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn()
}));

// Mock auth store
jest.mock('@/stores/auth', () => ({
  useAuth: jest.fn()
}));

// Mock Mantine components with proper TypeScript support
jest.mock('@mantine/core', () => ({
  Center: ({ children, ...props }: any) => <div data-testid="center" {...props}>{children}</div>,
  Loader: (props: any) => <div data-testid="loader" {...props}>Loading...</div>,
  Alert: ({ children, title, ...props }: any) => (
    <div data-testid="alert" data-title={title} {...props}>
      {title && <div data-testid="alert-title">{title}</div>}
      {children}
    </div>
  ),
  Button: ({ children, onClick, ...props }: any) => (
    <button data-testid="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Stack: ({ children, ...props }: any) => <div data-testid="stack" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>
}));

// Mock icons
jest.mock('@tabler/icons-react', () => ({
  IconShield: () => <div data-testid="icon-shield">Shield</div>,
  IconLogin: () => <div data-testid="icon-login">Login</div>,
  IconAlertTriangle: () => <div data-testid="icon-alert">Alert</div>
}));

describe('ProtectedRoute', () => {
  let mockPush: jest.Mock;
  let mockBack: jest.Mock;
  let mockLogout: jest.Mock;
  let mockHasAnyRole: jest.Mock;
  let mockHasPermission: jest.Mock;

  const defaultAuthState = {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    hasAnyRole: jest.fn(),
    hasPermission: jest.fn(),
    logout: jest.fn()
  };

  beforeEach(() => {
    // Create fresh mocks for each test
    mockPush = jest.fn();
    mockBack = jest.fn();
    mockLogout = jest.fn();
    mockHasAnyRole = jest.fn();
    mockHasPermission = jest.fn();
    
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      back: mockBack
    });

    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    (useAuth as jest.Mock).mockReturnValue({
      ...defaultAuthState,
      hasAnyRole: mockHasAnyRole,
      hasPermission: mockHasPermission,
      logout: mockLogout
    });
  });

  afterEach(() => {
    // Clean up after each test
    cleanup();
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading state when auth is loading', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...defaultAuthState,
        isLoading: true
      });

      const { container } = render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      // Wait for the component to render
      await waitFor(() => {
        expect(screen.getByTestId('loader')).toBeInTheDocument();
      });

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      
      // Ensure only one loader is rendered
      expect(container.querySelectorAll('[data-testid="loader"]')).toHaveLength(1);
    });
  });

  describe('Unauthenticated Access', () => {
    it('should redirect to login when not authenticated', async () => {
      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/login?returnUrl=%2Fdashboard');
      });
      
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    it('should redirect to custom redirect URL', async () => {
      render(
        <ProtectedRoute redirectTo="/custom-login">
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/custom-login?returnUrl=%2Fdashboard');
      });
      
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    it('should not include returnUrl for root path', async () => {
      (usePathname as jest.Mock).mockReturnValue('/');

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/login');
      });
      
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    it('should show login UI when not authenticated and not redirecting', async () => {
      // Simulate being on the redirect page already
      (usePathname as jest.Mock).mockReturnValue('/auth/login');

      const { container } = render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Authentication Required')).toBeInTheDocument();
      });

      expect(screen.getByText('Please sign in to access this page')).toBeInTheDocument();
      expect(screen.getByTestId('icon-login')).toBeInTheDocument();
      
      // Ensure only one of each element
      expect(container.querySelectorAll('[data-testid="icon-login"]')).toHaveLength(1);
    });

    it('should navigate to login when sign in button is clicked', async () => {
      const user = userEvent.setup();
      (usePathname as jest.Mock).mockReturnValue('/auth/login');

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      });

      const signInButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(signInButton);

      expect(mockPush).toHaveBeenCalledWith('/auth/login');
    });
  });

  describe('Authenticated Access', () => {
    const authenticatedUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'physician',
      firstName: 'John',
      lastName: 'Doe'
    };

    beforeEach(() => {
      mockHasAnyRole.mockReturnValue(true);
      mockHasPermission.mockReturnValue(true);
      
      (useAuth as jest.Mock).mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: true,
        user: authenticatedUser,
        hasAnyRole: mockHasAnyRole,
        hasPermission: mockHasPermission,
        logout: mockLogout
      });
    });

    it('should render children when authenticated with no restrictions', async () => {
      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
      
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should render children when user has required roles', async () => {
      render(
        <ProtectedRoute requiredRoles={['physician']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
      
      expect(mockHasAnyRole).toHaveBeenCalledWith(['physician']);
    });

    it('should render children when user has required permissions', async () => {
      render(
        <ProtectedRoute requiredPermissions={['patient:read']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
      
      expect(mockHasPermission).toHaveBeenCalledWith('patient:read');
    });
  });

  describe('Role-based Access Control', () => {
    const authenticatedUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'nurse',
      firstName: 'Jane',
      lastName: 'Doe'
    };

    beforeEach(() => {
      mockHasAnyRole.mockReturnValue(false);
      mockHasPermission.mockReturnValue(true);
      
      (useAuth as jest.Mock).mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: true,
        user: authenticatedUser,
        hasAnyRole: mockHasAnyRole,
        hasPermission: mockHasPermission,
        logout: mockLogout
      });
    });

    it('should redirect to unauthorized when user lacks required roles', async () => {
      render(
        <ProtectedRoute requiredRoles={['physician']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/unauthorized');
      });
      
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    it('should show unauthorized access UI when user lacks required roles', async () => {
      // Simulate being on unauthorized page already
      (usePathname as jest.Mock).mockReturnValue('/unauthorized');

      const { container } = render(
        <ProtectedRoute requiredRoles={['physician']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByTestId('alert-title')).toBeInTheDocument();
      });

      expect(screen.getByTestId('alert-title')).toHaveTextContent('Access Denied');
      expect(screen.getByText("You don\'t have permission to access this page.")).toBeInTheDocument();
      expect(screen.getByText('Current Role:')).toBeInTheDocument();
      expect(screen.getByText('nurse')).toBeInTheDocument();
      expect(screen.getByText('Required Roles:')).toBeInTheDocument();
      expect(screen.getByText('physician')).toBeInTheDocument();
      
      // Ensure only one alert is rendered
      expect(container.querySelectorAll('[data-testid="alert"]')).toHaveLength(1);
    });

    it('should show go back button in unauthorized access UI', async () => {
      const user = userEvent.setup();
      (usePathname as jest.Mock).mockReturnValue('/unauthorized');

      render(
        <ProtectedRoute requiredRoles={['physician']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
      });

      const goBackButton = screen.getByRole('button', { name: /go back/i });
      await user.click(goBackButton);

      expect(mockBack).toHaveBeenCalled();
    });

    it('should show sign out button in unauthorized access UI', async () => {
      const user = userEvent.setup();
      (usePathname as jest.Mock).mockReturnValue('/unauthorized');

      render(
        <ProtectedRoute requiredRoles={['physician']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
      });

      const signOutButton = screen.getByRole('button', { name: /sign out/i });
      await user.click(signOutButton);

      expect(mockLogout).toHaveBeenCalled();
    });

    it('should render custom fallback when provided', async () => {
      (usePathname as jest.Mock).mockReturnValue('/unauthorized');

      render(
        <ProtectedRoute 
          requiredRoles={['physician']}
          fallback={<div>Custom Unauthorized Message</div>}
        >
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Custom Unauthorized Message')).toBeInTheDocument();
      });

      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    });
  });

  describe('Permission-based Access Control', () => {
    const authenticatedUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'physician',
      firstName: 'John',
      lastName: 'Doe'
    };

    beforeEach(() => {
      mockHasAnyRole.mockReturnValue(true);
      mockHasPermission.mockReturnValue(false);
      
      (useAuth as jest.Mock).mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: true,
        user: authenticatedUser,
        hasAnyRole: mockHasAnyRole,
        hasPermission: mockHasPermission,
        logout: mockLogout
      });
    });

    it('should redirect to unauthorized when user lacks required permissions', async () => {
      render(
        <ProtectedRoute requiredPermissions={['admin:write']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/unauthorized');
      });
      
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    it('should show required permissions in unauthorized access UI', async () => {
      (usePathname as jest.Mock).mockReturnValue('/unauthorized');

      render(
        <ProtectedRoute requiredPermissions={['admin:write', 'admin:delete']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Required Permissions:')).toBeInTheDocument();
      });

      expect(screen.getByText('admin:write, admin:delete')).toBeInTheDocument();
    });

    it('should check all required permissions', async () => {
      const localMockHasPermission = jest.fn()
        .mockReturnValueOnce(true)  // First permission passes
        .mockReturnValueOnce(false); // Second permission fails

      (useAuth as jest.Mock).mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: true,
        user: authenticatedUser,
        hasAnyRole: mockHasAnyRole,
        hasPermission: localMockHasPermission,
        logout: mockLogout
      });

      render(
        <ProtectedRoute requiredPermissions={['permission1', 'permission2']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(localMockHasPermission).toHaveBeenCalledWith('permission1');
        expect(localMockHasPermission).toHaveBeenCalledWith('permission2');
      });

      expect(mockPush).toHaveBeenCalledWith('/unauthorized');
    });
  });

  describe('Higher-Order Component', () => {
    const TestComponent = ({ name }: { name: string }) => (
      <div>Hello {name}</div>
    );

    it('should wrap component with protection', async () => {
      mockHasAnyRole.mockReturnValue(true);
      mockHasPermission.mockReturnValue(true);
      
      (useAuth as jest.Mock).mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: true,
        hasAnyRole: mockHasAnyRole,
        hasPermission: mockHasPermission
      });

      const ProtectedTestComponent = withProtectedRoute(TestComponent, {
        requiredRoles: ['physician']
      });

      render(<ProtectedTestComponent name="World" />);

      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeInTheDocument();
      });
    });

    it('should apply protection options to wrapped component', async () => {
      mockHasAnyRole.mockReturnValue(false);
      mockHasPermission.mockReturnValue(true);
      
      (useAuth as jest.Mock).mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: true,
        hasAnyRole: mockHasAnyRole,
        hasPermission: mockHasPermission
      });

      const ProtectedTestComponent = withProtectedRoute(TestComponent, {
        requiredRoles: ['admin']
      });

      render(<ProtectedTestComponent name="World" />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/unauthorized');
      });
    });
  });

  describe('Role-specific Components', () => {
    const testCases = [
      { Component: DoctorOnly, requiredRoles: ['physician'] },
      { Component: NurseOnly, requiredRoles: ['nurse'] },
      { Component: AdminOnly, requiredRoles: ['admin', 'system_admin'] },
      { Component: ClinicalStaffOnly, requiredRoles: ['physician', 'nurse'] },
      { Component: PharmacistOnly, requiredRoles: ['pharmacist'] },
      { Component: LabTechOnly, requiredRoles: ['lab_tech'] },
      { Component: RadiologyTechOnly, requiredRoles: ['radiology_tech'] }
    ];

    testCases.forEach(({ Component, requiredRoles }) => {
      describe(Component.name, () => {
        it('should render children when user has required role', async () => {
          mockHasAnyRole.mockReturnValue(true);
          mockHasPermission.mockReturnValue(true);
          
          (useAuth as jest.Mock).mockReturnValue({
            ...defaultAuthState,
            isAuthenticated: true,
            hasAnyRole: mockHasAnyRole,
            hasPermission: mockHasPermission
          });

          render(
            <Component>
              <div>Protected Content</div>
            </Component>
          );

          await waitFor(() => {
            expect(screen.getByText('Protected Content')).toBeInTheDocument();
          });
        });

        it('should block access when user lacks required role', async () => {
          mockHasAnyRole.mockReturnValue(false);
          mockHasPermission.mockReturnValue(true);
          
          (useAuth as jest.Mock).mockReturnValue({
            ...defaultAuthState,
            isAuthenticated: true,
            hasAnyRole: mockHasAnyRole,
            hasPermission: mockHasPermission
          });

          render(
            <Component>
              <div>Protected Content</div>
            </Component>
          );

          await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/unauthorized');
          });
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should not redirect when already on redirect page during loading', async () => {
      (usePathname as jest.Mock).mockReturnValue('/auth/login');
      (useAuth as jest.Mock).mockReturnValue({
        ...defaultAuthState,
        isLoading: true
      });

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loader')).toBeInTheDocument();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should handle missing user in unauthorized access', async () => {
      mockHasAnyRole.mockReturnValue(false);
      mockHasPermission.mockReturnValue(true);
      
      (useAuth as jest.Mock).mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: true,
        user: null,
        hasAnyRole: mockHasAnyRole,
        hasPermission: mockHasPermission,
        logout: mockLogout
      });

      (usePathname as jest.Mock).mockReturnValue('/unauthorized');

      render(
        <ProtectedRoute requiredRoles={['physician']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });

      expect(screen.queryByText('Current Role:')).not.toBeInTheDocument();
    });

    it('should handle empty required permissions array', async () => {
      mockHasAnyRole.mockReturnValue(true);
      
      (useAuth as jest.Mock).mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: true,
        hasAnyRole: mockHasAnyRole,
        hasPermission: mockHasPermission
      });

      render(
        <ProtectedRoute requiredPermissions={[]}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });

    it('should handle empty required roles array', async () => {
      mockHasPermission.mockReturnValue(true);
      
      (useAuth as jest.Mock).mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: true,
        hasAnyRole: mockHasAnyRole,
        hasPermission: mockHasPermission
      });

      render(
        <ProtectedRoute requiredRoles={[]}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });
  });
});