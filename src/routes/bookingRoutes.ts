import express from 'express';
import prisma from "../lib/index.js";
import { authMiddleware, requireRole } from "../middleware/authMiddleware.js";
import { createBookingSchema } from "../types/schema.js";
import type { Response, Request } from "express";

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

router.post('/', authMiddleware, requireRole('customer'), async (req:Request, res:Response) => {
  try {
    if (!req.user?.id){
      return res.status(401).json({
        success: false,
        data: null,
        error: 'UNAUTHORIZED'
      });
    }

    const validatedData = createBookingSchema.parse(req.body);
    const room = await prisma.room.findUnique({
      where: { id: validatedData.roomId },
      include: {
        hotel: true
      }
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'ROOM_NOT_FOUND'
      });
    }
    
    if (room.hotel.ownerId === req.user.id) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'FORBIDDEN'
      });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const checkInDate = new Date(validatedData.checkInDate);
    const checkOutDate = new Date(validatedData.checkOutDate);
    
    if (checkInDate <= today) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'INVALID_DATES'
      });
    }
    
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'INVALID_REQUEST'
      });
    }
    
    if (validatedData.guests > room.maxOccupancy) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'INVALID_CAPACITY'
      });
    }
    
    const result = await prisma.$transaction(async (tx) => {
      const overlappingBookings = await tx.booking.findMany({
        where: {
          roomId: validatedData.roomId,
          status: 'confirmed',
          AND: [
            {
              checkInDate: {
                lt: checkOutDate
              }
            },
            {
              checkOutDate: {
                gt: checkInDate
              }
            }
          ]
        }
      }) ;
      
      if (overlappingBookings.length > 0) {
        throw new Error('ROOM_NOT_AVAILABLE');
      }
      
      const nights = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24);
      const totalPrice = nights * room.pricePerNight;
      const booking = await tx.booking.create({
        data: {
          userId: req.user!.id,
          roomId: validatedData.roomId,
          hotelId: room.hotelId,
          checkInDate: checkInDate,
          checkOutDate: checkOutDate,
          guests: validatedData.guests,
          totalPrice: totalPrice,
          status: 'confirmed'
        }
      });
      
      return booking;
    });
    
    
    return res.status(201).json({
      success: true,
      data: {
        id: result.id ,
        userId: result.userId,
        roomId: result.roomId,
        hotelId: result.hotelId,
        checkInDate: result.checkInDate.toISOString().split('T')[0],
        checkOutDate: result.checkOutDate.toISOString().split('T')[0],
        guests: result.guests,
        totalPrice: result.totalPrice,
        status: result.status,
        bookingDate: result.bookingDate.toISOString()
      },
      error: null
    });
  } catch (error:any) {
    if (error.message === 'ROOM_NOT_AVAILABLE') {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'ROOM_NOT_AVAILABLE'
      });
    }
    
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

router.get('/', authMiddleware, requireRole('customer'), async (req:Request, res:Response) => {
  try {
    const { status } = req.query;
    
    const where: any = {
      userId: req.user!.id
    };
    
    if (status && typeof status === 'string') {
      where.status = status;
    }
    
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        room: true,
        hotel: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        bookingDate: 'desc'
      }
    });
    
    const formattedBookings = bookings.map(booking => ({
      id: booking.id,
      roomId: booking.roomId,
      hotelId: booking.hotelId,
      hotelName: booking.hotel.name,
      roomNumber: booking.room.roomNumber,
      roomType: booking.room.roomType,
      checkInDate: booking.checkInDate.toISOString().split('T')[0],
      checkOutDate: booking.checkOutDate.toISOString().split('T')[0],
      guests: booking.guests,
      totalPrice: booking.totalPrice,
      status: booking.status,
      bookingDate: booking.bookingDate.toISOString()
    }));
    
    return res.status(200).json({
      success: true,
      data: formattedBookings,
      error: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

router.put('/:bookingId/cancel', authMiddleware, requireRole('customer'), async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    
    if (!bookingId || typeof bookingId !== 'string') {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'INVALID_BOOKING_ID'
      });
    }
    
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
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
    
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'ALREADY_CANCELLED'
      });
    }
    
    const now = new Date();
    const checkInDate = new Date(booking.checkInDate);
    const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilCheckIn < 24) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'CANCELLATION_DEADLINE_PASSED'
      });
    }
    
    const cancelledBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date()
      }
    });
    
    return res.status(200).json({
      success: true,
      data: {
        id: cancelledBooking.id,
        status: cancelledBooking.status,
        cancelledAt: cancelledBooking.cancelledAt?.toISOString()
      },
      error: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});



export const bookingRoutes = router;