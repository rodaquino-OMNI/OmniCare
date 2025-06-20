#!/usr/bin/env node
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
declare class HealthChecker {
    private readonly host;
    private readonly port;
    private readonly timeout;
    constructor();
    private checkHTTP;
    runHealthCheck(): Promise<HealthCheckResult>;
    printResults(result: HealthCheckResult): void;
}
export { HealthChecker };
//# sourceMappingURL=healthcheck.d.ts.map