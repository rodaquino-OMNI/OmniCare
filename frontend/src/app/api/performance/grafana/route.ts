import { NextRequest, NextResponse } from 'next/server';

interface GrafanaMetric {
  target: string;
  datapoints: [number, number][]; // [value, timestamp]
}

interface GrafanaAnnotation {
  time: number;
  title: string;
  text: string;
  tags: string[];
}

interface GrafanaTableData {
  columns: Array<{ text: string; type: string }>;
  rows: Array<Array<string | number>>;
}

// Performance metrics storage (shared with main performance route)
import performanceData from '../route';

/**
 * Grafana datasource endpoint for OmniCare performance metrics
 * Supports time series, table, and annotation queries
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targets, range, intervalMs, panelId } = body;

    if (!targets || !Array.isArray(targets)) {
      return NextResponse.json({ error: 'Invalid targets' }, { status: 400 });
    }

    const responses = await Promise.all(
      targets.map(async (target: any) => {
        switch (target.type || 'timeserie') {
          case 'timeserie':
            return await handleTimeSeriesQuery(target, range);
          case 'table':
            return await handleTableQuery(target, range);
          case 'annotation':
            return await handleAnnotationQuery(target, range);
          default:
            return { target: target.target, datapoints: [] };
        }
      })
    );

    return NextResponse.json(responses);
  } catch (error) {
    console.error('Grafana API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Test connection endpoint for Grafana datasource configuration
 */
export async function GET() {
  return NextResponse.json({
    status: 'success',
    message: 'OmniCare Performance Metrics datasource is connected',
    version: '1.0.0',
    capabilities: ['timeseries', 'table', 'annotations']
  });
}

/**
 * Handle time series queries for performance metrics
 */
async function handleTimeSeriesQuery(target: any, range: any): Promise<GrafanaMetric> {
  const { target: metricName, refId } = target;
  const { from, to } = range;

  // Simulate fetching performance data (in production, fetch from database)
  const datapoints: [number, number][] = [];
  
  // Generate sample data points based on metric type
  const startTime = new Date(from).getTime();
  const endTime = new Date(to).getTime();
  const interval = (endTime - startTime) / 100; // 100 data points

  for (let i = 0; i <= 100; i++) {
    const timestamp = startTime + (i * interval);
    let value = 0;

    switch (metricName) {
      case 'lcp':
        value = 2000 + Math.random() * 1500; // LCP in ms
        break;
      case 'fcp':
        value = 1500 + Math.random() * 1000; // FCP in ms
        break;
      case 'cls':
        value = Math.random() * 0.3; // CLS score
        break;
      case 'fid':
        value = Math.random() * 200; // FID in ms
        break;
      case 'ttfb':
        value = 500 + Math.random() * 800; // TTFB in ms
        break;
      case 'load_time':
        value = 3000 + Math.random() * 2000; // Load time in ms
        break;
      case 'bundle_size':
        value = 300 + Math.random() * 200; // Bundle size in KB
        break;
      case 'memory_usage':
        value = 50 + Math.random() * 50; // Memory usage in MB
        break;
      case 'cache_hit_rate':
        value = 70 + Math.random() * 30; // Cache hit rate %
        break;
      case 'performance_score':
        value = 60 + Math.random() * 40; // Performance score 0-100
        break;
      case 'page_views':
        value = Math.floor(Math.random() * 100); // Page views count
        break;
      case 'error_rate':
        value = Math.random() * 5; // Error rate %
        break;
      default:
        value = Math.random() * 100;
    }

    datapoints.push([value, timestamp]);
  }

  return {
    target: metricName,
    datapoints
  };
}

/**
 * Handle table queries for detailed performance analysis
 */
async function handleTableQuery(target: any, range: any): Promise<GrafanaTableData> {
  const { from, to } = range;

  // Sample performance data for table view
  const columns = [
    { text: 'Timestamp', type: 'time' },
    { text: 'Page', type: 'string' },
    { text: 'LCP (ms)', type: 'number' },
    { text: 'FCP (ms)', type: 'number' },
    { text: 'CLS', type: 'number' },
    { text: 'FID (ms)', type: 'number' },
    { text: 'Score', type: 'number' },
    { text: 'User Agent', type: 'string' }
  ];

  const rows: Array<Array<string | number>> = [];
  
  // Generate sample rows
  const pages = ['/dashboard', '/patients', '/clinical', '/reports', '/scheduling'];
  const userAgents = ['Chrome 91', 'Firefox 89', 'Safari 14', 'Edge 91'];
  
  for (let i = 0; i < 50; i++) {
    const timestamp = new Date(Date.now() - Math.random() * 86400000).toISOString(); // Last 24h
    const page = pages[Math.floor(Math.random() * pages.length)];
    const lcp = Math.round(2000 + Math.random() * 1500);
    const fcp = Math.round(1500 + Math.random() * 1000);
    const cls = Math.round((Math.random() * 0.3) * 1000) / 1000;
    const fid = Math.round(Math.random() * 200);
    const score = Math.round(60 + Math.random() * 40);
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    rows.push([timestamp, page, lcp, fcp, cls, fid, score, userAgent]);
  }

  return { columns, rows };
}

/**
 * Handle annotation queries for performance events
 */
async function handleAnnotationQuery(target: any, range: any): Promise<GrafanaAnnotation[]> {
  const { from, to } = range;
  const annotations: GrafanaAnnotation[] = [];

  // Sample performance events
  const events = [
    {
      time: Date.now() - 3600000, // 1 hour ago
      title: 'Performance Alert',
      text: 'LCP exceeded 4s threshold on /patients page',
      tags: ['performance', 'lcp', 'alert']
    },
    {
      time: Date.now() - 7200000, // 2 hours ago
      title: 'Deployment',
      text: 'Frontend optimization deployment completed',
      tags: ['deployment', 'optimization']
    },
    {
      time: Date.now() - 14400000, // 4 hours ago
      title: 'Cache Optimization',
      text: 'Service worker cache strategy updated',
      tags: ['cache', 'optimization']
    }
  ];

  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();

  events.forEach(event => {
    if (event.time >= fromTime && event.time <= toTime) {
      annotations.push(event);
    }
  });

  return annotations;
}

/**
 * Search endpoint for Grafana metric discovery
 */
export async function OPTIONS() {
  const metrics = [
    'lcp',
    'fcp', 
    'cls',
    'fid',
    'ttfb',
    'load_time',
    'bundle_size',
    'memory_usage',
    'cache_hit_rate',
    'performance_score',
    'page_views',
    'error_rate'
  ];

  return NextResponse.json(metrics);
}