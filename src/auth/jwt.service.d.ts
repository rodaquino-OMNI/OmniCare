import { User, UserRole, AuthToken, MfaSetup, SessionInfo, Permission } from '@/types/auth.types';
export interface TokenPayload {
    userId: string;
    username: string;
    role: UserRole;
    permissions: Permission[];
    sessionId: string;
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string;
}
export declare class JWTAuthService {
    private readonly accessTokenSecret;
    private readonly refreshTokenSecret;
    constructor();
    generateTokens(user: User): AuthToken;
    verifyAccessToken(token: string): TokenPayload;
    verifyRefreshToken(token: string): {
        userId: string;
        sessionId: string;
    };
    refreshAccessToken(refreshToken: string, user: User): AuthToken;
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
    validatePassword(password: string): {
        isValid: boolean;
        errors: string[];
    };
    generateMfaSecret(user: User): Promise<MfaSetup>;
    verifyMfaToken(token: string, secret: string): boolean;
    isMfaRequired(role: UserRole): boolean;
    private generateBackupCodes;
    private getTokenExpiryTime;
    generateSecureToken(): string;
    createSessionInfo(user: User, sessionId: string, ipAddress: string, userAgent: string): SessionInfo;
    isSessionValid(session: SessionInfo): boolean;
    updateSessionActivity(session: SessionInfo): SessionInfo;
    extractTokenFromHeader(authHeader: string | undefined): string | null;
    generateSecureRandomString(length?: number): string;
    encryptData(data: string, key: string): {
        encrypted: string;
        iv: string;
        tag: string;
    };
    decryptData(encryptedData: {
        encrypted: string;
        iv: string;
        tag: string;
    }, key: string): string;
}
//# sourceMappingURL=jwt.service.d.ts.map