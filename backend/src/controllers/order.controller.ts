import { ServiceRequest, MedicationRequest, Task } from '@medplum/fhirtypes';
import { Request, Response } from 'express';

import { auditService } from '../services/audit.service';
import { medplumService } from '../services/medplum.service';
import logger from '../utils/logger';

/**
 * Order Management Controller - Implements basic CPOE (Computerized Provider Order Entry)
 * Handles laboratory orders, medication orders, and imaging orders
 * All orders are FHIR-compliant resources
 */
export class OrderController {
  /**
   * Create a laboratory order
   * Creates a ServiceRequest resource for lab tests
   */
  async createLabOrder(req: Request, res: Response): Promise<void> {
    try {
      const {
        patientId,
        encounterId,
        tests, // Array of test codes
        priority = 'routine',
        notes,
        performerType,
        requestedDate
      } = req.body;

      logger.info('Creating laboratory order', {
        patientId,
        testCount: tests?.length || 0,
        priority,
        userId: req.user?.id
      });

      // Validate required fields
      if (!patientId || !tests || tests.length === 0) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'Patient ID and at least one test are required'
          }]
        });
        return;
      }

      // Verify patient exists
      try {
        await medplumService.readResource('Patient', patientId);
      } catch {
        res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: 'Patient not found'
          }]
        });
        return;
      }

      // Create ServiceRequest for lab order
      const serviceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        priority: priority as 'routine' | 'urgent' | 'asap' | 'stat',
        category: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: '108252007',
            display: 'Laboratory procedure'
          }]
        }],
        code: {
          coding: tests.map((test: { system?: string; code: string; display: string }) => ({
            system: test.system || 'http://loinc.org',
            code: test.code,
            display: test.display
          }))
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        encounter: encounterId ? {
          reference: `Encounter/${encounterId}`
        } : undefined,
        authoredOn: new Date().toISOString(),
        requester: req.user?.id ? {
          reference: `Practitioner/${req.user.id}`
        } : undefined,
        performerType: performerType ? {
          coding: [{
            system: 'http://snomed.info/sct',
            code: performerType.code,
            display: performerType.display
          }]
        } : undefined,
        occurrenceDateTime: requestedDate || new Date().toISOString(),
        note: notes ? [{
          text: notes,
          time: new Date().toISOString()
        }] : undefined
      };

      // Create the order
      const createdOrder = await medplumService.createResource(serviceRequest);

      // Create a Task to track the order fulfillment
      const task: Task = {
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
        priority: priority as 'routine' | 'urgent' | 'asap' | 'stat',
        code: {
          coding: [{
            system: 'http://hl7.org/fhir/CodeSystem/task-code',
            code: 'fulfill',
            display: 'Fulfill Order'
          }]
        },
        description: `Laboratory order: ${tests.map((t: { display: string }) => t.display).join(', ')}`,
        focus: {
          reference: `ServiceRequest/${createdOrder.id}`
        },
        for: {
          reference: `Patient/${patientId}`
        },
        authoredOn: new Date().toISOString()
      };

      const createdTask = await medplumService.createResource(task);

      // Log successful creation
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'CREATE',
        resource: 'ServiceRequest',
        resourceId: createdOrder.id || 'unknown',
        metadata: {
          outcome: 'SUCCESS',
          orderType: 'laboratory',
          testCount: tests.length,
          priority,
          taskId: createdTask.id
        }
      });

      res.status(201).json({
        order: createdOrder,
        task: createdTask
      });
    } catch (error) {
      logger.error('Failed to create laboratory order:', error);
      
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'CREATE',
        resource: 'ServiceRequest',
        resourceId: 'new',
        metadata: {
          outcome: 'FAILURE',
          orderType: 'laboratory',
          error: (error as Error).message
        }
      });

      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to create laboratory order'
        }]
      });
    }
  }

  /**
   * Create a medication order
   * Creates a MedicationRequest resource
   */
  async createMedicationOrder(req: Request, res: Response): Promise<void> {
    try {
      const {
        patientId,
        encounterId,
        medicationCode,
        dosageInstructions,
        quantity,
        refills,
        priority = 'routine',
        notes,
        substitutionAllowed = true
      } = req.body;

      logger.info('Creating medication order', {
        patientId,
        medicationCode: medicationCode?.display,
        userId: req.user?.id
      });

      // Validate required fields
      if (!patientId || !medicationCode || !dosageInstructions) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'Patient ID, medication code, and dosage instructions are required'
          }]
        });
        return;
      }

      // Verify patient exists
      try {
        await medplumService.readResource('Patient', patientId);
      } catch {
        res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: 'Patient not found'
          }]
        });
        return;
      }

      // Create MedicationRequest
      const medicationRequest: MedicationRequest = {
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        priority: priority as 'routine' | 'urgent' | 'asap' | 'stat',
        medicationCodeableConcept: {
          coding: [{
            system: medicationCode.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: medicationCode.code,
            display: medicationCode.display
          }]
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        encounter: encounterId ? {
          reference: `Encounter/${encounterId}`
        } : undefined,
        authoredOn: new Date().toISOString(),
        requester: req.user?.id ? {
          reference: `Practitioner/${req.user.id}`
        } : undefined,
        dosageInstruction: [{
          text: dosageInstructions.text,
          timing: dosageInstructions.timing,
          route: dosageInstructions.route ? {
            coding: [{
              system: 'http://snomed.info/sct',
              code: dosageInstructions.route.code,
              display: dosageInstructions.route.display
            }]
          } : undefined,
          doseAndRate: dosageInstructions.doseAndRate ? [{
            doseQuantity: {
              value: dosageInstructions.doseAndRate.value,
              unit: dosageInstructions.doseAndRate.unit,
              system: 'http://unitsofmeasure.org',
              code: dosageInstructions.doseAndRate.code
            }
          }] : undefined
        }],
        dispenseRequest: {
          quantity: quantity ? {
            value: quantity.value,
            unit: quantity.unit,
            system: 'http://unitsofmeasure.org',
            code: quantity.code
          } : undefined,
          numberOfRepeatsAllowed: refills || 0
        },
        substitution: {
          allowedBoolean: substitutionAllowed
        },
        note: notes ? [{
          text: notes,
          time: new Date().toISOString()
        }] : undefined
      };

      // Create the order
      const createdOrder = await medplumService.createResource(medicationRequest);

      // Log successful creation
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'CREATE',
        resource: 'MedicationRequest',
        resourceId: createdOrder.id || 'unknown',
        metadata: {
          outcome: 'SUCCESS',
          orderType: 'medication',
          medication: medicationCode.display,
          priority
        }
      });

      res.status(201).json(createdOrder);
    } catch (error) {
      logger.error('Failed to create medication order:', error);
      
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'CREATE',
        resource: 'MedicationRequest',
        resourceId: 'new',
        metadata: {
          outcome: 'FAILURE',
          orderType: 'medication',
          error: (error as Error).message
        }
      });

      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to create medication order'
        }]
      });
    }
  }

  /**
   * Create an imaging order
   * Creates a ServiceRequest resource for imaging studies
   */
  async createImagingOrder(req: Request, res: Response): Promise<void> {
    try {
      const {
        patientId,
        encounterId,
        imagingType, // e.g., X-ray, CT, MRI
        bodyPart,
        indication,
        priority = 'routine',
        notes,
        requestedDate
      } = req.body;

      logger.info('Creating imaging order', {
        patientId,
        imagingType: imagingType?.display,
        bodyPart: bodyPart?.display,
        userId: req.user?.id
      });

      // Validate required fields
      if (!patientId || !imagingType) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'Patient ID and imaging type are required'
          }]
        });
        return;
      }

      // Verify patient exists
      try {
        await medplumService.readResource('Patient', patientId);
      } catch {
        res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: 'Patient not found'
          }]
        });
        return;
      }

      // Create ServiceRequest for imaging order
      const serviceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        priority: priority as 'routine' | 'urgent' | 'asap' | 'stat',
        category: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: '363679005',
            display: 'Imaging'
          }]
        }],
        code: {
          coding: [{
            system: imagingType.system || 'http://loinc.org',
            code: imagingType.code,
            display: imagingType.display
          }]
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        encounter: encounterId ? {
          reference: `Encounter/${encounterId}`
        } : undefined,
        authoredOn: new Date().toISOString(),
        requester: req.user?.id ? {
          reference: `Practitioner/${req.user.id}`
        } : undefined,
        bodySite: bodyPart ? [{
          coding: [{
            system: bodyPart.system || 'http://snomed.info/sct',
            code: bodyPart.code,
            display: bodyPart.display
          }]
        }] : undefined,
        reasonCode: indication ? [{
          text: indication
        }] : undefined,
        occurrenceDateTime: requestedDate || new Date().toISOString(),
        note: notes ? [{
          text: notes,
          time: new Date().toISOString()
        }] : undefined
      };

      // Create the order
      const createdOrder = await medplumService.createResource(serviceRequest);

      // Create a Task to track the order fulfillment
      const task: Task = {
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
        priority: priority as 'routine' | 'urgent' | 'asap' | 'stat',
        code: {
          coding: [{
            system: 'http://hl7.org/fhir/CodeSystem/task-code',
            code: 'fulfill',
            display: 'Fulfill Order'
          }]
        },
        description: `Imaging order: ${imagingType.display}${bodyPart ? ` - ${bodyPart.display}` : ''}`,
        focus: {
          reference: `ServiceRequest/${createdOrder.id}`
        },
        for: {
          reference: `Patient/${patientId}`
        },
        authoredOn: new Date().toISOString()
      };

      const createdTask = await medplumService.createResource(task);

      // Log successful creation
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'CREATE',
        resource: 'ServiceRequest',
        resourceId: createdOrder.id || 'unknown',
        metadata: {
          outcome: 'SUCCESS',
          orderType: 'imaging',
          imagingType: imagingType.display,
          priority,
          taskId: createdTask.id
        }
      });

      res.status(201).json({
        order: createdOrder,
        task: createdTask
      });
    } catch (error) {
      logger.error('Failed to create imaging order:', error);
      
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'CREATE',
        resource: 'ServiceRequest',
        resourceId: 'new',
        metadata: {
          outcome: 'FAILURE',
          orderType: 'imaging',
          error: (error as Error).message
        }
      });

      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to create imaging order'
        }]
      });
    }
  }

  /**
   * Get orders for a patient
   * Retrieves both ServiceRequests and MedicationRequests
   */
  async getPatientOrders(req: Request, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const { status, type, _count = '20', _offset = '0' } = req.query as { [key: string]: string };
      
      if (!patientId) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'Patient ID is required'
          }]
        });
        return;
      }

      logger.info('Fetching patient orders', {
        patientId,
        status,
        type,
        userId: req.user?.id
      });

      // Verify patient exists
      try {
        await medplumService.readResource('Patient', patientId);
      } catch {
        res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: 'Patient not found'
          }]
        });
        return;
      }

      const orders: unknown[] = [];

      // Fetch ServiceRequests (lab and imaging orders)
      if (!type || type === 'service' || type === 'lab' || type === 'imaging') {
        const serviceRequestParams: Record<string, string> = {
          patient: patientId,
          _count: _count || '20',
          _offset: _offset || '0',
          _sort: '-authored'
        };
        if (status) serviceRequestParams.status = status;

        const serviceRequests = await medplumService.searchResources<ServiceRequest>('ServiceRequest', serviceRequestParams);
        if (serviceRequests.entry) {
          orders.push(...serviceRequests.entry.map(e => ({
            ...e.resource,
            orderType: 'service'
          })));
        }
      }

      // Fetch MedicationRequests
      if (!type || type === 'medication') {
        const medicationRequestParams: Record<string, string> = {
          patient: patientId,
          _count: _count || '20',
          _offset: _offset || '0',
          _sort: '-authored'
        };
        if (status) medicationRequestParams.status = status;

        const medicationRequests = await medplumService.searchResources<MedicationRequest>('MedicationRequest', medicationRequestParams);
        if (medicationRequests.entry) {
          orders.push(...medicationRequests.entry.map(e => ({
            ...e.resource,
            orderType: 'medication'
          })));
        }
      }

      // Sort all orders by date
      orders.sort((a, b) => {
        const dateA = new Date(a.authoredOn || 0).getTime();
        const dateB = new Date(b.authoredOn || 0).getTime();
        return dateB - dateA;
      });

      // Log successful retrieval
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'READ',
        resource: 'Orders',
        resourceId: patientId,
        metadata: {
          outcome: 'SUCCESS',
          orderCount: orders.length,
          type: type || 'all'
        }
      });

      res.json({
        orders,
        total: orders.length
      });
    } catch (error) {
      logger.error('Failed to fetch patient orders:', error);
      
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'READ',
        resource: 'Orders',
        resourceId: req.params.patientId,
        metadata: {
          outcome: 'FAILURE',
          error: (error as Error).message
        }
      });

      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to fetch patient orders'
        }]
      });
    }
  }

  /**
   * Update order status
   * Updates the status of a ServiceRequest or MedicationRequest
   */
  async updateOrderStatus(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, resourceType } = req.params;
      const { status, notes } = req.body;

      logger.info('Updating order status', {
        orderId,
        resourceType,
        newStatus: status,
        userId: req.user?.id
      });

      // Validate resource type
      if (!['ServiceRequest', 'MedicationRequest'].includes(resourceType)) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Invalid resource type. Must be ServiceRequest or MedicationRequest'
          }]
        });
        return;
      }

      // Validate status
      const validStatuses = ['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            diagnostics: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
          }]
        });
        return;
      }

      // Get the current order
      const order = await medplumService.readResource(resourceType as 'ServiceRequest' | 'MedicationRequest', orderId as string);

      // Update the order based on type
      let updatedOrder: ServiceRequest | MedicationRequest;
      if (resourceType === 'ServiceRequest') {
        const serviceRequest = order as ServiceRequest;
        updatedOrder = {
          ...serviceRequest,
          status,
          note: notes ? [
            ...(serviceRequest.note || []),
          {
            text: notes,
            time: new Date().toISOString(),
            authorReference: req.user?.id ? {
              reference: `Practitioner/${req.user.id}`
            } : undefined
          }
        ] : serviceRequest.note
        } as ServiceRequest;
      } else {
        const medicationRequest = order as MedicationRequest;
        updatedOrder = {
          ...medicationRequest,
          status,
          note: notes ? [
            ...(medicationRequest.note || []),
            {
              text: notes,
              time: new Date().toISOString(),
              authorReference: req.user?.id ? {
                reference: `Practitioner/${req.user.id}`
              } : undefined
            }
          ] : medicationRequest.note
        } as MedicationRequest;
      }

      const savedOrder = await medplumService.updateResource(updatedOrder);

      // Log successful update
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'UPDATE',
        resource: resourceType,
        resourceId: orderId,
        metadata: {
          outcome: 'SUCCESS',
          oldStatus: (order as ServiceRequest | MedicationRequest).status,
          newStatus: status
        }
      });

      res.json(savedOrder);
    } catch (error) {
      logger.error('Failed to update order status:', error);
      
      const isNotFound = (error as Error).message?.includes('not found');
      
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'UPDATE',
        resource: req.params.resourceType,
        resourceId: req.params.orderId,
        metadata: {
          outcome: 'FAILURE',
          error: (error as Error).message
        }
      });

      if (isNotFound) {
        res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: 'Order not found'
          }]
        });
      } else {
        res.status(500).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'exception',
            diagnostics: 'Failed to update order status'
          }]
        });
      }
    }
  }

  /**
   * Cancel an order
   * Sets the order status to 'revoked' with a reason
   */
  async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, resourceType } = req.params;
      const { reason } = req.body;

      logger.info('Cancelling order', {
        orderId,
        resourceType,
        reason,
        userId: req.user?.id
      });

      // Use updateOrderStatus internally
      req.body = {
        status: 'revoked',
        notes: `Order cancelled: ${reason || 'No reason provided'}`
      };

      await this.updateOrderStatus(req, res);
    } catch {
      // Error handling is done in updateOrderStatus
    }
  }
}

// Export singleton instance
export const orderController = new OrderController();