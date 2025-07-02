# OmniCare Performance Monitoring Deployment Guide

## Overview

This document outlines the complete performance monitoring and testing framework deployment for the OmniCare healthcare EMR system. The framework includes real-time monitoring, automated regression testing, and comprehensive performance validation.

## 🚀 Quick Deployment

### 1. Prerequisites

```bash
# Ensure Node.js 18+ is installed
node --version

# Install dependencies
cd backend && npm install
cd frontend && npm install

# Install global tools (optional but recommended)
npm install -g lighthouse artillery autocannon
```

### 2. Start Performance Monitoring

```bash
# Start backend with performance monitoring
cd backend
npm run dev

# In another terminal, start performance dashboard
open http://localhost:3000/performance-dashboard.html

# Start API monitoring
curl -X POST http://localhost:3000/performance/monitoring/start
```

### 3. Run Performance Tests

```bash
# Run backend performance tests
cd backend
npm run test:performance

# Run performance benchmarks
npm run benchmark

# Validate frontend performance
cd ..
node scripts/validate-frontend-performance.js
```

## 📊 Performance Monitoring Components

### 1. Real-time API Monitoring Service

**Location**: `backend/src/services/api-monitoring.service.ts`

**Features**:
- Request/response time tracking
- Error rate monitoring
- Success rate calculation
- Automatic alerting
- Historical data storage

**Usage**:
```javascript
import { APIMonitoringService } from './services/api-monitoring.service';

const monitor = APIMonitoringService.getInstance();
app.use(monitor.middleware());

// Listen for alerts
monitor.on('alert', (alert) => {
  console.log('Performance Alert:', alert);
});
```

### 2. Performance Dashboard

**Location**: `backend/public/performance-dashboard.html`

**URL**: `http://localhost:3000/performance-dashboard.html`

**Features**:
- Real-time CPU, memory, and database metrics
- Interactive charts and graphs
- Alert management
- FHIR endpoint performance tracking
- System health overview

### 3. Performance Routes API

**Location**: `backend/src/routes/performance.routes.ts`

**Endpoints**:
- `GET /performance/health` - System health check with metrics
- `POST /performance/monitoring/start` - Start monitoring
- `POST /performance/monitoring/stop` - Stop monitoring
- `GET /performance/metrics` - Get current metrics
- `GET /performance/dashboard` - Dashboard data
- `POST /performance/benchmark` - Run benchmarks
- `GET /performance/alerts` - Get active alerts

### 4. Automated Regression Testing

**Location**: `backend/tests/performance/automation/performance-regression-tester.ts`

**Features**:
- Baseline comparison
- Automated test scheduling
- Regression detection
- Performance recommendations
- Historical tracking

**Usage**:
```javascript
import { PerformanceRegressionTester } from './automation/performance-regression-tester';

const tester = new PerformanceRegressionTester(config);
await tester.initialize();

// Run regression tests
const results = await tester.runRegressionTests();

// Schedule regular tests (every 30 minutes)
tester.scheduleRegularTests(30);
```

### 5. Frontend Performance Validation

**Location**: `scripts/validate-frontend-performance.js`

**Features**:
- Build performance testing
- Bundle size analysis
- Lighthouse integration
- Load testing
- Memory usage monitoring

**Usage**:
```bash
# Run validation
node scripts/validate-frontend-performance.js

# In CI/CD pipeline
npm run test:performance:frontend
```

## 🔧 Configuration

### Environment Variables

```bash
# Backend Performance Configuration
PERFORMANCE_MONITORING_ENABLED=true
PERFORMANCE_ALERT_EMAIL=admin@omnicare.com
PERFORMANCE_METRICS_RETENTION_DAYS=30

# Database Performance
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_QUERY_TIMEOUT=30000

# API Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=1000

# Frontend Performance
NEXT_TELEMETRY_DISABLED=1
BUNDLE_ANALYZE=false
```

### Performance Thresholds

```javascript
// Default performance thresholds
const PERFORMANCE_THRESHOLDS = {
  api: {
    responseTime: {
      good: 200,      // < 200ms
      warning: 500,   // 200-500ms
      critical: 2000  // > 2000ms
    },
    errorRate: {
      warning: 1,     // > 1%
      critical: 5     // > 5%
    },
    successRate: {
      warning: 95,    // < 95%
      critical: 90    // < 90%
    }
  },
  system: {
    cpu: {
      warning: 70,    // > 70%
      critical: 90    // > 90%
    },
    memory: {
      warning: 500,   // > 500MB
      critical: 1000  // > 1000MB
    },
    eventLoop: {
      warning: 10,    // > 10ms
      critical: 50    // > 50ms
    }
  },
  database: {
    responseTime: {
      warning: 100,   // > 100ms
      critical: 500   // > 500ms
    },
    connections: {
      warning: 80,    // > 80% of pool
      critical: 95    // > 95% of pool
    }
  }
};
```

## 🎯 Performance Targets

### FHIR API Performance Targets

| Operation | Target Response Time (p95) | Success Rate | Throughput |
|-----------|---------------------------|--------------|------------|
| Patient Search | < 150ms | > 99% | > 500 req/s |
| Patient Creation | < 300ms | > 99% | > 100 req/s |
| Observation Query | < 100ms | > 99.5% | > 800 req/s |
| Encounter Retrieval | < 200ms | > 99% | > 300 req/s |
| Batch Operations | < 2000ms | > 95% | > 50 req/s |

### Database Performance Targets

| Metric | Target | Critical Threshold |
|--------|--------|--------------------|
| Query Response Time | < 50ms (avg) | > 200ms |
| Connection Pool Usage | < 70% | > 90% |
| Index Hit Ratio | > 95% | < 85% |
| Lock Wait Time | < 10ms | > 100ms |
| Replication Lag | < 1s | > 5s |

### Frontend Performance Targets

| Metric | Target | Critical Threshold |
|--------|--------|--------------------|
| First Contentful Paint | < 1.5s | > 3s |
| Largest Contentful Paint | < 2.5s | > 4s |
| First Input Delay | < 100ms | > 300ms |
| Cumulative Layout Shift | < 0.1 | > 0.25 |
| Total Bundle Size | < 2MB | > 5MB |
| Build Time | < 60s | > 180s |

## 📈 Monitoring Setup

### 1. Database Performance Monitoring

```sql
-- Apply performance optimization schema
\i database/schema/04_performance_optimization.sql

-- Enable query statistics collection
ALTER SYSTEM SET track_io_timing = on;
ALTER SYSTEM SET track_functions = 'all';
SELECT pg_reload_conf();

-- Create monitoring user
CREATE USER performance_monitor WITH PASSWORD 'monitor123';
GRANT SELECT ON ALL TABLES IN SCHEMA admin TO performance_monitor;
```

### 2. Application Performance Monitoring

```javascript
// Add to backend/src/index.ts
import { APIMonitoringService } from './services/api-monitoring.service';
import performanceRoutes from './routes/performance.routes';

const monitor = APIMonitoringService.getInstance();

// Add monitoring middleware
app.use(monitor.middleware());

// Add performance routes
app.use('/performance', performanceRoutes);

// Enable static files for dashboard
app.use(express.static('public'));
```

### 3. Frontend Performance Monitoring

```javascript
// Add to frontend/next.config.js
module.exports = {
  experimental: {
    instrumentationHook: true,
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Enable bundle analysis in CI
      if (process.env.ANALYZE === 'true') {
        const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
        config.plugins.push(new BundleAnalyzerPlugin());
      }
    }
    return config;
  },
};
```

## 🚨 Alerting Configuration

### 1. Email Alerts

```javascript
// Configure email alerts for critical performance issues
const alertConfig = {
  email: {
    enabled: true,
    recipients: ['admin@omnicare.com', 'dev-team@omnicare.com'],
    smtp: {
      host: 'smtp.omnicare.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    }
  },
  slack: {
    enabled: true,
    webhook: process.env.SLACK_WEBHOOK_URL,
    channel: '#performance-alerts'
  }
};
```

### 2. Custom Alert Rules

```javascript
// Add custom alert rules
const customRules = [
  {
    name: 'FHIR Patient API Critical Slowdown',
    endpoint: '/fhir/R4/Patient',
    condition: 'response_time',
    operator: 'gt',
    threshold: 1000, // 1 second
    timeWindowMinutes: 2,
    cooldownMinutes: 5
  },
  {
    name: 'High Memory Usage',
    condition: 'memory_usage',
    operator: 'gt',
    threshold: 800, // 800MB
    timeWindowMinutes: 5,
    cooldownMinutes: 10
  }
];

customRules.forEach(rule => monitor.addAlertRule(rule));
```

## 🔄 CI/CD Integration

### 1. GitHub Actions Performance Check

```yaml
# .github/workflows/performance.yml
name: Performance Check
on:
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci
          
      - name: Run performance tests
        run: |
          cd backend && npm run test:performance
          
      - name: Validate frontend performance
        run: node scripts/validate-frontend-performance.js
        
      - name: Upload performance reports
        uses: actions/upload-artifact@v3
        with:
          name: performance-reports
          path: |
            backend/tests/performance/reports/
            frontend/performance-results/
```

### 2. Performance Regression Gates

```javascript
// scripts/performance-gate.js
const PERFORMANCE_GATES = {
  build_time_increase: 25,      // Max 25% increase
  bundle_size_increase: 20,     // Max 20% increase
  lighthouse_score_decrease: 10, // Max 10 point decrease
  api_response_time_increase: 30 // Max 30% increase
};

// Fail CI if performance regression exceeds gates
process.exit(regressionExceedsGate ? 1 : 0);
```

## 📋 Maintenance Tasks

### Daily Tasks

```bash
# Check performance alerts
curl http://localhost:3000/performance/alerts

# Verify monitoring status
curl http://localhost:3000/performance/health

# Review dashboard for anomalies
open http://localhost:3000/performance-dashboard.html
```

### Weekly Tasks

```bash
# Run comprehensive performance regression tests
cd backend/tests/performance/automation
node performance-regression-tester.js

# Clean old performance data
cd backend && npm run performance:cleanup

# Update performance baselines if needed
node scripts/update-performance-baselines.js
```

### Monthly Tasks

```bash
# Analyze performance trends
node scripts/performance-trend-analysis.js

# Update performance thresholds based on system changes
node scripts/update-performance-thresholds.js

# Generate performance report
node scripts/generate-monthly-performance-report.js
```

## 🆘 Troubleshooting

### Common Issues

1. **High Response Times**
   - Check database query performance
   - Review connection pool settings
   - Analyze slow queries in performance logs

2. **Memory Leaks**
   - Monitor heap usage trends
   - Check for unclosed database connections
   - Review event listener cleanup

3. **High CPU Usage**
   - Profile CPU-intensive operations
   - Check for inefficient algorithms
   - Review garbage collection patterns

### Debug Commands

```bash
# Check system resources
htop
iostat -x 1

# Database performance
psql -c "SELECT * FROM pg_stat_activity;"
psql -c "SELECT * FROM admin.query_performance ORDER BY execution_time_ms DESC LIMIT 10;"

# Node.js performance
node --inspect app.js
npm run profile

# Memory analysis
node --expose-gc --trace-gc app.js
```

## 📞 Support

For performance-related issues:

1. Check the performance dashboard first
2. Review recent alerts and recommendations
3. Run performance regression tests
4. Contact the performance team with specific metrics

**Performance Team**: performance@omnicare.com
**Emergency Performance Issues**: Call 1-800-OMNI-PERF

---

**Document Version**: 1.0
**Last Updated**: {{ timestamp }}
**Next Review**: Monthly