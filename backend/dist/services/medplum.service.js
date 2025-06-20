"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.medplumService = exports.MedplumService = void 0;
const core_1 = require("@medplum/core");
const config_1 = __importDefault(require("@/config"));
const logger_1 = __importDefault(require("@/utils/logger"));
class MedplumService {
    medplum;
    isInitialized = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    constructor() {
        this.medplum = new core_1.MedplumClient({
            baseUrl: config_1.default.medplum.selfHosted ? config_1.default.medplum.selfHostedUrl : config_1.default.medplum.baseUrl,
            clientId: config_1.default.medplum.clientId,
            fhirUrlPath: '/fhir/R4',
            tokenUrl: config_1.default.medplum.selfHosted ?
                `${config_1.default.medplum.selfHostedUrl}/oauth2/token` :
                `${config_1.default.medplum.baseUrl}oauth2/token`,
            authorizeUrl: config_1.default.medplum.selfHosted ?
                `${config_1.default.medplum.selfHostedUrl}/oauth2/authorize` :
                `${config_1.default.medplum.baseUrl}oauth2/authorize`,
        });
    }
    async initialize() {
        try {
            logger_1.default.info('Initializing Medplum FHIR server connection...');
            if (config_1.default.medplum.selfHosted) {
                await this.medplum.startClientLogin(config_1.default.medplum.clientId, config_1.default.medplum.clientSecret);
            }
            else {
                await this.medplum.startClientLogin(config_1.default.medplum.clientId, config_1.default.medplum.clientSecret);
                if (config_1.default.medplum.projectId) {
                    await this.medplum.setActiveProject(config_1.default.medplum.projectId);
                }
            }
            await this.testConnection();
            this.isInitialized = true;
            this.reconnectAttempts = 0;
            logger_1.default.info('Medplum FHIR server connection established successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to initialize Medplum connection:', error);
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                logger_1.default.info(`Retrying connection... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                const delay = Math.pow(2, this.reconnectAttempts) * 1000;
                setTimeout(() => this.initialize(), delay);
            }
            else {
                throw new Error(`Failed to establish Medplum connection after ${this.maxReconnectAttempts} attempts`);
            }
        }
    }
    async testConnection() {
        try {
            const response = await this.medplum.readResource('Patient', 'test-patient-id').catch(() => null);
            logger_1.default.debug('Connection test completed successfully');
        }
        catch (error) {
            logger_1.default.warn('Connection test failed, but proceeding...');
        }
    }
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('MedplumService not initialized. Call initialize() first.');
        }
    }
    async createResource(resource) {
        this.ensureInitialized();
        try {
            logger_1.default.debug(`Creating ${resource.resourceType} resource`);
            const result = await this.medplum.createResource(resource);
            logger_1.default.info(`Successfully created ${resource.resourceType} with ID: ${result.id}`);
            return result;
        }
        catch (error) {
            logger_1.default.error(`Failed to create ${resource.resourceType} resource:`, error);
            throw this.handleFHIRError(error);
        }
    }
    async readResource(resourceType, id) {
        this.ensureInitialized();
        try {
            logger_1.default.debug(`Reading ${resourceType} resource with ID: ${id}`);
            const result = await this.medplum.readResource(resourceType, id);
            logger_1.default.debug(`Successfully retrieved ${resourceType} with ID: ${id}`);
            return result;
        }
        catch (error) {
            logger_1.default.error(`Failed to read ${resourceType} resource with ID ${id}:`, error);
            throw this.handleFHIRError(error);
        }
    }
    async updateResource(resource) {
        this.ensureInitialized();
        if (!resource.id) {
            throw new Error('Resource must have an ID to be updated');
        }
        try {
            logger_1.default.debug(`Updating ${resource.resourceType} resource with ID: ${resource.id}`);
            const result = await this.medplum.updateResource(resource);
            logger_1.default.info(`Successfully updated ${resource.resourceType} with ID: ${result.id}`);
            return result;
        }
        catch (error) {
            logger_1.default.error(`Failed to update ${resource.resourceType} resource:`, error);
            throw this.handleFHIRError(error);
        }
    }
    async deleteResource(resourceType, id) {
        this.ensureInitialized();
        try {
            logger_1.default.debug(`Deleting ${resourceType} resource with ID: ${id}`);
            await this.medplum.deleteResource(resourceType, id);
            logger_1.default.info(`Successfully deleted ${resourceType} with ID: ${id}`);
        }
        catch (error) {
            logger_1.default.error(`Failed to delete ${resourceType} resource with ID ${id}:`, error);
            throw this.handleFHIRError(error);
        }
    }
    async searchResources(resourceType, searchParams = {}) {
        this.ensureInitialized();
        try {
            logger_1.default.debug(`Searching ${resourceType} resources with params:`, searchParams);
            const searchRequest = {
                resourceType,
                filters: this.convertSearchParams(searchParams),
                count: searchParams._count,
                offset: searchParams._offset,
                sortRules: searchParams._sort ? this.parseSortRules(searchParams._sort) : undefined,
                total: searchParams._total,
                summary: searchParams._summary,
                elements: searchParams._elements?.split(','),
                include: searchParams._include?.split(','),
                revInclude: searchParams._revinclude?.split(','),
            };
            const result = await this.medplum.search(searchRequest);
            logger_1.default.debug(`Search returned ${result.entry?.length || 0} results for ${resourceType}`);
            return result;
        }
        catch (error) {
            logger_1.default.error(`Failed to search ${resourceType} resources:`, error);
            throw this.handleFHIRError(error);
        }
    }
    async executeBatch(bundleRequest) {
        this.ensureInitialized();
        try {
            logger_1.default.debug(`Executing ${bundleRequest.type} bundle with ${bundleRequest.resources.length} resources`);
            const bundle = {
                resourceType: 'Bundle',
                type: bundleRequest.type,
                timestamp: bundleRequest.timestamp || new Date().toISOString(),
                entry: bundleRequest.resources.map((resource, index) => ({
                    request: {
                        method: resource.id ? 'PUT' : 'POST',
                        url: resource.id ? `${resource.resourceType}/${resource.id}` : resource.resourceType,
                    },
                    resource: resource,
                })),
            };
            const result = await this.medplum.executeBatch(bundle);
            logger_1.default.info(`Successfully executed ${bundleRequest.type} bundle`);
            return result;
        }
        catch (error) {
            logger_1.default.error(`Failed to execute batch bundle:`, error);
            throw this.handleFHIRError(error);
        }
    }
    async getCapabilityStatement() {
        this.ensureInitialized();
        try {
            logger_1.default.debug('Retrieving FHIR capability statement');
            const result = await this.medplum.get('metadata');
            logger_1.default.debug('Successfully retrieved capability statement');
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to retrieve capability statement:', error);
            throw this.handleFHIRError(error);
        }
    }
    async graphql(query, variables) {
        this.ensureInitialized();
        try {
            logger_1.default.debug('Executing GraphQL query');
            const result = await this.medplum.graphql(query, variables);
            logger_1.default.debug('GraphQL query executed successfully');
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to execute GraphQL query:', error);
            throw this.handleFHIRError(error);
        }
    }
    async createSubscription(criteria, channelType, endpoint) {
        this.ensureInitialized();
        try {
            logger_1.default.debug(`Creating subscription for criteria: ${criteria}`);
            const subscription = {
                resourceType: 'Subscription',
                status: 'requested',
                reason: 'OmniCare EMR Integration',
                criteria,
                channel: {
                    type: channelType,
                    endpoint,
                    payload: 'application/fhir+json',
                },
            };
            const result = await this.medplum.createResource(subscription);
            logger_1.default.info(`Successfully created subscription with ID: ${result.id}`);
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to create subscription:', error);
            throw this.handleFHIRError(error);
        }
    }
    async validateResource(resource) {
        this.ensureInitialized();
        try {
            logger_1.default.debug(`Validating ${resource.resourceType} resource`);
            const result = await this.medplum.validateResource(resource);
            logger_1.default.debug(`Validation completed for ${resource.resourceType}`);
            return result;
        }
        catch (error) {
            logger_1.default.error(`Failed to validate ${resource.resourceType} resource:`, error);
            throw this.handleFHIRError(error);
        }
    }
    convertSearchParams(params) {
        const filters = [];
        Object.entries(params).forEach(([key, value]) => {
            if (key.startsWith('_') || !value)
                return;
            filters.push({
                code: key,
                operator: 'equals',
                value: String(value),
            });
        });
        return filters;
    }
    parseSortRules(sortString) {
        return sortString.split(',').map(rule => {
            const [code, order] = rule.trim().split(':');
            return {
                code: code.trim(),
                descending: order?.trim() === 'desc',
            };
        });
    }
    handleFHIRError(error) {
        if (error.outcome) {
            const issue = error.outcome.issue?.[0];
            const message = issue?.diagnostics || issue?.details?.text || 'FHIR operation failed';
            return new Error(`FHIR Error: ${message}`);
        }
        if (error.response?.data?.resourceType === 'OperationOutcome') {
            const issue = error.response.data.issue?.[0];
            const message = issue?.diagnostics || issue?.details?.text || 'FHIR operation failed';
            return new Error(`FHIR Error: ${message}`);
        }
        return error instanceof Error ? error : new Error(String(error));
    }
    async getHealthStatus() {
        try {
            if (!this.isInitialized) {
                return { status: 'DOWN', details: { reason: 'Not initialized' } };
            }
            const start = Date.now();
            await this.medplum.get('metadata');
            const responseTime = Date.now() - start;
            return {
                status: 'UP',
                details: {
                    responseTime: `${responseTime}ms`,
                    baseUrl: config_1.default.medplum.baseUrl,
                    selfHosted: config_1.default.medplum.selfHosted,
                    initialized: this.isInitialized,
                },
            };
        }
        catch (error) {
            return {
                status: 'DOWN',
                details: {
                    error: error instanceof Error ? error.message : String(error),
                    reconnectAttempts: this.reconnectAttempts,
                },
            };
        }
    }
    async shutdown() {
        logger_1.default.info('Shutting down Medplum service...');
        this.isInitialized = false;
    }
}
exports.MedplumService = MedplumService;
exports.medplumService = new MedplumService();
//# sourceMappingURL=medplum.service.js.map