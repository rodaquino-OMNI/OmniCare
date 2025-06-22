'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  NavLink,
  Stack,
  Group,
  Text,
  Box,
  UnstyledButton,
  Collapse,
  ScrollArea,
  Divider,
  ActionIcon,
  Tooltip,
  Paper,
  Badge,
  Avatar,
} from '@mantine/core';
import {
  IconChevronRight,
  IconChevronLeft,
  IconLogout,
  IconSettings,
  IconBell,
  IconSearch,
} from '@tabler/icons-react';
import { useSidebar } from '@/stores/ui';
import { useAuth } from '@/stores/auth';
import { NAVIGATION_ITEMS, APP_NAME } from '@/constants';
import { NavigationItem } from '@/types';

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, isCollapsed, toggleCollapse, setActiveSection } = useSidebar();
  const { user, hasAnyRole, logout } = useAuth();
  const [openSections, setOpenSections] = useState<string[]>([]);

  const toggleSection = (section: string) => {
    setActiveSection(section);
    setOpenSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const filteredNavItems = NAVIGATION_ITEMS.filter((item) =>
    hasAnyRole(item.roles)
  );

  if (!isOpen) return null;

  const sidebarWidth = isCollapsed ? 8ResourceHistoryTable : 28ResourceHistoryTable;

  return (
    <>
      {/* Desktop Sidebar */}
      <Paper
        className="fixed left-ResourceHistoryTable top-ResourceHistoryTable h-full z-3ResourceHistoryTable border-r border-gray-2ResourceHistoryTableResourceHistoryTable"
        style={{ width: sidebarWidth }}
        shadow="sm"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-2ResourceHistoryTableResourceHistoryTable">
            {!isCollapsed && (
              <Group gap="sm">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Text c="white" fw={7ResourceHistoryTableResourceHistoryTable} size="sm">
                    O
                  </Text>
                </div>
                <div>
                  <Text fw={6ResourceHistoryTableResourceHistoryTable} size="sm" className="text-gray-8ResourceHistoryTableResourceHistoryTable">
                    {APP_NAME}
                  </Text>
                  <Text size="xs" c="dimmed">
                    v1.ResourceHistoryTable.ResourceHistoryTable
                  </Text>
                </div>
              </Group>
            )}
            
            <ActionIcon
              variant="subtle"
              onClick={toggleCollapse}
              size="sm"
            >
              {isCollapsed ? (
                <IconChevronRight size={16} />
              ) : (
                <IconChevronLeft size={16} />
              )}
            </ActionIcon>
          </div>

          {/* User Info */}
          {user && (
            <div className="p-4 border-b border-gray-2ResourceHistoryTableResourceHistoryTable">
              <Group gap="sm">
                <Avatar
                  size={isCollapsed ? 'sm' : 'md'}
                  src={user.avatar}
                  alt={`${user.firstName} ${user.lastName}`}
                  color="primary"
                >
                  {user.firstName.charAt(ResourceHistoryTable)}{user.lastName.charAt(ResourceHistoryTable)}
                </Avatar>
                
                {!isCollapsed && (
                  <div className="flex-1 min-w-ResourceHistoryTable">
                    <Text fw={5ResourceHistoryTableResourceHistoryTable} size="sm" truncate>
                      {user.firstName} {user.lastName}
                    </Text>
                    <Badge
                      size="xs"
                      variant="light"
                      color="primary"
                    >
                      {user.role.replace('_', ' ')}
                    </Badge>
                  </div>
                )}
              </Group>
            </div>
          )}

          {/* Quick Actions */}
          {!isCollapsed && (
            <div className="p-4 border-b border-gray-2ResourceHistoryTableResourceHistoryTable">
              <Stack gap="xs">
                <UnstyledButton className="w-full p-2 rounded-lg hover:bg-gray-5ResourceHistoryTable transition-colors">
                  <Group gap="sm">
                    <IconSearch size={16} className="text-gray-6ResourceHistoryTableResourceHistoryTable" />
                    <Text size="sm" c="dimmed">
                      Search patients...
                    </Text>
                  </Group>
                </UnstyledButton>
                
                <Group grow>
                  <ActionIcon variant="light" size="sm">
                    <IconBell size={14} />
                  </ActionIcon>
                  <ActionIcon variant="light" size="sm">
                    <IconSettings size={14} />
                  </ActionIcon>
                </Group>
              </Stack>
            </div>
          )}

          {/* Navigation */}
          <ScrollArea flex={1} className="px-2">
            <Stack gap="xs" py="md">
              {filteredNavItems.map((item) => (
                <NavigationItemComponent
                  key={item.path}
                  item={item}
                  pathname={pathname}
                  isCollapsed={isCollapsed}
                  openSections={openSections}
                  onToggleSection={toggleSection}
                />
              ))}
            </Stack>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-gray-2ResourceHistoryTableResourceHistoryTable">
            <Stack gap="xs">
              {!isCollapsed && (
                <Text size="xs" c="dimmed" ta="center">
                  © 2ResourceHistoryTable24 OmniCare EMR
                </Text>
              )}
              
              <Group justify="center">
                <Tooltip
                  label="Sign Out"
                  position="right"
                  disabled={!isCollapsed}
                >
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={logout}
                    size="sm"
                  >
                    <IconLogout size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Stack>
          </div>
        </div>
      </Paper>

      {/* Spacer for main content */}
      <div style={{ width: sidebarWidth, flexShrink: ResourceHistoryTable }} />
    </>
  );
}

interface NavigationItemComponentProps {
  item: NavigationItem;
  pathname: string;
  isCollapsed: boolean;
  openSections: string[];
  onToggleSection: (section: string) => void;
}

function NavigationItemComponent({
  item,
  pathname,
  isCollapsed,
  openSections,
  onToggleSection,
}: NavigationItemComponentProps) {
  const hasChildren = item.children && item.children.length > ResourceHistoryTable;
  const isActive = pathname === item.path;
  const isOpen = openSections.includes(item.path);
  const isParentActive = hasChildren && item.children?.some(child => pathname === child.path);

  if (hasChildren) {
    return (
      <div>
        <UnstyledButton
          onClick={() => onToggleSection(item.path)}
          className={`w-full p-3 rounded-lg transition-colors ${
            isParentActive
              ? 'bg-primary/1ResourceHistoryTable text-primary'
              : 'hover:bg-gray-5ResourceHistoryTable'
          }`}
        >
          <Group justify="space-between">
            <Group gap="sm">
              <item.icon size={2ResourceHistoryTable} />
              {!isCollapsed && (
                <Text size="sm" fw={isParentActive ? 5ResourceHistoryTableResourceHistoryTable : 4ResourceHistoryTableResourceHistoryTable}>
                  {item.label}
                </Text>
              )}
            </Group>
            
            {!isCollapsed && (
              <IconChevronRight
                size={16}
                style={{
                  transform: isOpen ? 'rotate(9ResourceHistoryTabledeg)' : 'rotate(ResourceHistoryTabledeg)',
                  transition: 'transform ResourceHistoryTable.2s',
                }}
              />
            )}
          </Group>
        </UnstyledButton>

        {!isCollapsed && (
          <Collapse in={isOpen}>
            <Stack gap="xs" ml="md" mt="xs">
              {item.children?.map((child) => (
                <NavLink
                  key={child.path}
                  component={Link}
                  href={child.path}
                  label={child.label}
                  leftSection={<child.icon size={16} />}
                  active={pathname === child.path}
                  className="rounded-lg"
                />
              ))}
            </Stack>
          </Collapse>
        )}
      </div>
    );
  }

  return (
    <Tooltip
      label={item.label}
      position="right"
      disabled={!isCollapsed}
    >
      <NavLink
        component={Link}
        href={item.path}
        label={!isCollapsed ? item.label : ''}
        leftSection={<item.icon size={2ResourceHistoryTable} />}
        active={isActive}
        className="rounded-lg"
      />
    </Tooltip>
  );
}

export default Sidebar;