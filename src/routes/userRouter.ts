import type { Request,Response } from "express";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET, loginSchema, signupSchema } from "../types/schema.js";
import prisma from "../lib/index.js";
const router = express.Router();


router.post('/signup', async (req:Request, res:Response) => {
  try {
    const validatedData = signupSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'EMAIL_ALREADY_EXISTS'
      });
    }
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role || 'customer',
        phone: validatedData.phone
      }
    });
    
    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      },
      error: null
    });
  } catch (error:any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'INVALID_REQUEST'
      });
    }
    
    return res.status(500).json({
      success: false,
      data: null,
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'INVALID_CREDENTIALS'
      });
    }
    const isValidPassword = await bcrypt.compare(validatedData.password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'INVALID_CREDENTIALS'
      });
    }
    
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      },
      error: null
    });
  } catch (error:any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'INVALID_REQUEST'
      });
    }
    
    return res.status(500).json({
      success: false,
      data: null,
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

export const authRoutes = router;