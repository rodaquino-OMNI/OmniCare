"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const medplum_service_1 = require("@/services/medplum.service");
const subscriptions_service_1 = require("@/services/subscriptions.service");
const config_1 = __importDefault(require("@/config"));
const logger_1 = __importDefault(require("@/utils/logger"));
const routes_1 = __importDefault(require("@/routes"));
class OmniCareServer {
    app;
    server;
    constructor() {
        this.app = (0, express_1.default)();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    setupMiddleware() {
        this.app.use((0, helmet_1.default)({
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
        this.app.use((0, cors_1.default)({
            origin: (origin, callback) => {
                if (!origin)
                    return callback(null, true);
                const allowedOrigins = [
                    'http://localhost:3000',
                    'http://localhost:3001',
                    'https://omnicare.com',
                    'https://app.omnicare.com',
                ];
                if (config_1.default.server.env === 'development' || allowedOrigins.includes(origin)) {
                    callback(null, true);
                }
                else {
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
        this.app.use(express_1.default.json({
            limit: config_1.default.performance.maxRequestSize,
            type: ['application/json', 'application/fhir+json'],
        }));
        this.app.use(express_1.default.urlencoded({
            extended: true,
            limit: config_1.default.performance.maxRequestSize,
        }));
        this.app.use((0, compression_1.default)({
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression_1.default.filter(req, res);
            },
            threshold: 1024,
        }));
        if (config_1.default.server.env === 'development') {
            this.app.use((0, morgan_1.default)('dev'));
        }
        else {
            this.app.use((0, morgan_1.default)('combined', {
                stream: {
                    write: (message) => {
                        logger_1.default.info(message.trim(), { context: 'HTTP' });
                    },
                },
            }));
        }
        const limiter = (0, express_rate_limit_1.default)({
            windowMs: config_1.default.rateLimit.windowMs,
            max: config_1.default.rateLimit.maxRequests,
            message: {
                resourceType: 'OperationOutcome',
                issue: [{
                        severity: 'error',
                        code: 'throttled',
                        diagnostics: 'Too many requests. Please try again later.',
                    }],
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                return req.user?.id || req.ip;
            },
        });
        this.app.use(limiter);
        this.app.use((req, res, next) => {
            const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            req.requestId = requestId;
            res.setHeader('X-Request-ID', requestId);
            next();
        });
        this.app.get('/ping', (req, res) => {
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '1.0.0',
            });
        });
    }
    setupRoutes() {
        this.app.use('/', routes_1.default);
        this.app.get('/.well-known/smart_configuration', (req, res) => {
            const smartConfig = {
                authorization_endpoint: config_1.default.smart.authorizationUrl,
                token_endpoint: config_1.default.smart.tokenUrl,
                token_endpoint_auth_methods: ['client_secret_basic', 'client_secret_post'],
                registration_endpoint: `${config_1.default.fhir.baseUrl}/auth/register`,
                scopes_supported: config_1.default.smart.scopes,
                response_types_supported: ['code'],
                management_endpoint: `${config_1.default.fhir.baseUrl}/auth/manage`,
                introspection_endpoint: config_1.default.smart.introspectionUrl,
                revocation_endpoint: `${config_1.default.fhir.baseUrl}/auth/revoke`,
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
        this.app.get('/smart-style.json', (req, res) => {
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
    setupErrorHandling() {
        this.app.use((err, req, res, next) => {
            logger_1.default.error('Unhandled application error:', {
                error: err.message,
                stack: err.stack,
                requestId: req.requestId,
                url: req.url,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
            });
            const message = config_1.default.server.env === 'development' ? err.message : 'Internal server error';
            res.status(err.status || 500).json({
                resourceType: 'OperationOutcome',
                issue: [{
                        severity: 'error',
                        code: 'exception',
                        diagnostics: message,
                    }],
            });
        });
        this.app.use((req, res) => {
            logger_1.default.warn('Route not found:', {
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
    async initializeServices() {
        logger_1.default.info('Initializing OmniCare FHIR backend services...');
        try {
            logger_1.default.info('Initializing Medplum FHIR server connection...');
            await medplum_service_1.medplumService.initialize();
            logger_1.default.info('Medplum FHIR server connection established');
            logger_1.default.info('Subscriptions service initialized');
            logger_1.default.info('All services initialized successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to initialize services:', error);
            throw error;
        }
    }
    async start() {
        try {
            await this.initializeServices();
            this.server = this.app.listen(config_1.default.server.port, config_1.default.server.host, () => {
                logger_1.default.info(`OmniCare FHIR Backend Server started`, {
                    host: config_1.default.server.host,
                    port: config_1.default.server.port,
                    env: config_1.default.server.env,
                    fhirBaseUrl: config_1.default.fhir.baseUrl,
                    websocketPort: config_1.default.subscriptions.websocketPort,
                });
                logger_1.default.info('Available endpoints:', {
                    fhirBase: `http://${config_1.default.server.host}:${config_1.default.server.port}/fhir/R4`,
                    metadata: `http://${config_1.default.server.host}:${config_1.default.server.port}/fhir/R4/metadata`,
                    authorization: config_1.default.smart.authorizationUrl,
                    token: config_1.default.smart.tokenUrl,
                    cdsHooks: `http://${config_1.default.server.host}:${config_1.default.server.port}/cds-services`,
                    health: `http://${config_1.default.server.host}:${config_1.default.server.port}/health`,
                    websocket: `ws://${config_1.default.server.host}:${config_1.default.subscriptions.websocketPort}`,
                });
            });
            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    logger_1.default.error(`Port ${config_1.default.server.port} is already in use`);
                }
                else {
                    logger_1.default.error('Server error:', error);
                }
                process.exit(1);
            });
            this.setupGracefulShutdown();
        }
        catch (error) {
            logger_1.default.error('Failed to start server:', error);
            process.exit(1);
        }
    }
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger_1.default.info(`Received ${signal}, starting graceful shutdown...`);
            try {
                if (this.server) {
                    this.server.close(() => {
                        logger_1.default.info('HTTP server closed');
                    });
                }
                await subscriptions_service_1.subscriptionsService.shutdown();
                await medplum_service_1.medplumService.shutdown();
                logger_1.default.info('Graceful shutdown completed');
                process.exit(0);
            }
            catch (error) {
                logger_1.default.error('Error during shutdown:', error);
                process.exit(1);
            }
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGHUP', () => shutdown('SIGHUP'));
        process.on('uncaughtException', (error) => {
            logger_1.default.error('Uncaught exception:', error);
            shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.default.error('Unhandled rejection:', { reason, promise });
            shutdown('unhandledRejection');
        });
    }
    getApp() {
        return this.app;
    }
}
const server = new OmniCareServer();
if (require.main === module) {
    server.start().catch((error) => {
        console.error('Failed to start OmniCare FHIR Backend:', error);
        process.exit(1);
    });
}
exports.default = server;
//# sourceMappingURL=index.js.map