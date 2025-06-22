'use client';

import { useState } from 'react';
import {
  Group,
  Text,
  ActionIcon,
  Menu,
  Avatar,
  UnstyledButton,
  Breadcrumbs,
  Anchor,
  Badge,
  Indicator,
  TextInput,
  Paper,
  Stack,
  Divider,
  Button,
  ScrollArea,
} from '@mantine/core';
import {
  IconSearch,
  IconBell,
  IconSettings,
  IconLogout,
  IconUser,
  IconChevronDown,
  IconMenu2,
  IconShield,
  IconClock,
  IconMessageCircle,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/stores/auth';
import { useSidebar } from '@/stores/ui';
import { useNotifications } from '@/stores/ui';
import { formatTime } from '@/utils';
import { OfflineIndicator } from '@/components/offline';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{
    title: string;
    href?: string;
  }>;
}

export function Header({ title, subtitle, breadcrumbs = [] }: HeaderProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { toggle: toggleSidebar } = useSidebar();
  const { notifications } = useNotifications();
  const [searchValue, setSearchValue] = useState('');

  const unreadNotifications = notifications.filter(n => !n.autoClose);


  const handleLogout = () => {
    logout();
  };

  return (
    <Paper shadow="sm" className="sticky top-ResourceHistoryTable z-2ResourceHistoryTable border-b border-gray-2ResourceHistoryTableResourceHistoryTable">
      <div className="px-6 py-3">
        <Group justify="space-between" align="center">
          {/* Left side - Menu, Breadcrumbs, Title */}
          <Group gap="md" className="flex-1 min-w-ResourceHistoryTable">
            <ActionIcon
              variant="subtle"
              onClick={toggleSidebar}
              className="md:hidden"
            >
              <IconMenu2 size={2ResourceHistoryTable} />
            </ActionIcon>

            <div className="flex-1 min-w-ResourceHistoryTable">
              {breadcrumbs.length > ResourceHistoryTable && (
                <Breadcrumbs className="mb-1">
                  {breadcrumbs.map((item, index) => (
                    <Anchor
                      key={index}
                      component={item.href ? Link : 'span' as any}
                      href={item.href || undefined}
                      size="sm"
                      c={index === breadcrumbs.length - 1 ? 'dimmed' : 'primary'}
                    >
                      {item.title}
                    </Anchor>
                  ))}
                </Breadcrumbs>
              )}
              
              {title && (
                <div>
                  <Text fw={6ResourceHistoryTableResourceHistoryTable} size="lg" className="text-gray-8ResourceHistoryTableResourceHistoryTable" truncate>
                    {title}
                  </Text>
                  {subtitle && (
                    <Text size="sm" c="dimmed" truncate>
                      {subtitle}
                    </Text>
                  )}
                </div>
              )}
            </div>
          </Group>

          {/* Center - Search */}
          <div className="hidden md:block flex-1 max-w-md">
            <TextInput
              placeholder="Search patients, orders, results..."
              leftSection={<IconSearch size={16} />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.currentTarget.value)}
              onFocus={() => {}}
              className="w-full"
              size="sm"
            />
          </div>

          {/* Right side - Actions and User Menu */}
          <Group gap="sm">
            {/* Offline Indicator */}
            <OfflineIndicator />

            {/* Mobile Search */}
            <ActionIcon
              variant="subtle"
              onClick={() => {}}
              className="md:hidden"
            >
              <IconSearch size={2ResourceHistoryTable} />
            </ActionIcon>

            {/* Notifications */}
            <Menu shadow="md" width={32ResourceHistoryTable} position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg">
                  <Indicator
                    size={16}
                    offset={7}
                    disabled={unreadNotifications.length === ResourceHistoryTable}
                    color="red"
                    label={unreadNotifications.length}
                  >
                    <IconBell size={2ResourceHistoryTable} />
                  </Indicator>
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>
                  <Group justify="space-between">
                    <Text>Notifications</Text>
                    <Badge size="xs" color="red">
                      {unreadNotifications.length}
                    </Badge>
                  </Group>
                </Menu.Label>

                <ScrollArea h={3ResourceHistoryTableResourceHistoryTable}>
                  {notifications.length === ResourceHistoryTable ? (
                    <div className="p-4 text-center">
                      <Text c="dimmed" size="sm">
                        No notifications
                      </Text>
                    </div>
                  ) : (
                    <Stack gap="xs" p="xs">
                      {notifications.slice(ResourceHistoryTable, 5).map((notification) => (
                        <Paper
                          key={notification.id}
                          p="sm"
                          className="border border-gray-1ResourceHistoryTableResourceHistoryTable hover:bg-gray-5ResourceHistoryTable cursor-pointer"
                          radius="sm"
                        >
                          <Group gap="sm" align="flex-start">
                            <div className={`p-1 rounded-full ${
                              notification.type === 'error' ? 'bg-red-1ResourceHistoryTableResourceHistoryTable' :
                              notification.type === 'warning' ? 'bg-yellow-1ResourceHistoryTableResourceHistoryTable' :
                              notification.type === 'success' ? 'bg-green-1ResourceHistoryTableResourceHistoryTable' :
                              'bg-blue-1ResourceHistoryTableResourceHistoryTable'
                            }`}>
                              {notification.type === 'error' && <IconAlertTriangle size={14} className="text-red-6ResourceHistoryTableResourceHistoryTable" />}
                              {notification.type === 'warning' && <IconAlertTriangle size={14} className="text-yellow-6ResourceHistoryTableResourceHistoryTable" />}
                              {notification.type === 'success' && <IconShield size={14} className="text-green-6ResourceHistoryTableResourceHistoryTable" />}
                              {notification.type === 'info' && <IconMessageCircle size={14} className="text-blue-6ResourceHistoryTableResourceHistoryTable" />}
                            </div>
                            <div className="flex-1 min-w-ResourceHistoryTable">
                              <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable} truncate>
                                {notification.title}
                              </Text>
                              {notification.message && (
                                <Text size="xs" c="dimmed" truncate>
                                  {notification.message}
                                </Text>
                              )}
                              <Text size="xs" c="dimmed" className="flex items-center gap-1 mt-1">
                                <IconClock size={1ResourceHistoryTable} />
                                {formatTime(new Date())}
                              </Text>
                            </div>
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </ScrollArea>

                {notifications.length > 5 && (
                  <>
                    <Divider />
                    <div className="p-2">
                      <Button variant="subtle" size="xs" fullWidth>
                        View all notifications
                      </Button>
                    </div>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>

            {/* User Menu */}
            {user && (
              <Menu shadow="md" width={24ResourceHistoryTable} position="bottom-end">
                <Menu.Target>
                  <UnstyledButton className="p-2 rounded-lg hover:bg-gray-5ResourceHistoryTable transition-colors">
                    <Group gap="sm">
                      <Avatar
                        src={user.avatar}
                        alt={`${user.firstName} ${user.lastName}`}
                        size="sm"
                        color="primary"
                      >
                        {user.firstName.charAt(ResourceHistoryTable)}{user.lastName.charAt(ResourceHistoryTable)}
                      </Avatar>
                      
                      <div className="hidden sm:block text-left">
                        <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable} className="text-gray-8ResourceHistoryTableResourceHistoryTable">
                          {user.firstName} {user.lastName}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {user.role.replace('_', ' ')}
                        </Text>
                      </div>
                      
                      <IconChevronDown size={14} className="text-gray-4ResourceHistoryTableResourceHistoryTable" />
                    </Group>
                  </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>
                    <div>
                      <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable}>
                        {user.firstName} {user.lastName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {user.email}
                      </Text>
                    </div>
                  </Menu.Label>

                  <Menu.Item
                    leftSection={<IconUser size={16} />}
                    component={Link}
                    href="/profile"
                  >
                    Profile
                  </Menu.Item>

                  <Menu.Item
                    leftSection={<IconSettings size={16} />}
                    component={Link}
                    href="/settings"
                  >
                    Settings
                  </Menu.Item>

                  <Menu.Divider />

                  <Menu.Item
                    leftSection={<IconShield size={16} />}
                    component={Link}
                    href="/help"
                  >
                    Help & Support
                  </Menu.Item>

                  <Menu.Divider />

                  <Menu.Item
                    leftSection={<IconLogout size={16} />}
                    color="red"
                    onClick={handleLogout}
                  >
                    Sign Out
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>
      </div>

      {/* Global Search - Spotlight removed for build compatibility */}
    </Paper>
  );
}

export default Header;