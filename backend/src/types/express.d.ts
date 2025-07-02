import 'express';
import type { AccessDecision, PatientConsent } from '../services/access-control.service';

import type { User, SessionInfo, Permission, UserRole } from './auth.types';

// Unified Express namespace extensions
declare global {
  namespace Express {
    interface Request {
      // Request tracking
      id?: string;
      requestId?: string;
      
      // Authentication
      user?: User & {
        scope?: string[];
        patient?: string;
        encounter?: string;
        clientId?: string;
        permissions?: string[];
      };
      session?: SessionInfo;
      token?: string;
      userId?: string;
      sessionID?: string;
      authType?: 'jwt' | 'smart' | 'api-key';
      
      // API Version
      apiVersion?: string;
      
      // SMART on FHIR
      smartAuth?: {
        id: string;
        sub: string;
        scope: string[];
        patient?: string;
        encounter?: string;
        fhirUser?: string;
        iss?: string;
        aud?: string;
        clientId?: string;
        tokenType?: string;
      };
      
      // Enhanced Access Control
      accessDecision?: AccessDecision;
      patientConsent?: PatientConsent;
      minimumNecessaryValidation?: {
        compliant: boolean;
        allowedFields: string[];
        deniedFields: string[];
      };
      
      // PHI Access Control
      phiAccessConditions?: {
        patientId?: string;
        dataCategory?: string;
        fieldsRequested?: string[];
        reason?: string;
        legalBasis?: string;
      };
    }
    
    interface User {
      id: string;
      username: string;
      role: UserRole;
      scope?: string[];
      patient?: string;
      encounter?: string;
      clientId?: string;
      permissions?: string[];
      breakGlassActive?: boolean;
      breakGlassReason?: string;
    }
  }
}

// Express middleware type helpers
import type { Request, Response, NextFunction } from 'express';

export type AsyncMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export type SyncMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

export type ExpressMiddleware = AsyncMiddleware | SyncMiddleware;

export type AsyncRouteHandler = (
  req: Request,
  res: Response
) => Promise<void>;

export type SyncRouteHandler = (
  req: Request,
  res: Response
) => void;

export type ExpressRouteHandler = AsyncRouteHandler | SyncRouteHandler;

// Error handler types
export type AsyncErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export type SyncErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => void;

export type ExpressErrorHandler = AsyncErrorHandler | SyncErrorHandler;

export {};