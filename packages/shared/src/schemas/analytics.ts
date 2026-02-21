import { z } from 'zod';
import { EXERCISE_CATEGORIES } from '../constants/exercise';

export const analyticsQuerySchema = z.object({
  studentId: z.string().cuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  category: z.enum(EXERCISE_CATEGORIES).optional(),
  granularity: z.enum(['day', 'week']).default('day'),
});

export const classAnalyticsQuerySchema = z.object({
  classId: z.string().cuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  category: z.enum(EXERCISE_CATEGORIES).optional(),
  granularity: z.enum(['day', 'week']).default('day'),
});

export type AnalyticsQueryDto = z.infer<typeof analyticsQuerySchema>;
export type ClassAnalyticsQueryDto = z.infer<typeof classAnalyticsQuerySchema>;
