import { NextRequest, NextResponse } from 'next/server';

interface PerformanceData {
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
  loadTime?: number;
  renderTime?: number;
  cacheHitRate?: number;
  bundleSize?: number;
  memoryUsage?: number;
  userAgent?: string;
  url?: string;
  timestamp: number;
}

interface AggregatedMetrics {
  averages: {
    lcp: number;
    fid: number;
    cls: number;
    fcp: number;
    ttfb: number;
    loadTime: number;
    renderTime: number;
    cacheHitRate: number;
    bundleSize: number;
    memoryUsage: number;
  };
  counts: {
    total: number;
    good: number;
    needsImprovement: number;
    poor: number;
  };
  percentiles: {
    p50: Record<string, number>;
    p75: Record<string, number>;
    p95: Record<string, number>;
  };
  trends: {
    last24h: number;
    last7d: number;
    improvement: boolean;
  };
}

// In-memory storage for demo (in production, use a proper database)
const performanceMetrics: PerformanceData[] = [];
const MAX_METRICS = 10000; // Keep last 10k metrics

// Performance thresholds for scoring
const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  fid: { good: 100, poor: 300 },
  cls: { good: 0.1, poor: 0.25 },
  fcp: { good: 1800, poor: 3000 },
  ttfb: { good: 800, poor: 1800 },
  loadTime: { good: 3000, poor: 5000 },
  bundleSize: { good: 250, poor: 500 },
  memoryUsage: { good: 50, poor: 100 },
};

function calculateScore(value: number, threshold: { good: number; poor: number }, lowerIsBetter = false): 'good' | 'needs-improvement' | 'poor' {
  if (value === 0) return 'needs-improvement';
  
  if (lowerIsBetter) {
    if (value <= threshold.good) return 'good';
    if (value >= threshold.poor) return 'poor';
    return 'needs-improvement';
  } else {
    if (value <= threshold.good) return 'good';
    if (value >= threshold.poor) return 'poor';
    return 'needs-improvement';
  }
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.floor((percentile / 100) * sorted.length);
  return sorted[Math.min(index, sorted.length - 1)] || 0;
}

function aggregateMetrics(metrics: PerformanceData[]): AggregatedMetrics {
  if (metrics.length === 0) {
    return {
      averages: {
        lcp: 0, fid: 0, cls: 0, fcp: 0, ttfb: 0,
        loadTime: 0, renderTime: 0, cacheHitRate: 0,
        bundleSize: 0, memoryUsage: 0
      },
      counts: { total: 0, good: 0, needsImprovement: 0, poor: 0 },
      percentiles: { p50: {}, p75: {}, p95: {} },
      trends: { last24h: 0, last7d: 0, improvement: false }
    };
  }

  const metricKeys = ['lcp', 'fid', 'cls', 'fcp', 'ttfb', 'loadTime', 'renderTime', 'cacheHitRate', 'bundleSize', 'memoryUsage'] as const;
  
  // Calculate averages
  const averages = metricKeys.reduce((acc, key) => {
    const values = metrics.map(m => m[key] || 0).filter(v => v > 0);
    acc[key] = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
    return acc;
  }, {} as Record<string, number>);

  // Calculate performance scores
  let good = 0, needsImprovement = 0, poor = 0;
  
  metrics.forEach(metric => {
    const scores = [
      calculateScore(metric.lcp || 0, THRESHOLDS.lcp),
      calculateScore(metric.fid || 0, THRESHOLDS.fid),
      calculateScore(metric.cls || 0, THRESHOLDS.cls, true),
      calculateScore(metric.fcp || 0, THRESHOLDS.fcp),
      calculateScore(metric.ttfb || 0, THRESHOLDS.ttfb),
    ];
    
    const goodCount = scores.filter(s => s === 'good').length;
    const poorCount = scores.filter(s => s === 'poor').length;
    
    if (goodCount >= 4) good++;
    else if (poorCount >= 2) poor++;
    else needsImprovement++;
  });

  // Calculate percentiles
  const percentiles = {
    p50: {} as Record<string, number>,
    p75: {} as Record<string, number>,
    p95: {} as Record<string, number>,
  };

  metricKeys.forEach(key => {
    const values = metrics.map(m => m[key] || 0).filter(v => v > 0);
    percentiles.p50[key] = calculatePercentile(values, 50);
    percentiles.p75[key] = calculatePercentile(values, 75);
    percentiles.p95[key] = calculatePercentile(values, 95);
  });

  // Calculate trends
  const now = Date.now();
  const last24h = metrics.filter(m => (now - m.timestamp) <= 24 * 60 * 60 * 1000).length;
  const last7d = metrics.filter(m => (now - m.timestamp) <= 7 * 24 * 60 * 60 * 1000).length;
  
  // Simple improvement calculation based on recent vs older metrics
  const recent = metrics.slice(-100);
  const older = metrics.slice(-200, -100);
  const recentAvgLcp = recent.reduce((sum, m) => sum + (m.lcp || 0), 0) / recent.length;
  const olderAvgLcp = older.length > 0 ? older.reduce((sum, m) => sum + (m.lcp || 0), 0) / older.length : recentAvgLcp;
  const improvement = recentAvgLcp < olderAvgLcp;

  return {
    averages: averages as AggregatedMetrics['averages'],
    counts: { total: metrics.length, good, needsImprovement, poor },
    percentiles,
    trends: { last24h, last7d, improvement }
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe') || '24h';
    const format = url.searchParams.get('format') || 'json';
    
    // Filter metrics by timeframe
    const now = Date.now();
    let cutoff = now;
    
    switch (timeframe) {
      case '1h':
        cutoff = now - 60 * 60 * 1000;
        break;
      case '24h':
        cutoff = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        cutoff = now - 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        cutoff = now - 24 * 60 * 60 * 1000;
    }
    
    const filteredMetrics = performanceMetrics.filter(m => m.timestamp >= cutoff);
    const aggregated = aggregateMetrics(filteredMetrics);
    
    // Calculate performance score (0-100)
    const score = Math.round((aggregated.counts.good / Math.max(aggregated.counts.total, 1)) * 100);
    
    const response = {
      score,
      metrics: aggregated,
      timeframe,
      lastUpdated: new Date().toISOString(),
      sampleSize: filteredMetrics.length,
      recommendations: generateRecommendations(aggregated)
    };

    if (format === 'csv') {
      const csv = convertToCSV(filteredMetrics);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="performance-metrics-${timeframe}.csv"`
        }
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const performanceData: PerformanceData = {
      ...body,
      timestamp: Date.now(),
      userAgent: request.headers.get('user-agent') || undefined,
    };

    // Validate the data
    if (!performanceData.timestamp) {
      return NextResponse.json(
        { error: 'Missing required timestamp' },
        { status: 400 }
      );
    }

    // Add to metrics array
    performanceMetrics.push(performanceData);
    
    // Keep only the most recent metrics
    if (performanceMetrics.length > MAX_METRICS) {
      performanceMetrics.splice(0, performanceMetrics.length - MAX_METRICS);
    }

    // Log significant performance issues
    if (performanceData.lcp && performanceData.lcp > THRESHOLDS.lcp.poor) {
      console.warn(`🚨 Poor LCP detected: ${performanceData.lcp}ms for ${performanceData.url}`);
    }
    
    if (performanceData.loadTime && performanceData.loadTime > THRESHOLDS.loadTime.poor) {
      console.warn(`🚨 Slow load time detected: ${performanceData.loadTime}ms for ${performanceData.url}`);
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Performance data recorded',
        total: performanceMetrics.length 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error recording performance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to record performance metrics' },
      { status: 500 }
    );
  }
}

function generateRecommendations(metrics: AggregatedMetrics): string[] {
  const recommendations: string[] = [];
  
  if (metrics.averages.lcp > THRESHOLDS.lcp.good) {
    recommendations.push('Optimize images and reduce server response time to improve Largest Contentful Paint');
  }
  
  if (metrics.averages.fcp > THRESHOLDS.fcp.good) {
    recommendations.push('Remove render-blocking resources to improve First Contentful Paint');
  }
  
  if (metrics.averages.cls > THRESHOLDS.cls.good) {
    recommendations.push('Set size attributes on images and ads to reduce Cumulative Layout Shift');
  }
  
  if (metrics.averages.ttfb > THRESHOLDS.ttfb.good) {
    recommendations.push('Optimize server response time and consider using a CDN');
  }
  
  if (metrics.averages.bundleSize > THRESHOLDS.bundleSize.good) {
    recommendations.push('Implement code splitting and tree shaking to reduce bundle size');
  }
  
  if (metrics.averages.memoryUsage > THRESHOLDS.memoryUsage.good) {
    recommendations.push('Optimize memory usage by reducing component re-renders and cleaning up event listeners');
  }
  
  if (metrics.averages.cacheHitRate < 80) {
    recommendations.push('Improve caching strategy to increase cache hit rate');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Performance is excellent! Continue monitoring to maintain optimal user experience.');
  }
  
  return recommendations;
}

function convertToCSV(metrics: PerformanceData[]): string {
  if (metrics.length === 0) return 'No data available';
  
  const headers = Object.keys(metrics[0]).join(',');
  const rows = metrics.map(metric => 
    Object.values(metric).map(value => 
      typeof value === 'string' ? `"${value}"` : value
    ).join(',')
  );
  
  return [headers, ...rows].join('\n');
}