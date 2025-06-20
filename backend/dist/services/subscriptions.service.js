"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionsService = exports.SubscriptionsService = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const medplum_service_1 = require("./medplum.service");
const config_1 = __importDefault(require("@/config"));
const logger_1 = __importDefault(require("@/utils/logger"));
class SubscriptionsService extends events_1.EventEmitter {
    activeSubscriptions = new Map();
    wsServer;
    connectedClients = new Map();
    subscriptionPatterns = new Map();
    healthCheckInterval;
    constructor() {
        super();
        this.setupWebSocketServer();
        this.startHealthCheck();
    }
    setupWebSocketServer() {
        try {
            this.wsServer = new ws_1.default.Server({
                port: config_1.default.subscriptions.websocketPort,
                maxPayload: 1024 * 1024,
                perMessageDeflate: true,
            });
            this.wsServer.on('connection', (ws, request) => {
                this.handleWebSocketConnection(ws, request);
            });
            this.wsServer.on('error', (error) => {
                logger_1.default.error('WebSocket server error:', error);
            });
            logger_1.default.info(`WebSocket server started on port ${config_1.default.subscriptions.websocketPort}`);
        }
        catch (error) {
            logger_1.default.error('Failed to setup WebSocket server:', error);
            throw error;
        }
    }
    handleWebSocketConnection(ws, request) {
        const clientId = this.generateClientId();
        const clientInfo = {
            id: clientId,
            remoteAddress: request.socket.remoteAddress,
            userAgent: request.headers['user-agent'],
            connectedAt: new Date(),
        };
        logger_1.default.info('WebSocket client connected', clientInfo);
        this.connectedClients.set(clientId, ws);
        ws.on('message', (data) => {
            this.handleWebSocketMessage(clientId, data);
        });
        ws.on('close', (code, reason) => {
            logger_1.default.info('WebSocket client disconnected', {
                clientId,
                code,
                reason: reason.toString(),
            });
            this.connectedClients.delete(clientId);
            this.removeClientSubscriptions(clientId);
        });
        ws.on('error', (error) => {
            logger_1.default.error('WebSocket client error:', { clientId, error });
            this.connectedClients.delete(clientId);
            this.removeClientSubscriptions(clientId);
        });
        this.sendWebSocketMessage(clientId, {
            type: 'welcome',
            clientId,
            timestamp: new Date().toISOString(),
            supportedChannels: ['websocket', 'rest-hook'],
        });
    }
    handleWebSocketMessage(clientId, data) {
        try {
            const message = JSON.parse(data.toString());
            logger_1.default.debug('WebSocket message received', { clientId, type: message.type });
            switch (message.type) {
                case 'subscribe':
                    this.handleWebSocketSubscribe(clientId, message);
                    break;
                case 'unsubscribe':
                    this.handleWebSocketUnsubscribe(clientId, message);
                    break;
                case 'ping':
                    this.sendWebSocketMessage(clientId, { type: 'pong', timestamp: new Date().toISOString() });
                    break;
                default:
                    logger_1.default.warn('Unknown WebSocket message type', { clientId, type: message.type });
            }
        }
        catch (error) {
            logger_1.default.error('Failed to handle WebSocket message:', { clientId, error });
            this.sendWebSocketMessage(clientId, {
                type: 'error',
                message: 'Invalid message format',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async handleWebSocketSubscribe(clientId, message) {
        try {
            const subscriptionConfig = {
                criteria: message.criteria,
                channel: {
                    type: 'websocket',
                    payload: message.payload || 'application/fhir+json',
                },
                reason: message.reason || 'WebSocket subscription',
                status: 'active',
            };
            const subscriptionId = await this.createSubscription(subscriptionConfig, {
                userId: message.userId,
                clientId,
                connection: this.connectedClients.get(clientId),
            });
            this.sendWebSocketMessage(clientId, {
                type: 'subscription-created',
                subscriptionId,
                criteria: message.criteria,
                timestamp: new Date().toISOString(),
            });
            logger_1.default.info('WebSocket subscription created', { clientId, subscriptionId, criteria: message.criteria });
        }
        catch (error) {
            logger_1.default.error('Failed to create WebSocket subscription:', { clientId, error });
            this.sendWebSocketMessage(clientId, {
                type: 'error',
                message: 'Failed to create subscription',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async handleWebSocketUnsubscribe(clientId, message) {
        try {
            await this.removeSubscription(message.subscriptionId);
            this.sendWebSocketMessage(clientId, {
                type: 'subscription-removed',
                subscriptionId: message.subscriptionId,
                timestamp: new Date().toISOString(),
            });
            logger_1.default.info('WebSocket subscription removed', { clientId, subscriptionId: message.subscriptionId });
        }
        catch (error) {
            logger_1.default.error('Failed to remove WebSocket subscription:', { clientId, error });
            this.sendWebSocketMessage(clientId, {
                type: 'error',
                message: 'Failed to remove subscription',
                timestamp: new Date().toISOString(),
            });
        }
    }
    sendWebSocketMessage(clientId, message) {
        const ws = this.connectedClients.get(clientId);
        if (ws && ws.readyState === ws_1.default.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    async createSubscription(subscriptionConfig, clientInfo) {
        try {
            const subscription = {
                resourceType: 'Subscription',
                status: subscriptionConfig.status,
                reason: subscriptionConfig.reason,
                criteria: subscriptionConfig.criteria,
                channel: {
                    type: subscriptionConfig.channel.type,
                    endpoint: subscriptionConfig.channel.endpoint,
                    payload: subscriptionConfig.channel.payload,
                    header: subscriptionConfig.channel.header,
                },
                extension: [
                    {
                        url: 'http://omnicare.com/fhir/StructureDefinition/subscription-metadata',
                        valueString: JSON.stringify({
                            createdBy: 'OmniCare EMR',
                            clientInfo: clientInfo ? {
                                userId: clientInfo.userId,
                                clientId: clientInfo.clientId,
                            } : undefined,
                        }),
                    },
                ],
            };
            const createdSubscription = await medplum_service_1.medplumService.createResource(subscription);
            if (!createdSubscription.id) {
                throw new Error('Failed to create subscription - no ID returned');
            }
            const activeSubscription = {
                id: createdSubscription.id,
                criteria: subscriptionConfig.criteria,
                channel: subscriptionConfig.channel,
                status: 'active',
                clientInfo,
                errorCount: 0,
                createdAt: new Date(),
            };
            this.activeSubscriptions.set(createdSubscription.id, activeSubscription);
            this.compileSubscriptionPattern(createdSubscription.id, subscriptionConfig.criteria);
            logger_1.default.info('FHIR subscription created', {
                subscriptionId: createdSubscription.id,
                criteria: subscriptionConfig.criteria,
                channelType: subscriptionConfig.channel.type,
            });
            return createdSubscription.id;
        }
        catch (error) {
            logger_1.default.error('Failed to create FHIR subscription:', error);
            throw error;
        }
    }
    async removeSubscription(subscriptionId) {
        try {
            const subscription = await medplum_service_1.medplumService.readResource('Subscription', subscriptionId);
            subscription.status = 'off';
            await medplum_service_1.medplumService.updateResource(subscription);
            this.activeSubscriptions.delete(subscriptionId);
            this.subscriptionPatterns.delete(subscriptionId);
            logger_1.default.info('Subscription removed', { subscriptionId });
        }
        catch (error) {
            logger_1.default.error('Failed to remove subscription:', { subscriptionId, error });
            throw error;
        }
    }
    listActiveSubscriptions() {
        return Array.from(this.activeSubscriptions.values());
    }
    getSubscription(subscriptionId) {
        return this.activeSubscriptions.get(subscriptionId);
    }
    async processResourceChange(resourceType, resourceId, operation, resource) {
        try {
            const resourcePath = `${resourceType}/${resourceId}`;
            logger_1.default.debug('Processing resource change', {
                resourceType,
                resourceId,
                operation,
            });
            const matchingSubscriptions = this.findMatchingSubscriptions(resourcePath, operation);
            if (matchingSubscriptions.length === 0) {
                logger_1.default.debug('No matching subscriptions found', { resourcePath, operation });
                return;
            }
            const bundle = await this.createNotificationBundle(resourceType, resourceId, operation, resource, matchingSubscriptions);
            for (const subscription of matchingSubscriptions) {
                await this.sendNotification(subscription, bundle);
            }
            logger_1.default.debug('Resource change notifications sent', {
                resourcePath,
                operation,
                notificationsSent: matchingSubscriptions.length,
            });
        }
        catch (error) {
            logger_1.default.error('Failed to process resource change:', {
                resourceType,
                resourceId,
                operation,
                error,
            });
        }
    }
    findMatchingSubscriptions(resourcePath, operation) {
        const matchingSubscriptions = [];
        for (const [subscriptionId, subscription] of this.activeSubscriptions) {
            if (subscription.status !== 'active')
                continue;
            const pattern = this.subscriptionPatterns.get(subscriptionId);
            if (pattern && pattern.test(resourcePath)) {
                matchingSubscriptions.push(subscription);
            }
        }
        return matchingSubscriptions;
    }
    async createNotificationBundle(resourceType, resourceId, operation, resource, subscriptions) {
        const bundle = {
            resourceType: 'Bundle',
            id: `notification-${Date.now()}`,
            type: 'history',
            timestamp: new Date().toISOString(),
            entry: [],
        };
        if (resource && operation !== 'delete') {
            bundle.entry?.push({
                resource,
                request: {
                    method: operation === 'create' ? 'POST' : 'PUT',
                    url: `${resourceType}/${resourceId}`,
                },
                response: {
                    status: operation === 'create' ? '201' : '200',
                },
            });
        }
        else if (operation === 'delete') {
            bundle.entry?.push({
                request: {
                    method: 'DELETE',
                    url: `${resourceType}/${resourceId}`,
                },
                response: {
                    status: '204',
                },
            });
        }
        return bundle;
    }
    async sendNotification(subscription, bundle) {
        try {
            subscription.lastNotification = new Date();
            switch (subscription.channel.type) {
                case 'websocket':
                    await this.sendWebSocketNotification(subscription, bundle);
                    break;
                case 'rest-hook':
                    await this.sendRestHookNotification(subscription, bundle);
                    break;
                case 'email':
                    await this.sendEmailNotification(subscription, bundle);
                    break;
                default:
                    logger_1.default.warn('Unsupported subscription channel type', {
                        subscriptionId: subscription.id,
                        channelType: subscription.channel.type,
                    });
            }
            subscription.errorCount = 0;
        }
        catch (error) {
            logger_1.default.error('Failed to send notification:', {
                subscriptionId: subscription.id,
                channelType: subscription.channel.type,
                error,
            });
            subscription.errorCount++;
            if (subscription.errorCount >= 5) {
                subscription.status = 'error';
                logger_1.default.error('Subscription disabled due to repeated errors', {
                    subscriptionId: subscription.id,
                });
            }
        }
    }
    async sendWebSocketNotification(subscription, bundle) {
        if (!subscription.clientInfo?.connection) {
            throw new Error('WebSocket connection not available');
        }
        const ws = subscription.clientInfo.connection;
        if (ws.readyState !== ws_1.default.OPEN) {
            throw new Error('WebSocket connection not open');
        }
        const notification = {
            type: 'notification',
            subscriptionId: subscription.id,
            timestamp: new Date().toISOString(),
            bundle,
        };
        ws.send(JSON.stringify(notification));
        logger_1.default.debug('WebSocket notification sent', {
            subscriptionId: subscription.id,
            clientId: subscription.clientInfo.clientId,
        });
    }
    async sendRestHookNotification(subscription, bundle) {
        if (!subscription.channel.endpoint) {
            throw new Error('REST hook endpoint not configured');
        }
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        const headers = {
            'Content-Type': subscription.channel.payload || 'application/fhir+json',
            'User-Agent': 'OmniCare-FHIR-Subscriptions/1.0',
        };
        if (subscription.channel.headers) {
            Object.assign(headers, subscription.channel.headers);
        }
        await axios.post(subscription.channel.endpoint, bundle, {
            headers,
            timeout: 30000,
        });
        logger_1.default.debug('REST hook notification sent', {
            subscriptionId: subscription.id,
            endpoint: subscription.channel.endpoint,
        });
    }
    async sendEmailNotification(subscription, bundle) {
        logger_1.default.info('Email notification would be sent', {
            subscriptionId: subscription.id,
        });
    }
    compileSubscriptionPattern(subscriptionId, criteria) {
        try {
            const [resourceType] = criteria.split('?');
            const pattern = new RegExp(`^${resourceType}/.*$`);
            this.subscriptionPatterns.set(subscriptionId, pattern);
        }
        catch (error) {
            logger_1.default.error('Failed to compile subscription pattern:', {
                subscriptionId,
                criteria,
                error,
            });
        }
    }
    generateClientId() {
        return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    removeClientSubscriptions(clientId) {
        const subscriptionsToRemove = [];
        for (const [subscriptionId, subscription] of this.activeSubscriptions) {
            if (subscription.clientInfo?.clientId === clientId) {
                subscriptionsToRemove.push(subscriptionId);
            }
        }
        subscriptionsToRemove.forEach(subscriptionId => {
            this.removeSubscription(subscriptionId).catch(error => {
                logger_1.default.error('Failed to remove client subscription:', { subscriptionId, error });
            });
        });
        logger_1.default.info('Client subscriptions removed', {
            clientId,
            subscriptionsRemoved: subscriptionsToRemove.length,
        });
    }
    startHealthCheck() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 60000);
    }
    performHealthCheck() {
        const now = new Date();
        let activeCount = 0;
        let errorCount = 0;
        for (const [subscriptionId, subscription] of this.activeSubscriptions) {
            if (subscription.status === 'active') {
                activeCount++;
            }
            else if (subscription.status === 'error') {
                errorCount++;
            }
            if (subscription.channel.type === 'websocket' && subscription.clientInfo?.connection) {
                const ws = subscription.clientInfo.connection;
                if (ws.readyState !== ws_1.default.OPEN) {
                    logger_1.default.warn('Removing subscription with closed WebSocket connection', {
                        subscriptionId,
                    });
                    this.removeSubscription(subscriptionId).catch(console.error);
                }
            }
        }
        logger_1.default.debug('Subscription health check completed', {
            totalSubscriptions: this.activeSubscriptions.size,
            activeSubscriptions: activeCount,
            errorSubscriptions: errorCount,
            connectedClients: this.connectedClients.size,
        });
    }
    async getHealthStatus() {
        try {
            const details = {
                websocketServer: {
                    port: config_1.default.subscriptions.websocketPort,
                    connectedClients: this.connectedClients.size,
                    maxConnections: config_1.default.subscriptions.maxConnections,
                },
                subscriptions: {
                    total: this.activeSubscriptions.size,
                    active: Array.from(this.activeSubscriptions.values()).filter(s => s.status === 'active').length,
                    error: Array.from(this.activeSubscriptions.values()).filter(s => s.status === 'error').length,
                },
            };
            return { status: 'UP', details };
        }
        catch (error) {
            return {
                status: 'DOWN',
                details: { error: error instanceof Error ? error.message : String(error) },
            };
        }
    }
    async shutdown() {
        logger_1.default.info('Shutting down subscriptions service...');
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        for (const [clientId, ws] of this.connectedClients) {
            ws.close(1001, 'Server shutting down');
        }
        this.connectedClients.clear();
        if (this.wsServer) {
            this.wsServer.close();
        }
        this.activeSubscriptions.clear();
        this.subscriptionPatterns.clear();
        logger_1.default.info('Subscriptions service shutdown complete');
    }
}
exports.SubscriptionsService = SubscriptionsService;
exports.subscriptionsService = new SubscriptionsService();
//# sourceMappingURL=subscriptions.service.js.map