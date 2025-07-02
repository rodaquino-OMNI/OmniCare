// Stub implementation for service registry
export interface ServiceInstance {
  id: string;
  url: string;
  healthy: boolean;
}

export class ServiceRegistry {
  constructor() {
    // Stub implementation - to be implemented
  }
  
  register(_service: ServiceInstance): void {
    // TODO: Implement service registration logic
  }
  unregister(_id: string): void {
    // TODO: Implement service unregistration logic
  }
  getService(_id: string): ServiceInstance | null { return null; }
  getAllServices(): ServiceInstance[] { return []; }
  getHealthyServices(): ServiceInstance[] { return []; }
}