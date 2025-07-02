'use client';

import { useState } from 'react';
import {
  Collapse,
  Card,
  Group,
  Text,
  Button,
  Select,
  Switch,
  NumberInput,
  Stack,
  ActionIcon,
  Badge,
  Divider,
  Alert
} from '@mantine/core';
import {
  IconSettings,
  IconChevronDown,
  IconChevronUp,
  IconRestore,
  IconDeviceFloppy,
  IconLayout,
  IconInfoCircle
} from '@tabler/icons-react';

interface PanelState {
  id: string;
  title: string;
  isMaximized: boolean;
  isPinned: boolean;
  isVisible: boolean;
  order: number;
  customHeight?: string;
}

interface PanelLayout {
  panels: PanelState[];
  gridCols: { base: number; sm: number; lg: number };
  panelHeight: string;
}

interface PanelStateManagerProps {
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  presets: Record<string, PanelLayout>;
}

export function PanelStateManager({
  layout,
  onLayoutChange,
  presets
}: PanelStateManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('default');
  
  const handlePanelVisibilityChange = (panelId: string, isVisible: boolean) => {
    const updatedLayout = {
      ...layout,
      panels: layout.panels.map(panel => 
        panel.id === panelId ? { ...panel, isVisible } : panel
      )
    };
    onLayoutChange(updatedLayout);
  };

  const handlePanelOrderChange = (panelId: string, newOrder: number) => {
    const updatedLayout = {
      ...layout,
      panels: layout.panels.map(panel => 
        panel.id === panelId ? { ...panel, order: newOrder } : panel
      )
    };
    onLayoutChange(updatedLayout);
  };

  const handleGridColsChange = (device: 'base' | 'sm' | 'lg', value: number) => {
    const updatedLayout = {
      ...layout,
      gridCols: {
        ...layout.gridCols,
        [device]: value
      }
    };
    onLayoutChange(updatedLayout);
  };

  const handlePresetChange = (presetName: string) => {
    if (presetName && presets[presetName]) {
      onLayoutChange(presets[presetName]);
      setSelectedPreset(presetName);
    }
  };

  const resetLayout = () => {
    handlePresetChange('default');
  };

  const saveLayoutAsPreset = () => {
    // In a real application, this would save to user preferences or backend
    console.log('Saving layout preset:', layout);
    alert('Layout saved to user preferences!');
  };

  return (
    <Card withBorder>
      <Group justify="space-between" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
        <Group gap="sm">
          <IconSettings size={20} className="text-gray-600" />
          <Text fw={500} size="sm">
            Panel Layout Manager
          </Text>
          <Badge size="sm" variant="light">
            Advanced
          </Badge>
        </Group>
        
        <ActionIcon variant="subtle" size="sm">
          {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        </ActionIcon>
      </Group>

      <Collapse in={isExpanded}>
        <Stack gap="md" mt="md">
          <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
            <Text size="sm">
              Customize the dashboard layout to optimize your workflow. Changes are saved automatically.
            </Text>
          </Alert>

          {/* Layout Presets */}
          <div>
            <Text fw={500} size="sm" mb="xs">
              Layout Presets
            </Text>
            <Group gap="md">
              <Select
                placeholder="Choose a preset"
                data={[
                  { value: 'default', label: 'Default (4 panels)' },
                  { value: 'patient-focused', label: 'Patient Focused' },
                  { value: 'clinical-focused', label: 'Clinical Focused' },
                  { value: 'admin-focused', label: 'Administrative Focused' }
                ]}
                value={selectedPreset}
                onChange={(value) => value && handlePresetChange(value)}
                size="sm"
                flex={1}
              />
              
              <Group gap="xs">
                <Button 
                  size="xs" 
                  variant="light" 
                  leftSection={<IconDeviceFloppy size={14} />}
                  onClick={saveLayoutAsPreset}
                >
                  Save
                </Button>
                <Button 
                  size="xs" 
                  variant="light" 
                  color="orange"
                  leftSection={<IconRestore size={14} />}
                  onClick={resetLayout}
                >
                  Reset
                </Button>
              </Group>
            </Group>
          </div>

          <Divider />

          {/* Grid Configuration */}
          <div>
            <Text fw={500} size="sm" mb="xs">
              Grid Layout
            </Text>
            <Group gap="md">
              <NumberInput
                label="Mobile (base)"
                value={layout.gridCols.base}
                onChange={(value) => handleGridColsChange('base', Number(value) || 1)}
                min={1}
                max={4}
                size="sm"
                style={{ width: 100 }}
              />
              <NumberInput
                label="Tablet (sm)"
                value={layout.gridCols.sm}
                onChange={(value) => handleGridColsChange('sm', Number(value) || 2)}
                min={1}
                max={4}
                size="sm"
                style={{ width: 100 }}
              />
              <NumberInput
                label="Desktop (lg)"
                value={layout.gridCols.lg}
                onChange={(value) => handleGridColsChange('lg', Number(value) || 4)}
                min={1}
                max={4}
                size="sm"
                style={{ width: 100 }}
              />
            </Group>
          </div>

          <Divider />

          {/* Panel Configuration */}
          <div>
            <Text fw={500} size="sm" mb="xs">
              Panel Configuration
            </Text>
            <Stack gap="sm">
              {layout.panels.map((panel) => (
                <Card key={panel.id} withBorder>
                  <Group justify="space-between" align="center">
                    <Group gap="md">
                      <Text fw={500} size="sm">
                        {panel.title}
                      </Text>
                      <Group gap="xs">
                        {panel.isPinned && (
                          <Badge size="xs" color="blue" variant="light">
                            Pinned
                          </Badge>
                        )}
                        {panel.isMaximized && (
                          <Badge size="xs" color="green" variant="light">
                            Maximized
                          </Badge>
                        )}
                      </Group>
                    </Group>
                    
                    <Group gap="md">
                      <NumberInput
                        label="Order"
                        value={panel.order}
                        onChange={(value) => handlePanelOrderChange(panel.id, Number(value) || 1)}
                        min={1}
                        max={4}
                        size="xs"
                        style={{ width: 80 }}
                      />
                      
                      <Switch
                        label="Visible"
                        checked={panel.isVisible}
                        onChange={(event) => handlePanelVisibilityChange(panel.id, event.currentTarget.checked)}
                        size="sm"
                      />
                    </Group>
                  </Group>
                </Card>
              ))}
            </Stack>
          </div>

          <Divider />

          {/* Layout Summary */}
          <div>
            <Text fw={500} size="sm" mb="xs">
              Current Layout Summary
            </Text>
            <Group gap="md">
              <Badge leftSection={<IconLayout size={12} />} variant="light">
                {layout.panels.filter(p => p.isVisible).length} Visible Panels
              </Badge>
              <Badge variant="light">
                {layout.gridCols.base}-{layout.gridCols.sm}-{layout.gridCols.lg} Grid
              </Badge>
              <Badge variant="light">
                Height: {layout.panelHeight}
              </Badge>
            </Group>
          </div>
        </Stack>
      </Collapse>
    </Card>
  );
}

export default PanelStateManager;