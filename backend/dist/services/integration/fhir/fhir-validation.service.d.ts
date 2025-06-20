import { ValidationResult } from '../types/integration.types';
export declare class FHIRValidationService {
    private ajv;
    private fhirSchemas;
    private validationCache;
    private readonly cacheTimeout;
    constructor();
    private initializeValidation;
    private loadFHIRSchemas;
    private fetchFHIRSchema;
    private loadSchema;
    private setupCustomValidators;
    validateResource(resource: any, resourceType?: string): Promise<ValidationResult>;
    validateBundle(bundle: any): Promise<ValidationResult>;
    private addBusinessRuleValidations;
    private validatePatientBusinessRules;
    private validateEncounterBusinessRules;
    private validateObservationBusinessRules;
    private validateMedicationRequestBusinessRules;
    private hasObservationValue;
    private formatPath;
    private getErrorSeverity;
    private generateCacheKey;
    private isCacheValid;
    clearCache(): void;
    getStatistics(): {
        schemasLoaded: number;
        cacheSize: number;
        cacheHitRate: number;
    };
    getHealth(): Promise<{
        status: string;
        details: any;
    }>;
}
export declare const fhirValidationService: FHIRValidationService;
//# sourceMappingURL=fhir-validation.service.d.ts.map