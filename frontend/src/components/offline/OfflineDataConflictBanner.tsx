'use client';

import { useState } from 'react';
import { Alert, Group, Text, Button, Badge, Collapse, Stack, Paper, ActionIcon } from '@mantine/core';
import { 
  IconAlertTriangle, 
  IconChevronDown, 
  IconChevronUp,
  IconRefresh,
  IconCheck
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { DataConflict } from '@/types/sync';
import { formatDistanceToNow } from 'date-fns';

interface OfflineDataConflictBannerProps {
  conflicts: DataConflict[];
  onResolve: () => void;
  onDismiss?: () => void;
}

export function OfflineDataConflictBanner({
  conflicts,
  onResolve,
  onDismiss
}: OfflineDataConflictBannerProps) {
  const [opened, { toggle }] = useDisclosure(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || conflicts.length === 0) {
    return null;
  }

  const conflictsByType = conflicts.reduce((acc, conflict) => {
    if (!acc[conflict.entityType]) {
      acc[conflict.entityType] = [];
    }
    acc[conflict.entityType].push(conflict);
    return acc;
  }, {} as Record<string, DataConflict[]>);

  return (
    <Alert
      icon={<IconAlertTriangle size={20} />}
      color="orange"
      variant="light"
      withCloseButton={!!onDismiss}
      onClose={() => {
        setDismissed(true);
        onDismiss?.();
      }}
      className="mb-4"
    >
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={600} size="sm">
              Data Sync Conflicts Detected
            </Text>
            <Text size="xs" c="dimmed">
              {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} need{conflicts.length > 1 ? '' : 's'} your attention
            </Text>
          </div>
          <Group gap="xs">
            <Button
              size="xs"
              variant="filled"
              color="orange"
              leftSection={<IconRefresh size={14} />}
              onClick={onResolve}
            >
              Resolve Now
            </Button>
            <ActionIcon
              variant="subtle"
              color="orange"
              onClick={toggle}
              title={opened ? 'Hide details' : 'Show details'}
            >
              {opened ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </ActionIcon>
          </Group>
        </Group>

        <Collapse in={opened}>
          <Stack gap="xs" pt="sm">
            {Object.entries(conflictsByType).map(([type, typeConflicts]) => (
              <Paper key={type} p="sm" withBorder className="bg-orange-50 border-orange-200">
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={500}>
                    {type}
                  </Text>
                  <Badge color="orange" size="sm" variant="light">
                    {typeConflicts.length} conflict{typeConflicts.length > 1 ? 's' : ''}
                  </Badge>
                </Group>
                <Stack gap="xs">
                  {typeConflicts.slice(0, 3).map((conflict) => (
                    <Group key={conflict.id} gap="xs" wrap="nowrap">
                      <IconAlertTriangle size={14} className="text-orange-600" />
                      <div style={{ flex: 1 }}>
                        <Text size="xs" truncate>
                          {conflict.entityName} - {conflict.field}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Local: {formatDistanceToNow(new Date(conflict.localTimestamp))} ago
                          {' vs '}
                          Remote: {formatDistanceToNow(new Date(conflict.remoteTimestamp))} ago
                        </Text>
                      </div>
                    </Group>
                  ))}
                  {typeConflicts.length > 3 && (
                    <Text size="xs" c="dimmed" ta="center">
                      ... and {typeConflicts.length - 3} more
                    </Text>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Collapse>
      </Stack>
    </Alert>
  );
}

export default OfflineDataConflictBanner;