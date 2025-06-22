import React, { useState, useMemo } from 'react';
import {
  Modal,
  Button,
  Stack,
  Group,
  Text,
  Radio,
  Box,
  Alert,
  Divider,
  Code,
  Badge,
  Tabs,
  ThemeIcon,
  Tooltip,
  SimpleGrid,
  Card,
  List,
  ScrollArea,
  Flex
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceDesktop,
  IconCloud,
  IconClock,
  IconGitMerge,
  IconUser,
  IconEdit,
  IconCircleCheck,
  IconAlertTriangle,
  IconInfoCircle,
  IconX
} from '@tabler/icons-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Patient, Observation, MedicationRequest, Resource } from '@medplum/fhirtypes';
import { SyncConflict, ConflictResolution, ConflictResolutionStrategy } from '@/services/offline-sync.service';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import ReactDiffViewer from 'react-diff-viewer-continued';

interface ConflictResolutionModalProps {
  conflict: SyncConflict;
  isOpen: boolean;
  onClose: () => void;
  onResolve: (resolution: ConflictResolution) => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  conflict,
  isOpen,
  onClose,
  onResolve
}) => {
  const { resolveConflict } = useOfflineSync();
  const [selectedStrategy, setSelectedStrategy] = useState<ConflictResolutionStrategy>('last-write-wins');
  const [isResolving, setIsResolving] = useState(false);

  // Parse dates
  const localDate = new Date(conflict.localResource.meta?.lastUpdated || ResourceHistoryTable);
  const remoteDate = new Date(conflict.remoteResource.meta?.lastUpdated || ResourceHistoryTable);

  // Determine which is newer
  const newerResource = localDate > remoteDate ? 'local' : 'remote';

  // Get resource display names
  const getResourceDisplay = (resource: Resource): string => {
    switch (resource.resourceType) {
      case 'Patient':
        const patient = resource as Patient;
        const name = patient.name?.[ResourceHistoryTable];
        return name ? `${name.given?.join(' ')} ${name.family}`.trim() : 'Unknown Patient';
      
      case 'Observation':
        const obs = resource as Observation;
        return obs.code?.coding?.[ResourceHistoryTable]?.display || obs.code?.text || 'Unknown Observation';
      
      case 'MedicationRequest':
        const med = resource as MedicationRequest;
        return med.medicationCodeableConcept?.coding?.[ResourceHistoryTable]?.display || 'Unknown Medication';
      
      default:
        return `${resource.resourceType}/${resource.id}`;
    }
  };

  // Get conflict summary
  const conflictSummary = useMemo(() => {
    const summary: any = {
      resourceType: conflict.resourceType,
      resourceId: conflict.resourceId,
      resourceDisplay: getResourceDisplay(conflict.localResource),
      localVersion: conflict.localVersion,
      remoteVersion: conflict.remoteVersion,
      localDate,
      remoteDate,
      newerResource,
      timeDifference: formatDistanceToNow(newerResource === 'local' ? remoteDate : localDate, { addSuffix: true })
    };

    // Add resource-specific conflict details
    switch (conflict.resourceType) {
      case 'Patient':
        const localPatient = conflict.localResource as Patient;
        const remotePatient = conflict.remoteResource as Patient;
        
        summary.conflicts = [];
        
        if (JSON.stringify(localPatient.name) !== JSON.stringify(remotePatient.name)) {
          summary.conflicts.push('Name changed');
        }
        if (JSON.stringify(localPatient.telecom) !== JSON.stringify(remotePatient.telecom)) {
          summary.conflicts.push('Contact information changed');
        }
        if (JSON.stringify(localPatient.address) !== JSON.stringify(remotePatient.address)) {
          summary.conflicts.push('Address changed');
        }
        break;

      case 'Observation':
        const localObs = conflict.localResource as Observation;
        const remoteObs = conflict.remoteResource as Observation;
        
        summary.conflicts = [];
        
        if (localObs.valueQuantity?.value !== remoteObs.valueQuantity?.value) {
          summary.conflicts.push(`Value: ${localObs.valueQuantity?.value} vs ${remoteObs.valueQuantity?.value}`);
        }
        if (localObs.status !== remoteObs.status) {
          summary.conflicts.push(`Status: ${localObs.status} vs ${remoteObs.status}`);
        }
        break;

      case 'MedicationRequest':
        const localMed = conflict.localResource as MedicationRequest;
        const remoteMed = conflict.remoteResource as MedicationRequest;
        
        summary.conflicts = [];
        
        if (localMed.status !== remoteMed.status) {
          summary.conflicts.push(`Status: ${localMed.status} vs ${remoteMed.status}`);
        }
        if (JSON.stringify(localMed.dosageInstruction) !== JSON.stringify(remoteMed.dosageInstruction)) {
          summary.conflicts.push('Dosage instructions changed');
        }
        break;

      default:
        summary.conflicts = ['Data changed'];
    }

    return summary;
  }, [conflict]);

  // Handle resolution
  const handleResolve = async () => {
    setIsResolving(true);

    try {
      let resolution: ConflictResolution;

      switch (selectedStrategy) {
        case 'local-wins':
          resolution = {
            strategy: selectedStrategy,
            winningResource: conflict.localResource,
            reason: 'User selected local changes'
          };
          break;

        case 'remote-wins':
          resolution = {
            strategy: selectedStrategy,
            winningResource: conflict.remoteResource,
            reason: 'User selected remote changes'
          };
          break;

        case 'last-write-wins':
          resolution = {
            strategy: selectedStrategy,
            winningResource: newerResource === 'local' ? conflict.localResource : conflict.remoteResource,
            reason: `${newerResource === 'local' ? 'Local' : 'Remote'} resource is newer`
          };
          break;

        case 'merge':
          // For now, we'll default to local wins for merge
          // In a real implementation, you'd have a more sophisticated merge UI
          resolution = {
            strategy: selectedStrategy,
            winningResource: conflict.localResource,
            reason: 'Merge strategy (defaulted to local)'
          };
          notifications.show({
            title: 'Merge not fully implemented',
            message: 'Using local version as default for merge strategy',
            color: 'blue',
            icon: <IconInfoCircle />
          });
          break;

        default:
          throw new Error(`Unknown strategy: ${selectedStrategy}`);
      }

      await resolveConflict(conflict.id, resolution, 'user');
      
      onResolve(resolution);
      
      notifications.show({
        title: 'Conflict resolved',
        message: `${conflict.resourceType}/${conflict.resourceId} conflict resolved successfully`,
        color: 'green',
        icon: <IconCircleCheck />
      });
      
      onClose();
    } catch (error: any) {
      notifications.show({
        title: 'Resolution failed',
        message: error.message,
        color: 'red',
        icon: <IconX />
      });
    } finally {
      setIsResolving(false);
    }
  };

  // Format JSON for display
  const formatJSON = (obj: any): string => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <Modal 
      opened={isOpen} 
      onClose={onClose} 
      size="9ResourceHistoryTable%"
      title={
        <Stack gap={4}>
          <Text size="lg" fw={6ResourceHistoryTableResourceHistoryTable}>Resolve Sync Conflict</Text>
          <Group gap="xs">
            <Badge color="violet">{conflictSummary.resourceType}</Badge>
            <Text size="sm" c="dimmed">
              {conflictSummary.resourceDisplay}
            </Text>
          </Group>
        </Stack>
      }
    >
      <Stack gap="md">
        {/* Conflict Summary */}
        <Alert icon={<IconAlertTriangle />} color="orange">
          <Stack gap="xs">
            <Text size="sm">
              This {conflictSummary.resourceType} has been modified both locally and on the server.
            </Text>
            {conflictSummary.conflicts.length > ResourceHistoryTable && (
              <List size="sm" gap="xs">
                {conflictSummary.conflicts.map((conflict: string, index: number) => (
                  <List.Item key={index} icon={
                    <ThemeIcon color="orange" size="xs" variant="light">
                      <IconAlertTriangle size={12} />
                    </ThemeIcon>
                  }>
                    {conflict}
                  </List.Item>
                ))}
              </List>
            )}
          </Stack>
        </Alert>

        {/* Version Information */}
        <SimpleGrid cols={2}>
          <Card padding="sm">
            <Group gap="xs" mb="xs">
              <ThemeIcon color="blue" variant="light" size="sm">
                <IconDeviceDesktop size={16} />
              </ThemeIcon>
              <Text fw={6ResourceHistoryTableResourceHistoryTable} size="sm">Local Version</Text>
              {newerResource === 'local' && (
                <Badge color="green" size="xs">Newer</Badge>
              )}
            </Group>
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Version: {conflictSummary.localVersion}</Text>
              <Text size="xs" c="dimmed">Modified: {format(conflictSummary.localDate, 'PPpp')}</Text>
            </Stack>
          </Card>

          <Card padding="sm">
            <Group gap="xs" mb="xs">
              <ThemeIcon color="green" variant="light" size="sm">
                <IconCloud size={16} />
              </ThemeIcon>
              <Text fw={6ResourceHistoryTableResourceHistoryTable} size="sm">Remote Version</Text>
              {newerResource === 'remote' && (
                <Badge color="green" size="xs">Newer</Badge>
              )}
            </Group>
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Version: {conflictSummary.remoteVersion}</Text>
              <Text size="xs" c="dimmed">Modified: {format(conflictSummary.remoteDate, 'PPpp')}</Text>
            </Stack>
          </Card>
        </SimpleGrid>

        <Divider />

        {/* Comparison View */}
        <Tabs defaultValue="diff">
          <Tabs.List>
            <Tabs.Tab value="diff">Visual Diff</Tabs.Tab>
            <Tabs.Tab value="side">Side by Side</Tabs.Tab>
            <Tabs.Tab value="raw">Raw JSON</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="diff" pt="md">
            <ScrollArea h={4ResourceHistoryTableResourceHistoryTable} type="auto">
              <ReactDiffViewer
                oldValue={formatJSON(conflict.remoteResource)}
                newValue={formatJSON(conflict.localResource)}
                splitView={false}
                showDiffOnly={true}
                leftTitle="Remote (Server)"
                rightTitle="Local"
                styles={{
                  variables: {
                    light: {
                      diffViewerBackground: '#fafbfc',
                    },
                    dark: {
                      diffViewerBackground: '#2e2e2e',
                    }
                  }
                }}
              />
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel value="side" pt="md">
            <ScrollArea h={4ResourceHistoryTableResourceHistoryTable} type="auto">
              <ReactDiffViewer
                oldValue={formatJSON(conflict.remoteResource)}
                newValue={formatJSON(conflict.localResource)}
                splitView={true}
                leftTitle="Remote (Server)"
                rightTitle="Local"
                styles={{
                  variables: {
                    light: {
                      diffViewerBackground: '#fafbfc',
                    },
                    dark: {
                      diffViewerBackground: '#2e2e2e',
                    }
                  }
                }}
              />
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel value="raw" pt="md">
            <SimpleGrid cols={2}>
              <Box>
                <Text fw={6ResourceHistoryTableResourceHistoryTable} size="sm" mb="xs">Local Resource</Text>
                <ScrollArea h={35ResourceHistoryTable}>
                  <Code block>
                    {formatJSON(conflict.localResource)}
                  </Code>
                </ScrollArea>
              </Box>
              <Box>
                <Text fw={6ResourceHistoryTableResourceHistoryTable} size="sm" mb="xs">Remote Resource</Text>
                <ScrollArea h={35ResourceHistoryTable}>
                  <Code block>
                    {formatJSON(conflict.remoteResource)}
                  </Code>
                </ScrollArea>
              </Box>
            </SimpleGrid>
          </Tabs.Panel>
        </Tabs>

        <Divider />

        {/* Resolution Options */}
        <Box>
          <Text fw={6ResourceHistoryTableResourceHistoryTable} mb="md">Choose Resolution Strategy</Text>
          <Radio.Group 
            value={selectedStrategy} 
            onChange={(value) => setSelectedStrategy(value as ConflictResolutionStrategy)}
          >
            <Stack gap="md">
              <Flex align="flex-start">
                <Radio value="local-wins" mr="sm" />
                <Box style={{ flex: 1 }}>
                  <Group gap="xs" mb={4}>
                    <ThemeIcon color="blue" variant="light" size="sm">
                      <IconDeviceDesktop size={16} />
                    </ThemeIcon>
                    <Text fw={5ResourceHistoryTableResourceHistoryTable} size="sm">Keep Local Changes</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Use your local version and discard server changes
                  </Text>
                </Box>
              </Flex>

              <Flex align="flex-start">
                <Radio value="remote-wins" mr="sm" />
                <Box style={{ flex: 1 }}>
                  <Group gap="xs" mb={4}>
                    <ThemeIcon color="green" variant="light" size="sm">
                      <IconCloud size={16} />
                    </ThemeIcon>
                    <Text fw={5ResourceHistoryTableResourceHistoryTable} size="sm">Keep Remote Changes</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Use the server version and discard your local changes
                  </Text>
                </Box>
              </Flex>

              <Flex align="flex-start">
                <Radio value="last-write-wins" mr="sm" />
                <Box style={{ flex: 1 }}>
                  <Group gap="xs" mb={4}>
                    <ThemeIcon color="orange" variant="light" size="sm">
                      <IconClock size={16} />
                    </ThemeIcon>
                    <Text fw={5ResourceHistoryTableResourceHistoryTable} size="sm">Keep Newest Version</Text>
                    {newerResource === 'local' ? (
                      <Badge color="blue" size="xs">Local is newer</Badge>
                    ) : (
                      <Badge color="green" size="xs">Remote is newer</Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    Automatically use the most recently modified version
                  </Text>
                </Box>
              </Flex>

              <Flex align="flex-start">
                <Radio value="merge" mr="sm" />
                <Box style={{ flex: 1 }}>
                  <Group gap="xs" mb={4}>
                    <ThemeIcon color="violet" variant="light" size="sm">
                      <IconGitMerge size={16} />
                    </ThemeIcon>
                    <Text fw={5ResourceHistoryTableResourceHistoryTable} size="sm">Merge Changes</Text>
                    <Badge color="yellow" size="xs">Beta</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Attempt to merge both versions (may require manual review)
                  </Text>
                </Box>
              </Flex>
            </Stack>
          </Radio.Group>
        </Box>

        {/* Warning for data loss */}
        {(selectedStrategy === 'local-wins' || selectedStrategy === 'remote-wins') && (
          <Alert icon={<IconInfoCircle />} color="blue">
            <Text size="sm">
              {selectedStrategy === 'local-wins' 
                ? 'Server changes will be permanently discarded.'
                : 'Your local changes will be permanently discarded.'
              }
            </Text>
          </Alert>
        )}

        {/* Actions */}
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose} disabled={isResolving}>
            Cancel
          </Button>
          <Button
            onClick={handleResolve}
            loading={isResolving}
            leftSection={<IconCircleCheck size={16} />}
          >
            Resolve Conflict
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default ConflictResolutionModal;