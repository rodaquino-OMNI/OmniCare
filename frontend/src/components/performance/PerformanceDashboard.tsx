'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import {
  Card,
  Group,
  Text,
  Stack,
  Progress,
  Badge,
  Button,
  Grid,
  Tabs,
  Table,
  JsonInput,
  Alert,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import {
  IconRefresh,
  IconDatabase,
  IconPhoto,
  IconCpu,
  IconActivity,
  IconAlertTriangle,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import { useMemoryOptimization, useBundleOptimization, useImageOptimization } from '@/hooks/useMemoryOptimization';

interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  networkRequests: number;
  avgResponseTime: number;
  compressionSavings: number;
  resourceCounts: {
    static: number;
    dynamic: number;
    api: number;
    images: number;
    fonts: number;
  };
}

interface WebVitals {
  CLS: number;
  LCP: number;
  FCP: number;
  FID: number;
  TTFB: number;
}

export const PerformanceDashboard = memo(() => {
  const [serviceWorkerMetrics, setServiceWorkerMetrics] = useState<PerformanceMetrics | null>(null);
  const [webVitals, setWebVitals] = useState<WebVitals | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [isLoading, setIsLoading] = useState(false);

  const memoryStats = useMemoryOptimization('PerformanceDashboard');
  const bundleStats = useBundleOptimization();
  const imageStats = useImageOptimization();

  // Get service worker metrics
  const fetchServiceWorkerMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const messageChannel = new MessageChannel();
        
        const metricsPromise = new Promise<PerformanceMetrics>((resolve, reject) => {
          messageChannel.port1.onmessage = (event) => {
            if (event.data.success) {
              resolve(event.data.data);
            } else {
              reject(new Error(event.data.error));
            }
          };
          
          setTimeout(() => reject(new Error('Timeout')), 5000);
        });

        navigator.serviceWorker.controller.postMessage(
          { type: 'GET_PERFORMANCE_METRICS' },
          [messageChannel.port2]
        );

        const metrics = await metricsPromise;
        setServiceWorkerMetrics(metrics);
      }
    } catch (error) {
      console.error('Failed to fetch service worker metrics:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get Web Vitals using Performance Observer
  useEffect(() => {
    if ('PerformanceObserver' in window) {
      const vitals: Partial<WebVitals> = {};

      // Largest Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        vitals.LCP = lastEntry.startTime;
        setWebVitals(prev => ({ ...prev, ...vitals } as WebVitals));
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // First Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          vitals.FCP = fcpEntry.startTime;
          setWebVitals(prev => ({ ...prev, ...vitals } as WebVitals));
        }
      }).observe({ entryTypes: ['paint'] });

      // Cumulative Layout Shift
      new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        vitals.CLS = clsValue;
        setWebVitals(prev => ({ ...prev, ...vitals } as WebVitals));
      }).observe({ entryTypes: ['layout-shift'] });

      // Time to First Byte
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        vitals.TTFB = navigation.responseStart - navigation.requestStart;
        setWebVitals(prev => ({ ...prev, ...vitals } as WebVitals));
      }
    }
  }, []);

  // Fetch metrics on mount
  useEffect(() => {
    fetchServiceWorkerMetrics();
  }, [fetchServiceWorkerMetrics]);

  const clearCaches = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const messageChannel = new MessageChannel();
        
        navigator.serviceWorker.controller.postMessage(
          { type: 'CLEAR_CACHE' },
          [messageChannel.port2]
        );

        // Refresh metrics after clearing
        setTimeout(fetchServiceWorkerMetrics, 1000);
      }
    } catch (error) {
      console.error('Failed to clear caches:', error);
    }
  }, [fetchServiceWorkerMetrics]);

  const getVitalScore = (vital: keyof WebVitals, value: number) => {
    const thresholds = {
      CLS: { good: 0.1, poor: 0.25 },
      LCP: { good: 2500, poor: 4000 },
      FCP: { good: 1800, poor: 3000 },
      FID: { good: 100, poor: 300 },
      TTFB: { good: 800, poor: 1800 }
    };

    const threshold = thresholds[vital];
    if (value <= threshold.good) return { score: 'good', color: 'green' };
    if (value <= threshold.poor) return { score: 'needs-improvement', color: 'yellow' };
    return { score: 'poor', color: 'red' };
  };

  return (
    <Card>
      <Group justify="space-between" mb="md">
        <Text size="lg" fw={600}>Performance Dashboard</Text>
        <Group gap="xs">
          <Tooltip label="Refresh Metrics">
            <ActionIcon 
              variant="light" 
              onClick={fetchServiceWorkerMetrics}
              loading={isLoading}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          <Button size="xs" variant="subtle" color="red" onClick={clearCaches}>
            Clear Caches
          </Button>
        </Group>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconActivity size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="web-vitals" leftSection={<IconCpu size={16} />}>
            Web Vitals
          </Tabs.Tab>
          <Tabs.Tab value="caching" leftSection={<IconDatabase size={16} />}>
            Caching
          </Tabs.Tab>
          <Tabs.Tab value="resources" leftSection={<IconPhoto size={16} />}>
            Resources
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Grid>
            <Grid.Col span={6}>
              <Card withBorder>
                <Text size="sm" fw={500} mb="xs">Memory Usage</Text>
                {memoryStats.getMemoryStats() ? (
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="xs">Used</Text>
                      <Text size="xs">
                        {(memoryStats.getMemoryStats()!.used / 1024 / 1024).toFixed(1)} MB
                      </Text>
                    </Group>
                    <Progress
                      value={memoryStats.getMemoryStats()!.usage}
                      color={memoryStats.getMemoryStats()!.usage > 80 ? 'red' : 'blue'}
                    />
                  </Stack>
                ) : (
                  <Text size="xs" c="dimmed">Memory API not available</Text>
                )}
              </Card>
            </Grid.Col>

            <Grid.Col span={6}>
              <Card withBorder>
                <Text size="sm" fw={500} mb="xs">Bundle Info</Text>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="xs">Scripts</Text>
                    <Badge size="xs">{bundleStats.totalScripts}</Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs">Styles</Text>
                    <Badge size="xs">{bundleStats.totalStyles}</Badge>
                  </Group>
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={6}>
              <Card withBorder>
                <Text size="sm" fw={500} mb="xs">Images</Text>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="xs">Total</Text>
                    <Text size="xs">{imageStats.getImageStats().total}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs">Loaded</Text>
                    <Text size="xs">{imageStats.getImageStats().loaded}</Text>
                  </Group>
                  <Progress
                    value={imageStats.getImageStats().loadPercentage}
                    color="green"
                  />
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={6}>
              <Card withBorder>
                <Text size="sm" fw={500} mb="xs">Render Performance</Text>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="xs">Renders</Text>
                    <Text size="xs">{memoryStats.renderCount}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs">Memory</Text>
                    <Text size="xs">
                      {(memoryStats.currentMemoryUsage / 1024 / 1024).toFixed(1)} MB
                    </Text>
                  </Group>
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="web-vitals" pt="md">
          {webVitals ? (
            <Grid>
              {Object.entries(webVitals).map(([vital, value]) => {
                const score = getVitalScore(vital as keyof WebVitals, value);
                return (
                  <Grid.Col key={vital} span={4}>
                    <Card withBorder>
                      <Group justify="space-between" mb="xs">
                        <Text size="sm" fw={500}>{vital}</Text>
                        <Badge color={score.color} variant="light">
                          {score.score}
                        </Badge>
                      </Group>
                      <Text size="lg" fw={600}>
                        {vital === 'CLS' ? value.toFixed(3) : `${Math.round(value)}ms`}
                      </Text>
                    </Card>
                  </Grid.Col>
                );
              })}
            </Grid>
          ) : (
            <Alert icon={<IconAlertTriangle size={16} />} color="yellow">
              Web Vitals data is still being collected...
            </Alert>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="caching" pt="md">
          {serviceWorkerMetrics ? (
            <Grid>
              <Grid.Col span={6}>
                <Card withBorder>
                  <Text size="sm" fw={500} mb="md">Cache Performance</Text>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Text size="sm">Hit Rate</Text>
                      <Badge color="green">
                        {(
                          (serviceWorkerMetrics.cacheHits / 
                           (serviceWorkerMetrics.cacheHits + serviceWorkerMetrics.cacheMisses)) * 100
                        ).toFixed(1)}%
                      </Badge>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Cache Hits</Text>
                      <Text size="sm">{serviceWorkerMetrics.cacheHits}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Cache Misses</Text>
                      <Text size="sm">{serviceWorkerMetrics.cacheMisses}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Network Requests</Text>
                      <Text size="sm">{serviceWorkerMetrics.networkRequests}</Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={6}>
                <Card withBorder>
                  <Text size="sm" fw={500} mb="md">Response Times</Text>
                  <Group justify="space-between">
                    <Text size="sm">Average Response Time</Text>
                    <Badge color={serviceWorkerMetrics.avgResponseTime > 1000 ? 'red' : 'green'}>
                      {serviceWorkerMetrics.avgResponseTime.toFixed(0)}ms
                    </Badge>
                  </Group>
                  {serviceWorkerMetrics.compressionSavings > 0 && (
                    <Group justify="space-between" mt="md">
                      <Text size="sm">Compression Savings</Text>
                      <Text size="sm">
                        {(serviceWorkerMetrics.compressionSavings / 1024).toFixed(1)} KB
                      </Text>
                    </Group>
                  )}
                </Card>
              </Grid.Col>
            </Grid>
          ) : (
            <Alert icon={<IconAlertTriangle size={16} />} color="yellow">
              Service Worker metrics not available
            </Alert>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="resources" pt="md">
          {serviceWorkerMetrics && (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Resource Type</Table.Th>
                  <Table.Th>Count</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Object.entries(serviceWorkerMetrics.resourceCounts).map(([type, count]) => (
                  <Table.Tr key={type}>
                    <Table.Td>
                      <Text tt="capitalize">{type}</Text>
                    </Table.Td>
                    <Table.Td>{count}</Table.Td>
                    <Table.Td>
                      <Badge color="green" variant="light">
                        <IconCheck size={12} />
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          {process.env.NODE_ENV === 'development' && (
            <Card mt="md" withBorder>
              <Text size="sm" fw={500} mb="md">Raw Metrics (Debug)</Text>
              <JsonInput
                value={JSON.stringify({ serviceWorkerMetrics, webVitals }, null, 2)}
                readOnly
                autosize
                minRows={4}
              />
            </Card>
          )}
        </Tabs.Panel>
      </Tabs>
    </Card>
  );
});

PerformanceDashboard.displayName = 'PerformanceDashboard';

export default PerformanceDashboard;