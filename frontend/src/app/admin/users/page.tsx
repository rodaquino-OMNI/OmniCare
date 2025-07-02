'use client';

import { Card, Text, Stack, Button, Group, Table, Badge, TextInput, Select, Avatar } from '@mantine/core';
import { IconUser, IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function UserManagementPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const users = [
    {
      id: '1',
      name: 'Dr. Sarah Smith',
      email: 'sarah.smith@omnicare.com',
      role: 'physician',
      department: 'Internal Medicine',
      status: 'active',
      lastLogin: '2 hours ago',
    },
    {
      id: '2',
      name: 'Nurse Johnson',
      email: 'n.johnson@omnicare.com',
      role: 'nurse',
      department: 'Emergency',
      status: 'active',
      lastLogin: '30 minutes ago',
    },
    {
      id: '3',
      name: 'Admin Davis',
      email: 'admin.davis@omnicare.com',
      role: 'admin',
      department: 'Administration',
      status: 'active',
      lastLogin: 'Yesterday',
    },
    {
      id: '4',
      name: 'Dr. Michael Chen',
      email: 'm.chen@omnicare.com',
      role: 'physician',
      department: 'Cardiology',
      status: 'inactive',
      lastLogin: '1 week ago',
    },
    {
      id: '5',
      name: 'Tech Williams',
      email: 't.williams@omnicare.com',
      role: 'lab_tech',
      department: 'Laboratory',
      status: 'active',
      lastLogin: '5 hours ago',
    },
  ];

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      physician: 'blue',
      nurse: 'green',
      admin: 'purple',
      lab_tech: 'orange',
      pharmacist: 'cyan',
      system_admin: 'red',
    };
    return colors[role] || 'gray';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      physician: 'Physician',
      nurse: 'Nurse',
      admin: 'Administrator',
      lab_tech: 'Lab Tech',
      pharmacist: 'Pharmacist',
      system_admin: 'System Admin',
    };
    return labels[role] || role;
  };

  return (
    <ProtectedRoute requiredRoles={['system_admin']}>
      <AppLayout
        title="User Management"
        subtitle="Manage system users and permissions"
      >
        <Stack gap="lg">
          {/* User Stats */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Total Users</Text>
                <IconUser size={20} className="text-blue-500" />
              </Group>
              <Text size="xl" fw={700}>142</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Active Users</Text>
                <IconUser size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700}>138</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>New This Month</Text>
                <IconUser size={20} className="text-orange-500" />
              </Group>
              <Text size="xl" fw={700}>8</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Departments</Text>
                <IconUser size={20} className="text-purple-500" />
              </Group>
              <Text size="xl" fw={700}>12</Text>
            </Card>
          </SimpleGrid>

          {/* User List Controls */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Group>
                <TextInput
                  placeholder="Search users..."
                  leftSection={<IconSearch size={16} />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: 300 }}
                />
                <Select
                  placeholder="All Roles"
                  value={roleFilter}
                  onChange={(val) => setRoleFilter(val || 'all')}
                  data={[
                    { value: 'all', label: 'All Roles' },
                    { value: 'physician', label: 'Physicians' },
                    { value: 'nurse', label: 'Nurses' },
                    { value: 'admin', label: 'Administrators' },
                    { value: 'lab_tech', label: 'Lab Technicians' },
                    { value: 'pharmacist', label: 'Pharmacists' },
                  ]}
                  style={{ width: 150 }}
                />
              </Group>
              <Button leftSection={<IconPlus size={16} />}>
                Add User
              </Button>
            </Group>

            {/* User Table */}
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Department</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Last Login</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar color="blue" radius="xl" size="sm">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </Avatar>
                        <div>
                          <Text size="sm" fw={500}>{user.name}</Text>
                          <Text size="xs" c="dimmed">{user.email}</Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getRoleBadgeColor(user.role)} variant="light">
                        {getRoleLabel(user.role)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{user.department}</Table.Td>
                    <Table.Td>
                      <Badge 
                        color={user.status === 'active' ? 'green' : 'gray'} 
                        variant="light"
                      >
                        {user.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{user.lastLogin}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button size="xs" variant="subtle" leftSection={<IconEdit size={14} />}>
                          Edit
                        </Button>
                        <Button 
                          size="xs" 
                          variant="subtle" 
                          color="red"
                          leftSection={<IconTrash size={14} />}
                        >
                          Remove
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>

          {/* Role Permissions */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Role Management</Text>
            <Group>
              <Button variant="light">
                Manage Roles
              </Button>
              <Button variant="light">
                Permission Matrix
              </Button>
              <Button variant="light">
                Access Control
              </Button>
            </Group>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}

import { SimpleGrid } from '@mantine/core';