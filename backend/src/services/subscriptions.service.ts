import { EventEmitter } from 'events';

import { Subscription, Bundle } from '@medplum/fhirtypes';
import WebSocket from 'ws';

import { medplumService } from './medplum.service';

import config from '@/config';
import { SubscriptionConfig } from '@/types/fhir';
import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error.utils';

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

/**
 * FHIR Subscriptions and Real-time Updates Service
 * Implements FHIR R4 Subscription framework with WebSocket and REST-hook support
 */
export class SubscriptionsService extends EventEmitter {
  private activeSubscriptions = new Map<string, ActiveSubscription>();
  private wsServer?: WebSocket.Server;
  private connectedClients = new Map<string, WebSocket>();
  private subscriptionPatterns = new Map<string, RegExp>();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.setupWebSocketServer();
    this.startHealthCheck();
  }

  // ===============================
  // WEBSOCKET SERVER SETUP
  // ===============================

  /**
   * Setup WebSocket server for real-time subscriptions
   */
  private setupWebSocketServer(): void {
    try {
      this.wsServer = new WebSocket.Server({
        port: config.subscriptions.websocketPort,
        maxPayload: 1024 * 1024, // 1MB
        perMessageDeflate: true,
      });

      this.wsServer.on('connection', (ws, request) => {
        this.handleWebSocketConnection(ws, request);
      });

      this.wsServer.on('error', (error) => {
        logger.error('WebSocket server error:', error);
      });

      logger.info(`WebSocket server started on port ${config.subscriptions.websocketPort}`);
    } catch (error) {
      logger.error('Failed to setup WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleWebSocketConnection(ws: WebSocket, request: any): void {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      remoteAddress: request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      connectedAt: new Date(),
    };

    logger.info('WebSocket client connected', clientInfo);

    // Store connection
    this.connectedClients.set(clientId, ws);

    // Handle messages from client
    ws.on('message', (data) => {
      this.handleWebSocketMessage(clientId, data);
    });

    // Handle connection close
    ws.on('close', (code, reason) => {
      logger.info('WebSocket client disconnected', {
        clientId,
        code,
        reason: reason.toString(),
      });
      this.connectedClients.delete(clientId);
      this.removeClientSubscriptions(clientId);
    });

    // Handle connection errors
    ws.on('error', (error) => {
      logger.error('WebSocket client error:', { clientId, error });
      this.connectedClients.delete(clientId);
      this.removeClientSubscriptions(clientId);
    });

    // Send welcome message
    this.sendWebSocketMessage(clientId, {
      type: 'welcome',
      clientId,
      timestamp: new Date().toISOString(),
      supportedChannels: ['websocket', 'rest-hook'],
    });
  }

  /**
   * Handle WebSocket messages from clients
   */
  private handleWebSocketMessage(clientId: string, data: WebSocket.RawData): void {
    try {
      const message = JSON.parse(data.toString());
      logger.debug('WebSocket message received', { clientId, type: message.type });

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
          logger.warn('Unknown WebSocket message type', { clientId, type: message.type });
      }
    } catch (error) {
      logger.error('Failed to handle WebSocket message:', { clientId, error });
      this.sendWebSocketMessage(clientId, {
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle WebSocket subscription request
   */
  private async handleWebSocketSubscribe(clientId: string, message: any): Promise<void> {
    try {
      const subscriptionConfig: SubscriptionConfig = {
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

      logger.info('WebSocket subscription created', { clientId, subscriptionId, criteria: message.criteria });
    } catch (error) {
      logger.error('Failed to create WebSocket subscription:', { clientId, error });
      this.sendWebSocketMessage(clientId, {
        type: 'error',
        message: 'Failed to create subscription',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle WebSocket unsubscribe request
   */
  private async handleWebSocketUnsubscribe(clientId: string, message: any): Promise<void> {
    try {
      await this.removeSubscription(message.subscriptionId);
      
      this.sendWebSocketMessage(clientId, {
        type: 'subscription-removed',
        subscriptionId: message.subscriptionId,
        timestamp: new Date().toISOString(),
      });

      logger.info('WebSocket subscription removed', { clientId, subscriptionId: message.subscriptionId });
    } catch (error) {
      logger.error('Failed to remove WebSocket subscription:', { clientId, error });
      this.sendWebSocketMessage(clientId, {
        type: 'error',
        message: 'Failed to remove subscription',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Send WebSocket message to client
   */
  private sendWebSocketMessage(clientId: string, message: any): void {
    const ws = this.connectedClients.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // ===============================
  // SUBSCRIPTION MANAGEMENT
  // ===============================

  /**
   * Create a new FHIR subscription
   */
  async createSubscription(
    subscriptionConfig: SubscriptionConfig,
    clientInfo?: any
  ): Promise<string> {
    try {
      // Create FHIR Subscription resource
      const subscription: Subscription = {
        resourceType: 'Subscription',
        status: subscriptionConfig.status,
        reason: subscriptionConfig.reason,
        criteria: subscriptionConfig.criteria,
        channel: {
          type: subscriptionConfig.channel.type as any,
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

      const createdSubscription = await medplumService.createResource(subscription);
      
      if (!createdSubscription.id) {
        throw new Error('Failed to create subscription - no ID returned');
      }

      // Store active subscription
      const activeSubscription: ActiveSubscription = {
        id: createdSubscription.id,
        criteria: subscriptionConfig.criteria,
        channel: subscriptionConfig.channel,
        status: 'active',
        clientInfo,
        errorCount: 0,
        createdAt: new Date(),
      };

      this.activeSubscriptions.set(createdSubscription.id, activeSubscription);

      // Compile criteria pattern for efficient matching
      this.compileSubscriptionPattern(createdSubscription.id, subscriptionConfig.criteria);

      logger.info('FHIR subscription created', {
        subscriptionId: createdSubscription.id,
        criteria: subscriptionConfig.criteria,
        channelType: subscriptionConfig.channel.type,
      });

      return createdSubscription.id;
    } catch (error) {
      logger.error('Failed to create FHIR subscription:', error);
      throw error;
    }
  }

  /**
   * Remove a subscription
   */
  async removeSubscription(subscriptionId: string): Promise<void> {
    try {
      // Update FHIR subscription status to 'off'
      const subscription = await medplumService.readResource<Subscription>('Subscription', subscriptionId);
      subscription.status = 'off';
      await medplumService.updateResource(subscription);

      // Remove from active subscriptions
      this.activeSubscriptions.delete(subscriptionId);
      this.subscriptionPatterns.delete(subscriptionId);

      logger.info('Subscription removed', { subscriptionId });
    } catch (error) {
      logger.error('Failed to remove subscription:', { subscriptionId, error });
      throw error;
    }
  }

  /**
   * List active subscriptions
   */
  listActiveSubscriptions(): ActiveSubscription[] {
    return Array.from(this.activeSubscriptions.values());
  }

  /**
   * Get subscription by ID
   */
  getSubscription(subscriptionId: string): ActiveSubscription | undefined {
    return this.activeSubscriptions.get(subscriptionId);
  }

  // ===============================
  // NOTIFICATION PROCESSING
  // ===============================

  /**
   * Process resource change and send notifications
   */
  async processResourceChange(
    resourceType: string,
    resourceId: string,
    operation: 'create' | 'update' | 'delete',
    resource?: any
  ): Promise<void> {
    try {
      const resourcePath = `${resourceType}/${resourceId}`;
      
      logger.debug('Processing resource change', {
        resourceType,
        resourceId,
        operation,
      });

      // Find matching subscriptions
      const matchingSubscriptions = this.findMatchingSubscriptions(resourcePath, operation);

      if (matchingSubscriptions.length === 0) {
        logger.debug('No matching subscriptions found', { resourcePath, operation });
        return;
      }

      // Create notification bundle
      const bundle = await this.createNotificationBundle(
        resourceType,
        resourceId,
        operation,
        resource,
        matchingSubscriptions
      );

      // Send notifications to each matching subscription
      for (const subscription of matchingSubscriptions) {
        await this.sendNotification(subscription, bundle);
      }

      logger.debug('Resource change notifications sent', {
        resourcePath,
        operation,
        notificationsSent: matchingSubscriptions.length,
      });
    } catch (error) {
      logger.error('Failed to process resource change:', {
        resourceType,
        resourceId,
        operation,
        error,
      });
    }
  }

  /**
   * Find subscriptions matching the resource change
   */
  private findMatchingSubscriptions(
    resourcePath: string,
    operation: string
  ): ActiveSubscription[] {
    const matchingSubscriptions: ActiveSubscription[] = [];

    for (const [subscriptionId, subscription] of this.activeSubscriptions) {
      if (subscription.status !== 'active') continue;

      const pattern = this.subscriptionPatterns.get(subscriptionId);
      if (pattern && pattern.test(resourcePath)) {
        matchingSubscriptions.push(subscription);
      }
    }

    return matchingSubscriptions;
  }

  /**
   * Create notification bundle
   */
  private async createNotificationBundle(
    resourceType: string,
    resourceId: string,
    operation: string,
    resource: any,
    subscriptions: ActiveSubscription[]
  ): Promise<Bundle> {
    const bundle: Bundle = {
      resourceType: 'Bundle',
      id: `notification-${Date.now()}`,
      type: 'history',
      timestamp: new Date().toISOString(),
      entry: [],
    };

    // Add the changed resource to the bundle
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
    } else if (operation === 'delete') {
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

  /**
   * Send notification to subscription
   */
  private async sendNotification(
    subscription: ActiveSubscription,
    bundle: Bundle
  ): Promise<void> {
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
          logger.warn('Unsupported subscription channel type', {
            subscriptionId: subscription.id,
            channelType: subscription.channel.type,
          });
      }

      // Reset error count on successful notification
      subscription.errorCount = 0;
    } catch (error) {
      logger.error('Failed to send notification:', {
        subscriptionId: subscription.id,
        channelType: subscription.channel.type,
        error,
      });

      subscription.errorCount++;
      
      // Disable subscription after too many errors
      if (subscription.errorCount >= 5) {
        subscription.status = 'error';
        logger.error('Subscription disabled due to repeated errors', {
          subscriptionId: subscription.id,
        });
      }
    }
  }

  /**
   * Send WebSocket notification
   */
  private async sendWebSocketNotification(
    subscription: ActiveSubscription,
    bundle: Bundle
  ): Promise<void> {
    if (!subscription.clientInfo?.connection) {
      throw new Error('WebSocket connection not available');
    }

    const ws = subscription.clientInfo.connection;
    if (ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection not open');
    }

    const notification = {
      type: 'notification',
      subscriptionId: subscription.id,
      timestamp: new Date().toISOString(),
      bundle,
    };

    ws.send(JSON.stringify(notification));
    
    logger.debug('WebSocket notification sent', {
      subscriptionId: subscription.id,
      clientId: subscription.clientInfo.clientId,
    });
  }

  /**
   * Send REST hook notification
   */
  private async sendRestHookNotification(
    subscription: ActiveSubscription,
    bundle: Bundle
  ): Promise<void> {
    if (!subscription.channel.endpoint) {
      throw new Error('REST hook endpoint not configured');
    }

    const axios = (await import('axios')).default;
    
    const headers: Record<string, string> = {
      'Content-Type': subscription.channel.payload || 'application/fhir+json',
      'User-Agent': 'OmniCare-FHIR-Subscriptions/1.0',
    };

    // Add custom headers if configured
    if (subscription.channel.headers) {
      Object.assign(headers, subscription.channel.headers);
    }

    await axios.post(subscription.channel.endpoint, bundle, {
      headers,
      timeout: 30000,
    });

    logger.debug('REST hook notification sent', {
      subscriptionId: subscription.id,
      endpoint: subscription.channel.endpoint,
    });
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmailNotification(
    subscription: ActiveSubscription,
    bundle: Bundle
  ): Promise<void> {
    // Placeholder for email notification implementation
    logger.info('Email notification would be sent', {
      subscriptionId: subscription.id,
    });
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Compile subscription criteria to regex pattern
   */
  private compileSubscriptionPattern(subscriptionId: string, criteria: string): void {
    try {
      // Simple criteria parsing - in practice, this would be more sophisticated
      // Example: "Patient?status=active" -> /^Patient\/.*$/
      const [resourceType] = criteria.split('?');
      const pattern = new RegExp(`^${resourceType}/.*$`);
      this.subscriptionPatterns.set(subscriptionId, pattern);
    } catch (error) {
      logger.error('Failed to compile subscription pattern:', {
        subscriptionId,
        criteria,
        error,
      });
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Remove all subscriptions for a client
   */
  private removeClientSubscriptions(clientId: string): void {
    const subscriptionsToRemove: string[] = [];

    for (const [subscriptionId, subscription] of this.activeSubscriptions) {
      if (subscription.clientInfo?.clientId === clientId) {
        subscriptionsToRemove.push(subscriptionId);
      }
    }

    subscriptionsToRemove.forEach(subscriptionId => {
      this.removeSubscription(subscriptionId).catch(error => {
        logger.error('Failed to remove client subscription:', { subscriptionId, error });
      });
    });

    logger.info('Client subscriptions removed', {
      clientId,
      subscriptionsRemoved: subscriptionsToRemove.length,
    });
  }

  /**
   * Start health check for subscriptions
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Check every minute
  }

  /**
   * Perform health check on active subscriptions
   */
  private performHealthCheck(): void {
    const now = new Date();
    let activeCount = 0;
    let errorCount = 0;

    for (const [subscriptionId, subscription] of this.activeSubscriptions) {
      if (subscription.status === 'active') {
        activeCount++;
      } else if (subscription.status === 'error') {
        errorCount++;
      }

      // Check for stale WebSocket connections
      if (subscription.channel.type === 'websocket' && subscription.clientInfo?.connection) {
        const ws = subscription.clientInfo.connection;
        if (ws.readyState !== WebSocket.OPEN) {
          logger.warn('Removing subscription with closed WebSocket connection', {
            subscriptionId,
          });
          this.removeSubscription(subscriptionId).catch(console.error);
        }
      }
    }

    logger.debug('Subscription health check completed', {
      totalSubscriptions: this.activeSubscriptions.size,
      activeSubscriptions: activeCount,
      errorSubscriptions: errorCount,
      connectedClients: this.connectedClients.size,
    });
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{ status: string; details: any }> {
    try {
      const details = {
        websocketServer: {
          port: config.subscriptions.websocketPort,
          connectedClients: this.connectedClients.size,
          maxConnections: config.subscriptions.maxConnections,
        },
        subscriptions: {
          total: this.activeSubscriptions.size,
          active: Array.from(this.activeSubscriptions.values()).filter(s => s.status === 'active').length,
          error: Array.from(this.activeSubscriptions.values()).filter(s => s.status === 'error').length,
        },
      };

      return { status: 'UP', details };
    } catch (error) {
      return {
        status: 'DOWN',
        details: { error: getErrorMessage(error) },
      };
    }
  }

  /**
   * Shutdown subscriptions service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down subscriptions service...');

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close all WebSocket connections
    for (const [clientId, ws] of this.connectedClients) {
      ws.close(1001, 'Server shutting down');
    }
    this.connectedClients.clear();

    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
    }

    // Clear active subscriptions
    this.activeSubscriptions.clear();
    this.subscriptionPatterns.clear();

    logger.info('Subscriptions service shutdown complete');
  }
}

// Export singleton instance
export const subscriptionsService = new SubscriptionsService();