'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Notification, Alert, Button, Group, Text, Progress, Stack } from '@mantine/core';
import { 
  IconWifi, 
  IconWifiOff, 
  IconDownload, 
  IconCheck, 
  IconX, 
  IconRefresh,
  IconShieldCheck,
  IconAlertTriangle 
} from '@tabler/icons-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface PWAHealthcareContextType {
  isOnline: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  updateAvailable: boolean;
  syncProgress: number;
  offlineQueueSize: number;
  installApp: () => Promise<void>;
  updateApp: () => Promise<void>;
  syncOfflineData: () => Promise<void>;
  addToOfflineQueue: (data: any) => Promise<void>;
  getOfflineCapabilities: () => OfflineCapability[];
}

interface OfflineCapability {
  name: string;
  description: string;
  available: boolean;
  critical: boolean;
}

interface ServiceWorkerMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

const PWAHealthcareContext = createContext<PWAHealthcareContextType | undefined>(undefined);

interface PWAHealthcareProviderProps {
  children: React.ReactNode;
}

export function PWAHealthcareProvider({ children }: PWAHealthcareProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [offlineQueueSize, setOfflineQueueSize] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const { 
    successAction, 
    errorAction, 
    buttonPress, 
    criticalValue,
    emergencyAlert 
  } = useHapticFeedback();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineAlert(false);
      successAction();
      syncOfflineData();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineAlert(true);
      criticalValue();
    };

    setIsOnline(navigator.onLine);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [successAction, criticalValue]);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      registerServiceWorker();
    }
  }, []);

  // Handle PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
      
      // Check if already installed
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        setCanInstall(false);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      setServiceWorkerRegistration(registration);

      // Listen for service worker messages
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
              setShowUpdatePrompt(true);
            }
          });
        }
      });

      // Auto-update check
      setInterval(() => {
        registration.update();
      }, 60000); // Check every minute

    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  };

  const handleServiceWorkerMessage = (event: MessageEvent<ServiceWorkerMessage>) => {
    const { type, data } = event.data;

    switch (type) {
      case 'SW_ACTIVATED':
        console.log('Service worker activated');
        break;
      case 'SYNC_PROGRESS':
        setSyncProgress(data?.progress || 0);
        break;
      case 'SYNC_COMPLETE':
        setSyncProgress(100);
        successAction();
        setTimeout(() => setSyncProgress(0), 2000);
        break;
      case 'SYNC_ERROR':
        setSyncError(data?.error || 'Sync failed');
        errorAction();
        break;
      case 'OFFLINE_QUEUE_UPDATE':
        setOfflineQueueSize(data?.size || 0);
        break;
      case 'CRITICAL_DATA_CACHED':
        // Critical healthcare data has been cached for offline use
        break;
    }
  };

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return;

    buttonPress();
    
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setCanInstall(false);
        setDeferredPrompt(null);
        successAction();
      } else {
        errorAction();
      }
    } catch (error) {
      console.error('App installation failed:', error);
      errorAction();
    }
  }, [deferredPrompt, buttonPress, successAction, errorAction]);

  const updateApp = useCallback(async () => {
    if (!serviceWorkerRegistration?.waiting) return;

    buttonPress();
    
    try {
      serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Wait for the new service worker to take control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
      
      successAction();
    } catch (error) {
      console.error('App update failed:', error);
      errorAction();
    }
  }, [serviceWorkerRegistration, buttonPress, successAction, errorAction]);

  const syncOfflineData = useCallback(async () => {
    if (!navigator.serviceWorker?.controller) return;

    buttonPress();
    setSyncProgress(0);
    setSyncError(null);

    try {
      // Request background sync
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        await registration.sync.register('sync-offline-queue');
      }
      
      // Manual sync for immediate feedback
      navigator.serviceWorker.controller.postMessage({
        type: 'MANUAL_SYNC',
        timestamp: Date.now(),
      });
      
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncError('Failed to sync offline data');
      errorAction();
    }
  }, [buttonPress, errorAction]);

  const addToOfflineQueue = useCallback(async (data: any) => {
    if (!navigator.serviceWorker?.controller) return;

    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'ADD_TO_QUEUE',
        data,
        timestamp: Date.now(),
      });
      
      setOfflineQueueSize(prev => prev + 1);
    } catch (error) {
      console.error('Failed to add to offline queue:', error);
    }
  }, []);

  const getOfflineCapabilities = useCallback((): OfflineCapability[] => {
    return [
      {
        name: 'Patient Data',
        description: 'View and edit patient information offline',
        available: true,
        critical: true,
      },
      {
        name: 'Clinical Notes',
        description: 'Create and view clinical notes offline',
        available: true,
        critical: true,
      },
      {
        name: 'Medication Lists',
        description: 'Access medication databases offline',
        available: true,
        critical: true,
      },
      {
        name: 'Emergency Protocols',
        description: 'Critical emergency procedures and contacts',
        available: true,
        critical: true,
      },
      {
        name: 'Lab Results',
        description: 'View recent lab results offline',
        available: isOnline,
        critical: false,
      },
      {
        name: 'Appointment Scheduling',
        description: 'Schedule appointments (sync when online)',
        available: false,
        critical: false,
      },
    ];
  }, [isOnline]);

  const contextValue: PWAHealthcareContextType = {
    isOnline,
    isInstalled,
    canInstall,
    updateAvailable,
    syncProgress,
    offlineQueueSize,
    installApp,
    updateApp,
    syncOfflineData,
    addToOfflineQueue,
    getOfflineCapabilities,
  };

  return (
    <PWAHealthcareContext.Provider value={contextValue}>
      {children}
      
      {/* Offline Alert */}
      {showOfflineAlert && (
        <Alert
          icon={<IconWifiOff size={16} />}
          color="orange"
          title="Offline Mode"
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            right: 16,
            zIndex: 1000,
          }}
          withCloseButton
          onClose={() => setShowOfflineAlert(false)}
        >
          <Stack gap="xs">
            <Text size="sm">
              You're currently offline. Critical healthcare data is still available.
            </Text>
            {offlineQueueSize > 0 && (
              <Text size="xs" c="dimmed">
                {offlineQueueSize} items will sync when you're back online.
              </Text>
            )}
          </Stack>
        </Alert>
      )}

      {/* Update Available Prompt */}
      {showUpdatePrompt && (
        <Alert
          icon={<IconDownload size={16} />}
          color="blue"
          title="Update Available"
          style={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            right: 16,
            zIndex: 1000,
          }}
          action={
            <Group gap="xs">
              <Button size="xs" onClick={updateApp}>
                Update
              </Button>
              <Button size="xs" variant="outline" onClick={() => setShowUpdatePrompt(false)}>
                Later
              </Button>
            </Group>
          }
        >
          A new version of OmniCare is available with important security and feature updates.
        </Alert>
      )}

      {/* Install App Prompt */}
      {canInstall && !isInstalled && (
        <Alert
          icon={<IconDownload size={16} />}
          color="green"
          title="Install OmniCare"
          style={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            right: 16,
            zIndex: 1000,
          }}
          action={
            <Group gap="xs">
              <Button size="xs" onClick={installApp}>
                Install
              </Button>
              <Button size="xs" variant="outline" onClick={() => setCanInstall(false)}>
                Not Now
              </Button>
            </Group>
          }
        >
          Install OmniCare for better offline access and healthcare workflows.
        </Alert>
      )}

      {/* Sync Progress */}
      {syncProgress > 0 && syncProgress < 100 && (
        <Alert
          icon={<IconRefresh size={16} />}
          color="blue"
          title="Syncing Data"
          style={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            right: 16,
            zIndex: 1000,
          }}
        >
          <Progress value={syncProgress} size="sm" />
          <Text size="xs" mt="xs">
            Syncing offline changes with server...
          </Text>
        </Alert>
      )}

      {/* Sync Error */}
      {syncError && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="red"
          title="Sync Error"
          style={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            right: 16,
            zIndex: 1000,
          }}
          withCloseButton
          onClose={() => setSyncError(null)}
          action={
            <Button size="xs" onClick={syncOfflineData}>
              Retry
            </Button>
          }
        >
          {syncError}
        </Alert>
      )}
    </PWAHealthcareContext.Provider>
  );
}

export function usePWAHealthcare() {
  const context = useContext(PWAHealthcareContext);
  if (context === undefined) {
    throw new Error('usePWAHealthcare must be used within a PWAHealthcareProvider');
  }
  return context;
}

export default PWAHealthcareProvider;