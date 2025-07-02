/**
 * OmniCare EMR Backend - Enhanced Compression Middleware
 * Advanced compression strategies for optimal API performance
 */

import zlib from 'zlib';

import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

import { redisCacheService } from '../services/redis-cache.service';
import logger from '../utils/logger';


export interface CompressionConfig {
  level?: number;
  threshold?: number;
  filter?: (req: Request, res: Response) => boolean;
  enableBrotli?: boolean;
  enablePrecompression?: boolean;
  cacheCompressed?: boolean;
  adaptiveCompression?: boolean;
}

/**
 * Enhanced compression middleware with adaptive compression levels
 */
export function createEnhancedCompression(config: CompressionConfig = {}) {
  const options = {
    level: 6, // Default compression level (1-9)
    threshold: 1024, // Only compress responses > 1KB
    enableBrotli: true,
    enablePrecompression: true,
    cacheCompressed: true,
    adaptiveCompression: true,
    ...config,
  };

  return [
    // Adaptive compression middleware
    adaptiveCompressionMiddleware(options),
    
    // Standard compression with optimized settings
    compression({
      level: options.level,
      threshold: options.threshold,
      filter: options.filter || defaultCompressionFilter,
      
      // Custom compression strategy
      strategy: zlib.constants.Z_DEFAULT_STRATEGY,
      
      // Memory level optimization
      memLevel: 8,
      
      // Window bits for optimal compression
      windowBits: 15,
    }),
  ];
}

/**
 * Adaptive compression middleware that adjusts compression based on content and client
 */
function adaptiveCompressionMiddleware(options: CompressionConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if client supports Brotli
      const acceptEncoding = req.headers['accept-encoding'] || '';
      const supportsBrotli = options.enableBrotli && acceptEncoding.includes('br');
      const supportsGzip = acceptEncoding.includes('gzip');

      // Store compression preferences
      (req as any).compressionPrefs = {
        supportsBrotli,
        supportsGzip,
        preferredEncoding: supportsBrotli ? 'br' : supportsGzip ? 'gzip' : null,
      };

      // Check for pre-compressed content in cache
      if (options.cacheCompressed && req.method === 'GET') {
        const cacheKey = `compressed:${req.path}:${req.get('Accept-Encoding') || 'none'}`;
        const cachedCompressed = await redisCacheService.get(cacheKey);
        
        if (cachedCompressed) {
          const data = cachedCompressed as any;
          res.setHeader('Content-Encoding', data.encoding);
          res.setHeader('Content-Type', data.contentType);
          res.setHeader('X-Compressed-Cache', 'HIT');
          res.send(Buffer.from(data.content, 'base64'));
          return;
        }
      }

      // Intercept response for adaptive compression
      if (options.adaptiveCompression) {
        interceptResponseForAdaptiveCompression(req, res, options);
      }

      next();
    } catch (error) {
      logger.error('Error in adaptive compression middleware:', error);
      next();
    }
  };
}

/**
 * Intercept response for adaptive compression
 */
function interceptResponseForAdaptiveCompression(
  req: Request,
  res: Response,
  options: CompressionConfig
): void {
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function(data: any) {
    return handleAdaptiveCompression(this, req, data, options, originalSend);
  };

  res.json = function(data: any) {
    const jsonData = JSON.stringify(data);
    return handleAdaptiveCompression(this, req, jsonData, options, originalSend);
  };
}

/**
 * Handle adaptive compression based on content analysis
 */
function handleAdaptiveCompression(
  res: Response,
  req: Request,
  data: any,
  options: CompressionConfig,
  originalSend: Function
): Response {
  try {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    const contentSize = Buffer.byteLength(content, 'utf8');
    const compressionPrefs = (req as any).compressionPrefs;

    // Skip compression for small content
    if (contentSize < (options.threshold || 1024)) {
      return originalSend.call(res, data);
    }

    // Analyze content for optimal compression strategy
    const compressionStrategy = analyzeCompressionStrategy(content, contentSize);
    
    // Apply adaptive compression if supported
    if (compressionPrefs?.preferredEncoding && compressionStrategy.shouldCompress) {
      return applyCompressionAndCache(
        res,
        req,
        content,
        compressionPrefs.preferredEncoding,
        compressionStrategy.level,
        options
      );
    }

    return originalSend.call(res, data);
  } catch (error) {
    logger.error('Error in adaptive compression handler:', error);
    return originalSend.call(res, data);
  }
}

/**
 * Analyze content to determine optimal compression strategy
 */
function analyzeCompressionStrategy(content: string, contentSize: number): {
  shouldCompress: boolean;
  level: number;
  estimatedRatio: number;
} {
  // JSON content typically compresses well
  let shouldCompress = true;
  let level = 6; // Default level
  let estimatedRatio = 0.7; // Estimated 70% compression

  try {
    // Analyze content characteristics
    const jsonData = JSON.parse(content);
    
    // Check for repetitive data (better compression)
    const contentStr = JSON.stringify(jsonData);
    const uniqueChars = new Set(contentStr).size;
    const repetitionRatio = uniqueChars / contentStr.length;

    if (repetitionRatio < 0.1) {
      // Highly repetitive data - use higher compression
      level = 9;
      estimatedRatio = 0.8;
    } else if (repetitionRatio < 0.3) {
      // Moderately repetitive - standard high compression
      level = 7;
      estimatedRatio = 0.75;
    } else if (repetitionRatio > 0.7) {
      // Low repetition - use lighter compression for speed
      level = 4;
      estimatedRatio = 0.6;
    }

    // Large arrays of similar objects compress very well
    if (Array.isArray(jsonData) && jsonData.length > 10) {
      level = Math.max(level, 7);
      estimatedRatio = Math.max(estimatedRatio, 0.75);
    }

    // FHIR resources have predictable structure - good compression
    if (contentStr.includes('resourceType') || contentStr.includes('fhir')) {
      level = Math.max(level, 6);
      estimatedRatio = Math.max(estimatedRatio, 0.7);
    }

  } catch {
    // Not JSON or parsing error - use default settings
  }

  // Don't compress if estimated savings are minimal
  if (estimatedRatio > 0.9 || contentSize < 2048) {
    shouldCompress = false;
  }

  return { shouldCompress, level, estimatedRatio };
}

/**
 * Apply compression and cache the result
 */
function applyCompressionAndCache(
  res: Response,
  req: Request,
  content: string,
  encoding: string,
  level: number,
  options: CompressionConfig
): Response {
  try {
    const buffer = Buffer.from(content, 'utf8');
    let compressedBuffer: Buffer;

    // Apply compression based on encoding
    if (encoding === 'br') {
      compressedBuffer = zlib.brotliCompressSync(buffer, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: Math.min(level, 11),
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
        },
      });
    } else if (encoding === 'gzip') {
      compressedBuffer = zlib.gzipSync(buffer, {
        level,
        memLevel: 8,
        strategy: zlib.constants.Z_DEFAULT_STRATEGY,
      });
    } else {
      // No compression
      return res.send(content);
    }

    // Calculate compression ratio
    const originalSize = buffer.length;
    const compressedSize = compressedBuffer.length;
    const compressionRatio = compressedSize / originalSize;

    // Set headers
    res.setHeader('Content-Encoding', encoding);
    res.setHeader('Content-Length', compressedSize.toString());
    res.setHeader('X-Compression-Ratio', compressionRatio.toFixed(3));
    res.setHeader('X-Original-Size', originalSize.toString());
    res.setHeader('X-Compressed-Size', compressedSize.toString());

    // Cache compressed content if enabled
    if (options.cacheCompressed && req.method === 'GET' && compressionRatio < 0.8) {
      const cacheKey = `compressed:${req.path}:${req.get('Accept-Encoding') || 'none'}`;
      const cacheData = {
        encoding,
        contentType: res.getHeader('Content-Type') || 'application/json',
        content: compressedBuffer.toString('base64'),
        originalSize,
        compressedSize,
        compressionRatio,
        timestamp: Date.now(),
      };

      // Cache for 5 minutes
      redisCacheService.set(cacheKey, cacheData, { ttl: 300 }).catch(error => {
        logger.error('Failed to cache compressed content:', error);
      });
    }

    // Log significant compression achievements
    if (compressionRatio < 0.5 && originalSize > 10000) {
      logger.info('High compression achieved', {
        path: req.path,
        encoding,
        originalSize,
        compressedSize,
        compressionRatio,
        savings: `${Math.round((1 - compressionRatio) * 100)}%`
      });
    }

    return res.send(compressedBuffer);
  } catch (error) {
    logger.error('Error applying compression:', error);
    return res.send(content);
  }
}

/**
 * Default compression filter - determines what to compress
 */
function defaultCompressionFilter(req: Request, res: Response): boolean {
  // Don't compress if response is already compressed
  if (res.getHeader('Content-Encoding')) {
    return false;
  }

  // Only compress specific content types
  const contentType = res.getHeader('Content-Type') as string;
  if (!contentType) {
    return false;
  }

  const compressibleTypes = [
    'application/json',
    'application/fhir+json',
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/xml',
    'text/xml',
  ];

  return compressibleTypes.some(type => contentType.includes(type));
}

/**
 * Precompression for static responses (for use with build processes)
 */
export async function precompressStaticContent(
  content: string,
  contentType: string
): Promise<{
  gzip: Buffer;
  brotli: Buffer;
  originalSize: number;
  gzipSize: number;
  brotliSize: number;
}> {
  const buffer = Buffer.from(content, 'utf8');
  
  const gzipBuffer = zlib.gzipSync(buffer, { level: 9 });
  const brotliBuffer = zlib.brotliCompressSync(buffer, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
    },
  });

  return {
    gzip: gzipBuffer,
    brotli: brotliBuffer,
    originalSize: buffer.length,
    gzipSize: gzipBuffer.length,
    brotliSize: brotliBuffer.length,
  };
}

/**
 * Get compression statistics
 */
export async function getCompressionStats(): Promise<{
  cacheHits: number;
  totalRequests: number;
  averageCompressionRatio: number;
  totalBytesSaved: number;
}> {
  try {
    const statsKey = 'compression:stats';
    const stats = await redisCacheService.get(statsKey) || {
      cacheHits: 0,
      totalRequests: 0,
      totalOriginalBytes: 0,
      totalCompressedBytes: 0,
    };

    const totalBytesSaved = (stats as any).totalOriginalBytes - (stats as any).totalCompressedBytes;
    const averageCompressionRatio = (stats as any).totalRequests > 0 
      ? (stats as any).totalCompressedBytes / (stats as any).totalOriginalBytes
      : 0;

    return {
      cacheHits: (stats as any).cacheHits,
      totalRequests: (stats as any).totalRequests,
      averageCompressionRatio,
      totalBytesSaved,
    };
  } catch (error) {
    logger.error('Failed to get compression stats:', error);
    return {
      cacheHits: 0,
      totalRequests: 0,
      averageCompressionRatio: 0,
      totalBytesSaved: 0,
    };
  }
}