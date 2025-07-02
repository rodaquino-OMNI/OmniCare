import {
  Task,
  CodeableConcept,
  Reference,
  Identifier,
  Period,
  Annotation,
  Bundle,
  Practitioner,
  Patient,
  MedicationRequest,
  ServiceRequest,
  Resource,
  OperationOutcome,
} from '@medplum/fhirtypes';

import { fhirResourcesService } from './fhir-resources.service';
import { medplumService } from './medplum.service';

// Define TaskStatus type from the FHIR spec
type TaskStatus = 'draft' | 'requested' | 'received' | 'accepted' | 'rejected' | 'ready' | 'cancelled' | 'in-progress' | 'on-hold' | 'failed' | 'completed' | 'entered-in-error';

// Define TaskIntent type from the FHIR spec
type TaskIntent = 'unknown' | 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
import { FHIRSearchParams, ValidationResult } from '@/types/fhir';
import logger from '@/utils/logger';

/**
 * Task lifecycle status transitions
 * draft → requested → accepted → in-progress → completed
 * Any status can transition to cancelled, failed, or rejected
 */
const VALID_STATUS_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  'draft': ['requested', 'cancelled'],
  'requested': ['accepted', 'rejected', 'cancelled'],
  'accepted': ['in-progress', 'cancelled', 'rejected'],
  'in-progress': ['completed', 'failed', 'on-hold', 'cancelled'],
  'on-hold': ['in-progress', 'cancelled'],
  'completed': [],
  'cancelled': [],
  'failed': [],
  'rejected': [],
  'ready': ['in-progress', 'cancelled'],
  'entered-in-error': [],
  'received': ['accepted', 'rejected', 'cancelled'],
};

// Task priority levels
export enum TaskPriority {
  STAT = 'stat',      // Immediate/Emergency
  ASAP = 'asap',      // As soon as possible
  URGENT = 'urgent',  // Urgent
  ROUTINE = 'routine' // Routine
}

// Clinical workflow types
export enum WorkflowType {
  MEDICATION_ORDER = 'medication-order',
  LAB_ORDER = 'lab-order',
  IMAGING_ORDER = 'imaging-order',
  REFERRAL = 'referral',
  CONSULTATION = 'consultation',
  PROCEDURE = 'procedure',
  FOLLOW_UP = 'follow-up',
  PATIENT_EDUCATION = 'patient-education',
  CARE_COORDINATION = 'care-coordination'
}

// Task notification types
export interface TaskNotification {
  type: 'created' | 'assigned' | 'status-changed' | 'due-soon' | 'overdue';
  taskId: string;
  recipientId: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: Date;
}

/**
 * FHIR Task Service
 * Implements comprehensive task management for clinical workflows
 */
export class FHIRTaskService {
  
  /**
   * Create a new task
   */
  async createTask(taskData: Partial<Task>): Promise<Task> {
    try {
      const task: Task = {
        resourceType: 'Task',
        status: taskData.status || 'draft',
        intent: taskData.intent || 'order',
        priority: taskData.priority || 'routine',
        code: taskData.code,
        description: taskData.description,
        focus: taskData.focus,
        for: taskData.for,
        encounter: taskData.encounter,
        executionPeriod: taskData.executionPeriod,
        authoredOn: taskData.authoredOn || new Date().toISOString(),
        lastModified: new Date().toISOString(),
        requester: taskData.requester,
        performerType: taskData.performerType || [],
        owner: taskData.owner,
        reasonCode: taskData.reasonCode,
        reasonReference: taskData.reasonReference,
        insurance: taskData.insurance || [],
        note: taskData.note || [],
        restriction: taskData.restriction,
        input: taskData.input || [],
        output: taskData.output || [],
        identifier: [
          ...(taskData.identifier || []),
          {
            system: 'http://omnicare.com/task-id',
            value: `T${Date.now()}`,
          },
        ],
        extension: [
          ...(taskData.extension || []),
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type',
            valueString: taskData.extension?.find(
              ext => ext.url === 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type'
            )?.valueString || 'general',
          },
        ],
      };

      const result = await medplumService.createResource(task);
      logger.fhir('Task created successfully', { 
        taskId: result.id,
        status: result.status,
        priority: result.priority,
      });

      // Send creation notification
      if (result.owner) {
        await this.sendTaskNotification({
          type: 'created',
          taskId: result.id!,
          recipientId: this.extractIdFromReference(result.owner),
          message: `New task assigned: ${result.description || 'Task'}`,
          priority: this.mapTaskPriorityToNotification(result.priority as string),
          timestamp: new Date(),
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Update task status with validation
   */
  async updateTaskStatus(taskId: string, newStatus: TaskStatus, reason?: string): Promise<Task> {
    try {
      const task = await medplumService.readResource<Task>('Task', taskId);
      
      // Validate status transition
      const currentStatus = task.status;
      const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
      
      if (!validTransitions || !validTransitions.includes(newStatus)) {
        throw new Error(
          `Invalid status transition from '${currentStatus}' to '${newStatus}'. ` +
          `Valid transitions: ${validTransitions?.join(', ') || 'none'}`
        );
      }

      // Update task
      task.status = newStatus;
      task.lastModified = new Date().toISOString();

      // Add status change note
      if (reason) {
        task.note = task.note || [];
        task.note.push({
          authorReference: task.requester as any,
          time: new Date().toISOString(),
          text: `Status changed from ${currentStatus} to ${newStatus}: ${reason}`,
        });
      }

      // Add status history extension
      task.extension = task.extension || [];
      task.extension.push({
        url: 'http://omnicare.com/fhir/StructureDefinition/task-status-history',
        extension: [
          {
            url: 'previousStatus',
            valueString: currentStatus,
          },
          {
            url: 'newStatus',
            valueString: newStatus,
          },
          {
            url: 'changedAt',
            valueDateTime: new Date().toISOString(),
          },
          {
            url: 'reason',
            valueString: reason || 'Status update',
          },
        ],
      });

      const result = await medplumService.updateResource(task);
      logger.fhir('Task status updated', { 
        taskId,
        oldStatus: currentStatus,
        newStatus,
      });

      // Send status change notification
      if (result.owner) {
        await this.sendTaskNotification({
          type: 'status-changed',
          taskId: result.id!,
          recipientId: this.extractIdFromReference(result.owner),
          message: `Task status changed from ${currentStatus} to ${newStatus}`,
          priority: this.mapTaskPriorityToNotification(result.priority as string),
          timestamp: new Date(),
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to update task status:', error);
      throw error;
    }
  }

  /**
   * Assign task to practitioner
   */
  async assignTask(taskId: string, practitionerId: string): Promise<Task> {
    try {
      const task = await medplumService.readResource<Task>('Task', taskId);
      
      // Verify practitioner exists
      await medplumService.readResource<Practitioner>('Practitioner', practitionerId);

      // Update task owner
      const previousOwner = task.owner;
      task.owner = {
        reference: `Practitioner/${practitionerId}`,
      };
      task.lastModified = new Date().toISOString();

      // Add assignment note
      task.note = task.note || [];
      task.note.push({
        authorReference: task.requester as any,
        time: new Date().toISOString(),
        text: `Task assigned to Practitioner/${practitionerId}`,
      });

      // If task is in requested status, automatically move to accepted
      if (task.status === 'requested') {
        task.status = 'accepted';
      }

      const result = await medplumService.updateResource(task);
      logger.fhir('Task assigned', { taskId, practitionerId });

      // Send assignment notification
      await this.sendTaskNotification({
        type: 'assigned',
        taskId: result.id!,
        recipientId: practitionerId,
        message: `You have been assigned a new task: ${result.description || 'Task'}`,
        priority: this.mapTaskPriorityToNotification(result.priority as string),
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      logger.error('Failed to assign task:', error);
      throw error;
    }
  }

  /**
   * Create medication order workflow
   */
  async createMedicationOrderWorkflow(
    medicationRequestId: string,
    patientId: string,
    prescriberId: string,
    pharmacistId?: string
  ): Promise<Task[]> {
    try {
      const tasks: Task[] = [];
      const medicationRequest = await medplumService.readResource<MedicationRequest>('MedicationRequest', medicationRequestId);

      // 1. Prescription Review Task
      const reviewTask = await this.createTask({
        status: 'requested',
        intent: 'order',
        priority: medicationRequest.priority || 'routine',
        code: {
          coding: [{
            system: 'http://omnicare.com/task-types',
            code: 'prescription-review',
            display: 'Prescription Review',
          }],
        },
        description: `Review prescription for ${medicationRequest.medicationCodeableConcept?.text || 'medication'}`,
        focus: {
          reference: `MedicationRequest/${medicationRequestId}`,
        },
        for: {
          reference: `Patient/${patientId}`,
        },
        requester: {
          reference: `Practitioner/${prescriberId}`,
        },
        owner: pharmacistId ? {
          reference: `Practitioner/${pharmacistId}`,
        } : undefined,
        restriction: {
          period: {
            end: this.calculateDueDate(1), // Due in 1 day
          },
        },
        extension: [{
          url: 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type',
          valueString: WorkflowType.MEDICATION_ORDER,
        }],
      });
      tasks.push(reviewTask);

      // 2. Medication Dispensing Task
      const dispensingTask = await this.createTask({
        status: 'draft', // Will be activated after review
        intent: 'order',
        priority: medicationRequest.priority || 'routine',
        code: {
          coding: [{
            system: 'http://omnicare.com/task-types',
            code: 'medication-dispensing',
            display: 'Medication Dispensing',
          }],
        },
        description: `Dispense ${medicationRequest.medicationCodeableConcept?.text || 'medication'}`,
        focus: {
          reference: `MedicationRequest/${medicationRequestId}`,
        },
        for: {
          reference: `Patient/${patientId}`,
        },
        requester: {
          reference: `Practitioner/${prescriberId}`,
        },
        partOf: [{
          reference: `Task/${reviewTask.id}`,
        }],
        restriction: {
          period: {
            end: this.calculateDueDate(2), // Due in 2 days
          },
        },
        extension: [{
          url: 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type',
          valueString: WorkflowType.MEDICATION_ORDER,
        }],
      });
      tasks.push(dispensingTask);

      // 3. Patient Education Task
      const educationTask = await this.createTask({
        status: 'draft',
        intent: 'order',
        priority: 'routine',
        code: {
          coding: [{
            system: 'http://omnicare.com/task-types',
            code: 'patient-education',
            display: 'Patient Education',
          }],
        },
        description: `Provide medication education for ${medicationRequest.medicationCodeableConcept?.text || 'medication'}`,
        focus: {
          reference: `MedicationRequest/${medicationRequestId}`,
        },
        for: {
          reference: `Patient/${patientId}`,
        },
        requester: {
          reference: `Practitioner/${prescriberId}`,
        },
        partOf: [{
          reference: `Task/${dispensingTask.id}`,
        }],
        extension: [{
          url: 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type',
          valueString: WorkflowType.MEDICATION_ORDER,
        }],
      });
      tasks.push(educationTask);

      logger.fhir('Medication order workflow created', {
        medicationRequestId,
        taskCount: tasks.length,
        taskIds: tasks.map(t => t.id),
      });

      return tasks;
    } catch (error) {
      logger.error('Failed to create medication order workflow:', error);
      throw error;
    }
  }

  /**
   * Create lab order workflow
   */
  async createLabOrderWorkflow(
    serviceRequestId: string,
    patientId: string,
    orderingProviderId: string,
    labTechnicianId?: string
  ): Promise<Task[]> {
    try {
      const tasks: Task[] = [];
      const serviceRequest = await medplumService.readResource<ServiceRequest>('ServiceRequest', serviceRequestId);

      // 1. Specimen Collection Task
      const collectionTask = await this.createTask({
        status: 'requested',
        intent: 'order',
        priority: serviceRequest.priority || 'routine',
        code: {
          coding: [{
            system: 'http://omnicare.com/task-types',
            code: 'specimen-collection',
            display: 'Specimen Collection',
          }],
        },
        description: `Collect specimen for ${serviceRequest.code?.text || 'lab test'}`,
        focus: {
          reference: `ServiceRequest/${serviceRequestId}`,
        },
        for: {
          reference: `Patient/${patientId}`,
        },
        requester: {
          reference: `Practitioner/${orderingProviderId}`,
        },
        owner: labTechnicianId ? {
          reference: `Practitioner/${labTechnicianId}`,
        } : undefined,
        restriction: {
          period: {
            end: this.calculateDueDate(1), // Due in 1 day
          },
        },
        extension: [{
          url: 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type',
          valueString: WorkflowType.LAB_ORDER,
        }],
      });
      tasks.push(collectionTask);

      // 2. Lab Processing Task
      const processingTask = await this.createTask({
        status: 'draft',
        intent: 'order',
        priority: serviceRequest.priority || 'routine',
        code: {
          coding: [{
            system: 'http://omnicare.com/task-types',
            code: 'lab-processing',
            display: 'Lab Processing',
          }],
        },
        description: `Process lab test: ${serviceRequest.code?.text || 'lab test'}`,
        focus: {
          reference: `ServiceRequest/${serviceRequestId}`,
        },
        for: {
          reference: `Patient/${patientId}`,
        },
        requester: {
          reference: `Practitioner/${orderingProviderId}`,
        },
        partOf: [{
          reference: `Task/${collectionTask.id}`,
        }],
        restriction: {
          period: {
            end: this.calculateDueDate(2), // Due in 2 days
          },
        },
        extension: [{
          url: 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type',
          valueString: WorkflowType.LAB_ORDER,
        }],
      });
      tasks.push(processingTask);

      // 3. Result Review Task
      const reviewTask = await this.createTask({
        status: 'draft',
        intent: 'order',
        priority: serviceRequest.priority || 'routine',
        code: {
          coding: [{
            system: 'http://omnicare.com/task-types',
            code: 'result-review',
            display: 'Result Review',
          }],
        },
        description: `Review results for ${serviceRequest.code?.text || 'lab test'}`,
        focus: {
          reference: `ServiceRequest/${serviceRequestId}`,
        },
        for: {
          reference: `Patient/${patientId}`,
        },
        requester: {
          reference: `Practitioner/${orderingProviderId}`,
        },
        owner: {
          reference: `Practitioner/${orderingProviderId}`,
        },
        partOf: [{
          reference: `Task/${processingTask.id}`,
        }],
        restriction: {
          period: {
            end: this.calculateDueDate(3), // Due in 3 days
          },
        },
        extension: [{
          url: 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type',
          valueString: WorkflowType.LAB_ORDER,
        }],
      });
      tasks.push(reviewTask);

      // 4. Patient Notification Task
      const notificationTask = await this.createTask({
        status: 'draft',
        intent: 'order',
        priority: 'routine',
        code: {
          coding: [{
            system: 'http://omnicare.com/task-types',
            code: 'patient-notification',
            display: 'Patient Notification',
          }],
        },
        description: `Notify patient of lab results`,
        focus: {
          reference: `ServiceRequest/${serviceRequestId}`,
        },
        for: {
          reference: `Patient/${patientId}`,
        },
        requester: {
          reference: `Practitioner/${orderingProviderId}`,
        },
        partOf: [{
          reference: `Task/${reviewTask.id}`,
        }],
        extension: [{
          url: 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type',
          valueString: WorkflowType.LAB_ORDER,
        }],
      });
      tasks.push(notificationTask);

      logger.fhir('Lab order workflow created', {
        serviceRequestId,
        taskCount: tasks.length,
        taskIds: tasks.map(t => t.id),
      });

      return tasks;
    } catch (error) {
      logger.error('Failed to create lab order workflow:', error);
      throw error;
    }
  }

  /**
   * Create referral workflow
   */
  async createReferralWorkflow(
    serviceRequestId: string,
    patientId: string,
    referringProviderId: string,
    specialtyType: string
  ): Promise<Task[]> {
    try {
      const tasks: Task[] = [];
      const serviceRequest = await medplumService.readResource<ServiceRequest>('ServiceRequest', serviceRequestId);

      // 1. Referral Processing Task
      const processingTask = await this.createTask({
        status: 'requested',
        intent: 'order',
        priority: serviceRequest.priority || 'routine',
        code: {
          coding: [{
            system: 'http://omnicare.com/task-types',
            code: 'referral-processing',
            display: 'Referral Processing',
          }],
        },
        description: `Process referral to ${specialtyType}`,
        focus: {
          reference: `ServiceRequest/${serviceRequestId}`,
        },
        for: {
          reference: `Patient/${patientId}`,
        },
        requester: {
          reference: `Practitioner/${referringProviderId}`,
        },
        performerType: [{
          coding: [{
            system: 'http://omnicare.com/performer-types',
            code: 'referral-coordinator',
            display: 'Referral Coordinator',
          }],
        }],
        restriction: {
          period: {
            end: this.calculateDueDate(2), // Due in 2 days
          },
        },
        extension: [{
          url: 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type',
          valueString: WorkflowType.REFERRAL,
        }],
      });
      tasks.push(processingTask);

      // 2. Insurance Authorization Task (if needed)
      const authTask = await this.createTask({
        status: 'draft',
        intent: 'order',
        priority: 'routine',
        code: {
          coding: [{
            system: 'http://omnicare.com/task-types',
            code: 'insurance-authorization',
            display: 'Insurance Authorization',
          }],
        },
        description: `Obtain insurance authorization for ${specialtyType} referral`,
        focus: {
          reference: `ServiceRequest/${serviceRequestId}`,
        },
        for: {
          reference: `Patient/${patientId}`,
        },
        requester: {
          reference: `Practitioner/${referringProviderId}`,
        },
        partOf: [{
          reference: `Task/${processingTask.id}`,
        }],
        restriction: {
          period: {
            end: this.calculateDueDate(5), // Due in 5 days
          },
        },
        extension: [{
          url: 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type',
          valueString: WorkflowType.REFERRAL,
        }],
      });
      tasks.push(authTask);

      // 3. Appointment Scheduling Task
      const schedulingTask = await this.createTask({
        status: 'draft',
        intent: 'order',
        priority: serviceRequest.priority || 'routine',
        code: {
          coding: [{
            system: 'http://omnicare.com/task-types',
            code: 'appointment-scheduling',
            display: 'Appointment Scheduling',
          }],
        },
        description: `Schedule appointment with ${specialtyType} specialist`,
        focus: {
          reference: `ServiceRequest/${serviceRequestId}`,
        },
        for: {
          reference: `Patient/${patientId}`,
        },
        requester: {
          reference: `Practitioner/${referringProviderId}`,
        },
        partOf: [{
          reference: `Task/${authTask.id}`,
        }],
        restriction: {
          period: {
            end: this.calculateDueDate(7), // Due in 7 days
          },
        },
        extension: [{
          url: 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type',
          valueString: WorkflowType.REFERRAL,
        }],
      });
      tasks.push(schedulingTask);

      // 4. Patient Communication Task
      const communicationTask = await this.createTask({
        status: 'draft',
        intent: 'order',
        priority: 'routine',
        code: {
          coding: [{
            system: 'http://omnicare.com/task-types',
            code: 'patient-communication',
            display: 'Patient Communication',
          }],
        },
        description: `Communicate referral details to patient`,
        focus: {
          reference: `ServiceRequest/${serviceRequestId}`,
        },
        for: {
          reference: `Patient/${patientId}`,
        },
        requester: {
          reference: `Practitioner/${referringProviderId}`,
        },
        partOf: [{
          reference: `Task/${schedulingTask.id}`,
        }],
        extension: [{
          url: 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type',
          valueString: WorkflowType.REFERRAL,
        }],
      });
      tasks.push(communicationTask);

      logger.fhir('Referral workflow created', {
        serviceRequestId,
        specialtyType,
        taskCount: tasks.length,
        taskIds: tasks.map(t => t.id),
      });

      return tasks;
    } catch (error) {
      logger.error('Failed to create referral workflow:', error);
      throw error;
    }
  }

  /**
   * Search tasks with various filters
   */
  async searchTasks(searchParams: FHIRSearchParams & {
    workflowType?: WorkflowType;
    overdue?: boolean;
    assignedTo?: string;
    dueDate?: string;
  }): Promise<Bundle<Task>> {
    try {
      // Build search parameters
      const params: FHIRSearchParams = { ...searchParams };

      // Add custom search parameters
      if (searchParams.workflowType) {
        params['_has:extension'] = `http://omnicare.com/fhir/StructureDefinition/task-workflow-type|${searchParams.workflowType}`;
      }

      if (searchParams.assignedTo) {
        params.owner = `Practitioner/${searchParams.assignedTo}`;
      }

      if (searchParams.overdue) {
        params['restriction-period'] = `lt${new Date().toISOString()}`;
        params.status = 'requested,accepted,in-progress,on-hold';
      }

      const result = await medplumService.searchResources<Task>('Task', params);
      
      logger.fhir('Task search completed', {
        resultCount: result.entry?.length || 0,
        searchParams,
      });

      return result;
    } catch (error) {
      logger.error('Failed to search tasks:', error);
      throw error;
    }
  }

  /**
   * Get tasks for a specific patient
   */
  async getPatientTasks(patientId: string, includeCompleted: boolean = false): Promise<Task[]> {
    try {
      const searchParams: FHIRSearchParams = {
        patient: `Patient/${patientId}`,
      };

      if (!includeCompleted) {
        searchParams.status = 'draft,requested,accepted,in-progress,on-hold,ready';
      }

      const bundle = await this.searchTasks(searchParams);
      const tasks = bundle.entry?.map(entry => entry.resource as Task) || [];

      logger.fhir('Retrieved patient tasks', {
        patientId,
        taskCount: tasks.length,
        includeCompleted,
      });

      return tasks;
    } catch (error) {
      logger.error('Failed to get patient tasks:', error);
      throw error;
    }
  }

  /**
   * Get tasks assigned to a practitioner
   */
  async getPractitionerTasks(practitionerId: string, status?: TaskStatus[]): Promise<Task[]> {
    try {
      const searchParams: FHIRSearchParams = {
        owner: `Practitioner/${practitionerId}`,
      };

      if (status && status.length > 0) {
        searchParams.status = status.join(',');
      }

      const bundle = await this.searchTasks(searchParams);
      const tasks = bundle.entry?.map(entry => entry.resource as Task) || [];

      logger.fhir('Retrieved practitioner tasks', {
        practitionerId,
        taskCount: tasks.length,
        status,
      });

      return tasks;
    } catch (error) {
      logger.error('Failed to get practitioner tasks:', error);
      throw error;
    }
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(): Promise<Task[]> {
    try {
      const bundle = await this.searchTasks({
        'restriction-period': `lt${new Date().toISOString()}`,
        status: 'requested,accepted,in-progress,on-hold',
        _sort: 'restriction-period',
      });

      const tasks = bundle.entry?.map(entry => entry.resource as Task) || [];

      logger.fhir('Retrieved overdue tasks', {
        taskCount: tasks.length,
      });

      return tasks;
    } catch (error) {
      logger.error('Failed to get overdue tasks:', error);
      throw error;
    }
  }

  /**
   * Get task statistics
   */
  async getTaskStatistics(practitionerId?: string): Promise<{
    total: number;
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<string, number>;
    byWorkflowType: Record<string, number>;
    overdue: number;
    dueSoon: number;
  }> {
    try {
      const searchParams: FHIRSearchParams = {};
      if (practitionerId) {
        searchParams.owner = `Practitioner/${practitionerId}`;
      }

      const bundle = await this.searchTasks(searchParams);
      const tasks = bundle.entry?.map(entry => entry.resource as Task) || [];

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const statistics = {
        total: tasks.length,
        byStatus: {} as Record<TaskStatus, number>,
        byPriority: {} as Record<string, number>,
        byWorkflowType: {} as Record<string, number>,
        overdue: 0,
        dueSoon: 0,
      };

      // Calculate statistics
      tasks.forEach(task => {
        // Status
        statistics.byStatus[task.status] = (statistics.byStatus[task.status] || 0) + 1;

        // Priority
        const priority = task.priority || 'routine';
        statistics.byPriority[priority] = (statistics.byPriority[priority] || 0) + 1;

        // Workflow type
        const workflowType = task.extension?.find(
          ext => ext.url === 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type'
        )?.valueString || 'general';
        statistics.byWorkflowType[workflowType] = (statistics.byWorkflowType[workflowType] || 0) + 1;

        // Overdue and due soon
        if (task.restriction?.period?.end && ['requested', 'accepted', 'in-progress'].includes(task.status)) {
          const dueDate = new Date(task.restriction.period.end);
          if (dueDate < now) {
            statistics.overdue++;
          } else if (dueDate < tomorrow) {
            statistics.dueSoon++;
          }
        }
      });

      logger.fhir('Task statistics calculated', {
        practitionerId,
        statistics,
      });

      return statistics;
    } catch (error) {
      logger.error('Failed to get task statistics:', error);
      throw error;
    }
  }

  /**
   * Add task comment
   */
  async addTaskComment(taskId: string, authorId: string, comment: string): Promise<Task> {
    try {
      const task = await medplumService.readResource<Task>('Task', taskId);

      task.note = task.note || [];
      task.note.push({
        authorReference: {
          reference: `Practitioner/${authorId}`,
        },
        time: new Date().toISOString(),
        text: comment,
      });

      task.lastModified = new Date().toISOString();

      const result = await medplumService.updateResource(task);
      logger.fhir('Task comment added', { taskId, authorId });

      return result;
    } catch (error) {
      logger.error('Failed to add task comment:', error);
      throw error;
    }
  }

  /**
   * Complete task with output
   */
  async completeTask(taskId: string, output?: Task['output']): Promise<Task> {
    try {
      const task = await medplumService.readResource<Task>('Task', taskId);

      // Validate task can be completed
      if (task.status !== 'in-progress') {
        throw new Error(`Task must be in 'in-progress' status to complete. Current status: ${task.status}`);
      }

      task.status = 'completed';
      task.lastModified = new Date().toISOString();
      
      if (output) {
        task.output = output;
      }

      // Add completion extension
      task.extension = task.extension || [];
      task.extension.push({
        url: 'http://omnicare.com/fhir/StructureDefinition/task-completion',
        extension: [
          {
            url: 'completedAt',
            valueDateTime: new Date().toISOString(),
          },
          {
            url: 'completedBy',
            valueReference: task.owner,
          },
        ],
      });

      const result = await medplumService.updateResource(task);
      logger.fhir('Task completed', { taskId });

      // Check if this task has dependent tasks
      await this.activateDependentTasks(taskId);

      return result;
    } catch (error) {
      logger.error('Failed to complete task:', error);
      throw error;
    }
  }

  /**
   * Activate dependent tasks when a task is completed
   */
  private async activateDependentTasks(completedTaskId: string): Promise<void> {
    try {
      // Search for tasks that have this task as partOf
      const bundle = await medplumService.searchResources<Task>('Task', {
        'part-of': `Task/${completedTaskId}`,
        status: 'draft',
      });

      const dependentTasks = bundle.entry?.map(entry => entry.resource as Task) || [];

      for (const task of dependentTasks) {
        // Check if all parent tasks are completed
        const allParentsCompleted = await this.checkAllParentTasksCompleted(task);
        
        if (allParentsCompleted) {
          await this.updateTaskStatus(task.id!, 'requested', 'Parent task completed');
        }
      }

      logger.fhir('Dependent tasks activated', {
        completedTaskId,
        activatedCount: dependentTasks.length,
      });
    } catch (error) {
      logger.error('Failed to activate dependent tasks:', error);
    }
  }

  /**
   * Check if all parent tasks are completed
   */
  private async checkAllParentTasksCompleted(task: Task): Promise<boolean> {
    if (!task.partOf || task.partOf.length === 0) {
      return true;
    }

    for (const parentRef of task.partOf) {
      const parentId = this.extractIdFromReference(parentRef);
      const parentTask = await medplumService.readResource<Task>('Task', parentId);
      
      if (parentTask.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  /**
   * Send task notification (placeholder - would integrate with notification service)
   */
  private async sendTaskNotification(notification: TaskNotification): Promise<void> {
    // In a real implementation, this would send actual notifications
    // via email, SMS, push notifications, or in-app messaging
    logger.info('Task notification sent', notification);
  }

  /**
   * Calculate due date based on days from now
   */
  private calculateDueDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString();
  }

  /**
   * Extract ID from FHIR reference
   */
  private extractIdFromReference(reference: Reference): string {
    const parts = reference.reference?.split('/') || [];
    return parts[parts.length - 1] || '';
  }

  /**
   * Map task priority to notification priority
   */
  private mapTaskPriorityToNotification(taskPriority: string): 'high' | 'medium' | 'low' {
    switch (taskPriority) {
      case 'stat':
      case 'asap':
        return 'high';
      case 'urgent':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Validate task workflow
   */
  async validateTaskWorkflow(taskId: string): Promise<ValidationResult> {
    try {
      const task = await medplumService.readResource<Task>('Task', taskId);
      const result = await fhirResourcesService.validateResource(task);

      // Add custom workflow validation
      const workflowType = task.extension?.find(
        ext => ext.url === 'http://omnicare.com/fhir/StructureDefinition/task-workflow-type'
      )?.valueString;

      if (workflowType && !Object.values(WorkflowType).includes(workflowType as WorkflowType)) {
        result.errors.push({
          path: 'extension[workflow-type]',
          message: `Invalid workflow type: ${workflowType}`,
          code: 'invalid-workflow-type',
          severity: 'error',
        });
        result.valid = false;
      }

      return result;
    } catch (error) {
      logger.error('Failed to validate task workflow:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const fhirTaskService = new FHIRTaskService();