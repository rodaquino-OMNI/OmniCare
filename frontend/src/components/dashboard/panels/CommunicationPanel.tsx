'use client';

import { useState, useEffect } from 'react';
import {
  Stack,
  Group,
  Text,
  Card,
  Badge,
  Button,
  ActionIcon,
  Tabs,
  Avatar,
  SimpleGrid,
  Paper,
  Divider,
  Skeleton,
  Alert,
  Indicator,
  ScrollArea,
  TextInput,
  Textarea
} from '@mantine/core';
import {
  IconMessage,
  IconBell,
  IconPhone,
  IconMail,
  IconVideo,
  IconAlertTriangle,
  IconClock,
  IconUser,
  IconUsers,
  IconSend,
  IconPlus,
  IconSearch,
  IconFilter,
  IconArrowRight,
  IconPaperclip,
  IconMicrophone,
  IconCalendarEvent,
  IconStethoscope
} from '@tabler/icons-react';
import { formatDateTime, formatDate } from '@/utils';
import { useAuth } from '@/stores/auth';

interface CommunicationPanelProps {
  patientId?: string;
  onNavigate?: (section: string, data?: any) => void;
  isMaximized?: boolean;
}

interface Message {
  id: string;
  from: {
    id: string;
    name: string;
    role: string;
    avatar?: string;
  };
  to: {
    id: string;
    name: string;
    role: string;
  };
  subject: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  type: 'message' | 'alert' | 'notification';
  patientId?: string;
  attachments?: string[];
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  isAcknowledged: boolean;
  patientId?: string;
  source: 'system' | 'device' | 'manual';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface QuickContact {
  id: string;
  name: string;
  role: string;
  department: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  avatar?: string;
  lastSeen?: Date;
}

export function CommunicationPanel({ 
  patientId, 
  onNavigate, 
  isMaximized = false 
}: CommunicationPanelProps) {
  const [activeTab, setActiveTab] = useState<string | null>('messages');
  const [messageFilter, setMessageFilter] = useState('');
  const { user } = useAuth();
  
  // Mock communication data
  const [messages] = useState<Message[]>([
    {
      id: '1',
      from: {
        id: '2',
        name: 'Dr. Sarah Johnson',
        role: 'Cardiologist',
        avatar: ''
      },
      to: {
        id: user?.id || '1',
        name: user?.firstName + ' ' + user?.lastName || 'Current User',
        role: user?.role || 'physician'
      },
      subject: 'Patient Consultation Request',
      content: 'Please review ECG results for patient Smith. Abnormal findings require immediate attention.',
      timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
      isRead: false,
      priority: 'high',
      type: 'message',
      patientId: patientId
    },
    {
      id: '2',
      from: {
        id: '3',
        name: 'Nurse Martinez',
        role: 'RN',
        avatar: ''
      },
      to: {
        id: user?.id || '1',
        name: user?.firstName + ' ' + user?.lastName || 'Current User',
        role: user?.role || 'physician'
      },
      subject: 'Medication Administration',
      content: 'Morning medications administered. Patient reported mild nausea.',
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      isRead: true,
      priority: 'normal',
      type: 'notification',
      patientId: patientId
    },
    {
      id: '3',
      from: {
        id: '4',
        name: 'Lab Department',
        role: 'System',
        avatar: ''
      },
      to: {
        id: user?.id || '1',
        name: user?.firstName + ' ' + user?.lastName || 'Current User',
        role: user?.role || 'physician'
      },
      subject: 'Lab Results Available',
      content: 'Complete Blood Count results are now available for review.',
      timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      isRead: true,
      priority: 'normal',
      type: 'notification',
      attachments: ['CBC_Results.pdf']
    }
  ]);

  const [alerts] = useState<Alert[]>([
    {
      id: '1',
      type: 'critical',
      title: 'Critical Lab Value',
      message: 'Potassium level critically high (6.2 mEq/L)',
      timestamp: new Date(Date.now() - 900000), // 15 minutes ago
      isAcknowledged: false,
      patientId: patientId,
      source: 'system',
      priority: 'critical'
    },
    {
      id: '2',
      type: 'warning',
      title: 'Medication Interaction',
      message: 'Potential interaction between Warfarin and Amiodarone',
      timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
      isAcknowledged: true,
      patientId: patientId,
      source: 'system',
      priority: 'high'
    },
    {
      id: '3',
      type: 'info',
      title: 'Appointment Reminder',
      message: 'Follow-up appointment scheduled for tomorrow at 2:00 PM',
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      isAcknowledged: true,
      source: 'manual',
      priority: 'low'
    }
  ]);

  const [quickContacts] = useState<QuickContact[]>([
    {
      id: '1',
      name: 'Dr. Emily Chen',
      role: 'Emergency Medicine',
      department: 'Emergency',
      status: 'online',
      avatar: ''
    },
    {
      id: '2',
      name: 'Nurse Rodriguez',
      role: 'ICU Nurse',
      department: 'ICU',
      status: 'busy',
      avatar: ''
    },
    {
      id: '3',
      name: 'Dr. Michael Park',
      role: 'Radiologist',
      department: 'Radiology',
      status: 'away',
      avatar: ''
    },
    {
      id: '4',
      name: 'Pharmacy Team',
      role: 'Pharmacist',
      department: 'Pharmacy',
      status: 'online',
      avatar: ''
    }
  ]);

  const unreadCount = messages.filter(m => !m.isRead).length;
  const criticalAlerts = alerts.filter(a => !a.isAcknowledged && a.type === 'critical').length;
  const filteredMessages = messages.filter(m => 
    m.subject.toLowerCase().includes(messageFilter.toLowerCase()) ||
    m.from.name.toLowerCase().includes(messageFilter.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'normal':
      case 'medium': return 'blue';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'green';
      case 'away': return 'yellow';
      case 'busy': return 'red';
      case 'offline': return 'gray';
      default: return 'gray';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return 'red';
      case 'warning': return 'orange';
      case 'info': return 'blue';
      default: return 'gray';
    }
  };

  return (
    <Stack gap="md" h="100%">
      {/* Communication Stats */}
      <SimpleGrid cols={isMaximized ? 4 : 2} spacing="xs">
        <Paper p="xs" withBorder className="text-center">
          <Group gap="xs" justify="center">
            <Indicator 
              inline 
              disabled={unreadCount === 0}
              color="red"
              size={6}
            >
              <IconMessage size={20} className="text-blue-500" />
            </Indicator>
            <Text size="sm" fw={500}>
              {unreadCount} Unread
            </Text>
          </Group>
        </Paper>
        
        <Paper p="xs" withBorder className="text-center">
          <Group gap="xs" justify="center">
            <Indicator 
              inline 
              disabled={criticalAlerts === 0}
              color="red"
              size={6}
            >
              <IconBell size={20} className="text-orange-500" />
            </Indicator>
            <Text size="sm" fw={500}>
              {criticalAlerts} Critical
            </Text>
          </Group>
        </Paper>
        
        {isMaximized && (
          <>
            <Paper p="xs" withBorder className="text-center">
              <Group gap="xs" justify="center">
                <IconUsers size={20} className="text-green-500" />
                <Text size="sm" fw={500}>
                  {quickContacts.filter(c => c.status === 'online').length} Online
                </Text>
              </Group>
            </Paper>
            
            <Paper p="xs" withBorder className="text-center">
              <Group gap="xs" justify="center">
                <IconCalendarEvent size={20} className="text-purple-500" />
                <Text size="sm" fw={500}>
                  3 Scheduled
                </Text>
              </Group>
            </Paper>
          </>
        )}
      </SimpleGrid>

      {/* Quick Actions */}
      <SimpleGrid cols={isMaximized ? 4 : 2} spacing="xs">
        <Button
          variant="light"
          leftSection={<IconMessage size={16} />}
          onClick={() => onNavigate?.('messages', { action: 'compose' })}
          size="xs"
        >
          New Message
        </Button>
        
        <Button
          variant="light"
          color="orange"
          leftSection={<IconPhone size={16} />}
          onClick={() => onNavigate?.('communication', { action: 'call' })}
          size="xs"
        >
          Quick Call
        </Button>
        
        {isMaximized && (
          <>
            <Button
              variant="light"
              color="green"
              leftSection={<IconVideo size={16} />}
              onClick={() => onNavigate?.('communication', { action: 'video' })}
              size="xs"
            >
              Video Call
            </Button>
            
            <Button
              variant="light"
              color="purple"
              leftSection={<IconStethoscope size={16} />}
              onClick={() => onNavigate?.('communication', { action: 'consult' })}
              size="xs"
            >
              Consultation
            </Button>
          </>
        )}
      </SimpleGrid>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} flex={1}>
        <Tabs.List grow={!isMaximized}>
          <Tabs.Tab 
            value="messages" 
            leftSection={
              <Indicator inline disabled={unreadCount === 0} color="red" size={6}>
                <IconMessage size={14} />
              </Indicator>
            }
          >
            Messages
          </Tabs.Tab>
          <Tabs.Tab 
            value="alerts" 
            leftSection={
              <Indicator inline disabled={criticalAlerts === 0} color="red" size={6}>
                <IconBell size={14} />
              </Indicator>
            }
          >
            Alerts
          </Tabs.Tab>
          {isMaximized && (
            <>
              <Tabs.Tab value="contacts" leftSection={<IconUsers size={14} />}>
                Contacts
              </Tabs.Tab>
              <Tabs.Tab value="schedule" leftSection={<IconCalendarEvent size={14} />}>
                Schedule
              </Tabs.Tab>
            </>
          )}
        </Tabs.List>

        <Tabs.Panel value="messages" pt="md">
          <Stack gap="md">
            {isMaximized && (
              <TextInput
                placeholder="Search messages..."
                leftSection={<IconSearch size={16} />}
                value={messageFilter}
                onChange={(e) => setMessageFilter(e.currentTarget.value)}
                size="sm"
              />
            )}
            
            <ScrollArea h={isMaximized ? 400 : 250}>
              <Stack gap="xs">
                {filteredMessages.map((message) => (
                  <Card 
                    key={message.id} 
                    withBorder 
                    className={message.isRead ? '' : 'bg-blue-50 border-blue-200'}
                  >
                    <Group justify="space-between" align="flex-start">
                      <Group gap="md">
                        <Avatar
                          size="sm"
                          color="blue"
                          radius="md"
                        >
                          {message.from.name.split(' ').map(n => n[0]).join('')}
                        </Avatar>
                        
                        <div className="flex-1">
                          <Group justify="space-between" align="center">
                            <Text fw={message.isRead ? 400 : 600} size="sm">
                              {message.from.name}
                            </Text>
                            <Badge 
                              size="xs" 
                              color={getPriorityColor(message.priority)}
                              variant="light"
                            >
                              {message.priority.toUpperCase()}
                            </Badge>
                          </Group>
                          
                          <Text size="xs" c="dimmed">
                            {message.from.role}
                          </Text>
                          
                          <Text fw={message.isRead ? 400 : 500} size="sm" mt="xs">
                            {message.subject}
                          </Text>
                          
                          <Text size="xs" c="dimmed" lineClamp={2} mt="xs">
                            {message.content}
                          </Text>
                          
                          <Group justify="space-between" align="center" mt="xs">
                            <Text size="xs" c="dimmed">
                              {formatDateTime(message.timestamp)}
                            </Text>
                            
                            <Group gap="xs">
                              {message.attachments && (
                                <IconPaperclip size={12} className="text-gray-400" />
                              )}
                              <ActionIcon 
                                variant="subtle" 
                                size="xs"
                                onClick={() => onNavigate?.('messages', { messageId: message.id })}
                              >
                                <IconArrowRight size={12} />
                              </ActionIcon>
                            </Group>
                          </Group>
                        </div>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="alerts" pt="md">
          <Stack gap="md">
            <ScrollArea h={isMaximized ? 400 : 250}>
              <Stack gap="xs">
                {alerts.map((alert) => (
                  <Alert
                    key={alert.id}
                    icon={<IconAlertTriangle size={16} />}
                    color={getAlertColor(alert.type)}
                    variant={alert.isAcknowledged ? 'light' : 'filled'}
                    withCloseButton={!alert.isAcknowledged}
                  >
                    <Group justify="space-between" align="flex-start">
                      <div className="flex-1">
                        <Text fw={600} size="sm">
                          {alert.title}
                        </Text>
                        <Text size="sm" mt="xs">
                          {alert.message}
                        </Text>
                        <Group gap="xs" mt="xs">
                          <Badge 
                            size="xs" 
                            color={getPriorityColor(alert.priority)}
                            variant="light"
                          >
                            {alert.priority.toUpperCase()}
                          </Badge>
                          <Text size="xs" c="dimmed">
                            {formatDateTime(alert.timestamp)}
                          </Text>
                        </Group>
                      </div>
                      
                      {!alert.isAcknowledged && (
                        <Button size="xs" variant="light">
                          Acknowledge
                        </Button>
                      )}
                    </Group>
                  </Alert>
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
        </Tabs.Panel>

        {isMaximized && (
          <>
            <Tabs.Panel value="contacts" pt="md">
              <Stack gap="md">
                <TextInput
                  placeholder="Search contacts..."
                  leftSection={<IconSearch size={16} />}
                  size="sm"
                />
                
                <ScrollArea h={300}>
                  <Stack gap="xs">
                    {quickContacts.map((contact) => (
                      <Card key={contact.id} withBorder>
                        <Group justify="space-between" align="center">
                          <Group gap="md">
                            <Indicator
                              inline
                              position="bottom-end"
                              color={getStatusColor(contact.status)}
                              size={8}
                            >
                              <Avatar
                                size="md"
                                color="blue"
                                radius="md"
                              >
                                {contact.name.split(' ').map(n => n[0]).join('')}
                              </Avatar>
                            </Indicator>
                            
                            <div>
                              <Text fw={500} size="sm">
                                {contact.name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {contact.role} • {contact.department}
                              </Text>
                              <Badge 
                                size="xs" 
                                color={getStatusColor(contact.status)}
                                variant="light"
                                mt="xs"
                              >
                                {contact.status.toUpperCase()}
                              </Badge>
                            </div>
                          </Group>
                          
                          <Group gap="xs">
                            <ActionIcon variant="light" size="sm" color="blue">
                              <IconMessage size={14} />
                            </ActionIcon>
                            <ActionIcon variant="light" size="sm" color="green">
                              <IconPhone size={14} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                </ScrollArea>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="schedule" pt="md">
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={500} size="sm">Upcoming Communications</Text>
                  <Button 
                    size="xs" 
                    leftSection={<IconPlus size={12} />}
                    onClick={() => onNavigate?.('scheduling', { action: 'create' })}
                  >
                    Schedule
                  </Button>
                </Group>
                
                <Card withBorder>
                  <Group justify="space-between" align="center">
                    <Group gap="md">
                      <IconVideo size={20} className="text-blue-500" />
                      <div>
                        <Text fw={500} size="sm">
                          Team Meeting
                        </Text>
                        <Text size="xs" c="dimmed">
                          Daily rounds discussion
                        </Text>
                      </div>
                    </Group>
                    <Text size="xs" c="dimmed">
                      2:00 PM
                    </Text>
                  </Group>
                </Card>
                
                <Card withBorder>
                  <Group justify="space-between" align="center">
                    <Group gap="md">
                      <IconPhone size={20} className="text-green-500" />
                      <div>
                        <Text fw={500} size="sm">
                          Patient Consultation
                        </Text>
                        <Text size="xs" c="dimmed">
                          Follow-up call with Dr. Smith
                        </Text>
                      </div>
                    </Group>
                    <Text size="xs" c="dimmed">
                      4:30 PM
                    </Text>
                  </Group>
                </Card>
              </Stack>
            </Tabs.Panel>
          </>
        )}
      </Tabs>
    </Stack>
  );
}

export default CommunicationPanel;