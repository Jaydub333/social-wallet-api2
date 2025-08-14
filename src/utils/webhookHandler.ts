import { Request, Response, NextFunction } from 'express';

// Middleware to handle raw body for webhook verification
export const rawBodyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/v1/payments/webhook') {
    let data = '';
    req.setEncoding('utf8');
    
    req.on('data', (chunk) => {
      data += chunk;
    });
    
    req.on('end', () => {
      req.body = data;
      next();
    });
  } else {
    next();
  }
};