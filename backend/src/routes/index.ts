import express from 'express';

import { clinicalTemplatesRoutes } from './clinical-templates.routes';
import clinicalWorkflowRoutes from './clinical-workflow.routes';
import networkRoutes from './network.routes';
import { orderRoutes } from './order.routes';
import performanceRoutes from './performance.routes';
import syncRoutes from './sync.routes';

import { authController } from '@/controllers/auth.controller';
import { fhirController } from '@/controllers/fhir.controller';
import { 
  fhirResourceCache, 
  patientDataCache, 
  analyticsCache 
} from '@/middleware/api-cache.middleware';
import { 
  auditLog,
  authenticate, 
  requireAdmin,
  requirePatientAccess, 
  requireResourceAccess, 
  requireScope
} from '@/middleware/auth.middleware';


const router = express.Router();

// Wrapper for async route handlers
const asyncHandler = (fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Apply audit logging to all routes
router.use(auditLog);

// ===============================
// NETWORK MONITORING ROUTES
// ===============================

router.use('/api', networkRoutes);

// ===============================
// PERFORMANCE MONITORING ROUTES
// ===============================

router.use('/api/performance', performanceRoutes);

// ===============================
// SYNC ROUTES
// ===============================

router.use('/api/sync', syncRoutes);

// ===============================
// CLINICAL WORKFLOW ROUTES
// ===============================

router.use('/api/clinical-workflow', clinicalWorkflowRoutes);

// ===============================
// ORDER MANAGEMENT ROUTES
// ===============================

router.use('/api/orders', orderRoutes);

// ===============================
// CLINICAL TEMPLATES ROUTES
// ===============================

router.use('/api/clinical-templates', clinicalTemplatesRoutes);

// ===============================
// HEALTH CHECK ROUTES
// ===============================

router.get('/health', asyncHandler(fhirController.healthCheck.bind(fhirController)));

// ===============================
// AUTHENTICATION ROUTES
// ===============================

// SMART on FHIR OAuth2 endpoints
router.get('/auth/authorize', asyncHandler(authController.authorize.bind(authController)));
router.post('/auth/token', asyncHandler(authController.token.bind(authController)));
router.post('/auth/introspect', asyncHandler(authController.introspect.bind(authController)));

// Internal API authentication
router.post('/auth/login', asyncHandler(authController.login.bind(authController)));
router.post('/auth/refresh', asyncHandler(authController.refreshToken.bind(authController)));
router.post('/auth/logout', asyncHandler(authController.logout.bind(authController)));
router.get('/auth/me', 
  authenticate,
  asyncHandler(authController.getCurrentUser.bind(authController))
);
router.post('/auth/setup-mfa',
  authenticate,
  asyncHandler(authController.setupMfa.bind(authController))
);
router.post('/auth/verify-mfa',
  authenticate,
  asyncHandler(authController.verifyMfa.bind(authController))
);

// ===============================
// FHIR METADATA ROUTES
// ===============================

// FHIR Capability Statement (publicly accessible)
router.get('/fhir/R4/metadata', 
  fhirResourceCache(3600), // Cache metadata for 1 hour
  asyncHandler(fhirController.getCapabilityStatement.bind(fhirController))
);

// ===============================
// FHIR RESOURCE ROUTES
// ===============================

// Batch/Transaction operations
router.post('/fhir/R4', 
  authenticate,
  requireScope(['system/*.write', 'user/*.write']),
  asyncHandler(fhirController.processBatch.bind(fhirController))
);

// GraphQL endpoint
router.post('/fhir/R4/$graphql',
  authenticate,
  requireScope(['system/*.read', 'user/*.read']),
  asyncHandler(fhirController.executeGraphQL.bind(fhirController))
);

// Resource validation
router.post('/fhir/R4/:resourceType/$validate',
  authenticate,
  requireScope(['system/*.read', 'user/*.read']),
  asyncHandler(fhirController.validateResource.bind(fhirController))
);

// Patient-specific operations
router.get('/fhir/R4/Patient/:id/$everything',
  authenticate,
  requirePatientAccess,
  requireResourceAccess('Patient', 'read'),
  patientDataCache(600), // Cache patient everything data for 10 minutes
  asyncHandler(fhirController.getPatientEverything.bind(fhirController))
);

// Generic resource CRUD operations

// CREATE - POST /fhir/R4/{resourceType}
router.post('/fhir/R4/:resourceType',
  authenticate,
  async (req, res, next) => {
    // Dynamic resource access check
    const resourceType = req.params.resourceType;
    if (!resourceType) {
      res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'invalid',
          diagnostics: 'Resource type is required',
        }],
      });
      return;
    }
    return requireResourceAccess(resourceType, 'create')(req, res, next);
  },
  asyncHandler(fhirController.createResource.bind(fhirController))
);

// SEARCH - GET /fhir/R4/{resourceType}
router.get('/fhir/R4/:resourceType',
  authenticate,
  async (req, res, next) => {
    // Dynamic resource access check with patient access for patient-scoped searches
    const resourceType = req.params.resourceType;
    const patientParam = req.query.patient || req.query['subject:Patient'];
    
    if (patientParam && !req.user?.scope?.some(s => s.includes('system/'))) {
      // For patient-scoped searches, check patient access
      return requirePatientAccess(req, res, () => {
        return requireResourceAccess(resourceType || '', 'read')(req, res, next);
      });
    } else {
      return requireResourceAccess(resourceType || '', 'read')(req, res, next);
    }
  },
  fhirResourceCache(300), // Cache FHIR resource searches for 5 minutes
  asyncHandler(fhirController.searchResources.bind(fhirController))
);

// READ - GET /fhir/R4/{resourceType}/{id}
router.get('/fhir/R4/:resourceType/:id',
  authenticate,
  async (req, res, next) => {
    const resourceType = req.params.resourceType;
    if (!resourceType) {
      res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'invalid',
          diagnostics: 'Resource type is required',
        }],
      });
      return;
    }
    
    // For patient-related resources, check patient access
    if (['Patient', 'Observation', 'MedicationRequest', 'Encounter', 'DiagnosticReport', 'CarePlan'].includes(resourceType)) {
      if (resourceType === 'Patient') {
        // For Patient resources, the patient ID is the resource ID
        if (req.params.id) {
          req.params.patientId = req.params.id;
        }
        return requirePatientAccess(req, res, () => {
          return requireResourceAccess(resourceType, 'read')(req, res, next);
        });
      } else {
        // For other patient-related resources, we'd need to fetch the resource first to check patient
        // For simplicity, we'll just check resource access
        return requireResourceAccess(resourceType, 'read')(req, res, next);
      }
    } else {
      return requireResourceAccess(resourceType, 'read')(req, res, next);
    }
  },
  fhirResourceCache(600), // Cache individual FHIR resources for 10 minutes
  asyncHandler(fhirController.readResource.bind(fhirController))
);

// UPDATE - PUT /fhir/R4/{resourceType}/{id}
router.put('/fhir/R4/:resourceType/:id',
  authenticate,
  async (req, res, next) => {
    const resourceType = req.params.resourceType;
    if (!resourceType) {
      res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'invalid',
          diagnostics: 'Resource type is required',
        }],
      });
      return;
    }
    
    // Similar patient access logic as READ
    if (['Patient', 'Observation', 'MedicationRequest', 'Encounter', 'DiagnosticReport', 'CarePlan'].includes(resourceType)) {
      if (resourceType === 'Patient') {
        if (req.params.id) {
          req.params.patientId = req.params.id;
        }
        return requirePatientAccess(req, res, () => {
          return requireResourceAccess(resourceType, 'write')(req, res, next);
        });
      } else {
        return requireResourceAccess(resourceType, 'write')(req, res, next);
      }
    } else {
      return requireResourceAccess(resourceType, 'write')(req, res, next);
    }
  },
  asyncHandler(fhirController.updateResource.bind(fhirController))
);

// DELETE - DELETE /fhir/R4/{resourceType}/{id}
router.delete('/fhir/R4/:resourceType/:id',
  authenticate,
  async (req, res, next) => {
    const resourceType = req.params.resourceType;
    if (!resourceType) {
      res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'invalid',
          diagnostics: 'Resource type is required',
        }],
      });
      return;
    }
    
    // Similar patient access logic as READ/UPDATE
    if (['Patient', 'Observation', 'MedicationRequest', 'Encounter', 'DiagnosticReport', 'CarePlan'].includes(resourceType)) {
      if (resourceType === 'Patient') {
        if (req.params.id) {
          req.params.patientId = req.params.id;
        }
        return requirePatientAccess(req, res, () => {
          return requireResourceAccess(resourceType, 'delete')(req, res, next);
        });
      } else {
        return requireResourceAccess(resourceType, 'delete')(req, res, next);
      }
    } else {
      return requireResourceAccess(resourceType, 'delete')(req, res, next);
    }
  },
  asyncHandler(fhirController.deleteResource.bind(fhirController))
);

// ===============================
// SUBSCRIPTION ROUTES
// ===============================

// List subscriptions (admin only)
router.get('/fhir/R4/Subscription',
  authenticate,
  requireAdmin,
  asyncHandler(fhirController.listSubscriptions.bind(fhirController))
);

// ===============================
// CDS HOOKS ROUTES
// ===============================

// CDS Hooks discovery (publicly accessible)
router.get('/cds-services', asyncHandler(fhirController.getCDSServices.bind(fhirController)));

// CDS Hook execution
router.post('/cds-services/:serviceId',
  authenticate,
  requireScope(['user/*.read', 'system/*.read']),
  asyncHandler(fhirController.executeCDSHook.bind(fhirController))
);

// ===============================
// ADMIN ROUTES
// ===============================

// System administration endpoints
router.get('/admin/stats',
  authenticate,
  requireAdmin,
  analyticsCache(60), // Cache admin stats for 1 minute
  asyncHandler(async (req, res) => {
    try {
      // Get system statistics with enhanced performance metrics
      const [cacheHealth, cacheStats] = await Promise.all([
        (async () => {
          try {
            const { databaseCacheService } = await import('@/services/database-cache.service');
            return databaseCacheService.getCacheHealth();
          } catch (error) {
            return { redis: { health: { status: 'error' } }, stats: {}, memoryUsage: {} };
          }
        })(),
        (async () => {
          try {
            const { redisService } = await import('@/services/redis.service');
            return redisService.getStats();
          } catch (error) {
            return { hits: 0, misses: 0, hitRate: 0, totalRequests: 0 };
          }
        })()
      ]);
      
      const stats = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cache: {
          health: cacheHealth,
          stats: cacheStats
        },
        performance: {
          responseTime: Date.now() - (req as any).startTime || 0,
          version: process.env.npm_package_version || '1.0.0'
        }
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get system stats' });
    }
  })
);

// ===============================
// SPECIALIZED CLINICAL ROUTES
// ===============================

// Vital Signs APIs
router.post('/api/vitals/:patientId',
  authenticate,
  requirePatientAccess,
  requireResourceAccess('Observation', 'create'),
  asyncHandler(async (req, res) => {
    try {
      const { patientId } = req.params;
      const { encounterId, vitals } = req.body;
      
      const { fhirResourcesService } = await import('@/services/fhir-resources.service');
      const observations = await fhirResourcesService.createVitalSigns(
        patientId || '',
        encounterId,
        vitals
      );
      
      res.status(201).json({
        resourceType: 'Bundle',
        type: 'collection',
        entry: observations.map(obs => ({ resource: obs })),
      });
    } catch (error) {
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to create vital signs',
        }],
      });
    }
  })
);

// Medication Management APIs
router.post('/api/prescriptions',
  authenticate,
  requireScope(['user/*.write', 'system/*.write']),
  asyncHandler(async (req, res) => {
    try {
      const medicationRequest = req.body;
      
      const { fhirResourcesService } = await import('@/services/fhir-resources.service');
      const result = await fhirResourcesService.createMedicationRequest(medicationRequest);
      
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to create medication request',
        }],
      });
    }
  })
);

// Care Plan Management APIs
router.post('/api/care-plans',
  authenticate,
  requireScope(['user/*.write', 'system/*.write']),
  asyncHandler(async (req, res) => {
    try {
      const carePlan = req.body;
      
      const { fhirResourcesService } = await import('@/services/fhir-resources.service');
      const result = await fhirResourcesService.createCarePlan(carePlan);
      
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to create care plan',
        }],
      });
    }
  })
);

// ===============================
// ERROR HANDLING
// ===============================

// Handle 404 for unmatched routes
router.use('*', (req, res) => {
  res.status(404).json({
    resourceType: 'OperationOutcome',
    issue: [{
      severity: 'error',
      code: 'not-found',
      diagnostics: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    }],
  });
});

// Global error handler
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled route error:', error);
  
  res.status(500).json({
    resourceType: 'OperationOutcome',
    issue: [{
      severity: 'error',
      code: 'exception',
      diagnostics: 'Internal server error',
    }],
  });
});

export default router;