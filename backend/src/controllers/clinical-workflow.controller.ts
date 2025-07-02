import { Task, Resource, Bundle, DocumentReference } from '@medplum/fhirtypes';
import { Request, Response } from 'express';

import { createValidationChain } from '@/middleware/validation.middleware';
import logger from '@/utils/logger';

interface MedplumClient {
  readResource<T extends Resource>(resourceType: string, id: string): Promise<T>;
  createResource<T extends Resource>(resource: T): Promise<T>;
  updateResource<T extends Resource>(resource: T): Promise<T>;
  searchResources<T extends Resource>(resourceType: string, params?: Record<string, string | string[] | number | undefined>): Promise<Bundle<T>>;
}

export interface ClinicalWorkflowController {
  createTask: (req: Request, res: Response) => Promise<void>;
  getTasks: (req: Request, res: Response) => Promise<void>;
  updateTaskStatus: (req: Request, res: Response) => Promise<void>;
  assignTask: (req: Request, res: Response) => Promise<void>;
  getTasksByPatient: (req: Request, res: Response) => Promise<void>;
  getTasksByPractitioner: (req: Request, res: Response) => Promise<void>;
  createClinicalWorkflow: (req: Request, res: Response) => Promise<void>;
  getWorkflowTemplates: (req: Request, res: Response) => Promise<void>;

  // Clinical Notes API
  createClinicalNote: (req: Request, res: Response) => Promise<void>;
  getClinicalNotes: (req: Request, res: Response) => Promise<void>;
  getClinicalNote: (req: Request, res: Response) => Promise<void>;
  updateClinicalNote: (req: Request, res: Response) => Promise<void>;
  deleteClinicalNote: (req: Request, res: Response) => Promise<void>;
  saveDraftNote: (req: Request, res: Response) => Promise<void>;
  publishDraftNote: (req: Request, res: Response) => Promise<void>;
  getNoteTemplates: (req: Request, res: Response) => Promise<void>;
  createNoteFromTemplate: (req: Request, res: Response) => Promise<void>;
  getNoteVersions: (req: Request, res: Response) => Promise<void>;
  addendum: (req: Request, res: Response) => Promise<void>;
}

class ClinicalWorkflowControllerImpl implements ClinicalWorkflowController {
  constructor(private medplum: MedplumClient) {}

  /**
   * Create a new clinical task
   * POST /api/clinical-workflow/tasks
   */
  async createTask(req: Request, res: Response): Promise<void> {
    try {
      const {
        patientId,
        practitionerId,
        description,
        priority = 'routine',
        category,
        code,
        dueDate,
        encounterId,
        serviceRequestId,
      } = req.body;

      logger.info('Creating new clinical task', {
        patientId,
        practitionerId,
        category,
        priority,
      });

      // Validate required fields
      if (!patientId || !description) {
        res.status(400).json({
          error: 'Patient ID and description are required',
        });
        return;
      }

      // Verify patient exists
      try {
        await this.medplum.readResource<Resource>('Patient', patientId);
      } catch {
        res.status(404).json({
          error: 'Patient not found',
        });
        return;
      }

      // Verify practitioner exists if provided
      if (practitionerId) {
        try {
          await this.medplum.readResource<Resource>('Practitioner', practitionerId);
        } catch {
          res.status(404).json({
            error: 'Practitioner not found',
          });
          return;
        }
      }

      // Create FHIR Task resource
      const task: Task = {
        resourceType: 'Task',
        status: 'requested',
        priority: priority as 'routine' | 'urgent' | 'asap' | 'stat',
        intent: 'order',
        description,
        for: {
          reference: `Patient/${patientId}`,
        },
        authoredOn: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        requester: req.user?.id
          ? { reference: `Practitioner/${req.user.id}` }
          : undefined,
        owner: practitionerId
          ? { reference: `Practitioner/${practitionerId}` }
          : undefined,
      };

      // Add category if provided
      if (category) {
        task.code = {
          coding: [{
            system: 'http://hl7.org/fhir/CodeSystem/task-type',
            code: category,
            display: this.getTaskCategoryDisplay(category),
          }],
        };
      }

      // Add custom code if provided
      if (code) {
        task.code = {
          ...task.code,
          coding: [
            ...(task.code?.coding || []),
            {
              system: 'http://omnicare.com/task-codes',
              code: code.code,
              display: code.display,
            },
          ],
        };
      }

      // Add due date if provided
      if (dueDate) {
        task.restriction = {
          period: {
            end: dueDate,
          },
        };
      }

      // Link to encounter if provided
      if (encounterId) {
        task.encounter = {
          reference: `Encounter/${encounterId}`,
        };
      }

      // Link to service request if provided
      if (serviceRequestId) {
        task.basedOn = [{
          reference: `ServiceRequest/${serviceRequestId}`,
        }];
      }

      // Create the task
      const createdTask = await this.medplum.createResource<Task>(task);

      logger.info('Clinical task created successfully', {
        taskId: createdTask.id,
        patientId,
        category,
      });

      res.status(201).json({
        message: 'Task created successfully',
        task: createdTask,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error creating clinical task', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to create task',
        details: errorMessage,
      });
    }
  }

  /**
   * Get all tasks with filtering options
   * GET /api/clinical-workflow/tasks
   */
  async getTasks(req: Request, res: Response): Promise<void> {
    try {
      const {
        status,
        priority,
        category,
        patient,
        practitioner,
        _count = '20',
        _sort = '-_lastUpdated',
      } = req.query as { [key: string]: string | undefined };

      logger.info('Fetching clinical tasks', {
        status,
        priority,
        category,
        patient,
        practitioner,
      });

      // Build search parameters
      const searchParams: Record<string, string | string[]> = {
        _count: _count,
        _sort: _sort,
        _include: ['Task:patient', 'Task:owner', 'Task:requester'],
      };

      if (status) searchParams.status = status;
      if (priority) searchParams.priority = priority;
      if (patient) searchParams.patient = `Patient/${patient}`;
      if (practitioner) searchParams.owner = `Practitioner/${practitioner}`;

      // Add category filter
      if (category) {
        searchParams.code = category;
      }

      const searchResult = await this.medplum.searchResources<Task>('Task', searchParams);
      const tasks = searchResult.entry?.map(entry => entry.resource).filter((task): task is Task => !!task) || [];

      res.json({
        tasks,
        total: tasks.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching clinical tasks', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to fetch tasks',
        details: errorMessage,
      });
    }
  }

  /**
   * Update task status
   * PATCH /api/clinical-workflow/tasks/:id/status
   */
  async updateTaskStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, note } = req.body;

      logger.info('Updating task status', { taskId: id, status });

      // Validate status
      const validStatuses = ['requested', 'accepted', 'in-progress', 'completed', 'cancelled', 'failed'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          error: 'Invalid status',
          validStatuses,
        });
        return;
      }

      // Get current task
      const task = await this.medplum.readResource<Task>('Task', id!);

      // Update task
      const updatedTask = await this.medplum.updateResource<Task>({
        ...task,
        status,
        lastModified: new Date().toISOString(),
        statusReason: note ? {
          text: note,
        } : undefined,
      } as Task);

      logger.info('Task status updated successfully', {
        taskId: id,
        oldStatus: task.status,
        newStatus: status,
      });

      res.json({
        message: 'Task status updated successfully',
        task: updatedTask,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error updating task status', { error: errorMessage });
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          error: 'Task not found',
        });
      } else {
        res.status(500).json({
          error: 'Failed to update task status',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Assign task to practitioner
   * PATCH /api/clinical-workflow/tasks/:id/assign
   */
  async assignTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { practitionerId, note } = req.body;

      logger.info('Assigning task to practitioner', { taskId: id, practitionerId });

      // Verify practitioner exists
      if (practitionerId) {
        try {
          await this.medplum.readResource<Resource>('Practitioner', practitionerId);
        } catch {
          res.status(404).json({
            error: 'Practitioner not found',
          });
          return;
        }
      }

      // Get current task
      const task = await this.medplum.readResource<Task>('Task', id!);

      // Update task assignment
      const updatedTask = await this.medplum.updateResource({
        ...task,
        owner: practitionerId ? { reference: `Practitioner/${practitionerId}` } : undefined,
        lastModified: new Date().toISOString(),
        note: note ? [{
          text: note,
          time: new Date().toISOString(),
        }] : task.note,
      });

      logger.info('Task assigned successfully', {
        taskId: id,
        practitionerId,
      });

      res.json({
        message: 'Task assigned successfully',
        task: updatedTask,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error assigning task', { error: errorMessage });
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          error: 'Task not found',
        });
      } else {
        res.status(500).json({
          error: 'Failed to assign task',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Get tasks for a specific patient
   * GET /api/clinical-workflow/patients/:patientId/tasks
   */
  async getTasksByPatient(req: Request, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const { status, _count = '50' } = req.query as { [key: string]: string | undefined };

      if (!patientId) {
        res.status(400).json({
          error: 'Patient ID is required',
        });
        return;
      }

      logger.info('Fetching tasks for patient', { patientId });

      // Verify patient exists
      try {
        await this.medplum.readResource<Resource>('Patient', patientId);
      } catch {
        res.status(404).json({
          error: 'Patient not found',
        });
        return;
      }

      // Search for tasks
      const searchParams: Record<string, string | string[]> = {
        patient: `Patient/${patientId}`,
        _count: String(_count),
        _sort: '-_lastUpdated',
        _include: ['Task:owner', 'Task:requester'],
      };

      if (status) searchParams.status = String(status);

      const searchResult = await this.medplum.searchResources<Task>('Task', searchParams);
      const tasks = searchResult.entry?.map(entry => entry.resource).filter((task): task is Task => !!task) || [];

      res.json({
        tasks,
        total: tasks.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching patient tasks', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to fetch patient tasks',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get tasks assigned to a specific practitioner
   * GET /api/clinical-workflow/practitioners/:practitionerId/tasks
   */
  async getTasksByPractitioner(req: Request, res: Response): Promise<void> {
    try {
      const { practitionerId } = req.params;
      const { status, priority, _count = '50' } = req.query as { [key: string]: string | undefined };

      logger.info('Fetching tasks for practitioner', { practitionerId });

      // Search for tasks
      const searchParams: Record<string, string | string[]> = {
        owner: `Practitioner/${practitionerId}`,
        _count: _count,
        _sort: '-_lastUpdated',
        _include: ['Task:patient', 'Task:requester'],
      };

      if (status) searchParams.status = status;
      if (priority) searchParams.priority = priority;

      const searchResult = await this.medplum.searchResources<Task>('Task', searchParams);
      const tasks = searchResult.entry?.map(entry => entry.resource).filter((task): task is Task => !!task) || [];

      res.json({
        tasks,
        total: tasks.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching practitioner tasks', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to fetch practitioner tasks',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create a clinical workflow from template
   * POST /api/clinical-workflow/workflows
   */
  async createClinicalWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const { templateId, patientId, encounterId, parameters } = req.body;

      logger.info('Creating clinical workflow', { templateId, patientId });

      // Get workflow template
      const template = this.getWorkflowTemplate(templateId);
      if (!template) {
        res.status(404).json({
          error: 'Workflow template not found',
        });
        return;
      }

      // Verify patient exists
      try {
        await this.medplum.readResource<Resource>('Patient', patientId);
      } catch {
        res.status(404).json({
          error: 'Patient not found',
        });
        return;
      }

      // Create tasks based on template
      const createdTasks: Task[] = [];
      
      for (const taskTemplate of template.tasks) {
        const task: Task = {
          resourceType: 'Task',
          status: 'requested',
          priority: (taskTemplate.priority || 'routine') as 'routine' | 'urgent' | 'asap' | 'stat',
          intent: 'order',
          description: this.substituteParameters(taskTemplate.description, parameters),
          for: { reference: `Patient/${patientId}` },
          authoredOn: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          requester: req.user?.id
            ? { reference: `Practitioner/${req.user.id}` }
            : undefined,
        };

        // Add category
        if (taskTemplate.category) {
          task.code = {
            coding: [{
              system: 'http://hl7.org/fhir/CodeSystem/task-type',
              code: taskTemplate.category,
              display: this.getTaskCategoryDisplay(taskTemplate.category),
            }],
          };
        }

        // Add due date offset
        if (taskTemplate.dueDateOffset) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + taskTemplate.dueDateOffset);
          task.restriction = {
            period: { end: dueDate.toISOString() },
          };
        }

        // Link to encounter if provided
        if (encounterId) {
          task.encounter = { reference: `Encounter/${encounterId}` };
        }

        const createdTask = await this.medplum.createResource<Task>(task);
        createdTasks.push(createdTask);
      }

      logger.info('Clinical workflow created successfully', {
        templateId,
        patientId,
        tasksCreated: createdTasks.length,
      });

      res.status(201).json({
        message: 'Clinical workflow created successfully',
        tasks: createdTasks,
        workflow: {
          templateId,
          patientId,
          encounterId,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error creating clinical workflow', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to create clinical workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get available workflow templates
   * GET /api/clinical-workflow/templates
   */
  async getWorkflowTemplates(req: Request, res: Response): Promise<void> {
    try {
      await Promise.resolve(); // Placeholder for future async operations
      const templates = this.getAllWorkflowTemplates();
      res.json({ templates });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching workflow templates', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to fetch workflow templates',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Helper methods
  private getTaskCategoryDisplay(category: string): string {
    const categoryMap: Record<string, string> = {
      'assessment': 'Assessment',
      'medication': 'Medication Administration',
      'procedure': 'Procedure',
      'observation': 'Observation',
      'education': 'Patient Education',
      'consultation': 'Consultation',
      'follow-up': 'Follow-up',
      'discharge': 'Discharge Planning',
      'referral': 'Referral',
      'lab-order': 'Laboratory Order',
      'imaging-order': 'Imaging Order',
    };
    return categoryMap[category] || category;
  }

  private substituteParameters(template: string, parameters: Record<string, unknown> = {}): string {
    let result = template;
    for (const [key, value] of Object.entries(parameters)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
  }

  private getWorkflowTemplate(templateId: string) {
    const templates = this.getAllWorkflowTemplates();
    return templates.find(t => t.id === templateId);
  }

  private getAllWorkflowTemplates() {
    return [
      {
        id: 'admission-workflow',
        name: 'Patient Admission Workflow',
        description: 'Standard workflow for patient admission',
        tasks: [
          {
            category: 'assessment',
            description: 'Complete initial patient assessment',
            priority: 'urgent',
            dueDateOffset: 0,
          },
          {
            category: 'medication',
            description: 'Medication reconciliation',
            priority: 'routine',
            dueDateOffset: 1,
          },
          {
            category: 'lab-order',
            description: 'Order admission laboratory tests',
            priority: 'routine',
            dueDateOffset: 0,
          },
          {
            category: 'education',
            description: 'Provide patient orientation and education',
            priority: 'routine',
            dueDateOffset: 1,
          },
        ],
      },
      {
        id: 'discharge-workflow',
        name: 'Patient Discharge Workflow',
        description: 'Standard workflow for patient discharge',
        tasks: [
          {
            category: 'discharge',
            description: 'Complete discharge planning',
            priority: 'urgent',
            dueDateOffset: 0,
          },
          {
            category: 'medication',
            description: 'Discharge medication reconciliation',
            priority: 'urgent',
            dueDateOffset: 0,
          },
          {
            category: 'education',
            description: 'Discharge education and instructions',
            priority: 'routine',
            dueDateOffset: 0,
          },
          {
            category: 'follow-up',
            description: 'Schedule follow-up appointments',
            priority: 'routine',
            dueDateOffset: 1,
          },
        ],
      },
      {
        id: 'diabetes-management',
        name: 'Diabetes Management Workflow',
        description: 'Comprehensive diabetes care workflow',
        tasks: [
          {
            category: 'assessment',
            description: 'Diabetes assessment and glucose monitoring',
            priority: 'routine',
            dueDateOffset: 0,
          },
          {
            category: 'lab-order',
            description: 'Order HbA1c and lipid panel',
            priority: 'routine',
            dueDateOffset: 1,
          },
          {
            category: 'education',
            description: 'Diabetes self-management education',
            priority: 'routine',
            dueDateOffset: 2,
          },
          {
            category: 'referral',
            description: 'Referral to diabetes educator if needed',
            priority: 'routine',
            dueDateOffset: 7,
          },
        ],
      },
      {
        id: 'post-op-care',
        name: 'Post-Operative Care Workflow',
        description: 'Standard post-operative care workflow',
        tasks: [
          {
            category: 'assessment',
            description: 'Post-operative assessment',
            priority: 'urgent',
            dueDateOffset: 0,
          },
          {
            category: 'observation',
            description: 'Monitor vital signs and pain level',
            priority: 'urgent',
            dueDateOffset: 0,
          },
          {
            category: 'medication',
            description: 'Pain management and medication administration',
            priority: 'urgent',
            dueDateOffset: 0,
          },
          {
            category: 'procedure',
            description: 'Wound care and dressing change',
            priority: 'routine',
            dueDateOffset: 1,
          },
        ],
      },
    ];
  }

  // ===============================
  // CLINICAL NOTES API
  // ===============================

  /**
   * Create a new clinical note
   * POST /api/clinical-workflow/notes
   */
  async createClinicalNote(req: Request, res: Response): Promise<void> {
    try {
      const {
        patientId,
        encounterId,
        type = 'progress-note',
        title,
        content,
        status = 'draft',
        category,
        confidentiality = 'N', // Normal
        templateId,
        sections = [],
      } = req.body;

      logger.info('Creating clinical note', {
        patientId,
        encounterId,
        type,
        status,
      });

      // Validate required fields
      if (!patientId || !content) {
        res.status(400).json({
          error: 'Patient ID and content are required',
        });
        return;
      }

      // Verify patient exists
      try {
        await this.medplum.readResource<Resource>('Patient', patientId);
      } catch {
        res.status(404).json({
          error: 'Patient not found',
        });
        return;
      }

      // Verify encounter exists if provided
      if (encounterId) {
        try {
          await this.medplum.readResource<Resource>('Encounter', encounterId);
        } catch {
          res.status(404).json({
            error: 'Encounter not found',
          });
          return;
        }
      }

      // Create FHIR DocumentReference for the clinical note
      const documentReference: DocumentReference = {
        resourceType: 'DocumentReference',
        status: 'current',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: this.getNoteTypeCode(type),
            display: this.getNoteTypeDisplay(type),
          }],
        },
        category: category ? [{
          coding: [{
            system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
            code: category,
            display: this.getNoteCategoryDisplay(category),
          }],
        }] : undefined,
        subject: {
          reference: `Patient/${patientId}`,
        },
        context: encounterId ? {
          encounter: [{
            reference: `Encounter/${encounterId}`,
          }],
        } : undefined,
        date: new Date().toISOString(),
        author: req.user?.id ? [{
          reference: `Practitioner/${req.user.id}`,
        }] : [],
        custodian: {
          reference: 'Organization/omnicare',
        },
        securityLabel: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
            code: confidentiality,
            display: confidentiality === 'N' ? 'Normal' : 'Restricted',
          }],
        }],
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: Buffer.from(content).toString('base64'),
            title: title || `${this.getNoteTypeDisplay(type)} - ${new Date().toLocaleDateString()}`,
            creation: new Date().toISOString(),
          },
        }],
        identifier: [{
          system: 'http://omnicare.com/clinical-note-id',
          value: `CN${Date.now()}`,
        }],
        extension: [
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/note-template-id',
            valueString: templateId || '',
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/note-version',
            valueInteger: 1,
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/note-sections',
            valueString: JSON.stringify(sections),
          },
        ],
      };

      const createdNote = await this.medplum.createResource<DocumentReference>(documentReference);

      logger.info('Clinical note created successfully', {
        noteId: createdNote.id,
        patientId,
        type,
        status,
      });

      res.status(201).json({
        message: 'Clinical note created successfully',
        note: createdNote,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error creating clinical note', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to create clinical note',
        details: errorMessage,
      });
    }
  }

  /**
   * Get clinical notes with filtering
   * GET /api/clinical-workflow/notes
   */
  async getClinicalNotes(req: Request, res: Response): Promise<void> {
    try {
      const {
        patientId,
        encounterId,
        type,
        status,
        author,
        category,
        _count = '20',
        _sort = '-date',
      } = req.query as { [key: string]: string | undefined };

      logger.info('Fetching clinical notes', {
        patientId,
        encounterId,
        type,
        status,
      });

      // Build search parameters
      const searchParams: Record<string, string | string[]> = {
        _count: _count,
        _sort: _sort,
        _include: ['DocumentReference:subject', 'DocumentReference:author'],
      };

      if (patientId) searchParams.subject = `Patient/${patientId}`;
      if (encounterId) searchParams.encounter = `Encounter/${encounterId}`;
      if (status) {
        searchParams.status = status === 'draft' ? 'current' : 'current';
      }
      if (author) searchParams.author = `Practitioner/${author}`;
      if (type) {
        searchParams.type = this.getNoteTypeCode(type);
      }
      if (category) {
        searchParams.category = category;
      }

      const searchResult = await this.medplum.searchResources<DocumentReference>('DocumentReference', searchParams);
      const notes = searchResult.entry?.map(entry => entry.resource).filter((note): note is DocumentReference => !!note) || [];

      res.json({
        notes,
        total: notes.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching clinical notes', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to fetch clinical notes',
        details: errorMessage,
      });
    }
  }

  /**
   * Get a specific clinical note
   * GET /api/clinical-workflow/notes/:id
   */
  async getClinicalNote(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Note ID is required',
        });
        return;
      }

      logger.info('Fetching clinical note', { noteId: id });

      const note = await this.medplum.readResource<DocumentReference>('DocumentReference', id);

      // Decode content if it's base64 encoded
      if (note.content?.[0]?.attachment?.data) {
        const decodedContent = Buffer.from(note.content[0].attachment.data, 'base64').toString('utf-8');
        note.content[0].attachment.data = decodedContent;
      }

      res.json({
        note,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching clinical note', { error: errorMessage });
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          error: 'Clinical note not found',
        });
      } else {
        res.status(500).json({
          error: 'Failed to fetch clinical note',
          details: errorMessage,
        });
      }
    }
  }

  /**
   * Update a clinical note
   * PUT /api/clinical-workflow/notes/:id
   */
  async updateClinicalNote(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { content, title, status: _status, sections } = req.body;

      if (!id) {
        res.status(400).json({
          error: 'Note ID is required',
        });
        return;
      }

      logger.info('Updating clinical note', { noteId: id });

      // Get current note
      const currentNote = await this.medplum.readResource<DocumentReference>('DocumentReference', id);

      // Create new version
      const versionExtension = currentNote.extension?.find(ext => 
        ext.url === 'http://omnicare.com/fhir/StructureDefinition/note-version'
      );
      const currentVersion = versionExtension?.valueInteger || 1;

      const updatedNote: DocumentReference = {
        ...currentNote,
        status: 'current',
        date: new Date().toISOString(),
        content: content ? [{
          ...currentNote.content?.[0],
          attachment: {
            ...currentNote.content?.[0]?.attachment,
            contentType: 'text/plain',
            data: Buffer.from(content).toString('base64'),
            title: title || currentNote.content?.[0]?.attachment?.title,
            creation: new Date().toISOString(),
          },
        }] : currentNote.content,
        extension: [
          ...(currentNote.extension?.filter(ext => 
            ext.url !== 'http://omnicare.com/fhir/StructureDefinition/note-version' &&
            ext.url !== 'http://omnicare.com/fhir/StructureDefinition/note-sections'
          ) || []),
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/note-version',
            valueInteger: currentVersion + 1,
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/note-sections',
            valueString: sections ? JSON.stringify(sections) : 
              currentNote.extension?.find(ext => 
                ext.url === 'http://omnicare.com/fhir/StructureDefinition/note-sections'
              )?.valueString || '[]',
          },
        ],
      };

      const result = await this.medplum.updateResource<DocumentReference>(updatedNote);

      logger.info('Clinical note updated successfully', {
        noteId: id,
        newVersion: currentVersion + 1,
      });

      res.json({
        message: 'Clinical note updated successfully',
        note: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error updating clinical note', { error: errorMessage });
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          error: 'Clinical note not found',
        });
      } else {
        res.status(500).json({
          error: 'Failed to update clinical note',
          details: errorMessage,
        });
      }
    }
  }

  /**
   * Delete a clinical note (soft delete by changing status)
   * DELETE /api/clinical-workflow/notes/:id
   */
  async deleteClinicalNote(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Note ID is required',
        });
        return;
      }

      logger.info('Deleting clinical note', { noteId: id });

      // Get current note
      const currentNote = await this.medplum.readResource<DocumentReference>('DocumentReference', id);

      // Soft delete by changing status to entered-in-error
      const deletedNote = await this.medplum.updateResource<DocumentReference>({
        ...currentNote,
        status: 'entered-in-error',
        date: new Date().toISOString(),
      });

      logger.info('Clinical note deleted successfully', { noteId: id });

      res.json({
        message: 'Clinical note deleted successfully',
        note: deletedNote,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error deleting clinical note', { error: errorMessage });
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          error: 'Clinical note not found',
        });
      } else {
        res.status(500).json({
          error: 'Failed to delete clinical note',
          details: errorMessage,
        });
      }
    }
  }

  /**
   * Save draft note
   * POST /api/clinical-workflow/notes/draft
   */
  async saveDraftNote(req: Request, res: Response): Promise<void> {
    try {
      const noteData = { ...req.body, status: 'draft' };
      req.body = noteData;
      await this.createClinicalNote(req, res);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error saving draft note', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to save draft note',
        details: errorMessage,
      });
    }
  }

  /**
   * Publish draft note
   * POST /api/clinical-workflow/notes/:id/publish
   */
  async publishDraftNote(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Note ID is required',
        });
        return;
      }

      logger.info('Publishing draft note', { noteId: id });

      // Get current note
      const currentNote = await this.medplum.readResource<DocumentReference>('DocumentReference', id);

      // Check if note is still a draft using docStatus
      if (currentNote.docStatus && currentNote.docStatus === 'final') {
        res.status(400).json({
          error: 'Only draft notes can be published',
        });
        return;
      }

      // Update status to current (published)
      const publishedNote = await this.medplum.updateResource<DocumentReference>({
        ...currentNote,
        status: 'current',
        date: new Date().toISOString(),
      });

      logger.info('Draft note published successfully', { noteId: id });

      res.json({
        message: 'Draft note published successfully',
        note: publishedNote,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error publishing draft note', { error: errorMessage });
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          error: 'Clinical note not found',
        });
      } else {
        res.status(500).json({
          error: 'Failed to publish draft note',
          details: errorMessage,
        });
      }
    }
  }

  /**
   * Get available note templates
   * GET /api/clinical-workflow/notes/templates
   */
  async getNoteTemplates(req: Request, res: Response): Promise<void> {
    try {
      await Promise.resolve(); // Placeholder for future async operations
      const templates = this.getAllNoteTemplates();
      res.json({ templates });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching note templates', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to fetch note templates',
        details: errorMessage,
      });
    }
  }

  /**
   * Create note from template
   * POST /api/clinical-workflow/notes/from-template
   */
  async createNoteFromTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId, patientId, encounterId, variables = {} } = req.body;

      if (!templateId || !patientId) {
        res.status(400).json({
          error: 'Template ID and Patient ID are required',
        });
        return;
      }

      logger.info('Creating note from template', { templateId, patientId });

      // Get template
      const template = this.getNoteTemplate(templateId);
      if (!template) {
        res.status(404).json({
          error: 'Note template not found',
        });
        return;
      }

      // Substitute variables in template content
      const content = this.substituteTemplateVariables(template.content, variables);
      const title = this.substituteTemplateVariables(template.title, variables);

      // Create note with template data
      const noteData = {
        patientId,
        encounterId,
        type: template.type,
        title,
        content,
        status: 'draft',
        category: template.category,
        templateId,
        sections: template.sections,
      };

      req.body = noteData;
      await this.createClinicalNote(req, res);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error creating note from template', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to create note from template',
        details: errorMessage,
      });
    }
  }

  /**
   * Get note versions
   * GET /api/clinical-workflow/notes/:id/versions
   */
  async getNoteVersions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Note ID is required',
        });
        return;
      }

      logger.info('Fetching note versions', { noteId: id });

      // For this simplified implementation, we'll return version history from the current note
      // In a full implementation, you'd maintain a separate version history
      const currentNote = await this.medplum.readResource<DocumentReference>('DocumentReference', id);
      
      const versionExtension = currentNote.extension?.find(ext => 
        ext.url === 'http://omnicare.com/fhir/StructureDefinition/note-version'
      );
      const currentVersion = versionExtension?.valueInteger || 1;

      // Mock version history - in production, maintain actual version records
      const versions = Array.from({ length: currentVersion }, (_, i) => ({
        version: i + 1,
        date: new Date(Date.now() - (currentVersion - i - 1) * 86400000).toISOString(),
        author: currentNote.author?.[0]?.reference || 'Unknown',
        isCurrent: i + 1 === currentVersion,
      }));

      res.json({
        noteId: id,
        versions,
        totalVersions: currentVersion,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching note versions', { error: errorMessage });
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          error: 'Clinical note not found',
        });
      } else {
        res.status(500).json({
          error: 'Failed to fetch note versions',
          details: errorMessage,
        });
      }
    }
  }

  /**
   * Add addendum to existing note
   * POST /api/clinical-workflow/notes/:id/addendum
   */
  async addendum(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { content, title } = req.body;

      if (!id || !content) {
        res.status(400).json({
          error: 'Note ID and addendum content are required',
        });
        return;
      }

      logger.info('Adding addendum to note', { noteId: id });

      // Get current note
      const currentNote = await this.medplum.readResource<DocumentReference>('DocumentReference', id);

      // Create addendum as a related DocumentReference
      const addendum: DocumentReference = {
        resourceType: 'DocumentReference',
        status: 'current',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: '81223-0',
            display: 'Addendum',
          }],
        },
        subject: currentNote.subject,
        context: currentNote.context,
        date: new Date().toISOString(),
        author: req.user?.id ? [{
          reference: `Practitioner/${req.user.id}`,
        }] : [],
        custodian: currentNote.custodian,
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: Buffer.from(content).toString('base64'),
            title: title || `Addendum - ${new Date().toLocaleDateString()}`,
            creation: new Date().toISOString(),
          },
        }],
        relatesTo: [{
          code: 'appends',
          target: {
            reference: `DocumentReference/${id}`,
          },
        }],
        identifier: [{
          system: 'http://omnicare.com/clinical-note-addendum-id',
          value: `CNA${Date.now()}`,
        }],
      };

      const createdAddendum = await this.medplum.createResource<DocumentReference>(addendum);

      logger.info('Addendum created successfully', {
        originalNoteId: id,
        addendumId: createdAddendum.id,
      });

      res.status(201).json({
        message: 'Addendum created successfully',
        addendum: createdAddendum,
        originalNote: currentNote,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error creating addendum', { error: errorMessage });
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          error: 'Clinical note not found',
        });
      } else {
        res.status(500).json({
          error: 'Failed to create addendum',
          details: errorMessage,
        });
      }
    }
  }

  // Helper methods for clinical notes
  private getNoteTypeCode(type: string): string {
    const typeMap: Record<string, string> = {
      'progress-note': '11506-3',
      'history-and-physical': '11492-6',
      'consultation-note': '11488-4',
      'discharge-summary': '18842-5',
      'operative-note': '11504-8',
      'procedure-note': '28570-0',
      'nursing-note': '46240-8',
      'physician-note': '34109-9',
    };
    return typeMap[type] || '11506-3'; // Default to progress note
  }

  private getNoteTypeDisplay(type: string): string {
    const displayMap: Record<string, string> = {
      'progress-note': 'Progress Note',
      'history-and-physical': 'History and Physical',
      'consultation-note': 'Consultation Note',
      'discharge-summary': 'Discharge Summary',
      'operative-note': 'Operative Note',
      'procedure-note': 'Procedure Note',
      'nursing-note': 'Nursing Note',
      'physician-note': 'Physician Note',
    };
    return displayMap[type] || 'Progress Note';
  }

  private getNoteCategoryDisplay(category: string): string {
    const categoryMap: Record<string, string> = {
      'clinical-note': 'Clinical Note',
      'discharge-summary': 'Discharge Summary',
      'referral-note': 'Referral Note',
      'transfer-summary': 'Transfer Summary',
    };
    return categoryMap[category] || category;
  }

  private getNoteTemplate(templateId: string) {
    const templates = this.getAllNoteTemplates();
    return templates.find(t => t.id === templateId);
  }

  private getAllNoteTemplates() {
    return [
      {
        id: 'progress-note-template',
        name: 'Progress Note Template',
        type: 'progress-note',
        category: 'clinical-note',
        title: 'Progress Note - {{date}}',
        content: `SUBJECTIVE:
{{subjective}}

OBJECTIVE:
{{objective}}

ASSESSMENT:
{{assessment}}

PLAN:
{{plan}}`,
        sections: [
          { name: 'Subjective', required: true },
          { name: 'Objective', required: true },
          { name: 'Assessment', required: true },
          { name: 'Plan', required: true },
        ],
      },
      {
        id: 'history-physical-template',
        name: 'History and Physical Template',
        type: 'history-and-physical',
        category: 'clinical-note',
        title: 'History and Physical - {{patientName}}',
        content: `CHIEF COMPLAINT:
{{chiefComplaint}}

HISTORY OF PRESENT ILLNESS:
{{hpi}}

PAST MEDICAL HISTORY:
{{pmh}}

MEDICATIONS:
{{medications}}

ALLERGIES:
{{allergies}}

SOCIAL HISTORY:
{{socialHistory}}

FAMILY HISTORY:
{{familyHistory}}

REVIEW OF SYSTEMS:
{{reviewOfSystems}}

PHYSICAL EXAMINATION:
{{physicalExam}}

ASSESSMENT AND PLAN:
{{assessmentAndPlan}}`,
        sections: [
          { name: 'Chief Complaint', required: true },
          { name: 'History of Present Illness', required: true },
          { name: 'Past Medical History', required: false },
          { name: 'Medications', required: false },
          { name: 'Allergies', required: true },
          { name: 'Social History', required: false },
          { name: 'Family History', required: false },
          { name: 'Review of Systems', required: false },
          { name: 'Physical Examination', required: true },
          { name: 'Assessment and Plan', required: true },
        ],
      },
      {
        id: 'discharge-summary-template',
        name: 'Discharge Summary Template',
        type: 'discharge-summary',
        category: 'discharge-summary',
        title: 'Discharge Summary - {{patientName}}',
        content: `ADMISSION DATE: {{admissionDate}}
DISCHARGE DATE: {{dischargeDate}}

DISCHARGE DIAGNOSIS:
{{dischargeDiagnosis}}

HOSPITAL COURSE:
{{hospitalCourse}}

DISCHARGE MEDICATIONS:
{{dischargeMedications}}

DISCHARGE INSTRUCTIONS:
{{dischargeInstructions}}

FOLLOW-UP:
{{followUp}}`,
        sections: [
          { name: 'Discharge Diagnosis', required: true },
          { name: 'Hospital Course', required: true },
          { name: 'Discharge Medications', required: false },
          { name: 'Discharge Instructions', required: true },
          { name: 'Follow-up', required: false },
        ],
      },
    ];
  }

  private substituteTemplateVariables(template: string, variables: Record<string, unknown>): string {
    let result = template;
    
    // Add default variables
    const defaultVariables = {
      date: new Date().toLocaleDateString(),
      datetime: new Date().toLocaleString(),
      ...variables,
    };
    
    for (const [key, value] of Object.entries(defaultVariables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    
    return result;
  }
}

// Validation schemas
export const createTaskValidation = createValidationChain([
  {
    field: 'patientId',
    rules: [{ type: 'required' }, { type: 'string' }],
  },
  {
    field: 'description',
    rules: [{ type: 'required' }, { type: 'string', min: 5, max: 500 }],
  },
  {
    field: 'priority',
    rules: [{ type: 'optional' }, { type: 'enum', values: ['routine', 'urgent', 'asap', 'stat'] }],
  },
  {
    field: 'category',
    rules: [{ type: 'optional' }, { type: 'string' }],
  },
]);

export const updateTaskStatusValidation = createValidationChain([
  {
    field: 'status',
    rules: [
      { type: 'required' },
      { type: 'enum', values: ['requested', 'accepted', 'in-progress', 'completed', 'cancelled', 'failed'] },
    ],
  },
]);

export const createWorkflowValidation = createValidationChain([
  {
    field: 'templateId',
    rules: [{ type: 'required' }, { type: 'string' }],
  },
  {
    field: 'patientId',
    rules: [{ type: 'required' }, { type: 'string' }],
  },
]);

// Clinical Notes validation schemas
export const createClinicalNoteValidation = createValidationChain([
  {
    field: 'patientId',
    rules: [{ type: 'required' }, { type: 'string' }],
  },
  {
    field: 'content',
    rules: [{ type: 'required' }, { type: 'string', min: 10 }],
  },
  {
    field: 'type',
    rules: [{ type: 'optional' }, { type: 'enum', values: ['progress-note', 'history-and-physical', 'consultation-note', 'discharge-summary', 'operative-note', 'procedure-note', 'nursing-note', 'physician-note'] }],
  },
  {
    field: 'status',
    rules: [{ type: 'optional' }, { type: 'enum', values: ['draft', 'published'] }],
  },
  {
    field: 'confidentiality',
    rules: [{ type: 'optional' }, { type: 'enum', values: ['N', 'R', 'V'] }],
  },
]);

export const updateClinicalNoteValidation = createValidationChain([
  {
    field: 'content',
    rules: [{ type: 'optional' }, { type: 'string', min: 10 }],
  },
  {
    field: 'status',
    rules: [{ type: 'optional' }, { type: 'enum', values: ['draft', 'published'] }],
  },
]);

export const createNoteFromTemplateValidation = createValidationChain([
  {
    field: 'templateId',
    rules: [{ type: 'required' }, { type: 'string' }],
  },
  {
    field: 'patientId',
    rules: [{ type: 'required' }, { type: 'string' }],
  },
  {
    field: 'variables',
    rules: [{ type: 'optional' }, { type: 'object' }],
  },
]);

export const addendumValidation = createValidationChain([
  {
    field: 'content',
    rules: [{ type: 'required' }, { type: 'string', min: 5 }],
  },
  {
    field: 'title',
    rules: [{ type: 'optional' }, { type: 'string', max: 200 }],
  },
]);

// Factory function to create controller instance
export const createClinicalWorkflowController = (medplum: MedplumClient): ClinicalWorkflowController => {
  return new ClinicalWorkflowControllerImpl(medplum);
};