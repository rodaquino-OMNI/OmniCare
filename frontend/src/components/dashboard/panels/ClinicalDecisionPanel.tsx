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
  Alert,
  SimpleGrid,
  Paper,
  Divider,
  Skeleton,
  Progress,
  List,
  ThemeIcon,
  Tooltip
} from '@mantine/core';
import {
  IconPill,
  IconTestPipe,
  IconClipboardList,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconTrendingUp,
  IconStethoscope,
  IconTarget,
  IconBrain,
  IconFlask,
  IconHeart,
  IconEye,
  IconArrowRight,
  IconPlus,
  IconX,
  IconExclamationMark
} from '@tabler/icons-react';
import { usePatientCache } from '@/hooks/usePatientCache';
import { formatDateTime } from '@/utils';

interface ClinicalDecisionPanelProps {
  patientId?: string;
  onNavigate?: (section: string, data?: any) => void;
  isMaximized?: boolean;
}

interface ClinicalOrder {
  id: string;
  type: 'lab' | 'imaging' | 'medication' | 'procedure';
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'routine' | 'urgent' | 'stat';
  orderedDate: Date;
  dueDate?: Date;
  results?: string;
  provider: string;
}

interface ClinicalDecision {
  id: string;
  type: 'medication' | 'diagnostic' | 'procedure' | 'referral';
  recommendation: string;
  evidence: string;
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  source: 'guidelines' | 'ai' | 'literature' | 'experience';
}

interface PendingResult {
  id: string;
  type: 'lab' | 'imaging';
  name: string;
  orderedDate: Date;
  expectedDate: Date;
  status: 'pending' | 'processing' | 'ready';
  priority: 'routine' | 'urgent' | 'stat';
}

export function ClinicalDecisionPanel({ 
  patientId, 
  onNavigate, 
  isMaximized = false 
}: ClinicalDecisionPanelProps) {
  const [activeTab, setActiveTab] = useState<string | null>('orders');
  const {
    patient,
    medications,
    labs,
    loading
  } = usePatientCache(patientId || '', {
    enableSync: true,
    prefetchRelated: true
  });
  
  // Mock clinical data - in real app, this would come from clinical decision support
  const [activeOrders] = useState<ClinicalOrder[]>([
    {
      id: '1',
      type: 'lab',
      name: 'Complete Blood Count',
      status: 'pending',
      priority: 'routine',
      orderedDate: new Date(Date.now() - 86400000),
      dueDate: new Date(Date.now() + 86400000),
      provider: 'Dr. Smith'
    },
    {
      id: '2',
      type: 'medication',
      name: 'Lisinopril 10mg',
      status: 'in-progress',
      priority: 'routine',
      orderedDate: new Date(Date.now() - 172800000),
      provider: 'Dr. Johnson'
    },
    {
      id: '3',
      type: 'imaging',
      name: 'Chest X-Ray',
      status: 'completed',
      priority: 'urgent',
      orderedDate: new Date(Date.now() - 259200000),
      results: 'Normal findings',
      provider: 'Dr. Williams'
    }
  ]);

  const [clinicalDecisions] = useState<ClinicalDecision[]>([
    {
      id: '1',
      type: 'medication',
      recommendation: 'Consider ACE inhibitor for hypertension management',
      evidence: 'AHA/ACC Guidelines 2023',
      confidence: 85,
      urgency: 'medium',
      source: 'guidelines'
    },
    {
      id: '2',
      type: 'diagnostic',
      recommendation: 'HbA1c testing recommended for diabetes monitoring',
      evidence: 'ADA Standards of Care',
      confidence: 92,
      urgency: 'low',
      source: 'guidelines'
    },
    {
      id: '3',
      type: 'procedure',
      recommendation: 'Consider cardiac stress test based on risk factors',
      evidence: 'AI Risk Assessment',
      confidence: 78,
      urgency: 'medium',
      source: 'ai'
    }
  ]);

  const [pendingResults] = useState<PendingResult[]>([
    {
      id: '1',
      type: 'lab',
      name: 'Lipid Panel',
      orderedDate: new Date(Date.now() - 86400000),
      expectedDate: new Date(Date.now() + 3600000),
      status: 'processing',
      priority: 'routine'
    },
    {
      id: '2',
      type: 'imaging',
      name: 'CT Abdomen',
      orderedDate: new Date(Date.now() - 172800000),
      expectedDate: new Date(Date.now() + 7200000),
      status: 'ready',
      priority: 'urgent'
    }
  ]);

  const getOrderIcon = (type: string) => {
    switch (type) {
      case 'lab': return IconTestPipe;
      case 'imaging': return IconEye;
      case 'medication': return IconPill;
      case 'procedure': return IconStethoscope;
      default: return IconClipboardList;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'in-progress': return 'blue';
      case 'pending': return 'orange';
      case 'cancelled': return 'red';
      default: return 'gray';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'stat': return 'red';
      case 'urgent': return 'orange';
      case 'routine': return 'blue';
      default: return 'gray';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'green';
    if (confidence >= 75) return 'blue';
    if (confidence >= 60) return 'orange';
    return 'red';
  };

  if (!patientId) {
    return (
      <Stack align="center" justify="center" h="100%">
        <IconBrain size={48} className="text-gray-400" />
        <Text c="dimmed" ta="center">
          Select a patient to view clinical decisions
        </Text>
        <Button 
          variant="light" 
          leftSection={<IconTarget size={16} />}
          onClick={() => onNavigate?.('clinical')}
        >
          Clinical Workflow
        </Button>
      </Stack>
    );
  }

  if (loading && !patient) {
    return (
      <Stack gap="md">
        <Skeleton height={40} />
        <Skeleton height={80} />
        <Skeleton height={60} />
        <Skeleton height={100} />
      </Stack>
    );
  }

  return (
    <Stack gap="md" h="100%">
      {/* Quick Stats */}
      <SimpleGrid cols={isMaximized ? 4 : 2} spacing="xs">
        <Paper p="xs" withBorder className="text-center">
          <Text size="lg" fw={700} c="blue">
            {activeOrders.filter(o => o.status === 'pending').length}
          </Text>
          <Text size="xs" c="dimmed">Pending Orders</Text>
        </Paper>
        
        <Paper p="xs" withBorder className="text-center">
          <Text size="lg" fw={700} c="orange">
            {pendingResults.length}
          </Text>
          <Text size="xs" c="dimmed">Pending Results</Text>
        </Paper>
        
        {isMaximized && (
          <>
            <Paper p="xs" withBorder className="text-center">
              <Text size="lg" fw={700} c="green">
                {clinicalDecisions.length}
              </Text>
              <Text size="xs" c="dimmed">Recommendations</Text>
            </Paper>
            
            <Paper p="xs" withBorder className="text-center">
              <Text size="lg" fw={700} c="red">
                {clinicalDecisions.filter(d => d.urgency === 'high' || d.urgency === 'critical').length}
              </Text>
              <Text size="xs" c="dimmed">High Priority</Text>
            </Paper>
          </>
        )}
      </SimpleGrid>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} flex={1}>
        <Tabs.List grow={!isMaximized}>
          <Tabs.Tab value="orders" leftSection={<IconClipboardList size={14} />}>
            Orders
          </Tabs.Tab>
          <Tabs.Tab value="results" leftSection={<IconTestPipe size={14} />}>
            Results
          </Tabs.Tab>
          {isMaximized && (
            <>
              <Tabs.Tab value="decisions" leftSection={<IconBrain size={14} />}>
                Decisions
              </Tabs.Tab>
              <Tabs.Tab value="medications" leftSection={<IconPill size={14} />}>
                Medications
              </Tabs.Tab>
            </>
          )}
        </Tabs.List>

        <Tabs.Panel value="orders" pt="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500} size="sm">Active Orders</Text>
              <Button 
                size="xs" 
                leftSection={<IconPlus size={12} />}
                onClick={() => onNavigate?.('orders', { patientId, action: 'create' })}
              >
                New Order
              </Button>
            </Group>
            
            {activeOrders.map((order) => {
              const OrderIcon = getOrderIcon(order.type);
              return (
                <Card key={order.id} withBorder>
                  <Group justify="space-between" align="flex-start">
                    <Group gap="md">
                      <ThemeIcon 
                        size="lg" 
                        variant="light" 
                        color={getStatusColor(order.status)}
                      >
                        <OrderIcon size={20} />
                      </ThemeIcon>
                      
                      <div>
                        <Text fw={500} size="sm">
                          {order.name}
                        </Text>
                        <Group gap="xs" mt="xs">
                          <Badge 
                            size="xs" 
                            color={getStatusColor(order.status)}
                            variant="light"
                          >
                            {order.status.toUpperCase()}
                          </Badge>
                          <Badge 
                            size="xs" 
                            color={getPriorityColor(order.priority)}
                            variant="light"
                          >
                            {order.priority.toUpperCase()}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed" mt="xs">
                          Ordered: {formatDateTime(order.orderedDate)}
                        </Text>
                        {order.dueDate && (
                          <Text size="xs" c="dimmed">
                            Due: {formatDateTime(order.dueDate)}
                          </Text>
                        )}
                      </div>
                    </Group>
                    
                    <ActionIcon 
                      variant="light" 
                      size="sm"
                      onClick={() => onNavigate?.('orders', { orderId: order.id })}
                    >
                      <IconArrowRight size={14} />
                    </ActionIcon>
                  </Group>
                  
                  {order.results && (
                    <Alert icon={<IconCheck size={16} />} color="green" variant="light" mt="md">
                      <Text size="sm">{order.results}</Text>
                    </Alert>
                  )}
                </Card>
              );
            })}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="results" pt="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500} size="sm">Pending Results</Text>
              <Button 
                size="xs" 
                variant="light"
                rightSection={<IconArrowRight size={12} />}
                onClick={() => onNavigate?.('results', { patientId })}
              >
                View All
              </Button>
            </Group>
            
            {pendingResults.map((result) => (
              <Card key={result.id} withBorder>
                <Group justify="space-between" align="center">
                  <Group gap="md">
                    <ThemeIcon 
                      size="md" 
                      variant="light" 
                      color={result.type === 'lab' ? 'blue' : 'purple'}
                    >
                      {result.type === 'lab' ? <IconFlask size={16} /> : <IconEye size={16} />}
                    </ThemeIcon>
                    
                    <div>
                      <Text fw={500} size="sm">
                        {result.name}
                      </Text>
                      <Group gap="xs" mt="xs">
                        <Badge 
                          size="xs" 
                          color={result.status === 'ready' ? 'green' : 'blue'}
                          variant="light"
                        >
                          {result.status.toUpperCase()}
                        </Badge>
                        <Badge 
                          size="xs" 
                          color={getPriorityColor(result.priority)}
                          variant="light"
                        >
                          {result.priority.toUpperCase()}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed" mt="xs">
                        Expected: {formatDateTime(result.expectedDate)}
                      </Text>
                    </div>
                  </Group>
                  
                  {result.status === 'ready' && (
                    <Button 
                      size="xs" 
                      color="green"
                      onClick={() => onNavigate?.('results', { resultId: result.id })}
                    >
                      View Result
                    </Button>
                  )}
                </Group>
              </Card>
            ))}
          </Stack>
        </Tabs.Panel>

        {isMaximized && (
          <>
            <Tabs.Panel value="decisions" pt="md">
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={500} size="sm">Clinical Decision Support</Text>
                  <Badge variant="light" color="blue">
                    AI Powered
                  </Badge>
                </Group>
                
                {clinicalDecisions.map((decision) => (
                  <Card key={decision.id} withBorder>
                    <Group justify="space-between" align="flex-start" mb="md">
                      <Group gap="xs">
                        <Badge 
                          size="sm" 
                          color={getUrgencyColor(decision.urgency)}
                          variant="light"
                        >
                          {decision.urgency.toUpperCase()}
                        </Badge>
                        <Badge 
                          size="sm" 
                          variant="outline"
                        >
                          {decision.type.toUpperCase()}
                        </Badge>
                      </Group>
                      
                      <Tooltip label={`${decision.confidence}% confidence`}>
                        <Progress 
                          value={decision.confidence} 
                          color={getConfidenceColor(decision.confidence)}
                          size="sm"
                          w={60}
                        />
                      </Tooltip>
                    </Group>
                    
                    <Text fw={500} size="sm" mb="xs">
                      {decision.recommendation}
                    </Text>
                    
                    <Group justify="space-between" align="center">
                      <Text size="xs" c="dimmed">
                        Source: {decision.evidence}
                      </Text>
                      
                      <Group gap="xs">
                        <ActionIcon 
                          variant="light" 
                          color="green"
                          size="sm"
                          title="Accept recommendation"
                        >
                          <IconCheck size={14} />
                        </ActionIcon>
                        <ActionIcon 
                          variant="light" 
                          color="red"
                          size="sm"
                          title="Dismiss recommendation"
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="medications" pt="md">
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={500} size="sm">Current Medications</Text>
                  <Button 
                    size="xs" 
                    leftSection={<IconPlus size={12} />}
                    onClick={() => onNavigate?.('medications', { patientId, action: 'prescribe' })}
                  >
                    Prescribe
                  </Button>
                </Group>
                
                {medications.length === 0 ? (
                  <Paper p="xl" className="text-center border-dashed border-2 border-gray-200">
                    <IconPill size={32} className="text-gray-400 mx-auto mb-2" />
                    <Text c="dimmed">No active medications</Text>
                  </Paper>
                ) : (
                  medications.map((medication, index) => (
                    <Card key={index} withBorder>
                      <Group justify="space-between" align="flex-start">
                        <Group gap="md">
                          <ThemeIcon size="md" variant="light" color="blue">
                            <IconPill size={16} />
                          </ThemeIcon>
                          
                          <div>
                            <Text fw={500} size="sm">
                              {medication.medicationCodeableConcept?.text || 'Unknown Medication'}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {medication.dosageInstruction?.[0]?.text || 'No dosage information'}
                            </Text>
                            <Badge 
                              size="xs" 
                              color={medication.status === 'active' ? 'green' : 'gray'}
                              variant="light"
                              mt="xs"
                            >
                              {medication.status?.toUpperCase()}
                            </Badge>
                          </div>
                        </Group>
                        
                        <ActionIcon 
                          variant="light" 
                          size="sm"
                          onClick={() => onNavigate?.('medications', { medicationId: medication.id })}
                        >
                          <IconArrowRight size={14} />
                        </ActionIcon>
                      </Group>
                    </Card>
                  ))
                )}
              </Stack>
            </Tabs.Panel>
          </>
        )}
      </Tabs>
    </Stack>
  );
}

export default ClinicalDecisionPanel;