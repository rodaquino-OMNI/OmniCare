"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fhir_controller_1 = require("@/controllers/fhir.controller");
const auth_controller_1 = require("@/controllers/auth.controller");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.auditLog);
router.get('/health', fhir_controller_1.fhirController.healthCheck.bind(fhir_controller_1.fhirController));
router.get('/auth/authorize', auth_controller_1.authController.authorize.bind(auth_controller_1.authController));
router.post('/auth/token', auth_controller_1.authController.token.bind(auth_controller_1.authController));
router.post('/auth/introspect', auth_controller_1.authController.introspect.bind(auth_controller_1.authController));
router.post('/auth/login', auth_controller_1.authController.login.bind(auth_controller_1.authController));
router.post('/auth/refresh', auth_controller_1.authController.refreshInternalToken.bind(auth_controller_1.authController));
router.get('/fhir/R4/metadata', fhir_controller_1.fhirController.getCapabilityStatement.bind(fhir_controller_1.fhirController));
router.post('/fhir/R4', auth_middleware_1.authenticate, (0, auth_middleware_1.requireScope)('system/*.write', 'user/*.write'), fhir_controller_1.fhirController.processBatch.bind(fhir_controller_1.fhirController));
router.post('/fhir/R4/$graphql', auth_middleware_1.authenticate, (0, auth_middleware_1.requireScope)('system/*.read', 'user/*.read'), fhir_controller_1.fhirController.executeGraphQL.bind(fhir_controller_1.fhirController));
router.post('/fhir/R4/:resourceType/$validate', auth_middleware_1.authenticate, (0, auth_middleware_1.requireScope)('system/*.read', 'user/*.read'), fhir_controller_1.fhirController.validateResource.bind(fhir_controller_1.fhirController));
router.get('/fhir/R4/Patient/:id/$everything', auth_middleware_1.authenticate, auth_middleware_1.requirePatientAccess, (0, auth_middleware_1.requireResourceAccess)('Patient', 'read'), fhir_controller_1.fhirController.getPatientEverything.bind(fhir_controller_1.fhirController));
router.post('/fhir/R4/:resourceType', auth_middleware_1.authenticate, (req, res, next) => {
    const resourceType = req.params.resourceType;
    return (0, auth_middleware_1.requireResourceAccess)(resourceType, 'create')(req, res, next);
}, fhir_controller_1.fhirController.createResource.bind(fhir_controller_1.fhirController));
router.get('/fhir/R4/:resourceType', auth_middleware_1.authenticate, (req, res, next) => {
    const resourceType = req.params.resourceType;
    const patientParam = req.query.patient || req.query['subject:Patient'];
    if (patientParam && !req.user?.scope?.some(s => s.includes('system/'))) {
        return (0, auth_middleware_1.requirePatientAccess)(req, res, () => {
            return (0, auth_middleware_1.requireResourceAccess)(resourceType, 'read')(req, res, next);
        });
    }
    else {
        return (0, auth_middleware_1.requireResourceAccess)(resourceType, 'read')(req, res, next);
    }
}, fhir_controller_1.fhirController.searchResources.bind(fhir_controller_1.fhirController));
router.get('/fhir/R4/:resourceType/:id', auth_middleware_1.authenticate, (req, res, next) => {
    const resourceType = req.params.resourceType;
    if (['Patient', 'Observation', 'MedicationRequest', 'Encounter', 'DiagnosticReport', 'CarePlan'].includes(resourceType)) {
        if (resourceType === 'Patient') {
            req.params.patientId = req.params.id;
            return (0, auth_middleware_1.requirePatientAccess)(req, res, () => {
                return (0, auth_middleware_1.requireResourceAccess)(resourceType, 'read')(req, res, next);
            });
        }
        else {
            return (0, auth_middleware_1.requireResourceAccess)(resourceType, 'read')(req, res, next);
        }
    }
    else {
        return (0, auth_middleware_1.requireResourceAccess)(resourceType, 'read')(req, res, next);
    }
}, fhir_controller_1.fhirController.readResource.bind(fhir_controller_1.fhirController));
router.put('/fhir/R4/:resourceType/:id', auth_middleware_1.authenticate, (req, res, next) => {
    const resourceType = req.params.resourceType;
    if (['Patient', 'Observation', 'MedicationRequest', 'Encounter', 'DiagnosticReport', 'CarePlan'].includes(resourceType)) {
        if (resourceType === 'Patient') {
            req.params.patientId = req.params.id;
            return (0, auth_middleware_1.requirePatientAccess)(req, res, () => {
                return (0, auth_middleware_1.requireResourceAccess)(resourceType, 'write')(req, res, next);
            });
        }
        else {
            return (0, auth_middleware_1.requireResourceAccess)(resourceType, 'write')(req, res, next);
        }
    }
    else {
        return (0, auth_middleware_1.requireResourceAccess)(resourceType, 'write')(req, res, next);
    }
}, fhir_controller_1.fhirController.updateResource.bind(fhir_controller_1.fhirController));
router.delete('/fhir/R4/:resourceType/:id', auth_middleware_1.authenticate, (req, res, next) => {
    const resourceType = req.params.resourceType;
    if (['Patient', 'Observation', 'MedicationRequest', 'Encounter', 'DiagnosticReport', 'CarePlan'].includes(resourceType)) {
        if (resourceType === 'Patient') {
            req.params.patientId = req.params.id;
            return (0, auth_middleware_1.requirePatientAccess)(req, res, () => {
                return (0, auth_middleware_1.requireResourceAccess)(resourceType, 'delete')(req, res, next);
            });
        }
        else {
            return (0, auth_middleware_1.requireResourceAccess)(resourceType, 'delete')(req, res, next);
        }
    }
    else {
        return (0, auth_middleware_1.requireResourceAccess)(resourceType, 'delete')(req, res, next);
    }
}, fhir_controller_1.fhirController.deleteResource.bind(fhir_controller_1.fhirController));
router.get('/fhir/R4/Subscription', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, fhir_controller_1.fhirController.listSubscriptions.bind(fhir_controller_1.fhirController));
router.get('/cds-services', fhir_controller_1.fhirController.getCDSServices.bind(fhir_controller_1.fhirController));
router.post('/cds-services/:serviceId', auth_middleware_1.authenticate, (0, auth_middleware_1.requireScope)('user/*.read', 'system/*.read'), fhir_controller_1.fhirController.executeCDSHook.bind(fhir_controller_1.fhirController));
router.get('/admin/stats', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const stats = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
        };
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get system stats' });
    }
});
router.post('/api/vitals/:patientId', auth_middleware_1.authenticate, auth_middleware_1.requirePatientAccess, (0, auth_middleware_1.requireResourceAccess)('Observation', 'create'), async (req, res) => {
    try {
        const { patientId } = req.params;
        const { encounterId, vitals } = req.body;
        const { fhirResourcesService } = await Promise.resolve().then(() => __importStar(require('@/services/fhir-resources.service')));
        const observations = await fhirResourcesService.createVitalSigns(patientId, encounterId, vitals);
        res.status(201).json({
            resourceType: 'Bundle',
            type: 'collection',
            entry: observations.map(obs => ({ resource: obs })),
        });
    }
    catch (error) {
        res.status(500).json({
            resourceType: 'OperationOutcome',
            issue: [{
                    severity: 'error',
                    code: 'exception',
                    diagnostics: 'Failed to create vital signs',
                }],
        });
    }
});
router.post('/api/prescriptions', auth_middleware_1.authenticate, (0, auth_middleware_1.requireScope)('user/*.write', 'system/*.write'), async (req, res) => {
    try {
        const medicationRequest = req.body;
        const { fhirResourcesService } = await Promise.resolve().then(() => __importStar(require('@/services/fhir-resources.service')));
        const result = await fhirResourcesService.createMedicationRequest(medicationRequest);
        res.status(201).json(result);
    }
    catch (error) {
        res.status(500).json({
            resourceType: 'OperationOutcome',
            issue: [{
                    severity: 'error',
                    code: 'exception',
                    diagnostics: 'Failed to create medication request',
                }],
        });
    }
});
router.post('/api/care-plans', auth_middleware_1.authenticate, (0, auth_middleware_1.requireScope)('user/*.write', 'system/*.write'), async (req, res) => {
    try {
        const carePlan = req.body;
        const { fhirResourcesService } = await Promise.resolve().then(() => __importStar(require('@/services/fhir-resources.service')));
        const result = await fhirResourcesService.createCarePlan(carePlan);
        res.status(201).json(result);
    }
    catch (error) {
        res.status(500).json({
            resourceType: 'OperationOutcome',
            issue: [{
                    severity: 'error',
                    code: 'exception',
                    diagnostics: 'Failed to create care plan',
                }],
        });
    }
});
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
router.use((error, req, res, next) => {
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
exports.default = router;
//# sourceMappingURL=index.js.map