import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { SubscriptionConfig } from '@/types/fhir';
interface ActiveSubscription {
    id: string;
    criteria: string;
    channel: {
        type: string;
        endpoint?: string;
        payload?: string;
        headers?: Record<string, string>;
    };
    status: 'active' | 'off' | 'error';
    clientInfo?: {
        userId?: string;
        clientId?: string;
        connection?: WebSocket;
    };
    lastNotification?: Date;
    errorCount: number;
    createdAt: Date;
}
export declare class SubscriptionsService extends EventEmitter {
    private activeSubscriptions;
    private wsServer?;
    private connectedClients;
    private subscriptionPatterns;
    private healthCheckInterval?;
    constructor();
    private setupWebSocketServer;
    private handleWebSocketConnection;
    private handleWebSocketMessage;
    private handleWebSocketSubscribe;
    private handleWebSocketUnsubscribe;
    private sendWebSocketMessage;
    createSubscription(subscriptionConfig: SubscriptionConfig, clientInfo?: any): Promise<string>;
    removeSubscription(subscriptionId: string): Promise<void>;
    listActiveSubscriptions(): ActiveSubscription[];
    getSubscription(subscriptionId: string): ActiveSubscription | undefined;
    processResourceChange(resourceType: string, resourceId: string, operation: 'create' | 'update' | 'delete', resource?: any): Promise<void>;
    private findMatchingSubscriptions;
    private createNotificationBundle;
    private sendNotification;
    private sendWebSocketNotification;
    private sendRestHookNotification;
    private sendEmailNotification;
    private compileSubscriptionPattern;
    private generateClientId;
    private removeClientSubscriptions;
    private startHealthCheck;
    private performHealthCheck;
    getHealthStatus(): Promise<{
        status: string;
        details: any;
    }>;
    shutdown(): Promise<void>;
}
export declare const subscriptionsService: SubscriptionsService;
export {};
//# sourceMappingURL=subscriptions.service.d.ts.map