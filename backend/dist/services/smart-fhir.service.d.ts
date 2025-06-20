import { SMARTTokenResponse } from '@/types/fhir';
export declare class SMARTFHIRService {
    private readonly defaultScopes;
    private readonly stateStore;
    private readonly authCodeStore;
    initiateAuthorization(clientId: string, redirectUri: string, scope?: string[], state?: string, aud?: string, launch?: string): Promise<{
        authorizationUrl: string;
        state: string;
    }>;
    exchangeCodeForToken(code: string, state: string, clientId?: string): Promise<SMARTTokenResponse>;
    refreshToken(refreshToken: string, clientId: string): Promise<SMARTTokenResponse>;
    introspectToken(accessToken: string): Promise<any>;
    getSMARTConfiguration(fhirBaseUrl: string): Promise<any>;
    launchStandaloneApp(fhirBaseUrl: string, clientId: string, redirectUri: string, scope?: string[]): Promise<{
        authorizationUrl: string;
        state: string;
    }>;
    handleEHRLaunch(iss: string, launch: string, clientId: string, redirectUri: string, scope?: string[]): Promise<{
        authorizationUrl: string;
        state: string;
    }>;
    authenticateWithEpic(privateKeyPath: string): Promise<string>;
    authenticateWithCerner(): Promise<string>;
    private generateSecureState;
    private generateCodeVerifier;
    private generateCodeChallenge;
    validateJWT(token: string, publicKey?: string): any;
    cleanupExpiredEntries(): void;
    getHealthStatus(): Promise<{
        status: string;
        details: any;
    }>;
}
export declare const smartFHIRService: SMARTFHIRService;
//# sourceMappingURL=smart-fhir.service.d.ts.map