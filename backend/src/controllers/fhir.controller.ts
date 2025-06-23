import { Request, Response, NextFunction } from 'express';

import { cdsHooksService } from '../services/cds-hooks.service';
import { fhirResourcesService } from '../services/fhir-resources.service';
import { fhirValidationService } from '../services/integration/fhir/fhir-validation.service';
import { medplumService } from '../services/medplum.service';
import { subscriptionsService } from '../services/subscriptions.service';
import { databaseService } from '../services/database.service';
import { FHIRSearchParams, CDSHookRequest, BundleRequest } from '../types/fhir';
import { Patient, Encounter, Observation, Bundle } from '@medplum/fhirtypes';
import logger from '../utils/logger';
import { hasMessage } from '../utils/error.utils';
import { validateResourceType } from '../utils/fhir-validation.utils';

/**
 * FHIR API Controller
 * Handles all FHIR REST API endpoints according to FHIR R4 specification
 */
export class FHIRController {

  // ===============================
  // FHIR METADATA AND CAPABILITY
  // ===============================

  /**
   * GET /fhir/R4/metadata - FHIR Capability Statement
   */
  async getCapabilityStatement(req: Request, res: Response): Promise<void> {
    try {
      logger.fhir('Capability statement requested', {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const capabilityStatement = await medplumService.getCapabilityStatement();
      
      res.json(capabilityStatement);
    } catch (error) {
      logger.error('Failed to get capability statement:', error);
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to retrieve capability statement',
        }],
      });
    }
  }

  // ===============================
  // RESOURCE CRUD OPERATIONS
  // ===============================

  /**
   * POST /fhir/R4/{resourceType} - Create resource
   */
  async createResource(req: Request, res: Response): Promise<void> {
    try {
      const { resourceType } = req.params;
      const resource = req.body;

      logger.fhir('Creating resource', {
        resourceType,
        userId: req.user?.id,
        hasId: !!resource.id,
      });

      const validatedResourceType = validateResourceType(resourceType);

      // Validate resource type
      if (resource.resourceType !== validatedResourceType) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            diagnostics: `Resource type mismatch: expected ${resourceType}, got ${resource.resourceType}`,
          }],
        });
        return;
      }

      // Remove id if present (server assigns IDs)
      if (resource.id) {
        delete resource.id;
      }

      const createdResource = await medplumService.createResource(resource);

      // Notify subscriptions
      await subscriptionsService.processResourceChange(
        validatedResourceType,
        createdResource.id ?? '',
        'create',
        createdResource
      );

      res.status(201)
        .location(`/fhir/R4/${resourceType}/${createdResource.id}`)
        .json(createdResource);
    } catch (error) {
      logger.error('Failed to create resource:', error);
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to create resource',
        }],
      });
    }
  }

  /**
   * GET /fhir/R4/{resourceType}/{id} - Read resource
   */
  async readResource(req: Request, res: Response): Promise<void> {
    try {
      const { resourceType, id } = req.params;

      logger.fhir('Reading resource', {
        resourceType,
        id,
        userId: req.user?.id,
      });

      // Validate parameters
      if (!resourceType || !id) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'Resource type and ID are required',
          }],
        });
        return;
      }

      const validatedResourceType = validateResourceType(resourceType);
      const resource = await medplumService.readResource(validatedResourceType, id);
      
      res.json(resource);
    } catch (error) {
      logger.error('Failed to read resource:', error);
      
      if ((hasMessage(error) && error.message.includes('not found')) || (error as any).status === 404) {
        res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: `${req.params.resourceType}/${req.params.id} not found`,
          }],
        });
      } else {
        res.status(500).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'exception',
            diagnostics: 'Failed to read resource',
          }],
        });
      }
    }
  }

  /**
   * PUT /fhir/R4/{resourceType}/{id} - Update resource
   */
  async updateResource(req: Request, res: Response): Promise<void> {
    try {
      const { resourceType, id } = req.params;
      const resource = req.body;

      logger.fhir('Updating resource', {
        resourceType,
        id,
        userId: req.user?.id,
      });

      // Validate parameters
      if (!resourceType || !id) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'Resource type and ID are required',
          }],
        });
        return;
      }

      const validatedResourceType = validateResourceType(resourceType);

      // Validate resource type and ID
      if (resource.resourceType !== validatedResourceType) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            diagnostics: `Resource type mismatch: expected ${resourceType}, got ${resource.resourceType}`,
          }],
        });
        return;
      }

      if (resource.id && resource.id !== id) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            diagnostics: `Resource ID mismatch: expected ${id}, got ${resource.id}`,
          }],
        });
        return;
      }

      // Ensure resource has the correct ID
      resource.id = id;

      const updatedResource = await medplumService.updateResource(resource);

      // Notify subscriptions
      await subscriptionsService.processResourceChange(
        validatedResourceType,
        id,
        'update',
        updatedResource
      );

      res.json(updatedResource);
    } catch (error) {
      logger.error('Failed to update resource:', error);
      
      if ((hasMessage(error) && error.message.includes('not found')) || (error as any).status === 404) {
        res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: `${req.params.resourceType}/${req.params.id} not found`,
          }],
        });
      } else {
        res.status(500).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'exception',
            diagnostics: 'Failed to update resource',
          }],
        });
      }
    }
  }

  /**
   * DELETE /fhir/R4/{resourceType}/{id} - Delete resource
   */
  async deleteResource(req: Request, res: Response): Promise<void> {
    try {
      const { resourceType, id } = req.params;

      logger.fhir('Deleting resource', {
        resourceType,
        id,
        userId: req.user?.id,
      });

      // Validate parameters
      if (!resourceType || !id) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'Resource type and ID are required',
          }],
        });
        return;
      }

      const validatedResourceType = validateResourceType(resourceType);
      await medplumService.deleteResource(validatedResourceType, id);

      // Notify subscriptions
      await subscriptionsService.processResourceChange(
        validatedResourceType,
        id,
        'delete'
      );

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete resource:', error);
      
      if ((hasMessage(error) && error.message.includes('not found')) || (error as any).status === 404) {
        res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: `${req.params.resourceType}/${req.params.id} not found`,
          }],
        });
      } else {
        res.status(500).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'exception',
            diagnostics: 'Failed to delete resource',
          }],
        });
      }
    }
  }

  // ===============================
  // SEARCH OPERATIONS
  // ===============================

  /**
   * GET /fhir/R4/{resourceType} - Search resources
   */
  async searchResources(req: Request, res: Response): Promise<void> {
    try {
      const { resourceType } = req.params;
      const searchParams: FHIRSearchParams = req.query as any;

      logger.fhir('Searching resources', {
        resourceType,
        searchParams: Object.keys(searchParams),
        userId: req.user?.id,
      });

      // Validate parameters
      if (!resourceType) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'Resource type is required',
          }],
        });
        return;
      }

      const validatedResourceType = validateResourceType(resourceType);
      const searchResults = await medplumService.searchResources(validatedResourceType, searchParams);
      
      res.json(searchResults);
    } catch (error) {
      logger.error('Failed to search resources:', error);
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to search resources',
        }],
      });
    }
  }

  // ===============================
  // BATCH/TRANSACTION OPERATIONS
  // ===============================

  /**
   * POST /fhir/R4 - Process batch/transaction bundle
   */
  async processBatch(req: Request, res: Response): Promise<void> {
    try {
      const bundle = req.body;

      logger.fhir('Processing batch/transaction', {
        bundleType: bundle.type,
        entryCount: bundle.entry?.length || 0,
        userId: req.user?.id,
      });

      if (bundle.resourceType !== 'Bundle') {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Expected Bundle resource type',
          }],
        });
        return;
      }

      if (!['batch', 'transaction'].includes(bundle.type)) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Bundle type must be batch or transaction',
          }],
        });
        return;
      }

      const bundleRequest: BundleRequest = {
        resourceType: 'Bundle',
        type: bundle.type,
        resources: bundle.entry?.map((entry: any) => entry.resource) || [],
        timestamp: bundle.timestamp,
      };

      const result = await medplumService.executeBatch(bundleRequest);
      
      res.json(result);
    } catch (error) {
      logger.error('Failed to process batch/transaction:', error);
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to process batch/transaction',
        }],
      });
    }
  }

  // ===============================
  // PATIENT-SPECIFIC OPERATIONS
  // ===============================

  /**
   * GET /fhir/R4/Patient/{id}/$everything - Get all patient data
   */
  async getPatientEverything(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      logger.fhir('Getting patient everything', {
        patientId: id,
        userId: req.user?.id,
      });

      const result = await fhirResourcesService.getPatientEverything(id ?? '');
      
      res.json(result);
    } catch (error) {
      logger.error('Failed to get patient everything:', error);
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to retrieve patient data',
        }],
      });
    }
  }

  // ===============================
  // VALIDATION OPERATIONS
  // ===============================

  /**
   * POST /fhir/R4/{resourceType}/$validate - Validate resource
   */
  async validateResource(req: Request, res: Response): Promise<void> {
    try {
      const { resourceType } = req.params;
      const resource = req.body;

      logger.fhir('Validating resource', {
        resourceType,
        userId: req.user?.id,
      });

      const validationResult = await fhirResourcesService.validateResource(resource);
      
      if (validationResult.valid) {
        res.status(200).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'information',
            code: 'informational',
            diagnostics: 'Resource is valid',
          }],
        });
      } else {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [
            ...validationResult.errors.map(error => ({
              severity: 'error' as const,
              code: error.code,
              diagnostics: error.message,
              expression: error.path ? [error.path] : undefined,
            })),
            ...validationResult.warnings.map(warning => ({
              severity: 'warning' as const,
              code: warning.code,
              diagnostics: warning.message,
              expression: warning.path ? [warning.path] : undefined,
            })),
          ],
        });
      }
    } catch (error) {
      logger.error('Failed to validate resource:', error);
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to validate resource',
        }],
      });
    }
  }

  // ===============================
  // GRAPHQL OPERATIONS
  // ===============================

  /**
   * POST /fhir/R4/$graphql - Execute GraphQL query
   */
  async executeGraphQL(req: Request, res: Response): Promise<void> {
    try {
      const { query, variables } = req.body;

      logger.fhir('Executing GraphQL query', {
        userId: req.user?.id,
        hasVariables: !!variables,
      });

      const result = await medplumService.graphql(query, variables);
      
      res.json(result);
    } catch (error) {
      logger.error('Failed to execute GraphQL query:', error);
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to execute GraphQL query',
        }],
      });
    }
  }

  // ===============================
  // CDS HOOKS OPERATIONS
  // ===============================

  /**
   * GET /cds-services - CDS Hooks discovery
   */
  async getCDSServices(req: Request, res: Response): Promise<void> {
    try {
      logger.info('CDS Hooks discovery requested', {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const discoveryDocument = cdsHooksService.getDiscoveryDocument();
      
      res.json(discoveryDocument);
    } catch (error) {
      logger.error('Failed to get CDS services:', error);
      res.status(500).json({
        error: 'Failed to retrieve CDS services',
      });
    }
  }

  /**
   * POST /cds-services/{service-id} - Execute CDS Hook
   */
  async executeCDSHook(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId } = req.params;
      const hookRequest: CDSHookRequest = req.body;

      logger.info('CDS Hook execution requested', {
        serviceId,
        hook: hookRequest.hook,
        patientId: hookRequest.context.patientId,
        userId: req.user?.id,
      });

      let response;
      
      switch (serviceId) {
        case 'omnicare-patient-risk-assessment':
          response = await cdsHooksService.executePatientView(hookRequest);
          break;
        case 'omnicare-medication-safety':
          response = await cdsHooksService.executeMedicationPrescribe(hookRequest);
          break;
        case 'omnicare-order-review':
          response = await cdsHooksService.executeOrderReview(hookRequest);
          break;
        default:
          res.status(404).json({
            error: `CDS service ${serviceId} not found`,
          });
          return;
      }

      res.json(response);
    } catch (error) {
      logger.error('Failed to execute CDS hook:', error);
      res.status(500).json({
        error: 'Failed to execute CDS hook',
      });
    }
  }

  // ===============================
  // SUBSCRIPTION OPERATIONS
  // ===============================

  /**
   * GET /fhir/R4/Subscription - List subscriptions
   */
  async listSubscriptions(req: Request, res: Response): Promise<void> {
    try {
      logger.fhir('Listing subscriptions', {
        userId: req.user?.id,
      });

      const subscriptions = subscriptionsService.listActiveSubscriptions();
      
      const bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: subscriptions.length,
        entry: subscriptions.map(sub => ({
          resource: {
            resourceType: 'Subscription',
            id: sub.id,
            status: sub.status,
            criteria: sub.criteria,
            channel: sub.channel,
            reason: 'OmniCare EMR Subscription',
          },
        })),
      };

      res.json(bundle);
    } catch (error) {
      logger.error('Failed to list subscriptions:', error);
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to list subscriptions',
        }],
      });
    }
  }

  // ===============================
  // RESOURCE-SPECIFIC OPERATIONS
  // ===============================

  /**
   * POST /fhir/R4/Patient - Create patient (specific method for tests)
   */
  async createPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate content type
      if (req.headers['content-type'] && !req.headers['content-type'].includes('application/fhir+json') && !req.headers['content-type'].includes('application/json')) {
        res.status(415).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-supported',
            diagnostics: 'Unsupported content type. Expected application/fhir+json'
          }]
        });
        return;
      }

      // Validate resource type
      if (!req.body.resourceType) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'resourceType is required'
          }]
        });
        return;
      }

      // Check permissions
      if (req.user?.role && typeof req.user.role === 'string' && req.user.role.includes('nurse') && !req.user?.permissions?.includes('patient:write')) {
        res.status(403).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'forbidden',
            diagnostics: 'Insufficient permissions to create Patient resource'
          }]
        });
        return;
      }

      // Validate the resource
      const validationResult = await fhirValidationService.validateResource(req.body);
      if (!validationResult.valid) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: validationResult.errors.map(error => ({
            severity: 'error',
            code: 'invalid',
            diagnostics: error.message,
            location: error.path ? [error.path] : undefined
          }))
        });
        return;
      }

      const createdPatient = await fhirResourcesService.createPatient(req.body);
      
      res.status(201)
        .set('Location', `/fhir/Patient/${createdPatient.id}`)
        .json(createdPatient);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /fhir/R4/Patient/{id} - Get patient by ID (specific method for tests)
   */
  async getPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'Patient ID is required'
          }]
        });
        return;
      }

      const patient = await fhirResourcesService.getPatient(id);
      
      res.status(200).json(patient);
    } catch (error) {
      if ((error as any).name === 'NotFoundError' || (hasMessage(error) && error.message.includes('not found'))) {
        res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: `Patient with ID ${req.params.id} not found`
          }]
        });
        return;
      }
      next(error);
    }
  }

  /**
   * PUT /fhir/R4/Patient/{id} - Update patient (specific method for tests)
   */
  async updatePatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'Patient ID is required'
          }]
        });
        return;
      }

      // Ensure the resource has the correct ID
      req.body.id = id;

      // Validate the resource
      const validationResult = await fhirValidationService.validateResource(req.body);
      if (!validationResult.valid) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: validationResult.errors.map(error => ({
            severity: 'error',
            code: 'invalid',
            diagnostics: error.message,
            location: error.path ? [error.path] : undefined
          }))
        });
        return;
      }

      const updatedPatient = await fhirResourcesService.updatePatient(req.body);
      
      res.status(200).json(updatedPatient);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /fhir/R4/Patient - Search patients (specific method for tests)
   */
  async searchPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate _count parameter if present
      if (req.query._count && isNaN(Number(req.query._count))) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Invalid search parameter: _count must be a number'
          }]
        });
        return;
      }

      // Convert _count to number if present
      const searchParams: any = { ...req.query };
      if (searchParams._count) {
        searchParams._count = Number(searchParams._count);
      }

      const searchResults = await fhirResourcesService.searchPatients(searchParams);
      
      res.status(200).json(searchResults);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /fhir/R4/Encounter - Create encounter (specific method for tests)
   */
  async createEncounter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const createdEncounter = await fhirResourcesService.createEncounter(req.body);
      
      res.status(201).json(createdEncounter);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /fhir/R4/Observation - Create observation (specific method for tests)
   */
  async createObservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const createdObservation = await fhirResourcesService.createObservation(req.body);
      
      res.status(201).json(createdObservation);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /fhir/R4/Patient/{id}/vitals - Create vital signs observations
   */
  async createVitalSigns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const vitalsData = req.body;
      
      if (!id) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'Patient ID is required'
          }]
        });
        return;
      }

      const createdObservations = await fhirResourcesService.createVitalSigns(id, 'default-encounter', vitalsData);
      
      const responseBundle: Bundle = {
        resourceType: 'Bundle',
        type: 'transaction-response',
        entry: createdObservations.map(obs => ({
          resource: obs,
          response: {
            status: '201',
            location: `/fhir/Observation/${obs.id}`
          }
        }))
      };

      res.status(201).json(responseBundle);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /fhir/R4/Bundle - Process bundle (specific method for tests)
   */
  async processBundle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bundle = req.body;

      if (bundle.resourceType !== 'Bundle') {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Expected Bundle resource type'
          }]
        });
        return;
      }

      // Validate the bundle
      const validationResult = await fhirValidationService.validateBundle(bundle);
      if (!validationResult.valid) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: validationResult.errors.map(error => ({
            severity: 'error',
            code: 'invalid',
            diagnostics: error.message,
            location: error.path ? [error.path] : undefined
          }))
        });
        return;
      }

      const result = await fhirResourcesService.processBundle(bundle);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Removed duplicate validateResource function - already defined at line 476

  // ===============================
  // HEALTH CHECK
  // ===============================

  /**
   * GET /health - Health check endpoint
   */
  async healthCheck(_req: Request, res: Response): Promise<void> {
    try {
      const [medplumHealth, cdsHealth, subscriptionsHealth, dbHealth] = await Promise.all([
        medplumService.getHealthStatus(),
        cdsHooksService.getHealthStatus(),
        subscriptionsService.getHealthStatus(),
        databaseService.checkHealth(),
      ]);

      const overallStatus = [medplumHealth, cdsHealth, subscriptionsHealth]
        .every(health => health.status === 'UP') && dbHealth.status === 'healthy' ? 'UP' : 'DOWN';

      const healthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        components: {
          medplum: medplumHealth,
          cdsHooks: cdsHealth,
          subscriptions: subscriptionsHealth,
          database: {
            status: dbHealth.status === 'healthy' ? 'UP' : 'DOWN',
            latency: dbHealth.latency,
            connections: {
              active: dbHealth.activeConnections,
              idle: dbHealth.idleConnections,
              total: dbHealth.totalConnections,
            },
            message: dbHealth.message,
          },
        },
      };

      res.status(overallStatus === 'UP' ? 200 : 503).json(healthStatus);
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'DOWN',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  }
}

// Export singleton instance
export const fhirController = new FHIRController();