// Stub implementation for request transformer
import { Request, Response, NextFunction } from 'express';

export class RequestTransformer {
  constructor() {
    // Stub implementation - to be implemented
  }
  
  middleware() {
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  }
  
  transform(req: Request): Request {
    return req;
  }
}