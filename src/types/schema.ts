import z, { email } from "zod"

export const signupSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
    role: z.enum(["owner", "customer"]).optional(),
    phone: z.string().min(10, "Phone number must be at least 10 digits long"),
})

export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
})

export const createHotelSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  city: z.string().min(1),
  country: z.string().min(1),
  amenities: z.array(z.string()).optional().default([])
});

export const createRoomSchema = z.object({
  roomNumber: z.string().min(1),
  roomType: z.string().min(1),
  pricePerNight: z.number().positive(),
  maxOccupancy: z.number().int().positive()
});

export const createBookingSchema = z.object({
  roomId: z.string().min(1),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().positive()
});

export const createReviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional()
});

export const JWT_SECRET="your_jwt_secret_key"