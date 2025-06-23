'use client';

import { useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Group,
  Button,
  Radio,
  Paper,
  Badge,
  Timeline,
  Alert,
  Divider,
  ScrollArea,
  JsonInput,
  Tabs
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconServer,
  IconDeviceMobile,
  IconClock,
  IconUser,
  IconCheck
} from '@tabler/icons-react';
import { ConflictResolution, DataConflict } from '@/types/sync';
import { formatDistanceToNow } from 'date-fns';

interface SyncConflictDialogProps {
  opened: boolean;
  onClose: () => void;
  conflicts: DataConflict[];
  onResolve: (resolutions: ConflictResolution[]) => void;
  allowBulkResolve?: boolean;
}

export function SyncConflictDialog({
  opened,
  onClose,
  conflicts,
  onResolve,
  allowBulkResolve = true
}: SyncConflictDialogProps) {
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({});
  const [bulkStrategy, setBulkStrategy] = useState<'local' | 'remote' | null>(null);
  const [currentIndex, setCurrentIndex] = useState();

  const currentConflict = conflicts[currentIndex];
  const hasMultipleConflicts = conflicts.length > 1;

  const handleResolve = (conflictId: string, resolution: ConflictResolution) => {
    setResolutions(prev => ({
      ...prev,
      [conflictId]: resolution
    }));

    // Auto-advance to next conflict
    if (currentIndex < conflicts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleBulkResolve = () => {
    if (!bulkStrategy) return;

    const bulkResolutions = conflicts.reduce((acc, conflict) => {
      acc[conflict.id] = {
        conflictId: conflict.id,
        strategy: bulkStrategy,
        resolvedValue: bulkStrategy === 'local' ? conflict.localValue : conflict.remoteValue,
        resolvedBy: 'user',
        resolvedAt: new Date().toISOString()
      };
      return acc;
    }, {} as Record<string, ConflictResolution>);

    setResolutions(bulkResolutions);
  };

  const handleSubmit = () => {
    const resolvedConflicts = Object.values(resolutions);
    onResolve(resolvedConflicts);
    onClose();
  };

  const isAllResolved = Object.keys(resolutions).length === conflicts.length;

  const renderConflictValue = (value: any, label: string, icon: React.ReactNode) => {
    const isObject = typeof value === 'object' && value !== null;
    
    return (
      <Paper p="md" withBorder className="bg-gray-50">
        <Group gap="xs" mb="sm">
          {icon}
          <Text fw={500} size="sm">{label}</Text>
        </Group>
        {isObject ? (
          <JsonInput
            value={JSON.stringify(value, null, 2)}
            readOnly
            minRows={3}
            maxRows={8}
            styles={{
              input: { fontSize: '12px', fontFamily: 'monospace' }
            }}
          />
        ) : (
          <Text size="sm" style={{ fontFamily: 'monospace' }}>
            {String(value)}
          </Text>
        )}
      </Paper>
    );
  };

  if (!currentConflict) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconAlertTriangle size={20} className="text-orange-6" />
          <Text fw={500}>Resolve Sync Conflicts</Text>
          {hasMultipleConflicts && (
            <Badge color="orange" variant="light">
              {currentIndex + 1} of {conflicts.length}
            </Badge>
          )}
        </Group>
      }
      size="lg"
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        {/* Bulk resolve option */}
        {allowBulkResolve && hasMultipleConflicts && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="orange"
            variant="light"
          >
            <Stack gap="sm">
              <Text size="sm">
                You have {conflicts.length} conflicts to resolve. You can resolve them individually or apply the same strategy to all.
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant={bulkStrategy === 'local' ? 'filled' : 'light'}
                  onClick={() => {
                    setBulkStrategy('local');
                    handleBulkResolve();
                  }}
                >
                  Keep All Local Changes
                </Button>
                <Button
                  size="xs"
                  variant={bulkStrategy === 'remote' ? 'filled' : 'light'}
                  onClick={() => {
                    setBulkStrategy('remote');
                    handleBulkResolve();
                  }}
                >
                  Accept All Remote Changes
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}

        {/* Current conflict details */}
        <div>
          <Group justify="space-between" mb="md">
            <div>
              <Text size="sm" fw={500}>
                {currentConflict.entityType}: {currentConflict.entityName}
              </Text>
              <Text size="xs" c="dimmed">
                Field: {currentConflict.field}
              </Text>
            </div>
            <Badge color="orange" variant="light">
              Conflict
            </Badge>
          </Group>

          {/* Conflict timeline */}
          <Timeline bulletSize={20} lineWidth={2} mb="md">
            <Timeline.Item
              bullet={<IconDeviceMobile size={12} />}
              title="Local Change"
            >
              <Text size="xs" c="dimmed">
                Modified {formatDistanceToNow(new Date(currentConflict.localTimestamp))} ago
              </Text>
              <Text size="xs" c="dimmed">
                By: {currentConflict.localUser || 'You'}
              </Text>
            </Timeline.Item>
            <Timeline.Item
              bullet={<IconServer size={12} />}
              title="Remote Change"
              color="orange"
            >
              <Text size="xs" c="dimmed">
                Modified {formatDistanceToNow(new Date(currentConflict.remoteTimestamp))} ago
              </Text>
              <Text size="xs" c="dimmed">
                By: {currentConflict.remoteUser || 'Another user'}
              </Text>
            </Timeline.Item>
          </Timeline>

          {/* Value comparison */}
          <Tabs defaultValue="compare" mb="md">
            <Tabs.List>
              <Tabs.Tab value="compare">Compare</Tabs.Tab>
              <Tabs.Tab value="local">Local Only</Tabs.Tab>
              <Tabs.Tab value="remote">Remote Only</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="compare" pt="md">
              <Stack gap="md">
                {renderConflictValue(
                  currentConflict.localValue,
                  'Your Local Change',
                  <IconDeviceMobile size={16} className="text-blue-6" />
                )}
                {renderConflictValue(
                  currentConflict.remoteValue,
                  'Remote Change',
                  <IconServer size={16} className="text-orange-6" />
                )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="local" pt="md">
              {renderConflictValue(
                currentConflict.localValue,
                'Your Local Change (Full View)',
                <IconDeviceMobile size={16} className="text-blue-6" />
              )}
            </Tabs.Panel>

            <Tabs.Panel value="remote" pt="md">
              {renderConflictValue(
                currentConflict.remoteValue,
                'Remote Change (Full View)',
                <IconServer size={16} className="text-orange-6" />
              )}
            </Tabs.Panel>
          </Tabs>

          {/* Resolution options */}
          <Radio.Group
            label="Choose which version to keep:"
            value={resolutions[currentConflict.id]?.strategy || ''}
            onChange={(value) => handleResolve(currentConflict.id, {
              conflictId: currentConflict.id,
              strategy: value as 'local' | 'remote',
              resolvedValue: value === 'local' ? currentConflict.localValue : currentConflict.remoteValue,
              resolvedBy: 'user',
              resolvedAt: new Date().toISOString()
            })}
          >
            <Stack gap="sm" mt="sm">
              <Radio
                value="local"
                label={
                  <Group gap="xs">
                    <IconDeviceMobile size={16} />
                    <Text size="sm">Keep my local change</Text>
                    {resolutions[currentConflict.id]?.strategy === 'local' && (
                      <IconCheck size={16} className="text-green-6" />
                    )}
                  </Group>
                }
              />
              <Radio
                value="remote"
                label={
                  <Group gap="xs">
                    <IconServer size={16} />
                    <Text size="sm">Accept remote change</Text>
                    {resolutions[currentConflict.id]?.strategy === 'remote' && (
                      <IconCheck size={16} className="text-green-6" />
                    )}
                  </Group>
                }
              />
            </Stack>
          </Radio.Group>
        </div>

        <Divider />

        {/* Actions */}
        <Group justify="space-between">
          <Group gap="xs">
            {hasMultipleConflicts && (
              <>
                <Button
                  variant="subtle"
                  size="sm"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(currentIndex - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="subtle"
                  size="sm"
                  disabled={currentIndex === conflicts.length - 1}
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                >
                  Next
                </Button>
              </>
            )}
          </Group>
          <Group gap="xs">
            <Button variant="light" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!isAllResolved}
              onClick={handleSubmit}
              leftSection={<IconCheck size={16} />}
            >
              Resolve {isAllResolved ? 'All' : `(${Object.keys(resolutions).length}/${conflicts.length})`}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

export default SyncConflictDialog;