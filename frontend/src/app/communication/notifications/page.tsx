'use client';

import { Card, Text, Stack, Button, Group, Badge, Switch, Tabs, Checkbox, Select } from '@mantine/core';
import { IconBell, IconAlertCircle, IconCheck, IconTrash, IconSettings } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function NotificationsPage() {
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

  const notifications = [
    {
      id: '1',
      type: 'alert',
      title: 'Critical Lab Result',
      message: 'Patient John Doe - Potassium level 6.2 (Critical High)',
      time: '5 minutes ago',
      read: false,
      priority: 'high',
    },
    {
      id: '2',
      type: 'reminder',
      title: 'Medication Due',
      message: 'Room 203 - Insulin administration due in 30 minutes',
      time: '15 minutes ago',
      read: false,
      priority: 'medium',
    },
    {
      id: '3',
      type: 'system',
      title: 'New Order',
      message: 'Dr. Smith ordered CBC for patient Jane Smith',
      time: '1 hour ago',
      read: true,
      priority: 'normal',
    },
    {
      id: '4',
      type: 'alert',
      title: 'Appointment Reminder',
      message: 'Patient Robert Brown arriving in 15 minutes',
      time: '2 hours ago',
      read: true,
      priority: 'normal',
    },
    {
      id: '5',
      type: 'system',
      title: 'System Maintenance',
      message: 'Scheduled maintenance tonight from 2-3 AM',
      time: 'Yesterday',
      read: true,
      priority: 'low',
    },
  ];

  const notificationSettings = [
    { id: 'critical', label: 'Critical Alerts', description: 'Lab results, vital signs alerts', enabled: true },
    { id: 'orders', label: 'New Orders', description: 'Medication, lab, and imaging orders', enabled: true },
    { id: 'messages', label: 'Messages', description: 'Direct messages from colleagues', enabled: true },
    { id: 'appointments', label: 'Appointments', description: 'Upcoming appointments and changes', enabled: false },
    { id: 'system', label: 'System Updates', description: 'Maintenance and system notifications', enabled: false },
  ];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert': return IconAlertCircle;
      case 'reminder': return IconBell;
      default: return IconBell;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'normal': return 'blue';
      case 'low': return 'gray';
      default: return 'gray';
    }
  };

  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse', 'admin']}>
      <AppLayout
        title="Notifications"
        subtitle="Manage alerts and notifications"
      >
        <Tabs defaultValue="inbox">
          <Tabs.List>
            <Tabs.Tab value="inbox" leftSection={<IconBell size={16} />}>
              Inbox ({notifications.filter(n => !n.read).length})
            </Tabs.Tab>
            <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
              Settings
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="inbox" pt="md">
            <Stack gap="lg">
              {/* Actions Bar */}
              <Card shadow="sm" padding="md" radius="md" withBorder>
                <Group justify="space-between">
                  <Group>
                    <Button 
                      size="sm" 
                      variant="light"
                      leftSection={<IconCheck size={16} />}
                      disabled={selectedNotifications.length === 0}
                    >
                      Mark as Read
                    </Button>
                    <Button 
                      size="sm" 
                      variant="light" 
                      color="red"
                      leftSection={<IconTrash size={16} />}
                      disabled={selectedNotifications.length === 0}
                    >
                      Delete
                    </Button>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {selectedNotifications.length} selected
                  </Text>
                </Group>
              </Card>

              {/* Notifications List */}
              <Stack gap="xs">
                {notifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  return (
                    <Card
                      key={notification.id}
                      shadow="sm"
                      padding="md"
                      radius="md"
                      withBorder
                      style={{
                        backgroundColor: notification.read ? undefined : '#f0f9ff',
                        borderColor: notification.read ? undefined : '#3b82f6',
                      }}
                    >
                      <Group>
                        <Checkbox
                          checked={selectedNotifications.includes(notification.id)}
                          onChange={(event) => {
                            if (event.currentTarget.checked) {
                              setSelectedNotifications([...selectedNotifications, notification.id]);
                            } else {
                              setSelectedNotifications(selectedNotifications.filter(id => id !== notification.id));
                            }
                          }}
                        />
                        <Icon size={24} color={getPriorityColor(notification.priority)} />
                        <div style={{ flex: 1 }}>
                          <Group justify="space-between">
                            <Text fw={notification.read ? 400 : 600}>
                              {notification.title}
                            </Text>
                            <Badge 
                              size="sm" 
                              color={getPriorityColor(notification.priority)} 
                              variant="light"
                            >
                              {notification.priority}
                            </Badge>
                          </Group>
                          <Text size="sm" c="dimmed">{notification.message}</Text>
                          <Text size="xs" c="dimmed" mt="xs">{notification.time}</Text>
                        </div>
                      </Group>
                    </Card>
                  );
                })}
              </Stack>

              {/* Load More */}
              <Group justify="center">
                <Button variant="subtle">Load More Notifications</Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="settings" pt="md">
            <Stack gap="lg">
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text size="lg" fw={600} mb="md">Notification Preferences</Text>
                <Stack gap="md">
                  {notificationSettings.map((setting) => (
                    <Group key={setting.id} justify="space-between">
                      <div>
                        <Text fw={500}>{setting.label}</Text>
                        <Text size="sm" c="dimmed">{setting.description}</Text>
                      </div>
                      <Switch defaultChecked={setting.enabled} />
                    </Group>
                  ))}
                </Stack>
              </Card>

              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text size="lg" fw={600} mb="md">Delivery Methods</Text>
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>In-App Notifications</Text>
                      <Text size="sm" c="dimmed">Show notifications within the application</Text>
                    </div>
                    <Switch defaultChecked />
                  </Group>
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>Email Notifications</Text>
                      <Text size="sm" c="dimmed">Send important alerts to your email</Text>
                    </div>
                    <Switch defaultChecked />
                  </Group>
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>SMS Alerts</Text>
                      <Text size="sm" c="dimmed">Critical alerts only</Text>
                    </div>
                    <Switch />
                  </Group>
                </Stack>
              </Card>

              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text size="lg" fw={600} mb="md">Quiet Hours</Text>
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>Enable Quiet Hours</Text>
                      <Text size="sm" c="dimmed">Mute non-critical notifications during specified hours</Text>
                    </div>
                    <Switch />
                  </Group>
                  <Group>
                    <Select
                      label="From"
                      placeholder="Select time"
                      data={['10:00 PM', '11:00 PM', '12:00 AM']}
                      defaultValue="10:00 PM"
                    />
                    <Select
                      label="To"
                      placeholder="Select time"
                      data={['6:00 AM', '7:00 AM', '8:00 AM']}
                      defaultValue="6:00 AM"
                    />
                  </Group>
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </AppLayout>
    </ProtectedRoute>
  );
}