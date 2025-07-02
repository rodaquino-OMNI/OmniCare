// Stub implementation for response transformer
import { Request, Response, NextFunction } from 'express';

export class ResponseTransformer {
  constructor() {}
  
  middleware() {
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  }
  
  transform(res: Response): Response {
    return res;
  }
}