
import type { NextFunction, Response, Request } from "express";
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../types/schema.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

interface JWTPayload {
  id: string;
  email: string;
  role: string;
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'UNAUTHORIZED'
      });
    }

    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      data: null,
      error: 'UNAUTHORIZED'
    });
  }
};


export const requireRole = (role: 'customer' | 'owner') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'FORBIDDEN'
      });
    }
    next();
  };
};