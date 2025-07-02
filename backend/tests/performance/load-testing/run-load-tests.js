#!/usr/bin/env node
/**
 * OmniCare EMR Backend - Load Testing Runner
 * Executes comprehensive load tests and generates performance reports
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class LoadTestRunner {
  constructor() {
    this.resultsDir = path.join(__dirname, '../results');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.testConfig = path.join(__dirname, 'load-test.config.js');
    
    // Ensure results directory exists
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  /**
   * Run load tests with Artillery
   */
  async runLoadTests() {
    console.log('🚀 Starting OmniCare EMR Load Tests...');
    console.log(`📁 Results will be saved to: ${this.resultsDir}`);
    
    const reportFile = path.join(this.resultsDir, `load-test-${this.timestamp}.json`);
    const htmlReport = path.join(this.resultsDir, `load-test-${this.timestamp}.html`);
    
    try {
      // Check if Artillery is installed
      try {
        execSync('npx artillery version', { stdio: 'ignore' });
      } catch (error) {
        console.error('❌ Artillery not found. Installing...');
        execSync('npm install -g artillery@latest', { stdio: 'inherit' });
      }
      
      // Run the load test
      console.log('🔥 Executing load test scenarios...');
      const artilleryCmd = [
        'npx', 'artillery', 'run',
        '--output', reportFile,
        this.testConfig
      ];
      
      const testProcess = spawn(artilleryCmd[0], artilleryCmd.slice(1), {
        stdio: 'inherit',
        env: {
          ...process.env,
          LOAD_TEST_TARGET: process.env.LOAD_TEST_TARGET || 'http://localhost:8080'
        }
      });
      
      await new Promise((resolve, reject) => {
        testProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Load test failed with code ${code}`));
          }
        });
      });
      
      // Generate HTML report
      if (fs.existsSync(reportFile)) {
        console.log('📊 Generating HTML report...');
        execSync(`npx artillery report --output ${htmlReport} ${reportFile}`, { stdio: 'inherit' });
      }
      
      // Analyze results
      await this.analyzeResults(reportFile);
      
      console.log('✅ Load testing completed successfully!');
      console.log(`📈 HTML Report: ${htmlReport}`);
      console.log(`📋 JSON Report: ${reportFile}`);
      
    } catch (error) {
      console.error('❌ Load testing failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Analyze load test results
   */
  async analyzeResults(reportFile) {
    if (!fs.existsSync(reportFile)) {
      console.warn('⚠️  No results file found for analysis');
      return;
    }
    
    try {
      const results = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
      const aggregate = results.aggregate;
      
      console.log('\n📊 Load Test Results Summary:');
      console.log('================================');
      
      // Response time metrics
      console.log(`⏱️  Response Times:`);
      console.log(`   • Mean: ${aggregate.latency?.mean || 'N/A'}ms`);
      console.log(`   • P50:  ${aggregate.latency?.p50 || 'N/A'}ms`);
      console.log(`   • P95:  ${aggregate.latency?.p95 || 'N/A'}ms`);
      console.log(`   • P99:  ${aggregate.latency?.p99 || 'N/A'}ms`);
      console.log(`   • Max:  ${aggregate.latency?.max || 'N/A'}ms`);
      
      // Request metrics
      console.log(`\n📊 Request Metrics:`);
      console.log(`   • Total Requests: ${aggregate.requestsCompleted || 0}`);
      console.log(`   • Requests/sec:   ${aggregate.rps?.mean || 'N/A'}`);
      console.log(`   • Success Rate:   ${this.calculateSuccessRate(aggregate)}%`);
      
      // Error metrics
      if (aggregate.errors) {
        console.log(`\n❌ Errors:`);
        Object.entries(aggregate.errors).forEach(([error, count]) => {
          console.log(`   • ${error}: ${count}`);
        });
      }
      
      // Performance thresholds check
      console.log(`\n🎯 Performance Targets:`);
      const p95Target = 200;
      const p95Actual = aggregate.latency?.p95 || 999999;
      const p95Status = p95Actual <= p95Target ? '✅' : '❌';
      console.log(`   • P95 < ${p95Target}ms: ${p95Status} (${p95Actual}ms)`);
      
      const successRate = this.calculateSuccessRate(aggregate);
      const successTarget = 95;
      const successStatus = successRate >= successTarget ? '✅' : '❌';
      console.log(`   • Success Rate > ${successTarget}%: ${successStatus} (${successRate}%)`);
      
      // Cache performance (if available)
      if (results.phases) {
        console.log(`\n🏪 Cache Performance:`);
        // This would require custom metrics from the load test
        console.log(`   • Cache metrics available in detailed report`);
      }
      
      // Save analysis summary
      const analysis = {
        timestamp: this.timestamp,
        summary: {
          responseTime: {
            mean: aggregate.latency?.mean,
            p50: aggregate.latency?.p50,
            p95: aggregate.latency?.p95,
            p99: aggregate.latency?.p99,
            max: aggregate.latency?.max
          },
          requests: {
            total: aggregate.requestsCompleted,
            rps: aggregate.rps?.mean,
            successRate: successRate
          },
          targets: {
            p95Under200ms: p95Actual <= p95Target,
            successRateOver95: successRate >= successTarget
          }
        }
      };
      
      const analysisFile = path.join(this.resultsDir, `analysis-${this.timestamp}.json`);
      fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
      console.log(`\n💾 Analysis saved to: ${analysisFile}`);
      
    } catch (error) {
      console.error('❌ Failed to analyze results:', error.message);
    }
  }

  /**
   * Calculate success rate from aggregate metrics
   */
  calculateSuccessRate(aggregate) {
    const total = aggregate.requestsCompleted || 0;
    const errors = Object.values(aggregate.errors || {}).reduce((sum, count) => sum + count, 0);
    const successful = total - errors;
    return total > 0 ? Math.round((successful / total) * 100 * 100) / 100 : 0;
  }

  /**
   * Run stress tests (higher load)
   */
  async runStressTests() {
    console.log('🔥 Starting stress tests...');
    
    // Modify config for stress testing
    const stressConfig = require(this.testConfig);
    stressConfig.phases = [
      { duration: '1m', arrivalRate: 1, rampTo: 50, name: 'stress-rampup' },
      { duration: '3m', arrivalRate: 50, rampTo: 100, name: 'stress-sustained' },
      { duration: '1m', arrivalRate: 100, rampTo: 1, name: 'stress-cooldown' }
    ];
    
    const stressConfigFile = path.join(__dirname, 'stress-test.config.js');
    fs.writeFileSync(stressConfigFile, `module.exports = ${JSON.stringify(stressConfig, null, 2)};`);
    
    const reportFile = path.join(this.resultsDir, `stress-test-${this.timestamp}.json`);
    
    try {
      execSync(`npx artillery run --output ${reportFile} ${stressConfigFile}`, { stdio: 'inherit' });
      await this.analyzeResults(reportFile);
      
      // Cleanup temp config
      fs.unlinkSync(stressConfigFile);
      
    } catch (error) {
      console.error('❌ Stress testing failed:', error.message);
    }
  }
}

// CLI interface
if (require.main === module) {
  const runner = new LoadTestRunner();
  
  const command = process.argv[2] || 'load';
  
  switch (command) {
    case 'load':
      runner.runLoadTests();
      break;
    case 'stress':
      runner.runStressTests();
      break;
    case 'both':
      runner.runLoadTests().then(() => runner.runStressTests());
      break;
    default:
      console.log('Usage: node run-load-tests.js [load|stress|both]');
      process.exit(1);
  }
}

module.exports = LoadTestRunner;
