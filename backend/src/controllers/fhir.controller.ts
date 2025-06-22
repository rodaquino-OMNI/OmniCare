import { Request, Response } from 'express';

import { cdsHooksService } from '@/services/cds-hooks.service';
import { fhirResourcesService } from '@/services/fhir-resources.service';
import { medplumService } from '@/services/medplum.service';
import { subscriptionsService } from '@/services/subscriptions.service';
import { FHIRSearchParams, CDSHookRequest, BundleRequest } from '@/types/fhir';
import logger from '@/utils/logger';
import { getErrorMessage, hasMessage } from '@/utils/error.utils';
import { validateResourceType } from '@/utils/fhir-validation.utils';

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
  // HEALTH CHECK
  // ===============================

  /**
   * GET /health - Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const [medplumHealth, cdsHealth, subscriptionsHealth] = await Promise.all([
        medplumService.getHealthStatus(),
        cdsHooksService.getHealthStatus(),
        subscriptionsService.getHealthStatus(),
      ]);

      const overallStatus = [medplumHealth, cdsHealth, subscriptionsHealth]
        .every(health => health.status === 'UP') ? 'UP' : 'DOWN';

      const healthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        components: {
          medplum: medplumHealth,
          cdsHooks: cdsHealth,
          subscriptions: subscriptionsHealth,
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