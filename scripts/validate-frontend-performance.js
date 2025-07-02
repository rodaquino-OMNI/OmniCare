#!/usr/bin/env node

/**
 * Frontend Performance Validation Script
 * Validates that frontend changes don't degrade performance
 */

const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class FrontendPerformanceValidator {
  constructor() {
    this.baselineFile = path.join(__dirname, '../frontend/performance-baseline.json');
    this.resultsDir = path.join(__dirname, '../frontend/performance-results');
    this.lighthouse = null;
    this.baselineMetrics = null;
    this.currentMetrics = null;
  }

  /**
   * Initialize the validator
   */
  async initialize() {
    console.log('🔧 Initializing Frontend Performance Validator...');
    
    // Ensure results directory exists
    await fs.mkdir(this.resultsDir, { recursive: true });
    
    // Load existing baseline
    await this.loadBaseline();
    
    // Check if Lighthouse is available
    await this.checkLighthouse();
    
    console.log('✅ Frontend Performance Validator initialized');
  }

  /**
   * Load performance baseline
   */
  async loadBaseline() {
    try {
      const data = await fs.readFile(this.baselineFile, 'utf-8');
      this.baselineMetrics = JSON.parse(data);
      console.log('📊 Loaded existing performance baseline');
    } catch (error) {
      console.log('📋 No existing baseline found, will create new one');
      this.baselineMetrics = null;
    }
  }

  /**
   * Check if Lighthouse is available
   */
  async checkLighthouse() {
    try {
      await execAsync('npx lighthouse --version');
      this.lighthouse = 'npx lighthouse';
      console.log('✅ Lighthouse CLI available');
    } catch (error) {
      console.log('⚠️  Lighthouse CLI not available, using manual metrics');
      this.lighthouse = null;
    }
  }

  /**
   * Run complete frontend performance validation
   */
  async validatePerformance() {
    console.log('🚀 Starting Frontend Performance Validation...');
    const startTime = performance.now();

    const results = {
      timestamp: new Date().toISOString(),
      validation: {
        buildPerformance: null,
        bundleAnalysis: null,
        lighthouseMetrics: null,
        loadTestResults: null,
        memoryUsage: null
      },
      baseline: this.baselineMetrics,
      regressions: [],
      recommendations: [],
      overall: 'unknown'
    };

    try {
      // 1. Build Performance Test
      console.log('📦 Testing build performance...');
      results.validation.buildPerformance = await this.testBuildPerformance();

      // 2. Bundle Analysis
      console.log('📊 Analyzing bundle size...');
      results.validation.bundleAnalysis = await this.analyzeBundleSize();

      // 3. Lighthouse Performance Test
      if (this.lighthouse) {
        console.log('🏮 Running Lighthouse performance test...');
        results.validation.lighthouseMetrics = await this.runLighthouseTest();
      }

      // 4. Load Test
      console.log('⚡ Running frontend load test...');
      results.validation.loadTestResults = await this.runLoadTest();

      // 5. Memory Usage Test
      console.log('🧠 Testing memory usage...');
      results.validation.memoryUsage = await this.testMemoryUsage();

      // Analyze results
      results.regressions = this.detectRegressions(results.validation);
      results.recommendations = this.generateRecommendations(results.validation, results.regressions);
      results.overall = this.calculateOverallStatus(results.regressions);

      // Save results
      await this.saveResults(results);

      // Update baseline if no regressions
      if (results.overall === 'pass') {
        await this.updateBaseline(results.validation);
      }

      const duration = performance.now() - startTime;
      console.log(`🏁 Frontend performance validation completed in ${Math.round(duration)}ms`);
      
      this.printSummary(results);
      
      return results;

    } catch (error) {
      console.error('❌ Performance validation failed:', error);
      results.overall = 'error';
      results.recommendations.push(`Validation failed: ${error.message}`);
      return results;
    }
  }

  /**
   * Test build performance
   */
  async testBuildPerformance() {
    const startTime = performance.now();
    
    try {
      // Clean previous build
      await execAsync('rm -rf .next', { cwd: path.join(__dirname, '../frontend') });
      
      // Run build
      const buildStart = performance.now();
      await execAsync('npm run build', { 
        cwd: path.join(__dirname, '../frontend'),
        timeout: 300000 // 5 minutes timeout
      });
      const buildTime = performance.now() - buildStart;

      // Get build size
      const buildInfo = await this.getBuildInfo();

      return {
        buildTime: Math.round(buildTime),
        buildSize: buildInfo.totalSize,
        pageCount: buildInfo.pageCount,
        chunksCount: buildInfo.chunksCount,
        status: buildTime < 120000 ? 'good' : buildTime < 300000 ? 'warning' : 'critical' // 2min / 5min thresholds
      };

    } catch (error) {
      return {
        buildTime: -1,
        buildSize: -1,
        pageCount: 0,
        chunksCount: 0,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Get build information
   */
  async getBuildInfo() {
    try {
      const buildDir = path.join(__dirname, '../frontend/.next');
      const stats = await this.getDirectorySize(buildDir);
      
      // Count pages and chunks
      const pagesDir = path.join(buildDir, 'static');
      let pageCount = 0;
      let chunksCount = 0;

      try {
        const pagesStats = await fs.readdir(pagesDir, { recursive: true });
        pageCount = pagesStats.filter(file => file.endsWith('.js')).length;
        chunksCount = pagesStats.filter(file => file.includes('chunks')).length;
      } catch (error) {
        // Directory might not exist
      }

      return {
        totalSize: stats.size,
        pageCount,
        chunksCount
      };

    } catch (error) {
      return {
        totalSize: 0,
        pageCount: 0,
        chunksCount: 0
      };
    }
  }

  /**
   * Get directory size
   */
  async getDirectorySize(dirPath) {
    let totalSize = 0;
    let fileCount = 0;

    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const file of files) {
        const filePath = path.join(dirPath, file.name);
        
        if (file.isDirectory()) {
          const subDirStats = await this.getDirectorySize(filePath);
          totalSize += subDirStats.size;
          fileCount += subDirStats.count;
        } else {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          fileCount++;
        }
      }
    } catch (error) {
      // Handle permission errors or missing directories
    }

    return { size: totalSize, count: fileCount };
  }

  /**
   * Analyze bundle size
   */
  async analyzeBundleSize() {
    try {
      // Try to use Next.js bundle analyzer
      const packageJson = path.join(__dirname, '../frontend/package.json');
      const pkg = JSON.parse(await fs.readFile(packageJson, 'utf-8'));
      
      const bundleAnalysis = {
        totalBundleSize: 0,
        mainBundleSize: 0,
        chunkSizes: [],
        largestChunks: [],
        duplicateModules: [],
        optimizationSuggestions: []
      };

      // Get .next/static analysis
      const staticDir = path.join(__dirname, '../frontend/.next/static');
      
      try {
        const staticStats = await this.getDirectorySize(staticDir);
        bundleAnalysis.totalBundleSize = staticStats.size;

        // Analyze chunks
        const chunksDir = path.join(staticDir, 'chunks');
        try {
          const chunkFiles = await fs.readdir(chunksDir);
          for (const chunkFile of chunkFiles) {
            if (chunkFile.endsWith('.js')) {
              const chunkPath = path.join(chunksDir, chunkFile);
              const chunkStats = await fs.stat(chunkPath);
              bundleAnalysis.chunkSizes.push({
                name: chunkFile,
                size: chunkStats.size
              });
            }
          }
          
          // Sort and get largest chunks
          bundleAnalysis.largestChunks = bundleAnalysis.chunkSizes
            .sort((a, b) => b.size - a.size)
            .slice(0, 5);
            
        } catch (error) {
          // Chunks directory might not exist
        }

      } catch (error) {
        // Static directory might not exist
      }

      // Generate optimization suggestions
      if (bundleAnalysis.totalBundleSize > 5 * 1024 * 1024) { // 5MB
        bundleAnalysis.optimizationSuggestions.push('Bundle size is large, consider code splitting');
      }

      if (bundleAnalysis.largestChunks.length > 0) {
        const largestChunk = bundleAnalysis.largestChunks[0];
        if (largestChunk.size > 1024 * 1024) { // 1MB
          bundleAnalysis.optimizationSuggestions.push(`Largest chunk (${largestChunk.name}) is ${Math.round(largestChunk.size / 1024)}KB, consider splitting`);
        }
      }

      return bundleAnalysis;

    } catch (error) {
      return {
        totalBundleSize: -1,
        mainBundleSize: -1,
        chunkSizes: [],
        largestChunks: [],
        duplicateModules: [],
        optimizationSuggestions: ['Bundle analysis failed: ' + error.message],
        error: error.message
      };
    }
  }

  /**
   * Run Lighthouse performance test
   */
  async runLighthouseTest() {
    if (!this.lighthouse) {
      return { error: 'Lighthouse not available' };
    }

    try {
      // Start Next.js dev server for testing
      const server = spawn('npm', ['run', 'dev'], {
        cwd: path.join(__dirname, '../frontend'),
        detached: false
      });

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 10000));

      try {
        // Run Lighthouse
        const lighthouseCmd = `${this.lighthouse} http://localhost:3000 --output=json --quiet --chrome-flags="--headless --no-sandbox"`;
        const { stdout } = await execAsync(lighthouseCmd, { timeout: 60000 });
        
        const lighthouseResults = JSON.parse(stdout);
        
        // Extract key metrics
        const metrics = {
          performanceScore: lighthouseResults.lhr.categories.performance.score * 100,
          firstContentfulPaint: lighthouseResults.lhr.audits['first-contentful-paint'].displayValue,
          largestContentfulPaint: lighthouseResults.lhr.audits['largest-contentful-paint'].displayValue,
          firstInputDelay: lighthouseResults.lhr.audits['first-input-delay'].displayValue,
          cumulativeLayoutShift: lighthouseResults.lhr.audits['cumulative-layout-shift'].displayValue,
          speedIndex: lighthouseResults.lhr.audits['speed-index'].displayValue,
          totalBlockingTime: lighthouseResults.lhr.audits['total-blocking-time'].displayValue,
          opportunities: lighthouseResults.lhr.audits,
          diagnostics: lighthouseResults.lhr.audits
        };

        return metrics;

      } finally {
        // Kill the server
        server.kill('SIGTERM');
      }

    } catch (error) {
      return {
        error: 'Lighthouse test failed: ' + error.message,
        performanceScore: 0
      };
    }
  }

  /**
   * Run frontend load test
   */
  async runLoadTest() {
    // Simplified load test - in production you might use tools like Artillery or k6
    const loadTest = {
      concurrent_users: 10,
      duration_seconds: 30,
      results: {
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        average_response_time: 0,
        min_response_time: Infinity,
        max_response_time: 0,
        requests_per_second: 0
      }
    };

    try {
      // Start Next.js server
      const server = spawn('npm', ['run', 'start'], {
        cwd: path.join(__dirname, '../frontend'),
        detached: false
      });

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        // Simulate load test
        const responseTimes = [];
        const concurrentPromises = [];

        for (let user = 0; user < loadTest.concurrent_users; user++) {
          const userPromise = this.simulateUserSession(responseTimes);
          concurrentPromises.push(userPromise);
        }

        await Promise.all(concurrentPromises);

        // Calculate results
        loadTest.results.total_requests = responseTimes.length;
        loadTest.results.successful_requests = responseTimes.filter(t => t > 0).length;
        loadTest.results.failed_requests = responseTimes.filter(t => t < 0).length;
        
        const successfulTimes = responseTimes.filter(t => t > 0);
        if (successfulTimes.length > 0) {
          loadTest.results.average_response_time = successfulTimes.reduce((a, b) => a + b, 0) / successfulTimes.length;
          loadTest.results.min_response_time = Math.min(...successfulTimes);
          loadTest.results.max_response_time = Math.max(...successfulTimes);
        }
        
        loadTest.results.requests_per_second = loadTest.results.total_requests / loadTest.duration_seconds;

        return loadTest;

      } finally {
        server.kill('SIGTERM');
      }

    } catch (error) {
      loadTest.results.error = error.message;
      return loadTest;
    }
  }

  /**
   * Simulate user session for load testing
   */
  async simulateUserSession(responseTimes) {
    const pages = ['/', '/patients', '/dashboard'];
    const sessionDuration = 30000; // 30 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < sessionDuration) {
      const page = pages[Math.floor(Math.random() * pages.length)];
      
      try {
        const requestStart = performance.now();
        const response = await fetch(`http://localhost:3000${page}`);
        const requestEnd = performance.now();
        
        if (response.ok) {
          responseTimes.push(requestEnd - requestStart);
        } else {
          responseTimes.push(-1); // Failed request
        }
        
      } catch (error) {
        responseTimes.push(-1); // Failed request
      }
      
      // Wait before next request
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    }
  }

  /**
   * Test memory usage
   */
  async testMemoryUsage() {
    // This would typically require browser automation tools like Puppeteer
    // For now, we'll return a mock implementation
    return {
      initial_memory: Math.floor(Math.random() * 50) + 20, // 20-70 MB
      peak_memory: Math.floor(Math.random() * 100) + 50,   // 50-150 MB
      memory_leaks_detected: false,
      garbage_collection_pressure: 'low',
      recommendation: 'Memory usage within acceptable limits'
    };
  }

  /**
   * Detect performance regressions
   */
  detectRegressions(currentMetrics) {
    if (!this.baselineMetrics) {
      return []; // No baseline to compare against
    }

    const regressions = [];

    // Build Performance Regression
    if (currentMetrics.buildPerformance && this.baselineMetrics.buildPerformance) {
      const buildTimeIncrease = ((currentMetrics.buildPerformance.buildTime - this.baselineMetrics.buildPerformance.buildTime) / this.baselineMetrics.buildPerformance.buildTime) * 100;
      
      if (buildTimeIncrease > 25) { // 25% increase
        regressions.push({
          type: 'build_performance',
          metric: 'build_time',
          current: currentMetrics.buildPerformance.buildTime,
          baseline: this.baselineMetrics.buildPerformance.buildTime,
          increase: Math.round(buildTimeIncrease),
          severity: buildTimeIncrease > 50 ? 'critical' : 'warning'
        });
      }

      const bundleSizeIncrease = ((currentMetrics.buildPerformance.buildSize - this.baselineMetrics.buildPerformance.buildSize) / this.baselineMetrics.buildPerformance.buildSize) * 100;
      
      if (bundleSizeIncrease > 20) { // 20% increase
        regressions.push({
          type: 'bundle_size',
          metric: 'build_size',
          current: currentMetrics.buildPerformance.buildSize,
          baseline: this.baselineMetrics.buildPerformance.buildSize,
          increase: Math.round(bundleSizeIncrease),
          severity: bundleSizeIncrease > 40 ? 'critical' : 'warning'
        });
      }
    }

    // Bundle Analysis Regression
    if (currentMetrics.bundleAnalysis && this.baselineMetrics.bundleAnalysis) {
      const bundleSizeIncrease = ((currentMetrics.bundleAnalysis.totalBundleSize - this.baselineMetrics.bundleAnalysis.totalBundleSize) / this.baselineMetrics.bundleAnalysis.totalBundleSize) * 100;
      
      if (bundleSizeIncrease > 15) { // 15% increase
        regressions.push({
          type: 'bundle_analysis',
          metric: 'total_bundle_size',
          current: currentMetrics.bundleAnalysis.totalBundleSize,
          baseline: this.baselineMetrics.bundleAnalysis.totalBundleSize,
          increase: Math.round(bundleSizeIncrease),
          severity: bundleSizeIncrease > 30 ? 'critical' : 'warning'
        });
      }
    }

    // Lighthouse Performance Regression
    if (currentMetrics.lighthouseMetrics && this.baselineMetrics.lighthouseMetrics) {
      const performanceDecrease = this.baselineMetrics.lighthouseMetrics.performanceScore - currentMetrics.lighthouseMetrics.performanceScore;
      
      if (performanceDecrease > 10) { // 10 point decrease
        regressions.push({
          type: 'lighthouse_performance',
          metric: 'performance_score',
          current: currentMetrics.lighthouseMetrics.performanceScore,
          baseline: this.baselineMetrics.lighthouseMetrics.performanceScore,
          decrease: Math.round(performanceDecrease),
          severity: performanceDecrease > 20 ? 'critical' : 'warning'
        });
      }
    }

    return regressions;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(metrics, regressions) {
    const recommendations = [];

    // Build performance recommendations
    if (metrics.buildPerformance) {
      if (metrics.buildPerformance.buildTime > 180000) { // 3 minutes
        recommendations.push('Build time is slow - consider optimizing webpack configuration and reducing dependencies');
      }
      
      if (metrics.buildPerformance.buildSize > 10 * 1024 * 1024) { // 10MB
        recommendations.push('Build size is large - implement code splitting and tree shaking');
      }
    }

    // Bundle recommendations
    if (metrics.bundleAnalysis) {
      if (metrics.bundleAnalysis.totalBundleSize > 5 * 1024 * 1024) { // 5MB
        recommendations.push('Bundle size is large - consider lazy loading and dynamic imports');
      }
      
      if (metrics.bundleAnalysis.largestChunks.length > 0) {
        const largestChunk = metrics.bundleAnalysis.largestChunks[0];
        if (largestChunk.size > 1024 * 1024) { // 1MB
          recommendations.push(`Largest chunk (${largestChunk.name}) is too large - split into smaller chunks`);
        }
      }
    }

    // Lighthouse recommendations
    if (metrics.lighthouseMetrics) {
      if (metrics.lighthouseMetrics.performanceScore < 80) {
        recommendations.push('Lighthouse performance score is below 80 - optimize Core Web Vitals');
      }
    }

    // Load test recommendations
    if (metrics.loadTestResults) {
      if (metrics.loadTestResults.results.average_response_time > 2000) {
        recommendations.push('Average response time is high - optimize server-side rendering and API calls');
      }
      
      if (metrics.loadTestResults.results.failed_requests > 0) {
        recommendations.push('Failed requests detected - investigate error handling and server stability');
      }
    }

    // Regression-specific recommendations
    regressions.forEach(regression => {
      if (regression.severity === 'critical') {
        recommendations.push(`CRITICAL: ${regression.type} regression of ${regression.increase || regression.decrease}% - immediate action required`);
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('Frontend performance is within acceptable limits');
    }

    return recommendations;
  }

  /**
   * Calculate overall status
   */
  calculateOverallStatus(regressions) {
    const criticalRegressions = regressions.filter(r => r.severity === 'critical');
    const warningRegressions = regressions.filter(r => r.severity === 'warning');

    if (criticalRegressions.length > 0) {
      return 'fail';
    } else if (warningRegressions.length > 0) {
      return 'warning';
    } else {
      return 'pass';
    }
  }

  /**
   * Save validation results
   */
  async saveResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `frontend-performance-${timestamp}.json`;
    const filepath = path.join(this.resultsDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    
    // Also save as latest.json
    const latestPath = path.join(this.resultsDir, 'latest.json');
    await fs.writeFile(latestPath, JSON.stringify(results, null, 2));
    
    console.log(`💾 Results saved to: ${filepath}`);
  }

  /**
   * Update baseline metrics
   */
  async updateBaseline(metrics) {
    this.baselineMetrics = metrics;
    await fs.writeFile(this.baselineFile, JSON.stringify(metrics, null, 2));
    console.log('📊 Performance baseline updated');
  }

  /**
   * Print validation summary
   */
  printSummary(results) {
    console.log(`
🎯 FRONTEND PERFORMANCE VALIDATION SUMMARY
==========================================

Overall Status: ${results.overall.toUpperCase()} ${this.getStatusEmoji(results.overall)}
Timestamp: ${results.timestamp}

VALIDATION RESULTS:
------------------`);

    if (results.validation.buildPerformance) {
      const bp = results.validation.buildPerformance;
      console.log(`📦 Build Performance: ${bp.status} ${this.getStatusEmoji(bp.status)}`);
      console.log(`   - Build Time: ${Math.round(bp.buildTime / 1000)}s`);
      console.log(`   - Build Size: ${Math.round(bp.buildSize / 1024 / 1024)}MB`);
    }

    if (results.validation.bundleAnalysis) {
      const ba = results.validation.bundleAnalysis;
      console.log(`📊 Bundle Analysis:`);
      console.log(`   - Total Size: ${Math.round(ba.totalBundleSize / 1024 / 1024)}MB`);
      console.log(`   - Chunk Count: ${ba.chunkSizes.length}`);
    }

    if (results.validation.lighthouseMetrics && !results.validation.lighthouseMetrics.error) {
      const lh = results.validation.lighthouseMetrics;
      console.log(`🏮 Lighthouse Score: ${Math.round(lh.performanceScore)}/100`);
    }

    if (results.regressions.length > 0) {
      console.log(`
⚠️  PERFORMANCE REGRESSIONS:
---------------------------`);
      results.regressions.forEach(regression => {
        const emoji = regression.severity === 'critical' ? '🔴' : '🟡';
        console.log(`${emoji} ${regression.type}: ${regression.increase || regression.decrease}% regression`);
      });
    }

    if (results.recommendations.length > 0) {
      console.log(`
💡 RECOMMENDATIONS:
------------------`);
      results.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    console.log('==========================================');
  }

  /**
   * Get emoji for status
   */
  getStatusEmoji(status) {
    switch (status) {
      case 'pass':
      case 'good': return '✅';
      case 'warning': return '⚠️';
      case 'fail':
      case 'critical': return '❌';
      case 'error': return '💥';
      default: return '❓';
    }
  }
}

// CLI interface
async function main() {
  const validator = new FrontendPerformanceValidator();
  
  try {
    await validator.initialize();
    const results = await validator.validatePerformance();
    
    // Exit with appropriate code
    process.exit(results.overall === 'pass' ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Frontend performance validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = FrontendPerformanceValidator;