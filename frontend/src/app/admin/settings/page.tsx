'use client';

import { Card, Text, Stack, Switch, Select, TextInput, Button, Group, Tabs, NumberInput } from '@mantine/core';
import { IconSettings, IconDatabase, IconShield, IconBell, IconPalette } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState({
    siteName: 'OmniCare EMR',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    language: 'en',
    theme: 'light',
    sessionTimeout: 30,
    passwordExpiry: 90,
    twoFactorAuth: true,
    auditLogging: true,
    autoBackup: true,
    maintenanceMode: false,
  });

  return (
    <ProtectedRoute requiredRoles={['system_admin']}>
      <AppLayout
        title="System Settings"
        subtitle="Configure system-wide settings and preferences"
      >
        <Tabs defaultValue="general">
          <Tabs.List>
            <Tabs.Tab value="general" leftSection={<IconSettings size={16} />}>
              General
            </Tabs.Tab>
            <Tabs.Tab value="security" leftSection={<IconShield size={16} />}>
              Security
            </Tabs.Tab>
            <Tabs.Tab value="database" leftSection={<IconDatabase size={16} />}>
              Database
            </Tabs.Tab>
            <Tabs.Tab value="notifications" leftSection={<IconBell size={16} />}>
              Notifications
            </Tabs.Tab>
            <Tabs.Tab value="appearance" leftSection={<IconPalette size={16} />}>
              Appearance
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="general" pt="md">
            <Stack gap="lg">
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text size="lg" fw={600} mb="md">General Settings</Text>
                
                <Stack gap="md">
                  <TextInput
                    label="Site Name"
                    placeholder="Enter site name"
                    value={settings.siteName}
                    onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                  />
                  
                  <Select
                    label="Timezone"
                    placeholder="Select timezone"
                    value={settings.timezone}
                    onChange={(val) => setSettings({ ...settings, timezone: val || '' })}
                    data={[
                      { value: 'America/New_York', label: 'Eastern Time (ET)' },
                      { value: 'America/Chicago', label: 'Central Time (CT)' },
                      { value: 'America/Denver', label: 'Mountain Time (MT)' },
                      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
                    ]}
                  />
                  
                  <Select
                    label="Date Format"
                    placeholder="Select date format"
                    value={settings.dateFormat}
                    onChange={(val) => setSettings({ ...settings, dateFormat: val || '' })}
                    data={[
                      { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                      { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                      { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                    ]}
                  />
                  
                  <Select
                    label="Language"
                    placeholder="Select language"
                    value={settings.language}
                    onChange={(val) => setSettings({ ...settings, language: val || '' })}
                    data={[
                      { value: 'en', label: 'English' },
                      { value: 'es', label: 'Spanish' },
                      { value: 'fr', label: 'French' },
                    ]}
                  />
                </Stack>
                
                <Group mt="xl">
                  <Button>Save General Settings</Button>
                  <Button variant="light">Reset to Defaults</Button>
                </Group>
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="security" pt="md">
            <Stack gap="lg">
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text size="lg" fw={600} mb="md">Security Settings</Text>
                
                <Stack gap="md">
                  <NumberInput
                    label="Session Timeout (minutes)"
                    placeholder="Enter timeout duration"
                    value={settings.sessionTimeout}
                    onChange={(val) => setSettings({ ...settings, sessionTimeout: Number(val) })}
                    min={5}
                    max={120}
                  />
                  
                  <NumberInput
                    label="Password Expiry (days)"
                    placeholder="Enter expiry period"
                    value={settings.passwordExpiry}
                    onChange={(val) => setSettings({ ...settings, passwordExpiry: Number(val) })}
                    min={0}
                    max={365}
                  />
                  
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>Two-Factor Authentication</Text>
                      <Text size="sm" c="dimmed">Require 2FA for all users</Text>
                    </div>
                    <Switch
                      checked={settings.twoFactorAuth}
                      onChange={(e) => setSettings({ ...settings, twoFactorAuth: e.currentTarget.checked })}
                    />
                  </Group>
                  
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>Audit Logging</Text>
                      <Text size="sm" c="dimmed">Log all system access and changes</Text>
                    </div>
                    <Switch
                      checked={settings.auditLogging}
                      onChange={(e) => setSettings({ ...settings, auditLogging: e.currentTarget.checked })}
                    />
                  </Group>
                </Stack>
                
                <Group mt="xl">
                  <Button>Save Security Settings</Button>
                  <Button variant="light" color="red">Force Password Reset All Users</Button>
                </Group>
              </Card>

              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text size="lg" fw={600} mb="md">Password Policy</Text>
                <Stack gap="sm">
                  <Checkbox label="Require uppercase letters" defaultChecked />
                  <Checkbox label="Require lowercase letters" defaultChecked />
                  <Checkbox label="Require numbers" defaultChecked />
                  <Checkbox label="Require special characters" defaultChecked />
                  <NumberInput label="Minimum password length" defaultValue={8} min={6} max={20} />
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="database" pt="md">
            <Stack gap="lg">
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text size="lg" fw={600} mb="md">Database Settings</Text>
                
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>Automatic Backup</Text>
                      <Text size="sm" c="dimmed">Daily automated database backup</Text>
                    </div>
                    <Switch
                      checked={settings.autoBackup}
                      onChange={(e) => setSettings({ ...settings, autoBackup: e.currentTarget.checked })}
                    />
                  </Group>
                  
                  <Select
                    label="Backup Schedule"
                    placeholder="Select backup time"
                    defaultValue="02:00"
                    data={[
                      { value: '00:00', label: '12:00 AM' },
                      { value: '02:00', label: '2:00 AM' },
                      { value: '04:00', label: '4:00 AM' },
                    ]}
                  />
                  
                  <TextInput
                    label="Backup Retention (days)"
                    placeholder="Number of days to keep backups"
                    defaultValue="30"
                  />
                </Stack>
                
                <Group mt="xl">
                  <Button>Save Database Settings</Button>
                  <Button variant="light">Backup Now</Button>
                  <Button variant="light">View Backup History</Button>
                </Group>
              </Card>

              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text size="lg" fw={600} mb="md">Database Status</Text>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm">Database Size</Text>
                    <Text size="sm" fw={500}>24.7 GB</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Last Backup</Text>
                    <Text size="sm" fw={500}>Today at 2:00 AM</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Connection Pool</Text>
                    <Text size="sm" fw={500}>45/100 active</Text>
                  </Group>
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="notifications" pt="md">
            <Stack gap="lg">
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text size="lg" fw={600} mb="md">Email Settings</Text>
                
                <Stack gap="md">
                  <TextInput
                    label="SMTP Server"
                    placeholder="smtp.example.com"
                  />
                  <NumberInput
                    label="SMTP Port"
                    placeholder="587"
                    defaultValue={587}
                  />
                  <TextInput
                    label="From Email"
                    placeholder="noreply@omnicare.com"
                  />
                  <TextInput
                    label="Reply-To Email"
                    placeholder="support@omnicare.com"
                  />
                </Stack>
                
                <Group mt="xl">
                  <Button>Save Email Settings</Button>
                  <Button variant="light">Test Email Configuration</Button>
                </Group>
              </Card>

              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text size="lg" fw={600} mb="md">Notification Templates</Text>
                <Stack gap="sm">
                  <Button variant="light" fullWidth>Password Reset Email</Button>
                  <Button variant="light" fullWidth>Account Activation Email</Button>
                  <Button variant="light" fullWidth>Appointment Reminder</Button>
                  <Button variant="light" fullWidth>Lab Results Available</Button>
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="appearance" pt="md">
            <Stack gap="lg">
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text size="lg" fw={600} mb="md">Theme Settings</Text>
                
                <Stack gap="md">
                  <Select
                    label="Color Theme"
                    placeholder="Select theme"
                    value={settings.theme}
                    onChange={(val) => setSettings({ ...settings, theme: val || '' })}
                    data={[
                      { value: 'light', label: 'Light Theme' },
                      { value: 'dark', label: 'Dark Theme' },
                      { value: 'auto', label: 'Auto (System)' },
                    ]}
                  />
                  
                  <Select
                    label="Primary Color"
                    placeholder="Select primary color"
                    defaultValue="blue"
                    data={[
                      { value: 'blue', label: 'Blue' },
                      { value: 'green', label: 'Green' },
                      { value: 'purple', label: 'Purple' },
                      { value: 'orange', label: 'Orange' },
                    ]}
                  />
                </Stack>
                
                <Group mt="xl">
                  <Button>Save Theme Settings</Button>
                  <Button variant="light">Preview Changes</Button>
                </Group>
              </Card>

              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text size="lg" fw={600} mb="md">Branding</Text>
                <Stack gap="md">
                  <TextInput
                    label="Logo URL"
                    placeholder="https://example.com/logo.png"
                  />
                  <TextInput
                    label="Favicon URL"
                    placeholder="https://example.com/favicon.ico"
                  />
                  <Textarea
                    label="Custom CSS"
                    placeholder="/* Custom styles */"
                    rows={4}
                  />
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </AppLayout>
    </ProtectedRoute>
  );
}

import { Checkbox, Textarea } from '@mantine/core';