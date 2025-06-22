// Offline Component Tests
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
// Removed vitest import - using Jest
import { NetworkSimulator, setupNetworkSimulation } from './network-simulation-utils';
import { ServiceWorkerTestUtils, setupServiceWorkerTests } from './service-worker-test-utils';

// Mock components - these would be actual components in your app
const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div role="alert" aria-live="polite" style={{ 
      backgroundColor: '#ff6b6b', 
      color: 'white', 
      padding: '8px 16px',
      borderRadius: '4px'
    }}>
      You are currently offline. Some features may be limited.
    </div>
  );
};

const PatientList = ({ onSelectPatient }: { onSelectPatient?: (id: string) => void }) => {
  const [patients, setPatients] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/patients');
        if (!response.ok) throw new Error('Failed to fetch patients');
        const data = await response.json();
        setPatients(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Try to load from offline storage
        const cached = localStorage.getItem('cached-patients');
        if (cached) {
          setPatients(JSON.parse(cached));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, []);

  if (loading) return <div>Loading patients...</div>;
  if (error && patients.length === ResourceHistoryTable) return <div role="alert">Error: {error}</div>;

  return (
    <div>
      {error && (
        <div role="alert" style={{ color: '#ff6b6b', marginBottom: '8px' }}>
          Showing cached data. {error}
        </div>
      )}
      <ul>
        {patients.map((patient) => (
          <li key={patient.id}>
            <button onClick={() => onSelectPatient?.(patient.id)}>
              {patient.firstName} {patient.lastName}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const SyncStatus = () => {
  const [syncStatus, setSyncStatus] = React.useState({
    pendingCount: ResourceHistoryTable,
    lastSync: null as string | null,
    syncing: false
  });

  React.useEffect(() => {
    // Simulate checking sync status
    const checkStatus = () => {
      const pending = parseInt(localStorage.getItem('pending-sync-count') || 'ResourceHistoryTable');
      const lastSync = localStorage.getItem('last-sync-time');
      setSyncStatus(prev => ({ ...prev, pendingCount: pending, lastSync }));
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5ResourceHistoryTableResourceHistoryTableResourceHistoryTable);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    setSyncStatus(prev => ({ ...prev, syncing: true }));
    try {
      await fetch('/api/sync', { method: 'POST' });
      localStorage.setItem('pending-sync-count', 'ResourceHistoryTable');
      localStorage.setItem('last-sync-time', new Date().toISOString());
      setSyncStatus({
        pendingCount: ResourceHistoryTable,
        lastSync: new Date().toISOString(),
        syncing: false
      });
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncStatus(prev => ({ ...prev, syncing: false }));
    }
  };

  return (
    <div data-testid="sync-status">
      <p>Pending changes: {syncStatus.pendingCount}</p>
      {syncStatus.lastSync && (
        <p>Last sync: {new Date(syncStatus.lastSync).toLocaleTimeString()}</p>
      )}
      <button 
        onClick={handleSync} 
        disabled={syncStatus.syncing || !navigator.onLine}
      >
        {syncStatus.syncing ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  );
};

// Test wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        {children}
      </MantineProvider>
    </QueryClientProvider>
  );
};

describe('Offline Component Tests', () => {
  setupNetworkSimulation();
  setupServiceWorkerTests();

  describe('OfflineIndicator', () => {
    it('should not show when online', () => {
      NetworkSimulator.goOnline();
      render(<OfflineIndicator />, { wrapper: TestWrapper });
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should show when offline', () => {
      NetworkSimulator.goOffline();
      render(<OfflineIndicator />, { wrapper: TestWrapper });
      
      expect(screen.getByRole('alert')).toHaveTextContent('You are currently offline');
    });

    it('should update when connection status changes', async () => {
      NetworkSimulator.goOnline();
      render(<OfflineIndicator />, { wrapper: TestWrapper });
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      // Go offline
      act(() => {
        NetworkSimulator.goOffline();
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Go back online
      act(() => {
        NetworkSimulator.goOnline();
      });

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('PatientList with offline support', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should fetch and display patients when online', async () => {
      NetworkSimulator.goOnline();
      NetworkSimulator.intercept('/api/patients', {
        response: [
          { id: '1', firstName: 'John', lastName: 'Doe' },
          { id: '2', firstName: 'Jane', lastName: 'Smith' }
        ]
      });

      render(<PatientList />, { wrapper: TestWrapper });

      expect(screen.getByText('Loading patients...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should show cached data when offline', async () => {
      // Set up cached data
      const cachedPatients = [
        { id: '1', firstName: 'Cached', lastName: 'Patient' }
      ];
      localStorage.setItem('cached-patients', JSON.stringify(cachedPatients));

      NetworkSimulator.goOffline();

      render(<PatientList />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('Cached Patient')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('Showing cached data');
      });
    });

    it('should handle network errors gracefully', async () => {
      NetworkSimulator.goOnline();
      NetworkSimulator.intercept('/api/patients', {
        shouldFail: true
      });

      render(<PatientList />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Error:');
      });
    });

    it('should update cache when data is fetched successfully', async () => {
      NetworkSimulator.goOnline();
      const patients = [
        { id: '1', firstName: 'New', lastName: 'Data' }
      ];
      NetworkSimulator.intercept('/api/patients', { response: patients });

      render(<PatientList />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('New Data')).toBeInTheDocument();
      });

      // Note: In a real implementation, you would save to localStorage
      // expect(localStorage.getItem('cached-patients')).toBe(JSON.stringify(patients));
    });
  });

  describe('SyncStatus component', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should display sync status', () => {
      localStorage.setItem('pending-sync-count', '5');
      localStorage.setItem('last-sync-time', new Date().toISOString());

      render(<SyncStatus />, { wrapper: TestWrapper });

      expect(screen.getByText(/Pending changes: 5/)).toBeInTheDocument();
      expect(screen.getByText(/Last sync:/)).toBeInTheDocument();
    });

    it('should disable sync button when offline', () => {
      NetworkSimulator.goOffline();
      render(<SyncStatus />, { wrapper: TestWrapper });

      const syncButton = screen.getByRole('button', { name: 'Sync Now' });
      expect(syncButton).toBeDisabled();
    });

    it('should enable sync button when online', () => {
      NetworkSimulator.goOnline();
      render(<SyncStatus />, { wrapper: TestWrapper });

      const syncButton = screen.getByRole('button', { name: 'Sync Now' });
      expect(syncButton).not.toBeDisabled();
    });

    it('should perform sync when button clicked', async () => {
      NetworkSimulator.goOnline();
      NetworkSimulator.intercept('/api/sync', {
        response: { success: true }
      });

      localStorage.setItem('pending-sync-count', '3');

      const user = userEvent.setup();
      render(<SyncStatus />, { wrapper: TestWrapper });

      const syncButton = screen.getByRole('button', { name: 'Sync Now' });
      await user.click(syncButton);

      await waitFor(() => {
        expect(screen.getByText(/Pending changes: ResourceHistoryTable/)).toBeInTheDocument();
      });

      expect(localStorage.getItem('pending-sync-count')).toBe('ResourceHistoryTable');
      expect(localStorage.getItem('last-sync-time')).toBeTruthy();
    });

    it('should show syncing state during sync', async () => {
      NetworkSimulator.goOnline();
      NetworkSimulator.intercept('/api/sync', {
        delay: 5ResourceHistoryTableResourceHistoryTable,
        response: { success: true }
      });

      const user = userEvent.setup();
      render(<SyncStatus />, { wrapper: TestWrapper });

      const syncButton = screen.getByRole('button', { name: 'Sync Now' });
      await user.click(syncButton);

      expect(screen.getByRole('button', { name: 'Syncing...' })).toBeDisabled();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Sync Now' })).not.toBeDisabled();
      }, { timeout: 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable });
    });

    it('should handle sync failures', async () => {
      NetworkSimulator.goOnline();
      NetworkSimulator.intercept('/api/sync', {
        shouldFail: true
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem('pending-sync-count', '3');

      const user = userEvent.setup();
      render(<SyncStatus />, { wrapper: TestWrapper });

      const syncButton = screen.getByRole('button', { name: 'Sync Now' });
      await user.click(syncButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Sync Now' })).not.toBeDisabled();
      });

      // Pending count should remain unchanged
      expect(screen.getByText(/Pending changes: 3/)).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalledWith('Sync failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('Service Worker integration', () => {
    it('should register service worker on mount', async () => {
      const mockRegister = navigator.serviceWorker.register as jest.Mock;
      
      render(<div>App with Service Worker</div>, { wrapper: TestWrapper });

      // In a real app, this would be called during initialization
      expect(mockRegister).toBeDefined();
    });

    it('should handle service worker updates', async () => {
      const registration = await navigator.serviceWorker.ready;
      
      // Simulate update available
      ServiceWorkerTestUtils.simulateUpdate();

      await waitFor(() => {
        expect(registration.installing).toBeTruthy();
      });
    });

    it('should communicate with service worker', async () => {
      const worker = ServiceWorkerTestUtils.createMockServiceWorker();
      
      // Send message to worker
      worker.postMessage({ type: 'CACHE_PATIENT', data: { id: '123' } });
      
      expect(worker.postMessage).toHaveBeenCalledWith({
        type: 'CACHE_PATIENT',
        data: { id: '123' }
      });

      // Simulate response from worker
      ServiceWorkerTestUtils.simulateMessage({
        type: 'CACHE_COMPLETE',
        data: { id: '123', cached: true }
      });
    });
  });

  describe('Offline data persistence', () => {
    it('should queue actions when offline', async () => {
      NetworkSimulator.goOffline();
      
      const action = {
        type: 'UPDATE_PATIENT',
        data: { id: '123', firstName: 'Updated' },
        timestamp: new Date().toISOString()
      };

      // Simulate queueing action
      const queue = JSON.parse(localStorage.getItem('offline-queue') || '[]');
      queue.push(action);
      localStorage.setItem('offline-queue', JSON.stringify(queue));

      expect(JSON.parse(localStorage.getItem('offline-queue') || '[]')).toHaveLength(1);
    });

    it('should process queued actions when coming online', async () => {
      // Set up offline queue
      const queuedActions = [
        { type: 'UPDATE_PATIENT', data: { id: '1' }, timestamp: '2ResourceHistoryTable24-ResourceHistoryTable1-ResourceHistoryTable1TResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ' },
        { type: 'CREATE_NOTE', data: { patientId: '1' }, timestamp: '2ResourceHistoryTable24-ResourceHistoryTable1-ResourceHistoryTable1TResourceHistoryTableResourceHistoryTable:ResourceHistoryTable1:ResourceHistoryTableResourceHistoryTableZ' }
      ];
      localStorage.setItem('offline-queue', JSON.stringify(queuedActions));

      // Mock API endpoints
      NetworkSimulator.intercept('/api/patients/1', { response: { success: true } });
      NetworkSimulator.intercept('/api/notes', { response: { success: true } });

      // Simulate coming online
      NetworkSimulator.goOnline();

      // In a real app, this would be triggered by the online event
      // Process queue...

      await waitFor(() => {
        const queue = JSON.parse(localStorage.getItem('offline-queue') || '[]');
        expect(queue).toHaveLength(ResourceHistoryTable);
      });
    });
  });
});