'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Stack,
  Group,
  Text,
  ActionIcon,
  Badge,
  Tabs,
  ScrollArea,
  Skeleton
} from '@mantine/core';
import {
  IconUser,
  IconStethoscope,
  IconMessage,
  IconSettings,
  IconMaximize,
  IconMinimize,
  IconRefresh,
  IconPin,
  IconPinOff
} from '@tabler/icons-react';
import { useAuth } from '@/stores/auth';
import { PatientCarePanel } from './panels/PatientCarePanel';
import { ClinicalDecisionPanel } from './panels/ClinicalDecisionPanel';
import { CommunicationPanel } from './panels/CommunicationPanel';
import { AdministrativePanel } from './panels/AdministrativePanel';
import { PanelStateManager } from './PanelStateManager';

interface FourPanelDashboardProps {
  patientId?: string;
  initialLayout?: 'default' | 'patient-focused' | 'clinical-focused' | 'admin-focused';
  onNavigate?: (section: string, data?: any) => void;
}

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

const DEFAULT_LAYOUT: PanelLayout = {
  panels: [
    { id: 'patient-care', title: 'Patient Care', isMaximized: false, isPinned: false, isVisible: true, order: 1 },
    { id: 'clinical-decision', title: 'Clinical Decision', isMaximized: false, isPinned: false, isVisible: true, order: 2 },
    { id: 'communication', title: 'Communication', isMaximized: false, isPinned: false, isVisible: true, order: 3 },
    { id: 'administrative', title: 'Administrative', isMaximized: false, isPinned: false, isVisible: true, order: 4 }
  ],
  gridCols: { base: 1, sm: 2, lg: 4 },
  panelHeight: '400px'
};

const LAYOUT_PRESETS = {
  'patient-focused': {
    ...DEFAULT_LAYOUT,
    gridCols: { base: 1, sm: 1, lg: 2 },
    panelHeight: '600px',
    panels: DEFAULT_LAYOUT.panels.map(p => 
      p.id === 'patient-care' ? { ...p, customHeight: '700px' } : p
    )
  },
  'clinical-focused': {
    ...DEFAULT_LAYOUT,
    gridCols: { base: 1, sm: 2, lg: 3 },
    panels: DEFAULT_LAYOUT.panels.map(p => 
      ['patient-care', 'clinical-decision'].includes(p.id) ? { ...p, customHeight: '500px' } : p
    )
  },
  'admin-focused': {
    ...DEFAULT_LAYOUT,
    gridCols: { base: 1, sm: 2, lg: 2 },
    panelHeight: '500px',
    panels: DEFAULT_LAYOUT.panels.map(p => 
      ['communication', 'administrative'].includes(p.id) ? { ...p, customHeight: '600px' } : p
    )
  }
};

export function FourPanelDashboard({
  patientId,
  initialLayout = 'default',
  onNavigate
}: FourPanelDashboardProps) {
  const { user, hasAnyRole } = useAuth();
  const [layout, setLayout] = useState<PanelLayout>(
    initialLayout === 'default' ? DEFAULT_LAYOUT : LAYOUT_PRESETS[initialLayout]
  );
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Panel state management
  const toggleMaximize = (panelId: string) => {
    setLayout(prev => ({
      ...prev,
      panels: prev.panels.map(panel => 
        panel.id === panelId 
          ? { ...panel, isMaximized: !panel.isMaximized }
          : { ...panel, isMaximized: false } // Only one panel can be maximized at a time
      )
    }));
  };

  const togglePin = (panelId: string) => {
    setLayout(prev => ({
      ...prev,
      panels: prev.panels.map(panel => 
        panel.id === panelId 
          ? { ...panel, isPinned: !panel.isPinned }
          : panel
      )
    }));
  };

  const refreshPanel = async (panelId: string) => {
    setRefreshing(prev => ({ ...prev, [panelId]: true }));
    
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setRefreshing(prev => ({ ...prev, [panelId]: false }));
    setLastUpdated(new Date());
  };

  const refreshAllPanels = async () => {
    const panelIds = layout.panels.map(p => p.id);
    setRefreshing(panelIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setRefreshing({});
    setLastUpdated(new Date());
  };

  // Role-based panel visibility
  const getVisiblePanels = () => {
    return layout.panels.filter(panel => {
      switch (panel.id) {
        case 'patient-care':
          return hasAnyRole(['physician', 'nurse']);
        case 'clinical-decision':
          return hasAnyRole(['physician']);
        case 'communication':
          return hasAnyRole(['physician', 'nurse', 'admin']);
        case 'administrative':
          return hasAnyRole(['admin', 'billing', 'receptionist']);
        default:
          return true;
      }
    }).filter(panel => panel.isVisible);
  };

  const visiblePanels = getVisiblePanels();
  const maximizedPanel = visiblePanels.find(p => p.isMaximized);

  return (
    <Container size="xl" p="md">
      <Stack gap="md">
        {/* Dashboard Header */}
        <Group justify="space-between" align="center">
          <div>
            <Text size="xl" fw={700}>
              Clinical Dashboard
            </Text>
            <Text size="sm" c="dimmed">
              {patientId ? `Patient View • ` : ''}Last updated: {lastUpdated.toLocaleTimeString()}
            </Text>
          </div>
          
          <Group gap="xs">
            <Badge 
              leftSection={<IconUser size={12} />}
              variant="light" 
              color="blue"
            >
              {user?.role.replace('_', ' ').toUpperCase()}
            </Badge>
            <ActionIcon
              variant="light"
              onClick={refreshAllPanels}
              loading={Object.values(refreshing).some(Boolean)}
              title="Refresh all panels"
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Four Panel Grid */}
        {maximizedPanel ? (
          // Maximized single panel view
          <Paper shadow="sm" radius="md" withBorder h="80vh">
            <PanelContainer
              panel={maximizedPanel}
              patientId={patientId}
              onMaximize={() => toggleMaximize(maximizedPanel.id)}
              onPin={() => togglePin(maximizedPanel.id)}
              onRefresh={() => refreshPanel(maximizedPanel.id)}
              onNavigate={onNavigate}
              isRefreshing={refreshing[maximizedPanel.id]}
              isMaximized={true}
            />
          </Paper>
        ) : (
          // Four panel grid view
          <Grid>
            {visiblePanels
              .sort((a, b) => a.order - b.order)
              .map((panel) => (
                <Grid.Col 
                  key={panel.id}
                  span={{
                    base: 12,
                    sm: layout.gridCols.sm === 1 ? 12 : 6,
                    lg: 12 / layout.gridCols.lg
                  }}
                >
                  <Paper 
                    shadow="sm" 
                    radius="md" 
                    withBorder 
                    h={panel.customHeight || layout.panelHeight}
                  >
                    <PanelContainer
                      panel={panel}
                      patientId={patientId}
                      onMaximize={() => toggleMaximize(panel.id)}
                      onPin={() => togglePin(panel.id)}
                      onRefresh={() => refreshPanel(panel.id)}
                      onNavigate={onNavigate}
                      isRefreshing={refreshing[panel.id]}
                    />
                  </Paper>
                </Grid.Col>
              ))
            }
          </Grid>
        )}

        {/* Panel State Manager for advanced users */}
        {hasAnyRole(['admin', 'system_admin']) && (
          <PanelStateManager 
            layout={layout}
            onLayoutChange={setLayout}
            presets={LAYOUT_PRESETS}
          />
        )}
      </Stack>
    </Container>
  );
}

interface PanelContainerProps {
  panel: PanelState;
  patientId?: string;
  onMaximize: () => void;
  onPin: () => void;
  onRefresh: () => void;
  onNavigate?: (section: string, data?: any) => void;
  isRefreshing?: boolean;
  isMaximized?: boolean;
}

function PanelContainer({
  panel,
  patientId,
  onMaximize,
  onPin,
  onRefresh,
  onNavigate,
  isRefreshing = false,
  isMaximized = false
}: PanelContainerProps) {
  const renderPanelContent = () => {
    switch (panel.id) {
      case 'patient-care':
        return (
          <PatientCarePanel 
            patientId={patientId}
            onNavigate={onNavigate}
            isMaximized={isMaximized}
          />
        );
      case 'clinical-decision':
        return (
          <ClinicalDecisionPanel 
            patientId={patientId}
            onNavigate={onNavigate}
            isMaximized={isMaximized}
          />
        );
      case 'communication':
        return (
          <CommunicationPanel 
            patientId={patientId}
            onNavigate={onNavigate}
            isMaximized={isMaximized}
          />
        );
      case 'administrative':
        return (
          <AdministrativePanel 
            patientId={patientId}
            onNavigate={onNavigate}
            isMaximized={isMaximized}
          />
        );
      default:
        return <Text c="dimmed">Panel not found</Text>;
    }
  };

  return (
    <Stack h="100%" gap={0}>
      {/* Panel Header */}
      <Group 
        justify="space-between" 
        align="center" 
        p="md" 
        style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
      >
        <Group gap="sm">
          <Text fw={600} size="sm">
            {panel.title}
          </Text>
          {panel.isPinned && (
            <Badge size="xs" color="blue" variant="light">
              Pinned
            </Badge>
          )}
        </Group>
        
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={onPin}
            color={panel.isPinned ? 'blue' : 'gray'}
            title={panel.isPinned ? 'Unpin panel' : 'Pin panel'}
          >
            {panel.isPinned ? <IconPinOff size={14} /> : <IconPin size={14} />}
          </ActionIcon>
          
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={onRefresh}
            loading={isRefreshing}
            title="Refresh panel"
          >
            <IconRefresh size={14} />
          </ActionIcon>
          
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={onMaximize}
            title={isMaximized ? 'Restore panel' : 'Maximize panel'}
          >
            {isMaximized ? <IconMinimize size={14} /> : <IconMaximize size={14} />}
          </ActionIcon>
        </Group>
      </Group>

      {/* Panel Content */}
      <ScrollArea 
        flex={1} 
        p="md" 
        type="hover"
        scrollbarSize={6}
      >
        {isRefreshing ? (
          <Stack gap="md">
            <Skeleton height={60} />
            <Skeleton height={40} />
            <Skeleton height={80} />
            <Skeleton height={40} />
          </Stack>
        ) : (
          renderPanelContent()
        )}
      </ScrollArea>
    </Stack>
  );
}

export default FourPanelDashboard;