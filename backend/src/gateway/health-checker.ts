/**
 * Health Checker Service
 * Provides health check functionality for services
 */

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  checks: Record<string, boolean>;
}

export class HealthChecker {
  private checks: Map<string, () => Promise<boolean>> = new Map();

  addCheck(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
  }

  async getStatus(): Promise<HealthStatus> {
    const checks: Record<string, boolean> = {};
    let allHealthy = true;

    for (const [name, check] of this.checks) {
      try {
        checks[name] = await check();
        if (!checks[name]) allHealthy = false;
      } catch {
        checks[name] = false;
        allHealthy = false;
      }
    }

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      checks
    };
  }
}

export const healthChecker = new HealthChecker();