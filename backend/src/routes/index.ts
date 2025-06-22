import express from 'express';

import { authController } from '@/controllers/auth.controller';
import { fhirController } from '@/controllers/fhir.controller';
import { 
  authenticate, 
  requireScope, 
  requirePatientAccess, 
  requireResourceAccess, 
  requireAdmin,
  auditLog
} from '@/middleware/auth.middleware';
import networkRoutes from './network.routes';
import syncRoutes from './sync.routes';

const router = express.Router();

// Apply audit logging to all routes
router.use(auditLog);

// ===============================
// NETWORK MONITORING ROUTES
// ===============================

router.use('/api', networkRoutes);

// ===============================
// SYNC ROUTES
// ===============================

router.use('/api/sync', syncRoutes);

// ===============================
// HEALTH CHECK ROUTES
// ===============================

router.get('/health', fhirController.healthCheck.bind(fhirController));

// ===============================
// AUTHENTICATION ROUTES
// ===============================

// SMART on FHIR OAuth2 endpoints
router.get('/auth/authorize', authController.authorize.bind(authController));
router.post('/auth/token', authController.token.bind(authController));
router.post('/auth/introspect', authController.introspect.bind(authController));

// Internal API authentication
router.post('/auth/login', authController.login.bind(authController));
router.post('/auth/refresh', authController.refreshToken.bind(authController));
router.post('/auth/logout', authController.logout.bind(authController));
router.get('/auth/me', 
  authenticate,
  authController.getCurrentUser.bind(authController)
);
router.post('/auth/setup-mfa',
  authenticate,
  authController.setupMfa.bind(authController)
);
router.post('/auth/verify-mfa',
  authenticate,
  authController.verifyMfa.bind(authController)
);

// ===============================
// FHIR METADATA ROUTES
// ===============================

// FHIR Capability Statement (publicly accessible)
router.get('/fhir/R4/metadata', fhirController.getCapabilityStatement.bind(fhirController));

// ===============================
// FHIR RESOURCE ROUTES
// ===============================

// Batch/Transaction operations
router.post('/fhir/R4', 
  authenticate,
  requireScope(['system/*.write', 'user/*.write']),
  fhirController.processBatch.bind(fhirController)
);

// GraphQL endpoint
router.post('/fhir/R4/$graphql',
  authenticate,
  requireScope(['system/*.read', 'user/*.read']),
  fhirController.executeGraphQL.bind(fhirController)
);

// Resource validation
router.post('/fhir/R4/:resourceType/$validate',
  authenticate,
  requireScope(['system/*.read', 'user/*.read']),
  fhirController.validateResource.bind(fhirController)
);

// Patient-specific operations
router.get('/fhir/R4/Patient/:id/$everything',
  authenticate,
  requirePatientAccess,
  requireResourceAccess('Patient', 'read'),
  fhirController.getPatientEverything.bind(fhirController)
);

// Generic resource CRUD operations

// CREATE - POST /fhir/R4/{resourceType}
router.post('/fhir/R4/:resourceType',
  authenticate,
  (req, res, next) => {
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
  fhirController.createResource.bind(fhirController)
);

// SEARCH - GET /fhir/R4/{resourceType}
router.get('/fhir/R4/:resourceType',
  authenticate,
  (req, res, next) => {
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
  fhirController.searchResources.bind(fhirController)
);

// READ - GET /fhir/R4/{resourceType}/{id}
router.get('/fhir/R4/:resourceType/:id',
  authenticate,
  (req, res, next) => {
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
  fhirController.readResource.bind(fhirController)
);

// UPDATE - PUT /fhir/R4/{resourceType}/{id}
router.put('/fhir/R4/:resourceType/:id',
  authenticate,
  (req, res, next) => {
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
  fhirController.updateResource.bind(fhirController)
);

// DELETE - DELETE /fhir/R4/{resourceType}/{id}
router.delete('/fhir/R4/:resourceType/:id',
  authenticate,
  (req, res, next) => {
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
  fhirController.deleteResource.bind(fhirController)
);

// ===============================
// SUBSCRIPTION ROUTES
// ===============================

// List subscriptions (admin only)
router.get('/fhir/R4/Subscription',
  authenticate,
  requireAdmin,
  fhirController.listSubscriptions.bind(fhirController)
);

// ===============================
// CDS HOOKS ROUTES
// ===============================

// CDS Hooks discovery (publicly accessible)
router.get('/cds-services', fhirController.getCDSServices.bind(fhirController));

// CDS Hook execution
router.post('/cds-services/:serviceId',
  authenticate,
  requireScope(['user/*.read', 'system/*.read']),
  fhirController.executeCDSHook.bind(fhirController)
);

// ===============================
// ADMIN ROUTES
// ===============================

// System administration endpoints
router.get('/admin/stats',
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      // Get system statistics
      const stats = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        // Add more stats as needed
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get system stats' });
    }
  }
);

// ===============================
// SPECIALIZED CLINICAL ROUTES
// ===============================

// Vital Signs APIs
router.post('/api/vitals/:patientId',
  authenticate,
  requirePatientAccess,
  requireResourceAccess('Observation', 'create'),
  async (req, res) => {
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
  }
);

// Medication Management APIs
router.post('/api/prescriptions',
  authenticate,
  requireScope(['user/*.write', 'system/*.write']),
  async (req, res) => {
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
  }
);

// Care Plan Management APIs
router.post('/api/care-plans',
  authenticate,
  requireScope(['user/*.write', 'system/*.write']),
  async (req, res) => {
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
  }
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