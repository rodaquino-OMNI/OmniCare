/**
 * Offline Manifest Configuration
 * Defines resource priorities, caching strategies, and offline behavior for OmniCare EMR
 */

export interface OfflineResourceConfig {
  pattern: string | RegExp;
  strategy: 'network-first' | 'cache-first' | 'network-only' | 'cache-only' | 'stale-while-revalidate';
  cacheName: string;
  maxAge?: number; // in milliseconds
  maxItems?: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  networkTimeout?: number; // timeout for network requests
  fallback?: string; // fallback URL if resource fails
}

export interface OfflineManifest {
  version: string;
  resources: OfflineResourceConfig[];
  criticalResources: string[];
  dataPrefetch: {
    enabled: boolean;
    resources: string[];
    maxSize: number; // in bytes
  };
  syncConfig: {
    minInterval: number; // minimum sync interval in milliseconds
    maxRetries: number;
    retryDelay: number;
    batchSize: number;
  };
  storageQuota: {
    indexedDB: number; // in MB
    cacheStorage: number; // in MB
    total: number; // in MB
  };
  encryptionConfig: {
    enabledForTypes: string[];
    excludedFields: string[];
  };
}

// FHIR Resource Types with their offline requirements
export const FHIR_RESOURCE_OFFLINE_CONFIG: Record<string, {
  priority: 'critical' | 'high' | 'medium' | 'low';
  retention: number; // days
  encryptPHI: boolean;
  prefetchRelated: boolean;
}> = {
  Patient: {
    priority: 'critical',
    retention: 0, // permanent
    encryptPHI: true,
    prefetchRelated: true
  },
  Encounter: {
    priority: 'high',
    retention: 30,
    encryptPHI: true,
    prefetchRelated: true
  },
  Observation: {
    priority: 'high',
    retention: 90,
    encryptPHI: false,
    prefetchRelated: false
  },
  MedicationRequest: {
    priority: 'high',
    retention: 180,
    encryptPHI: true,
    prefetchRelated: true
  },
  Condition: {
    priority: 'high',
    retention: 0, // permanent
    encryptPHI: true,
    prefetchRelated: false
  },
  AllergyIntolerance: {
    priority: 'critical',
    retention: 0, // permanent
    encryptPHI: true,
    prefetchRelated: false
  },
  DocumentReference: {
    priority: 'medium',
    retention: 365,
    encryptPHI: true,
    prefetchRelated: false
  },
  DiagnosticReport: {
    priority: 'medium',
    retention: 365,
    encryptPHI: true,
    prefetchRelated: false
  },
  CarePlan: {
    priority: 'medium',
    retention: 180,
    encryptPHI: true,
    prefetchRelated: true
  },
  Immunization: {
    priority: 'high',
    retention: 0, // permanent
    encryptPHI: false,
    prefetchRelated: false
  },
  ServiceRequest: {
    priority: 'medium',
    retention: 30,
    encryptPHI: false,
    prefetchRelated: true
  },
  Practitioner: {
    priority: 'high',
    retention: 0, // permanent
    encryptPHI: true,
    prefetchRelated: false
  },
  Organization: {
    priority: 'high',
    retention: 0, // permanent
    encryptPHI: true,
    prefetchRelated: false
  }
};

// Main offline manifest configuration
export const OFFLINE_MANIFEST: OfflineManifest = {
  version: '2.0.0',
  
  resources: [
    // Critical patient data - always available offline
    {
      pattern: /\/api\/fhir\/Patient/,
      strategy: 'network-first',
      cacheName: 'fhir-critical',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      priority: 'critical',
      networkTimeout: 5000,
      fallback: '/api/offline/patient'
    },
    
    // Active encounters
    {
      pattern: /\/api\/fhir\/Encounter\?status=in-progress/,
      strategy: 'network-first',
      cacheName: 'fhir-active',
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
      priority: 'critical',
      networkTimeout: 3000
    },
    
    // Recent observations (vitals, labs)
    {
      pattern: /\/api\/fhir\/Observation/,
      strategy: 'stale-while-revalidate',
      cacheName: 'fhir-observations',
      maxAge: 6 * 60 * 60 * 1000, // 6 hours
      maxItems: 1000,
      priority: 'high'
    },
    
    // Active medications
    {
      pattern: /\/api\/fhir\/MedicationRequest\?status=active/,
      strategy: 'network-first',
      cacheName: 'fhir-medications',
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
      priority: 'high',
      networkTimeout: 3000
    },
    
    // Allergies and intolerances
    {
      pattern: /\/api\/fhir\/AllergyIntolerance/,
      strategy: 'cache-first',
      cacheName: 'fhir-critical',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      priority: 'critical'
    },
    
    // Conditions/Problems
    {
      pattern: /\/api\/fhir\/Condition/,
      strategy: 'network-first',
      cacheName: 'fhir-conditions',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      priority: 'high'
    },
    
    // Care plans
    {
      pattern: /\/api\/fhir\/CarePlan\?status=active/,
      strategy: 'network-first',
      cacheName: 'fhir-careplans',
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
      priority: 'medium'
    },
    
    // Practitioners (for reference)
    {
      pattern: /\/api\/fhir\/Practitioner/,
      strategy: 'cache-first',
      cacheName: 'fhir-reference',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      priority: 'medium'
    },
    
    // Organizations (for reference)
    {
      pattern: /\/api\/fhir\/Organization/,
      strategy: 'cache-first',
      cacheName: 'fhir-reference',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      priority: 'low'
    },
    
    // API endpoints
    {
      pattern: /\/api\/auth\/session/,
      strategy: 'network-first',
      cacheName: 'api-auth',
      maxAge: 30 * 60 * 1000, // 30 minutes
      priority: 'high'
    },
    
    // Static assets
    {
      pattern: /\.(js|css|woff2?|ttf|eot)$/,
      strategy: 'cache-first',
      cacheName: 'static-assets',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      priority: 'low'
    },
    
    // Images
    {
      pattern: /\.(png|jpg|jpeg|gif|webp|svg)$/,
      strategy: 'cache-first',
      cacheName: 'images',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxItems: 500,
      priority: 'low'
    },
    
    // HTML pages
    {
      pattern: /\.html$/,
      strategy: 'network-first',
      cacheName: 'pages',
      maxAge: 60 * 60 * 1000, // 1 hour
      priority: 'medium',
      fallback: '/offline.html'
    }
  ],
  
  // Resources that must be cached on service worker install
  criticalResources: [
    '/',
    '/offline.html',
    '/manifest.json',
    '/favicon.ico',
    '/icons/icon-192x192.svg',
    '/icons/icon-512x512.svg',
    '/dashboard',
    '/patients'
  ],
  
  // Data prefetch configuration
  dataPrefetch: {
    enabled: true,
    resources: [
      '/api/fhir/Patient?_count=100&_sort=-_lastUpdated',
      '/api/fhir/AllergyIntolerance?_count=500',
      '/api/fhir/Condition?_count=500&clinical-status=active',
      '/api/fhir/MedicationRequest?_count=200&status=active',
      '/api/fhir/Practitioner?_count=100',
      '/api/fhir/Organization?_count=50'
    ],
    maxSize: 50 * 1024 * 1024 // 50MB
  },
  
  // Sync configuration
  syncConfig: {
    minInterval: 5 * 60 * 1000, // 5 minutes
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    batchSize: 50
  },
  
  // Storage quota configuration
  storageQuota: {
    indexedDB: 500, // 500MB for IndexedDB
    cacheStorage: 200, // 200MB for Cache Storage
    total: 1024 // 1GB total
  },
  
  // Encryption configuration
  encryptionConfig: {
    enabledForTypes: [
      'Patient',
      'Encounter',
      'MedicationRequest',
      'AllergyIntolerance',
      'Condition',
      'DocumentReference',
      'DiagnosticReport',
      'CarePlan',
      'Practitioner',
      'Organization'
    ],
    excludedFields: [
      'id',
      'resourceType',
      'meta.versionId',
      'meta.lastUpdated'
    ]
  }
};

// Helper function to get resource configuration
export function getResourceOfflineConfig(resourceType: string): OfflineResourceConfig | undefined {
  return OFFLINE_MANIFEST.resources.find(config => {
    if (typeof config.pattern === 'string') {
      return config.pattern.includes(resourceType);
    }
    return config.pattern.test(`/api/fhir/${resourceType}`);
  });
}

// Helper function to check if a resource should be encrypted
export function shouldEncryptResource(resourceType: string): boolean {
  return OFFLINE_MANIFEST.encryptionConfig.enabledForTypes.includes(resourceType);
}

// Helper function to get retention period for a resource type
export function getResourceRetentionDays(resourceType: string): number {
  const config = FHIR_RESOURCE_OFFLINE_CONFIG[resourceType];
  return config?.retention ?? 30; // default 30 days
}

// Helper function to check if a resource is critical for offline
export function isResourceCritical(resourceType: string): boolean {
  const config = FHIR_RESOURCE_OFFLINE_CONFIG[resourceType];
  return config?.priority === 'critical';
}

// Export default
export default OFFLINE_MANIFEST;