import React from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {Text, Surface, List, IconButton, Badge} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNotifications} from '@services/NotificationProvider';
import {theme, medicalTheme} from '@config/theme';
import {formatDistanceToNow} from 'date-fns';

export const NotificationsScreen: React.FC = () => {
  const {notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification} = useNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'medication_due':
        return 'pill';
      case 'task_reminder':
        return 'clipboard-check';
      case 'patient_alert':
      case 'emergency':
        return 'alert-circle';
      case 'lab_result':
        return 'test-tube';
      default:
        return 'bell';
    }
  };

  const getNotificationColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return medicalTheme.medical.priority.high;
      case 'high':
        return medicalTheme.medical.priority.medium;
      default:
        return theme.colors.onSurfaceVariant;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.header}>
        <View style={styles.headerContent}>
          <Text variant="headlineMedium">Notifications</Text>
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <Badge style={styles.unreadBadge}>{unreadCount}</Badge>
            )}
            <IconButton
              icon="check-all"
              size={24}
              onPress={markAllAsRead}
              disabled={unreadCount === 0}
            />
          </View>
        </View>
      </Surface>

      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="headlineSmall" style={styles.emptyTitle}>
            No notifications
          </Text>
          <Text variant="bodyMedium" style={styles.emptyDescription}>
            You're all caught up!
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {notifications.map((notification) => (
            <Surface
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.read && styles.unreadCard
              ]}
            >
              <List.Item
                title={notification.title}
                description={notification.body}
                descriptionNumberOfLines={3}
                left={() => (
                  <View style={styles.iconContainer}>
                    <List.Icon
                      icon={getNotificationIcon(notification.type)}
                      color={getNotificationColor(notification.priority)}
                    />
                    {!notification.read && (
                      <View style={styles.unreadDot} />
                    )}
                  </View>
                )}
                right={() => (
                  <View style={styles.rightContainer}>
                    <Text variant="bodySmall" style={styles.timestamp}>
                      {formatDistanceToNow(new Date(notification.timestamp), {addSuffix: true})}
                    </Text>
                    <IconButton
                      icon="delete"
                      size={20}
                      onPress={() => deleteNotification(notification.id)}
                    />
                  </View>
                )}
                onPress={() => markAsRead(notification.id)}
              />
            </Surface>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    elevation: 4,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    marginRight: 8,
    backgroundColor: medicalTheme.medical.priority.high,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  notificationCard: {
    marginBottom: 8,
    borderRadius: 12,
    elevation: 2,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  iconContainer: {
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: medicalTheme.medical.priority.high,
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  timestamp: {
    color: theme.colors.onSurfaceVariant,
    marginBottom: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    color: theme.colors.onSurfaceVariant,
  },
  emptyDescription: {
    marginTop: 8,
    color: theme.colors.onSurfaceVariant,
  },
});