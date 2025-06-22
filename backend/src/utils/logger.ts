import path from 'path';

import winston from 'winston';

// Import config with fallback for tests
let config: any;
try {
  const configModule = require('../config');
  config = configModule.default || configModule;
  // Ensure config is properly structured
  if (!config || !config.server) {
    throw new Error('Invalid config structure');
  }
} catch (error) {
  // Mock config for tests
  config = {
    server: { env: process.env.NODE_ENV || 'test' },
    logging: { level: 'info', file: '/tmp/test.log' }
  };
}

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

// Create transports array
const transports: winston.transport[] = [];

// Console transport for all environments
transports.push(
  new winston.transports.Console({
    level: config.server.env === 'development' ? 'debug' : 'info',
    format: config.server.env === 'development' ? consoleFormat : customFormat,
    handleExceptions: true,
    handleRejections: true,
  })
);

// File transport for production
if (config.server.env === 'production') {
  // Ensure logs directory exists
  const logDir = path.dirname(config.logging.file);
  
  transports.push(
    // General log file
    new winston.transports.File({
      filename: config.logging.file,
      level: config.logging.level,
      format: customFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
      handleExceptions: true,
      handleRejections: true,
    }),
    
    // Error log file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: customFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
      handleExceptions: true,
      handleRejections: true,
    })
  );
}

// Create the logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: customFormat,
  transports,
  exitOnError: false,
});

// Add custom logging methods for different contexts
interface CustomLogger extends winston.Logger {
  fhir: (message: string, meta?: any) => void;
  security: (message: string, meta?: any) => void;
  performance: (message: string, meta?: any) => void;
  audit: (message: string, meta?: any) => void;
  integration: (message: string, meta?: any) => void;
}

// Extend logger with custom methods
const customLogger = logger as CustomLogger;

customLogger.fhir = (message: string, meta?: any) => {
  logger.info(message, { context: 'FHIR', ...meta });
};

customLogger.security = (message: string, meta?: any) => {
  logger.warn(message, { context: 'SECURITY', ...meta });
};

customLogger.performance = (message: string, meta?: any) => {
  logger.info(message, { context: 'PERFORMANCE', ...meta });
};

customLogger.audit = (message: string, meta?: any) => {
  logger.info(message, { context: 'AUDIT', ...meta });
};

customLogger.integration = (message: string, meta?: any) => {
  logger.info(message, { context: 'INTEGRATION', ...meta });
};

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default customLogger;