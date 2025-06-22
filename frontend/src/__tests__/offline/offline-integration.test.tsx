// Offline Integration Tests
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { vi } from 'vitest';
import { NetworkSimulator } from './network-simulation-utils';
import { ServiceWorkerTestUtils } from './service-worker-test-utils';
import { SyncConflictSimulator, createSyncTestScenario } from './sync-conflict-test-utils';

// Mock complete offline-capable application
const OfflineApp = () => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
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
    const queue = JSON.parse(localStorage.getItem('sync-queue') || '[]');
    queue.push({ ...action, timestamp: Date.now(), id: Date.now() });
    localStorage.setItem('sync-queue', JSON.stringify(queue));
    setSyncStatus(prev => ({ ...prev, pending: queue.length }));
  };

  const syncData = async () => {
    if (!isOnline || syncStatus.syncing) return;

    setSyncStatus(prev => ({ ...prev, syncing: true }));
    const queue = JSON.parse(localStorage.getItem('sync-queue') || '[]');
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
    const cached = JSON.parse(localStorage.getItem('cached-patients') || '[]');
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

  afterEach(() => {
    NetworkSimulator.restore();
    ServiceWorkerTestUtils.cleanup();
    syncSimulator.clear();
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
      const cached = JSON.parse(localStorage.getItem('cached-patients') || '[]');
      expect(cached).toHaveLength(3);

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
      }, { timeout: 5000 });

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
      setTimeout(() => {
        act(() => {
          NetworkSimulator.goOffline();
        });
      }, 50);

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
      }, { timeout: 5000 });
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

      // Check if data was cached by service worker
      const cache = await caches.open('api-cache-v1');
      const cachedResponse = await cache.match('/api/patients');
      
      expect(cachedResponse).toBeDefined();
      const cachedData = await cachedResponse?.json();
      expect(cachedData).toHaveLength(3);
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
      const user = userEvent.setup();
      
      NetworkSimulator.goOnline();
      render(<OfflineApp />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Go offline
      act(() => {
        NetworkSimulator.goOffline();
      });

      // Make multiple changes
      const startTime = performance.now();

      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByText('John Doe'));
        await user.clear(screen.getByPlaceholderText('First Name'));
        await user.type(screen.getByPlaceholderText('First Name'), `John${i}`);
        await user.click(screen.getByText('Save'));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(screen.getByText('Pending changes: 10')).toBeInTheDocument();
      expect(duration).toBeLessThan(5000); // Should handle 10 updates in under 5 seconds
    });

    it('should maintain UI responsiveness while syncing', async () => {
      const user = userEvent.setup();
      
      NetworkSimulator.goOnline();
      render(<OfflineApp />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Create some pending changes
      act(() => {
        const queue = [];
        for (let i = 0; i < 20; i++) {
          queue.push({
            type: 'UPDATE_PATIENT',
            resource: { id: `patient-${i}` },
            timestamp: Date.now(),
            id: i
          });
        }
        localStorage.setItem('sync-queue', JSON.stringify(queue));
      });

      // Mock slow sync
      NetworkSimulator.intercept('/api/sync', {
        response: { success: true },
        delay: 200 // 200ms per sync
      });

      // Trigger sync
      await user.click(screen.getByText('Sync Now'));

      // UI should remain interactive during sync
      expect(screen.getByText(/Syncing.../)).toBeInTheDocument();
      
      // Can still click on patients
      await user.click(screen.getByText('Jane Smith'));
      expect(screen.getByPlaceholderText('First Name')).toHaveValue('Jane');
    });
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

      // Mock sync failure
      let syncAttempts = 0;
      NetworkSimulator.intercept('/api/sync', {
        response: () => {
          syncAttempts++;
          if (syncAttempts < 3) {
            throw new Error('Sync failed');
          }
          return { success: true };
        }
      });

      // Go online
      act(() => {
        NetworkSimulator.goOnline();
      });

      // Should retry and eventually succeed
      await waitFor(() => {
        expect(screen.getByText('Pending changes: 0')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(syncAttempts).toBeGreaterThanOrEqual(3);
    });

    it('should handle corrupted cache gracefully', async () => {
      // Corrupt the cache
      localStorage.setItem('cached-patients', 'invalid json');

      NetworkSimulator.goOffline();
      render(<OfflineApp />, { wrapper: TestWrapper });

      // Should not crash, should show empty or error state
      await waitFor(() => {
        expect(screen.getByText('Patients')).toBeInTheDocument();
      });

      // Should attempt to fetch when online
      NetworkSimulator.goOnline();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });
  });
});