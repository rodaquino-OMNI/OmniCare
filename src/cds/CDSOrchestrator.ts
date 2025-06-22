/**
 * OmniCare CDS Orchestrator
 * 
 * Central orchestrator for all Clinical Decision Support services
 * Coordinates between different CDS components and provides unified interface
 */

import { AlertService } from './alerts/AlertService';
import { AllergyAlertService } from './allergies/AllergyAlertService';
import { ClinicalGuidelinesService } from './guidelines/ClinicalGuidelinesService';
import { CDSHooksService } from './hooks/CDSHooksService';
import { DrugInteractionService } from './interactions/DrugInteractionService';
import { RiskScoringService } from './scoring/RiskScoringService';
import {
  Patient,
  Medication,
  CDSHookRequest,
  CDSHookResponse,
  Alert,
  RiskScore,
  CDSConfiguration,
  ClinicalGuideline,
  Recommendation
} from './types/CDSTypes';

interface QualityGap {
  measureName: string;
  description: string;
  dueDate?: Date;
  priority: 'High' | 'Medium' | 'Low';
}

export class CDSOrchestrator {
  private cdsHooksService!: CDSHooksService;
  private drugInteractionService!: DrugInteractionService;
  private allergyAlertService!: AllergyAlertService;
  private clinicalGuidelinesService!: ClinicalGuidelinesService;
  private riskScoringService!: RiskScoringService;
  private alertService!: AlertService;
  private config: CDSConfiguration;

  constructor(config?: Partial<CDSConfiguration>) {
    // Default configuration
    this.config = {
      enabledServices: [
        'hooks',
        'drug-interactions',
        'allergies',
        'guidelines',
        'risk-scoring',
        'alerts'
      ],
      alertThresholds: {
        drugInteraction: 'Moderate',
        allergyAlert: 'Medium'
      },
      timeouts: {
        hookResponse: 5000,
        externalService: 10000
      },
      externalServices: {
        drugDatabase: 'https://api.drugbank.com',
        guidelinesService: 'https://api.guidelines.gov',
        evidenceService: 'https://api.pubmed.ncbi.nlm.nih.gov'
      },
      customRules: [],
      ...config
    };

    // Initialize services
    this.initializeServices();
  }

  /**
   * Process CDS Hook request - main entry point for external CDS Hook calls
   */
  async processCDSHook(request: CDSHookRequest): Promise<CDSHookResponse> {
    try {
      // TODO: Replace with proper logger
      // console.log(`Processing CDS Hook: ${request.hook} for patient ${request.context.patientId}`);
      
      // Process through CDS Hooks Service
      const response = await this.cdsHooksService.processHook(request);
      
      // Log the interaction
      this.logCDSInteraction(request, response);
      
      return response;
    } catch (error) {
      console.error('Error processing CDS Hook:', error);
      return {
        cards: [{
          summary: 'Clinical decision support temporarily unavailable',
          indicator: 'warning',
          source: {
            label: 'OmniCare CDS System',
            url: 'https://omnicare.example.com/cds'
          }
        }]
      };
    }
  }

  /**
   * Comprehensive patient assessment
   */
  async assessPatient(patient: Patient): Promise<{
    riskScores: RiskScore[];
    alerts: Alert[];
    recommendations: Recommendation[];
    guidelines: ClinicalGuideline[];
  }> {
    // TODO: Replace with proper logger
    // console.log(`Performing comprehensive assessment for patient ${patient.patientId}`);

    // Run all assessments in parallel for efficiency
    const [riskScores, guidelines, preventiveRecommendations] = await Promise.all([
      this.riskScoringService.getAllRiskScores(patient),
      this.clinicalGuidelinesService.getGuidelinesForConditions(patient.medicalHistory, patient),
      this.clinicalGuidelinesService.getPreventiveCareRecommendations(patient)
    ]);

    // Generate alerts based on risk scores
    const alerts: Alert[] = [];
    for (const riskScore of riskScores) {
      if (riskScore.risk === 'High' || riskScore.risk === 'Very High') {
        const alert = await this.alertService.createRiskScoreAlert(patient.patientId, riskScore);
        alerts.push(alert);
      }
    }

    // Check for guideline-based recommendations
    const recommendations: Recommendation[] = [...preventiveRecommendations];
    
    // Get treatment recommendations for active conditions
    for (const condition of patient.medicalHistory.filter(c => c.status === 'Active')) {
      const treatmentRecs = await this.clinicalGuidelinesService.getTreatmentRecommendations(condition, patient);
      recommendations.push(...treatmentRecs);
    }

    return {
      riskScores,
      alerts,
      recommendations,
      guidelines
    };
  }

  /**
   * Medication safety check
   */
  async checkMedicationSafety(
    medication: Medication,
    patient: Patient
  ): Promise<{
    interactions: Alert[];
    allergies: Alert[];
    contraindications: Alert[];
    recommendations: string[];
  }> {
    // TODO: Replace with proper logger
    // console.log(`Checking medication safety: ${medication.name} for patient ${patient.patientId}`);

    const results = {
      interactions: [] as Alert[],
      allergies: [] as Alert[],
      contraindications: [] as Alert[],
      recommendations: [] as string[]
    };

    // Check drug interactions
    if (this.config.enabledServices.includes('drug-interactions')) {
      const interactions = await this.drugInteractionService.checkInteractions(
        medication,
        patient.currentMedications
      );

      for (const interaction of interactions) {
        const alert = await this.alertService.createDrugInteractionAlert(patient.patientId, interaction);
        results.interactions.push(alert);
      }

      // Check for contraindications
      const contraindications = await this.drugInteractionService.checkContraindications(
        medication,
        patient
      );
      
      for (const contraindication of contraindications) {
        const alert = await this.alertService.createDrugInteractionAlert(patient.patientId, contraindication);
        results.contraindications.push(alert);
      }
    }

    // Check allergies
    if (this.config.enabledServices.includes('allergies')) {
      const allergyAlerts = await this.allergyAlertService.checkAllergies(
        medication,
        patient.allergies
      );

      for (const allergyAlert of allergyAlerts) {
        const alert = await this.alertService.createAllergyAlert(patient.patientId, allergyAlert);
        results.allergies.push(alert);
      }
    }

    // Check clinical guidelines for contraindications
    if (this.config.enabledServices.includes('guidelines')) {
      const guidelineChecks = await this.clinicalGuidelinesService.checkGuidelineContraindications(
        medication,
        patient
      );

      results.recommendations.push(...guidelineChecks.warnings);
      results.recommendations.push(...guidelineChecks.adjustments);
    }

    return results;
  }

  /**
   * Quality measure gap analysis
   */
  async analyzeQualityGaps(patient: Patient): Promise<{
    gaps: Array<{
      measureName: string;
      description: string;
      dueDate?: Date;
      priority: 'High' | 'Medium' | 'Low';
    }>;
    alerts: Alert[];
  }> {
    const gaps: Array<{
      measureName: string;
      description: string;
      dueDate?: Date;
      priority: 'High' | 'Medium' | 'Low';
    }> = [];
    const alerts: Alert[] = [];

    // Get preventive care recommendations
    const recommendations = await this.clinicalGuidelinesService.getPreventiveCareRecommendations(patient);

    for (const recommendation of recommendations) {
      // Check if care is overdue (this would integrate with care history)
      const isOverdue = this.isPreventiveCareOverdue(patient, recommendation);
      
      if (isOverdue) {
        gaps.push({
          measureName: recommendation.title,
          description: recommendation.description,
          priority: recommendation.actions[0]?.priority === 'High' ? 'High' : 
                   recommendation.actions[0]?.priority === 'Medium' ? 'Medium' : 'Low'
        });

        // Create alert for high-priority gaps
        if (recommendation.actions[0]?.priority === 'High') {
          const alert = await this.alertService.createQualityMeasureAlert(
            patient.patientId,
            recommendation.title,
            `Overdue: ${recommendation.description}`
          );
          alerts.push(alert);
        }
      }
    }

    return { gaps, alerts };
  }

  /**
   * Get patient dashboard data
   */
  async getPatientDashboard(patientId: string): Promise<{
    activeAlerts: Alert[];
    riskScores: RiskScore[];
    qualityGaps: QualityGap[];
    recentRecommendations: Recommendation[];
  }> {
    const activeAlerts = await this.alertService.getActiveAlertsForPatient(patientId);
    
    // Get patient data (would normally come from patient service)
    const patient = this.getPatientData(patientId);
    
    const [assessment, qualityAnalysis] = await Promise.all([
      this.assessPatient(patient),
      this.analyzeQualityGaps(patient)
    ]);

    return {
      activeAlerts,
      riskScores: assessment.riskScores,
      qualityGaps: qualityAnalysis.gaps,
      recentRecommendations: assessment.recommendations.slice(0, 5) // Top 5 recommendations
    };
  }

  /**
   * Bulk patient assessment for population health
   */
  async assessPatientPopulation(patientIds: string[]): Promise<{
    highRiskPatients: Array<{ patientId: string; riskScores: RiskScore[] }>;
    qualityGaps: Array<{ patientId: string; gaps: QualityGap[] }>;
    totalAlerts: number;
    summary: {
      patientsAssessed: number;
      highRiskCount: number;
      totalGaps: number;
      averageRiskScore: number;
    };
  }> {
    // TODO: Replace with proper logger
    // console.log(`Assessing population of ${patientIds.length} patients`);

    const results = {
      highRiskPatients: [] as Array<{ patientId: string; riskScores: RiskScore[] }>,
      qualityGaps: [] as Array<{ patientId: string; gaps: QualityGap[] }>,
      totalAlerts: 0,
      summary: {
        patientsAssessed: 0,
        highRiskCount: 0,
        totalGaps: 0,
        averageRiskScore: 0
      }
    };

    // Process patients in batches to avoid overwhelming the system
    const batchSize = 10;
    const batches = this.chunkArray(patientIds, batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(async (patientId) => {
        try {
          const patient = this.getPatientData(patientId);
          const [assessment, qualityAnalysis] = await Promise.all([
            this.assessPatient(patient),
            this.analyzeQualityGaps(patient)
          ]);

          results.summary.patientsAssessed++;
          results.totalAlerts += assessment.alerts.length;

          // Check for high-risk patients
          const hasHighRisk = assessment.riskScores.some(
            score => score.risk === 'High' || score.risk === 'Very High'
          );

          if (hasHighRisk) {
            results.summary.highRiskCount++;
            results.highRiskPatients.push({
              patientId,
              riskScores: assessment.riskScores.filter(
                score => score.risk === 'High' || score.risk === 'Very High'
              )
            });
          }

          // Add quality gaps
          if (qualityAnalysis.gaps.length > 0) {
            results.summary.totalGaps += qualityAnalysis.gaps.length;
            results.qualityGaps.push({
              patientId,
              gaps: qualityAnalysis.gaps
            });
          }

          return assessment.riskScores;
        } catch (error) {
          // TODO: Replace with proper logger
          // console.error(`Error assessing patient ${patientId}:`, error);
          return [];
        }
      });

      // Wait for batch to complete
      await Promise.all(batchPromises);
    }

    return results;
  }

  /**
   * Initialize all CDS services
   */
  private initializeServices(): void {
    // TODO: Replace with proper logger
    // console.log('Initializing CDS Orchestrator services...');

    this.cdsHooksService = new CDSHooksService(this.config);
    this.drugInteractionService = new DrugInteractionService(
      this.config.externalServices.drugDatabase
    );
    this.allergyAlertService = new AllergyAlertService();
    this.clinicalGuidelinesService = new ClinicalGuidelinesService(
      this.config.externalServices.guidelinesService
    );
    this.riskScoringService = new RiskScoringService();
    this.alertService = new AlertService(this.config);

    // TODO: Replace with proper logger
    // console.log('CDS Orchestrator services initialized successfully');
  }

  /**
   * Mock patient data retrieval (would integrate with patient service)
   */
  private getPatientData(patientId: string): Patient {
    // This would integrate with your patient data service
    // For now, return mock data with more realistic patient information
    return {
      patientId,
      demographics: {
        age: 65,
        gender: 'M' as const,
        weight: 80,
        height: 175,
        bmi: 26.1
      },
      allergies: [],
      currentMedications: [],
      medicalHistory: [],
      labResults: [],
      preferences: {
        languagePreference: 'en',
        communicationPreferences: ['email']
      }
    };
  }

  /**
   * Check if preventive care is overdue
   */
  private isPreventiveCareOverdue(
    _patient: Patient, 
    _recommendation: Recommendation
  ): boolean {
    // This would check against care history
    // Mock implementation - assume some care is overdue for demo
    return Math.random() > 0.7; // 30% chance of being overdue
  }

  /**
   * Log CDS interactions for audit and analysis
   */
  private logCDSInteraction(
    request: CDSHookRequest,
    response: CDSHookResponse
  ): void {
    // This would log to audit system
    // TODO: Replace with proper logger
    // console.log(`CDS Interaction: ${request.hook} - ${response.cards.length} cards returned`);
  }

  /**
   * Utility function to chunk arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get service status
   */
  getServiceStatus(): Record<string, boolean> {
    return {
      'cds-hooks': !!this.cdsHooksService,
      'drug-interactions': !!this.drugInteractionService,
      'allergies': !!this.allergyAlertService,
      'guidelines': !!this.clinicalGuidelinesService,
      'risk-scoring': !!this.riskScoringService,
      'alerts': !!this.alertService
    };
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<CDSConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    // TODO: Replace with proper logger
    // console.log('CDS configuration updated');
  }
}