import express from 'express';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createReviewSchema } from '../types/schema.js';
import type { Response, Request } from "express";
import prisma from '../lib/index.js';

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

const router = express.Router();

router.post('/', authMiddleware, requireRole('customer'), async (req: Request, res: Response) => {
  try {
    const validatedData = createReviewSchema.parse(req.body);
    
    // Check if booking exists and belongs to user
    const booking = await prisma.booking.findUnique({
      where: { id: validatedData.bookingId },
      include: {
        hotel: true,
        review: true
      }
    });
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'BOOKING_NOT_FOUND'
      });
    }
    
    if (booking.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'FORBIDDEN'
      });
    }
    
    // Check if booking is completed (checkOutDate < now)
    const now = new Date();
    const checkOutDate = new Date(booking.checkOutDate);
    if (checkOutDate >= now) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'BOOKING_NOT_ELIGIBLE'
      });
    }
    
    // Check if booking is cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'BOOKING_NOT_ELIGIBLE'
      });
    }
    
    // Check if already reviewed
    if (booking.review) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'ALREADY_REVIEWED'
      });
    }
    
    // Create review
    const review = await prisma.review.create({
      data: {
        userId: req.user!.id,
        hotelId: booking.hotelId,
        bookingId: validatedData.bookingId,
        rating: validatedData.rating,
        comment: validatedData.comment ?? null
      }
    });
    
    // Update hotel rating
    const allReviews = await prisma.review.findMany({
      where: { hotelId: booking.hotelId },
      select: { rating: true }
    });
    
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / allReviews.length;
    
    await prisma.hotel.update({
      where: { id: booking.hotelId },
      data: {
        rating: averageRating,
        totalReviews: allReviews.length
      }
    });
    
    return res.status(201).json({
      success: true,
      data: {
        id: review.id,
        userId: review.userId,
        hotelId: review.hotelId,
        bookingId: review.bookingId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString()
      },
      error: null
    });
  } catch (error: any) {
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

export const reviewRoutes = router;
