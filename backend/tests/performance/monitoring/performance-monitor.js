/**
 * Real-time Performance Monitoring System
 * Monitors system performance during load testing
 */

const pidusage = require('pidusage');
const fs = require('fs').promises;
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.config = {
      interval: 1000, // 1 second
      outputFile: 'performance-metrics.json',
      alertThresholds: {
        cpu: 80,      // CPU percentage
        memory: 1000, // Memory in MB
        responseTime: 5000 // Response time in ms
      }
    };
  }

  /**
   * Start monitoring system performance
   */
  start() {
    if (this.isMonitoring) {
      console.log('Performance monitoring already started');
      return;
    }

    console.log('Starting performance monitoring...');
    this.isMonitoring = true;
    this.metrics = [];

    this.monitoringInterval = setInterval(async () => {
      try {
        const metric = await this.collectMetrics();
        this.metrics.push(metric);
        this.checkAlerts(metric);
        
        // Log summary every 30 seconds
        if (this.metrics.length % 30 === 0) {
          this.logSummary();
        }
      } catch (error) {
        console.error('Error collecting metrics:', error);
      }
    }, this.config.interval);
  }

  /**
   * Stop monitoring and save results
   */
  async stop() {
    if (!this.isMonitoring) {
      console.log('Performance monitoring not started');
      return;
    }

    console.log('Stopping performance monitoring...');
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    await this.saveMetrics();
    this.generateReport();
  }

  /**
   * Collect current system metrics
   */
  async collectMetrics() {
    const pid = process.pid;
    const usage = await pidusage(pid);
    const memUsage = process.memoryUsage();
    
    return {
      timestamp: new Date().toISOString(),
      cpu: {
        usage: usage.cpu,
        system: usage.cpu // pidusage provides combined CPU usage
      },
      memory: {
        rss: memUsage.rss / 1024 / 1024, // MB
        heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
        heapTotal: memUsage.heapTotal / 1024 / 1024, // MB
        external: memUsage.external / 1024 / 1024, // MB
        arrayBuffers: memUsage.arrayBuffers / 1024 / 1024 // MB
      },
      eventLoop: {
        delay: await this.getEventLoopDelay()
      },
      gc: process.memoryUsage && process.memoryUsage.gc ? 
          process.memoryUsage.gc() : null,
      uptime: process.uptime(),
      activeHandles: process._getActiveHandles ? 
                    process._getActiveHandles().length : 0,
      activeRequests: process._getActiveRequests ? 
                     process._getActiveRequests().length : 0
    };
  }

  /**
   * Measure event loop delay
   */
  getEventLoopDelay() {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delta = process.hrtime.bigint() - start;
        resolve(Number(delta) / 1000000); // Convert to milliseconds
      });
    });
  }

  /**
   * Check for performance alerts
   */
  checkAlerts(metric) {
    const alerts = [];

    // CPU usage alert
    if (metric.cpu.usage > this.config.alertThresholds.cpu) {
      alerts.push(`HIGH CPU: ${metric.cpu.usage.toFixed(2)}%`);
    }

    // Memory usage alert
    if (metric.memory.heapUsed > this.config.alertThresholds.memory) {
      alerts.push(`HIGH MEMORY: ${metric.memory.heapUsed.toFixed(2)}MB`);
    }

    // Event loop delay alert
    if (metric.eventLoop.delay > 10) {
      alerts.push(`HIGH EVENT LOOP DELAY: ${metric.eventLoop.delay.toFixed(2)}ms`);
    }

    // Active handles/requests alert
    if (metric.activeHandles > 1000) {
      alerts.push(`HIGH ACTIVE HANDLES: ${metric.activeHandles}`);
    }

    if (alerts.length > 0) {
      console.warn(`⚠️  PERFORMANCE ALERT: ${alerts.join(', ')}`);
    }
  }

  /**
   * Log performance summary
   */
  logSummary() {
    if (this.metrics.length === 0) return;

    const latest = this.metrics[this.metrics.length - 1];
    const avg = this.calculateAverages();

    console.log(`
📊 Performance Summary (${this.metrics.length} samples):
   CPU: ${latest.cpu.usage.toFixed(1)}% (avg: ${avg.cpu.toFixed(1)}%)
   Memory: ${latest.memory.heapUsed.toFixed(1)}MB (avg: ${avg.memory.toFixed(1)}MB)
   Event Loop: ${latest.eventLoop.delay.toFixed(1)}ms (avg: ${avg.eventLoop.toFixed(1)}ms)
   Uptime: ${(latest.uptime / 60).toFixed(1)} minutes
    `);
  }

  /**
   * Calculate average metrics
   */
  calculateAverages() {
    if (this.metrics.length === 0) return {};

    const sums = this.metrics.reduce((acc, metric) => {
      acc.cpu += metric.cpu.usage;
      acc.memory += metric.memory.heapUsed;
      acc.eventLoop += metric.eventLoop.delay;
      return acc;
    }, { cpu: 0, memory: 0, eventLoop: 0 });

    const count = this.metrics.length;
    return {
      cpu: sums.cpu / count,
      memory: sums.memory / count,
      eventLoop: sums.eventLoop / count
    };
  }

  /**
   * Save metrics to file
   */
  async saveMetrics() {
    try {
      const outputPath = path.join(process.cwd(), 'tests/performance/reports', this.config.outputFile);
      const metricsData = {
        testRun: {
          startTime: this.metrics[0]?.timestamp,
          endTime: this.metrics[this.metrics.length - 1]?.timestamp,
          duration: this.metrics.length * (this.config.interval / 1000), // seconds
          sampleCount: this.metrics.length
        },
        averages: this.calculateAverages(),
        peaks: this.calculatePeaks(),
        metrics: this.metrics
      };

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(metricsData, null, 2));
      console.log(`📁 Performance metrics saved to: ${outputPath}`);
    } catch (error) {
      console.error('Error saving metrics:', error);
    }
  }

  /**
   * Calculate peak values
   */
  calculatePeaks() {
    if (this.metrics.length === 0) return {};

    return {
      cpu: Math.max(...this.metrics.map(m => m.cpu.usage)),
      memory: Math.max(...this.metrics.map(m => m.memory.heapUsed)),
      eventLoop: Math.max(...this.metrics.map(m => m.eventLoop.delay)),
      activeHandles: Math.max(...this.metrics.map(m => m.activeHandles)),
      activeRequests: Math.max(...this.metrics.map(m => m.activeRequests))
    };
  }

  /**
   * Generate performance report
   */
  generateReport() {
    if (this.metrics.length === 0) {
      console.log('No metrics collected');
      return;
    }

    const averages = this.calculateAverages();
    const peaks = this.calculatePeaks();
    const duration = this.metrics.length * (this.config.interval / 1000);

    console.log(`
🚀 PERFORMANCE MONITORING REPORT
===============================

Test Duration: ${(duration / 60).toFixed(1)} minutes
Sample Count: ${this.metrics.length}
Sample Interval: ${this.config.interval}ms

RESOURCE USAGE SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━

CPU Usage:
  Average: ${averages.cpu.toFixed(2)}%
  Peak: ${peaks.cpu.toFixed(2)}%
  Status: ${peaks.cpu > 80 ? '❌ HIGH' : peaks.cpu > 60 ? '⚠️  MODERATE' : '✅ NORMAL'}

Memory Usage (Heap):
  Average: ${averages.memory.toFixed(2)}MB
  Peak: ${peaks.memory.toFixed(2)}MB
  Status: ${peaks.memory > 1000 ? '❌ HIGH' : peaks.memory > 500 ? '⚠️  MODERATE' : '✅ NORMAL'}

Event Loop Delay:
  Average: ${averages.eventLoop.toFixed(2)}ms
  Peak: ${peaks.eventLoop.toFixed(2)}ms
  Status: ${peaks.eventLoop > 10 ? '❌ HIGH' : peaks.eventLoop > 5 ? '⚠️  MODERATE' : '✅ NORMAL'}

Node.js Handles:
  Peak Active Handles: ${peaks.activeHandles}
  Peak Active Requests: ${peaks.activeRequests}

RECOMMENDATIONS:
━━━━━━━━━━━━━━━━

${this.generateRecommendations(averages, peaks)}

PERFORMANCE GRADE: ${this.calculateGrade(averages, peaks)}
    `);
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(averages, peaks) {
    const recommendations = [];

    if (peaks.cpu > 80) {
      recommendations.push('• CPU usage is high - consider horizontal scaling or code optimization');
    }

    if (peaks.memory > 1000) {
      recommendations.push('• Memory usage is high - check for memory leaks and optimize data structures');
    }

    if (peaks.eventLoop > 10) {
      recommendations.push('• Event loop delay is high - avoid blocking operations in main thread');
    }

    if (peaks.activeHandles > 1000) {
      recommendations.push('• High number of active handles - review connection pooling and cleanup');
    }

    if (averages.memory > 500 && peaks.memory / averages.memory > 2) {
      recommendations.push('• Memory usage is unstable - check for proper garbage collection');
    }

    if (recommendations.length === 0) {
      recommendations.push('• Performance appears optimal - no immediate concerns detected');
    }

    return recommendations.join('\n');
  }

  /**
   * Calculate overall performance grade
   */
  calculateGrade(averages, peaks) {
    let score = 100;

    // CPU penalty
    if (peaks.cpu > 90) score -= 30;
    else if (peaks.cpu > 80) score -= 20;
    else if (peaks.cpu > 70) score -= 10;

    // Memory penalty
    if (peaks.memory > 1500) score -= 25;
    else if (peaks.memory > 1000) score -= 15;
    else if (peaks.memory > 750) score -= 10;

    // Event loop penalty
    if (peaks.eventLoop > 50) score -= 20;
    else if (peaks.eventLoop > 20) score -= 15;
    else if (peaks.eventLoop > 10) score -= 10;

    // Stability bonus/penalty
    const memoryStability = averages.memory > 0 ? peaks.memory / averages.memory : 1;
    if (memoryStability > 3) score -= 10;
    else if (memoryStability < 1.5) score += 5;

    if (score >= 90) return 'A+ (Excellent)';
    if (score >= 80) return 'A (Very Good)';
    if (score >= 70) return 'B (Good)';
    if (score >= 60) return 'C (Fair)';
    if (score >= 50) return 'D (Poor)';
    return 'F (Critical)';
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  
  console.log('🔍 Performance Monitor Starting...');
  console.log('Press Ctrl+C to stop monitoring and generate report');
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n📊 Generating performance report...');
    await monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await monitor.stop();
    process.exit(0);
  });

  // Start monitoring
  monitor.start();
}

module.exports = PerformanceMonitor;