'use client';

import { useState, useRef } from 'react';
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const unreadNotifications = notifications.filter(n => !n.autoClose);


  const handleLogout = () => {
    logout();
  };

  return (
    <Paper 
      component="header"
      role="banner"
      shadow="sm" 
      className="sticky top-0 z-20 border-b border-gray-200"
    >
      <div className="px-6 py-3">
        <Group justify="space-between" align="center">
          {/* Left side - Menu, Breadcrumbs, Title */}
          <Group gap="md" className="flex-1 min-w-0">
            <ActionIcon
              variant="subtle"
              onClick={toggleSidebar}
              className="md:hidden"
              aria-label="Toggle navigation menu"
              aria-expanded={false}
              title="Menu"
            >
              <IconMenu2 size={20} aria-hidden="true" />
            </ActionIcon>

            <div className="flex-1 min-w-0">
              {breadcrumbs.length > 0 && (
                <nav aria-label="Breadcrumb">
                  <Breadcrumbs className="mb-1">
                    {breadcrumbs.map((item, index) => (
                      <Anchor
                        key={index}
                        component={item.href ? Link : 'span' as any}
                        href={item.href || undefined}
                        size="sm"
                        c={index === breadcrumbs.length - 1 ? 'dimmed' : 'primary'}
                        aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
                      >
                        {item.title}
                      </Anchor>
                    ))}
                  </Breadcrumbs>
                </nav>
              )}
              
              {title && (
                <div>
                  <Text fw={600} size="lg" className="text-gray-800" truncate>
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
              ref={searchInputRef}
              placeholder="Search patients, orders, results..."
              leftSection={<IconSearch size={16} aria-hidden="true" />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.currentTarget.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="w-full"
              size="sm"
              aria-label="Global search"
              aria-describedby="search-help"
              role="searchbox"
              autoComplete="off"
            />
            <div id="search-help" className="sr-only">
              Search for patients, orders, lab results, and other clinical data
            </div>
          </div>

          {/* Right side - Actions and User Menu */}
          <Group gap="sm">
            {/* Offline Indicator */}
            <OfflineIndicator />

            {/* Mobile Search */}
            <ActionIcon
              variant="subtle"
              onClick={() => searchInputRef.current?.focus()}
              className="md:hidden"
              aria-label="Open search"
              title="Search"
            >
              <IconSearch size={20} aria-hidden="true" />
            </ActionIcon>

            {/* Notifications */}
            <Menu 
              shadow="md" 
              width={320} 
              position="bottom-end"
              opened={isNotificationMenuOpen}
              onChange={setIsNotificationMenuOpen}
            >
              <Menu.Target>
                <ActionIcon 
                  variant="subtle" 
                  size="lg"
                  aria-label={`Notifications ${unreadNotifications.length > 0 ? `(${unreadNotifications.length} unread)` : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={isNotificationMenuOpen}
                  title="Notifications"
                >
                  <Indicator
                    size={16}
                    offset={7}
                    disabled={unreadNotifications.length === 0}
                    color="red"
                    label={unreadNotifications.length}
                    aria-label={`${unreadNotifications.length} unread notifications`}
                  >
                    <IconBell size={20} aria-hidden="true" />
                  </Indicator>
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown role="menu" aria-label="Notifications menu">
                <Menu.Label>
                  <Group justify="space-between">
                    <Text component="h3" size="sm" fw={600}>Notifications</Text>
                    <Badge size="xs" color="red" aria-label={`${unreadNotifications.length} unread`}>
                      {unreadNotifications.length}
                    </Badge>
                  </Group>
                </Menu.Label>

                <ScrollArea h={300}>
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center" role="status" aria-live="polite">
                      <Text c="dimmed" size="sm">
                        No notifications
                      </Text>
                    </div>
                  ) : (
                    <Stack gap="xs" p="xs">
                      {notifications.slice(0, 5).map((notification) => (
                        <Paper
                          key={notification.id}
                          p="sm"
                          className="border border-gray-100 hover:bg-gray-50 cursor-pointer"
                          radius="sm"
                          role="menuitem"
                          tabIndex={0}
                          aria-label={`Notification: ${notification.title}. ${notification.message || ''}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              // Handle notification click
                            }
                          }}
                        >
                          <Group gap="sm" align="flex-start">
                            <div className={`p-1 rounded-full ${
                              notification.type === 'error' ? 'bg-red-100' :
                              notification.type === 'warning' ? 'bg-yellow-100' :
                              notification.type === 'success' ? 'bg-green-100' :
                              'bg-blue-100'
                            }`}>
                              {notification.type === 'error' && <IconAlertTriangle size={14} className="text-red-600" />}
                              {notification.type === 'warning' && <IconAlertTriangle size={14} className="text-yellow-600" />}
                              {notification.type === 'success' && <IconShield size={14} className="text-green-600" />}
                              {notification.type === 'info' && <IconMessageCircle size={14} className="text-blue-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <Text size="sm" fw={500} truncate>
                                {notification.title}
                              </Text>
                              {notification.message && (
                                <Text size="xs" c="dimmed" truncate>
                                  {notification.message}
                                </Text>
                              )}
                              <Text size="xs" c="dimmed" className="flex items-center gap-1 mt-1">
                                <IconClock size={10} />
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
              <Menu 
                shadow="md" 
                width={240} 
                position="bottom-end"
                opened={isUserMenuOpen}
                onChange={setIsUserMenuOpen}
              >
                <Menu.Target>
                  <UnstyledButton 
                    className="p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    aria-label={`User menu for ${user.firstName} ${user.lastName}`}
                    aria-haspopup="menu"
                    aria-expanded={isUserMenuOpen}
                  >
                    <Group gap="sm">
                      <Avatar
                        src={user.avatar}
                        alt={`Profile picture of ${user.firstName || ''} ${user.lastName || ''}`}
                        size="sm"
                        color="primary"
                        role="img"
                      >
                        {user.firstName?.charAt(0) || 'U'}{user.lastName?.charAt(0) || ''}
                      </Avatar>
                      
                      <div className="hidden sm:block text-left">
                        <Text size="sm" fw={500} className="text-gray-800">
                          {user.firstName || ''} {user.lastName || ''}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {user.role.replace('_', ' ')}
                        </Text>
                      </div>
                      
                      <IconChevronDown size={14} className="text-gray-400" />
                    </Group>
                  </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown role="menu" aria-label="User account menu">
                  <Menu.Label>
                    <div>
                      <Text size="sm" fw={500} component="h3">
                        {user.firstName} {user.lastName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {user.email}
                      </Text>
                    </div>
                  </Menu.Label>

                  <Menu.Item
                    leftSection={<IconUser size={16} aria-hidden="true" />}
                    component={Link}
                    href="/profile"
                    role="menuitem"
                  >
                    Profile
                  </Menu.Item>

                  <Menu.Item
                    leftSection={<IconSettings size={16} aria-hidden="true" />}
                    component={Link}
                    href="/settings"
                    role="menuitem"
                  >
                    Settings
                  </Menu.Item>

                  <Menu.Divider />

                  <Menu.Item
                    leftSection={<IconShield size={16} aria-hidden="true" />}
                    component={Link}
                    href="/help"
                    role="menuitem"
                  >
                    Help & Support
                  </Menu.Item>

                  <Menu.Divider />

                  <Menu.Item
                    leftSection={<IconLogout size={16} aria-hidden="true" />}
                    color="red"
                    onClick={handleLogout}
                    role="menuitem"
                    aria-label="Sign out of application"
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