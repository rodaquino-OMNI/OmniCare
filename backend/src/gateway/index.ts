/**
 * OmniCare EMR API Gateway - Stub Implementation
 * Minimal stub for build compatibility
 */

import http from 'http';

import express, { Application } from 'express';

import logger from '../utils/logger';

interface GatewayConfig {
  port?: number;
  host?: string;
  timeout?: number;
}

export class ApiGateway {
  private app: Application;
  private server?: http.Server;

  constructor(_config?: GatewayConfig) {
    this.app = express();
    logger.info('API Gateway initialized (stub mode)');
  }

  start(port: number = 8080): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        logger.info(`API Gateway started on port ${port} (stub mode)`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('API Gateway stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getApp(): Application {
    return this.app;
  }
}

export default ApiGateway;