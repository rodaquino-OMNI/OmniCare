'use client';

import React, { useState, useRef, useEffect } from 'react';
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

// Accessibility utilities
const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ARROW_DOWN: 'ArrowDown',
  ARROW_UP: 'ArrowUp',
  HOME: 'Home',
  END: 'End',
  ESCAPE: 'Escape'
};

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, isCollapsed, toggleCollapse, setActiveSection } = useSidebar();
  const { user, hasAnyRole, logout } = useAuth();
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const skipLinkRef = useRef<HTMLAnchorElement>(null);
  const navigationRefs = useRef<(HTMLElement | null)[]>([]);

  const toggleSection = (section: string) => {
    setActiveSection(section);
    setOpenSections((prev) => {
      const isOpen = prev.includes(section);
      const newSections = isOpen
        ? prev.filter((s) => s !== section)
        : [...prev, section];
      
      // Announce state change to screen readers
      const element = document.querySelector(`[data-section="${section}"]`);
      if (element) {
        element.setAttribute('aria-expanded', (!isOpen).toString());
      }
      
      return newSections;
    });
  };

  // Keyboard navigation handlers
  const handleKeyNavigation = (event: React.KeyboardEvent, index: number) => {
    const totalItems = filteredNavItems.length;
    let newIndex = focusedIndex;

    switch (event.key) {
      case KEYS.ARROW_DOWN:
        event.preventDefault();
        newIndex = index < totalItems - 1 ? index + 1 : 0;
        break;
      case KEYS.ARROW_UP:
        event.preventDefault();
        newIndex = index > 0 ? index - 1 : totalItems - 1;
        break;
      case KEYS.HOME:
        event.preventDefault();
        newIndex = 0;
        break;
      case KEYS.END:
        event.preventDefault();
        newIndex = totalItems - 1;
        break;
      case KEYS.ESCAPE:
        if (isCollapsed) {
          toggleCollapse();
        }
        break;
    }

    if (newIndex !== focusedIndex) {
      setFocusedIndex(newIndex);
      navigationRefs.current[newIndex]?.focus();
    }
  };

  const announceCollapseState = () => {
    const message = isCollapsed ? 'Sidebar collapsed' : 'Sidebar expanded';
    // Create live region announcement
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  useEffect(() => {
    announceCollapseState();
  }, [isCollapsed]);

  const filteredNavItems = NAVIGATION_ITEMS.filter((item) =>
    hasAnyRole(item.roles)
  );

  if (!isOpen) return null;

  const sidebarWidth = isCollapsed ? 80 : 280;

  return (
    <>
      {/* Skip Navigation Link */}
      <a
        ref={skipLinkRef}
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 bg-primary text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>
      
      {/* Desktop Sidebar */}
      <Paper
        component="nav"
        role="navigation"
        aria-label="Main navigation"
        className="fixed left-0 top-0 h-full z-30 border-r border-gray-200"
        style={{ width: sidebarWidth }}
        shadow="sm"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            {!isCollapsed && (
              <Group gap="sm">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Text c="white" fw={700} size="sm">
                    O
                  </Text>
                </div>
                <div>
                  <Text fw={600} size="sm" className="text-gray-800">
                    {APP_NAME}
                  </Text>
                  <Text size="xs" c="dimmed">
                    v1.0.0
                  </Text>
                </div>
              </Group>
            )}
            
            <ActionIcon
              variant="subtle"
              onClick={toggleCollapse}
              size="sm"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!isCollapsed}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
            <div className="p-4 border-b border-gray-200">
              <Group gap="sm">
                <Avatar
                  size={isCollapsed ? 'sm' : 'md'}
                  src={user.avatar}
                  alt={`Profile picture of ${user.firstName || ''} ${user.lastName || ''}`}
                  color="primary"
                  role="img"
                >
                  {user.firstName?.charAt(0) || 'U'}{user.lastName?.charAt(0) || ''}
                </Avatar>
                
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <Text fw={500} size="sm" truncate>
                      {user.firstName || ''} {user.lastName || ''}
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
            <div className="p-4 border-b border-gray-200">
              <Stack gap="xs">
                <UnstyledButton 
                  className="w-full p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  aria-label="Open patient search"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === KEYS.ENTER || e.key === KEYS.SPACE) {
                      e.preventDefault();
                      // Handle search action
                    }
                  }}
                >
                  <Group gap="sm">
                    <IconSearch size={16} className="text-gray-600" aria-hidden="true" />
                    <Text size="sm" c="dimmed">
                      Search patients...
                    </Text>
                  </Group>
                </UnstyledButton>
                
                <Group grow>
                  <ActionIcon 
                    variant="light" 
                    size="sm"
                    aria-label="View notifications"
                    title="Notifications"
                  >
                    <IconBell size={14} aria-hidden="true" />
                  </ActionIcon>
                  <ActionIcon 
                    variant="light" 
                    size="sm"
                    aria-label="Open settings"
                    title="Settings"
                  >
                    <IconSettings size={14} aria-hidden="true" />
                  </ActionIcon>
                </Group>
              </Stack>
            </div>
          )}

          {/* Navigation */}
          <ScrollArea 
            flex={1} 
            className="px-2"
            role="menu"
            aria-label="Navigation menu"
          >
            <Stack gap="xs" py="md" role="menubar">
              {filteredNavItems.map((item, index) => (
                <NavigationItemComponent
                  key={item.path}
                  item={item}
                  pathname={pathname}
                  isCollapsed={isCollapsed}
                  openSections={openSections}
                  onToggleSection={toggleSection}
                  index={index}
                  isFocused={focusedIndex === index}
                  onKeyDown={(e) => handleKeyNavigation(e, index)}
                  ref={(el) => (navigationRefs.current[index] = el)}
                />
              ))}
            </Stack>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <Stack gap="xs">
              {!isCollapsed && (
                <Text size="xs" c="dimmed" ta="center">
                  © 2024 OmniCare EMR
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
                    aria-label="Sign out of application"
                    title="Sign out"
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
      <div style={{ width: sidebarWidth, flexShrink: 0 }} aria-hidden="true" />
      
      {/* Live region for sidebar announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="sidebar-status"
      />
    </>
  );
}

interface NavigationItemComponentProps {
  item: NavigationItem;
  pathname: string;
  isCollapsed: boolean;
  openSections: string[];
  onToggleSection: (section: string) => void;
  index: number;
  isFocused: boolean;
  onKeyDown: (e: React.KeyboardEvent) => void;
  ref: (el: HTMLElement | null) => void;
}

const NavigationItemComponent = React.forwardRef<HTMLElement, NavigationItemComponentProps>(function NavigationItemComponent({
  item,
  pathname,
  isCollapsed,
  openSections,
  onToggleSection,
  index,
  isFocused,
  onKeyDown,
}, ref) {
  const hasChildren = item.children && item.children.length > 0;
  const isActive = pathname === item.path;
  const isOpen = openSections.includes(item.path);
  const isParentActive = hasChildren && item.children?.some(child => pathname === child.path);

  if (hasChildren) {
    return (
      <div role="menuitem" aria-haspopup="menu">
        <UnstyledButton
          ref={ref}
          onClick={() => onToggleSection(item.path)}
          onKeyDown={onKeyDown}
          className={`w-full p-3 rounded-lg transition-colors ${
            isParentActive
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-gray-50'
          } ${isFocused ? 'ring-2 ring-primary ring-offset-2' : ''}`}
          aria-expanded={isOpen}
          aria-controls={`submenu-${item.path}`}
          aria-label={`${item.label} submenu, ${isOpen ? 'expanded' : 'collapsed'}`}
          data-section={item.path}
          tabIndex={isFocused ? 0 : -1}
        >
          <Group justify="space-between">
            <Group gap="sm">
              <item.icon size={20} aria-hidden="true" />
              {!isCollapsed && (
                <Text size="sm" fw={isParentActive ? 500 : 400}>
                  {item.label}
                </Text>
              )}
            </Group>
            
            {!isCollapsed && (
              <IconChevronRight
                size={16}
                aria-hidden="true"
                style={{
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            )}
          </Group>
        </UnstyledButton>

        {!isCollapsed && (
          <Collapse in={isOpen}>
            <Stack 
              gap="xs" 
              ml="md" 
              mt="xs"
              role="menu"
              id={`submenu-${item.path}`}
              aria-label={`${item.label} submenu`}
            >
              {item.children?.map((child) => (
                <NavLink
                  key={child.path}
                  component={Link}
                  href={child.path}
                  label={child.label}
                  leftSection={<child.icon size={16} aria-hidden="true" />}
                  active={pathname === child.path}
                  className="rounded-lg"
                  role="menuitem"
                  aria-current={pathname === child.path ? 'page' : undefined}
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
        ref={ref}
        component={Link}
        href={item.path}
        label={!isCollapsed ? item.label : ''}
        leftSection={<item.icon size={20} aria-hidden="true" />}
        active={isActive}
        className={`rounded-lg ${isFocused ? 'ring-2 ring-primary ring-offset-2' : ''}`}
        role="menuitem"
        aria-current={isActive ? 'page' : undefined}
        aria-label={item.label}
        tabIndex={isFocused ? 0 : -1}
        onKeyDown={onKeyDown}
      />
    </Tooltip>
  );
});

export default Sidebar;