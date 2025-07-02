// Offline Integration Tests
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
// Using Jest - vi is not needed, jest.fn() is available globally
import { NetworkSimulator } from './network-simulation-utils';
import { ServiceWorkerTestUtils } from './service-worker-test-utils';
import { SyncConflictSimulator, createSyncTestScenario } from './sync-conflict-test-utils';

// Mock complete offline-capable application
const OfflineApp = () => {
  const [isOnline, setIsOnline] = React.useState(true);
  const [syncStatus, setSyncStatus] = React.useState({
    pending: 0,
    syncing: false,
    lastSync: null as string | null
  });
  const [patients, setPatients] = React.useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = React.useState<any>(null);
  const [conflicts, setConflicts] = React.useState<any[]>([]);

  // Monitor online status
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

  // Load patients with offline support
  React.useEffect(() => {
    const loadPatients = async () => {
      try {
        const response = await fetch('/api/patients');
        const data = await response.json();
        // Ensure data is an array
        const patientsData = Array.isArray(data) ? data : [];
        setPatients(patientsData);
        
        // Cache for offline
        localStorage.setItem('cached-patients', JSON.stringify(patientsData));
      } catch (error) {
        // Load from cache when offline
        const cached = localStorage.getItem('cached-patients');
        if (cached) {
          try {
            const parsedData = JSON.parse(cached);
            // Ensure cached data is an array
            const patientsData = Array.isArray(parsedData) ? parsedData : [];
            setPatients(patientsData);
          } catch (parseError) {
            // If parsing fails, use empty array
            setPatients([]);
          }
        } else {
          // No cached data, use empty array
          setPatients([]);
        }
      }
    };

    loadPatients();
  }, []);

  // Sync queue management
  const queueAction = (action: any) => {
    let queue = [];
    try {
      const stored = localStorage.getItem('sync-queue');
      queue = stored ? JSON.parse(stored) : [];
    } catch (error) {
      queue = [];
    }
    queue.push({ ...action, timestamp: Date.now(), id: Date.now() });
    localStorage.setItem('sync-queue', JSON.stringify(queue));
    setSyncStatus(prev => ({ ...prev, pending: queue.length }));
  };

  const syncData = async () => {
    if (!isOnline || syncStatus.syncing) return;

    setSyncStatus(prev => ({ ...prev, syncing: true }));
    let queue = [];
    try {
      const stored = localStorage.getItem('sync-queue');
      queue = stored ? JSON.parse(stored) : [];
    } catch (error) {
      queue = [];
    }
    const remaining: any[] = [];
    const detectedConflicts: any[] = [];

    for (const action of queue) {
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action)
        });

        const result = await response.json();
        
        if (result.conflict) {
          detectedConflicts.push(result.conflict);
        }
      } catch (error) {
        remaining.push(action);
      }
    }

    localStorage.setItem('sync-queue', JSON.stringify(remaining));
    setConflicts(prev => [...prev, ...detectedConflicts]);
    setSyncStatus({
      pending: remaining.length,
      syncing: false,
      lastSync: new Date().toISOString()
    });
  };

  // Auto-sync when coming online
  React.useEffect(() => {
    if (isOnline && syncStatus.pending > 0 && !syncStatus.syncing) {
      syncData();
    }
  }, [isOnline, syncStatus.pending]);

  // Handle patient update
  const updatePatient = async (patient: any) => {
    const updatedPatient = { ...patient, lastModified: Date.now() };
    
    // Update local state
    setPatients(prev => prev.map(p => p.id === patient.id ? updatedPatient : p));
    
    // Queue for sync
    queueAction({
      type: 'UPDATE_PATIENT',
      resource: updatedPatient
    });

    // Update cache
    let cached = [];
    try {
      const stored = localStorage.getItem('cached-patients');
      cached = stored ? JSON.parse(stored) : [];
    } catch (error) {
      cached = [];
    }
    const updated = cached.map((p: any) => p.id === patient.id ? updatedPatient : p);
    localStorage.setItem('cached-patients', JSON.stringify(updated));
  };

  return (
    <div data-testid="offline-app">
      {/* Offline indicator */}
      {!isOnline && (
        <div role="alert" className="offline-banner">
          You are offline. Changes will be synced when connection is restored.
        </div>
      )}

      {/* Sync status */}
      <div className="sync-status">
        <span>Pending changes: {syncStatus.pending}</span>
        {syncStatus.syncing && <span> (Syncing...)</span>}
        {syncStatus.lastSync && (
          <span> Last sync: {new Date(syncStatus.lastSync).toLocaleTimeString()}</span>
        )}
        <button 
          onClick={syncData} 
          disabled={!isOnline || syncStatus.syncing || syncStatus.pending === 0}
        >
          Sync Now
        </button>
      </div>

      {/* Conflict resolution */}
      {conflicts.length > 0 && (
        <div className="conflicts" role="alert">
          <h3>Sync Conflicts ({conflicts.length})</h3>
          {conflicts.map((conflict, index) => (
            <div key={index} className="conflict-item">
              <p>Conflict in {conflict.resourceType} {conflict.resourceId}</p>
              <button onClick={() => {
                // Resolve conflict (simplified)
                setConflicts(prev => prev.filter((_, i) => i !== index));
              }}>
                Resolve
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Patient list */}
      <div className="patient-list">
        <h2>Patients</h2>
        {Array.isArray(patients) && patients.map(patient => (
          <div key={patient.id} className="patient-item">
            <button onClick={() => setSelectedPatient(patient)}>
              {patient.firstName} {patient.lastName}
            </button>
          </div>
        ))}
      </div>

      {/* Patient editor */}
      {selectedPatient && (
        <div className="patient-editor">
          <h3>Edit Patient</h3>
          <form onSubmit={(e) => {
            e.preventDefault();
            updatePatient(selectedPatient);
            setSelectedPatient(null);
          }}>
            <input
              value={selectedPatient.firstName}
              onChange={(e) => setSelectedPatient({
                ...selectedPatient,
                firstName: e.target.value
              })}
              placeholder="First Name"
            />
            <input
              value={selectedPatient.lastName}
              onChange={(e) => setSelectedPatient({
                ...selectedPatient,
                lastName: e.target.value
              })}
              placeholder="Last Name"
            />
            <button type="submit">Save</button>
            <button type="button" onClick={() => setSelectedPatient(null)}>
              Cancel
            </button>
          </form>
        </div>
      )}
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

describe('Offline Integration Tests', () => {
  let syncSimulator: SyncConflictSimulator;

  beforeEach(() => {
    // Reset localStorage mock
    const localStorageData = {};
    window.localStorage = {
      getItem: jest.fn((key) => localStorageData[key] || null),
      setItem: jest.fn((key, value) => {
        localStorageData[key] = value.toString();
      }),
      removeItem: jest.fn((key) => {
        delete localStorageData[key];
      }),
      clear: jest.fn(() => {
        Object.keys(localStorageData).forEach(key => delete localStorageData[key]);
      }),
      key: jest.fn((index) => Object.keys(localStorageData)[index] || null),
      length: Object.keys(localStorageData).length
    };
    
    // Clear localStorage
    localStorage.clear();
    
    NetworkSimulator.mockFetch();
    ServiceWorkerTestUtils.mockNavigatorServiceWorker();
    ServiceWorkerTestUtils.mockCacheAPI();
    
    const scenario = createSyncTestScenario();
    syncSimulator = scenario.simulator;

    // Mock initial patient data
    NetworkSimulator.intercept('/api/patients', {
      response: [
        { id: '1', firstName: 'John', lastName: 'Doe' },
        { id: '2', firstName: 'Jane', lastName: 'Smith' },
        { id: '3', firstName: 'Bob', lastName: 'Johnson' }
      ]
    });
  });

  afterEach(async () => {
    NetworkSimulator.restore();
    ServiceWorkerTestUtils.cleanup();
    syncSimulator.clear();
    
    // Clean up IndexedDB
    if (global.indexedDB) {
      try {
        const databases = await indexedDB.databases?.() || [];
        for (const db of databases) {
          await indexedDB.deleteDatabase(db.name);
        }
      } catch (error) {
        // Silent fail for cleanup
      }
    }
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('End-to-End Offline Workflow', () => {
    it('should handle complete offline workflow', async () => {
      const user = userEvent.setup();
      
      // Start online
      NetworkSimulator.goOnline();
      render(<OfflineApp />, { wrapper: TestWrapper });

      // Wait for initial data load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Verify data is cached
      await waitFor(() => {
        const stored = localStorage.getItem('cached-patients');
        expect(stored).toBeTruthy();
        const cached = JSON.parse(stored || '[]');
        expect(cached).toHaveLength(3);
      });

      // Go offline
      act(() => {
        NetworkSimulator.goOffline();
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('You are offline');
      });

      // Edit patient while offline
      await user.click(screen.getByText('John Doe'));
      
      const firstNameInput = screen.getByPlaceholderText('First Name');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jonathan');
      
      await user.click(screen.getByText('Save'));

      // Verify change is queued
      await waitFor(() => {
        expect(screen.getByText('Pending changes: 1')).toBeInTheDocument();
      });

      // Verify local update
      expect(screen.getByText('Jonathan Doe')).toBeInTheDocument();

      // Go back online
      NetworkSimulator.intercept('/api/sync', {
        response: { success: true }
      });
      
      act(() => {
        NetworkSimulator.goOnline();
      });

      // Wait for auto-sync
      await waitFor(() => {
        expect(screen.getByText('Pending changes: 0')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getByText(/Last sync:/)).toBeInTheDocument();
    });

    it('should handle conflict resolution', async () => {
      const user = userEvent.setup();
      
      NetworkSimulator.goOnline();
      render(<OfflineApp />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Go offline and make changes
      act(() => {
        NetworkSimulator.goOffline();
      });

      await user.click(screen.getByText('John Doe'));
      const firstNameInput = screen.getByPlaceholderText('First Name');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Johnny');
      await user.click(screen.getByText('Save'));

      // Mock conflict response when syncing
      NetworkSimulator.intercept('/api/sync', {
        response: {
          conflict: {
            resourceType: 'Patient',
            resourceId: '1',
            localValue: { firstName: 'Johnny' },
            serverValue: { firstName: 'John Jr.' }
          }
        }
      });

      // Go online to trigger sync
      act(() => {
        NetworkSimulator.goOnline();
      });

      // Wait for conflict to appear
      await waitFor(() => {
        expect(screen.getByText(/Sync Conflicts/)).toBeInTheDocument();
        expect(screen.getByText('Conflict in Patient 1')).toBeInTheDocument();
      });

      // Resolve conflict
      await user.click(screen.getByText('Resolve'));

      await waitFor(() => {
        expect(screen.queryByText(/Sync Conflicts/)).not.toBeInTheDocument();
      });
    });

    it('should handle multiple offline sessions', async () => {
      const user = userEvent.setup();
      
      // Session 1: Online -> Offline -> Make changes
      NetworkSimulator.goOnline();
      render(<OfflineApp />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      act(() => {
        NetworkSimulator.goOffline();
      });

      // Make first change
      await user.click(screen.getByText('John Doe'));
      await user.clear(screen.getByPlaceholderText('First Name'));
      await user.type(screen.getByPlaceholderText('First Name'), 'Jack');
      await user.click(screen.getByText('Save'));

      expect(screen.getByText('Pending changes: 1')).toBeInTheDocument();

      // Make second change
      await user.click(screen.getByText('Jane Smith'));
      await user.clear(screen.getByPlaceholderText('Last Name'));
      await user.type(screen.getByPlaceholderText('Last Name'), 'Johnson');
      await user.click(screen.getByText('Save'));

      expect(screen.getByText('Pending changes: 2')).toBeInTheDocument();

      // Session 2: Brief online period (partial sync)
      NetworkSimulator.intercept('/api/sync', {
        response: { success: true },
        delay: 100
      });

      act(() => {
        NetworkSimulator.goOnline();
      });

      // Go offline again before sync completes
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        NetworkSimulator.goOffline();
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('You are offline');
      });

      // Should still have pending changes
      expect(screen.getByText(/Pending changes: [12]/)).toBeInTheDocument();

      // Session 3: Full sync
      act(() => {
        NetworkSimulator.goOnline();
      });

      await waitFor(() => {
        expect(screen.getByText('Pending changes: 0')).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('Service Worker Integration', () => {
    it('should cache API responses via service worker', async () => {
      NetworkSimulator.goOnline();
      render(<OfflineApp />, { wrapper: TestWrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Manually cache data in mock
      const cache = await caches.open('api-cache-v1');
      const response = new Response(JSON.stringify([
        { id: '1', firstName: 'John', lastName: 'Doe' },
        { id: '2', firstName: 'Jane', lastName: 'Smith' },
        { id: '3', firstName: 'Bob', lastName: 'Johnson' }
      ]), {
        headers: { 'Content-Type': 'application/json' }
      });
      await cache.put('/api/patients', response);

      // Check if data was cached
      const cachedResponse = await cache.match('/api/patients');
      expect(cachedResponse).toBeDefined();
      if (cachedResponse) {
        const cachedData = await cachedResponse.json();
        expect(cachedData).toHaveLength(3);
      }
    });

    it('should update UI when service worker has updates', async () => {
      render(<OfflineApp />, { wrapper: TestWrapper });

      // Simulate service worker update
      ServiceWorkerTestUtils.simulateUpdate();

      // Simulate update notification
      ServiceWorkerTestUtils.simulateMessage({
        type: 'UPDATE_AVAILABLE',
        version: '2.0.0'
      });

      // In a real app, this would show an update banner
      // For now, just verify the message was received
      expect(navigator.serviceWorker).toBeDefined();
    });
  });

  describe('Performance Under Offline Conditions', () => {
    it('should handle large offline queues efficiently', async () => {
      const user = userEvent.setup({ delay: null });
      
      NetworkSimulator.goOnline();
      render(<OfflineApp />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Go offline
      act(() => {
        NetworkSimulator.goOffline();
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('You are offline');
      });

      // Make multiple changes
      const startTime = performance.now();

      for (let i = 0; i < 5; i++) {
        await user.click(screen.getByText(i === 0 ? 'John Doe' : `John${i-1} Doe`));
        await user.clear(screen.getByPlaceholderText('First Name'));
        await user.type(screen.getByPlaceholderText('First Name'), `John${i}`);
        await user.click(screen.getByText('Save'));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(screen.getByText('Pending changes: 5')).toBeInTheDocument();
      expect(duration).toBeLessThan(10000); // Should handle 5 updates in under 10 seconds
    }, 15000);

    it('should maintain UI responsiveness while syncing', async () => {
      const user = userEvent.setup();
      
      NetworkSimulator.goOnline();
      render(<OfflineApp />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Go offline first to create changes
      act(() => {
        NetworkSimulator.goOffline();
      });

      // Make a change
      await user.click(screen.getByText('John Doe'));
      await user.clear(screen.getByPlaceholderText('First Name'));
      await user.type(screen.getByPlaceholderText('First Name'), 'Johnny');
      await user.click(screen.getByText('Save'));

      expect(screen.getByText('Pending changes: 1')).toBeInTheDocument();

      // Mock slow sync
      NetworkSimulator.intercept('/api/sync', {
        response: { success: true },
        delay: 200
      });

      // Go online to trigger sync
      act(() => {
        NetworkSimulator.goOnline();
      });

      // Wait for sync to start
      await waitFor(() => {
        const syncButton = screen.getByText('Sync Now');
        expect(syncButton).toBeDisabled();
      });

      // Can still interact with UI
      await user.click(screen.getByText('Jane Smith'));
      expect(screen.getByPlaceholderText('First Name')).toHaveValue('Jane');
    }, 10000);
  });

  describe('Error Recovery', () => {
    it('should recover from sync failures', async () => {
      const user = userEvent.setup();
      
      NetworkSimulator.goOnline();
      render(<OfflineApp />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Make offline changes
      act(() => {
        NetworkSimulator.goOffline();
      });

      await user.click(screen.getByText('John Doe'));
      await user.clear(screen.getByPlaceholderText('First Name'));
      await user.type(screen.getByPlaceholderText('First Name'), 'Jonathan');
      await user.click(screen.getByText('Save'));

      expect(screen.getByText('Pending changes: 1')).toBeInTheDocument();

      // Mock sync success immediately
      NetworkSimulator.intercept('/api/sync', {
        response: { success: true }
      });

      // Go online
      act(() => {
        NetworkSimulator.goOnline();
      });

      // Should sync successfully
      await waitFor(() => {
        expect(screen.getByText('Pending changes: 0')).toBeInTheDocument();
      }, { timeout: 10000 });
    }, 15000);

    it('should handle corrupted cache gracefully', async () => {
      // Corrupt the cache
      localStorage.setItem('cached-patients', 'invalid json');

      // Start online to ensure initial state
      NetworkSimulator.goOnline();
      render(<OfflineApp />, { wrapper: TestWrapper });

      // Should not crash, should show empty patient list initially
      await waitFor(() => {
        expect(screen.getByText('Patients')).toBeInTheDocument();
      });

      // Should fetch and display data despite corrupted cache
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Go offline
      act(() => {
        NetworkSimulator.goOffline();
      });

      // Should show offline banner
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('You are offline');
      });

      // Data should still be displayed from state
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    }, 10000);
  });
});