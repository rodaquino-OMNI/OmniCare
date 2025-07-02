'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { 
  Card, 
  Text, 
  Group, 
  Stack, 
  Progress, 
  Badge, 
  Tooltip, 
  Button, 
  Modal,
  SimpleGrid,
  ActionIcon,
  Box,
  Alert
} from '@mantine/core';
import { 
  IconActivity, 
  IconClockHour4, 
  IconTrendingUp, 
  IconTrendingDown, 
  IconEye, 
  IconRefresh,
  IconAlertTriangle,
  IconCheck
} from '@tabler/icons-react';

interface PerformanceMetrics {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay  
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
  loadTime: number;
  renderTime: number;
  cacheHitRate: number;
  bundleSize: number;
  memoryUsage: number;
  timestamp: number;
}

interface PerformanceThresholds {
  lcp: { good: number; poor: number };
  fid: { good: number; poor: number };
  cls: { good: number; poor: number };
  fcp: { good: number; poor: number };
  ttfb: { good: number; poor: number };
}

const PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  lcp: { good: 2500, poor: 4000 },
  fid: { good: 100, poor: 300 },
  cls: { good: 0.1, poor: 0.25 },
  fcp: { good: 1800, poor: 3000 },
  ttfb: { good: 800, poor: 1800 }
};

const PerformanceMonitor = memo(() => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [history, setHistory] = useState<PerformanceMetrics[]>([]);
  const [score, setScore] = useState(0);

  // Collect Web Vitals and performance metrics
  const collectMetrics = useCallback(async () => {
    setIsCollecting(true);
    
    try {
      const perfData: Partial<PerformanceMetrics> = {
        timestamp: Date.now()
      };

      // Get Core Web Vitals
      if ('performance' in window) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          perfData.loadTime = navigation.loadEventEnd - navigation.fetchStart;
          perfData.ttfb = navigation.responseStart - navigation.fetchStart;
          perfData.renderTime = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
        }

        // Get paint metrics
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          perfData.fcp = fcpEntry.startTime;
        }

        // Get LCP using PerformanceObserver
        if ('PerformanceObserver' in window) {
          try {
            const lcpObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1] as any;
              if (lastEntry) {
                perfData.lcp = lastEntry.startTime;
              }
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            
            // Clean up observer after a short delay
            setTimeout(() => lcpObserver.disconnect(), 1000);
          } catch (error) {
            console.warn('LCP observation failed:', error);
          }
        }

        // Get memory usage if available
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          perfData.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
        }
      }

      // Estimate bundle size from loaded resources
      if ('performance' in window) {
        const resources = performance.getEntriesByType('resource');
        const jsResources = resources.filter(resource => 
          resource.name.includes('.js') || resource.name.includes('/_next/')
        );
        perfData.bundleSize = jsResources.reduce((total, resource) => 
          total + ((resource as any).transferSize || 0), 0
        ) / 1024; // KB
      }

      // Get cache hit rate from service worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
          const channel = new MessageChannel();
          navigator.serviceWorker.controller.postMessage(
            { type: 'GET_PERFORMANCE_METRICS' }, 
            [channel.port2]
          );
          
          channel.port1.onmessage = (event) => {
            if (event.data.cacheHitRate !== undefined) {
              perfData.cacheHitRate = event.data.cacheHitRate;
            }
          };
        } catch (error) {
          console.warn('Service worker metrics unavailable:', error);
        }
      }

      // Set default values for missing metrics
      const finalMetrics: PerformanceMetrics = {
        lcp: perfData.lcp || 0,
        fid: perfData.fid || 0,
        cls: perfData.cls || 0,
        fcp: perfData.fcp || 0,
        ttfb: perfData.ttfb || 0,
        loadTime: perfData.loadTime || 0,
        renderTime: perfData.renderTime || 0,
        cacheHitRate: perfData.cacheHitRate || 0,
        bundleSize: perfData.bundleSize || 0,
        memoryUsage: perfData.memoryUsage || 0,
        timestamp: perfData.timestamp!
      };

      setMetrics(finalMetrics);
      setHistory(prev => [...prev.slice(-9), finalMetrics]); // Keep last 10

      // Calculate performance score
      const newScore = calculatePerformanceScore(finalMetrics);
      setScore(newScore);

      // Log performance warnings
      if (newScore < 50) {
        console.warn('🚨 Poor performance detected:', finalMetrics);
      } else if (newScore < 80) {
        console.warn('⚠️ Performance could be improved:', finalMetrics);
      }

    } catch (error) {
      console.error('Error collecting performance metrics:', error);
    } finally {
      setIsCollecting(false);
    }
  }, []);

  // Calculate performance score (0-100)
  const calculatePerformanceScore = (metrics: PerformanceMetrics): number => {
    const scores = [
      getMetricScore(metrics.lcp, PERFORMANCE_THRESHOLDS.lcp),
      getMetricScore(metrics.fid, PERFORMANCE_THRESHOLDS.fid),
      getMetricScore(metrics.cls, PERFORMANCE_THRESHOLDS.cls, true), // Lower is better for CLS
      getMetricScore(metrics.fcp, PERFORMANCE_THRESHOLDS.fcp),
      getMetricScore(metrics.ttfb, PERFORMANCE_THRESHOLDS.ttfb),
    ];

    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  };

  const getMetricScore = (
    value: number, 
    threshold: { good: number; poor: number }, 
    lowerIsBetter = false
  ): number => {
    if (value === 0) return 50; // Default score for unavailable metrics
    
    if (lowerIsBetter) {
      if (value <= threshold.good) return 100;
      if (value >= threshold.poor) return 0;
      return Math.round(100 - ((value - threshold.good) / (threshold.poor - threshold.good)) * 100);
    } else {
      if (value <= threshold.good) return 100;
      if (value >= threshold.poor) return 0;
      return Math.round(100 - ((value - threshold.good) / (threshold.poor - threshold.good)) * 100);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'green';
    if (score >= 50) return 'yellow';
    return 'red';
  };

  const getMetricColor = (value: number, threshold: { good: number; poor: number }, lowerIsBetter = false): string => {
    if (value === 0) return 'gray';
    
    if (lowerIsBetter) {
      if (value <= threshold.good) return 'green';
      if (value >= threshold.poor) return 'red';
      return 'yellow';
    } else {
      if (value <= threshold.good) return 'green';
      if (value >= threshold.poor) return 'red';
      return 'yellow';
    }
  };

  const formatMetric = (value: number, unit: string = 'ms'): string => {
    if (value === 0) return 'N/A';
    if (unit === 'ms') return `${Math.round(value)}ms`;
    if (unit === 'MB') return `${value.toFixed(1)}MB`;
    if (unit === 'KB') return `${Math.round(value)}KB`;
    if (unit === '%') return `${Math.round(value)}%`;
    return value.toFixed(3);
  };

  // Auto-collect metrics on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      collectMetrics();
    }, 1000); // Delay to allow page to fully load

    return () => clearTimeout(timer);
  }, [collectMetrics]);

  // Show performance monitor in development or when explicitly enabled
  useEffect(() => {
    const shouldShow = process.env.NODE_ENV === 'development' || 
                      localStorage.getItem('show-performance-monitor') === 'true';
    setIsVisible(shouldShow);
  }, []);

  if (!isVisible || !metrics) {
    return null;
  }

  return (
    <>
      {/* Performance Score Badge */}
      <Box
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 1000
        }}
      >
        <Tooltip label="Performance Score (Click for details)">
          <Badge
            size="lg"
            color={getScoreColor(score)}
            variant="filled"
            style={{ cursor: 'pointer' }}
            onClick={() => setIsVisible(true)}
            leftSection={<IconActivity size={14} />}
          >
            {score}/100
          </Badge>
        </Tooltip>
      </Box>

      {/* Detailed Performance Modal */}
      <Modal
        opened={isVisible}
        onClose={() => setIsVisible(false)}
        title="Performance Monitor"
        size="lg"
      >
        <Stack gap="md">
          {/* Overall Score */}
          <Card withBorder>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>Performance Score</Text>
              <Group gap="xs">
                <Badge color={getScoreColor(score)} size="lg">
                  {score}/100
                </Badge>
                <ActionIcon 
                  variant="light" 
                  onClick={collectMetrics}
                  loading={isCollecting}
                >
                  <IconRefresh size={16} />
                </ActionIcon>
              </Group>
            </Group>
            <Progress 
              value={score} 
              color={getScoreColor(score)} 
              size="lg" 
              radius="md"
            />
          </Card>

          {/* Core Web Vitals */}
          <Card withBorder>
            <Text fw={600} mb="md">Core Web Vitals</Text>
            <SimpleGrid cols={3} spacing="sm">
              <div>
                <Group gap="xs" mb={4}>
                  <Text size="sm" fw={500}>LCP</Text>
                  <Badge 
                    size="xs" 
                    color={getMetricColor(metrics.lcp, PERFORMANCE_THRESHOLDS.lcp)}
                  >
                    {formatMetric(metrics.lcp)}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">Largest Contentful Paint</Text>
              </div>
              
              <div>
                <Group gap="xs" mb={4}>
                  <Text size="sm" fw={500}>FID</Text>
                  <Badge 
                    size="xs" 
                    color={getMetricColor(metrics.fid, PERFORMANCE_THRESHOLDS.fid)}
                  >
                    {formatMetric(metrics.fid)}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">First Input Delay</Text>
              </div>
              
              <div>
                <Group gap="xs" mb={4}>
                  <Text size="sm" fw={500}>CLS</Text>
                  <Badge 
                    size="xs" 
                    color={getMetricColor(metrics.cls, PERFORMANCE_THRESHOLDS.cls, true)}
                  >
                    {formatMetric(metrics.cls, '')}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">Cumulative Layout Shift</Text>
              </div>
            </SimpleGrid>
          </Card>

          {/* Additional Metrics */}
          <Card withBorder>
            <Text fw={600} mb="md">Additional Metrics</Text>
            <SimpleGrid cols={2} spacing="md">
              <Group justify="space-between">
                <Text size="sm">First Contentful Paint</Text>
                <Badge color={getMetricColor(metrics.fcp, PERFORMANCE_THRESHOLDS.fcp)}>
                  {formatMetric(metrics.fcp)}
                </Badge>
              </Group>
              
              <Group justify="space-between">
                <Text size="sm">Time to First Byte</Text>
                <Badge color={getMetricColor(metrics.ttfb, PERFORMANCE_THRESHOLDS.ttfb)}>
                  {formatMetric(metrics.ttfb)}
                </Badge>
              </Group>
              
              <Group justify="space-between">
                <Text size="sm">Load Time</Text>
                <Badge color={metrics.loadTime < 3000 ? 'green' : metrics.loadTime < 5000 ? 'yellow' : 'red'}>
                  {formatMetric(metrics.loadTime)}
                </Badge>
              </Group>
              
              <Group justify="space-between">
                <Text size="sm">Bundle Size</Text>
                <Badge color={metrics.bundleSize < 250 ? 'green' : metrics.bundleSize < 500 ? 'yellow' : 'red'}>
                  {formatMetric(metrics.bundleSize, 'KB')}
                </Badge>
              </Group>
              
              <Group justify="space-between">
                <Text size="sm">Memory Usage</Text>
                <Badge color={metrics.memoryUsage < 50 ? 'green' : metrics.memoryUsage < 100 ? 'yellow' : 'red'}>
                  {formatMetric(metrics.memoryUsage, 'MB')}
                </Badge>
              </Group>
              
              <Group justify="space-between">
                <Text size="sm">Cache Hit Rate</Text>
                <Badge color={metrics.cacheHitRate > 80 ? 'green' : metrics.cacheHitRate > 50 ? 'yellow' : 'red'}>
                  {formatMetric(metrics.cacheHitRate, '%')}
                </Badge>
              </Group>
            </SimpleGrid>
          </Card>

          {/* Performance Recommendations */}
          {score < 80 && (
            <Alert
              icon={score < 50 ? <IconAlertTriangle size={16} /> : <IconTrendingUp size={16} />}
              color={score < 50 ? 'red' : 'yellow'}
              title="Performance Recommendations"
            >
              <Stack gap="xs">
                {metrics.lcp > PERFORMANCE_THRESHOLDS.lcp.good && (
                  <Text size="sm">• Optimize images and reduce server response time to improve LCP</Text>
                )}
                {metrics.fcp > PERFORMANCE_THRESHOLDS.fcp.good && (
                  <Text size="sm">• Remove render-blocking resources to improve FCP</Text>
                )}
                {metrics.bundleSize > 250 && (
                  <Text size="sm">• Consider code splitting to reduce bundle size</Text>
                )}
                {metrics.memoryUsage > 50 && (
                  <Text size="sm">• Optimize memory usage by reducing component re-renders</Text>
                )}
                {metrics.cacheHitRate < 80 && (
                  <Text size="sm">• Improve caching strategy to increase cache hit rate</Text>
                )}
              </Stack>
            </Alert>
          )}

          {score >= 90 && (
            <Alert
              icon={<IconCheck size={16} />}
              color="green"
              title="Excellent Performance!"
            >
              Your application is performing excellently across all metrics.
            </Alert>
          )}
        </Stack>
      </Modal>
    </>
  );
});

PerformanceMonitor.displayName = 'PerformanceMonitor';

export default PerformanceMonitor;