import { ValidationResult } from '@/types/fhir';
export declare class ValidationService {
    private readonly fhirResourceSchemas;
    private readonly apiSchemas;
    validateFHIRResource(resourceType: string, resource: any): Promise<ValidationResult>;
    validateAPIInput(schemaName: string, data: any): Promise<ValidationResult>;
    sanitizeInput(input: any): any;
    validateEmail(email: string): boolean;
    validatePhoneNumber(phone: string): boolean;
    validateDate(dateString: string): boolean;
    validateFHIRId(id: string): boolean;
    validateURI(uri: string): boolean;
    private performAdditionalFHIRValidation;
    private validatePatientResource;
    private validateObservationResource;
    private validateMedicationRequestResource;
    private validateVitalSignValue;
    private validateCommonFHIRElements;
    getHealthStatus(): Promise<{
        status: string;
        details: any;
    }>;
}
export declare const validationService: ValidationService;
//# sourceMappingURL=validation.service.d.ts.map