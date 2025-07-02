'use client';

import { useState, useEffect } from 'react';
import {
  Group,
  Text,
  Breadcrumbs,
  Anchor,
  ActionIcon,
  Tooltip,
  Modal,
  TextInput,
  Stack,
  Card,
  Badge,
  Kbd,
  ScrollArea,
  Paper,
  Spotlight,
  Button,
  Divider
} from '@mantine/core';
import {
  IconSearch,
  IconKeyboard,
  IconHome,
  IconUser,
  IconStethoscope,
  IconPill,
  IconTestPipe,
  IconCalendar,
  IconMessage,
  IconSettings,
  IconChevronRight,
  IconClock,
  IconStar,
  IconHistory,
  IconBookmark,
  IconCommand
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth';
import { NAVIGATION_ITEMS, KEYBOARD_SHORTCUTS } from '@/constants';
import { NavigationItem } from '@/types';

interface Breadcrumb {
  title: string;
  href?: string;
  icon?: React.ComponentType<any>;
}

interface EnhancedNavigationProps {
  breadcrumbs?: Breadcrumb[];
  title?: string;
  subtitle?: string;
  showSearch?: boolean;
  showShortcuts?: boolean;
}

interface QuickAccessItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  href: string;
  shortcut?: string;
  category: 'patients' | 'clinical' | 'orders' | 'communication' | 'admin';
  keywords: string[];
  lastUsed?: Date;
  isFavorite?: boolean;
}

interface RecentItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ComponentType<any>;
  timestamp: Date;
  type: 'patient' | 'encounter' | 'order' | 'result';
}

export function EnhancedNavigation({
  breadcrumbs = [],
  title,
  subtitle,
  showSearch = true,
  showShortcuts = true
}: EnhancedNavigationProps) {
  const [searchOpened, setSearchOpened] = useState(false);
  const [shortcutsOpened, setShortcutsOpened] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  const router = useRouter();
  const { user, hasAnyRole } = useAuth();

  // Mock quick access items - in real app, this would be dynamic based on user role and permissions
  const quickAccessItems: QuickAccessItem[] = [
    {
      id: 'patient-search',
      title: 'Patient Search',
      description: 'Find and view patient records',
      icon: IconSearch,
      href: '/patients/search',
      shortcut: 'Ctrl+K',
      category: 'patients',
      keywords: ['patient', 'search', 'find', 'lookup', 'mrn'],
      isFavorite: favorites.includes('patient-search')
    },
    {
      id: 'new-encounter',
      title: 'New Encounter',
      description: 'Start a new patient encounter',
      icon: IconStethoscope,
      href: '/clinical/encounters/new',
      shortcut: 'Ctrl+N',
      category: 'clinical',
      keywords: ['encounter', 'visit', 'appointment', 'new', 'clinical'],
      isFavorite: favorites.includes('new-encounter')
    },
    {
      id: 'prescribe-medication',
      title: 'Prescribe Medication',
      description: 'Create new medication orders',
      icon: IconPill,
      href: '/medications/prescribe',
      category: 'orders',
      keywords: ['medication', 'prescription', 'drug', 'prescribe', 'pharmacy'],
      isFavorite: favorites.includes('prescribe-medication')
    },
    {
      id: 'order-labs',
      title: 'Order Laboratory Tests',
      description: 'Request lab work and diagnostics',
      icon: IconTestPipe,
      href: '/orders/lab',
      category: 'orders',
      keywords: ['lab', 'laboratory', 'test', 'order', 'diagnostic'],
      isFavorite: favorites.includes('order-labs')
    },
    {
      id: 'schedule-appointment',
      title: 'Schedule Appointment',
      description: 'Book patient appointments',
      icon: IconCalendar,
      href: '/scheduling/appointments/new',
      category: 'admin',
      keywords: ['schedule', 'appointment', 'calendar', 'booking'],
      isFavorite: favorites.includes('schedule-appointment')
    },
    {
      id: 'send-message',
      title: 'Send Message',
      description: 'Communicate with team members',
      icon: IconMessage,
      href: '/communication/messages/new',
      category: 'communication',
      keywords: ['message', 'communication', 'chat', 'team', 'notify'],
      isFavorite: favorites.includes('send-message')
    }
  ];

  // Mock recent items - in real app, this would come from user activity
  const mockRecentItems: RecentItem[] = [
    {
      id: '1',
      title: 'John Smith',
      subtitle: 'MRN: 123456 • Last visit: 2 days ago',
      href: '/patients/123456',
      icon: IconUser,
      timestamp: new Date(Date.now() - 172800000),
      type: 'patient'
    },
    {
      id: '2',
      title: 'Physical Exam - Sarah Johnson',
      subtitle: 'Completed encounter • Room 101',
      href: '/clinical/encounters/789',
      icon: IconStethoscope,
      timestamp: new Date(Date.now() - 86400000),
      type: 'encounter'
    },
    {
      id: '3',
      title: 'Lab Order - CBC',
      subtitle: 'Complete Blood Count • Pending results',
      href: '/orders/456',
      icon: IconTestPipe,
      timestamp: new Date(Date.now() - 43200000),
      type: 'order'
    }
  ];

  useEffect(() => {
    setRecentItems(mockRecentItems);
    
    // Load favorites from localStorage
    const storedFavorites = localStorage.getItem('nav-favorites');
    if (storedFavorites) {
      setFavorites(JSON.parse(storedFavorites));
    }
  }, []);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Global search shortcut
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setSearchOpened(true);
      }
      
      // Help shortcut
      if (event.key === 'F1') {
        event.preventDefault();
        setShortcutsOpened(true);
      }
      
      // Other navigation shortcuts
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        router.push('/dashboard');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const filteredQuickAccess = quickAccessItems.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.keywords.some(keyword => keyword.toLowerCase().includes(query))
    );
  });

  const toggleFavorite = (itemId: string) => {
    const newFavorites = favorites.includes(itemId)
      ? favorites.filter(id => id !== itemId)
      : [...favorites, itemId];
    
    setFavorites(newFavorites);
    localStorage.setItem('nav-favorites', JSON.stringify(newFavorites));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'patients': return 'blue';
      case 'clinical': return 'green';
      case 'orders': return 'orange';
      case 'communication': return 'purple';
      case 'admin': return 'gray';
      default: return 'blue';
    }
  };

  const renderBreadcrumbs = () => {
    if (breadcrumbs.length === 0) return null;

    return (
      <Breadcrumbs separator={<IconChevronRight size={14} />}>
        <Anchor href="/dashboard" className="flex items-center gap-1">
          <IconHome size={14} />
          <span>Dashboard</span>
        </Anchor>
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const content = (
            <span className="flex items-center gap-1">
              {item.icon && <item.icon size={14} />}
              {item.title}
            </span>
          );

          return isLast || !item.href ? (
            <Text key={index} c="dimmed">
              {content}
            </Text>
          ) : (
            <Anchor key={index} href={item.href}>
              {content}
            </Anchor>
          );
        })}
      </Breadcrumbs>
    );
  };

  return (
    <>
      <Paper p="md" shadow="sm" className="border-b border-gray-200">
        <Stack gap="md">
          {/* Breadcrumbs */}
          {renderBreadcrumbs()}
          
          {/* Title and Actions */}
          <Group justify="space-between" align="center">
            <div>
              {title && (
                <Text size="xl" fw={700}>
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text size="sm" c="dimmed">
                  {subtitle}
                </Text>
              )}
            </div>
            
            <Group gap="xs">
              {showSearch && (
                <Tooltip label={`Search (${KEYBOARD_SHORTCUTS.search})`}>
                  <ActionIcon
                    variant="light"
                    onClick={() => setSearchOpened(true)}
                    size="lg"
                  >
                    <IconSearch size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
              
              {showShortcuts && (
                <Tooltip label="Keyboard shortcuts (F1)">
                  <ActionIcon
                    variant="light"
                    onClick={() => setShortcutsOpened(true)}
                    size="lg"
                  >
                    <IconKeyboard size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Group>
        </Stack>
      </Paper>

      {/* Quick Search Modal */}
      <Modal
        opened={searchOpened}
        onClose={() => setSearchOpened(false)}
        title="Quick Search & Navigation"
        size="lg"
        centered
      >
        <Stack gap="md">
          <TextInput
            placeholder="Search for patients, features, or actions..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            autoFocus
            size="md"
          />
          
          {/* Favorites */}
          {favorites.length > 0 && (
            <div>
              <Group gap="xs" mb="xs">
                <IconStar size={16} className="text-yellow-500" />
                <Text fw={500} size="sm">Favorites</Text>
              </Group>
              <Stack gap="xs">
                {quickAccessItems
                  .filter(item => favorites.includes(item.id))
                  .slice(0, 3)
                  .map((item) => (
                    <Card 
                      key={item.id} 
                      p="sm" 
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        router.push(item.href);
                        setSearchOpened(false);
                      }}
                    >
                      <Group justify="space-between">
                        <Group gap="md">
                          <item.icon size={20} className={`text-${getCategoryColor(item.category)}-500`} />
                          <div>
                            <Text fw={500} size="sm">{item.title}</Text>
                            <Text size="xs" c="dimmed">{item.description}</Text>
                          </div>
                        </Group>
                        <Group gap="xs">
                          <Badge size="xs" color={getCategoryColor(item.category)} variant="light">
                            {item.category}
                          </Badge>
                          {item.shortcut && (
                            <Kbd size="xs">{item.shortcut}</Kbd>
                          )}
                        </Group>
                      </Group>
                    </Card>
                  ))
                }
              </Stack>
              <Divider my="md" />
            </div>
          )}
          
          {/* Recent Items */}
          <div>
            <Group gap="xs" mb="xs">
              <IconHistory size={16} className="text-gray-500" />
              <Text fw={500} size="sm">Recent</Text>
            </Group>
            <Stack gap="xs">
              {recentItems.slice(0, 3).map((item) => (
                <Card 
                  key={item.id} 
                  p="sm" 
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    router.push(item.href);
                    setSearchOpened(false);
                  }}
                >
                  <Group justify="space-between">
                    <Group gap="md">
                      <item.icon size={20} className="text-gray-500" />
                      <div>
                        <Text fw={500} size="sm">{item.title}</Text>
                        <Text size="xs" c="dimmed">{item.subtitle}</Text>
                      </div>
                    </Group>
                    <Group gap="xs">
                      <IconClock size={12} className="text-gray-400" />
                      <Text size="xs" c="dimmed">
                        {item.timestamp.toLocaleDateString()}
                      </Text>
                    </Group>
                  </Group>
                </Card>
              ))}
            </Stack>
            <Divider my="md" />
          </div>
          
          {/* Quick Access Items */}
          <div>
            <Group gap="xs" mb="xs">
              <IconCommand size={16} className="text-blue-500" />
              <Text fw={500} size="sm">Quick Actions</Text>
            </Group>
            <ScrollArea h={300}>
              <Stack gap="xs">
                {filteredQuickAccess.map((item) => (
                  <Card 
                    key={item.id} 
                    p="sm" 
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      router.push(item.href);
                      setSearchOpened(false);
                    }}
                  >
                    <Group justify="space-between">
                      <Group gap="md">
                        <item.icon size={20} className={`text-${getCategoryColor(item.category)}-500`} />
                        <div>
                          <Text fw={500} size="sm">{item.title}</Text>
                          <Text size="xs" c="dimmed">{item.description}</Text>
                        </div>
                      </Group>
                      <Group gap="xs">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color={item.isFavorite ? 'yellow' : 'gray'}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(item.id);
                          }}
                        >
                          <IconStar size={12} fill={item.isFavorite ? 'currentColor' : 'none'} />
                        </ActionIcon>
                        <Badge size="xs" color={getCategoryColor(item.category)} variant="light">
                          {item.category}
                        </Badge>
                        {item.shortcut && (
                          <Kbd size="xs">{item.shortcut}</Kbd>
                        )}
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </ScrollArea>
          </div>
        </Stack>
      </Modal>

      {/* Keyboard Shortcuts Modal */}
      <Modal
        opened={shortcutsOpened}
        onClose={() => setShortcutsOpened(false)}
        title="Keyboard Shortcuts"
        size="md"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Use these keyboard shortcuts to navigate quickly through OmniCare EMR.
          </Text>
          
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm">Global search</Text>
              <Kbd>Ctrl + K</Kbd>
            </Group>
            
            <Group justify="space-between">
              <Text size="sm">New patient encounter</Text>
              <Kbd>Ctrl + N</Kbd>
            </Group>
            
            <Group justify="space-between">
              <Text size="sm">Dashboard</Text>
              <Kbd>Ctrl + D</Kbd>
            </Group>
            
            <Group justify="space-between">
              <Text size="sm">Patient list</Text>
              <Kbd>Ctrl + P</Kbd>
            </Group>
            
            <Group justify="space-between">
              <Text size="sm">Orders</Text>
              <Kbd>Ctrl + O</Kbd>
            </Group>
            
            <Group justify="space-between">
              <Text size="sm">Results</Text>
              <Kbd>Ctrl + R</Kbd>
            </Group>
            
            <Group justify="space-between">
              <Text size="sm">Save</Text>
              <Kbd>Ctrl + S</Kbd>
            </Group>
            
            <Group justify="space-between">
              <Text size="sm">Print</Text>
              <Kbd>Ctrl + P</Kbd>
            </Group>
            
            <Group justify="space-between">
              <Text size="sm">Refresh</Text>
              <Kbd>F5</Kbd>
            </Group>
            
            <Group justify="space-between">
              <Text size="sm">Help</Text>
              <Kbd>F1</Kbd>
            </Group>
          </Stack>
          
          <Button 
            variant="light" 
            onClick={() => setShortcutsOpened(false)}
            fullWidth
          >
            Got it!
          </Button>
        </Stack>
      </Modal>
    </>
  );
}

export default EnhancedNavigation;