'use client';

import { Card, Text, Center, Stack, Button, Group } from '@mantine/core';
import { IconShieldX, IconHome, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <Center h="100vh" style={{ backgroundColor: '#f3f4f6' }}>
      <Card shadow="sm" padding="xl" radius="md" withBorder style={{ maxWidth: 500 }}>
        <Stack align="center" gap="md">
          <IconShieldX size={80} className="text-red-500" />
          <Text size="xl" fw={700} ta="center">
            Access Denied
          </Text>
          <Text size="lg" fw={600} ta="center" c="red">
            401 - Unauthorized
          </Text>
          <Text c="dimmed" ta="center" maw={400}>
            You don&apos;t have permission to access this page. This area requires specific role permissions. 
            Please contact your system administrator if you believe you should have access.
          </Text>
          <Group>
            <Button
              leftSection={<IconArrowLeft size={16} />}
              variant="light"
              onClick={() => router.back()}
            >
              Go Back
            </Button>
            <Button
              leftSection={<IconHome size={16} />}
              component={Link}
              href="/dashboard"
            >
              Go to Dashboard
            </Button>
          </Group>
        </Stack>
      </Card>
    </Center>
  );
}