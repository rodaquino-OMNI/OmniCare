/**
 * Benchmark Runner
 * Automated benchmarking for continuous performance monitoring
 */

const autocannon = require('autocannon');
const fs = require('fs').promises;
const path = require('path');

class BenchmarkRunner {
  constructor() {
    this.baseUrl = process.env.BENCHMARK_URL || 'http://localhost:8080';
    this.outputDir = path.join(__dirname, '..', 'reports');
    this.benchmarks = this.createBenchmarkSuites();
  }

  /**
   * Create benchmark test suites
   */
  createBenchmarkSuites() {
    return {
      healthCheck: {
        name: 'Health Check Endpoint',
        config: {
          url: `${this.baseUrl}/health`,
          connections: 10,
          pipelining: 1,
          duration: 30,
          headers: {
            'User-Agent': 'OmniCare-Benchmark/1.0'
          }
        },
        thresholds: {
          avgLatency: 100,   // ms
          p99Latency: 500,   // ms
          throughput: 1000,  // req/s
          errors: 0.01       // 1% max error rate
        }
      },

      fhirMetadata: {
        name: 'FHIR Metadata Endpoint',
        config: {
          url: `${this.baseUrl}/fhir/R4/metadata`,
          connections: 20,
          pipelining: 1,
          duration: 60,
          headers: {
            'Accept': 'application/fhir+json',
            'User-Agent': 'OmniCare-Benchmark/1.0'
          }
        },
        thresholds: {
          avgLatency: 200,
          p99Latency: 1000,
          throughput: 500,
          errors: 0.02
        }
      },

      patientSearch: {
        name: 'Patient Search Performance',
        config: {
          url: `${this.baseUrl}/fhir/R4/Patient?_count=20&active=true`,
          connections: 15,
          pipelining: 1,
          duration: 120,
          headers: {
            'Authorization': 'Bearer benchmark-token',
            'Accept': 'application/fhir+json',
            'User-Agent': 'OmniCare-Benchmark/1.0'
          }
        },
        thresholds: {
          avgLatency: 500,
          p99Latency: 2000,
          throughput: 100,
          errors: 0.05
        }
      },

      observationCreation: {
        name: 'Observation Creation Performance',
        config: {
          url: `${this.baseUrl}/fhir/R4/Observation`,
          method: 'POST',
          connections: 10,
          pipelining: 1,
          duration: 90,
          headers: {
            'Authorization': 'Bearer benchmark-token',
            'Content-Type': 'application/fhir+json',
            'Accept': 'application/fhir+json',
            'User-Agent': 'OmniCare-Benchmark/1.0'
          },
          body: JSON.stringify({
            resourceType: 'Observation',
            status: 'final',
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8310-5',
                display: 'Body temperature'
              }]
            },
            subject: { reference: 'Patient/benchmark-patient' },
            valueQuantity: {
              value: 98.6,
              unit: '°F',
              system: 'http://unitsofmeasure.org',
              code: '[degF]'
            }
          })
        },
        thresholds: {
          avgLatency: 800,
          p99Latency: 3000,
          throughput: 50,
          errors: 0.05
        }
      },

      analyticsQuery: {
        name: 'Analytics Query Performance',
        config: {
          url: `${this.baseUrl}/analytics/facilities/benchmark-facility/operational-metrics`,
          connections: 8,
          pipelining: 1,
          duration: 60,
          headers: {
            'Authorization': 'Bearer benchmark-token',
            'Accept': 'application/json',
            'User-Agent': 'OmniCare-Benchmark/1.0'
          }
        },
        thresholds: {
          avgLatency: 1000,
          p99Latency: 5000,
          throughput: 20,
          errors: 0.1
        }
      }
    };
  }

  /**
   * Run all benchmarks
   */
  async runAllBenchmarks() {
    console.log('🚀 Starting OmniCare Performance Benchmarks');
    console.log('=' * 50);

    const results = [];
    
    for (const [benchmarkName, benchmark] of Object.entries(this.benchmarks)) {
      console.log(`\n🔬 Running ${benchmark.name}...`);
      
      try {
        const result = await this.runBenchmark(benchmarkName, benchmark);
        results.push(result);
        
        const passed = this.validateThresholds(result, benchmark.thresholds);
        const status = passed ? '✅ PASSED' : '❌ FAILED';
        console.log(`${status} - ${benchmark.name}`);
        
      } catch (error) {
        console.error(`❌ ERROR - ${benchmark.name}: ${error.message}`);
        results.push({
          name: benchmarkName,
          error: error.message,
          passed: false
        });
      }
    }

    // Generate summary report
    await this.generateSummaryReport(results);
    
    return results;
  }

  /**
   * Run a single benchmark
   */
  async runBenchmark(benchmarkName, benchmark) {
    return new Promise((resolve, reject) => {
      const startTime = new Date();
      
      autocannon(benchmark.config, (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        const endTime = new Date();
        const processedResult = {
          name: benchmarkName,
          title: benchmark.name,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration: result.duration,
          connections: result.connections,
          pipelining: result.pipelining,
          latency: {
            average: result.latency.average,
            mean: result.latency.mean,
            stddev: result.latency.stddev,
            min: result.latency.min,
            max: result.latency.max,
            p2_5: result.latency.p2_5,
            p50: result.latency.p50,
            p97_5: result.latency.p97_5,
            p99: result.latency.p99
          },
          requests: {
            average: result.requests.average,
            mean: result.requests.mean,
            stddev: result.requests.stddev,
            min: result.requests.min,
            max: result.requests.max,
            total: result.requests.total,
            sent: result.requests.sent
          },
          throughput: {
            average: result.throughput.average,
            mean: result.throughput.mean,
            stddev: result.throughput.stddev,
            min: result.throughput.min,
            max: result.throughput.max
          },
          errors: result.errors,
          timeouts: result.timeouts,
          mismatches: result.mismatches,
          non2xx: result.non2xx,
          passed: false // Will be set by validation
        };

        resolve(processedResult);
      });
    });
  }

  /**
   * Validate benchmark results against thresholds
   */
  validateThresholds(result, thresholds) {
    const validations = [];

    // Check average latency
    if (result.latency.average <= thresholds.avgLatency) {
      validations.push({ metric: 'Average Latency', passed: true });
    } else {
      validations.push({ 
        metric: 'Average Latency', 
        passed: false,
        expected: thresholds.avgLatency,
        actual: result.latency.average
      });
    }

    // Check p99 latency
    if (result.latency.p99 <= thresholds.p99Latency) {
      validations.push({ metric: 'P99 Latency', passed: true });
    } else {
      validations.push({ 
        metric: 'P99 Latency', 
        passed: false,
        expected: thresholds.p99Latency,
        actual: result.latency.p99
      });
    }

    // Check throughput
    if (result.requests.average >= thresholds.throughput) {
      validations.push({ metric: 'Throughput', passed: true });
    } else {
      validations.push({ 
        metric: 'Throughput', 
        passed: false,
        expected: thresholds.throughput,
        actual: result.requests.average
      });
    }

    // Check error rate
    const errorRate = (result.errors + result.timeouts + result.non2xx) / result.requests.total;
    if (errorRate <= thresholds.errors) {
      validations.push({ metric: 'Error Rate', passed: true });
    } else {
      validations.push({ 
        metric: 'Error Rate', 
        passed: false,
        expected: thresholds.errors,
        actual: errorRate
      });
    }

    const allPassed = validations.every(v => v.passed);
    result.validations = validations;
    result.passed = allPassed;

    return allPassed;
  }

  /**
   * Generate summary report
   */
  async generateSummaryReport(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(this.outputDir, `benchmark-report-${timestamp}.json`);
    
    const summary = {
      timestamp: new Date().toISOString(),
      totalBenchmarks: results.length,
      passedBenchmarks: results.filter(r => r.passed).length,
      failedBenchmarks: results.filter(r => !r.passed).length,
      baseUrl: this.baseUrl,
      results: results
    };

    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
    
    // Save JSON report
    await fs.writeFile(reportFile, JSON.stringify(summary, null, 2));
    
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(summary);
    const markdownFile = path.join(this.outputDir, `benchmark-report-${timestamp}.md`);
    await fs.writeFile(markdownFile, markdownReport);

    console.log(`\n📊 BENCHMARK SUMMARY`);
    console.log(`==================`);
    console.log(`Total Benchmarks: ${summary.totalBenchmarks}`);
    console.log(`Passed: ${summary.passedBenchmarks}`);
    console.log(`Failed: ${summary.failedBenchmarks}`);
    console.log(`Success Rate: ${((summary.passedBenchmarks / summary.totalBenchmarks) * 100).toFixed(1)}%`);
    console.log(`\n📁 Reports saved:`);
    console.log(`  JSON: ${reportFile}`);
    console.log(`  Markdown: ${markdownFile}`);

    return summary;
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(summary) {
    let markdown = `# OmniCare Performance Benchmark Report\n\n`;
    markdown += `**Generated:** ${summary.timestamp}\n`;
    markdown += `**Base URL:** ${summary.baseUrl}\n`;
    markdown += `**Total Benchmarks:** ${summary.totalBenchmarks}\n`;
    markdown += `**Passed:** ${summary.passedBenchmarks}\n`;
    markdown += `**Failed:** ${summary.failedBenchmarks}\n`;
    markdown += `**Success Rate:** ${((summary.passedBenchmarks / summary.totalBenchmarks) * 100).toFixed(1)}%\n\n`;

    markdown += `## Benchmark Results\n\n`;

    for (const result of summary.results) {
      if (result.error) {
        markdown += `### ❌ ${result.name} - ERROR\n\n`;
        markdown += `**Error:** ${result.error}\n\n`;
        continue;
      }

      const status = result.passed ? '✅' : '❌';
      markdown += `### ${status} ${result.title}\n\n`;
      
      markdown += `| Metric | Value |\n`;
      markdown += `|--------|-------|\n`;
      markdown += `| Duration | ${result.duration}s |\n`;
      markdown += `| Connections | ${result.connections} |\n`;
      markdown += `| Total Requests | ${result.requests.total} |\n`;
      markdown += `| Avg Latency | ${result.latency.average.toFixed(2)}ms |\n`;
      markdown += `| P99 Latency | ${result.latency.p99.toFixed(2)}ms |\n`;
      markdown += `| Avg Throughput | ${result.requests.average.toFixed(2)} req/s |\n`;
      markdown += `| Errors | ${result.errors} |\n`;
      markdown += `| Timeouts | ${result.timeouts} |\n`;
      markdown += `| Non-2xx | ${result.non2xx} |\n\n`;

      if (result.validations) {
        markdown += `**Validations:**\n`;
        for (const validation of result.validations) {
          const validStatus = validation.passed ? '✅' : '❌';
          markdown += `- ${validStatus} ${validation.metric}`;
          if (!validation.passed) {
            markdown += ` (Expected: ${validation.expected}, Actual: ${validation.actual})`;
          }
          markdown += `\n`;
        }
        markdown += `\n`;
      }
    }

    markdown += `## Performance Trends\n\n`;
    markdown += `*Performance trends and historical comparisons would be added here in a full implementation.*\n\n`;

    markdown += `## Recommendations\n\n`;
    if (summary.passedBenchmarks === summary.totalBenchmarks) {
      markdown += `✅ All benchmarks passed! Performance is within acceptable thresholds.\n\n`;
    } else {
      markdown += `⚠️ Some benchmarks failed. Review the following:\n\n`;
      for (const result of summary.results.filter(r => !r.passed && !r.error)) {
        markdown += `- **${result.title}:** Review performance optimization opportunities\n`;
      }
    }

    return markdown;
  }
}

// CLI interface
if (require.main === module) {
  const runner = new BenchmarkRunner();
  
  runner.runAllBenchmarks()
    .then(results => {
      const exitCode = results.every(r => r.passed) ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('Benchmark execution failed:', error);
      process.exit(1);
    });
}

module.exports = BenchmarkRunner;