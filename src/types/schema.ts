import z, { email } from "zod"

export const signupSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
    role: z.enum(["admin", "customer"]).optional(),
    phone: z.string().min(10, "Phone number must be at least 10 digits long"),
})

export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
})


export const JWT_SECRET="your_jwt_secret_key"