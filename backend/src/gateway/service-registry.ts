// Stub implementation for service registry
export interface ServiceInstance {
  id: string;
  url: string;
  healthy: boolean;
}

export class ServiceRegistry {
  constructor() {}
  
  register(_service: ServiceInstance): void {}
  unregister(_id: string): void {}
  getService(_id: string): ServiceInstance | null { return null; }
  getAllServices(): ServiceInstance[] { return []; }
  getHealthyServices(): ServiceInstance[] { return []; }
}