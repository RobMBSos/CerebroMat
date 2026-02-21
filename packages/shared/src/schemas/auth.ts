import { z } from 'zod';
import { USER_ROLES } from '../constants/exercise';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
  fullName: z.string().min(2).max(80),
  role: z.enum(USER_ROLES).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
