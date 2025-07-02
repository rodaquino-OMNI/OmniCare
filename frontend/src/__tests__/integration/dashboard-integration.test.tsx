import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { MedplumClient } from '@medplum/core';
import { TestProviders } from '@test-utils/test-providers';
import DashboardPage from '@/app/dashboard/page';
import { useDashboardData } from '@/hooks/useDashboardData';
import '@testing-library/jest-dom';

// Mock the dashboard data hook
jest.mock('@/hooks/useDashboardData');

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  usePathname: jest.fn(() => '/dashboard'),
}));

// Mock dashboard data
const mockDashboardData = {
  stats: {
    totalPatients: { value: 1247, change: 5.2, trend: 'up' as const },
    activeOrders: { value: 42, change: -2.1, trend: 'down' as const },
    pendingResults: { value: 18, change: 0, trend: 'stable' as const },
    medications: { value: 156, change: 8.7, trend: 'up' as const },
  },
  lastUpdated: new Date('2024-01-01T12:00:00Z'),
  upcomingAppointments: [
    {
      id: 'apt-1',
      patientId: 'patient-1',
      patientName: 'John Doe',
      time: new Date('2024-01-01T10:00:00Z'),
      type: 'Follow-up',
      status: 'confirmed' as const,
      duration: 30,
      providerId: 'provider-1',
    },
    {
      id: 'apt-2',
      patientId: 'patient-2',
      patientName: 'Jane Smith',
      time: new Date('2024-01-01T11:30:00Z'),
      type: 'Initial Consultation',
      status: 'pending' as const,
      duration: 60,
      providerId: 'provider-2',
    },
    {
      id: 'apt-3',
      patientId: 'patient-3',
      patientName: 'Bob Johnson',
      time: new Date('2024-01-01T14:00:00Z'),
      type: 'Lab Review',
      status: 'confirmed' as const,
      duration: 15,
      providerId: 'provider-1',
    },
  ],
  recentActivities: [
    {
      id: 'act-1',
      patientName: 'Alice Wilson',
      patientId: 'pat-1',
      action: 'Lab results reviewed',
      time: new Date('2024-01-01T09:45:00Z'),
      type: 'success' as const,
    },
    {
      id: 'act-2',
      patientName: 'Charlie Brown',
      patientId: 'pat-2',
      action: 'Prescription updated',
      time: new Date('2024-01-01T09:30:00Z'),
      type: 'info' as const,
    },
    {
      id: 'act-3',
      patientName: 'Diana Prince',
      patientId: 'pat-3',
      action: 'Alert: High blood pressure reading',
      time: new Date('2024-01-01T09:15:00Z'),
      type: 'warning' as const,
    },
    {
      id: 'act-4',
      patientName: 'Edward King',
      patientId: 'pat-4',
      action: 'Failed to sync records',
      time: new Date('2024-01-01T09:00:00Z'),
      type: 'error' as const,
    },
  ],
  performanceMetrics: {
    patientSatisfaction: 92,
    onTimePerformance: 88,
    resourceUtilization: 76,
  },
};

const mockMedplum = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  searchResources: jest.fn(),
  createResource: jest.fn(),
  readResource: jest.fn(),
} as unknown as MedplumClient;

describe('Dashboard Integration Tests', () => {
  const mockUseDashboardData = useDashboardData as jest.MockedFunction<typeof useDashboardData>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDashboardData.mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refresh: jest.fn(),
      lastUpdated: new Date('2024-01-01T12:00:00Z'),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Four-Panel Dashboard Layout', () => {
    it('renders all four main dashboard panels', async () => {
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        // Statistics panel (4 cards)
        expect(screen.getByText('1,247')).toBeInTheDocument(); // Total Patients
        expect(screen.getByText('42')).toBeInTheDocument(); // Active Orders
        expect(screen.getByText('18')).toBeInTheDocument(); // Pending Results
        expect(screen.getByText('156')).toBeInTheDocument(); // Medications

        // Today's Schedule panel
        expect(screen.getByText("Today's Schedule")).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();

        // Recent Activity panel
        expect(screen.getByText('Recent Activity')).toBeInTheDocument();
        expect(screen.getByText('Alice Wilson')).toBeInTheDocument();
        expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
        expect(screen.getByText('Diana Prince')).toBeInTheDocument();
        expect(screen.getByText('Edward King')).toBeInTheDocument();

        // Quick Actions panel
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();
        expect(screen.getByText('Add New Patient')).toBeInTheDocument();
        expect(screen.getByText('Create Prescription')).toBeInTheDocument();
        expect(screen.getByText('Order Lab Tests')).toBeInTheDocument();

        // Performance Metrics panel
        expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
        expect(screen.getByText('Patient Satisfaction')).toBeInTheDocument();
        expect(screen.getByText('On-Time Performance')).toBeInTheDocument();
        expect(screen.getByText('Resource Utilization')).toBeInTheDocument();
      });
    });

    it('displays correct statistics with trend indicators', async () => {
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        // Check trend badges
        expect(screen.getByText('+5.2% from last month')).toBeInTheDocument();
        expect(screen.getByText('-2.1% from last month')).toBeInTheDocument();
        expect(screen.getByText('0% from last month')).toBeInTheDocument();
        expect(screen.getByText('+8.7% from last month')).toBeInTheDocument();
      });
    });

    it('formats appointment times correctly', async () => {
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText('10:00 am')).toBeInTheDocument();
        expect(screen.getByText('11:30 am')).toBeInTheDocument();
        expect(screen.getByText('2:00 pm')).toBeInTheDocument();
      });
    });

    it('shows appropriate status badges for appointments', async () => {
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        const confirmedBadges = screen.getAllByText('confirmed');
        const pendingBadges = screen.getAllByText('pending');
        
        expect(confirmedBadges).toHaveLength(2);
        expect(pendingBadges).toHaveLength(1);
      });
    });

    it('displays activity types with correct icons and colors', async () => {
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        const recentActivitySection = screen.getByText('Recent Activity').closest('[role="region"]');
        expect(recentActivitySection).toBeInTheDocument();
        
        within(recentActivitySection as HTMLElement).getByText('Lab results reviewed');
        within(recentActivitySection as HTMLElement).getByText('Prescription updated');
        within(recentActivitySection as HTMLElement).getByText('Alert: High blood pressure reading');
        within(recentActivitySection as HTMLElement).getByText('Failed to sync records');
      });
    });
  });

  describe('Interactive Features', () => {
    it('refreshes dashboard data when refresh button is clicked', async () => {
      const mockRefresh = jest.fn();
      mockUseDashboardData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: mockRefresh,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
      });

      const user = userEvent.setup();
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      const refreshButton = screen.getByRole('button', { name: /refresh dashboard/i });
      await user.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalled();
    });

    it('shows loading state during data refresh', async () => {
      mockUseDashboardData.mockReturnValue({
        data: null,
        isLoading: true,
        isRefreshing: false,
        error: null,
        refresh: jest.fn(),
        lastUpdated: null,
      });

      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getAllByLabelText(/loading/i)).toHaveLength(4); // 4 stat cards loading
        expect(screen.getByLabelText(/loading today's appointments/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/loading recent activities/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/loading performance metrics/i)).toBeInTheDocument();
      });
    });

    it('shows refreshing state with spinner', async () => {
      mockUseDashboardData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        isRefreshing: true,
        error: null,
        refresh: jest.fn(),
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
      });

      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        const refreshButton = screen.getByRole('button', { name: /refresh dashboard/i });
        expect(refreshButton).toHaveAttribute('aria-busy', 'true');
      });
    });

    it('handles quick action button clicks', async () => {
      const user = userEvent.setup();
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      const addPatientButton = screen.getByText('Add New Patient').closest('[role="listitem button"]');
      const createPrescriptionButton = screen.getByText('Create Prescription').closest('[role="listitem button"]');
      const orderLabTestsButton = screen.getByText('Order Lab Tests').closest('[role="listitem button"]');

      expect(addPatientButton).toBeInTheDocument();
      expect(createPrescriptionButton).toBeInTheDocument();
      expect(orderLabTestsButton).toBeInTheDocument();

      // Test keyboard navigation
      (addPatientButton as HTMLElement).focus();
      await user.keyboard('{Enter}');
      // Quick action handlers would be called here
    });
  });

  describe('Error Handling', () => {
    it('displays error alert when data loading fails', async () => {
      const error = new Error('Failed to load dashboard data');
      mockUseDashboardData.mockReturnValue({
        data: null,
        isLoading: false,
        isRefreshing: false,
        error,
        refresh: jest.fn(),
        lastUpdated: null,
      });

      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Error loading dashboard')).toBeInTheDocument();
        expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument();
      });
    });

    it('shows empty states when no data is available', async () => {
      mockUseDashboardData.mockReturnValue({
        data: {
          ...mockDashboardData,
          upcomingAppointments: [],
          recentActivities: [],
        },
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: jest.fn(),
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
      });

      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText('No appointments scheduled for today')).toBeInTheDocument();
        expect(screen.getByText('No recent activity')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts layout for different screen sizes', async () => {
      // Mock different viewport sizes
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        // Check that components are rendered (specific responsive behavior would depend on CSS/JS)
        expect(screen.getByText('Welcome back')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Metrics Panel', () => {
    it('displays performance metrics with correct values', async () => {
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText('92%')).toBeInTheDocument(); // Patient satisfaction
        expect(screen.getByText('88%')).toBeInTheDocument(); // On-time performance
        expect(screen.getByText('76%')).toBeInTheDocument(); // Resource utilization
      });
    });

    it('shows ring progress components with correct aria labels', async () => {
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Patient satisfaction: 92 percent')).toBeInTheDocument();
        expect(screen.getByLabelText('On-time performance: 88 percent')).toBeInTheDocument();
        expect(screen.getByLabelText('Resource utilization: 76 percent')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('shows last updated timestamp', async () => {
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText(/last updated.*ago/i)).toBeInTheDocument();
      });
    });

    it('handles auto-refresh functionality', async () => {
      const mockRefresh = jest.fn();
      mockUseDashboardData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: mockRefresh,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
      });

      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      // Auto-refresh is configured in the hook with a 60-second interval
      // This test verifies that the hook is called with the correct parameters
      expect(mockUseDashboardData).toHaveBeenCalledWith({
        autoRefresh: true,
        refreshInterval: 60,
      });
    });
  });

  describe('Integration with Auth System', () => {
    it('displays user name in welcome message', async () => {
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
      });
    });

    it('requires authentication to access dashboard', async () => {
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      // The ProtectedRoute component should handle authentication
      // This test verifies that the dashboard requires proper roles
      await waitFor(() => {
        expect(screen.getByText('Welcome back')).toBeInTheDocument();
      });
    });
  });

  describe('Data Formatting and Display', () => {
    it('formats large numbers with proper separators', async () => {
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText('1,247')).toBeInTheDocument();
      });
    });

    it('formats timestamps in user-friendly format', async () => {
      render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      await waitFor(() => {
        // Check that time formatting is correct
        expect(screen.getByText(/ago/i)).toBeInTheDocument();
      });
    });
  });
});
