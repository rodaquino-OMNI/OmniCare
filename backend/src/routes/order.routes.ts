import { Router } from 'express';

import { orderController } from '../controllers/order.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateRequest, body, param, query } from '../middleware/validation.middleware';

const router = Router();

// All order routes require authentication
router.use(authenticate);

// Create laboratory order
router.post(
  '/lab',
  [
    body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
    body('tests').isArray({ min: 1 }).withMessage('At least one test is required'),
    body('tests.*.code').isString().notEmpty().withMessage('Test code is required'),
    body('tests.*.display').isString().notEmpty().withMessage('Test display name is required'),
    body('priority').optional().isIn(['routine', 'urgent', 'asap', 'stat']).withMessage('Invalid priority'),
    body('notes').optional().isString(),
    body('requestedDate').optional().isISO8601().withMessage('Invalid date format'),
    validateRequest
  ],
  orderController.createLabOrder.bind(orderController)
);

// Create medication order
router.post(
  '/medication',
  [
    body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
    body('medicationCode').isObject().withMessage('Medication code is required'),
    body('medicationCode.code').isString().notEmpty().withMessage('Medication code is required'),
    body('medicationCode.display').isString().notEmpty().withMessage('Medication display name is required'),
    body('dosageInstructions').isObject().withMessage('Dosage instructions are required'),
    body('dosageInstructions.text').isString().notEmpty().withMessage('Dosage text is required'),
    body('priority').optional().isIn(['routine', 'urgent', 'asap', 'stat']).withMessage('Invalid priority'),
    body('substitutionAllowed').optional().isBoolean(),
    body('notes').optional().isString(),
    validateRequest
  ],
  orderController.createMedicationOrder.bind(orderController)
);

// Create imaging order
router.post(
  '/imaging',
  [
    body('patientId').isString().notEmpty().withMessage('Patient ID is required'),
    body('imagingType').isObject().withMessage('Imaging type is required'),
    body('imagingType.code').isString().notEmpty().withMessage('Imaging type code is required'),
    body('imagingType.display').isString().notEmpty().withMessage('Imaging type display name is required'),
    body('bodyPart').optional().isObject(),
    body('indication').optional().isString(),
    body('priority').optional().isIn(['routine', 'urgent', 'asap', 'stat']).withMessage('Invalid priority'),
    body('notes').optional().isString(),
    body('requestedDate').optional().isISO8601().withMessage('Invalid date format'),
    validateRequest
  ],
  orderController.createImagingOrder.bind(orderController)
);

// Get patient orders
router.get(
  '/patient/:patientId',
  [
    param('patientId').isString().notEmpty().withMessage('Patient ID is required'),
    query('status').optional().isString(),
    query('type').optional().isIn(['service', 'medication', 'lab', 'imaging', 'all']),
    query('_count').optional().isInt({ min: 1, max: 100 }).withMessage('Count must be between 1 and 100'),
    query('_offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    validateRequest
  ],
  orderController.getPatientOrders.bind(orderController)
);

// Update order status
router.patch(
  '/:resourceType/:orderId/status',
  [
    param('resourceType').isIn(['ServiceRequest', 'MedicationRequest']).withMessage('Invalid resource type'),
    param('orderId').isString().notEmpty().withMessage('Order ID is required'),
    body('status').isIn(['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown']).withMessage('Invalid status'),
    body('notes').optional().isString(),
    validateRequest
  ],
  orderController.updateOrderStatus.bind(orderController)
);

// Cancel an order
router.post(
  '/:resourceType/:orderId/cancel',
  [
    param('resourceType').isIn(['ServiceRequest', 'MedicationRequest']).withMessage('Invalid resource type'),
    param('orderId').isString().notEmpty().withMessage('Order ID is required'),
    body('reason').optional().isString(),
    validateRequest
  ],
  orderController.cancelOrder.bind(orderController)
);

export { router as orderRoutes };