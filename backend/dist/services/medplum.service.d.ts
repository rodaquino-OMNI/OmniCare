import { Bundle, Resource } from '@medplum/fhirtypes';
import { FHIRSearchParams, BundleRequest } from '@/types/fhir';
export declare class MedplumService {
    private medplum;
    private isInitialized;
    private reconnectAttempts;
    private maxReconnectAttempts;
    constructor();
    initialize(): Promise<void>;
    private testConnection;
    private ensureInitialized;
    createResource<T extends Resource>(resource: T): Promise<T>;
    readResource<T extends Resource>(resourceType: string, id: string): Promise<T>;
    updateResource<T extends Resource>(resource: T): Promise<T>;
    deleteResource(resourceType: string, id: string): Promise<void>;
    searchResources<T extends Resource>(resourceType: string, searchParams?: FHIRSearchParams): Promise<Bundle<T>>;
    executeBatch(bundleRequest: BundleRequest): Promise<Bundle>;
    getCapabilityStatement(): Promise<any>;
    graphql(query: string, variables?: Record<string, any>): Promise<any>;
    createSubscription(criteria: string, channelType: string, endpoint?: string): Promise<any>;
    validateResource<T extends Resource>(resource: T): Promise<any>;
    private convertSearchParams;
    private parseSortRules;
    private handleFHIRError;
    getHealthStatus(): Promise<{
        status: string;
        details: any;
    }>;
    shutdown(): Promise<void>;
}
export declare const medplumService: MedplumService;
//# sourceMappingURL=medplum.service.d.ts.map