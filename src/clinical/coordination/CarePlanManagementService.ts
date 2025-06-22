import { MedplumClient } from '@medplum/core';
import {
  CarePlan,
  Goal,
  Patient,
  Practitioner,
  CareTeam,
  Condition,
  Observation,
  Task,
  RequestGroup,
  Communication,
  DocumentReference,
  Encounter,
  Reference,
  Device,
  Group,
  Location
} from '@medplum/fhirtypes';
import { v4 as uuidv4 } from 'uuid';
import { createFlexibleReference, toFlexibleReference, isReferenceToType } from '../../utils/fhir-reference-utils';

export interface CarePlanTemplate {
  id: string;
  name: string;
  category: 'chronic-disease' | 'post-acute' | 'preventive' | 'behavioral' | 'palliative';
  conditions: string[]; // condition codes this template applies to
  goals: {
    description: string;
    category: string;
    targetMeasure?: string;
    targetValue?: number;
    targetUnit?: string;
    timeframe: string;
  }[];
  activities: {
    kind: 'appointment' | 'medication' | 'observation' | 'diet' | 'exercise' | 'education';
    description: string;
    frequency?: string;
    duration?: string;
    performer?: string; // role
  }[];
  assessmentSchedule: {
    type: string;
    frequency: string;
    performer: string;
  }[];
}

export interface CarePlanGoal {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'physiologic' | 'behavioral' | 'safety' | 'community';
  target: {
    measure: string;
    value: number | string;
    unit?: string;
    dueDate?: Date;
  };
  status: 'proposed' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  achievementStatus?: 'in-progress' | 'achieved' | 'not-achieved' | 'sustaining';
  startDate: Date;
  notes?: string;
}

export interface CarePlanActivity {
  id: string;
  description: string;
  category: 'assessment' | 'procedure' | 'medication' | 'education' | 'communication';
  status: 'draft' | 'requested' | 'ready' | 'in-progress' | 'completed' | 'cancelled';
  scheduledDate?: Date;
  completedDate?: Date;
  performer?: string;
  outcome?: string;
  barriers?: string[];
}

export interface CarePlanProgress {
  planId: string;
  assessmentDate: Date;
  overallProgress: 'on-track' | 'at-risk' | 'off-track';
  goalsProgress: {
    goalId: string;
    currentValue: number | string;
    percentComplete: number;
    trend: 'improving' | 'stable' | 'declining';
    notes?: string;
  }[];
  activitiesCompleted: number;
  activitiesTotal: number;
  barriers: string[];
  modifications: string[];
}

export class CarePlanManagementService {
  constructor(private medplum: MedplumClient) {}

  /**
   * Create care plan from template
   */
  async createCarePlanFromTemplate(
    patientId: string,
    templateId: string,
    careTeamId: string,
    customizations?: {
      additionalGoals?: Partial<CarePlanGoal>[];
      excludedActivities?: string[];
      notes?: string;
    }
  ): Promise<CarePlan> {
    const template = await this.getCarePlanTemplate(templateId);
    const patient = await this.medplum.readResource('Patient', patientId) as Patient;
    const careTeam = await this.medplum.readResource('CareTeam', careTeamId) as CareTeam;

    // Create the care plan
    const carePlan = await this.medplum.createResource<CarePlan>({
      resourceType: 'CarePlan',
      status: 'active',
      intent: 'plan',
      title: template.name,
      description: `Care plan based on ${template.name} template`,
      subject: { reference: `Patient/${patientId}` },
      period: {
        start: new Date().toISOString()
      },
      created: new Date().toISOString(),
      author: careTeam?.managingOrganization?.[0] || { display: 'Care Team' },
      careTeam: [{ reference: `CareTeam/${careTeamId}` }],
      category: [{
        coding: [{
          system: 'http://hl7.org/fhir/us/core/CodeSystem/careplan-category',
          code: template.category,
          display: template.category
        }]
      }],
      note: customizations?.notes ? [{ text: customizations.notes }] : undefined
    });

    // Create goals from template
    const goals = await this.createGoalsFromTemplate(
      carePlan.id!,
      patientId,
      template,
      customizations?.additionalGoals
    );

    // Create activities
    const activities = await this.createActivitiesFromTemplate(
      carePlan.id!,
      patientId,
      template,
      customizations?.excludedActivities
    );

    // Update care plan with references
    await this.medplum.updateResource<CarePlan>({
      ...carePlan,
      goal: goals.map(g => ({ reference: `Goal/${g.id}` })),
      activity: activities.map(a => ({
        reference: { reference: `Task/${a.id}` }
      }))
    });

    return carePlan;
  }

  /**
   * Create a custom care plan
   */
  async createCustomCarePlan(
    patientId: string,
    title: string,
    category: string,
    goals: Partial<CarePlanGoal>[],
    activities: Partial<CarePlanActivity>[],
    careTeamId?: string
  ): Promise<CarePlan> {
    // Create the care plan
    const carePlan = await this.medplum.createResource<CarePlan>({
      resourceType: 'CarePlan',
      status: 'draft',
      intent: 'plan',
      title,
      subject: { reference: `Patient/${patientId}` },
      period: {
        start: new Date().toISOString()
      },
      created: new Date().toISOString(),
      careTeam: careTeamId ? [{ reference: `CareTeam/${careTeamId}` }] : undefined,
      category: [{
        coding: [{
          system: 'http://hl7.org/fhir/us/core/CodeSystem/careplan-category',
          code: category
        }]
      }]
    });

    // Create goals
    const createdGoals = await Promise.all(
      goals.map(goal => this.createGoal(carePlan.id!, patientId, goal))
    );

    // Create activities as tasks
    const createdActivities = await Promise.all(
      activities.map(activity => this.createCarePlanTask(carePlan.id!, patientId, activity))
    );

    // Update care plan with references
    await this.medplum.updateResource<CarePlan>({
      ...carePlan,
      status: 'active',
      goal: createdGoals.map(g => ({ reference: `Goal/${g.id}` })),
      activity: createdActivities.map(a => ({
        reference: { reference: `Task/${a.id}` }
      }))
    });

    return carePlan;
  }

  /**
   * Create a goal for care plan
   */
  async createGoal(
    carePlanId: string,
    patientId: string,
    goalData: Partial<CarePlanGoal>
  ): Promise<Goal> {
    return await this.medplum.createResource<Goal>({
      resourceType: 'Goal',
      lifecycleStatus: goalData.status || 'active',
      achievementStatus: goalData.achievementStatus ? {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/goal-achievement',
          code: goalData.achievementStatus
        }]
      } : undefined,
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/goal-category',
          code: goalData.category || 'physiologic'
        }]
      }],
      priority: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/goal-priority',
          code: goalData.priority || 'medium'
        }]
      },
      description: {
        text: goalData.description || ''
      },
      subject: { reference: `Patient/${patientId}` },
      startDate: goalData.startDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      target: goalData.target ? [{
        measure: {
          text: goalData.target.measure
        },
        detailQuantity: typeof goalData.target.value === 'number' ? {
          value: goalData.target.value,
          unit: goalData.target.unit
        } : undefined,
        detailString: typeof goalData.target.value === 'string' ? goalData.target.value : undefined,
        dueDate: goalData.target.dueDate?.toISOString().split('T')[0]
      }] : undefined,
      note: goalData.notes ? [{ text: goalData.notes }] : undefined,
      expressedBy: { reference: `Patient/${patientId}` }
    });
  }

  /**
   * Update goal progress
   */
  async updateGoalProgress(
    goalId: string,
    currentValue: number | string,
    achievementStatus?: Goal['achievementStatus'],
    notes?: string
  ): Promise<Goal> {
    const goal = await this.medplum.readResource('Goal', goalId) as Goal;
    
    if (!goal) {
      throw new Error('Goal not found');
    }

    // Create observation for tracking
    if (typeof currentValue === 'number' && goal.target?.[0]?.detailQuantity) {
      // Check if subject is compatible with Observation (not Organization)
      const subjectRef = goal.subject.reference;
      if (subjectRef && !subjectRef.startsWith('Organization/')) {
        await this.medplum.createResource<Observation>({
          resourceType: 'Observation',
          status: 'final',
          code: {
            text: goal.description.text
          },
          subject: goal.subject as Reference<Patient | Group | Device | Location>,
          effectiveDateTime: new Date().toISOString(),
          valueQuantity: {
            value: currentValue,
            unit: goal.target[0].detailQuantity.unit
          },
          note: notes ? [{ text: notes }] : undefined
        });
      }
    }

    // Update goal
    return await this.medplum.updateResource<Goal>({
      ...goal,
      achievementStatus: achievementStatus || goal.achievementStatus,
      note: notes ? [...(goal.note || []), { 
        text: notes,
        time: new Date().toISOString()
      }] : goal.note,
      outcomeReference: typeof currentValue === 'number' ? 
        [...(goal.outcomeReference || []), {
          display: `Progress: ${currentValue}${goal.target?.[0]?.detailQuantity?.unit || ''}`
        }] : goal.outcomeReference
    });
  }

  /**
   * Create care plan task/activity
   */
  async createCarePlanTask(
    carePlanId: string,
    patientId: string,
    activityData: Partial<CarePlanActivity>
  ): Promise<Task> {
    return await this.medplum.createResource<Task>({
      resourceType: 'Task',
      status: this.mapActivityStatusToTaskStatus(activityData.status) || 'requested',
      intent: 'plan',
      priority: 'routine',
      code: {
        coding: [{
          system: 'http://omnicare.com/task-category',
          code: activityData.category || 'assessment'
        }]
      },
      description: activityData.description || '',
      for: { reference: `Patient/${patientId}` },
      executionPeriod: activityData.scheduledDate ? {
        start: activityData.scheduledDate.toISOString()
      } : undefined,
      basedOn: [{ reference: `CarePlan/${carePlanId}` }],
      owner: activityData.performer ? { display: activityData.performer } : undefined,
      note: activityData.barriers ? [{
        text: `Barriers: ${activityData.barriers.join(', ')}`
      }] : undefined
    });
  }

  /**
   * Monitor care plan progress
   */
  async assessCarePlanProgress(carePlanId: string): Promise<CarePlanProgress> {
    const carePlan = await this.medplum.readResource('CarePlan', carePlanId);
    
    if (!carePlan) {
      throw new Error('Care plan not found');
    }

    // Get all goals
    const goals = await Promise.all(
      (carePlan.goal || []).map(async (goalRef) => {
        const goalId = goalRef.reference?.split('/')[1];
        return goalId ? await this.medplum.readResource('Goal', goalId) : null;
      })
    );

    // Get all activities/tasks
    const tasks = await Promise.all(
      (carePlan.activity || []).map(async (activity) => {
        const taskId = activity.reference?.reference?.split('/')[1];
        return taskId ? await this.medplum.readResource('Task', taskId) : null;
      })
    );

    // Calculate progress
    const goalsProgress = goals.filter(Boolean).map(goal => {
      const achieved = goal!.achievementStatus?.coding?.[0]?.code === 'achieved';
      const inProgress = goal!.achievementStatus?.coding?.[0]?.code === 'in-progress';
      
      return {
        goalId: goal!.id!,
        currentValue: goal!.outcomeReference?.[goal!.outcomeReference.length - 1]?.display || 'Not measured',
        percentComplete: achieved ? 100 : inProgress ? 50 : 0,
        trend: 'stable' as const,
        notes: goal!.note?.[goal!.note.length - 1]?.text
      };
    });

    const completedTasks = tasks.filter(t => t?.status === 'completed').length;
    const totalTasks = tasks.filter(Boolean).length;

    // Determine overall progress
    const goalCompletionRate = goalsProgress.reduce((sum, g) => sum + g.percentComplete, 0) / goalsProgress.length;
    const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const overallRate = (goalCompletionRate + taskCompletionRate) / 2;

    const overallProgress = overallRate >= 75 ? 'on-track' : 
                          overallRate >= 50 ? 'at-risk' : 'off-track';

    return {
      planId: carePlanId,
      assessmentDate: new Date(),
      overallProgress,
      goalsProgress,
      activitiesCompleted: completedTasks,
      activitiesTotal: totalTasks,
      barriers: [], // Would need to extract from task notes
      modifications: [] // Would need to track plan revisions
    };
  }

  /**
   * Add care team member to plan
   */
  async addCareTeamMember(
    carePlanId: string,
    practitionerId: string,
    role: string
  ): Promise<void> {
    const carePlan = await this.medplum.readResource('CarePlan', carePlanId);
    
    if (!carePlan || !carePlan.careTeam?.[0]) {
      throw new Error('Care plan or care team not found');
    }

    const careTeamId = carePlan.careTeam[0].reference?.split('/')[1];
    if (!careTeamId) return;

    const careTeam = await this.medplum.readResource('CareTeam', careTeamId) as CareTeam;
    
    if (careTeam) {
      await this.medplum.updateResource<CareTeam>({
        ...careTeam,
        participant: [
          ...(careTeam.participant || []),
          {
            role: [{
              coding: [{
                system: 'http://snomed.info/sct',
                code: role,
                display: role
              }]
            }],
            member: { reference: `Practitioner/${practitionerId}` }
          }
        ]
      });
    }

    // Create communication about team change
    await this.medplum.createResource<Communication>({
      resourceType: 'Communication',
      status: 'completed',
      category: [{
        coding: [{
          system: 'http://omnicare.com/communication-category',
          code: 'care-team-update'
        }]
      }],
      subject: carePlan.subject,
      sent: new Date().toISOString(),
      payload: [{
        contentString: `New care team member added: ${role}`
      }]
    });
  }

  /**
   * Create care plan review/revision
   */
  async reviewCarePlan(
    carePlanId: string,
    reviewerId: string,
    reviewNotes: string,
    modifications: {
      goalsToAdd?: Partial<CarePlanGoal>[];
      goalsToRemove?: string[];
      activitiesToAdd?: Partial<CarePlanActivity>[];
      activitiesToRemove?: string[];
      statusChange?: CarePlan['status'];
    }
  ): Promise<CarePlan> {
    const carePlan = await this.medplum.readResource('CarePlan', carePlanId);
    
    if (!carePlan) {
      throw new Error('Care plan not found');
    }

    // Document the review
    await this.medplum.createResource<DocumentReference>({
      resourceType: 'DocumentReference',
      status: 'current',
      type: {
        coding: [{
          system: 'http://loinc.org',
          code: '18776-5',
          display: 'Plan of care note'
        }]
      },
      subject: carePlan.subject,
      author: [{ reference: `Practitioner/${reviewerId}` }],
      content: [{
        attachment: {
          contentType: 'text/plain',
          data: btoa(`Care Plan Review\n\nDate: ${new Date().toLocaleDateString()}\nReviewer: ${reviewerId}\n\nNotes: ${reviewNotes}\n\nModifications: ${JSON.stringify(modifications, null, 2)}`),
          title: 'Care Plan Review'
        }
      }],
      context: {
        related: [{ reference: `CarePlan/${carePlanId}` }]
      }
    });

    // Apply modifications
    if (modifications.goalsToAdd) {
      for (const goal of modifications.goalsToAdd) {
        await this.createGoal(carePlanId, carePlan.subject.reference!.split('/')[1], goal);
      }
    }

    if (modifications.activitiesToAdd) {
      for (const activity of modifications.activitiesToAdd) {
        await this.createCarePlanTask(
          carePlanId,
          carePlan.subject.reference!.split('/')[1],
          activity
        );
      }
    }

    // Update care plan
    const updatedCarePlan = await this.medplum.updateResource<CarePlan>({
      ...carePlan,
      status: modifications.statusChange || carePlan.status,
      note: [
        ...(carePlan.note || []),
        {
          text: `Reviewed by ${reviewerId}: ${reviewNotes}`,
          time: new Date().toISOString()
        }
      ]
    });

    return updatedCarePlan;
  }

  /**
   * Get care plan templates (mock implementation)
   */
  private async getCarePlanTemplate(templateId: string): Promise<CarePlanTemplate> {
    // In a real implementation, this would fetch from a template repository
    const templates: Record<string, CarePlanTemplate> = {
      'diabetes-management': {
        id: 'diabetes-management',
        name: 'Diabetes Management Plan',
        category: 'chronic-disease',
        conditions: ['E11', 'E10'], // ICD-10 codes for diabetes
        goals: [
          {
            description: 'Maintain HbA1c below 7%',
            category: 'physiologic',
            targetMeasure: 'HbA1c',
            targetValue: 7,
            targetUnit: '%',
            timeframe: '3 months'
          },
          {
            description: 'Daily blood glucose monitoring',
            category: 'behavioral',
            timeframe: 'ongoing'
          }
        ],
        activities: [
          {
            kind: 'observation',
            description: 'Blood glucose monitoring',
            frequency: 'daily',
            performer: 'patient'
          },
          {
            kind: 'appointment',
            description: 'Endocrinology follow-up',
            frequency: 'every 3 months',
            performer: 'endocrinologist'
          },
          {
            kind: 'education',
            description: 'Diabetes self-management education',
            duration: '4 sessions',
            performer: 'diabetes educator'
          }
        ],
        assessmentSchedule: [
          {
            type: 'HbA1c',
            frequency: 'every 3 months',
            performer: 'lab'
          },
          {
            type: 'Foot exam',
            frequency: 'every 6 months',
            performer: 'podiatrist'
          }
        ]
      }
    };

    const template = templates[templateId];
    if (!template) {
      throw new Error('Template not found');
    }

    return template;
  }

  /**
   * Create goals from template
   */
  private async createGoalsFromTemplate(
    carePlanId: string,
    patientId: string,
    template: CarePlanTemplate,
    additionalGoals?: Partial<CarePlanGoal>[]
  ): Promise<Goal[]> {
    const goals: Goal[] = [];

    // Create template goals
    for (const templateGoal of template.goals) {
      const goal = await this.createGoal(carePlanId, patientId, {
        description: templateGoal.description,
        category: templateGoal.category as CarePlanGoal['category'],
        target: templateGoal.targetMeasure ? {
          measure: templateGoal.targetMeasure,
          value: templateGoal.targetValue!,
          unit: templateGoal.targetUnit
        } : undefined,
        priority: 'medium',
        status: 'active',
        startDate: new Date()
      });
      goals.push(goal);
    }

    // Create additional custom goals
    if (additionalGoals) {
      for (const customGoal of additionalGoals) {
        const goal = await this.createGoal(carePlanId, patientId, customGoal);
        goals.push(goal);
      }
    }

    return goals;
  }

  /**
   * Create activities from template
   */
  private async createActivitiesFromTemplate(
    carePlanId: string,
    patientId: string,
    template: CarePlanTemplate,
    excludedActivities?: string[]
  ): Promise<Task[]> {
    const tasks: Task[] = [];

    for (const activity of template.activities) {
      if (excludedActivities?.includes(activity.description)) {
        continue;
      }

      const task = await this.createCarePlanTask(carePlanId, patientId, {
        description: activity.description,
        category: this.mapActivityKindToCategory(activity.kind),
        status: 'draft',
        performer: activity.performer
      });
      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Map activity kind to category
   */
  private mapActivityKindToCategory(kind: string): CarePlanActivity['category'] {
    const mapping: Record<string, CarePlanActivity['category']> = {
      'appointment': 'assessment',
      'medication': 'medication',
      'observation': 'assessment',
      'diet': 'education',
      'exercise': 'education',
      'education': 'education'
    };
    return mapping[kind] || 'assessment';
  }

  /**
   * Map activity status to FHIR Task status
   */
  private mapActivityStatusToTaskStatus(status?: CarePlanActivity['status']): Task['status'] | undefined {
    if (!status) return undefined;
    
    const mapping: Record<CarePlanActivity['status'], Task['status']> = {
      'draft': 'draft',
      'requested': 'requested',
      'ready': 'ready',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'cancelled': 'cancelled'
    };
    
    return mapping[status] || 'draft';
  }
}