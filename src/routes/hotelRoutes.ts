import express from 'express';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { createHotelSchema, createRoomSchema } from '../types/schema.js';
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

router.post('/', authMiddleware, requireRole('owner'), async (req:Request, res:Response) => {
  try {
    if (!req.user?.id){
      return res.status(401).json({
        success: false,
        data: null,
        error: 'UNAUTHORIZED'
      });
    }
    const validatedData = createHotelSchema.parse(req.body);
    const hotel = await prisma.hotel.create({
      data: {
        ownerId: req.user!.id ,
        name: validatedData.name,
        description: validatedData.description ?? null,
        city: validatedData.city,
        country: validatedData.country,
        amenities: validatedData.amenities
      }
    });
    
    return res.status(201).json({
      success: true,
      data: {
        id: hotel.id,
        ownerId: hotel.ownerId,
        name: hotel.name,
        description: hotel.description,
        city: hotel.city,
        country: hotel.country,
        amenities: hotel.amenities,
        rating: hotel.rating,
        totalReviews: hotel.totalReviews
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

router.post('/:hotelId/rooms', authMiddleware, requireRole('owner'), async (req, res) => {
  try {
    if (!req.user?.id){
      return res.status(401).json({
        success: false,
        data: null,
        error: 'UNAUTHORIZED'
      });
    }
    const { hotelId } = req.params as any;
    const validatedData = createRoomSchema.parse(req.body);
    
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId }
    });
    
    if (!hotel) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'HOTEL_NOT_FOUND'
      });
    }
    
    if (hotel.ownerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'FORBIDDEN'
      });
    }
        const existingRoom = await prisma.room.findUnique({
      where: {
        hotelId_roomNumber: {
          hotelId,
          roomNumber: validatedData.roomNumber
        }
      }
    });
    
    if (existingRoom) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'ROOM_ALREADY_EXISTS'
      });
    }
    
    const room = await prisma.room.create({
      data: {
        hotelId,
        roomNumber: validatedData.roomNumber,
        roomType: validatedData.roomType,
        pricePerNight: validatedData.pricePerNight,
        maxOccupancy: validatedData.maxOccupancy
      }
    });
    
    return res.status(201).json({
      success: true,
      data: {
        id: room.id,
        hotelId: room.hotelId,
        roomNumber: room.roomNumber,
        roomType: room.roomType,
        pricePerNight: room.pricePerNight,
        maxOccupancy: room.maxOccupancy
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

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { city, country, minPrice, maxPrice, minRating } = req.query;
    const where = {} as any;
    if (city) {
      where.city = { equals: city, mode: 'insensitive' };
    }
    if (country) {
      where.country = { equals: country, mode: 'insensitive' };
    }
    
    if (minRating) {
      where.rating = { gte: parseFloat(minRating as string) };
    }
    
    const hotels = await prisma.hotel.findMany({
      where,
      include: {
        rooms: true
      }
    });
    
    const filteredHotels = hotels
      .filter(hotel => hotel.rooms.length > 0)
      .map(hotel => {
        const minPricePerNight = Math.min(...hotel.rooms.map(room => room.pricePerNight));
        return {
          ...hotel,
          minPricePerNight
        };
      })
      .filter(hotel => {
        if (minPrice && hotel.minPricePerNight < parseFloat(minPrice as string)) return false;
        if (maxPrice && hotel.minPricePerNight > parseFloat(maxPrice as string)) return false;
        return true;
      })
      .map(hotel => ({
        id: hotel.id,
        name: hotel.name,
        description: hotel.description,
        city: hotel.city,
        country: hotel.country,
        amenities: hotel.amenities,
        rating: hotel.rating,
        totalReviews: hotel.totalReviews,
        minPricePerNight: hotel.minPricePerNight
      }));
    
    return res.status(200).json({
      success: true,
      data: filteredHotels,
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

router.get('/:hotelId', authMiddleware, async (req, res) => {
  try {
    const { hotelId } = req.params;
    
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId as string},
      include: {
        rooms: {
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
            pricePerNight: true,
            maxOccupancy: true
          }
        }
      }
    });
    
    if (!hotel) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'HOTEL_NOT_FOUND'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        id: hotel.id,
        ownerId: hotel.ownerId,
        name: hotel.name,
        description: hotel.description,
        city: hotel.city,
        country: hotel.country,
        amenities: hotel.amenities,
        rating: hotel.rating,
        totalReviews: hotel.totalReviews,
        rooms: hotel.rooms
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

export const hotelRoutes = router;