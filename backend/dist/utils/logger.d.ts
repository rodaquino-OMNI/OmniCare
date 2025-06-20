import winston from 'winston';
interface CustomLogger extends winston.Logger {
    fhir: (message: string, meta?: any) => void;
    security: (message: string, meta?: any) => void;
    performance: (message: string, meta?: any) => void;
    audit: (message: string, meta?: any) => void;
    integration: (message: string, meta?: any) => void;
}
declare const customLogger: CustomLogger;
export default customLogger;
//# sourceMappingURL=logger.d.ts.map