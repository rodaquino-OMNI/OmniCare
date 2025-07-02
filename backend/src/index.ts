import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import config from '@/config';
// Removed unused imports: fhirResourceCache, analyticsCache
import { createEnhancedRateLimit, createAbuseProtectionMiddleware } from '@/middleware/enhanced-rate-limit.middleware';
import routes from '@/routes';
import { databaseService } from '@/services/database.service';
import { medplumService } from '@/services/medplum.service';
import { redisCacheService } from '@/services/redis-cache.service';
import { redisRateLimiterService } from '@/services/redis-rate-limiter.service';
// Removed unused import: redisSessionStore
import { redisService } from '@/services/redis.service';
import { subscriptionsService } from '@/services/subscriptions.service';
import logger from '@/utils/logger';

/**
 * OmniCare EMR FHIR Backend Server
 * Main application entry point with comprehensive FHIR R4 support
 */
class OmniCareServer {
  private app: express.Application;
  private server?: any;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        // In production, maintain a whitelist of allowed origins
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'https://omnicare.com',
          'https://app.omnicare.com',
        ];
        
        if (config.server.env === 'development' || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Accept-Language',
        'Content-Language',
        'X-Requested-With',
        'If-Match',
        'If-None-Match',
        'If-Modified-Since',
        'Cache-Control',
        'Prefer',
      ],
      exposedHeaders: [
        'Content-Location',
        'Location',
        'ETag',
        'Last-Modified',
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
      ],
    }));

    // Request parsing middleware
    this.app.use(express.json({ 
      limit: config.performance.maxRequestSize,
      type: ['application/json', 'application/fhir+json'],
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: config.performance.maxRequestSize,
    }));

    // Compression middleware
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024, // Only compress responses > 1KB
    }));

    // Request logging
    if (config.server.env === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined', {
        stream: {
          write: (message: string) => {
            logger.info(message.trim(), { context: 'HTTP' });
          },
        },
      }));
    }

    // Enhanced rate limiting with Redis
    const generalRateLimit = createEnhancedRateLimit({
      windowMs: config.rateLimit.windowMs,
      maxRequests: config.rateLimit.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'throttled',
          diagnostics: 'Too many requests. Please try again later.',
        }],
      },
    });

    // Apply general rate limiting
    this.app.use(generalRateLimit);

    // Apply abuse protection middleware
    this.app.use(createAbuseProtectionMiddleware());

    // Request ID middleware for tracing
    this.app.use((req, res, next) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      (req as any).requestId = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // Health check endpoint (before authentication)
    this.app.get('/ping', async (_req, res) => {
      try {
        const [dbHealth, redisHealth] = await Promise.all([
          databaseService.checkHealth(),
          redisCacheService.checkHealth()
        ]);
        
        const overallStatus = dbHealth.status === 'healthy' && redisHealth.status === 'healthy' ? 'OK' : 'DEGRADED';
        
        res.json({ 
          status: overallStatus, 
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          database: dbHealth,
          cache: redisHealth,
          performance: {
            uptime: Math.floor(process.uptime()),
            memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
          }
        });
      } catch (error) {
        res.json({ 
          status: 'ERROR', 
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          database: { status: 'unknown', message: 'Health check failed' },
          cache: { status: 'unknown', message: 'Health check failed' }
        });
      }
    });
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    // Mount all routes
    this.app.use('/', routes);

    // Serve SMART configuration
    this.app.get('/.well-known/smart_configuration', (_req, res) => {
      const smartConfig = {
        authorization_endpoint: config.smart.authorizationUrl,
        token_endpoint: config.smart.tokenUrl,
        token_endpoint_auth_methods: ['client_secret_basic', 'client_secret_post'],
        registration_endpoint: `${config.fhir.baseUrl}/auth/register`,
        scopes_supported: config.smart.scopes,
        response_types_supported: ['code'],
        management_endpoint: `${config.fhir.baseUrl}/auth/manage`,
        introspection_endpoint: config.smart.introspectionUrl,
        revocation_endpoint: `${config.fhir.baseUrl}/auth/revoke`,
        capabilities: [
          'launch-ehr',
          'launch-standalone',
          'client-public',
          'client-confidential-symmetric',
          'context-ehr-patient',
          'context-ehr-encounter',
          'context-standalone-patient',
          'permission-offline',
          'permission-patient',
          'permission-user',
        ],
        code_challenge_methods_supported: ['S256'],
      };

      res.json(smartConfig);
    });

    // Serve SMART styling configuration
    this.app.get('/smart-style.json', (_req, res) => {
      const smartStyle = {
        color_background: '#ffffff',
        color_error: '#d32f2f',
        color_highlight: '#1976d2',
        color_modal_backdrop: 'rgba(0,0,0,0.5)',
        color_success: '#388e3c',
        color_text: '#333333',
        dim_border_radius: '4px',
        dim_font_size: '14px',
        dim_spacing_size: '8px',
        font_family_body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        font_family_heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      };

      res.json(smartStyle);
    });
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    // Handle uncaught errors
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled application error:', {
        error: err.message,
        stack: err.stack,
        requestId: (req as any).requestId,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Don't leak error details in production
      const message = config.server.env === 'development' ? err.message : 'Internal server error';

      res.status(err.status || 500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: message,
        }],
      });
    });

    // Handle 404 errors
    this.app.use((req: express.Request, res: express.Response) => {
      logger.warn('Route not found:', {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          diagnostics: `Endpoint not found: ${req.method} ${req.url}`,
        }],
      });
    });
  }

  /**
   * Initialize all services
   */
  private async initializeServices(): Promise<void> {
    logger.info('Initializing OmniCare FHIR backend services...');

    try {
      // Initialize Redis services first (needed by other services)
      logger.info('Initializing Redis services...');
      
      // Initialize base Redis service
      await redisService.initialize();
      logger.info('Base Redis service initialized');
      
      // Initialize Redis cache service
      await redisCacheService.initialize();
      const redisHealth = await redisCacheService.checkHealth();
      logger.info('Redis cache service initialized:', redisHealth);
      
      // Initialize Redis session store
      logger.info('Redis session store ready');
      
      // Initialize Redis rate limiter
      logger.info('Redis rate limiter service ready');

      // Initialize database connection
      logger.info('Initializing database connection...');
      await databaseService.initialize();
      await databaseService.ensureAuditSchema();
      logger.info('Database connection established');

      // Check database health
      const dbHealth = await databaseService.checkHealth();
      logger.info('Database health check:', dbHealth);

      // Cache service is ready to use (no specific warmup needed)
      logger.info('Cache service ready for operations');

      // Initialize Medplum service (optional for development)
      try {
        logger.info('Initializing Medplum FHIR server connection...');
        await medplumService.initialize();
        logger.info('Medplum FHIR server connection established');
      } catch (error) {
        logger.warn('Medplum FHIR server connection failed, continuing without external FHIR:', error);
      }

      // Initialize subscriptions service (already initialized in constructor)
      logger.info('Subscriptions service initialized');

      // Log performance metrics
      const cacheStats = redisService.getStats();
      logger.info('Initial Redis statistics:', cacheStats);
      
      // Verify Redis connectivity for all services
      const [baseHealth, cacheHealthCheck, rateLimitStats] = await Promise.all([
        redisService.healthCheck(),
        redisCacheService.checkHealth(),
        redisRateLimiterService.getRateLimitingStats()
      ]);
      
      logger.info('Redis services health check:', {
        base: baseHealth,
        cache: cacheHealthCheck,
        rateLimiter: rateLimitStats
      });

      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      // Start HTTP server first
      this.server = this.app.listen(config.server.port, config.server.host, () => {
        logger.info(`OmniCare FHIR Backend Server started`, {
          host: config.server.host,
          port: config.server.port,
          env: config.server.env,
          fhirBaseUrl: config.fhir.baseUrl,
          websocketPort: config.subscriptions.websocketPort,
        });

        // Log service endpoints
        logger.info('Available endpoints:', {
          fhirBase: `http://${config.server.host}:${config.server.port}/fhir/R4`,
          metadata: `http://${config.server.host}:${config.server.port}/fhir/R4/metadata`,
          authorization: config.smart.authorizationUrl,
          token: config.smart.tokenUrl,
          cdsHooks: `http://${config.server.host}:${config.server.port}/cds-services`,
          health: `http://${config.server.host}:${config.server.port}/health`,
          websocket: `ws://${config.server.host}:${config.subscriptions.websocketPort}`,
        });
      });

      // Initialize services after server is running
      await this.initializeServices();

      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${config.server.port} is already in use`);
        } else {
          logger.error('Server error:', error);
        }
        process.exit(1);
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown handling
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop accepting new connections
        if (this.server) {
          this.server.close(() => {
            logger.info('HTTP server closed');
          });
        }

        // Shutdown subscriptions service
        await subscriptionsService.shutdown();

        // Shutdown Medplum service
        await medplumService.shutdown();
        
        // Shutdown Redis connections
        await Promise.all([
          redisCacheService.shutdown(),
          redisService.shutdown()
        ]);
        logger.info('Redis services shutdown completed');
        
        // Shutdown database connection
        await databaseService.shutdown();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection:', { reason, promise });
      shutdown('unhandledRejection');
    });
  }

  /**
   * Get Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }
}

// Create and start server
const server = new OmniCareServer();

// Start server if this file is run directly
if (require.main === module) {
  server.start().catch((error) => {
    console.error('Failed to start OmniCare FHIR Backend:', error);
    process.exit(1);
  });
}

export default server;