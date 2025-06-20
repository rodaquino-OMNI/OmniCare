import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                sub: string;
                scope: string[];
                patient?: string;
                encounter?: string;
                fhirUser?: string;
                iss?: string;
                aud?: string;
                clientId?: string;
                tokenType?: string;
            };
            token?: string;
        }
    }
}
export declare class AuthMiddleware {
    static authenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
    static optionalAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
    static requireScope(...requiredScopes: string[]): (req: Request, res: Response, next: NextFunction) => void;
    static requirePatientAccess(req: Request, res: Response, next: NextFunction): void;
    static requireResourceAccess(resourceType: string, operation: 'read' | 'write' | 'create' | 'delete' | '*'): (req: Request, res: Response, next: NextFunction) => void;
    static requireAdmin(req: Request, res: Response, next: NextFunction): void;
    private static checkWildcardScope;
    static createRateLimiter(windowMs?: number, max?: number): (req: Request, res: Response, next: NextFunction) => void;
    static auditLog(req: Request, res: Response, next: NextFunction): void;
}
export declare const authenticate: typeof AuthMiddleware.authenticate;
export declare const optionalAuthenticate: typeof AuthMiddleware.optionalAuthenticate;
export declare const requireScope: typeof AuthMiddleware.requireScope;
export declare const requirePatientAccess: typeof AuthMiddleware.requirePatientAccess;
export declare const requireResourceAccess: typeof AuthMiddleware.requireResourceAccess;
export declare const requireAdmin: typeof AuthMiddleware.requireAdmin;
export declare const auditLog: typeof AuthMiddleware.auditLog;
//# sourceMappingURL=auth.middleware.d.ts.map