import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';

export interface AuthUser {
  id: number;
  username: string;
  roleId: number;
  roleName: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as AuthUser;
    req.user = decoded;
    next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
}

export function authorize(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const perms = req.user.permissions || [];
    if (perms.includes('*')) return next();

    const hasPermission = required.some(
      (r) => perms.includes(r) || perms.includes(r.split('.')[0] + '.*')
    );

    if (!hasPermission) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    next();
  };
}
