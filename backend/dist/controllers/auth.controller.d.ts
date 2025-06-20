import { Request, Response } from 'express';
export declare class AuthController {
    private jwtService;
    private sessionManager;
    private auditService;
    constructor();
    authorize(req: Request, res: Response): Promise<void>;
    token(req: Request, res: Response): Promise<void>;
    private handleAuthorizationCodeGrant;
    private handleRefreshTokenGrant;
    private handleClientCredentialsGrant;
    introspect(req: Request, res: Response): Promise<void>;
    login(req: Request, res: Response): Promise<void>;
    refreshToken(req: Request, res: Response): Promise<void>;
    logout(req: Request, res: Response): Promise<void>;
    setupMfa(req: Request, res: Response): Promise<void>;
    verifyMfa(req: Request, res: Response): Promise<void>;
    getCurrentUser(req: Request, res: Response): Promise<void>;
    private generateAuthorizationCode;
    private generateAccessToken;
    private generateRefreshToken;
    private authCodes;
    private storeAuthorizationCode;
    private getAuthorizationCode;
    private removeAuthorizationCode;
    private validateClientCredentials;
    private validateUserCredentials;
    private getUserById;
    private getUserByUsernameOrEmail;
    private updateUserLoginInfo;
    private incrementFailedLoginAttempts;
    private resetFailedLoginAttempts;
    private storeTempMfaSecret;
    private getTempMfaSecret;
    private clearTempMfaSecret;
    private enableUserMfa;
}
export declare const authController: AuthController;
//# sourceMappingURL=auth.controller.d.ts.map