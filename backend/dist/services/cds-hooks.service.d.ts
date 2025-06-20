import { CDSHookRequest, CDSHookResponse } from '@/types/fhir';
interface CDSService {
    hook: string;
    name: string;
    title: string;
    description: string;
    id: string;
    prefetch?: {
        [key: string]: string;
    };
    usageRequirements?: string;
}
export declare class CDSHooksService {
    private readonly services;
    getDiscoveryDocument(): {
        services: CDSService[];
    };
    executePatientView(request: CDSHookRequest): Promise<CDSHookResponse>;
    executeMedicationPrescribe(request: CDSHookRequest): Promise<CDSHookResponse>;
    executeOrderReview(request: CDSHookRequest): Promise<CDSHookResponse>;
    private assessPatientRisk;
    private checkPreventiveCare;
    private identifyCareGaps;
    private checkDrugInteractions;
    private checkDrugAllergies;
    private checkForKnownInteractions;
    private checkDosing;
    private checkContraindications;
    private checkOrderAppropriateness;
    private checkDuplicateOrders;
    private checkCostEffectiveness;
    getHealthStatus(): Promise<{
        status: string;
        details: any;
    }>;
}
export declare const cdsHooksService: CDSHooksService;
export {};
//# sourceMappingURL=cds-hooks.service.d.ts.map