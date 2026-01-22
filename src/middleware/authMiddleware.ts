
import type { NextFunction, Response, Request } from "express";
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from "../types/schema.js";

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

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("Auth Header:", authHeader);

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        data: null,
        error: "UNAUTHORIZED",
      });
    }
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        data: null,
        error: "INVALID_AUTH_HEADER",
      });
    }

    console.log("JWT Token:", token);

    const decoded = jwt.verify(token, JWT_SECRET as string) as JWTPayload;
    console.log("Decoded Token:", decoded);

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(401).json({
      success: false,
      data: null,
      error: "UNAUTHORIZED",
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