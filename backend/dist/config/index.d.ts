interface Config {
    server: {
        port: number;
        host: string;
        env: string;
    };
    database: {
        url: string;
        connectionPoolSize: number;
    };
    redis: {
        url: string;
    };
    medplum: {
        baseUrl: string;
        clientId: string;
        clientSecret: string;
        projectId: string;
        selfHosted: boolean;
        selfHostedUrl?: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
        refreshExpiresIn: string;
    };
    fhir: {
        version: string;
        baseUrl: string;
    };
    smart: {
        authorizationUrl: string;
        tokenUrl: string;
        introspectionUrl: string;
        scopes: string[];
    };
    cdsHooks: {
        discoveryUrl: string;
        baseUrl: string;
    };
    ehr: {
        integrationEnabled: boolean;
        systems: string[];
        epic: {
            clientId: string;
            privateKeyPath: string;
            fhirBaseUrl: string;
        };
        cerner: {
            clientId: string;
            clientSecret: string;
            fhirBaseUrl: string;
        };
    };
    hl7v2: {
        enabled: boolean;
        port: number;
        host: string;
    };
    logging: {
        level: string;
        file: string;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
    };
    subscriptions: {
        websocketPort: number;
        maxConnections: number;
    };
    performance: {
        cacheTtl: number;
        maxRequestSize: string;
    };
}
declare const config: Config;
export default config;
//# sourceMappingURL=index.d.ts.map