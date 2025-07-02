/**
 * Version Router Service  
 * Routes requests based on API version
 */

import { Request, Response, NextFunction, Router, RequestHandler } from 'express';

export interface VersionConfig {
  version: string;
  handler: Router | RequestHandler;
  deprecated?: boolean;
  deprecationDate?: Date;
}

export class VersionRouter {
  private versions: Map<string, VersionConfig> = new Map();
  private defaultVersion: string = 'v1';

  addVersion(config: VersionConfig): void {
    this.versions.set(config.version, config);
  }

  setDefaultVersion(version: string): void {
    this.defaultVersion = version;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Extract version from header, query param, or URL path
      const versionHeader = req.header('api-version');
      const versionQuery = req.query.version as string;
      const versionPath = req.path.match(/^\/v(\d+)/)?.[0];

      const requestedVersion = versionHeader || versionQuery || versionPath || `v${this.defaultVersion}`;
      
      // Clean up version format
      const version = requestedVersion.startsWith('v') ? requestedVersion : `v${requestedVersion}`;
      
      const versionConfig = this.versions.get(version);
      
      if (!versionConfig) {
        res.status(400).json({
          error: 'Unsupported API version',
          supportedVersions: Array.from(this.versions.keys())
        });
        return;
      }

      // Add deprecation warning if needed
      if (versionConfig.deprecated) {
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', versionConfig.deprecationDate?.toISOString() || '');
      }

      // Set version in request for later use (now type-safe)
      req.apiVersion = version;
      
      // Route to version-specific handler
      const handler = versionConfig.handler;
      if (typeof handler === 'function') {
        // It's a RequestHandler function
        handler(req, res, next);
      } else {
        // It's a Router, use it as middleware
        (handler as Router)(req, res, next);
      }
    };
  }

  getVersions(): string[] {
    return Array.from(this.versions.keys());
  }
}

export const versionRouter = new VersionRouter();

// Alias for backward compatibility
export { VersionRouter as ApiVersionRouter };