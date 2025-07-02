'use client';

import { Card, Text, Stack, Table, Badge, Select, TextInput, Group, Button, SimpleGrid } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { IconShield, IconSearch, IconDownload, IconFilter } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);

  const auditLogs = [
    {
      id: '1',
      timestamp: '2024-01-15 14:32:18',
      user: 'Dr. Sarah Smith',
      action: 'view_patient',
      resource: 'Patient: John Doe (ID: 12345)',
      ip: '192.168.1.100',
      result: 'success',
    },
    {
      id: '2',
      timestamp: '2024-01-15 14:28:45',
      user: 'Nurse Johnson',
      action: 'update_vitals',
      resource: 'Patient: Jane Smith (ID: 12346)',
      ip: '192.168.1.101',
      result: 'success',
    },
    {
      id: '3',
      timestamp: '2024-01-15 14:25:12',
      user: 'Admin Davis',
      action: 'create_user',
      resource: 'User: New Nurse Account',
      ip: '192.168.1.102',
      result: 'success',
    },
    {
      id: '4',
      timestamp: '2024-01-15 14:20:30',
      user: 'Dr. Michael Chen',
      action: 'prescribe_medication',
      resource: 'Patient: Robert Brown (ID: 12347)',
      ip: '192.168.1.103',
      result: 'success',
    },
    {
      id: '5',
      timestamp: '2024-01-15 14:15:22',
      user: 'Lab Tech Williams',
      action: 'upload_results',
      resource: 'Lab Order: LB-2024-0156',
      ip: '192.168.1.104',
      result: 'success',
    },
    {
      id: '6',
      timestamp: '2024-01-15 14:10:15',
      user: 'Unknown User',
      action: 'login_failed',
      resource: 'Authentication System',
      ip: '203.0.113.45',
      result: 'failed',
    },
  ];

  const getActionBadgeColor = (action: string) => {
    const colors: Record<string, string> = {
      view_patient: 'blue',
      update_vitals: 'green',
      create_user: 'purple',
      prescribe_medication: 'orange',
      upload_results: 'cyan',
      login_failed: 'red',
      delete_record: 'red',
    };
    return colors[action] || 'gray';
  };

  const getActionLabel = (action: string) => {
    return action.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <ProtectedRoute requiredRoles={['system_admin']}>
      <AppLayout
        title="Audit Logs"
        subtitle="System activity and security audit trail"
      >
        <Stack gap="lg">
          {/* Audit Summary */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Total Events Today</Text>
                <IconShield size={20} className="text-blue-500" />
              </Group>
              <Text size="xl" fw={700}>1,247</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Failed Attempts</Text>
                <IconShield size={20} className="text-red-500" />
              </Group>
              <Text size="xl" fw={700}>23</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Unique Users</Text>
                <IconShield size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700}>89</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Security Alerts</Text>
                <IconShield size={20} className="text-orange-500" />
              </Group>
              <Text size="xl" fw={700}>2</Text>
            </Card>
          </SimpleGrid>

          {/* Filters */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Filter Audit Logs</Text>
            
            <Group mb="md">
              <TextInput
                placeholder="Search logs..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, maxWidth: 300 }}
              />
              
              <Select
                placeholder="All Actions"
                leftSection={<IconFilter size={16} />}
                value={actionFilter}
                onChange={(val) => setActionFilter(val || 'all')}
                data={[
                  { value: 'all', label: 'All Actions' },
                  { value: 'view', label: 'View Records' },
                  { value: 'create', label: 'Create Records' },
                  { value: 'update', label: 'Update Records' },
                  { value: 'delete', label: 'Delete Records' },
                  { value: 'auth', label: 'Authentication' },
                ]}
                style={{ width: 150 }}
              />
              
              <Select
                placeholder="All Users"
                value={userFilter}
                onChange={(val) => setUserFilter(val || 'all')}
                data={[
                  { value: 'all', label: 'All Users' },
                  { value: 'physicians', label: 'Physicians' },
                  { value: 'nurses', label: 'Nurses' },
                  { value: 'admins', label: 'Administrators' },
                  { value: 'system', label: 'System' },
                ]}
                style={{ width: 150 }}
              />
              
              <DatePicker
                type="range"
                placeholder="Date range"
                value={dateRange}
                onChange={setDateRange}
              />
              
              <Button leftSection={<IconDownload size={16} />} variant="light">
                Export
              </Button>
            </Group>

            {/* Audit Log Table */}
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Timestamp</Table.Th>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Action</Table.Th>
                  <Table.Th>Resource</Table.Th>
                  <Table.Th>IP Address</Table.Th>
                  <Table.Th>Result</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {auditLogs.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>
                      <Text size="sm" style={{ fontFamily: 'monospace' }}>
                        {log.timestamp}
                      </Text>
                    </Table.Td>
                    <Table.Td>{log.user}</Table.Td>
                    <Table.Td>
                      <Badge 
                        color={getActionBadgeColor(log.action)} 
                        variant="light"
                        size="sm"
                      >
                        {getActionLabel(log.action)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{log.resource}</Table.Td>
                    <Table.Td>
                      <Text size="sm" style={{ fontFamily: 'monospace' }}>
                        {log.ip}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge 
                        color={log.result === 'success' ? 'green' : 'red'} 
                        variant="light"
                        size="sm"
                      >
                        {log.result}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            
            <Group justify="center" mt="md">
              <Button variant="subtle">Load More</Button>
            </Group>
          </Card>

          {/* Security Alerts */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Recent Security Alerts</Text>
            
            <Stack gap="sm">
              <Card shadow="xs" padding="sm" radius="sm" withBorder style={{ borderColor: '#ef4444' }}>
                <Group justify="space-between">
                  <div>
                    <Text fw={500} c="red">Multiple Failed Login Attempts</Text>
                    <Text size="sm" c="dimmed">
                      5 failed attempts from IP 203.0.113.45 in the last hour
                    </Text>
                  </div>
                  <Button size="xs" color="red" variant="light">
                    Block IP
                  </Button>
                </Group>
              </Card>
              
              <Card shadow="xs" padding="sm" radius="sm" withBorder style={{ borderColor: '#f59e0b' }}>
                <Group justify="space-between">
                  <div>
                    <Text fw={500} c="orange">Unusual Access Pattern</Text>
                    <Text size="sm" c="dimmed">
                      User accessed 50+ patient records in 10 minutes
                    </Text>
                  </div>
                  <Button size="xs" color="orange" variant="light">
                    Investigate
                  </Button>
                </Group>
              </Card>
            </Stack>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}