import { Router } from 'express';

import { createClinicalWorkflowController, 
         createTaskValidation, 
         updateTaskStatusValidation, 
         createWorkflowValidation } from '@/controllers/clinical-workflow.controller';
import { authenticate } from '@/middleware/auth.middleware';
import { requireScope } from '@/middleware/auth.middleware';
import { createRateLimit } from '@/middleware/rate-limit.middleware';
import { validate } from '@/middleware/validation.middleware';
import { medplumService } from '@/services/medplum.service';

const router = Router();
const clinicalWorkflowController = createClinicalWorkflowController(medplumService);

// Async handler utility
const asyncHandler = (fn: (req: any, res: any, next: any) => Promise<void>) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Rate limiting for clinical workflow operations
const clinicalWorkflowLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many clinical workflow requests',
});

// Apply authentication and rate limiting to all routes
router.use(authenticate);
router.use(clinicalWorkflowLimiter);

/**
 * @swagger
 * components:
 *   schemas:
 *     Task:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique task identifier
 *         resourceType:
 *           type: string
 *           enum: [Task]
 *         status:
 *           type: string
 *           enum: [requested, accepted, in-progress, completed, cancelled, failed]
 *         priority:
 *           type: string
 *           enum: [routine, urgent, asap, stat]
 *         description:
 *           type: string
 *           description: Task description
 *         for:
 *           type: object
 *           properties:
 *             reference:
 *               type: string
 *               description: Patient reference
 *         owner:
 *           type: object
 *           properties:
 *             reference:
 *               type: string
 *               description: Practitioner reference
 *         authoredOn:
 *           type: string
 *           format: date-time
 *         lastModified:
 *           type: string
 *           format: date-time
 *     CreateTaskRequest:
 *       type: object
 *       required:
 *         - patientId
 *         - description
 *       properties:
 *         patientId:
 *           type: string
 *           description: Patient ID
 *         practitionerId:
 *           type: string
 *           description: Assigned practitioner ID
 *         description:
 *           type: string
 *           description: Task description
 *         priority:
 *           type: string
 *           enum: [routine, urgent, asap, stat]
 *           default: routine
 *         category:
 *           type: string
 *           description: Task category
 *         dueDate:
 *           type: string
 *           format: date-time
 *         encounterId:
 *           type: string
 *           description: Related encounter ID
 *         serviceRequestId:
 *           type: string
 *           description: Related service request ID
 *     WorkflowTemplate:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         tasks:
 *           type: array
 *           items:
 *             type: object
 */

/**
 * @swagger
 * /api/clinical-workflow/tasks:
 *   post:
 *     summary: Create a new clinical task
 *     tags: [Clinical Workflow]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTaskRequest'
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 task:
 *                   $ref: '#/components/schemas/Task'
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Patient or practitioner not found
 *       500:
 *         description: Internal server error
 */
router.post('/tasks',
  requireScope(['Task:write', 'user/*.write']),
  ...createTaskValidation,
  asyncHandler(clinicalWorkflowController.createTask)
);

/**
 * @swagger
 * /api/clinical-workflow/tasks:
 *   get:
 *     summary: Get all clinical tasks with filtering
 *     tags: [Clinical Workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [requested, accepted, in-progress, completed, cancelled, failed]
 *         description: Filter by task status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [routine, urgent, asap, stat]
 *         description: Filter by task priority
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by task category
 *       - in: query
 *         name: patient
 *         schema:
 *           type: string
 *         description: Filter by patient ID
 *       - in: query
 *         name: practitioner
 *         schema:
 *           type: string
 *         description: Filter by practitioner ID
 *       - in: query
 *         name: _count
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results to return
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *                 total:
 *                   type: integer
 */
router.get('/tasks',
  requireScope(['Task:read', 'user/*.read']),
  asyncHandler(clinicalWorkflowController.getTasks)
);

/**
 * @swagger
 * /api/clinical-workflow/tasks/{id}/status:
 *   patch:
 *     summary: Update task status
 *     tags: [Clinical Workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [requested, accepted, in-progress, completed, cancelled, failed]
 *               note:
 *                 type: string
 *                 description: Optional status change note
 *     responses:
 *       200:
 *         description: Task status updated
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.patch('/tasks/:id/status',
  requireScope(['Task:write', 'user/*.write']),
  ...updateTaskStatusValidation,
  asyncHandler(clinicalWorkflowController.updateTaskStatus)
);

/**
 * @swagger
 * /api/clinical-workflow/tasks/{id}/assign:
 *   patch:
 *     summary: Assign task to practitioner
 *     tags: [Clinical Workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               practitionerId:
 *                 type: string
 *                 description: Practitioner ID to assign (null to unassign)
 *               note:
 *                 type: string
 *                 description: Optional assignment note
 *     responses:
 *       200:
 *         description: Task assigned successfully
 *       404:
 *         description: Task or practitioner not found
 *       500:
 *         description: Internal server error
 */
router.patch('/tasks/:id/assign',
  requireScope(['Task:write', 'user/*.write']),
  asyncHandler(clinicalWorkflowController.assignTask)
);

/**
 * @swagger
 * /api/clinical-workflow/patients/{patientId}/tasks:
 *   get:
 *     summary: Get tasks for a specific patient
 *     tags: [Clinical Workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by task status
 *     responses:
 *       200:
 *         description: List of patient tasks
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Internal server error
 */
router.get('/patients/:patientId/tasks',
  requireScope(['Task:read', 'user/*.read']),
  asyncHandler(clinicalWorkflowController.getTasksByPatient)
);

/**
 * @swagger
 * /api/clinical-workflow/practitioners/{practitionerId}/tasks:
 *   get:
 *     summary: Get tasks assigned to a specific practitioner
 *     tags: [Clinical Workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practitionerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Practitioner ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by task status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *         description: Filter by task priority
 *     responses:
 *       200:
 *         description: List of practitioner tasks
 *       500:
 *         description: Internal server error
 */
router.get('/practitioners/:practitionerId/tasks',
  requireScope(['Task:read', 'user/*.read']),
  asyncHandler(clinicalWorkflowController.getTasksByPractitioner)
);

/**
 * @swagger
 * /api/clinical-workflow/workflows:
 *   post:
 *     summary: Create a clinical workflow from template
 *     tags: [Clinical Workflow]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateId
 *               - patientId
 *             properties:
 *               templateId:
 *                 type: string
 *                 description: Workflow template ID
 *               patientId:
 *                 type: string
 *                 description: Patient ID
 *               encounterId:
 *                 type: string
 *                 description: Related encounter ID
 *               parameters:
 *                 type: object
 *                 description: Template parameters
 *     responses:
 *       201:
 *         description: Workflow created successfully
 *       404:
 *         description: Template or patient not found
 *       500:
 *         description: Internal server error
 */
router.post('/workflows',
  requireScope(['Task:write', 'user/*.write']),
  ...createWorkflowValidation,
  asyncHandler(clinicalWorkflowController.createClinicalWorkflow)
);

/**
 * @swagger
 * /api/clinical-workflow/templates:
 *   get:
 *     summary: Get available workflow templates
 *     tags: [Clinical Workflow]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workflow templates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 templates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WorkflowTemplate'
 *       500:
 *         description: Internal server error
 */
router.get('/templates',
  requireScope(['Task:read', 'user/*.read']),
  asyncHandler(clinicalWorkflowController.getWorkflowTemplates.bind(clinicalWorkflowController))
);

export default router;