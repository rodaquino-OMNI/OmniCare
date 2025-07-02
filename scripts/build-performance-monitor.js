#!/usr/bin/env node

/**
 * Build Performance Monitor
 * Tracks and analyzes build performance metrics for OmniCare platform
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BuildPerformanceMonitor {
  constructor() {
    this.configPath = path.join(__dirname, '..', '.build-performance.json');
    this.metricsPath = path.join(__dirname, '..', 'build-metrics.json');
    this.config = this.loadConfig();
    this.metrics = this.loadMetrics();
  }

  loadConfig() {
    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch (error) {
      console.error('Failed to load build performance config:', error.message);
      return this.getDefaultConfig();
    }
  }

  loadMetrics() {
    try {
      return JSON.parse(fs.readFileSync(this.metricsPath, 'utf8'));
    } catch (error) {
      return {
        builds: [],
        averages: {},
        trends: {}
      };
    }
  }

  getDefaultConfig() {
    return {
      metrics: {
        buildTime: { target: 300000, warning: 240000, error: 360000 },
        bundleSize: {
          backend: { target: "50MB", warning: "40MB", error: "60MB" },
          frontend: { target: "5MB", warning: "4MB", error: "6MB" }
        }
      }
    };
  }

  async measureBuildTime(command, workspace = null) {
    const startTime = Date.now();
    const workingDir = workspace ? path.join(__dirname, '..', workspace) : path.join(__dirname, '..');
    
    try {
      console.log(`🔧 Starting build: ${command}${workspace ? ` in ${workspace}` : ''}`);
      execSync(command, { 
        cwd: workingDir, 
        stdio: 'inherit',
        env: { 
          ...process.env, 
          NODE_OPTIONS: '--max-old-space-size=4096' 
        }
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ Build completed in ${duration}ms`);
      return duration;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Build failed after ${duration}ms`);
      throw error;
    }
  }

  getBundleSize(buildPath) {
    try {
      const stats = execSync(`du -sb ${buildPath}`, { encoding: 'utf8' });
      const bytes = parseInt(stats.split('\t')[0]);
      return this.formatBytes(bytes);
    } catch (error) {
      console.warn(`Could not measure bundle size for ${buildPath}`);
      return null;
    }
  }

  formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  parseSize(sizeStr) {
    const match = sizeStr.match(/^([0-9.]+)\s*(B|KB|MB|GB)$/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    
    const multipliers = { b: 1, kb: 1024, mb: 1024*1024, gb: 1024*1024*1024 };
    return value * (multipliers[unit] || 1);
  }

  analyzePerformance(buildTime, bundleSizes) {
    const analysis = {
      buildTime: this.analyzeBuildTime(buildTime),
      bundleSizes: this.analyzeBundleSizes(bundleSizes),
      recommendations: []
    };

    // Generate recommendations
    if (analysis.buildTime.status === 'warning' || analysis.buildTime.status === 'error') {
      analysis.recommendations.push('Consider enabling more aggressive caching');
      analysis.recommendations.push('Review dependencies for optimization opportunities');
    }

    if (analysis.bundleSizes.frontend?.status === 'warning') {
      analysis.recommendations.push('Analyze frontend bundle for code splitting opportunities');
    }

    return analysis;
  }

  analyzeBuildTime(duration) {
    const { target, warning, error } = this.config.metrics.buildTime;
    
    if (duration <= warning) return { status: 'good', message: 'Build time is optimal' };
    if (duration <= target) return { status: 'warning', message: 'Build time is acceptable but could be improved' };
    if (duration <= error) return { status: 'error', message: 'Build time is too slow' };
    return { status: 'critical', message: 'Build time is critically slow' };
  }

  analyzeBundleSizes(sizes) {
    const analysis = {};
    
    for (const [workspace, sizeStr] of Object.entries(sizes)) {
      if (!sizeStr) continue;
      
      const config = this.config.metrics.bundleSize[workspace];
      if (!config) continue;
      
      const size = this.parseSize(sizeStr);
      const warning = this.parseSize(config.warning);
      const target = this.parseSize(config.target);
      const error = this.parseSize(config.error);
      
      if (size <= warning) {
        analysis[workspace] = { status: 'good', message: 'Bundle size is optimal' };
      } else if (size <= target) {
        analysis[workspace] = { status: 'warning', message: 'Bundle size could be optimized' };
      } else if (size <= error) {
        analysis[workspace] = { status: 'error', message: 'Bundle size is too large' };
      } else {
        analysis[workspace] = { status: 'critical', message: 'Bundle size is critically large' };
      }
    }
    
    return analysis;
  }

  recordMetrics(buildTime, bundleSizes, analysis) {
    const buildRecord = {
      timestamp: new Date().toISOString(),
      buildTime,
      bundleSizes,
      analysis,
      commit: process.env.GITHUB_SHA || 'local',
      branch: process.env.GITHUB_REF_NAME || 'local'
    };

    this.metrics.builds.push(buildRecord);
    
    // Keep only last 100 builds
    if (this.metrics.builds.length > 100) {
      this.metrics.builds = this.metrics.builds.slice(-100);
    }

    this.updateAverages();
    this.saveMetrics();
  }

  updateAverages() {
    const recentBuilds = this.metrics.builds.slice(-10);
    
    this.metrics.averages = {
      buildTime: recentBuilds.reduce((sum, b) => sum + b.buildTime, 0) / recentBuilds.length,
      lastUpdated: new Date().toISOString()
    };
  }

  saveMetrics() {
    fs.writeFileSync(this.metricsPath, JSON.stringify(this.metrics, null, 2));
  }

  generateReport() {
    console.log('\n📊 BUILD PERFORMANCE REPORT');
    console.log('═'.repeat(50));
    
    if (this.metrics.builds.length === 0) {
      console.log('No build metrics available');
      return;
    }

    const latest = this.metrics.builds[this.metrics.builds.length - 1];
    
    console.log(`\n🕐 Latest Build Time: ${latest.buildTime}ms`);
    console.log(`📦 Bundle Sizes:`);
    for (const [workspace, size] of Object.entries(latest.bundleSizes)) {
      if (size) console.log(`   ${workspace}: ${size}`);
    }
    
    console.log(`\n📈 Analysis:`);
    console.log(`   Build Time: ${latest.analysis.buildTime.status} - ${latest.analysis.buildTime.message}`);
    
    if (latest.analysis.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      latest.analysis.recommendations.forEach(rec => console.log(`   • ${rec}`));
    }

    if (this.metrics.averages.buildTime) {
      console.log(`\n📊 Average Build Time (last 10): ${Math.round(this.metrics.averages.buildTime)}ms`);
    }
  }

  async runFullAnalysis() {
    console.log('🚀 Starting full build performance analysis...\n');
    
    const bundleSizes = {};
    let totalBuildTime = 0;

    try {
      // Measure backend build
      console.log('Building backend...');
      const backendTime = await this.measureBuildTime('npm run build:production', 'backend');
      totalBuildTime += backendTime;
      bundleSizes.backend = this.getBundleSize(path.join(__dirname, '..', 'backend', 'dist'));

      // Measure frontend build
      console.log('\nBuilding frontend...');
      const frontendTime = await this.measureBuildTime('npm run build:production', 'frontend');
      totalBuildTime += frontendTime;
      bundleSizes.frontend = this.getBundleSize(path.join(__dirname, '..', 'frontend', '.next'));

      // Analyze performance
      const analysis = this.analyzePerformance(totalBuildTime, bundleSizes);
      
      // Record metrics
      this.recordMetrics(totalBuildTime, bundleSizes, analysis);
      
      // Generate report
      this.generateReport();
      
      console.log('\n✅ Performance analysis completed!');
      
    } catch (error) {
      console.error('\n❌ Performance analysis failed:', error.message);
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new BuildPerformanceMonitor();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'analyze':
    case 'run':
      monitor.runFullAnalysis();
      break;
    case 'report':
      monitor.generateReport();
      break;
    case 'help':
    default:
      console.log(`
Build Performance Monitor

Usage:
  node build-performance-monitor.js <command>

Commands:
  analyze    Run full build performance analysis
  report     Show latest performance report
  help       Show this help message

Examples:
  node build-performance-monitor.js analyze
  node build-performance-monitor.js report
      `);
      break;
  }
}

module.exports = BuildPerformanceMonitor;