'use client';

import { Card, Text, Stack, Progress, SimpleGrid, Badge, Group, Button, RingProgress } from '@mantine/core';
import { IconShield, IconTrendingUp, IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function QualityMetricsPage() {
  const qualityScores = [
    { metric: 'Patient Safety', score: 94, trend: 'up', benchmark: 90 },
    { metric: 'Clinical Effectiveness', score: 88, trend: 'stable', benchmark: 85 },
    { metric: 'Patient Experience', score: 91, trend: 'up', benchmark: 88 },
    { metric: 'Care Coordination', score: 86, trend: 'down', benchmark: 87 },
    { metric: 'Efficiency', score: 89, trend: 'up', benchmark: 85 },
  ];

  const coreMetrics = [
    { 
      name: 'Hospital Readmission Rate',
      value: '12.3%',
      target: '<15%',
      status: 'good',
      description: '30-day readmission rate'
    },
    { 
      name: 'Healthcare-Associated Infections',
      value: '0.8%',
      target: '<1%',
      status: 'good',
      description: 'Infection rate per 1000 patient days'
    },
    { 
      name: 'Medication Error Rate',
      value: '2.1%',
      target: '<2%',
      status: 'warning',
      description: 'Errors per 1000 medication orders'
    },
    { 
      name: 'Patient Fall Rate',
      value: '1.5',
      target: '<2.0',
      status: 'good',
      description: 'Falls per 1000 patient days'
    },
  ];

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <IconTrendingUp size={16} className="text-green-500" />;
    if (trend === 'down') return <IconTrendingUp size={16} className="text-red-500 rotate-180" />;
    return <span className="text-gray-500">—</span>;
  };

  return (
    <ProtectedRoute requiredRoles={['physician', 'admin']}>
      <AppLayout
        title="Quality Metrics"
        subtitle="Healthcare quality and safety indicators"
      >
        <Stack gap="lg">
          {/* Overall Quality Score */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <div>
                <Text size="lg" fw={600}>Overall Quality Score</Text>
                <Text size="sm" c="dimmed">Composite score across all metrics</Text>
              </div>
              <RingProgress
                size={120}
                thickness={12}
                sections={[{ value: 90, color: 'green' }]}
                label={
                  <div style={{ textAlign: 'center' }}>
                    <Text size="xl" fw={700}>90%</Text>
                    <Text size="xs" c="dimmed">Excellent</Text>
                  </div>
                }
              />
            </Group>
          </Card>

          {/* Quality Domains */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Quality Domains</Text>
            <Stack gap="md">
              {qualityScores.map((item) => (
                <div key={item.metric}>
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Text size="sm" fw={500}>{item.metric}</Text>
                      {getTrendIcon(item.trend)}
                    </Group>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>{item.score}%</Text>
                      <Text size="xs" c="dimmed">Target: {item.benchmark}%</Text>
                    </Group>
                  </Group>
                  <Progress 
                    value={item.score} 
                    color={item.score >= item.benchmark ? 'green' : 'orange'}
                    size="md"
                  />
                </div>
              ))}
            </Stack>
          </Card>

          {/* Core Safety Metrics */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Core Safety Metrics</Text>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              {coreMetrics.map((metric) => (
                <Card key={metric.name} shadow="xs" padding="md" radius="sm" withBorder>
                  <Group justify="space-between" mb="xs">
                    <IconShield size={20} className="text-blue-500" />
                    <Badge 
                      color={metric.status === 'good' ? 'green' : 'orange'} 
                      variant="light"
                    >
                      {metric.status === 'good' ? 'On Target' : 'Needs Attention'}
                    </Badge>
                  </Group>
                  <Text fw={500} mb="xs">{metric.name}</Text>
                  <Group justify="space-between">
                    <Text size="xl" fw={700}>{metric.value}</Text>
                    <Text size="sm" c="dimmed">Target: {metric.target}</Text>
                  </Group>
                  <Text size="xs" c="dimmed" mt="xs">{metric.description}</Text>
                </Card>
              ))}
            </SimpleGrid>
          </Card>

          {/* Quality Initiatives */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text size="lg" fw={600}>Active Quality Initiatives</Text>
              <Button size="sm" variant="light">
                View All Initiatives
              </Button>
            </Group>
            
            <Stack gap="sm">
              <Card shadow="xs" padding="sm" radius="sm" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text fw={500}>Reduce Hospital Readmissions</Text>
                    <Text size="sm" c="dimmed">Post-discharge follow-up program</Text>
                  </div>
                  <Badge color="green" variant="light">Active</Badge>
                </Group>
              </Card>
              
              <Card shadow="xs" padding="sm" radius="sm" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text fw={500}>Medication Safety Enhancement</Text>
                    <Text size="sm" c="dimmed">Barcode scanning implementation</Text>
                  </div>
                  <Badge color="yellow" variant="light">In Progress</Badge>
                </Group>
              </Card>
              
              <Card shadow="xs" padding="sm" radius="sm" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text fw={500}>Fall Prevention Protocol</Text>
                    <Text size="sm" c="dimmed">Risk assessment and intervention program</Text>
                  </div>
                  <Badge color="green" variant="light">Active</Badge>
                </Group>
              </Card>
            </Stack>
          </Card>

          {/* Action Items */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Quality Improvement Actions</Text>
            <Stack gap="xs">
              <Group gap="xs">
                <IconAlertTriangle size={16} className="text-orange-500" />
                <Text size="sm">Review medication error trends - 2 incidents above threshold</Text>
              </Group>
              <Group gap="xs">
                <IconCheck size={16} className="text-green-500" />
                <Text size="sm">Complete quarterly safety training - 95% compliance achieved</Text>
              </Group>
              <Group gap="xs">
                <IconAlertTriangle size={16} className="text-orange-500" />
                <Text size="sm">Update care coordination protocols - Due by month end</Text>
              </Group>
            </Stack>
            
            <Group mt="md">
              <Button size="sm" leftSection={<IconShield size={16} />}>
                Generate Full Report
              </Button>
              <Button size="sm" variant="light">
                Export Metrics
              </Button>
            </Group>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}