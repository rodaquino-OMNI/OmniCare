import * as path from 'path';

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

interface Config {
  // Server Configuration
  server: {
    port: number;
    host: string;
    env: string;
  };

  // Database Configuration
  database: {
    url: string;
    connectionPoolSize: number;
  };

  redis: {
    url: string;
  };

  // Medplum Configuration
  medplum: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    projectId: string;
    selfHosted: boolean;
    selfHostedUrl?: string;
  };

  // JWT Configuration
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };

  // FHIR Configuration
  fhir: {
    version: string;
    baseUrl: string;
  };

  // SMART on FHIR Configuration
  smart: {
    authorizationUrl: string;
    tokenUrl: string;
    introspectionUrl: string;
    scopes: string[];
  };

  // Clinical Decision Support Hooks
  cdsHooks: {
    discoveryUrl: string;
    baseUrl: string;
  };

  // External EHR Integration
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

  // HL7 v2 Interface
  hl7v2: {
    enabled: boolean;
    port: number;
    host: string;
  };

  // Logging
  logging: {
    level: string;
    file: string;
  };

  // Rate Limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };

  // Subscription Configuration
  subscriptions: {
    websocketPort: number;
    maxConnections: number;
  };

  // Performance
  performance: {
    cacheTtl: number;
    maxRequestSize: string;
  };
}

const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '8080', 10),
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development',
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/omnicare_fhir',
    connectionPoolSize: parseInt(process.env.CONNECTION_POOL_SIZE || '10', 10),
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  medplum: {
    baseUrl: process.env.MEDPLUM_BASE_URL || 'https://api.medplum.com/',
    clientId: process.env.MEDPLUM_CLIENT_ID || '',
    clientSecret: process.env.MEDPLUM_CLIENT_SECRET || '',
    projectId: process.env.MEDPLUM_PROJECT_ID || '',
    selfHosted: process.env.MEDPLUM_SELF_HOSTED === 'true',
    selfHostedUrl: process.env.MEDPLUM_SELF_HOSTED_URL,
  },

  jwt: {
    secret: (() => {
      const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_ACCESS_SECRET or JWT_SECRET environment variable is required');
      }
      // Validate secret strength
      if (secret.length < 32) {
        throw new Error('JWT secret must be at least 32 characters long');
      }
      // Check for common weak secrets (skip in test mode)
      if (process.env.NODE_ENV !== 'test') {
        const weakSecrets = ['secret', 'password', '12345', 'default', 'changeme', 'test'];
        if (weakSecrets.some(weak => secret.toLowerCase().includes(weak))) {
          throw new Error('JWT secret appears to be weak. Please use a strong, randomly generated secret');
        }
      }
      return secret;
    })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  fhir: {
    version: process.env.FHIR_VERSION || '4.0.1',
    baseUrl: process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir/R4',
  },

  smart: {
    authorizationUrl: process.env.SMART_AUTHORIZATION_URL || 'http://localhost:8080/auth/authorize',
    tokenUrl: process.env.SMART_TOKEN_URL || 'http://localhost:8080/auth/token',
    introspectionUrl: process.env.SMART_INTROSPECTION_URL || 'http://localhost:8080/auth/introspect',
    scopes: (process.env.SMART_SCOPES || 'openid profile fhirUser patient/*.read patient/*.write user/*.read user/*.write launch').split(' '),
  },

  cdsHooks: {
    discoveryUrl: process.env.CDS_HOOKS_DISCOVERY_URL || 'http://localhost:8080/cds-services',
    baseUrl: process.env.CDS_HOOKS_BASE_URL || 'http://localhost:8080/cds-services',
  },

  ehr: {
    integrationEnabled: process.env.EHR_INTEGRATION_ENABLED === 'true',
    systems: (process.env.EHR_SYSTEMS || 'epic,cerner,allscripts').split(','),
    epic: {
      clientId: process.env.EPIC_CLIENT_ID || '',
      privateKeyPath: process.env.EPIC_PRIVATE_KEY_PATH || './certs/epic-private-key.pem',
      fhirBaseUrl: process.env.EPIC_FHIR_BASE_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    },
    cerner: {
      clientId: process.env.CERNER_CLIENT_ID || '',
      clientSecret: process.env.CERNER_CLIENT_SECRET || '',
      fhirBaseUrl: process.env.CERNER_FHIR_BASE_URL || 'https://fhir-open.cerner.com/r4',
    },
  },

  hl7v2: {
    enabled: process.env.HL7_V2_ENABLED === 'true',
    port: parseInt(process.env.HL7_V2_PORT || '2575', 10),
    host: process.env.HL7_V2_HOST || '0.0.0.0',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/omnicare.log',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  subscriptions: {
    websocketPort: parseInt(process.env.WEBSOCKET_PORT || '8081', 10),
    maxConnections: parseInt(process.env.SUBSCRIPTION_MAX_CONNECTIONS || '1000', 10),
  },

  performance: {
    cacheTtl: parseInt(process.env.CACHE_TTL || '3600', 10),
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
  },
};

// Validation
const validateConfig = (): void => {
  const requiredFields = [
    'server.port',
    'database.url',
    'jwt.secret',
  ];

  const missingFields = requiredFields.filter(field => {
    const keys = field.split('.');
    let value: unknown = config;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return true;
      }
      if (value === undefined || value === '') {
        return true;
      }
    }
    return false;
  });

  if (missingFields.length > 0) {
    throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
  }
};

// Validate configuration on startup
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}

export default config;