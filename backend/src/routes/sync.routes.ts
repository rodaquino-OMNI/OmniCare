import { Router } from 'express';
import { syncController } from '@/controllers/sync.controller';
import { authenticate } from '@/middleware/auth.middleware';
// import { validate } from '@/middleware/validation.middleware';
import { RateLimiters } from '@/middleware/rate-limit.middleware';

const router = Router();

// Apply authentication to all sync routes
router.use(authenticate);

// Apply rate limiting to prevent abuse
const syncRateLimiter = RateLimiters.auth;

/**
 * @swagger
 * /api/sync:
 *   post:
 *     summary: Synchronize offline data
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operations
 *               - clientId
 *             properties:
 *               operations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     resourceType:
 *                       type: string
 *                     resourceId:
 *                       type: string
 *                     operation:
 *                       type: string
 *                       enum: [create, update, delete]
 *                     resource:
 *                       type: object
 *                     version:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *               lastSyncTimestamp:
 *                 type: string
 *               syncToken:
 *                 type: string
 *               clientId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sync completed successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many requests
 */
router.post('/', syncRateLimiter, syncController.sync.bind(syncController));

/**
 * @swagger
 * /api/sync/batch:
 *   post:
 *     summary: Batch synchronize multiple clients
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requests
 *             properties:
 *               requests:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Batch sync completed
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
router.post('/batch', syncRateLimiter, syncController.batchSync.bind(syncController));

/**
 * @swagger
 * /api/sync/status/{clientId}:
 *   get:
 *     summary: Get sync status for a client
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client identifier
 *     responses:
 *       200:
 *         description: Sync status retrieved
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Client not found
 */
router.get('/status/:clientId', syncController.getSyncStatus.bind(syncController));

/**
 * @swagger
 * /api/sync/validate-token:
 *   post:
 *     summary: Validate sync token
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token validation result
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/validate-token', syncController.validateToken.bind(syncController));

/**
 * @swagger
 * /api/sync/resolve-conflict:
 *   post:
 *     summary: Resolve a sync conflict
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conflictId
 *               - strategy
 *               - winningResource
 *             properties:
 *               conflictId:
 *                 type: string
 *               strategy:
 *                 type: string
 *                 enum: [local-wins, remote-wins, last-write-wins, merge, manual]
 *               winningResource:
 *                 type: object
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conflict resolved
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conflict not found
 */
router.post('/resolve-conflict', syncController.resolveConflict.bind(syncController));

/**
 * @swagger
 * /api/sync/conflicts:
 *   get:
 *     summary: Get pending sync conflicts
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: resolved
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include resolved conflicts
 *     responses:
 *       200:
 *         description: List of conflicts
 *       401:
 *         description: Unauthorized
 */
router.get('/conflicts', syncController.getConflicts.bind(syncController));

/**
 * @swagger
 * /api/sync/config:
 *   get:
 *     summary: Get sync configuration
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync configuration
 *       401:
 *         description: Unauthorized
 */
router.get('/config', syncController.getConfig.bind(syncController));

/**
 * @swagger
 * /api/sync/health:
 *   get:
 *     summary: Check sync service health
 *     tags: [Sync]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service unavailable
 */
router.get('/health', syncController.healthCheck.bind(syncController));

export default router;