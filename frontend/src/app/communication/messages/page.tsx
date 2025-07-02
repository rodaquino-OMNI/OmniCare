'use client';

import { Card, Text, Stack, TextInput, Textarea, Button, Group, Badge, Avatar, Tabs, Grid } from '@mantine/core';
import { IconSearch, IconSend, IconPaperclip, IconUser } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function MessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState('1');
  const [messageText, setMessageText] = useState('');

  const conversations = [
    {
      id: '1',
      recipient: 'Dr. Sarah Smith',
      lastMessage: 'Patient is ready for discharge',
      time: '10 min ago',
      unread: 2,
      priority: 'normal',
    },
    {
      id: '2',
      recipient: 'Nurse Johnson',
      lastMessage: 'Please check on Room 203',
      time: '1 hour ago',
      unread: 0,
      priority: 'urgent',
    },
    {
      id: '3',
      recipient: 'Lab Department',
      lastMessage: 'Results are ready for review',
      time: '2 hours ago',
      unread: 1,
      priority: 'normal',
    },
    {
      id: '4',
      recipient: 'Dr. Michael Chen',
      lastMessage: 'Consultation request for patient',
      time: 'Yesterday',
      unread: 0,
      priority: 'normal',
    },
  ];

  const messages = [
    {
      id: '1',
      sender: 'You',
      text: 'The patient in room 101 is ready for discharge. All paperwork has been completed.',
      time: '2:30 PM',
      isOwn: true,
    },
    {
      id: '2',
      sender: 'Dr. Sarah Smith',
      text: 'Great! I\'ll review the discharge summary and sign off.',
      time: '2:32 PM',
      isOwn: false,
    },
    {
      id: '3',
      sender: 'Dr. Sarah Smith',
      text: 'Has the pharmacy been notified about the discharge medications?',
      time: '2:33 PM',
      isOwn: false,
    },
    {
      id: '4',
      sender: 'You',
      text: 'Yes, pharmacy has been notified and medications are ready for pickup.',
      time: '2:35 PM',
      isOwn: true,
    },
  ];

  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse', 'admin']}>
      <AppLayout
        title="Messages"
        subtitle="Internal communication system"
      >
        <Grid gutter="md" style={{ height: 'calc(100vh - 200px)' }}>
          <Grid.Col span={4}>
            {/* Conversations List */}
            <Card shadow="sm" padding="lg" radius="md" withBorder style={{ height: '100%' }}>
              <Stack gap="md">
                <TextInput
                  placeholder="Search conversations..."
                  leftSection={<IconSearch size={16} />}
                />
                
                <Stack gap="xs" style={{ flex: 1, overflow: 'auto' }}>
                  {conversations.map((conv) => (
                    <Card
                      key={conv.id}
                      shadow="xs"
                      padding="sm"
                      radius="sm"
                      withBorder
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedConversation === conv.id ? '#f0f9ff' : undefined,
                        borderColor: selectedConversation === conv.id ? '#3b82f6' : undefined,
                      }}
                      onClick={() => setSelectedConversation(conv.id)}
                    >
                      <Group justify="space-between" mb="xs">
                        <Group gap="xs">
                          <Avatar color="blue" radius="xl" size="sm">
                            <IconUser size={16} />
                          </Avatar>
                          <Text size="sm" fw={500}>{conv.recipient}</Text>
                        </Group>
                        {conv.unread > 0 && (
                          <Badge size="sm" circle>
                            {conv.unread}
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed" truncate>
                        {conv.lastMessage}
                      </Text>
                      <Group justify="space-between" mt="xs">
                        <Text size="xs" c="dimmed">{conv.time}</Text>
                        {conv.priority === 'urgent' && (
                          <Badge size="xs" color="red" variant="light">Urgent</Badge>
                        )}
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={8}>
            {/* Message Thread */}
            <Card shadow="sm" padding="lg" radius="md" withBorder style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <Group justify="space-between" pb="md" style={{ borderBottom: '1px solid #e0e0e0' }}>
                <Group>
                  <Avatar color="blue" radius="xl">
                    <IconUser size={24} />
                  </Avatar>
                  <div>
                    <Text fw={500}>
                      {conversations.find(c => c.id === selectedConversation)?.recipient}
                    </Text>
                    <Text size="xs" c="dimmed">Online</Text>
                  </div>
                </Group>
                <Button size="xs" variant="light">
                  View Profile
                </Button>
              </Group>

              {/* Messages */}
              <Stack gap="md" style={{ flex: 1, overflow: 'auto', padding: '1rem 0' }}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      alignSelf: message.isOwn ? 'flex-end' : 'flex-start',
                      maxWidth: '70%',
                    }}
                  >
                    <Card
                      shadow="xs"
                      padding="sm"
                      radius="md"
                      style={{
                        backgroundColor: message.isOwn ? '#3b82f6' : '#f3f4f6',
                        color: message.isOwn ? 'white' : undefined,
                      }}
                    >
                      <Text size="sm">{message.text}</Text>
                      <Text size="xs" style={{ opacity: 0.7, marginTop: '4px' }}>
                        {message.time}
                      </Text>
                    </Card>
                  </div>
                ))}
              </Stack>

              {/* Message Input */}
              <Stack gap="sm" pt="md" style={{ borderTop: '1px solid #e0e0e0' }}>
                <Textarea
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={3}
                />
                <Group justify="space-between">
                  <Button variant="subtle" leftSection={<IconPaperclip size={16} />}>
                    Attach File
                  </Button>
                  <Button leftSection={<IconSend size={16} />}>
                    Send Message
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </AppLayout>
    </ProtectedRoute>
  );
}