#!/usr/bin/env node

/**
 * Health Check Script for Docker Container
 * Performs a comprehensive health check of the OmniCare FHIR Backend
 */

import http from 'http';
import process from 'process';

interface HealthCheckResult {
  status: string;
  timestamp: string;
  checks: {
    [key: string]: {
      status: string;
      responseTime?: number;
      error?: string;
    };
  };
}

class HealthChecker {
  private readonly host: string;
  private readonly port: number;
  private readonly timeout: number;

  constructor() {
    this.host = process.env.HOST || 'localhost';
    this.port = parseInt(process.env.PORT || '8080', 10);
    this.timeout = 5000; // 5 second timeout
  }

  /**
   * Perform HTTP health check
   */
  private async checkHTTP(path: string): Promise<{ status: string; responseTime: number; error?: string }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const options = {
        hostname: this.host,
        port: this.port,
        path,
        method: 'GET',
        timeout: this.timeout,
        headers: {
          'User-Agent': 'OmniCare-HealthCheck/1.0',
        },
      };

      const req = http.request(options, (res) => {
        let _data = '';
        
        res.on('data', (chunk) => {
          _data += chunk;
        });

        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              status: 'UP',
              responseTime,
            });
          } else {
            resolve({
              status: 'DOWN',
              responseTime,
              error: `HTTP ${res.statusCode}: ${res.statusMessage}`,
            });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 'DOWN',
          responseTime: this.timeout,
          error: 'Request timeout',
        });
      });

      req.on('error', (err) => {
        resolve({
          status: 'DOWN',
          responseTime: Date.now() - startTime,
          error: err.message,
        });
      });

      req.end();
    });
  }

  /**
   * Run comprehensive health check
   */
  async runHealthCheck(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};

    // Basic HTTP endpoint check
    console.log('Checking basic HTTP endpoint...');
    checks.http = await this.checkHTTP('/ping');

    // Health endpoint check
    console.log('Checking health endpoint...');
    checks.health = await this.checkHTTP('/health');

    // FHIR metadata endpoint check
    console.log('Checking FHIR metadata endpoint...');
    checks.fhir_metadata = await this.checkHTTP('/fhir/R4/metadata');

    // CDS Hooks discovery endpoint check
    console.log('Checking CDS Hooks discovery endpoint...');
    checks.cds_hooks = await this.checkHTTP('/cds-services');

    // Determine overall status
    const allChecks = Object.values(checks);
    const criticalChecks = [checks.http, checks.health];
    
    let overallStatus = 'UP';
    
    // If any critical check fails, overall status is DOWN
    if (criticalChecks.some(check => check.status === 'DOWN')) {
      overallStatus = 'DOWN';
    }
    // If any check fails, overall status is DEGRADED
    else if (allChecks.some(check => check.status === 'DOWN')) {
      overallStatus = 'DEGRADED';
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    };

    return result;
  }

  /**
   * Print health check results
   */
  printResults(result: HealthCheckResult): void {
    console.log('\n=== OmniCare FHIR Backend Health Check ===');
    console.log(`Overall Status: ${result.status}`);
    console.log(`Timestamp: ${result.timestamp}`);
    console.log('\nComponent Status:');
    
    Object.entries(result.checks).forEach(([component, check]) => {
      const status = check.status === 'UP' ? '✓' : '✗';
      const responseTime = check.responseTime ? ` (${check.responseTime}ms)` : '';
      const error = check.error ? ` - ${check.error}` : '';
      
      console.log(`  ${status} ${component}: ${check.status}${responseTime}${error}`);
    });
    
    console.log('\n==========================================\n');
  }
}

// Main execution
async function main(): Promise<void> {
  const checker = new HealthChecker();
  
  try {
    console.log('Starting OmniCare FHIR Backend health check...');
    
    const result = await checker.runHealthCheck();
    checker.printResults(result);
    
    // Exit with appropriate code
    if (result.status === 'UP') {
      console.log('Health check passed ✓');
      process.exit(0);
    } else {
      console.log('Health check failed ✗');
      process.exit(1);
    }
  } catch (error) {
    console.error('Health check error:', error);
    process.exit(1);
  }
}

// Run health check if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error in health check:', error);
    process.exit(1);
  });
}

export { HealthChecker };