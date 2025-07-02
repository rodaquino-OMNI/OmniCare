// Stub implementation for load balancer
export interface ServiceInstance {
  id: string;
  url: string;
  healthy: boolean;
}

export class LoadBalancer {
  constructor() {
    // Stub implementation - to be implemented
  }
  
  addService(_service: ServiceInstance): void {
    // TODO: Implement service addition logic
  }
  removeService(_id: string): void {
    // TODO: Implement service removal logic
  }
  getNextService(): ServiceInstance | null { return null; }
  markUnhealthy(_id: string): void {
    // TODO: Implement health marking logic
  }
  markHealthy(_id: string): void {
    // TODO: Implement health marking logic
  }
}