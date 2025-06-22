import { MedplumClient } from '@medplum/core';
import { Patient, Practitioner, Encounter, ServiceRequest, CarePlan } from '@medplum/fhirtypes';
import { v4 as uuidv4 } from 'uuid';
import { CDSOrchestrator } from '../../cds/CDSOrchestrator';
import { TelemedicineWorkflowService } from '../../clinical/telemedicine/TelemedicineWorkflowService';
import { ReferralManagementService } from '../../clinical/referrals/ReferralManagementService';
import { CarePlanManagementService } from '../../clinical/coordination/CarePlanManagementService';
import { 
  ClinicalGuidelinesService 
} from '../../cds/guidelines/ClinicalGuidelinesService';
import { RiskScoringService } from '../../cds/scoring/RiskScoringService';
import { CDSHooksService } from '../../cds/hooks/CDSHooksService';
import { getErrorMessage } from '@/utils/error.utils';

export interface WorkflowContext {
  patientId: string;
  practitionerId: string;
  encounterId?: string;
  workflowType: 'telemedicine' | 'referral' | 'care-plan' | 'standard-visit';
  urgency?: 'routine' | 'urgent' | 'emergent';
  additionalData?: Record<string, any>;
}

export interface WorkflowDecision {
  recommendedActions: {
    action: string;
    priority: 'high' | 'medium' | 'low';
    rationale: string;
    evidence?: string;
  }[];
  alerts: {
    type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
  }[];
  suggestedWorkflows: string[];
}

export interface WorkflowOutcome {
  workflowId: string;
  status: 'completed' | 'in-progress' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  decisions: WorkflowDecision[];
  actions: {
    action: string;
    timestamp: Date;
    performer: string;
    result?: string;
  }[];
  nextSteps?: string[];
}

export class WorkflowOrchestrationService {
  private cdsOrchestrator: CDSOrchestrator;
  private telemedicineService: TelemedicineWorkflowService;
  private referralService: ReferralManagementService;
  private carePlanService: CarePlanManagementService;
  private guidelinesService: ClinicalGuidelinesService;
  private riskService: RiskScoringService;
  private cdsHooksService: CDSHooksService;

  constructor(private medplum: MedplumClient) {
    this.cdsOrchestrator = new CDSOrchestrator(medplum);
    this.telemedicineService = new TelemedicineWorkflowService(medplum);
    this.referralService = new ReferralManagementService(medplum);
    this.carePlanService = new CarePlanManagementService(medplum);
    this.guidelinesService = new ClinicalGuidelinesService(medplum);
    this.riskService = new RiskScoringService(medplum);
    this.cdsHooksService = new CDSHooksService(medplum);
  }

  /**
   * Initiate workflow with CDS integration
   */
  async initiateWorkflow(context: WorkflowContext): Promise<WorkflowOutcome> {
    const workflowId = this.generateWorkflowId();
    const startTime = new Date();
    const decisions: WorkflowDecision[] = [];

    try {
      // Get patient and check for CDS recommendations
      const patient = await this.medplum.readResource('Patient', context.patientId);
      
      // Run CDS checks
      const cdsRecommendations = await this.runCDSChecks(context, patient!);
      decisions.push(cdsRecommendations);

      // Route to appropriate workflow
      let outcome: Partial<WorkflowOutcome>;
      
      switch (context.workflowType) {
        case 'telemedicine':
          outcome = await this.executeTelemedicineWorkflow(context, cdsRecommendations);
          break;
        case 'referral':
          outcome = await this.executeReferralWorkflow(context, cdsRecommendations);
          break;
        case 'care-plan':
          outcome = await this.executeCarePlanWorkflow(context, cdsRecommendations);
          break;
        default:
          outcome = await this.executeStandardWorkflow(context, cdsRecommendations);
      }

      return {
        workflowId,
        status: 'completed',
        startTime,
        endTime: new Date(),
        decisions,
        actions: outcome.actions || [],
        nextSteps: outcome.nextSteps
      };

    } catch (error) {
      return {
        workflowId,
        status: 'failed',
        startTime,
        endTime: new Date(),
        decisions,
        actions: [{
          action: 'Workflow failed',
          timestamp: new Date(),
          performer: 'system',
          result: getErrorMessage(error)
        }]
      };
    }
  }

  /**
   * Run CDS checks for workflow
   */
  private async runCDSChecks(
    context: WorkflowContext,
    patient: Patient
  ): Promise<WorkflowDecision> {
    const recommendations: WorkflowDecision = {
      recommendedActions: [],
      alerts: [],
      suggestedWorkflows: []
    };

    // Check guidelines based on patient conditions
    const conditions = await this.medplum.searchResources('Condition', {
      patient: `Patient/${context.patientId}`,
      'clinical-status': 'active'
    });

    // Get applicable guidelines
    for (const condition of conditions) {
      if (condition.code?.coding?.[0]?.code) {
        const guidelines = await this.guidelinesService.getApplicableGuidelines(
          condition.code.coding[0].code,
          patient.birthDate ? this.calculateAge(patient.birthDate) : undefined,
          patient.gender
        );

        for (const guideline of guidelines) {
          recommendations.recommendedActions.push({
            action: guideline.recommendation,
            priority: this.mapGuidelinePriority(guideline.strength),
            rationale: guideline.rationale,
            evidence: guideline.source
          });
        }
      }
    }

    // Calculate risk scores
    const riskScores = await this.riskService.calculateComprehensiveRisk(
      context.patientId,
      context.encounterId
    );

    // Add high-risk alerts
    if (riskScores.fallRisk?.score === 'high') {
      recommendations.alerts.push({
        type: 'fall-risk',
        severity: 'warning',
        message: 'Patient is at high risk for falls. Implement fall prevention protocol.'
      });
    }

    if (riskScores.readmissionRisk?.probability && riskScores.readmissionRisk.probability > 0.3) {
      recommendations.alerts.push({
        type: 'readmission-risk',
        severity: 'warning',
        message: `High readmission risk (${(riskScores.readmissionRisk.probability * 100).toFixed(0)}%). Consider intensive discharge planning.`
      });
    }

    // Check for workflow suggestions based on context
    if (context.workflowType === 'standard-visit') {
      // Check if telemedicine might be appropriate
      if (this.isTelemedicineAppropriate(conditions)) {
        recommendations.suggestedWorkflows.push('telemedicine');
      }

      // Check if referral might be needed
      if (await this.isReferralIndicated(context.patientId, conditions)) {
        recommendations.suggestedWorkflows.push('referral');
      }

      // Check if care plan update is needed
      const carePlans = await this.medplum.searchResources('CarePlan', {
        patient: `Patient/${context.patientId}`,
        status: 'active'
      });
      
      if (carePlans.length === 0 && conditions.length > 0) {
        recommendations.suggestedWorkflows.push('care-plan');
      }
    }

    return recommendations;
  }

  /**
   * Execute telemedicine workflow with CDS
   */
  private async executeTelemedicineWorkflow(
    context: WorkflowContext,
    cdsRecommendations: WorkflowDecision
  ): Promise<Partial<WorkflowOutcome>> {
    const actions: WorkflowOutcome['actions'] = [];

    // Check if telemedicine is appropriate based on CDS
    const appropriatenessCheck = cdsRecommendations.alerts.find(
      a => a.type === 'telemedicine-inappropriate'
    );

    if (appropriatenessCheck) {
      actions.push({
        action: 'Telemedicine appropriateness check failed',
        timestamp: new Date(),
        performer: 'cds-system',
        result: appropriatenessCheck.message
      });
      
      return {
        actions,
        nextSteps: ['Schedule in-person visit']
      };
    }

    // Schedule telemedicine appointment
    const appointment = await this.telemedicineService.scheduleTelemedicineAppointment(
      context.patientId,
      context.practitionerId,
      new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      30, // 30 minutes
      context.additionalData?.reason || 'Follow-up visit'
    );

    actions.push({
      action: 'Scheduled telemedicine appointment',
      timestamp: new Date(),
      performer: context.practitionerId,
      result: `Appointment ID: ${appointment.id}`
    });

    // Initialize session
    const session = await this.telemedicineService.initializeTelemedicineSession(
      appointment.id!,
      {
        provider: 'webrtc',
        sessionToken: this.generateSessionToken()
      }
    );

    actions.push({
      action: 'Initialized telemedicine session',
      timestamp: new Date(),
      performer: 'system',
      result: `Session ID: ${session.sessionId}`
    });

    // Apply CDS recommendations for pre-visit preparation
    const preVisitActions = cdsRecommendations.recommendedActions.filter(
      a => a.action.includes('pre-visit') || a.action.includes('prepare')
    );

    for (const action of preVisitActions) {
      actions.push({
        action: `CDS Recommendation: ${action.action}`,
        timestamp: new Date(),
        performer: 'cds-system',
        result: action.rationale
      });
    }

    return {
      actions,
      nextSteps: [
        'Send appointment confirmation to patient',
        'Prepare virtual visit checklist',
        'Review patient chart before appointment'
      ]
    };
  }

  /**
   * Execute referral workflow with CDS
   */
  private async executeReferralWorkflow(
    context: WorkflowContext,
    cdsRecommendations: WorkflowDecision
  ): Promise<Partial<WorkflowOutcome>> {
    const actions: WorkflowOutcome['actions'] = [];

    // Check CDS for referral appropriateness and specialty recommendations
    const specialtyRecommendation = cdsRecommendations.recommendedActions.find(
      a => a.action.includes('referral') || a.action.includes('consult')
    );

    const specialty = specialtyRecommendation?.action.match(/(\w+)\s+(?:referral|consultation)/i)?.[1] 
      || context.additionalData?.specialty 
      || 'Specialist';

    // Create referral
    const referral = await this.referralService.createReferral({
      patientId: context.patientId,
      referringProviderId: context.practitionerId,
      specialtyType: specialty,
      urgency: context.urgency || 'routine',
      reason: context.additionalData?.reason || specialtyRecommendation?.rationale || 'Clinical evaluation needed',
      clinicalNotes: context.additionalData?.notes || '',
      diagnosis: context.additionalData?.diagnosis || [],
      authorizationRequired: await this.checkAuthorizationRequirement(context.patientId, specialty)
    });

    actions.push({
      action: 'Created referral',
      timestamp: new Date(),
      performer: context.practitionerId,
      result: `Referral ID: ${referral.id}, Specialty: ${specialty}`
    });

    // Apply CDS recommendations for referral
    for (const rec of cdsRecommendations.recommendedActions) {
      if (rec.action.includes('test') || rec.action.includes('lab')) {
        actions.push({
          action: `CDS: Pre-referral testing recommended`,
          timestamp: new Date(),
          performer: 'cds-system',
          result: rec.action
        });
      }
    }

    // Check for urgent referrals based on CDS alerts
    const urgentAlert = cdsRecommendations.alerts.find(a => a.severity === 'critical');
    if (urgentAlert) {
      await this.referralService.updateReferralStatus(
        referral.id!,
        'active',
        undefined,
        `Urgent: ${urgentAlert.message}`
      );
      
      actions.push({
        action: 'Upgraded referral to urgent',
        timestamp: new Date(),
        performer: 'cds-system',
        result: urgentAlert.message
      });
    }

    return {
      actions,
      nextSteps: [
        'Obtain insurance authorization if required',
        'Coordinate with specialist office for scheduling',
        'Prepare referral packet with relevant records',
        'Educate patient about referral process'
      ]
    };
  }

  /**
   * Execute care plan workflow with CDS
   */
  private async executeCarePlanWorkflow(
    context: WorkflowContext,
    cdsRecommendations: WorkflowDecision
  ): Promise<Partial<WorkflowOutcome>> {
    const actions: WorkflowOutcome['actions'] = [];

    // Get patient conditions for care plan
    const conditions = await this.medplum.searchResources('Condition', {
      patient: `Patient/${context.patientId}`,
      'clinical-status': 'active'
    });

    // Determine appropriate care plan template based on conditions and CDS
    let templateId = 'general-care';
    if (conditions.some(c => c.code?.coding?.[0]?.code?.startsWith('E11'))) {
      templateId = 'diabetes-management';
    } else if (conditions.some(c => c.code?.coding?.[0]?.code?.startsWith('I50'))) {
      templateId = 'heart-failure-management';
    }

    // Create care team if not exists
    const careTeam = await this.medplum.createResource('CareTeam', {
      resourceType: 'CareTeam',
      status: 'active',
      subject: { reference: `Patient/${context.patientId}` },
      participant: [{
        role: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: '768730001',
            display: 'Primary care provider'
          }]
        }],
        member: { reference: `Practitioner/${context.practitionerId}` }
      }]
    });

    // Create care plan with CDS-informed goals
    const carePlanGoals = cdsRecommendations.recommendedActions
      .filter(a => a.action.includes('goal') || a.action.includes('target'))
      .map(a => ({
        description: a.action,
        priority: a.priority as 'high' | 'medium' | 'low',
        category: 'physiologic' as const,
        status: 'active' as const,
        startDate: new Date()
      }));

    const carePlan = await this.carePlanService.createCustomCarePlan(
      context.patientId,
      `CDS-Guided Care Plan for ${conditions[0]?.code?.text || 'General Health'}`,
      'chronic-disease',
      carePlanGoals,
      [],
      careTeam.id
    );

    actions.push({
      action: 'Created care plan',
      timestamp: new Date(),
      performer: context.practitionerId,
      result: `Care Plan ID: ${carePlan.id}`
    });

    // Add CDS-recommended interventions
    for (const rec of cdsRecommendations.recommendedActions) {
      if (rec.action.includes('monitor') || rec.action.includes('assess')) {
        await this.carePlanService.createCarePlanTask(
          carePlan.id!,
          context.patientId,
          {
            description: rec.action,
            category: 'assessment',
            status: 'not-started'
          }
        );
        
        actions.push({
          action: 'Added care plan activity',
          timestamp: new Date(),
          performer: 'cds-system',
          result: rec.action
        });
      }
    }

    return {
      actions,
      nextSteps: [
        'Review care plan with patient',
        'Schedule follow-up appointments',
        'Coordinate with care team members',
        'Set up patient monitoring schedule'
      ]
    };
  }

  /**
   * Execute standard workflow
   */
  private async executeStandardWorkflow(
    context: WorkflowContext,
    cdsRecommendations: WorkflowDecision
  ): Promise<Partial<WorkflowOutcome>> {
    const actions: WorkflowOutcome['actions'] = [];

    // Apply general CDS recommendations
    for (const rec of cdsRecommendations.recommendedActions) {
      actions.push({
        action: `CDS Recommendation: ${rec.action}`,
        timestamp: new Date(),
        performer: 'cds-system',
        result: rec.rationale
      });
    }

    // Process alerts
    for (const alert of cdsRecommendations.alerts) {
      actions.push({
        action: `Clinical Alert: ${alert.type}`,
        timestamp: new Date(),
        performer: 'cds-system',
        result: alert.message
      });
    }

    const nextSteps = [...cdsRecommendations.suggestedWorkflows.map(w => `Consider ${w} workflow`)];

    return {
      actions,
      nextSteps
    };
  }

  /**
   * Helper methods
   */
  private calculateAge(birthDate: string): number {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  private mapGuidelinePriority(strength?: string): 'high' | 'medium' | 'low' {
    switch (strength?.toLowerCase()) {
      case 'strong':
      case 'high':
        return 'high';
      case 'moderate':
      case 'conditional':
        return 'medium';
      default:
        return 'low';
    }
  }

  private isTelemedicineAppropriate(conditions: any[]): boolean {
    // Simple logic - would be more complex in production
    const inappropriateConditions = ['chest pain', 'trauma', 'acute abdomen'];
    return !conditions.some(c => 
      inappropriateConditions.some(ic => 
        c.code?.text?.toLowerCase().includes(ic)
      )
    );
  }

  private async isReferralIndicated(patientId: string, conditions: any[]): Promise<boolean> {
    // Check for conditions that typically require specialist referral
    const referralConditions = ['cancer', 'heart failure', 'chronic kidney disease'];
    return conditions.some(c => 
      referralConditions.some(rc => 
        c.code?.text?.toLowerCase().includes(rc)
      )
    );
  }

  private async checkAuthorizationRequirement(patientId: string, specialty: string): Promise<boolean> {
    // In production, this would check insurance rules
    const authRequired = ['cardiology', 'neurology', 'oncology'];
    return authRequired.includes(specialty.toLowerCase());
  }

  private generateWorkflowId(): string {
    return `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionToken(): string {
    return `session-${uuidv4()}`;
  }
}