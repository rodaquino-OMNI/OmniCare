#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Build performance analysis script for OmniCare backend
 * Monitors build times, output sizes, and identifies optimization opportunities
 */

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDirectorySize(dirPath) {
  try {
    const result = execSync(`du -sb "${dirPath}" 2>/dev/null | cut -f1`).toString().trim();
    return parseInt(result, 10) || 0;
  } catch (error) {
    return 0;
  }
}

function getFileCount(dirPath, extension = '') {
  try {
    const pattern = extension ? `*.${extension}` : '*';
    const result = execSync(`find "${dirPath}" -name "${pattern}" -type f | wc -l`).toString().trim();
    return parseInt(result, 10) || 0;
  } catch (error) {
    return 0;
  }
}

function analyzeBuildPerformance() {
  console.log('⚡ Backend Build Performance Analysis\n');
  console.log('='.repeat(60));

  const distDir = './dist';
  const srcDir = './src';

  if (!fs.existsSync(distDir)) {
    console.error('❌ Build directory not found. Run npm run build first.');
    process.exit(1);
  }

  // Build metrics
  const buildStats = {
    timestamp: new Date().toISOString(),
    source: {
      size: getDirectorySize(srcDir),
      files: {
        total: getFileCount(srcDir),
        typescript: getFileCount(srcDir, 'ts'),
        javascript: getFileCount(srcDir, 'js'),
        json: getFileCount(srcDir, 'json'),
      }
    },
    output: {
      size: getDirectorySize(distDir),
      files: {
        total: getFileCount(distDir),
        javascript: getFileCount(distDir, 'js'),
        maps: getFileCount(distDir, 'map'),
        declarations: getFileCount(distDir, 'd.ts'),
      }
    }
  };

  // Calculate compression ratio
  const compressionRatio = buildStats.source.size > 0 
    ? ((buildStats.source.size - buildStats.output.size) / buildStats.source.size * 100).toFixed(2)
    : 0;

  console.log('📊 Build Statistics:');
  console.log('-'.repeat(60));
  console.log(`Source Directory Size: ${formatBytes(buildStats.source.size)}`);
  console.log(`Output Directory Size: ${formatBytes(buildStats.output.size)}`);
  console.log(`Compression Ratio: ${compressionRatio}%`);
  
  console.log('\n📄 File Counts:');
  console.log('-'.repeat(60));
  console.log(`Source Files:`);
  console.log(`  Total: ${buildStats.source.files.total}`);
  console.log(`  TypeScript: ${buildStats.source.files.typescript}`);
  console.log(`  JavaScript: ${buildStats.source.files.javascript}`);
  console.log(`  JSON: ${buildStats.source.files.json}`);
  
  console.log(`\nOutput Files:`);
  console.log(`  Total: ${buildStats.output.files.total}`);
  console.log(`  JavaScript: ${buildStats.output.files.javascript}`);
  console.log(`  Source Maps: ${buildStats.output.files.maps}`);
  console.log(`  Type Declarations: ${buildStats.output.files.declarations}`);

  // Analyze large files
  console.log('\n🔍 Large Files Analysis:');
  console.log('-'.repeat(60));
  
  try {
    const largeFiles = execSync(`find ${distDir} -name "*.js" -size +50k -exec ls -lh {} \\; | sort -k5 -hr | head -10`)
      .toString()
      .trim()
      .split('\n')
      .filter(line => line.length > 0);

    if (largeFiles.length > 0) {
      console.log('Top 10 largest JavaScript files:');
      largeFiles.forEach((file, index) => {
        const parts = file.split(/\s+/);
        const size = parts[4];
        const name = parts[parts.length - 1].replace('./dist/', '');
        console.log(`  ${index + 1}. ${name} (${size})`);
      });
    } else {
      console.log('✅ No large files detected (>50KB)');
    }
  } catch (error) {
    console.log('⚠️  Could not analyze large files');
  }

  // Dependencies analysis
  console.log('\n📦 Dependencies Impact:');
  console.log('-'.repeat(60));

  try {
    // Analyze node_modules size impact on final bundle
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const dependencies = Object.keys(packageJson.dependencies || {});
    const devDependencies = Object.keys(packageJson.devDependencies || {});

    console.log(`Production Dependencies: ${dependencies.length}`);
    console.log(`Development Dependencies: ${devDependencies.length}`);

    // Check for common large dependencies
    const heavyDependencies = [
      '@medplum/core',
      '@medplum/fhirtypes',
      'typeorm',
      'express',
      'winston',
      'joi',
      'bcryptjs'
    ];

    const foundHeavyDeps = dependencies.filter(dep => 
      heavyDependencies.some(heavy => dep.includes(heavy))
    );

    if (foundHeavyDeps.length > 0) {
      console.log('Heavy dependencies detected:');
      foundHeavyDeps.forEach(dep => {
        console.log(`  • ${dep}`);
      });
    }
  } catch (error) {
    console.log('⚠️  Could not analyze dependencies');
  }

  // Performance recommendations
  console.log('\n💡 Optimization Recommendations:');
  console.log('-'.repeat(60));

  const recommendations = [];

  if (buildStats.output.size > 100 * 1024 * 1024) { // 100MB
    recommendations.push('🔧 Consider removing unused dependencies');
    recommendations.push('🔧 Enable tree shaking for ES modules');
  }

  if (buildStats.output.files.maps > 0) {
    recommendations.push('🗺️  Remove source maps in production builds');
  }

  if (buildStats.output.files.declarations > buildStats.output.files.javascript) {
    recommendations.push('📝 Consider removing TypeScript declarations in production');
  }

  if (compressionRatio < 10) {
    recommendations.push('📦 Enable build-time minification');
    recommendations.push('📦 Remove development code in production');
  }

  if (recommendations.length > 0) {
    recommendations.forEach(rec => console.log(`  ${rec}`));
  } else {
    console.log('✅ Build is well-optimized!');
  }

  // Performance benchmarks
  console.log('\n⏱️  Performance Benchmarks:');
  console.log('-'.repeat(60));

  const performanceThresholds = {
    buildSize: {
      excellent: 50 * 1024 * 1024,  // 50MB
      good: 100 * 1024 * 1024,      // 100MB
      warning: 200 * 1024 * 1024,   // 200MB
    },
    fileCount: {
      excellent: 500,
      good: 1000,
      warning: 2000,
    }
  };

  function getPerformanceRating(value, thresholds) {
    if (value <= thresholds.excellent) return { rating: 'Excellent', emoji: '🟢' };
    if (value <= thresholds.good) return { rating: 'Good', emoji: '🟡' };
    if (value <= thresholds.warning) return { rating: 'Warning', emoji: '🟠' };
    return { rating: 'Poor', emoji: '🔴' };
  }

  const sizeRating = getPerformanceRating(buildStats.output.size, performanceThresholds.buildSize);
  const fileRating = getPerformanceRating(buildStats.output.files.total, performanceThresholds.fileCount);

  console.log(`Build Size: ${sizeRating.emoji} ${sizeRating.rating} (${formatBytes(buildStats.output.size)})`);
  console.log(`File Count: ${fileRating.emoji} ${fileRating.rating} (${buildStats.output.files.total})`);

  // Save performance report
  const performanceReport = {
    ...buildStats,
    performance: {
      compressionRatio: parseFloat(compressionRatio),
      ratings: {
        buildSize: sizeRating,
        fileCount: fileRating,
      },
      recommendations,
    }
  };

  fs.writeFileSync('./build-performance.json', JSON.stringify(performanceReport, null, 2));
  console.log('\n📄 Performance report saved to build-performance.json');

  // Determine exit status
  const hasWarnings = sizeRating.rating === 'Warning' || fileRating.rating === 'Warning';
  const hasErrors = sizeRating.rating === 'Poor' || fileRating.rating === 'Poor';

  if (hasErrors) {
    console.log('\n❌ Build performance check FAILED');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('\n⚠️  Build performance check PASSED with warnings');
    process.exit(0);
  } else {
    console.log('\n✅ Build performance check PASSED');
    process.exit(0);
  }
}

// Run the analysis
analyzeBuildPerformance();