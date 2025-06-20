#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthChecker = void 0;
const http_1 = __importDefault(require("http"));
const process_1 = __importDefault(require("process"));
class HealthChecker {
    host;
    port;
    timeout;
    constructor() {
        this.host = process_1.default.env.HOST || 'localhost';
        this.port = parseInt(process_1.default.env.PORT || '8080', 10);
        this.timeout = 5000;
    }
    async checkHTTP(path) {
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
            const req = http_1.default.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    const responseTime = Date.now() - startTime;
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({
                            status: 'UP',
                            responseTime,
                        });
                    }
                    else {
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
    async runHealthCheck() {
        const checks = {};
        console.log('Checking basic HTTP endpoint...');
        checks.http = await this.checkHTTP('/ping');
        console.log('Checking health endpoint...');
        checks.health = await this.checkHTTP('/health');
        console.log('Checking FHIR metadata endpoint...');
        checks.fhir_metadata = await this.checkHTTP('/fhir/R4/metadata');
        console.log('Checking CDS Hooks discovery endpoint...');
        checks.cds_hooks = await this.checkHTTP('/cds-services');
        const allChecks = Object.values(checks);
        const criticalChecks = [checks.http, checks.health];
        let overallStatus = 'UP';
        if (criticalChecks.some(check => check.status === 'DOWN')) {
            overallStatus = 'DOWN';
        }
        else if (allChecks.some(check => check.status === 'DOWN')) {
            overallStatus = 'DEGRADED';
        }
        const result = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            checks,
        };
        return result;
    }
    printResults(result) {
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
exports.HealthChecker = HealthChecker;
async function main() {
    const checker = new HealthChecker();
    try {
        console.log('Starting OmniCare FHIR Backend health check...');
        const result = await checker.runHealthCheck();
        checker.printResults(result);
        if (result.status === 'UP') {
            console.log('Health check passed ✓');
            process_1.default.exit(0);
        }
        else {
            console.log('Health check failed ✗');
            process_1.default.exit(1);
        }
    }
    catch (error) {
        console.error('Health check error:', error);
        process_1.default.exit(1);
    }
}
if (require.main === module) {
    main().catch((error) => {
        console.error('Unhandled error in health check:', error);
        process_1.default.exit(1);
    });
}
//# sourceMappingURL=healthcheck.js.map