'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ActionIcon, Badge, Text } from '@mantine/core';
import {
  IconHome,
  IconUsers,
  IconCalendar,
  IconChartBar,
  IconMenu2,
} from '@tabler/icons-react';
import { useAuth } from '@/stores/auth';
import { useSidebar } from '@/stores/ui';

interface NavItem {
  path: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  badge?: number;
  roles?: string[];
}

const navItems: NavItem[] = [
  {
    path: '/dashboard',
    icon: IconHome,
    label: 'Home',
  },
  {
    path: '/patients',
    icon: IconUsers,
    label: 'Patients',
    roles: ['provider', 'nurse', 'admin'],
  },
  {
    path: '/appointments',
    icon: IconCalendar,
    label: 'Schedule',
    badge: 3,
    roles: ['provider', 'nurse', 'receptionist', 'admin'],
  },
  {
    path: '/analytics',
    icon: IconChartBar,
    label: 'Reports',
    roles: ['provider', 'admin'],
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { hasAnyRole } = useAuth();
  const { toggle } = useSidebar();

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || hasAnyRole(item.roles)
  );

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {filteredNavItems.map((item) => {
          const isActive = pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={`flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-lg transition-colors ${
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon size={24} />
                {item.badge && (
                  <Badge
                    size="xs"
                    color="red"
                    className="absolute -top-1 -right-1"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              <Text size="xs" className="mt-1">
                {item.label}
              </Text>
            </button>
          );
        })}

        <button
          onClick={toggle}
          className="flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          aria-label="Menu"
        >
          <IconMenu2 size={24} />
          <Text size="xs" className="mt-1">
            Menu
          </Text>
        </button>
      </div>
    </nav>
  );
}

export default MobileBottomNav;