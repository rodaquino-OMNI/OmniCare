"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const config_1 = __importDefault(require("@/config"));
const customFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
}), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(meta).length > 0) {
        logMessage += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
        logMessage += `\n${stack}`;
    }
    return logMessage;
}));
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
    format: 'HH:mm:ss',
}), winston_1.default.format.colorize(), winston_1.default.format.printf(({ level, message, timestamp, ...meta }) => {
    let logMessage = `${timestamp} ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
        logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return logMessage;
}));
const transports = [];
transports.push(new winston_1.default.transports.Console({
    level: config_1.default.server.env === 'development' ? 'debug' : 'info',
    format: config_1.default.server.env === 'development' ? consoleFormat : customFormat,
    handleExceptions: true,
    handleRejections: true,
}));
if (config_1.default.server.env === 'production') {
    const logDir = path_1.default.dirname(config_1.default.logging.file);
    transports.push(new winston_1.default.transports.File({
        filename: config_1.default.logging.file,
        level: config_1.default.logging.level,
        format: customFormat,
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
        tailable: true,
        handleExceptions: true,
        handleRejections: true,
    }), new winston_1.default.transports.File({
        filename: path_1.default.join(logDir, 'error.log'),
        level: 'error',
        format: customFormat,
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
        tailable: true,
        handleExceptions: true,
        handleRejections: true,
    }));
}
const logger = winston_1.default.createLogger({
    level: config_1.default.logging.level,
    format: customFormat,
    transports,
    exitOnError: false,
});
const customLogger = logger;
customLogger.fhir = (message, meta) => {
    logger.info(message, { context: 'FHIR', ...meta });
};
customLogger.security = (message, meta) => {
    logger.warn(message, { context: 'SECURITY', ...meta });
};
customLogger.performance = (message, meta) => {
    logger.info(message, { context: 'PERFORMANCE', ...meta });
};
customLogger.audit = (message, meta) => {
    logger.info(message, { context: 'AUDIT', ...meta });
};
customLogger.integration = (message, meta) => {
    logger.info(message, { context: 'INTEGRATION', ...meta });
};
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
exports.default = customLogger;
//# sourceMappingURL=logger.js.map