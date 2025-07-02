'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Modal, 
  Button, 
  Text, 
  Stack, 
  Group, 
  Badge, 
  Alert,
  Progress,
  ActionIcon,
  Notification,
  Box
} from '@mantine/core';
import { 
  IconDownload, 
  IconRefresh, 
  IconWifi, 
  IconWifiOff, 
  IconCheck,
  IconX,
  IconCloudDownload,
  IconDeviceMobile
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAManagerProps {
  enableInstallPrompt?: boolean;
  enableUpdatePrompt?: boolean;
  enableOfflineIndicator?: boolean;
  enablePerformanceOptimizations?: boolean;
}

export const PWAManager: React.FC<PWAManagerProps> = ({
  enableInstallPrompt = true,
  enableUpdatePrompt = true,
  enableOfflineIndicator = true,
  enablePerformanceOptimizations = true,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [batteryOptimized, setBatteryOptimized] = useState(false);

  // Check if app is already installed
  useEffect(() => {
    const checkInstalled = () => {
      setIsInstalled(
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );
    };

    checkInstalled();
    window.addEventListener('resize', checkInstalled);
    return () => window.removeEventListener('resize', checkInstalled);
  }, []);

  // Handle install prompt
  useEffect(() => {
    if (!enableInstallPrompt) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show install prompt after a delay for better UX
      setTimeout(() => {
        if (!isInstalled) {
          setShowInstallModal(true);
        }
      }, 10000); // Show after 10 seconds
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [enableInstallPrompt, isInstalled]);

  // Handle service worker updates
  useEffect(() => {
    if (!enableUpdatePrompt) return;

    const handleServiceWorkerUpdate = () => {
      setUpdateAvailable(true);
      setShowUpdateModal(true);
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleServiceWorkerUpdate);
      
      // Check for updates periodically
      const checkForUpdates = () => {
        navigator.serviceWorker.getRegistration().then(registration => {
          if (registration) {
            registration.update();
          }
        });
      };

      const updateInterval = setInterval(checkForUpdates, 60000); // Check every minute
      
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleServiceWorkerUpdate);
        clearInterval(updateInterval);
      };
    }
  }, [enableUpdatePrompt]);

  // Monitor network status
  useEffect(() => {
    if (!enableOfflineIndicator) return;

    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      
      if (online) {
        notifications.show({
          id: 'network-status',
          title: 'Back online',
          message: 'Syncing offline changes...',
          color: 'green',
          icon: <IconWifi size={16} />,
          autoClose: 3000,
        });
        
        // Trigger sync when coming back online
        triggerOfflineSync();
      } else {
        notifications.show({
          id: 'network-status',
          title: 'You\'re offline',
          message: 'Changes will be saved locally and synced when connection is restored',
          color: 'orange',
          icon: <IconWifiOff size={16} />,
          autoClose: false,
        });
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [enableOfflineIndicator]);

  // Battery optimization
  useEffect(() => {
    if (!enablePerformanceOptimizations) return;

    const optimizeBattery = async () => {
      try {
        // Request battery status (if available)
        if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery();
          
          if (battery.level < 0.2) { // Battery below 20%
            setBatteryOptimized(true);
            
            // Reduce background activity
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.controller?.postMessage({
                type: 'BATTERY_LOW',
                payload: { level: battery.level }
              });
            }
            
            notifications.show({
              title: 'Battery optimization enabled',
              message: 'Background activity reduced to preserve battery',
              color: 'yellow',
              autoClose: 5000,
            });
          }
        }
      } catch (error) {
        console.log('Battery API not supported');
      }
    };

    optimizeBattery();
  }, [enablePerformanceOptimizations]);

  const handleInstallApp = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        notifications.show({
          title: 'App installed successfully!',
          message: 'OmniCare is now available from your home screen',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }
      
      setDeferredPrompt(null);
      setShowInstallModal(false);
    } catch (error) {
      console.error('Installation failed:', error);
      notifications.show({
        title: 'Installation failed',
        message: 'Please try again or install manually from your browser menu',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  }, [deferredPrompt]);

  const handleUpdateApp = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      });
    }
    setShowUpdateModal(false);
  }, []);

  const triggerOfflineSync = useCallback(async () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      setSyncProgress(0);
      
      try {
        const channel = new MessageChannel();
        
        channel.port1.onmessage = (event) => {
          const { type, progress } = event.data;
          
          if (type === 'SYNC_PROGRESS') {
            setSyncProgress(progress);
          } else if (type === 'SYNC_COMPLETE') {
            setSyncProgress(100);
            setTimeout(() => setSyncProgress(0), 2000);
          }
        };
        
        navigator.serviceWorker.controller.postMessage(
          { type: 'SYNC_NOW' },
          [channel.port2]
        );
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }
  }, []);

  const dismissInstallPrompt = useCallback(() => {
    setShowInstallModal(false);
    // Don't show again for this session
    sessionStorage.setItem('installPromptDismissed', 'true');
  }, []);

  return (
    <>
      {/* Install App Modal */}
      <Modal
        opened={showInstallModal && !isInstalled}
        onClose={dismissInstallPrompt}
        title="Install OmniCare App"
        centered
      >
        <Stack gap="md">
          <Group gap="sm">
            <IconDeviceMobile size={24} color="blue" />
            <Text size="lg" fw={600}>Get the full experience</Text>
          </Group>
          
          <Text size="sm" c="dimmed">
            Install OmniCare as an app for faster access, offline functionality, 
            and a better mobile experience.
          </Text>
          
          <Stack gap="xs">
            <Text size="sm" fw={500}>Benefits:</Text>
            <Text size="sm" c="dimmed">• Works offline with automatic sync</Text>
            <Text size="sm" c="dimmed">• Faster loading and better performance</Text>
            <Text size="sm" c="dimmed">• Home screen access</Text>
            <Text size="sm" c="dimmed">• Native app-like experience</Text>
          </Stack>
          
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={dismissInstallPrompt}>
              Maybe later
            </Button>
            <Button 
              leftSection={<IconDownload size={16} />}
              onClick={handleInstallApp}
            >
              Install App
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Update Available Modal */}
      <Modal
        opened={showUpdateModal && updateAvailable}
        onClose={() => setShowUpdateModal(false)}
        title="Update Available"
        centered
      >
        <Stack gap="md">
          <Group gap="sm">
            <IconCloudDownload size={24} color="green" />
            <Text size="lg" fw={600}>New version available</Text>
          </Group>
          
          <Text size="sm" c="dimmed">
            A new version of OmniCare is available with improvements and bug fixes.
          </Text>
          
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setShowUpdateModal(false)}>
              Later
            </Button>
            <Button 
              leftSection={<IconRefresh size={16} />}
              onClick={handleUpdateApp}
            >
              Update Now
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Network Status Indicator */}
      {enableOfflineIndicator && (
        <Box
          style={{
            position: 'fixed',
            top: 70,
            right: 20,
            zIndex: 999,
          }}
        >
          {!isOnline && (
            <Badge
              color="orange"
              variant="filled"
              leftSection={<IconWifiOff size={12} />}
            >
              Offline
            </Badge>
          )}
          
          {syncProgress > 0 && syncProgress < 100 && (
            <Box mt="xs">
              <Text size="xs" c="dimmed" mb={4}>Syncing...</Text>
              <Progress value={syncProgress} size="sm" />
            </Box>
          )}
        </Box>
      )}

      {/* Battery Optimization Indicator */}
      {batteryOptimized && (
        <Notification
          style={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            maxWidth: 300,
            zIndex: 999,
          }}
          onClose={() => setBatteryOptimized(false)}
          color="yellow"
          title="Battery Saver Active"
        >
          <Text size="sm">
            Some features are limited to preserve battery life.
          </Text>
        </Notification>
      )}
    </>
  );
};

export default PWAManager;