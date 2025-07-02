#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Comprehensive performance monitoring script for OmniCare
 * Tracks build times, bundle sizes, and performance metrics across builds
 */

const PERFORMANCE_LOG = './performance-history.json';
const PERFORMANCE_THRESHOLDS = {
  buildTime: {
    backend: 120000, // 2 minutes
    frontend: 300000, // 5 minutes
  },
  bundleSize: {
    backend: 100 * 1024 * 1024, // 100MB
    frontend: 5 * 1024 * 1024,   // 5MB
  },
  testTime: {
    unit: 60000,        // 1 minute
    integration: 300000, // 5 minutes
  }
};

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function loadPerformanceHistory() {
  try {
    if (fs.existsSync(PERFORMANCE_LOG)) {
      return JSON.parse(fs.readFileSync(PERFORMANCE_LOG, 'utf8'));
    }
  } catch (error) {
    console.warn('Could not load performance history:', error.message);
  }
  return { builds: [], trends: {} };
}

function savePerformanceHistory(data) {
  try {
    fs.writeFileSync(PERFORMANCE_LOG, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Could not save performance history:', error.message);
  }
}

function measureBuildPerformance(workspace) {
  console.log(`📊 Measuring ${workspace} build performance...`);
  
  const startTime = Date.now();
  
  try {
    // Clean build for accurate measurement
    execSync(`cd ${workspace} && npm run clean`, { stdio: 'pipe' });
    
    // Measure build time
    const buildStart = Date.now();
    execSync(`cd ${workspace} && npm run build:production`, { stdio: 'pipe' });
    const buildTime = Date.now() - buildStart;
    
    // Measure bundle size
    let bundleSize = 0;
    const buildDir = workspace === 'frontend' ? `${workspace}/.next` : `${workspace}/dist`;
    
    if (fs.existsSync(buildDir)) {
      const sizeOutput = execSync(`du -sb "${buildDir}" | cut -f1`).toString().trim();
      bundleSize = parseInt(sizeOutput, 10) || 0;
    }
    
    // Measure test time
    const testStart = Date.now();
    execSync(`cd ${workspace} && npm run test:unit`, { stdio: 'pipe' });
    const testTime = Date.now() - testStart;
    
    return {
      workspace,
      timestamp: new Date().toISOString(),
      buildTime,
      bundleSize,
      testTime,
      totalTime: Date.now() - startTime
    };
    
  } catch (error) {
    console.error(`❌ Error measuring ${workspace} performance:`, error.message);
    return null;
  }
}

function analyzeTrends(history) {
  const trends = {};
  
  ['backend', 'frontend'].forEach(workspace => {
    const workspaceBuilds = history.builds
      .filter(build => build.workspace === workspace)
      .slice(-10); // Last 10 builds
    
    if (workspaceBuilds.length < 2) {
      trends[workspace] = { status: 'insufficient-data' };
      return;
    }
    
    const latest = workspaceBuilds[workspaceBuilds.length - 1];
    const previous = workspaceBuilds[workspaceBuilds.length - 2];
    
    const buildTimeTrend = ((latest.buildTime - previous.buildTime) / previous.buildTime) * 100;
    const bundleSizeTrend = ((latest.bundleSize - previous.bundleSize) / previous.bundleSize) * 100;
    
    trends[workspace] = {
      status: 'analyzed',
      buildTime: {
        current: latest.buildTime,
        change: buildTimeTrend,
        trend: buildTimeTrend > 5 ? 'slower' : buildTimeTrend < -5 ? 'faster' : 'stable'
      },
      bundleSize: {
        current: latest.bundleSize,
        change: bundleSizeTrend,
        trend: bundleSizeTrend > 5 ? 'larger' : bundleSizeTrend < -5 ? 'smaller' : 'stable'
      },
      average: {
        buildTime: workspaceBuilds.reduce((sum, b) => sum + b.buildTime, 0) / workspaceBuilds.length,
        bundleSize: workspaceBuilds.reduce((sum, b) => sum + b.bundleSize, 0) / workspaceBuilds.length
      }
    };
  });
  
  return trends;
}

function generateReport(results, trends) {
  console.log('\n🎯 Performance Monitoring Report');
  console.log('='.repeat(60));
  
  results.forEach(result => {
    if (!result) return;
    
    console.log(`\n📦 ${result.workspace.toUpperCase()} Performance:`);
    console.log('-'.repeat(40));
    
    const thresholds = PERFORMANCE_THRESHOLDS;
    const buildTimeStatus = result.buildTime > thresholds.buildTime[result.workspace] ? '❌' : '✅';
    const bundleSizeStatus = result.bundleSize > thresholds.bundleSize[result.workspace] ? '❌' : '✅';
    
    console.log(`Build Time: ${buildTimeStatus} ${formatTime(result.buildTime)}`);
    console.log(`Bundle Size: ${bundleSizeStatus} ${formatBytes(result.bundleSize)}`);
    console.log(`Test Time: ${formatTime(result.testTime)}`);
    console.log(`Total Time: ${formatTime(result.totalTime)}`);
    
    // Trend analysis
    const trend = trends[result.workspace];
    if (trend && trend.status === 'analyzed') {
      console.log('\n📈 Trends:');
      console.log(`Build Time: ${trend.buildTime.trend} (${trend.buildTime.change > 0 ? '+' : ''}${trend.buildTime.change.toFixed(1)}%)`);
      console.log(`Bundle Size: ${trend.bundleSize.trend} (${trend.bundleSize.change > 0 ? '+' : ''}${trend.bundleSize.change.toFixed(1)}%)`);
      console.log(`Average Build Time: ${formatTime(trend.average.buildTime)}`);
      console.log(`Average Bundle Size: ${formatBytes(trend.average.bundleSize)}`);
    }
  });
  
  // Performance recommendations
  console.log('\n💡 Performance Recommendations:');
  console.log('-'.repeat(60));
  
  const recommendations = [];
  
  results.forEach(result => {
    if (!result) return;
    
    if (result.buildTime > PERFORMANCE_THRESHOLDS.buildTime[result.workspace]) {
      recommendations.push(`🔧 ${result.workspace}: Optimize build time (current: ${formatTime(result.buildTime)})`);
    }
    
    if (result.bundleSize > PERFORMANCE_THRESHOLDS.bundleSize[result.workspace]) {
      recommendations.push(`📦 ${result.workspace}: Reduce bundle size (current: ${formatBytes(result.bundleSize)})`);
    }
    
    const trend = trends[result.workspace];
    if (trend && trend.buildTime.trend === 'slower') {
      recommendations.push(`⚠️  ${result.workspace}: Build time is trending slower`);
    }
    
    if (trend && trend.bundleSize.trend === 'larger') {
      recommendations.push(`⚠️  ${result.workspace}: Bundle size is trending larger`);
    }
  });
  
  if (recommendations.length > 0) {
    recommendations.forEach(rec => console.log(rec));
  } else {
    console.log('✅ All performance metrics are within acceptable ranges!');
  }
  
  // Alert conditions
  const criticalIssues = results.filter(result => 
    result && (
      result.buildTime > PERFORMANCE_THRESHOLDS.buildTime[result.workspace] * 1.5 ||
      result.bundleSize > PERFORMANCE_THRESHOLDS.bundleSize[result.workspace] * 1.5
    )
  );
  
  if (criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL PERFORMANCE ISSUES DETECTED!');
    console.log('Immediate action required for:');
    criticalIssues.forEach(issue => {
      console.log(`  • ${issue.workspace}: Build time or bundle size significantly exceeded`);
    });
  }
}

function main() {
  console.log('🚀 Starting OmniCare Performance Monitoring...\n');
  
  // Load historical data
  const history = loadPerformanceHistory();
  
  // Measure current performance
  const results = [
    measureBuildPerformance('backend'),
    measureBuildPerformance('frontend')
  ].filter(Boolean);
  
  // Add to history
  results.forEach(result => {
    history.builds.push(result);
  });
  
  // Keep only last 50 builds per workspace
  ['backend', 'frontend'].forEach(workspace => {
    const workspaceBuilds = history.builds.filter(build => build.workspace === workspace);
    const recentBuilds = workspaceBuilds.slice(-50);
    history.builds = history.builds.filter(build => build.workspace !== workspace);
    history.builds.push(...recentBuilds);
  });
  
  // Analyze trends
  const trends = analyzeTrends(history);
  history.trends = trends;
  
  // Generate report
  generateReport(results, trends);
  
  // Save updated history
  savePerformanceHistory(history);
  
  // Exit with error code if critical issues found
  const hasCriticalIssues = results.some(result => 
    result.buildTime > PERFORMANCE_THRESHOLDS.buildTime[result.workspace] * 1.5 ||
    result.bundleSize > PERFORMANCE_THRESHOLDS.bundleSize[result.workspace] * 1.5
  );
  
  if (hasCriticalIssues) {
    process.exit(1);
  }
  
  console.log('\n✅ Performance monitoring completed successfully!');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  measureBuildPerformance,
  analyzeTrends,
  generateReport,
  PERFORMANCE_THRESHOLDS
};