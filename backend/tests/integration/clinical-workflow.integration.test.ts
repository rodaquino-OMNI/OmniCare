import { MedplumClient } from '@medplum/core';
import { Task, Patient, Practitioner } from '@medplum/fhirtypes';
import request from 'supertest';

import { app } from '@/app';

describe('Clinical Workflow Integration Tests', () => {
  let authToken: string;
  let testPatientId: string;
  let testPractitionerId: string;
  let createdTaskId: string;

  beforeAll(async () => {
    // Login and get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword',
      });

    authToken = loginResponse.body.accessToken;

    // Create test patient
    const patientResponse = await request(app)
      .post('/fhir/R4/Patient')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        resourceType: 'Patient',
        name: [{ given: ['Test'], family: 'Patient' }],
        birthDate: '1990-01-01',
        gender: 'male',
        active: true,
      });

    testPatientId = patientResponse.body.id;

    // Create test practitioner
    const practitionerResponse = await request(app)
      .post('/fhir/R4/Practitioner')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        resourceType: 'Practitioner',
        name: [{ given: ['Test'], family: 'Practitioner' }],
        active: true,
      });

    testPractitionerId = practitionerResponse.body.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (createdTaskId) {
      await request(app)
        .delete(`/fhir/R4/Task/${createdTaskId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }

    await request(app)
      .delete(`/fhir/R4/Patient/${testPatientId}`)
      .set('Authorization', `Bearer ${authToken}`);

    await request(app)
      .delete(`/fhir/R4/Practitioner/${testPractitionerId}`)
      .set('Authorization', `Bearer ${authToken}`);
  });

  describe('POST /api/clinical-workflow/tasks', () => {
    it('should create a new clinical task', async () => {
      const response = await request(app)
        .post('/api/clinical-workflow/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: testPatientId,
          practitionerId: testPractitionerId,
          description: 'Complete initial assessment',
          priority: 'urgent',
          category: 'assessment',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Task created successfully');
      expect(response.body.task).toBeDefined();
      expect(response.body.task.resourceType).toBe('Task');
      expect(response.body.task.status).toBe('requested');
      expect(response.body.task.priority).toBe('urgent');
      expect(response.body.task.description).toBe('Complete initial assessment');
      expect(response.body.task.for.reference).toBe(`Patient/${testPatientId}`);
      expect(response.body.task.owner.reference).toBe(`Practitioner/${testPractitionerId}`);

      createdTaskId = response.body.task.id;
    });

    it('should reject task creation with missing patient ID', async () => {
      const response = await request(app)
        .post('/api/clinical-workflow/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Complete initial assessment',
          priority: 'urgent',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Patient ID and description are required');
    });

    it('should reject task creation with invalid patient ID', async () => {
      const response = await request(app)
        .post('/api/clinical-workflow/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: 'invalid-patient-id',
          description: 'Complete initial assessment',
          priority: 'urgent',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Patient not found');
    });

    it('should reject task creation with invalid practitioner ID', async () => {
      const response = await request(app)
        .post('/api/clinical-workflow/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: testPatientId,
          practitionerId: 'invalid-practitioner-id',
          description: 'Complete initial assessment',
          priority: 'urgent',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Practitioner not found');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/clinical-workflow/tasks')
        .send({
          patientId: testPatientId,
          description: 'Complete initial assessment',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/clinical-workflow/tasks', () => {
    it('should fetch all tasks', async () => {
      const response = await request(app)
        .get('/api/clinical-workflow/tasks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tasks).toBeDefined();
      expect(Array.isArray(response.body.tasks)).toBe(true);
      expect(response.body.total).toBeDefined();
    });

    it('should filter tasks by status', async () => {
      const response = await request(app)
        .get('/api/clinical-workflow/tasks?status=requested')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tasks).toBeDefined();
      expect(response.body.tasks.every((task: Task) => task.status === 'requested')).toBe(true);
    });

    it('should filter tasks by priority', async () => {
      const response = await request(app)
        .get('/api/clinical-workflow/tasks?priority=urgent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tasks).toBeDefined();
      expect(response.body.tasks.every((task: Task) => task.priority === 'urgent')).toBe(true);
    });

    it('should filter tasks by patient', async () => {
      const response = await request(app)
        .get(`/api/clinical-workflow/tasks?patient=${testPatientId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tasks).toBeDefined();
      expect(response.body.tasks.every((task: Task) => 
        task.for?.reference === `Patient/${testPatientId}`
      )).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/clinical-workflow/tasks');

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/clinical-workflow/tasks/:id/status', () => {
    it('should update task status', async () => {
      const response = await request(app)
        .patch(`/api/clinical-workflow/tasks/${createdTaskId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'in-progress',
          note: 'Started working on assessment',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Task status updated successfully');
      expect(response.body.task.status).toBe('in-progress');
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .patch(`/api/clinical-workflow/tasks/${createdTaskId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'invalid-status',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid status');
      expect(response.body.validStatuses).toBeDefined();
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .patch('/api/clinical-workflow/tasks/non-existent-id/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'completed',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Task not found');
    });
  });

  describe('PATCH /api/clinical-workflow/tasks/:id/assign', () => {
    it('should assign task to practitioner', async () => {
      const response = await request(app)
        .patch(`/api/clinical-workflow/tasks/${createdTaskId}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          practitionerId: testPractitionerId,
          note: 'Assigning to specialist',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Task assigned successfully');
      expect(response.body.task.owner.reference).toBe(`Practitioner/${testPractitionerId}`);
    });

    it('should unassign task when practitionerId is null', async () => {
      const response = await request(app)
        .patch(`/api/clinical-workflow/tasks/${createdTaskId}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          practitionerId: null,
          note: 'Unassigning task',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Task assigned successfully');
      expect(response.body.task.owner).toBeUndefined();
    });

    it('should return 404 for invalid practitioner', async () => {
      const response = await request(app)
        .patch(`/api/clinical-workflow/tasks/${createdTaskId}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          practitionerId: 'invalid-practitioner-id',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Practitioner not found');
    });
  });

  describe('GET /api/clinical-workflow/patients/:patientId/tasks', () => {
    it('should fetch tasks for specific patient', async () => {
      const response = await request(app)
        .get(`/api/clinical-workflow/patients/${testPatientId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tasks).toBeDefined();
      expect(Array.isArray(response.body.tasks)).toBe(true);
      expect(response.body.tasks.every((task: Task) => 
        task.for?.reference === `Patient/${testPatientId}`
      )).toBe(true);
    });

    it('should return 404 for non-existent patient', async () => {
      const response = await request(app)
        .get('/api/clinical-workflow/patients/non-existent-patient/tasks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Patient not found');
    });
  });

  describe('GET /api/clinical-workflow/practitioners/:practitionerId/tasks', () => {
    it('should fetch tasks for specific practitioner', async () => {
      // First assign the task to the practitioner
      await request(app)
        .patch(`/api/clinical-workflow/tasks/${createdTaskId}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          practitionerId: testPractitionerId,
        });

      const response = await request(app)
        .get(`/api/clinical-workflow/practitioners/${testPractitionerId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tasks).toBeDefined();
      expect(Array.isArray(response.body.tasks)).toBe(true);
      expect(response.body.tasks.every((task: Task) => 
        task.owner?.reference === `Practitioner/${testPractitionerId}`
      )).toBe(true);
    });
  });

  describe('GET /api/clinical-workflow/templates', () => {
    it('should fetch workflow templates', async () => {
      const response = await request(app)
        .get('/api/clinical-workflow/templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.templates).toBeDefined();
      expect(Array.isArray(response.body.templates)).toBe(true);
      expect(response.body.templates.length).toBeGreaterThan(0);

      // Check structure of first template
      const template = response.body.templates[0];
      expect(template.id).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.description).toBeDefined();
      expect(template.tasks).toBeDefined();
      expect(Array.isArray(template.tasks)).toBe(true);
    });
  });

  describe('POST /api/clinical-workflow/workflows', () => {
    it('should create workflow from template', async () => {
      const response = await request(app)
        .post('/api/clinical-workflow/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          templateId: 'admission-workflow',
          patientId: testPatientId,
          parameters: {
            urgency: 'high',
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Clinical workflow created successfully');
      expect(response.body.tasks).toBeDefined();
      expect(Array.isArray(response.body.tasks)).toBe(true);
      expect(response.body.tasks.length).toBeGreaterThan(0);
      expect(response.body.workflow).toBeDefined();

      // Verify all tasks are for the correct patient
      expect(response.body.tasks.every((task: Task) => 
        task.for?.reference === `Patient/${testPatientId}`
      )).toBe(true);

      // Clean up created tasks
      for (const task of response.body.tasks) {
        await request(app)
          .delete(`/fhir/R4/Task/${task.id}`)
          .set('Authorization', `Bearer ${authToken}`);
      }
    });

    it('should return 404 for invalid template', async () => {
      const response = await request(app)
        .post('/api/clinical-workflow/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          templateId: 'non-existent-template',
          patientId: testPatientId,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Workflow template not found');
    });

    it('should return 404 for invalid patient', async () => {
      const response = await request(app)
        .post('/api/clinical-workflow/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          templateId: 'admission-workflow',
          patientId: 'invalid-patient-id',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Patient not found');
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting to workflow endpoints', async () => {
      // Make multiple requests to test rate limiting
      const promises = Array.from({ length: 102 }, (_, i) =>
        request(app)
          .get('/api/clinical-workflow/tasks')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);
      
      // Some responses should be rate limited (429)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 15000); // Increase timeout for this test
  });

  describe('Authorization', () => {
    it('should require proper scopes for task creation', async () => {
      // This test would require a more complex setup with different user roles
      // For now, we just test that authentication is required
      const response = await request(app)
        .post('/api/clinical-workflow/tasks')
        .send({
          patientId: testPatientId,
          description: 'Test task',
        });

      expect(response.status).toBe(401);
    });
  });
});