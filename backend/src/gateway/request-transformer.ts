// Stub implementation for request transformer
import { Request, Response, NextFunction } from 'express';

export class RequestTransformer {
  constructor() {}
  
  middleware() {
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  }
  
  transform(req: Request): Request {
    return req;
  }
}