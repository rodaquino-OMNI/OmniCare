import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import PushNotification, {Importance} from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import {Platform, Alert, AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NotificationData, NotificationType, NotificationSettings} from '@types/index';

interface NotificationContextType {
  notifications: NotificationData[];
  unreadCount: number;
  settings: NotificationSettings;
  sendLocalNotification: (notification: Omit<NotificationData, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  requestPermissions: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({children}) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    taskReminders: true,
    medicationAlerts: true,
    patientAlerts: true,
    systemMessages: true,
    soundEnabled: true,
    vibrationEnabled: true,
  });

  useEffect(() => {
    initializeNotifications();
    loadStoredNotifications();
    loadSettings();
    
    return () => {
      // Cleanup
      PushNotification.removeAllDeliveredNotifications();
    };
  }, []);

  const initializeNotifications = () => {
    // Configure PushNotification
    PushNotification.configure({
      onRegister: (token) => {
        console.log('Push notification token:', token);
        // Store token for server registration
        AsyncStorage.setItem('pushToken', token.token);
      },
      onNotification: (notification) => {
        console.log('Notification received:', notification);
        
        if (notification.userInteraction) {
          // User tapped on notification
          handleNotificationTap(notification);
        } else {
          // Notification received while app is active
          handleInAppNotification(notification);
        }
        
        // iOS specific handling
        if (Platform.OS === 'ios') {
          notification.finish(PushNotificationIOS.FetchResult.NoData);
        }
      },
      onAction: (notification) => {
        console.log('Notification action:', notification);
      },
      onRegistrationError: (err) => {
        console.error('Push notification registration error:', err);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      createNotificationChannels();
    }
  };

  const createNotificationChannels = () => {
    const channels = [
      {
        channelId: 'critical',
        channelName: 'Critical Alerts',
        channelDescription: 'Critical patient alerts and emergencies',
        importance: Importance.HIGH,
        vibrate: true,
        sound: 'default',
      },
      {
        channelId: 'medication',
        channelName: 'Medication Reminders',
        channelDescription: 'Medication administration reminders',
        importance: Importance.DEFAULT,
        vibrate: true,
        sound: 'default',
      },
      {
        channelId: 'tasks',
        channelName: 'Task Reminders',
        channelDescription: 'Clinical task reminders',
        importance: Importance.DEFAULT,
        vibrate: false,
        sound: 'default',
      },
      {
        channelId: 'system',
        channelName: 'System Messages',
        channelDescription: 'System updates and messages',
        importance: Importance.LOW,
        vibrate: false,
        sound: null,
      },
    ];

    channels.forEach(channel => {
      PushNotification.createChannel(channel, () => {
        console.log(`Created notification channel: ${channel.channelId}`);
      });
    });
  };

  const loadStoredNotifications = async () => {
    try {
      const stored = await AsyncStorage.getItem('notifications');
      if (stored) {
        const parsedNotifications: NotificationData[] = JSON.parse(stored);
        setNotifications(parsedNotifications);
      }
    } catch (error) {
      console.error('Error loading stored notifications:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('notificationSettings');
      if (stored) {
        const parsedSettings: NotificationSettings = JSON.parse(stored);
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const saveNotifications = async (notificationList: NotificationData[]) => {
    try {
      await AsyncStorage.setItem('notifications', JSON.stringify(notificationList));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  };

  const handleNotificationTap = (notification: any) => {
    // Handle notification tap - navigate to relevant screen
    const {data} = notification;
    
    if (data?.patientId) {
      // Navigate to patient detail screen
      console.log('Navigate to patient:', data.patientId);
    } else if (data?.taskId) {
      // Navigate to task detail screen
      console.log('Navigate to task:', data.taskId);
    }
  };

  const handleInAppNotification = (notification: any) => {
    // Show in-app notification banner
    const notificationData: NotificationData = {
      id: notification.id || Date.now().toString(),
      type: notification.data?.type || 'system_message',
      title: notification.title || 'OmniCare',
      body: notification.message || notification.body || '',
      data: notification.data || {},
      timestamp: new Date().toISOString(),
      read: false,
      priority: notification.data?.priority || 'normal',
    };

    setNotifications(prev => {
      const updated = [notificationData, ...prev];
      saveNotifications(updated);
      return updated;
    });
  };

  const sendLocalNotification = useCallback((notification: Omit<NotificationData, 'id' | 'timestamp' | 'read'>) => {
    if (!settings.enabled) return;

    // Check if notification type is enabled
    const typeEnabled = getNotificationTypeEnabled(notification.type);
    if (!typeEnabled) return;

    const notificationId = Date.now().toString();
    const channelId = getChannelIdForType(notification.type);

    // Create notification data
    const notificationData: NotificationData = {
      ...notification,
      id: notificationId,
      timestamp: new Date().toISOString(),
      read: false,
    };

    // Send local notification
    PushNotification.localNotification({
      id: notificationId,
      title: notification.title,
      message: notification.body,
      playSound: settings.soundEnabled,
      soundName: 'default',
      vibrate: settings.vibrationEnabled,
      channelId,
      priority: notification.priority === 'critical' ? 'high' : 'default',
      data: notification.data,
    });

    // Store notification
    setNotifications(prev => {
      const updated = [notificationData, ...prev];
      saveNotifications(updated);
      return updated;
    });
  }, [settings]);

  const getNotificationTypeEnabled = (type: NotificationType): boolean => {
    switch (type) {
      case 'task_reminder':
        return settings.taskReminders;
      case 'medication_due':
        return settings.medicationAlerts;
      case 'patient_alert':
      case 'emergency':
        return settings.patientAlerts;
      case 'system_message':
      case 'shift_change':
      case 'lab_result':
      case 'appointment_reminder':
        return settings.systemMessages;
      default:
        return true;
    }
  };

  const getChannelIdForType = (type: NotificationType): string => {
    switch (type) {
      case 'emergency':
      case 'patient_alert':
        return 'critical';
      case 'medication_due':
        return 'medication';
      case 'task_reminder':
        return 'tasks';
      default:
        return 'system';
    }
  };

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      );
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(notification => ({ ...notification, read: true }));
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const deleteNotification = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.filter(notification => notification.id !== notificationId);
      saveNotifications(updated);
      return updated;
    });
    
    // Cancel from system tray
    PushNotification.cancelLocalNotifications({ id: notificationId });
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    
    try {
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  }, [settings]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      PushNotification.requestPermissions()
        .then((permissions) => {
          console.log('Notification permissions:', permissions);
          resolve(permissions.alert === true);
        })
        .catch((error) => {
          console.error('Error requesting permissions:', error);
          resolve(false);
        });
    });
  }, []);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Schedule medication reminders
  useEffect(() => {
    if (settings.medicationAlerts) {
      scheduleMedicationReminders();
    }
  }, [settings.medicationAlerts]);

  const scheduleMedicationReminders = async () => {
    // This would integrate with the medication schedule from Medplum
    // For now, we'll create a sample reminder
    const sampleReminder = {
      type: 'medication_due' as NotificationType,
      title: 'Medication Due',
      body: 'Patient John Doe - Metformin 500mg due at 8:00 AM',
      priority: 'high' as const,
      data: {
        patientId: 'patient-123',
        medicationId: 'med-456',
        dueTime: '08:00',
      },
    };

    // Schedule for 30 seconds from now (for testing)
    setTimeout(() => {
      sendLocalNotification(sampleReminder);
    }, 30000);
  };

  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    settings,
    sendLocalNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updateSettings,
    requestPermissions,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};