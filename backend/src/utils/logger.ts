import path from 'path';

import winston from 'winston';

import config from '../config';

// Type definitions for structured logging metadata
type LogMetadata = Record<string, unknown> | object;

interface CustomLogMethods {
  fhir: (message: string, meta?: LogMetadata) => void;
  security: (message: string, meta?: LogMetadata) => void;
  performance: (message: string, meta?: LogMetadata) => void;
  audit: (message: string, meta?: LogMetadata) => void;
  integration: (message: string, meta?: LogMetadata) => void;
}

// Fallback config for tests and environments where config import fails
const fallbackConfig = {
  server: { env: process.env.NODE_ENV || 'test' },
  logging: { level: 'info', file: '/tmp/test.log' }
};

// Use imported config or fallback
const loggerConfig = config || fallbackConfig;

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
  winston.format.printf(({ timestamp, level, message, ...meta }: winston.Logform.TransformableInfo) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${String(timestamp)} [${String(level)}]: ${String(message)} ${metaStr}`;
  })
);

// Create transports array
const transports: winston.transport[] = [];

// Console transport for all environments
transports.push(
  new winston.transports.Console({
    level: loggerConfig.server.env === 'development' ? 'debug' : 'info',
    format: loggerConfig.server.env === 'development' ? consoleFormat : customFormat,
    handleExceptions: true,
    handleRejections: true,
  })
);

// File transport for production
if (loggerConfig.server.env === 'production') {
  // Ensure logs directory exists
  const logDir = path.dirname(loggerConfig.logging.file);
  
  transports.push(
    // General log file
    new winston.transports.File({
      filename: loggerConfig.logging.file,
      level: loggerConfig.logging.level,
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
  level: loggerConfig.logging.level,
  format: customFormat,
  transports,
  exitOnError: false,
});

// Extend logger with custom methods
type CustomLogger = winston.Logger & CustomLogMethods;
const customLogger = logger as CustomLogger;

customLogger.fhir = (message: string, meta?: LogMetadata) => {
  logger.info(message, { context: 'FHIR', ...meta });
};

customLogger.security = (message: string, meta?: LogMetadata) => {
  logger.warn(message, { context: 'SECURITY', ...meta });
};

customLogger.performance = (message: string, meta?: LogMetadata) => {
  logger.info(message, { context: 'PERFORMANCE', ...meta });
};

customLogger.audit = (message: string, meta?: LogMetadata) => {
  logger.info(message, { context: 'AUDIT', ...meta });
};

customLogger.integration = (message: string, meta?: LogMetadata) => {
  logger.info(message, { context: 'INTEGRATION', ...meta });
};

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default customLogger;