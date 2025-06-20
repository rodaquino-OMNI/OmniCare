import { Request, Response } from 'express';
export declare class FHIRController {
    getCapabilityStatement(req: Request, res: Response): Promise<void>;
    createResource(req: Request, res: Response): Promise<void>;
    readResource(req: Request, res: Response): Promise<void>;
    updateResource(req: Request, res: Response): Promise<void>;
    deleteResource(req: Request, res: Response): Promise<void>;
    searchResources(req: Request, res: Response): Promise<void>;
    processBatch(req: Request, res: Response): Promise<void>;
    getPatientEverything(req: Request, res: Response): Promise<void>;
    validateResource(req: Request, res: Response): Promise<void>;
    executeGraphQL(req: Request, res: Response): Promise<void>;
    getCDSServices(req: Request, res: Response): Promise<void>;
    executeCDSHook(req: Request, res: Response): Promise<void>;
    listSubscriptions(req: Request, res: Response): Promise<void>;
    healthCheck(req: Request, res: Response): Promise<void>;
}
export declare const fhirController: FHIRController;
//# sourceMappingURL=fhir.controller.d.ts.map