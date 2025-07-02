import React, { useState, useMemo, useId } from 'react';
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
import { SyncConflict, ConflictResolution, ConflictResolutionStrategy } from '@/services/offline-sync-wrapper';
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
  
  // Accessibility IDs
  const titleId = useId();
  const descriptionId = useId();
  const strategyGroupId = useId();

  // Parse dates
  const localDate = new Date(conflict.localResource.meta?.lastUpdated || 0);
  const remoteDate = new Date(conflict.remoteResource.meta?.lastUpdated || 0);

  // Determine which is newer
  const newerResource = localDate > remoteDate ? 'local' : 'remote';

  // Get resource display names
  const getResourceDisplay = (resource: Resource): string => {
    switch (resource.resourceType) {
      case 'Patient':
        const patient = resource as Patient;
        const name = patient.name?.[0];
        return name ? `${name.given?.join(' ')} ${name.family}`.trim() : 'Unknown Patient';
      
      case 'Observation':
        const obs = resource as Observation;
        return obs.code?.coding?.[0]?.display || obs.code?.text || 'Unknown Observation';
      
      case 'MedicationRequest':
        const med = resource as MedicationRequest;
        return med.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown Medication';
      
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
      size="90%"
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      trapFocus
      closeOnEscape
      title={
        <Stack gap={4}>
          <Text size="lg" fw={600} id={titleId}>Resolve Sync Conflict</Text>
          <Group gap="xs">
            <Badge color="violet" aria-label={`Resource type: ${conflictSummary.resourceType}`}>
              {conflictSummary.resourceType}
            </Badge>
            <Text size="sm" c="dimmed">
              {conflictSummary.resourceDisplay}
            </Text>
          </Group>
        </Stack>
      }
    >
      <Stack gap="md">
        {/* Conflict Summary */}
        <Alert 
          icon={<IconAlertTriangle aria-hidden="true" />} 
          color="orange"
          role="alert"
          id={descriptionId}
        >
          <Stack gap="xs">
            <Text size="sm">
              This {conflictSummary.resourceType} has been modified both locally and on the server.
            </Text>
            {conflictSummary.conflicts.length > 0 && (
              <List size="sm" gap="xs" role="list" aria-label="Conflict details">
                {conflictSummary.conflicts.map((conflict: string, index: number) => (
                  <List.Item 
                    key={index} 
                    role="listitem"
                    icon={
                      <ThemeIcon color="orange" size="xs" variant="light">
                        <IconAlertTriangle size={12} aria-hidden="true" />
                      </ThemeIcon>
                    }
                  >
                    {conflict}
                  </List.Item>
                ))}
              </List>
            )}
          </Stack>
        </Alert>

        {/* Version Information */}
        <SimpleGrid cols={2} role="region" aria-labelledby="version-comparison">
          <Text id="version-comparison" className="sr-only">Version comparison information</Text>
          <Card padding="sm" role="article" aria-labelledby="local-version-header">
            <Group gap="xs" mb="xs">
              <ThemeIcon color="blue" variant="light" size="sm">
                <IconDeviceDesktop size={16} aria-hidden="true" />
              </ThemeIcon>
              <Text fw={600} size="sm" id="local-version-header">Local Version</Text>
              {newerResource === 'local' && (
                <Badge color="green" size="xs" aria-label="This version is newer">Newer</Badge>
              )}
            </Group>
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Version: {conflictSummary.localVersion}</Text>
              <Text size="xs" c="dimmed">Modified: {format(conflictSummary.localDate, 'PPpp')}</Text>
            </Stack>
          </Card>

          <Card padding="sm" role="article" aria-labelledby="remote-version-header">
            <Group gap="xs" mb="xs">
              <ThemeIcon color="green" variant="light" size="sm">
                <IconCloud size={16} aria-hidden="true" />
              </ThemeIcon>
              <Text fw={600} size="sm" id="remote-version-header">Remote Version</Text>
              {newerResource === 'remote' && (
                <Badge color="green" size="xs" aria-label="This version is newer">Newer</Badge>
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
        <Tabs defaultValue="diff" role="region" aria-labelledby="comparison-tabs">
          <Text id="comparison-tabs" className="sr-only">Data comparison views</Text>
          <Tabs.List role="tablist" aria-label="Comparison view options">
            <Tabs.Tab value="diff" role="tab" aria-controls="diff-panel">Visual Diff</Tabs.Tab>
            <Tabs.Tab value="side" role="tab" aria-controls="side-panel">Side by Side</Tabs.Tab>
            <Tabs.Tab value="raw" role="tab" aria-controls="raw-panel">Raw JSON</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel 
            value="diff" 
            pt="md"
            role="tabpanel"
            id="diff-panel"
            aria-labelledby="diff-tab"
          >
            <ScrollArea h={400} type="auto" aria-label="Visual difference comparison">
              <div role="img" aria-label="Visual comparison showing differences between local and remote versions">
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
              </div>
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel 
            value="side" 
            pt="md"
            role="tabpanel"
            id="side-panel"
            aria-labelledby="side-tab"
          >
            <ScrollArea h={400} type="auto" aria-label="Side-by-side comparison">
              <div role="img" aria-label="Side-by-side view of local and remote versions">
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
              </div>
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel 
            value="raw" 
            pt="md"
            role="tabpanel"
            id="raw-panel"
            aria-labelledby="raw-tab"
          >
            <SimpleGrid cols={2}>
              <Box role="region" aria-labelledby="local-json-header">
                <Text fw={600} size="sm" mb="xs" id="local-json-header">Local Resource</Text>
                <ScrollArea h={350} aria-label="Local resource JSON data">
                  <Code 
                    block
                    aria-label="Local resource data in JSON format"
                  >
                    {formatJSON(conflict.localResource)}
                  </Code>
                </ScrollArea>
              </Box>
              <Box role="region" aria-labelledby="remote-json-header">
                <Text fw={600} size="sm" mb="xs" id="remote-json-header">Remote Resource</Text>
                <ScrollArea h={350} aria-label="Remote resource JSON data">
                  <Code 
                    block
                    aria-label="Remote resource data in JSON format"
                  >
                    {formatJSON(conflict.remoteResource)}
                  </Code>
                </ScrollArea>
              </Box>
            </SimpleGrid>
          </Tabs.Panel>
        </Tabs>

        <Divider />

        {/* Resolution Options */}
        <Box role="group" aria-labelledby={strategyGroupId}>
          <Text fw={600} mb="md" id={strategyGroupId}>Choose Resolution Strategy</Text>
          <Radio.Group 
            value={selectedStrategy} 
            onChange={(value) => setSelectedStrategy(value as ConflictResolutionStrategy)}
            aria-labelledby={strategyGroupId}
            aria-describedby="strategy-help"
          >
          <div id="strategy-help" className="sr-only">
            Select how you want to resolve this sync conflict
          </div>
            <Stack gap="md" role="radiogroup">
              <Flex align="flex-start">
                <Radio value="local-wins" mr="sm" aria-describedby="local-wins-desc" />
                <Box style={{ flex: 1 }}>
                  <Group gap="xs" mb={4}>
                    <ThemeIcon color="blue" variant="light" size="sm">
                      <IconDeviceDesktop size={16} aria-hidden="true" />
                    </ThemeIcon>
                    <Text fw={500} size="sm">Keep Local Changes</Text>
                  </Group>
                  <Text size="xs" c="dimmed" id="local-wins-desc">
                    Use your local version and discard server changes
                  </Text>
                </Box>
              </Flex>

              <Flex align="flex-start">
                <Radio value="remote-wins" mr="sm" aria-describedby="remote-wins-desc" />
                <Box style={{ flex: 1 }}>
                  <Group gap="xs" mb={4}>
                    <ThemeIcon color="green" variant="light" size="sm">
                      <IconCloud size={16} aria-hidden="true" />
                    </ThemeIcon>
                    <Text fw={500} size="sm">Keep Remote Changes</Text>
                  </Group>
                  <Text size="xs" c="dimmed" id="remote-wins-desc">
                    Use the server version and discard your local changes
                  </Text>
                </Box>
              </Flex>

              <Flex align="flex-start">
                <Radio value="last-write-wins" mr="sm" aria-describedby="last-write-desc" />
                <Box style={{ flex: 1 }}>
                  <Group gap="xs" mb={4}>
                    <ThemeIcon color="orange" variant="light" size="sm">
                      <IconClock size={16} aria-hidden="true" />
                    </ThemeIcon>
                    <Text fw={500} size="sm">Keep Newest Version</Text>
                    {newerResource === 'local' ? (
                      <Badge color="blue" size="xs" aria-label="Local version is newer">Local is newer</Badge>
                    ) : (
                      <Badge color="green" size="xs" aria-label="Remote version is newer">Remote is newer</Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" id="last-write-desc">
                    Automatically use the most recently modified version
                  </Text>
                </Box>
              </Flex>

              <Flex align="flex-start">
                <Radio value="merge" mr="sm" aria-describedby="merge-desc" />
                <Box style={{ flex: 1 }}>
                  <Group gap="xs" mb={4}>
                    <ThemeIcon color="violet" variant="light" size="sm">
                      <IconGitMerge size={16} aria-hidden="true" />
                    </ThemeIcon>
                    <Text fw={500} size="sm">Merge Changes</Text>
                    <Badge color="yellow" size="xs" aria-label="Beta feature">Beta</Badge>
                  </Group>
                  <Text size="xs" c="dimmed" id="merge-desc">
                    Attempt to merge both versions (may require manual review)
                  </Text>
                </Box>
              </Flex>
            </Stack>
          </Radio.Group>
        </Box>

        {/* Warning for data loss */}
        {(selectedStrategy === 'local-wins' || selectedStrategy === 'remote-wins') && (
          <Alert 
            icon={<IconInfoCircle aria-hidden="true" />} 
            color="blue"
            role="alert"
            aria-live="polite"
          >
            <Text size="sm">
              {selectedStrategy === 'local-wins' 
                ? 'Server changes will be permanently discarded.'
                : 'Your local changes will be permanently discarded.'
              }
            </Text>
          </Alert>
        )}

        {/* Actions */}
        <Group justify="flex-end" mt="md" role="group" aria-label="Conflict resolution actions">
          <Button 
            variant="subtle" 
            onClick={onClose} 
            disabled={isResolving}
            aria-label="Cancel conflict resolution"
          >
            Cancel
          </Button>
          <Button
            onClick={handleResolve}
            loading={isResolving}
            leftSection={<IconCircleCheck size={16} aria-hidden="true" />}
            aria-label={`Resolve conflict using ${selectedStrategy} strategy`}
            aria-describedby="resolve-button-help"
          >
            Resolve Conflict
          </Button>
          <div id="resolve-button-help" className="sr-only">
            This will apply the selected resolution strategy and resolve the conflict
          </div>
        </Group>
      </Stack>
    </Modal>
  );
};

export default ConflictResolutionModal;