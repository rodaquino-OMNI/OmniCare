"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fhirController = exports.FHIRController = void 0;
const medplum_service_1 = require("@/services/medplum.service");
const fhir_resources_service_1 = require("@/services/fhir-resources.service");
const cds_hooks_service_1 = require("@/services/cds-hooks.service");
const subscriptions_service_1 = require("@/services/subscriptions.service");
const logger_1 = __importDefault(require("@/utils/logger"));
class FHIRController {
    async getCapabilityStatement(req, res) {
        try {
            logger_1.default.fhir('Capability statement requested', {
                userAgent: req.get('User-Agent'),
                ip: req.ip,
            });
            const capabilityStatement = await medplum_service_1.medplumService.getCapabilityStatement();
            res.json(capabilityStatement);
        }
        catch (error) {
            logger_1.default.error('Failed to get capability statement:', error);
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
    async createResource(req, res) {
        try {
            const { resourceType } = req.params;
            const resource = req.body;
            logger_1.default.fhir('Creating resource', {
                resourceType,
                userId: req.user?.id,
                hasId: !!resource.id,
            });
            if (resource.resourceType !== resourceType) {
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
            if (resource.id) {
                delete resource.id;
            }
            const createdResource = await medplum_service_1.medplumService.createResource(resource);
            await subscriptions_service_1.subscriptionsService.processResourceChange(resourceType, createdResource.id, 'create', createdResource);
            res.status(201)
                .location(`/fhir/R4/${resourceType}/${createdResource.id}`)
                .json(createdResource);
        }
        catch (error) {
            logger_1.default.error('Failed to create resource:', error);
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
    async readResource(req, res) {
        try {
            const { resourceType, id } = req.params;
            logger_1.default.fhir('Reading resource', {
                resourceType,
                id,
                userId: req.user?.id,
            });
            const resource = await medplum_service_1.medplumService.readResource(resourceType, id);
            res.json(resource);
        }
        catch (error) {
            logger_1.default.error('Failed to read resource:', error);
            if (error.message?.includes('not found') || error.status === 404) {
                res.status(404).json({
                    resourceType: 'OperationOutcome',
                    issue: [{
                            severity: 'error',
                            code: 'not-found',
                            diagnostics: `${req.params.resourceType}/${req.params.id} not found`,
                        }],
                });
            }
            else {
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
    async updateResource(req, res) {
        try {
            const { resourceType, id } = req.params;
            const resource = req.body;
            logger_1.default.fhir('Updating resource', {
                resourceType,
                id,
                userId: req.user?.id,
            });
            if (resource.resourceType !== resourceType) {
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
            resource.id = id;
            const updatedResource = await medplum_service_1.medplumService.updateResource(resource);
            await subscriptions_service_1.subscriptionsService.processResourceChange(resourceType, id, 'update', updatedResource);
            res.json(updatedResource);
        }
        catch (error) {
            logger_1.default.error('Failed to update resource:', error);
            if (error.message?.includes('not found') || error.status === 404) {
                res.status(404).json({
                    resourceType: 'OperationOutcome',
                    issue: [{
                            severity: 'error',
                            code: 'not-found',
                            diagnostics: `${req.params.resourceType}/${req.params.id} not found`,
                        }],
                });
            }
            else {
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
    async deleteResource(req, res) {
        try {
            const { resourceType, id } = req.params;
            logger_1.default.fhir('Deleting resource', {
                resourceType,
                id,
                userId: req.user?.id,
            });
            await medplum_service_1.medplumService.deleteResource(resourceType, id);
            await subscriptions_service_1.subscriptionsService.processResourceChange(resourceType, id, 'delete');
            res.status(204).send();
        }
        catch (error) {
            logger_1.default.error('Failed to delete resource:', error);
            if (error.message?.includes('not found') || error.status === 404) {
                res.status(404).json({
                    resourceType: 'OperationOutcome',
                    issue: [{
                            severity: 'error',
                            code: 'not-found',
                            diagnostics: `${req.params.resourceType}/${req.params.id} not found`,
                        }],
                });
            }
            else {
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
    async searchResources(req, res) {
        try {
            const { resourceType } = req.params;
            const searchParams = req.query;
            logger_1.default.fhir('Searching resources', {
                resourceType,
                searchParams: Object.keys(searchParams),
                userId: req.user?.id,
            });
            const searchResults = await medplum_service_1.medplumService.searchResources(resourceType, searchParams);
            res.json(searchResults);
        }
        catch (error) {
            logger_1.default.error('Failed to search resources:', error);
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
    async processBatch(req, res) {
        try {
            const bundle = req.body;
            logger_1.default.fhir('Processing batch/transaction', {
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
            const bundleRequest = {
                resourceType: 'Bundle',
                type: bundle.type,
                resources: bundle.entry?.map((entry) => entry.resource) || [],
                timestamp: bundle.timestamp,
            };
            const result = await medplum_service_1.medplumService.executeBatch(bundleRequest);
            res.json(result);
        }
        catch (error) {
            logger_1.default.error('Failed to process batch/transaction:', error);
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
    async getPatientEverything(req, res) {
        try {
            const { id } = req.params;
            logger_1.default.fhir('Getting patient everything', {
                patientId: id,
                userId: req.user?.id,
            });
            const result = await fhir_resources_service_1.fhirResourcesService.getPatientEverything(id);
            res.json(result);
        }
        catch (error) {
            logger_1.default.error('Failed to get patient everything:', error);
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
    async validateResource(req, res) {
        try {
            const { resourceType } = req.params;
            const resource = req.body;
            logger_1.default.fhir('Validating resource', {
                resourceType,
                userId: req.user?.id,
            });
            const validationResult = await fhir_resources_service_1.fhirResourcesService.validateResource(resource);
            if (validationResult.valid) {
                res.status(200).json({
                    resourceType: 'OperationOutcome',
                    issue: [{
                            severity: 'information',
                            code: 'informational',
                            diagnostics: 'Resource is valid',
                        }],
                });
            }
            else {
                res.status(400).json({
                    resourceType: 'OperationOutcome',
                    issue: [
                        ...validationResult.errors.map(error => ({
                            severity: 'error',
                            code: error.code,
                            diagnostics: error.message,
                            expression: error.path ? [error.path] : undefined,
                        })),
                        ...validationResult.warnings.map(warning => ({
                            severity: 'warning',
                            code: warning.code,
                            diagnostics: warning.message,
                            expression: warning.path ? [warning.path] : undefined,
                        })),
                    ],
                });
            }
        }
        catch (error) {
            logger_1.default.error('Failed to validate resource:', error);
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
    async executeGraphQL(req, res) {
        try {
            const { query, variables } = req.body;
            logger_1.default.fhir('Executing GraphQL query', {
                userId: req.user?.id,
                hasVariables: !!variables,
            });
            const result = await medplum_service_1.medplumService.graphql(query, variables);
            res.json(result);
        }
        catch (error) {
            logger_1.default.error('Failed to execute GraphQL query:', error);
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
    async getCDSServices(req, res) {
        try {
            logger_1.default.info('CDS Hooks discovery requested', {
                userAgent: req.get('User-Agent'),
                ip: req.ip,
            });
            const discoveryDocument = cds_hooks_service_1.cdsHooksService.getDiscoveryDocument();
            res.json(discoveryDocument);
        }
        catch (error) {
            logger_1.default.error('Failed to get CDS services:', error);
            res.status(500).json({
                error: 'Failed to retrieve CDS services',
            });
        }
    }
    async executeCDSHook(req, res) {
        try {
            const { serviceId } = req.params;
            const hookRequest = req.body;
            logger_1.default.info('CDS Hook execution requested', {
                serviceId,
                hook: hookRequest.hook,
                patientId: hookRequest.context.patientId,
                userId: req.user?.id,
            });
            let response;
            switch (serviceId) {
                case 'omnicare-patient-risk-assessment':
                    response = await cds_hooks_service_1.cdsHooksService.executePatientView(hookRequest);
                    break;
                case 'omnicare-medication-safety':
                    response = await cds_hooks_service_1.cdsHooksService.executeMedicationPrescribe(hookRequest);
                    break;
                case 'omnicare-order-review':
                    response = await cds_hooks_service_1.cdsHooksService.executeOrderReview(hookRequest);
                    break;
                default:
                    res.status(404).json({
                        error: `CDS service ${serviceId} not found`,
                    });
                    return;
            }
            res.json(response);
        }
        catch (error) {
            logger_1.default.error('Failed to execute CDS hook:', error);
            res.status(500).json({
                error: 'Failed to execute CDS hook',
            });
        }
    }
    async listSubscriptions(req, res) {
        try {
            logger_1.default.fhir('Listing subscriptions', {
                userId: req.user?.id,
            });
            const subscriptions = subscriptions_service_1.subscriptionsService.listActiveSubscriptions();
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
        }
        catch (error) {
            logger_1.default.error('Failed to list subscriptions:', error);
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
    async healthCheck(req, res) {
        try {
            const [medplumHealth, cdsHealth, subscriptionsHealth] = await Promise.all([
                medplum_service_1.medplumService.getHealthStatus(),
                cds_hooks_service_1.cdsHooksService.getHealthStatus(),
                subscriptions_service_1.subscriptionsService.getHealthStatus(),
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
        }
        catch (error) {
            logger_1.default.error('Health check failed:', error);
            res.status(503).json({
                status: 'DOWN',
                timestamp: new Date().toISOString(),
                error: 'Health check failed',
            });
        }
    }
}
exports.FHIRController = FHIRController;
exports.fhirController = new FHIRController();
//# sourceMappingURL=fhir.controller.js.map