import { z } from 'zod';
import { EXERCISE_CATEGORIES } from '../constants/exercise';

export const studentHistoryQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  category: z.enum(EXERCISE_CATEGORIES).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const studentOverviewQuerySchema = z.object({
  classId: z.string().cuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const studentSessionsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  category: z.enum(EXERCISE_CATEGORIES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type StudentHistoryQueryDto = z.infer<typeof studentHistoryQuerySchema>;
export type StudentOverviewQueryDto = z.infer<typeof studentOverviewQuerySchema>;
export type StudentSessionsQueryDto = z.infer<typeof studentSessionsQuerySchema>;
