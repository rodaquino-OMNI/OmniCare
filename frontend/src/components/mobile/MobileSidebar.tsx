'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Drawer,
  Stack,
  Group,
  Text,
  NavLink,
  UnstyledButton,
  Collapse,
  ScrollArea,
  Avatar,
  Badge,
  ActionIcon,
  Divider,
} from '@mantine/core';
import {
  IconChevronRight,
  IconX,
  IconLogout,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import { useSidebar } from '@/stores/ui';
import { useAuth } from '@/stores/auth';
import { NAVIGATION_ITEMS, APP_NAME } from '@/constants';
import { NavigationItem } from '@/types';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export function MobileSidebar() {
  const pathname = usePathname();
  const { isOpen, setOpen } = useSidebar();
  const { user, hasAnyRole, logout } = useAuth();
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeVelocity, setSwipeVelocity] = useState(0);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  
  // Haptic feedback hooks
  const { 
    buttonPress, 
    navigation, 
    successAction, 
    errorAction,
    trigger 
  } = useHapticFeedback();

  // Enhanced gesture configuration
  const minSwipeDistance = 50;
  const fastSwipeThreshold = 200; // Fast swipe velocity threshold
  const longPressDelay = 500; // Long press duration in ms

  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setSwipeVelocity(0);
    
    // Haptic feedback for touch start
    buttonPress();
    
    // Start long press timer
    const timer = setTimeout(() => {
      // Long press detected - trigger haptic and show context menu
      trigger('button-press');
      // Could show additional options or context menu here
    }, longPressDelay);
    setLongPressTimer(timer);
  };

  const onTouchMove = (e: TouchEvent) => {
    const currentX = e.targetTouches[0].clientX;
    setTouchEnd(currentX);
    
    // Calculate velocity
    if (touchStart) {
      const distance = Math.abs(currentX - touchStart);
      setSwipeVelocity(distance);
    }
    
    // Clear long press timer if moving
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const onTouchEnd = () => {
    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    const isFastSwipe = swipeVelocity > fastSwipeThreshold;

    if (isLeftSwipe && isOpen) {
      // Left swipe to close
      setOpen(false);
      navigation();
      
      // Extra haptic for fast swipes
      if (isFastSwipe) {
        successAction();
      }
    } else if (isRightSwipe && !isOpen) {
      // Right swipe to open (when sidebar is closed)
      setOpen(true);
      navigation();
      
      if (isFastSwipe) {
        successAction();
      }
    }
  };

  useEffect(() => {
    const drawer = drawerRef.current;
    if (drawer && isOpen) {
      drawer.addEventListener('touchstart', onTouchStart);
      drawer.addEventListener('touchmove', onTouchMove);
      drawer.addEventListener('touchend', onTouchEnd);

      return () => {
        drawer.removeEventListener('touchstart', onTouchStart);
        drawer.removeEventListener('touchmove', onTouchMove);
        drawer.removeEventListener('touchend', onTouchEnd);
      };
    }
  }, [isOpen, touchStart, touchEnd]);

  const toggleSection = (section: string) => {
    // Haptic feedback for section toggle
    buttonPress();
    
    setOpenSections((prev) => {
      const isOpening = !prev.includes(section);
      
      // Different haptic feedback based on action
      if (isOpening) {
        navigation();
      } else {
        buttonPress();
      }
      
      return prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section];
    });
  };

  const filteredNavItems = NAVIGATION_ITEMS.filter((item) =>
    hasAnyRole(item.roles)
  );

  const handleNavigation = () => {
    // Haptic feedback for navigation
    successAction();
    setOpen(false);
  };

  const handleClose = () => {
    // Haptic feedback for close action
    buttonPress();
    setOpen(false);
  };

  const handleLogout = () => {
    // Special haptic pattern for logout
    trigger('warning-action');
    logout();
    handleNavigation();
  };

  return (
    <Drawer
      opened={isOpen}
      onClose={handleClose}
      position="left"
      size="85%"
      withCloseButton={false}
      classNames={{
        content: 'p-0',
        body: 'p-0 h-full',
      }}
      trapFocus={false}
      lockScroll
    >
      <div ref={drawerRef} className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
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
                Mobile
              </Text>
            </div>
          </Group>

          <ActionIcon
            variant="subtle"
            onClick={handleClose}
            size="lg"
            aria-label="Close menu"
            className="min-h-[44px] min-w-[44px]"
          >
            <IconX size={20} />
          </ActionIcon>
        </div>

        {/* User Info */}
        {user && (
          <div className="p-4 border-b border-gray-200">
            <Group gap="sm">
              <Avatar
                size="lg"
                src={user.avatar}
                alt={`${user.firstName || ''} ${user.lastName || ''}`}
                color="primary"
              >
                {user.firstName?.charAt(0) || 'U'}
                {user.lastName?.charAt(0) || ''}
              </Avatar>

              <div className="flex-1 min-w-0">
                <Text fw={500} size="sm" truncate>
                  {user.firstName || ''} {user.lastName || ''}
                </Text>
                <Badge size="xs" variant="light" color="primary">
                  {user.role.replace('_', ' ')}
                </Badge>
              </div>
            </Group>
          </div>
        )}

        {/* Navigation */}
        <ScrollArea flex={1} className="px-2">
          <Stack gap="xs" py="md">
            {filteredNavItems.map((item) => (
              <MobileNavigationItem
                key={item.path}
                item={item}
                pathname={pathname}
                openSections={openSections}
                onToggleSection={toggleSection}
                onNavigate={handleNavigation}
              />
            ))}
          </Stack>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200">
          <Stack gap="xs">
            <NavLink
              component={Link}
              href="/profile"
              label="Profile"
              leftSection={<IconUser size={20} />}
              onClick={handleNavigation}
              className="rounded-lg min-h-[44px]"
            />
            <NavLink
              component={Link}
              href="/settings"
              label="Settings"
              leftSection={<IconSettings size={20} />}
              onClick={handleNavigation}
              className="rounded-lg min-h-[44px]"
            />
            <Divider my="xs" />
            <NavLink
              component="button"
              label="Sign Out"
              leftSection={<IconLogout size={20} />}
              onClick={handleLogout}
              className="rounded-lg text-red-600 min-h-[44px]"
              c="red"
            />
          </Stack>
        </div>
      </div>
    </Drawer>
  );
}

interface MobileNavigationItemProps {
  item: NavigationItem;
  pathname: string;
  openSections: string[];
  onToggleSection: (section: string) => void;
  onNavigate: () => void;
}

function MobileNavigationItem({
  item,
  pathname,
  openSections,
  onToggleSection,
  onNavigate,
}: MobileNavigationItemProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isActive = pathname === item.path;
  const isOpen = openSections.includes(item.path);
  const isParentActive =
    hasChildren && item.children?.some((child) => pathname === child.path);

  if (hasChildren) {
    return (
      <div>
        <UnstyledButton
          onClick={() => onToggleSection(item.path)}
          className={`w-full p-3 rounded-lg transition-colors min-h-[44px] ${
            isParentActive ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50'
          }`}
        >
          <Group justify="space-between">
            <Group gap="sm">
              <item.icon size={20} />
              <Text size="sm" fw={isParentActive ? 500 : 400}>
                {item.label}
              </Text>
            </Group>

            <IconChevronRight
              size={16}
              style={{
                transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            />
          </Group>
        </UnstyledButton>

        <Collapse in={isOpen}>
          <Stack gap="xs" ml="xl" mt="xs">
            {item.children?.map((child) => (
              <NavLink
                key={child.path}
                component={Link}
                href={child.path}
                label={child.label}
                leftSection={<child.icon size={16} />}
                active={pathname === child.path}
                onClick={onNavigate}
                className="rounded-lg min-h-[44px]"
              />
            ))}
          </Stack>
        </Collapse>
      </div>
    );
  }

  return (
    <NavLink
      component={Link}
      href={item.path}
      label={item.label}
      leftSection={<item.icon size={20} />}
      active={isActive}
      onClick={onNavigate}
      className="rounded-lg min-h-[44px]"
    />
  );
}

export default MobileSidebar;