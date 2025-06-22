import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import crypto from 'crypto';

const router = Router();

/**
 * Health check endpoint for latency measurements
 * This endpoint is lightweight and responds quickly
 */
router.head('/health', (req: Request, res: Response) => {
  res.status(200).end();
});

router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Bandwidth test endpoint
 * Generates data of specified size for bandwidth measurements
 */
router.get('/bandwidth-test', (req: Request, res: Response) => {
  const size = parseInt(req.query.size as string) || 100 * 1024; // Default 100KB
  const maxSize = 10 * 1024 * 1024; // Max 10MB
  
  if (size > maxSize) {
    return res.status(400).json({
      error: 'Requested size exceeds maximum allowed (10MB)',
    });
  }

  // Generate random data of specified size
  const data = crypto.randomBytes(size);
  
  // Set headers to prevent caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', size.toString());
  
  res.send(data);
  return;
});

/**
 * Network quality test endpoint
 * Performs multiple checks and returns comprehensive network metrics
 */
router.get('/network-quality', authenticateToken, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  // Simulate some processing to measure real-world latency
  await new Promise(resolve => setTimeout(resolve, 10));
  
  const metrics = {
    serverTime: new Date().toISOString(),
    processingTime: Date.now() - startTime,
    headers: {
      userAgent: req.headers['user-agent'],
      acceptEncoding: req.headers['accept-encoding'],
      connection: req.headers['connection'],
    },
    connection: {
      remoteAddress: req.ip,
      encrypted: req.secure,
      protocol: req.protocol,
    },
  };
  
  res.json(metrics);
});

/**
 * Connection test endpoint with configurable delay
 * Useful for testing timeout and retry behavior
 */
router.get('/connection-test', async (req: Request, res: Response) => {
  const delay = parseInt(req.query.delay as string) || 0;
  const shouldFail = req.query.fail === 'true';
  
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  if (shouldFail) {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      retryAfter: 5,
    });
  }
  
  res.json({
    success: true,
    delay,
    timestamp: new Date().toISOString(),
  });
  return;
});

/**
 * Simulate various network conditions for testing
 */
router.post('/simulate-condition', authenticateToken, async (req: Request, res: Response) => {
  const { condition, duration = 5000 } = req.body;
  
  switch (condition) {
    case 'slow':
      // Simulate slow response
      await new Promise(resolve => setTimeout(resolve, 3000));
      res.json({ condition: 'slow', applied: true });
      break;
      
    case 'timeout':
      // Simulate timeout by delaying beyond typical timeout threshold
      await new Promise(resolve => setTimeout(resolve, 35000));
      res.json({ condition: 'timeout', applied: true });
      break;
      
    case 'error':
      // Simulate server error
      res.status(500).json({ error: 'Simulated server error' });
      break;
      
    case 'offline':
      // Simulate offline by not responding
      req.socket.destroy();
      break;
      
    default:
      res.status(400).json({ error: 'Invalid condition' });
      break;
  }
});

/**
 * Get current server network stats
 */
router.get('/stats', authenticateToken, (req: Request, res: Response) => {
  const stats = {
    timestamp: new Date().toISOString(),
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      load: process.cpuUsage(),
    },
    connections: {
      // These would come from your connection tracking middleware
      active: 0,
      total: 0,
      avgResponseTime: 0,
    },
  };
  
  res.json(stats);
});

export default router;