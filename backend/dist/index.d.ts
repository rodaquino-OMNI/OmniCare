import express from 'express';
declare class OmniCareServer {
    private app;
    private server?;
    constructor();
    private setupMiddleware;
    private setupRoutes;
    private setupErrorHandling;
    private initializeServices;
    start(): Promise<void>;
    private setupGracefulShutdown;
    getApp(): express.Application;
}
declare const server: OmniCareServer;
export default server;
//# sourceMappingURL=index.d.ts.map