#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Bundle size check script for OmniCare frontend
 * Validates bundle sizes against performance budgets
 */

const BUNDLE_LIMITS = {
  // Main bundle limits (in bytes)
  main: 500 * 1024, // 500KB
  vendor: 1000 * 1024, // 1MB
  commons: 200 * 1024, // 200KB
  // Chunk limits
  asyncChunk: 250 * 1024, // 250KB
  // Total limits
  totalJS: 2000 * 1024, // 2MB
  totalCSS: 100 * 1024, // 100KB
};

const WARNINGS = {
  main: 400 * 1024, // 400KB
  vendor: 800 * 1024, // 800KB
  commons: 150 * 1024, // 150KB
  asyncChunk: 200 * 1024, // 200KB
  totalJS: 1500 * 1024, // 1.5MB
  totalCSS: 80 * 1024, // 80KB
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getBundleSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

function getGzipSize(filePath) {
  try {
    const compressed = execSync(`gzip -c "${filePath}" | wc -c`).toString().trim();
    return parseInt(compressed, 10);
  } catch (error) {
    return 0;
  }
}

function analyzeBundles() {
  const buildDir = '.next/static/chunks';
  const cssDir = '.next/static/css';
  
  if (!fs.existsSync(buildDir)) {
    console.error('❌ Build directory not found. Run npm run build first.');
    process.exit(1);
  }

  console.log('📊 Bundle Size Analysis\n');
  console.log('='.repeat(50));

  // Analyze JS bundles
  const jsFiles = fs.readdirSync(buildDir)
    .filter(file => file.endsWith('.js') && !file.endsWith('.map'))
    .map(file => ({
      name: file,
      path: path.join(buildDir, file),
      size: getBundleSize(path.join(buildDir, file)),
      gzipSize: getGzipSize(path.join(buildDir, file))
    }))
    .sort((a, b) => b.size - a.size);

  // Analyze CSS bundles
  let cssFiles = [];
  if (fs.existsSync(cssDir)) {
    cssFiles = fs.readdirSync(cssDir)
      .filter(file => file.endsWith('.css'))
      .map(file => ({
        name: file,
        path: path.join(cssDir, file),
        size: getBundleSize(path.join(cssDir, file)),
        gzipSize: getGzipSize(path.join(cssDir, file))
      }))
      .sort((a, b) => b.size - a.size);
  }

  // Calculate totals
  const totalJS = jsFiles.reduce((sum, file) => sum + file.size, 0);
  const totalCSS = cssFiles.reduce((sum, file) => sum + file.size, 0);
  const totalGzipJS = jsFiles.reduce((sum, file) => sum + file.gzipSize, 0);
  const totalGzipCSS = cssFiles.reduce((sum, file) => sum + file.gzipSize, 0);

  // Report results
  console.log('📄 JavaScript Bundles:');
  console.log('-'.repeat(80));
  console.log('| File | Size | Gzipped | Status |');
  console.log('|------|------|---------|--------|');

  let hasErrors = false;
  let hasWarnings = false;

  jsFiles.forEach(file => {
    const isMain = file.name.includes('main') || file.name.includes('index');
    const isVendor = file.name.includes('vendor') || file.name.includes('node_modules');
    const isCommons = file.name.includes('commons') || file.name.includes('common');
    
    let status = '✅ OK';
    let limit = BUNDLE_LIMITS.asyncChunk;
    let warning = WARNINGS.asyncChunk;

    if (isMain) {
      limit = BUNDLE_LIMITS.main;
      warning = WARNINGS.main;
    } else if (isVendor) {
      limit = BUNDLE_LIMITS.vendor;
      warning = WARNINGS.vendor;
    } else if (isCommons) {
      limit = BUNDLE_LIMITS.commons;
      warning = WARNINGS.commons;
    }

    if (file.size > limit) {
      status = '❌ TOO LARGE';
      hasErrors = true;
    } else if (file.size > warning) {
      status = '⚠️  WARNING';
      hasWarnings = true;
    }

    console.log(`| ${file.name.substring(0, 30).padEnd(30)} | ${formatBytes(file.size).padEnd(8)} | ${formatBytes(file.gzipSize).padEnd(8)} | ${status} |`);
  });

  if (cssFiles.length > 0) {
    console.log('\n🎨 CSS Bundles:');
    console.log('-'.repeat(80));
    console.log('| File | Size | Gzipped | Status |');
    console.log('|------|------|---------|--------|');

    cssFiles.forEach(file => {
      let status = '✅ OK';
      if (file.size > BUNDLE_LIMITS.totalCSS) {
        status = '❌ TOO LARGE';
        hasErrors = true;
      } else if (file.size > WARNINGS.totalCSS) {
        status = '⚠️  WARNING';
        hasWarnings = true;
      }

      console.log(`| ${file.name.substring(0, 30).padEnd(30)} | ${formatBytes(file.size).padEnd(8)} | ${formatBytes(file.gzipSize).padEnd(8)} | ${status} |`);
    });
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log('-'.repeat(50));
  console.log(`Total JS Size: ${formatBytes(totalJS)} (${formatBytes(totalGzipJS)} gzipped)`);
  console.log(`Total CSS Size: ${formatBytes(totalCSS)} (${formatBytes(totalGzipCSS)} gzipped)`);
  console.log(`Total Bundle Size: ${formatBytes(totalJS + totalCSS)} (${formatBytes(totalGzipJS + totalGzipCSS)} gzipped)`);

  // Performance budget check
  console.log('\n🎯 Performance Budget:');
  console.log('-'.repeat(50));
  
  const checkBudget = (name, value, limit, warning) => {
    if (value > limit) {
      console.log(`❌ ${name}: ${formatBytes(value)} > ${formatBytes(limit)} (EXCEEDED)`);
      return 'error';
    } else if (value > warning) {
      console.log(`⚠️  ${name}: ${formatBytes(value)} > ${formatBytes(warning)} (WARNING)`);
      return 'warning';
    } else {
      console.log(`✅ ${name}: ${formatBytes(value)} < ${formatBytes(limit)} (OK)`);
      return 'ok';
    }
  };

  const jsStatus = checkBudget('Total JS', totalJS, BUNDLE_LIMITS.totalJS, WARNINGS.totalJS);
  const cssStatus = checkBudget('Total CSS', totalCSS, BUNDLE_LIMITS.totalCSS, WARNINGS.totalCSS);

  if (jsStatus === 'error' || cssStatus === 'error') {
    hasErrors = true;
  }
  if (jsStatus === 'warning' || cssStatus === 'warning') {
    hasWarnings = true;
  }

  // Performance recommendations
  if (hasErrors || hasWarnings) {
    console.log('\n💡 Optimization Recommendations:');
    console.log('-'.repeat(50));
    
    if (totalJS > WARNINGS.totalJS) {
      console.log('🔧 JavaScript optimizations:');
      console.log('   • Enable tree shaking for unused exports');
      console.log('   • Use dynamic imports for large components');
      console.log('   • Consider splitting vendor bundles further');
      console.log('   • Remove unused dependencies');
    }
    
    if (totalCSS > WARNINGS.totalCSS) {
      console.log('🎨 CSS optimizations:');
      console.log('   • Remove unused CSS with PurgeCSS');
      console.log('   • Use CSS-in-JS for component-specific styles');
      console.log('   • Optimize Mantine theme customizations');
    }

    const largeFiles = jsFiles.filter(f => f.size > WARNINGS.asyncChunk);
    if (largeFiles.length > 0) {
      console.log('📦 Large bundle analysis:');
      largeFiles.forEach(file => {
        console.log(`   • ${file.name}: Consider code splitting or lazy loading`);
      });
    }
  }

  // Save performance report
  const performanceReport = {
    timestamp: new Date().toISOString(),
    bundles: {
      js: jsFiles.map(f => ({ name: f.name, size: f.size, gzipSize: f.gzipSize })),
      css: cssFiles.map(f => ({ name: f.name, size: f.size, gzipSize: f.gzipSize })),
    },
    totals: {
      js: totalJS,
      css: totalCSS,
      jsGzip: totalGzipJS,
      cssGzip: totalGzipCSS,
    },
    budgets: {
      js: { limit: BUNDLE_LIMITS.totalJS, warning: WARNINGS.totalJS, current: totalJS },
      css: { limit: BUNDLE_LIMITS.totalCSS, warning: WARNINGS.totalCSS, current: totalCSS },
    },
    status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'ok'
  };

  fs.writeFileSync('.next/bundle-performance.json', JSON.stringify(performanceReport, null, 2));

  console.log('\n📄 Report saved to .next/bundle-performance.json');

  // Exit codes
  if (hasErrors) {
    console.log('\n❌ Bundle size check FAILED - bundles exceed limits!');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('\n⚠️  Bundle size check PASSED with warnings');
    process.exit(0);
  } else {
    console.log('\n✅ Bundle size check PASSED - all bundles within limits!');
    process.exit(0);
  }
}

// Run the analysis
analyzeBundles();