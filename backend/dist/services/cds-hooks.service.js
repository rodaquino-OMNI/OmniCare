"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cdsHooksService = exports.CDSHooksService = void 0;
const fhir_resources_service_1 = require("./fhir-resources.service");
const logger_1 = __importDefault(require("@/utils/logger"));
class CDSHooksService {
    services = [
        {
            hook: 'patient-view',
            name: 'Patient Risk Assessment',
            title: 'OmniCare Patient Risk Assessment',
            description: 'Assess patient risk factors and provide preventive care recommendations',
            id: 'omnicare-patient-risk-assessment',
            prefetch: {
                patient: 'Patient/{{context.patientId}}',
                conditions: 'Condition?patient={{context.patientId}}',
                medications: 'MedicationRequest?patient={{context.patientId}}&status=active',
                observations: 'Observation?patient={{context.patientId}}&category=vital-signs&_sort=-date&_count=10',
                allergies: 'AllergyIntolerance?patient={{context.patientId}}',
            },
        },
        {
            hook: 'medication-prescribe',
            name: 'Medication Safety Check',
            title: 'OmniCare Medication Safety Check',
            description: 'Check for drug interactions, allergies, and dosing recommendations',
            id: 'omnicare-medication-safety',
            prefetch: {
                patient: 'Patient/{{context.patientId}}',
                medications: 'MedicationRequest?patient={{context.patientId}}&status=active',
                allergies: 'AllergyIntolerance?patient={{context.patientId}}',
                conditions: 'Condition?patient={{context.patientId}}',
                observations: 'Observation?patient={{context.patientId}}&category=laboratory&_sort=-date&_count=5',
            },
        },
        {
            hook: 'order-review',
            name: 'Order Appropriateness',
            title: 'OmniCare Order Appropriateness Check',
            description: 'Review diagnostic and therapeutic orders for appropriateness',
            id: 'omnicare-order-review',
            prefetch: {
                patient: 'Patient/{{context.patientId}}',
                conditions: 'Condition?patient={{context.patientId}}',
                observations: 'Observation?patient={{context.patientId}}&_sort=-date&_count=20',
                procedures: 'Procedure?patient={{context.patientId}}&_sort=-date&_count=10',
            },
        },
        {
            hook: 'encounter-start',
            name: 'Encounter Preparation',
            title: 'OmniCare Encounter Preparation',
            description: 'Prepare encounter with relevant patient information and care gaps',
            id: 'omnicare-encounter-prep',
            prefetch: {
                patient: 'Patient/{{context.patientId}}',
                encounter: 'Encounter/{{context.encounterId}}',
                conditions: 'Condition?patient={{context.patientId}}',
                medications: 'MedicationRequest?patient={{context.patientId}}&status=active',
                carePlans: 'CarePlan?patient={{context.patientId}}&status=active',
            },
        },
        {
            hook: 'encounter-discharge',
            name: 'Discharge Planning',
            title: 'OmniCare Discharge Planning',
            description: 'Assist with discharge planning and follow-up care coordination',
            id: 'omnicare-discharge-planning',
            prefetch: {
                patient: 'Patient/{{context.patientId}}',
                encounter: 'Encounter/{{context.encounterId}}',
                conditions: 'Condition?patient={{context.patientId}}',
                medications: 'MedicationRequest?patient={{context.patientId}}&status=active',
                procedures: 'Procedure?patient={{context.patientId}}&encounter={{context.encounterId}}',
            },
        },
    ];
    getDiscoveryDocument() {
        logger_1.default.info('CDS Hooks discovery document requested');
        return {
            services: this.services.map(service => ({
                ...service,
                usageRequirements: service.usageRequirements || 'User must be authenticated with appropriate clinical permissions',
            })),
        };
    }
    async executePatientView(request) {
        try {
            logger_1.default.info('Executing patient-view CDS hook', {
                hookInstance: request.hookInstance,
                patientId: request.context.patientId,
            });
            const cards = [];
            const prefetchData = request.prefetch || {};
            const patient = prefetchData.patient ||
                await fhir_resources_service_1.fhirResourcesService.getPatient(request.context.patientId);
            const riskCard = await this.assessPatientRisk(patient, prefetchData);
            if (riskCard)
                cards.push(riskCard);
            const preventiveCard = await this.checkPreventiveCare(patient, prefetchData);
            if (preventiveCard)
                cards.push(preventiveCard);
            const careGapsCard = await this.identifyCareGaps(patient, prefetchData);
            if (careGapsCard)
                cards.push(careGapsCard);
            logger_1.default.info('Patient-view CDS hook completed', {
                hookInstance: request.hookInstance,
                cardsGenerated: cards.length,
            });
            return { cards };
        }
        catch (error) {
            logger_1.default.error('Failed to execute patient-view hook:', error);
            throw error;
        }
    }
    async executeMedicationPrescribe(request) {
        try {
            logger_1.default.info('Executing medication-prescribe CDS hook', {
                hookInstance: request.hookInstance,
                patientId: request.context.patientId,
                draftOrders: request.context.draftOrders?.length || 0,
            });
            const cards = [];
            const prefetchData = request.prefetch || {};
            const patient = prefetchData.patient ||
                await fhir_resources_service_1.fhirResourcesService.getPatient(request.context.patientId);
            for (const draftOrder of request.context.draftOrders || []) {
                if (draftOrder.resourceType === 'MedicationRequest') {
                    const interactionCard = await this.checkDrugInteractions(draftOrder, prefetchData);
                    if (interactionCard)
                        cards.push(interactionCard);
                    const allergyCard = await this.checkDrugAllergies(draftOrder, patient, prefetchData);
                    if (allergyCard)
                        cards.push(allergyCard);
                    const dosingCard = await this.checkDosing(draftOrder, patient, prefetchData);
                    if (dosingCard)
                        cards.push(dosingCard);
                    const contraindicationCard = await this.checkContraindications(draftOrder, prefetchData);
                    if (contraindicationCard)
                        cards.push(contraindicationCard);
                }
            }
            logger_1.default.info('Medication-prescribe CDS hook completed', {
                hookInstance: request.hookInstance,
                cardsGenerated: cards.length,
            });
            return { cards };
        }
        catch (error) {
            logger_1.default.error('Failed to execute medication-prescribe hook:', error);
            throw error;
        }
    }
    async executeOrderReview(request) {
        try {
            logger_1.default.info('Executing order-review CDS hook', {
                hookInstance: request.hookInstance,
                patientId: request.context.patientId,
                draftOrders: request.context.draftOrders?.length || 0,
            });
            const cards = [];
            const prefetchData = request.prefetch || {};
            const patient = prefetchData.patient ||
                await fhir_resources_service_1.fhirResourcesService.getPatient(request.context.patientId);
            for (const draftOrder of request.context.draftOrders || []) {
                if (draftOrder.resourceType === 'ServiceRequest') {
                    const appropriatenessCard = await this.checkOrderAppropriateness(draftOrder, patient, prefetchData);
                    if (appropriatenessCard)
                        cards.push(appropriatenessCard);
                    const duplicateCard = await this.checkDuplicateOrders(draftOrder, prefetchData);
                    if (duplicateCard)
                        cards.push(duplicateCard);
                    const costCard = await this.checkCostEffectiveness(draftOrder, patient);
                    if (costCard)
                        cards.push(costCard);
                }
            }
            logger_1.default.info('Order-review CDS hook completed', {
                hookInstance: request.hookInstance,
                cardsGenerated: cards.length,
            });
            return { cards };
        }
        catch (error) {
            logger_1.default.error('Failed to execute order-review hook:', error);
            throw error;
        }
    }
    async assessPatientRisk(patient, prefetchData) {
        try {
            const conditions = prefetchData.conditions?.entry?.map((e) => e.resource) || [];
            const observations = prefetchData.observations?.entry?.map((e) => e.resource) || [];
            const riskFactors = [];
            if (conditions.some((c) => c.code?.coding?.some((coding) => coding.code === 'E11' || coding.display?.toLowerCase().includes('diabetes')))) {
                riskFactors.push('Type 2 Diabetes');
            }
            if (conditions.some((c) => c.code?.coding?.some((coding) => coding.code === 'I10' || coding.display?.toLowerCase().includes('hypertension')))) {
                riskFactors.push('Hypertension');
            }
            const latestBP = observations.find((o) => o.code?.coding?.some((c) => c.code === '85354-9'));
            if (latestBP?.component) {
                const systolic = latestBP.component.find((c) => c.code?.coding?.some((coding) => coding.code === '8480-6'))?.valueQuantity?.value;
                const diastolic = latestBP.component.find((c) => c.code?.coding?.some((coding) => coding.code === '8462-4'))?.valueQuantity?.value;
                if (systolic >= 140 || diastolic >= 90) {
                    riskFactors.push('Elevated Blood Pressure');
                }
            }
            if (riskFactors.length === 0)
                return null;
            return {
                summary: `Patient has ${riskFactors.length} identified risk factor(s)`,
                detail: `Risk factors identified: ${riskFactors.join(', ')}. Consider preventive interventions and closer monitoring.`,
                indicator: 'warning',
                source: {
                    label: 'OmniCare Risk Assessment',
                    url: 'https://omnicare.com/clinical-guidelines/risk-assessment',
                },
                suggestions: [{
                        label: 'Review care plan for risk management',
                        actions: [{
                                type: 'create',
                                description: 'Create care plan for risk factor management',
                                resource: {
                                    resourceType: 'CarePlan',
                                    status: 'draft',
                                    intent: 'plan',
                                    subject: { reference: `Patient/${patient.id}` },
                                    title: 'Risk Factor Management Plan',
                                    description: `Management plan for identified risk factors: ${riskFactors.join(', ')}`,
                                },
                            }],
                    }],
            };
        }
        catch (error) {
            logger_1.default.error('Failed to assess patient risk:', error);
            return null;
        }
    }
    async checkPreventiveCare(patient, prefetchData) {
        try {
            if (!patient.birthDate)
                return null;
            const age = new Date().getFullYear() - new Date(patient.birthDate).getFullYear();
            const recommendations = [];
            if (age >= 50) {
                recommendations.push('Colorectal cancer screening');
                recommendations.push('Annual wellness visit');
            }
            if (age >= 40 && patient.gender === 'female') {
                recommendations.push('Mammography screening');
            }
            if (age >= 65) {
                recommendations.push('Pneumococcal vaccination');
                recommendations.push('Annual influenza vaccination');
            }
            if (recommendations.length === 0)
                return null;
            return {
                summary: `${recommendations.length} preventive care recommendation(s)`,
                detail: `Recommended preventive care: ${recommendations.join(', ')}`,
                indicator: 'info',
                source: {
                    label: 'OmniCare Preventive Care Guidelines',
                    url: 'https://omnicare.com/clinical-guidelines/preventive-care',
                },
                links: [{
                        label: 'View full preventive care guidelines',
                        url: 'https://omnicare.com/clinical-guidelines/preventive-care',
                        type: 'absolute',
                    }],
            };
        }
        catch (error) {
            logger_1.default.error('Failed to check preventive care:', error);
            return null;
        }
    }
    async identifyCareGaps(patient, prefetchData) {
        try {
            const conditions = prefetchData.conditions?.entry?.map((e) => e.resource) || [];
            const medications = prefetchData.medications?.entry?.map((e) => e.resource) || [];
            const observations = prefetchData.observations?.entry?.map((e) => e.resource) || [];
            const careGaps = [];
            const hasDiabetes = conditions.some((c) => c.code?.coding?.some((coding) => coding.display?.toLowerCase().includes('diabetes')));
            if (hasDiabetes) {
                const hasA1C = observations.some((o) => o.code?.coding?.some((c) => c.code === '4548-4' || c.display?.includes('A1C')));
                if (!hasA1C) {
                    careGaps.push('Missing HbA1c monitoring for diabetes');
                }
            }
            if (careGaps.length === 0)
                return null;
            return {
                summary: `${careGaps.length} care gap(s) identified`,
                detail: `Care gaps: ${careGaps.join(', ')}`,
                indicator: 'warning',
                source: {
                    label: 'OmniCare Care Gap Analysis',
                    url: 'https://omnicare.com/clinical-guidelines/care-gaps',
                },
            };
        }
        catch (error) {
            logger_1.default.error('Failed to identify care gaps:', error);
            return null;
        }
    }
    async checkDrugInteractions(medicationRequest, prefetchData) {
        try {
            const currentMedications = prefetchData.medications?.entry?.map((e) => e.resource) || [];
            const newMedication = medicationRequest.medicationCodeableConcept?.coding?.[0]?.display;
            if (!newMedication)
                return null;
            const interactions = this.checkForKnownInteractions(newMedication, currentMedications);
            if (interactions.length === 0)
                return null;
            return {
                summary: `${interactions.length} potential drug interaction(s) detected`,
                detail: `Potential interactions: ${interactions.join(', ')}`,
                indicator: 'critical',
                source: {
                    label: 'OmniCare Drug Interaction Check',
                    url: 'https://omnicare.com/clinical-guidelines/drug-interactions',
                },
                suggestions: [{
                        label: 'Review interaction and consider alternatives',
                        actions: [{
                                type: 'delete',
                                description: 'Remove problematic medication order',
                                resourceId: medicationRequest.id,
                            }],
                    }],
            };
        }
        catch (error) {
            logger_1.default.error('Failed to check drug interactions:', error);
            return null;
        }
    }
    async checkDrugAllergies(medicationRequest, patient, prefetchData) {
        try {
            const allergies = prefetchData.allergies?.entry?.map((e) => e.resource) || [];
            const newMedication = medicationRequest.medicationCodeableConcept?.coding?.[0]?.display;
            if (!newMedication || allergies.length === 0)
                return null;
            const matchingAllergies = allergies.filter((allergy) => allergy.code?.coding?.some((coding) => coding.display?.toLowerCase().includes(newMedication.toLowerCase()) ||
                newMedication.toLowerCase().includes(coding.display?.toLowerCase())));
            if (matchingAllergies.length === 0)
                return null;
            return {
                summary: 'ALLERGY ALERT: Patient has documented allergy',
                detail: `Patient has documented allergy to ${newMedication}. Reaction: ${matchingAllergies[0].reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display || 'Unknown'}`,
                indicator: 'critical',
                source: {
                    label: 'OmniCare Allergy Check',
                },
                suggestions: [{
                        label: 'Cancel order due to allergy',
                        actions: [{
                                type: 'delete',
                                description: 'Remove order due to patient allergy',
                                resourceId: medicationRequest.id,
                            }],
                    }],
            };
        }
        catch (error) {
            logger_1.default.error('Failed to check drug allergies:', error);
            return null;
        }
    }
    checkForKnownInteractions(newMedication, currentMedications) {
        const interactions = [];
        const knownInteractions = {
            'warfarin': ['aspirin', 'ibuprofen', 'naproxen'],
            'digoxin': ['furosemide', 'spironolactone'],
            'metformin': [],
        };
        const newMedLower = newMedication.toLowerCase();
        currentMedications.forEach(med => {
            const currentMedName = med.medicationCodeableConcept?.coding?.[0]?.display?.toLowerCase();
            if (currentMedName) {
                Object.entries(knownInteractions).forEach(([drug, interactsWith]) => {
                    if (newMedLower.includes(drug) && interactsWith.some(interaction => currentMedName.includes(interaction))) {
                        interactions.push(`${newMedication} + ${currentMedName}`);
                    }
                });
            }
        });
        return interactions;
    }
    async checkDosing(medicationRequest, patient, prefetchData) {
        return null;
    }
    async checkContraindications(medicationRequest, prefetchData) {
        return null;
    }
    async checkOrderAppropriateness(serviceRequest, patient, prefetchData) {
        return null;
    }
    async checkDuplicateOrders(serviceRequest, prefetchData) {
        return null;
    }
    async checkCostEffectiveness(serviceRequest, patient) {
        return null;
    }
    async getHealthStatus() {
        try {
            return {
                status: 'UP',
                details: {
                    servicesAvailable: this.services.length,
                    services: this.services.map(s => ({ id: s.id, hook: s.hook, name: s.name })),
                },
            };
        }
        catch (error) {
            return {
                status: 'DOWN',
                details: { error: error instanceof Error ? error.message : String(error) },
            };
        }
    }
}
exports.CDSHooksService = CDSHooksService;
exports.cdsHooksService = new CDSHooksService();
//# sourceMappingURL=cds-hooks.service.js.map