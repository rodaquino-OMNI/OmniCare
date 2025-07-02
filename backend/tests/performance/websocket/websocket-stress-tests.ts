/**
 * WebSocket Performance and Stress Tests
 * Tests for subscription and real-time update performance
 */

import { performance } from 'perf_hooks';

import WebSocket from 'ws';

import { PerformanceTestBase, TestConfiguration } from '../framework/performance-test-base';

export interface WebSocketMetrics {
  connectionsEstablished: number;
  connectionFailures: number;
  messagesReceived: number;
  messagesSent: number;
  avgConnectionTime: number;
  avgMessageLatency: number;
  subscriptionsActive: number;
  memoryUsage: number;
  maxConcurrentConnections: number;
}

export class WebSocketStressTests extends PerformanceTestBase {
  private baseUrl: string;
  private connections: Map<string, WebSocket> = new Map();
  private connectionTimes: Map<string, number> = new Map();
  private messageLatencies: number[] = [];
  private subscriptions: Map<string, any> = new Map();
  private wsMetrics: WebSocketMetrics;

  constructor(config: TestConfiguration, baseUrl: string = 'ws://localhost:8081') {
    super(config);
    this.baseUrl = baseUrl;
    this.wsMetrics = this.initializeWSMetrics();
  }

  private initializeWSMetrics(): WebSocketMetrics {
    return {
      connectionsEstablished: 0,
      connectionFailures: 0,
      messagesReceived: 0,
      messagesSent: 0,
      avgConnectionTime: 0,
      avgMessageLatency: 0,
      subscriptionsActive: 0,
      memoryUsage: 0,
      maxConcurrentConnections: 0
    };
  }

  /**
   * Test WebSocket connection performance under load
   */
  async testConnectionStress(): Promise<void> {
    console.log('Starting WebSocket connection stress test...');
    this.startMonitoring();

    const promises: Promise<void>[] = [];
    const connectionsPerWorker = Math.ceil(this.config.concurrency / 4);

    for (let worker = 0; worker < 4; worker++) {
      promises.push(this.connectionWorker(connectionsPerWorker, worker));
    }

    await Promise.all(promises);
    await this.calculateMetrics();
  }

  private async connectionWorker(connectionCount: number, workerId: number): Promise<void> {
    for (let i = 0; i < connectionCount; i++) {
      const connectionId = `worker-${workerId}-conn-${i}`;
      const startTime = performance.now();
      let isError = false;

      try {
        await this.establishConnection(connectionId);
        const connectionTime = performance.now() - startTime;
        this.connectionTimes.set(connectionId, connectionTime);
        this.wsMetrics.connectionsEstablished++;
        
        // Keep connection alive for a period
        await this.sleep(Math.random() * 5000 + 1000); // 1-6 seconds
        
      } catch (error) {
        isError = true;
        this.wsMetrics.connectionFailures++;
      }

      const responseTime = performance.now() - startTime;
      this.recordResponseTime(responseTime, isError);
    }
  }

  /**
   * Establish WebSocket connection with authentication
   */
  private async establishConnection(connectionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.baseUrl, {
        headers: {
          'Authorization': `Bearer ${this.getTestToken()}`,
          'X-Connection-ID': connectionId
        }
      });

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 10000);

      ws.on('open', () => {
        clearTimeout(timeout);
        this.connections.set(connectionId, ws);
        this.wsMetrics.maxConcurrentConnections = Math.max(
          this.wsMetrics.maxConcurrentConnections,
          this.connections.size
        );
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      ws.on('message', (data) => {
        this.handleMessage(connectionId, data);
      });

      ws.on('close', () => {
        this.connections.delete(connectionId);
        this.connectionTimes.delete(connectionId);
      });
    });
  }

  /**
   * Test subscription performance
   */
  async testSubscriptionPerformance(): Promise<void> {
    console.log('Starting subscription performance test...');
    this.startMonitoring();

    // First establish connections
    await this.establishMultipleConnections(this.config.concurrency);

    // Create subscriptions on all connections
    const subscriptionPromises: Promise<void>[] = [];
    
    for (const [connectionId, ws] of this.connections) {
      subscriptionPromises.push(this.createSubscription(connectionId, ws));
    }

    await Promise.all(subscriptionPromises);

    // Generate events to trigger subscriptions
    await this.generateSubscriptionEvents();

    // Monitor for a period
    await this.sleep(30000); // 30 seconds

    await this.calculateMetrics();
  }

  private async establishMultipleConnections(count: number): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < count; i++) {
      promises.push(this.establishConnection(`sub-test-${i}`));
    }

    await Promise.all(promises);
  }

  private async createSubscription(connectionId: string, ws: WebSocket): Promise<void> {
    const subscriptionTypes = [
      {
        criteria: 'Patient?active=true',
        resource: 'Patient'
      },
      {
        criteria: 'Observation?category=vital-signs',
        resource: 'Observation'
      },
      {
        criteria: 'Encounter?status=in-progress',
        resource: 'Encounter'
      },
      {
        criteria: 'MedicationRequest?status=active',
        resource: 'MedicationRequest'
      }
    ];

    const subscription = subscriptionTypes[Math.floor(Math.random() * subscriptionTypes.length)];
    
    const subscriptionRequest = {
      type: 'subscribe',
      criteria: subscription.criteria,
      connectionId: connectionId,
      timestamp: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Subscription timeout'));
      }, 5000);

      const messageHandler = (data: any) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscription-confirmed' && message.connectionId === connectionId) {
            clearTimeout(timeout);
            this.subscriptions.set(connectionId, subscription);
            this.wsMetrics.subscriptionsActive++;
            ws.off('message', messageHandler);
            resolve();
          }
        } catch (error) {
          // Ignore parse errors for other messages
        }
      };

      ws.on('message', messageHandler);
      ws.send(JSON.stringify(subscriptionRequest));
      this.wsMetrics.messagesSent++;
    });
  }

  private async generateSubscriptionEvents(): Promise<void> {
    console.log('Generating events to trigger subscriptions...');
    
    // Simulate creating resources that would trigger subscriptions
    const eventTypes = [
      'patient-created',
      'observation-created',
      'encounter-updated',
      'medication-prescribed'
    ];

    for (let i = 0; i < 1000; i++) {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      
      // Simulate event by sending message to all connections
      const event = {
        type: 'resource-event',
        resourceType: eventType.split('-')[0],
        action: eventType.split('-')[1],
        resourceId: `test-resource-${i}`,
        timestamp: new Date().toISOString()
      };

      // Send to random subset of connections to simulate targeted notifications
      const targetConnections = Array.from(this.connections.keys())
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.ceil(this.connections.size * 0.3));

      for (const connectionId of targetConnections) {
        const ws = this.connections.get(connectionId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(event));
          this.wsMetrics.messagesSent++;
        }
      }

      // Small delay between events
      if (i % 50 === 0) {
        await this.sleep(100);
      }
    }
  }

  /**
   * Test message throughput under high load
   */
  async testMessageThroughput(): Promise<void> {
    console.log('Starting message throughput test...');
    this.startMonitoring();

    // Establish connections
    await this.establishMultipleConnections(Math.min(this.config.concurrency, 100));

    const promises: Promise<void>[] = [];
    const messagesPerConnection = 1000;

    for (const [connectionId, ws] of this.connections) {
      promises.push(this.messageWorker(connectionId, ws, messagesPerConnection));
    }

    await Promise.all(promises);
    await this.calculateMetrics();
  }

  private async messageWorker(connectionId: string, ws: WebSocket, messageCount: number): Promise<void> {
    for (let i = 0; i < messageCount; i++) {
      const startTime = performance.now();
      let isError = false;

      try {
        const message = {
          type: 'ping',
          connectionId: connectionId,
          sequence: i,
          timestamp: startTime,
          payload: `test-message-${i}-${Math.random().toString(36).substr(2, 9)}`
        };

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
          this.wsMetrics.messagesSent++;
        } else {
          throw new Error('WebSocket not open');
        }
      } catch (error) {
        isError = true;
      }

      const responseTime = performance.now() - startTime;
      this.recordResponseTime(responseTime, isError);

      // Small delay to prevent overwhelming
      if (i % 100 === 0) {
        await this.sleep(10);
      }
    }
  }

  /**
   * Test connection recovery and resilience
   */
  async testConnectionResilience(): Promise<void> {
    console.log('Starting connection resilience test...');
    this.startMonitoring();

    // Establish initial connections
    await this.establishMultipleConnections(50);

    // Randomly close connections and attempt reconnection
    const resiliencePromises: Promise<void>[] = [];
    
    for (let cycle = 0; cycle < 10; cycle++) {
      resiliencePromises.push(this.resilienceCycle(cycle));
    }

    await Promise.all(resiliencePromises);
    await this.calculateMetrics();
  }

  private async resilienceCycle(cycle: number): Promise<void> {
    // Close random connections
    const connectionsToClose = Array.from(this.connections.keys())
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.ceil(this.connections.size * 0.2)); // Close 20% of connections

    for (const connectionId of connectionsToClose) {
      const ws = this.connections.get(connectionId);
      if (ws) {
        ws.close();
      }
    }

    await this.sleep(1000); // Wait 1 second

    // Attempt to reconnect
    const reconnectPromises: Promise<void>[] = [];
    for (const connectionId of connectionsToClose) {
      reconnectPromises.push(
        this.establishConnection(`${connectionId}-reconnect-${cycle}`)
          .catch(() => {
            // Ignore reconnection failures for resilience testing
          })
      );
    }

    await Promise.all(reconnectPromises);
    await this.sleep(2000); // Wait 2 seconds before next cycle
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(connectionId: string, data: any): void {
    try {
      const message = JSON.parse(data.toString());
      this.wsMetrics.messagesReceived++;
      
      // Calculate message latency if timestamp is present
      if (message.timestamp) {
        const latency = performance.now() - message.timestamp;
        this.messageLatencies.push(latency);
      }

      // Handle specific message types
      switch (message.type) {
        case 'pong':
          // Response to ping message
          break;
        case 'subscription-notification':
          // Subscription event received
          break;
        case 'error':
          console.warn(`WebSocket error on ${connectionId}:`, message.error);
          break;
      }
    } catch (error) {
      console.warn(`Failed to parse WebSocket message on ${connectionId}:`, error);
    }
  }

  /**
   * Get test authentication token
   */
  private getTestToken(): string {
    // In a real implementation, this would get a valid JWT token
    return 'test-websocket-token';
  }

  /**
   * Generate WebSocket performance report
   */
  generateWebSocketReport(): string {
    // Calculate additional WebSocket-specific metrics
    this.wsMetrics.avgConnectionTime = Array.from(this.connectionTimes.values())
      .reduce((sum, time) => sum + time, 0) / this.connectionTimes.size || 0;

    this.wsMetrics.avgMessageLatency = this.messageLatencies
      .reduce((sum, latency) => sum + latency, 0) / this.messageLatencies.length || 0;

    this.wsMetrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB

    return `
WebSocket Performance Test Report
================================

Connection Performance:
- Connections Established: ${this.wsMetrics.connectionsEstablished}
- Connection Failures: ${this.wsMetrics.connectionFailures}
- Max Concurrent Connections: ${this.wsMetrics.maxConcurrentConnections}
- Avg Connection Time: ${this.wsMetrics.avgConnectionTime.toFixed(2)}ms

Message Performance:
- Messages Sent: ${this.wsMetrics.messagesSent}
- Messages Received: ${this.wsMetrics.messagesReceived}
- Avg Message Latency: ${this.wsMetrics.avgMessageLatency.toFixed(2)}ms

Subscription Performance:
- Active Subscriptions: ${this.wsMetrics.subscriptionsActive}
- Success Rate: ${(this.wsMetrics.connectionsEstablished / (this.wsMetrics.connectionsEstablished + this.wsMetrics.connectionFailures) * 100).toFixed(2)}%

Resource Usage:
- Memory Usage: ${this.wsMetrics.memoryUsage.toFixed(2)}MB

Base Performance Metrics:
${this.generateReport()}

WebSocket Recommendations:
${this.generateWebSocketRecommendations()}
    `.trim();
  }

  private generateWebSocketRecommendations(): string {
    const recommendations: string[] = [];
    
    if (this.wsMetrics.connectionFailures > this.wsMetrics.connectionsEstablished * 0.05) {
      recommendations.push('- High connection failure rate detected - check server capacity');
    }
    
    if (this.wsMetrics.avgMessageLatency > 1000) {
      recommendations.push('- High message latency - consider message queuing optimization');
    }
    
    if (this.wsMetrics.maxConcurrentConnections > 1000) {
      recommendations.push('- High concurrent connections - monitor server resources');
    }
    
    if (this.wsMetrics.memoryUsage > 1000) {
      recommendations.push('- High memory usage - review connection management');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('- WebSocket performance appears optimal');
    }
    
    return recommendations.join('\n');
  }

  /**
   * Cleanup WebSocket connections
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up WebSocket connections...');
    
    for (const [connectionId, ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    
    this.connections.clear();
    this.connectionTimes.clear();
    this.subscriptions.clear();
    
    console.log('WebSocket cleanup completed');
  }
}