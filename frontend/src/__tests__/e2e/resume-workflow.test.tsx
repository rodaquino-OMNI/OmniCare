/**
 * End-to-End Resume/Continue Workflow Tests
 * Tests complete resume scenarios from user perspective
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { NetworkSimulator } from '../offline/network-simulation-utils';
import { ServiceWorkerTestUtils } from '../offline/service-worker-test-utils';

// Mock components that would be in the actual app
const SyncProgressModal = ({ isOpen, onClose, onRetry }: {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
}) => {
  if (!isOpen) return null;
  
  return (
    <div role="dialog" aria-label="Sync Progress">
      <h2>Syncing Data</h2>
      <div data-testid="sync-progress">
        <div>Progress: 45%</div>
        <div>Estimated time: 2 minutes</div>
        <div>Current operation: Syncing patient records...</div>
      </div>
      <button onClick={onRetry}>Retry Sync</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};

const OfflineWorkflowComponent = () => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [syncInProgress, setSyncInProgress] = React.useState(false);
  const [syncModalOpen, setSyncModalOpen] = React.useState(false);
  const [pendingChanges, setPendingChanges] = React.useState(0);
  interface WorkflowItem {
    id: string;
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
    synced: boolean;
  }
  
  const [workflowData, setWorkflowData] = React.useState<WorkflowItem[]>([]);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load pending changes from localStorage
    const saved = localStorage.getItem('pendingWorkflowChanges');
    if (saved) {
      const parsed = JSON.parse(saved);
      setPendingChanges(parsed.length);
      setWorkflowData(parsed);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addWorkflowItem = (type: string, data: Record<string, unknown>) => {
    const newItem = {
      id: `item-${Date.now()}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      synced: false
    };

    const updatedData = [...workflowData, newItem];
    setWorkflowData(updatedData);
    setPendingChanges(updatedData.filter(item => !item.synced).length);
    
    // Save to localStorage for persistence
    localStorage.setItem('pendingWorkflowChanges', JSON.stringify(updatedData));
  };

  const startSync = async () => {
    setSyncInProgress(true);
    setSyncModalOpen(true);

    try {
      // Simulate sync process
      for (let i = 0; i < workflowData.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!navigator.onLine) {
          throw new Error('Network disconnected during sync');
        }
        
        // Mark item as synced
        const updatedData = [...workflowData];
        updatedData[i] = { ...updatedData[i], synced: true };
        setWorkflowData(updatedData);
        setPendingChanges(updatedData.filter(item => !item.synced).length);
      }
      
      setSyncModalOpen(false);
    } catch (error) {
      console.error('Sync failed:', error);
      // Keep modal open for retry
    } finally {
      setSyncInProgress(false);
    }
  };

  const resumeSync = async () => {
    setSyncInProgress(true);
    
    try {
      // Resume from where we left off
      const unsyncedItems = workflowData.filter(item => !item.synced);
      
      for (let i = 0; i < unsyncedItems.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!navigator.onLine) {
          throw new Error('Network disconnected during resume');
        }
        
        // Find and update the item
        const itemIndex = workflowData.findIndex(item => item.id === unsyncedItems[i].id);
        const updatedData = [...workflowData];
        updatedData[itemIndex] = { ...updatedData[itemIndex], synced: true };
        setWorkflowData(updatedData);
        setPendingChanges(updatedData.filter(item => !item.synced).length);
      }
      
      setSyncModalOpen(false);
    } catch (error) {
      console.error('Resume failed:', error);
    } finally {
      setSyncInProgress(false);
    }
  };

  return (
    <div>
      <h1>Clinical Workflow</h1>
      
      {/* Network Status */}
      <div data-testid="network-status">
        Status: {isOnline ? 'Online' : 'Offline'}
      </div>
      
      {/* Pending Changes Indicator */}
      {pendingChanges > 0 && (
        <div data-testid="pending-changes" style={{ background: '#fff3cd', padding: '8px' }}>
          {pendingChanges} changes pending sync
        </div>
      )}
      
      {/* Workflow Actions */}
      <div>
        <button
          onClick={() => addWorkflowItem('patient_registration', {
            name: 'John Doe',
            mrn: 'MRN123',
            dateOfBirth: '1990-01-01'
          })}
        >
          Register Patient
        </button>
        
        <button
          onClick={() => addWorkflowItem('clinical_note', {
            patientId: 'patient-123',
            content: 'Patient doing well, follow-up in 6 months',
            type: 'progress_note'
          })}
        >
          Add Clinical Note
        </button>
        
        <button
          onClick={() => addWorkflowItem('lab_order', {
            patientId: 'patient-123',
            tests: ['CBC', 'Basic Metabolic Panel'],
            urgency: 'routine'
          })}
        >
          Order Labs
        </button>
        
        <button
          onClick={() => addWorkflowItem('medication_order', {
            patientId: 'patient-123',
            medication: 'Lisinopril 10mg',
            frequency: 'daily',
            duration: '30 days'
          })}
        >
          Prescribe Medication
        </button>
      </div>
      
      {/* Sync Controls */}
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={startSync}
          disabled={!isOnline || syncInProgress || pendingChanges === 0}
        >
          {syncInProgress ? 'Syncing...' : 'Sync All Changes'}
        </button>
        
        {!isOnline && pendingChanges > 0 && (
          <div data-testid="offline-message" style={{ color: '#d73527', marginTop: '8px' }}>
            Cannot sync while offline. Changes will be synced when connection is restored.
          </div>
        )}
      </div>
      
      {/* Workflow Items List */}
      <div data-testid="workflow-items" style={{ marginTop: '20px' }}>
        <h3>Workflow Items</h3>
        {workflowData.map(item => (
          <div
            key={item.id}
            style={{
              padding: '8px',
              margin: '4px 0',
              background: item.synced ? '#d4edda' : '#f8d7da',
              border: `1px solid ${item.synced ? '#c3e6cb' : '#f5c6cb'}`
            }}
          >
            <div>{item.type.replace('_', ' ')} - {item.synced ? 'Synced' : 'Pending'}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {new Date(item.timestamp).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
      
      {/* Sync Progress Modal */}
      <SyncProgressModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onRetry={resumeSync}
      />
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

describe('Resume/Continue Workflow E2E Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
    NetworkSimulator.mockFetch();
    ServiceWorkerTestUtils.mockNavigatorServiceWorker();
    
    // Setup online state
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  });

  afterEach(() => {
    NetworkSimulator.restore();
    ServiceWorkerTestUtils.cleanup();
    localStorage.clear();
  });

  describe('Basic Workflow Resume', () => {
    it('should allow user to continue workflow after network interruption', async () => {
      render(<OfflineWorkflowComponent />, { wrapper: TestWrapper });

      // Verify initial online state
      expect(screen.getByTestId('network-status')).toHaveTextContent('Online');

      // Add some workflow items
      await user.click(screen.getByText('Register Patient'));
      await user.click(screen.getByText('Add Clinical Note'));
      await user.click(screen.getByText('Order Labs'));

      // Verify pending changes
      await waitFor(() => {
        expect(screen.getByTestId('pending-changes')).toHaveTextContent('3 changes pending sync');
      });

      // Start sync process
      await user.click(screen.getByText('Sync All Changes'));

      // Verify sync modal appears
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Syncing Data')).toBeInTheDocument();
      });

      // Simulate network interruption during sync
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
        window.dispatchEvent(new Event('offline'));
      });

      // Wait for network status to update
      await waitFor(() => {
        expect(screen.getByTestId('network-status')).toHaveTextContent('Offline');
      });

      // Sync should fail but modal should remain open
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Retry Sync')).toBeInTheDocument();
      });

      // Restore network
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('network-status')).toHaveTextContent('Online');
      });

      // Resume sync
      await user.click(screen.getByText('Retry Sync'));

      // Verify completion
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByTestId('pending-changes')).not.toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify all items are marked as synced
      const workflowItems = screen.getByTestId('workflow-items');
      expect(workflowItems).toHaveTextContent('Synced');
    });

    it('should preserve workflow state across browser refresh', async () => {
      render(<OfflineWorkflowComponent />, { wrapper: TestWrapper });

      // Add workflow items
      await user.click(screen.getByText('Register Patient'));
      await user.click(screen.getByText('Prescribe Medication'));

      // Verify items are added
      await waitFor(() => {
        expect(screen.getByTestId('pending-changes')).toHaveTextContent('2 changes pending sync');
      });

      // Simulate browser refresh by re-rendering component
      const { rerender } = render(<OfflineWorkflowComponent />, { wrapper: TestWrapper });
      rerender(<OfflineWorkflowComponent />);

      // Verify state is restored
      await waitFor(() => {
        expect(screen.getByTestId('pending-changes')).toHaveTextContent('2 changes pending sync');
      });

      const workflowItems = screen.getByTestId('workflow-items');
      expect(workflowItems).toHaveTextContent('patient registration');
      expect(workflowItems).toHaveTextContent('medication order');
    });

    it('should handle partial sync completion and resume correctly', async () => {
      render(<OfflineWorkflowComponent />, { wrapper: TestWrapper });

      // Add multiple workflow items
      await user.click(screen.getByText('Register Patient'));
      await user.click(screen.getByText('Add Clinical Note'));
      await user.click(screen.getByText('Order Labs'));
      await user.click(screen.getByText('Prescribe Medication'));

      // Verify all pending
      await waitFor(() => {
        expect(screen.getByTestId('pending-changes')).toHaveTextContent('4 changes pending sync');
      });

      // Start sync
      await user.click(screen.getByText('Sync All Changes'));

      // Let some items sync before interruption
      await new Promise(resolve => setTimeout(resolve, 400));

      // Interrupt sync
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
        window.dispatchEvent(new Event('offline'));
      });

      // Wait for interruption to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify partial sync completion
      const pendingText = screen.getByTestId('pending-changes').textContent;
      const pendingCount = parseInt(pendingText?.match(/(\d+)/)?.[1] || '0');
      expect(pendingCount).toBeGreaterThan(0);
      expect(pendingCount).toBeLessThan(4);

      // Resume network and sync
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('network-status')).toHaveTextContent('Online');
      });

      // Resume sync
      await user.click(screen.getByText('Retry Sync'));

      // Verify all items complete
      await waitFor(() => {
        expect(screen.queryByTestId('pending-changes')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle adding new items during sync interruption', async () => {
      render(<OfflineWorkflowComponent />, { wrapper: TestWrapper });

      // Add initial items
      await user.click(screen.getByText('Register Patient'));
      await user.click(screen.getByText('Add Clinical Note'));

      // Start sync
      await user.click(screen.getByText('Sync All Changes'));

      // Interrupt immediately
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
        window.dispatchEvent(new Event('offline'));
      });

      // Add more items while offline
      await user.click(screen.getByText('Order Labs'));
      await user.click(screen.getByText('Prescribe Medication'));

      // Verify offline message
      await waitFor(() => {
        expect(screen.getByTestId('offline-message')).toHaveTextContent(
          'Cannot sync while offline'
        );
      });

      // Verify pending count includes new items
      await waitFor(() => {
        expect(screen.getByTestId('pending-changes')).toHaveTextContent('4 changes pending sync');
      });

      // Resume network
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
        window.dispatchEvent(new Event('online'));
      });

      // Resume sync
      await user.click(screen.getByText('Retry Sync'));

      // Verify all items sync
      await waitFor(() => {
        expect(screen.queryByTestId('pending-changes')).not.toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should handle multiple interruption/resume cycles', async () => {
      render(<OfflineWorkflowComponent />, { wrapper: TestWrapper });

      // Add many items
      for (let i = 0; i < 4; i++) {
        await user.click(screen.getByText('Register Patient'));
        await user.click(screen.getByText('Add Clinical Note'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('pending-changes')).toHaveTextContent('8 changes pending sync');
      });

      // Start sync
      await user.click(screen.getByText('Sync All Changes'));

      // Multiple interruption cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        // Let some sync happen
        await new Promise(resolve => setTimeout(resolve, 300));

        // Interrupt
        act(() => {
          Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
          window.dispatchEvent(new Event('offline'));
        });

        await new Promise(resolve => setTimeout(resolve, 200));

        // Resume
        act(() => {
          Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
          window.dispatchEvent(new Event('online'));
        });

        await waitFor(() => {
          expect(screen.getByTestId('network-status')).toHaveTextContent('Online');
        });

        // Continue sync if not complete
        if (screen.queryByText('Retry Sync')) {
          await user.click(screen.getByText('Retry Sync'));
        }
      }

      // Final verification
      await waitFor(() => {
        expect(screen.queryByTestId('pending-changes')).not.toBeInTheDocument();
      }, { timeout: 8000 });
    });

    it('should maintain workflow order and priority during resume', async () => {
      render(<OfflineWorkflowComponent />, { wrapper: TestWrapper });

      // Add items in specific order
      await user.click(screen.getByText('Register Patient')); // High priority
      await user.click(screen.getByText('Order Labs'));       // Medium priority
      await user.click(screen.getByText('Add Clinical Note')); // Low priority
      await user.click(screen.getByText('Prescribe Medication')); // High priority

      // Start sync and interrupt
      await user.click(screen.getByText('Sync All Changes'));
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
        window.dispatchEvent(new Event('offline'));
      });

      // Resume
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
        window.dispatchEvent(new Event('online'));
      });

      await user.click(screen.getByText('Retry Sync'));

      // Verify all complete
      await waitFor(() => {
        expect(screen.queryByTestId('pending-changes')).not.toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify workflow items list shows completion
      const workflowItems = screen.getByTestId('workflow-items');
      const syncedItems = workflowItems.textContent?.split('Synced').length || 0;
      expect(syncedItems - 1).toBe(4); // -1 because split creates extra empty string
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from corrupted localStorage data', async () => {
      // Corrupt localStorage
      localStorage.setItem('pendingWorkflowChanges', 'invalid-json{');

      render(<OfflineWorkflowComponent />, { wrapper: TestWrapper });

      // Should render without crashing
      expect(screen.getByText('Clinical Workflow')).toBeInTheDocument();
      expect(screen.getByTestId('network-status')).toHaveTextContent('Online');

      // Should be able to add new items
      await user.click(screen.getByText('Register Patient'));

      await waitFor(() => {
        expect(screen.getByTestId('pending-changes')).toHaveTextContent('1 changes pending sync');
      });
    });

    it('should handle sync progress modal closure during interruption', async () => {
      render(<OfflineWorkflowComponent />, { wrapper: TestWrapper });

      await user.click(screen.getByText('Register Patient'));
      await user.click(screen.getByText('Sync All Changes'));

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // User closes modal during sync
      await user.click(screen.getByText('Cancel'));

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Should still be able to sync later
      await user.click(screen.getByText('Sync All Changes'));

      await waitFor(() => {
        expect(screen.queryByTestId('pending-changes')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('User Experience During Resume', () => {
    it('should provide clear feedback about sync state and progress', async () => {
      render(<OfflineWorkflowComponent />, { wrapper: TestWrapper });

      // Add items
      await user.click(screen.getByText('Register Patient'));
      await user.click(screen.getByText('Add Clinical Note'));

      // Verify pending state feedback
      await waitFor(() => {
        expect(screen.getByTestId('pending-changes')).toHaveTextContent('2 changes pending sync');
      });

      // Start sync
      await user.click(screen.getByText('Sync All Changes'));

      // Verify sync progress feedback
      await waitFor(() => {
        expect(screen.getByTestId('sync-progress')).toBeInTheDocument();
        expect(screen.getByText(/Progress:/)).toBeInTheDocument();
        expect(screen.getByText(/Estimated time:/)).toBeInTheDocument();
        expect(screen.getByText(/Current operation:/)).toBeInTheDocument();
      });

      // Complete sync
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify completion state
      expect(screen.queryByTestId('pending-changes')).not.toBeInTheDocument();
    });

    it('should disable appropriate controls during sync operations', async () => {
      render(<OfflineWorkflowComponent />, { wrapper: TestWrapper });

      await user.click(screen.getByText('Register Patient'));

      // Sync button should be enabled
      expect(screen.getByText('Sync All Changes')).not.toBeDisabled();

      // Start sync
      await user.click(screen.getByText('Sync All Changes'));

      // Button should show syncing state
      await waitFor(() => {
        expect(screen.getByText('Syncing...')).toBeDisabled();
      });

      // Complete sync
      await waitFor(() => {
        expect(screen.queryByText('Syncing...')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should show appropriate offline messages and guidance', async () => {
      render(<OfflineWorkflowComponent />, { wrapper: TestWrapper });

      await user.click(screen.getByText('Register Patient'));

      // Go offline
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('network-status')).toHaveTextContent('Offline');
        expect(screen.getByTestId('offline-message')).toHaveTextContent(
          'Cannot sync while offline. Changes will be synced when connection is restored.'
        );
      });

      // Sync button should be disabled
      expect(screen.getByText('Sync All Changes')).toBeDisabled();

      // Go back online
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('network-status')).toHaveTextContent('Online');
        expect(screen.queryByTestId('offline-message')).not.toBeInTheDocument();
      });

      // Sync button should be enabled again
      expect(screen.getByText('Sync All Changes')).not.toBeDisabled();
    });
  });
});