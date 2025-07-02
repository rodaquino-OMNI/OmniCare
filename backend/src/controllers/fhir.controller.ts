import { Bundle } from '@medplum/fhirtypes';
import { NextFunction, Request, Response } from 'express';

import config from '../config';
import { cdsHooksService } from '../services/cds-hooks.service';
import { databaseService } from '../services/database.service';
import { fhirResourcesService } from '../services/fhir-resources.service';
import { fhirValidationService } from '../services/integration/fhir/fhir-validation.service';
import { medplumService } from '../services/medplum.service';
import { redisCacheService } from '../services/redis-cache.service';
import { subscriptionsService } from '../services/subscriptions.service';
import { BundleEntryResource } from '../types/database.types';
import { BundleRequest, CDSHookRequest, FHIRSearchParams } from '../types/fhir';
import { toCanonicalRole, UserRoles } from '../types/unified-user-roles';
import { hasMessage } from '../utils/error.utils';
import { validateResourceType } from '../utils/fhir-validation.utils';
import logger from '../utils/logger';

/**
 * Safely convert value to string
 */
function toSafeString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

/**
 * FHIR API Controller
 * Handles all FHIR REST API endpoints according to FHIR R4 specification
 */
export class FHIRController {

  // ===============================
  // FHIR METADATA AND CAPABILITY
  // ===============================

  /**
   * GET /fhir/R4/metadata - FHIR Capability Statement (Cached)
   */
  async getCapabilityStatement(req: Request, res: Response): Promise<void> {
    try {
      logger.fhir('Capability statement requested', {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      // Try to get from cache first
      const cacheKey = 'fhir:metadata:capability-statement';
      const cachedCapability = await redisCacheService.get(cacheKey);
      
      if (cachedCapability) {
        logger.debug('Capability statement served from cache');
        res.json(cachedCapability);
        return;
      }

      const capabilityStatement = await medplumService.getCapabilityStatement();
      
      // Cache capability statement for 1 hour (it rarely changes)
      await redisCacheService.set(cacheKey, capabilityStatement, { ttl: 3600 });
      
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

      // Invalidate related caches
      await this.invalidateResourceCaches(validatedResourceType, createdResource.id);

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
   * GET /fhir/R4/{resourceType}/{id} - Read resource (Cached)
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
      
      // Try to get from cache first
      const cacheKey = redisCacheService.generateFHIRKey(validatedResourceType, 'read', { id });
      const cachedResource = await redisCacheService.get(cacheKey);
      
      if (cachedResource) {
        logger.debug(`Resource ${validatedResourceType}/${id} served from cache`);
        res.json(cachedResource);
        return;
      }

      const resource = await medplumService.readResource(validatedResourceType, id);
      
      // Cache resource for configurable TTL (default 15 minutes)
      const cacheTtl = this.getResourceCacheTtl(validatedResourceType);
      await redisCacheService.set(cacheKey, resource, { ttl: cacheTtl });
      
      res.json(resource);
    } catch (error) {
      logger.error('Failed to read resource:', error);
      
      if ((hasMessage(error) && error.message.includes('not found')) || (error as Error & {status?: number}).status === 404) {
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

      // Invalidate related caches
      await this.invalidateResourceCaches(validatedResourceType, id);

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
      
      if ((hasMessage(error) && error.message.includes('not found')) || (error as Error & {status?: number}).status === 404) {
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

      // Invalidate related caches
      await this.invalidateResourceCaches(validatedResourceType, id);

      // Notify subscriptions
      await subscriptionsService.processResourceChange(
        validatedResourceType,
        id,
        'delete'
      );

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete resource:', error);
      
      if ((hasMessage(error) && error.message.includes('not found')) || (error as Error & {status?: number}).status === 404) {
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
   * GET /fhir/R4/{resourceType} - Search resources (Cached)
   */
  async searchResources(req: Request, res: Response): Promise<void> {
    try {
      const { resourceType } = req.params;
      const searchParams = req.query as FHIRSearchParams;

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
      
      // Try to get from cache first (only for cacheable searches)
      const shouldCacheSearch = this.shouldCacheSearch(searchParams);
      let cacheKey: string | null = null;
      
      if (shouldCacheSearch) {
        cacheKey = redisCacheService.generateFHIRKey(validatedResourceType, 'search', searchParams);
        const cachedResults = await redisCacheService.get(cacheKey);
        
        if (cachedResults) {
          logger.debug(`Search results for ${validatedResourceType} served from cache`);
          res.json(cachedResults);
          return;
        }
      }

      const searchResults = await medplumService.searchResources(validatedResourceType, searchParams);
      
      // Cache search results if appropriate
      if (shouldCacheSearch && cacheKey) {
        const searchCacheTtl = this.getSearchCacheTtl(validatedResourceType, searchParams);
        await redisCacheService.set(cacheKey, searchResults, { ttl: searchCacheTtl });
      }
      
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
        resources: bundle.entry?.map((entry: BundleEntryResource) => entry.resource) || [],
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
   * GET /fhir/R4/Patient/{id}/$everything - Get all patient data (Cached)
   */
  async getPatientEverything(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      logger.fhir('Getting patient everything', {
        patientId: id,
        userId: req.user?.id,
      });

      // Try to get from cache first
      const cacheKey = redisCacheService.generateFHIRKey('Patient', 'everything', { id });
      const cachedResult = await redisCacheService.get(cacheKey);
      
      if (cachedResult) {
        logger.debug(`Patient everything for ${id} served from cache`);
        res.json(cachedResult);
        return;
      }

      const result = await fhirResourcesService.getPatientEverything(id ?? '');
      
      // Cache patient everything for 10 minutes (contains dynamic data)
      await redisCacheService.set(cacheKey, result, { ttl: 600 });
      
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

      await Promise.resolve(); // Placeholder for future async operations
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

      await Promise.resolve(); // Placeholder for future async operations
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
      if (req.user?.role && toCanonicalRole(req.user.role) === UserRoles.NURSING_STAFF && !req.user?.permissions?.includes('patient:write')) {
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
      if ((error as Error).name === 'NotFoundError' || (hasMessage(error) && error.message.includes('not found'))) {
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

      // Convert query parameters to FHIRSearchParams
      const searchParams: FHIRSearchParams = {};
      
      // Convert each query parameter to appropriate type
      Object.entries(req.query).forEach(([key, value]) => {
        if (key === '_count' && value) {
          searchParams._count = Number(value);
        } else if (typeof value === 'string') {
          searchParams[key] = value;
        } else if (Array.isArray(value)) {
          searchParams[key] = value.map(v => toSafeString(v)).join(',');
        }
      });

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

  // ===============================
  // CACHE HELPER METHODS
  // ===============================

  /**
   * Get cache TTL for resource reads based on resource type
   */
  private getResourceCacheTtl(resourceType: string): number {
    const cacheTtlMap: Record<string, number> = {
      // Static/reference data - cache longer
      'CodeSystem': 7200,  // 2 hours
      'ValueSet': 7200,    // 2 hours
      'StructureDefinition': 7200, // 2 hours
      'Organization': 3600, // 1 hour
      'Practitioner': 3600, // 1 hour
      'Location': 3600,    // 1 hour
      
      // Patient data - cache shorter
      'Patient': 1800,     // 30 minutes
      'Encounter': 900,    // 15 minutes
      'Observation': 600,  // 10 minutes
      'DiagnosticReport': 1800, // 30 minutes
      'MedicationRequest': 900, // 15 minutes
      'CarePlan': 1800,    // 30 minutes
      'AllergyIntolerance': 1800, // 30 minutes
      
      // Dynamic data - cache very short
      'Communication': 300, // 5 minutes
      'Task': 300,         // 5 minutes
      'Appointment': 600,  // 10 minutes
    };
    
    return cacheTtlMap[resourceType] || config.performance.cacheTtl;
  }

  /**
   * Get cache TTL for search results
   */
  private getSearchCacheTtl(resourceType: string, searchParams: FHIRSearchParams): number {
    // Very short cache for dynamic searches
    if (searchParams._lastUpdated || searchParams._since) {
      return 60; // 1 minute
    }
    
    // Shorter cache for patient-specific searches
    if (searchParams.patient || searchParams.subject) {
      return 300; // 5 minutes
    }
    
    // Normal cache for general searches
    const searchCacheTtlMap: Record<string, number> = {
      'Organization': 1800, // 30 minutes
      'Practitioner': 1800, // 30 minutes
      'Location': 1800,     // 30 minutes
      'Patient': 600,       // 10 minutes
      'Encounter': 300,     // 5 minutes
      'Observation': 180,   // 3 minutes
    };
    
    return searchCacheTtlMap[resourceType] || 300;
  }

  /**
   * Determine if a search should be cached
   */
  private shouldCacheSearch(searchParams: FHIRSearchParams): boolean {
    // Don't cache searches with _format parameter (different output formats)
    if (searchParams._format) {
      return false;
    }
    
    // Don't cache searches with _include or _revinclude (complex queries)
    if (searchParams._include || searchParams._revinclude) {
      return false;
    }
    
    // Don't cache searches with _elements (partial responses)
    if (searchParams._elements) {
      return false;
    }
    
    // Don't cache very large result sets
    if (searchParams._count && parseInt(searchParams._count.toString(), 10) > 100) {
      return false;
    }
    
    return true;
  }

  /**
   * Invalidate caches related to a resource
   */
  private async invalidateResourceCaches(resourceType: string, resourceId?: string): Promise<void> {
    try {
      const patterns = [
        `fhir:${resourceType.toLowerCase()}:*`,
        'fhir:patient:everything:*', // Invalidate patient everything caches
      ];
      
      // For patient resources, also invalidate patient-specific caches
      if (resourceType === 'Patient' && resourceId) {
        patterns.push(`fhir:*:*:*patient=${resourceId}*`);
        patterns.push(`fhir:*:*:*subject=${resourceId}*`);
      }
      
      // For other patient-related resources, invalidate patient caches
      if (['Encounter', 'Observation', 'MedicationRequest', 'DiagnosticReport', 'CarePlan'].includes(resourceType)) {
        patterns.push('fhir:patient:everything:*');
      }
      
      for (const pattern of patterns) {
        await redisCacheService.clearPattern(pattern);
      }
      
      logger.debug(`Cache invalidated for ${resourceType}${resourceId ? `/${resourceId}` : ''}`);
    } catch (error) {
      logger.error('Failed to invalidate resource caches:', error);
      // Don't throw - cache invalidation failure shouldn't break the operation
    }
  }

  /**
   * Get enhanced health check with cache status
   */
  async getEnhancedHealthCheck(_req: Request, res: Response): Promise<void> {
    try {
      const [medplumHealth, cdsHealth, subscriptionsHealth, dbHealth, cacheHealth] = await Promise.all([
        medplumService.getHealthStatus(),
        cdsHooksService.getHealthStatus(),
        subscriptionsService.getHealthStatus(),
        databaseService.checkHealth(),
        redisCacheService.checkHealth(),
      ]);

      const overallStatus = [
        medplumHealth.status === 'UP',
        cdsHealth.status === 'UP',
        subscriptionsHealth.status === 'UP',
        dbHealth.status === 'healthy',
        cacheHealth.status === 'healthy' || cacheHealth.status === 'unhealthy' // Cache is optional
      ].every(Boolean) ? 'UP' : 'DOWN';

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
          cache: {
            status: cacheHealth.status === 'healthy' ? 'UP' : 'DOWN',
            latency: cacheHealth.latency,
            memory: cacheHealth.usedMemory,
            hitRatio: cacheHealth.hitRatio,
            message: cacheHealth.message,
          },
        },
      };

      res.status(overallStatus === 'UP' ? 200 : 503).json(healthStatus);
    } catch (error) {
      logger.error('Enhanced health check failed:', error);
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