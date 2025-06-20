import { DirectMessage, DirectTrustStatistics, DirectHealthCheck } from '../types/direct.types';
import { IntegrationResult } from '../types/integration.types';
export declare class DirectTrustService {
    private smtpTransporter?;
    private directConfig;
    private connectionStatus;
    private statistics;
    private messageQueue;
    private processingMessages;
    private certificates;
    private trustAnchors;
    constructor();
    private initialize;
    private loadConfiguration;
    private setupSMTPTransporter;
    private loadCertificates;
    private loadTrustAnchors;
    private convertX509ToDirectCertificate;
    private validateCertificates;
    private validateTrustBundle;
    sendMessage(message: DirectMessage): Promise<IntegrationResult<DirectMessage>>;
    private processOutboundMessage;
    private encryptContent;
    private signContent;
    private validateMessage;
    private isValidDirectAddress;
    private calculateMessageSize;
    private calculateSecurityLevel;
    private calculateTrustLevel;
    private updateMessageStatus;
    private logAuditEvent;
    private generateId;
    private initializeConnectionStatus;
    private initializeStatistics;
    getStatistics(): DirectTrustStatistics;
    getHealth(): Promise<DirectHealthCheck>;
}
export declare const directTrustService: DirectTrustService;
//# sourceMappingURL=direct-trust.service.d.ts.map