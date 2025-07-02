// Stub implementation for load balancer
export interface ServiceInstance {
  id: string;
  url: string;
  healthy: boolean;
}

export class LoadBalancer {
  constructor() {}
  
  addService(_service: ServiceInstance): void {}
  removeService(_id: string): void {}
  getNextService(): ServiceInstance | null { return null; }
  markUnhealthy(_id: string): void {}
  markHealthy(_id: string): void {}
}