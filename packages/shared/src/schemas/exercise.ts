import { z } from 'zod';
import {
  AGE_GROUPS,
  DEFAULT_SESSION_EXERCISES,
  DIFFICULTY_LEVELS,
  EXERCISE_CATEGORIES,
  EXERCISE_MODES,
} from '../constants/exercise';

export const startSessionSchema = z.object({
  ageGroup: z.enum(AGE_GROUPS),
  mode: z.enum(EXERCISE_MODES),
  categories: z.array(z.enum(EXERCISE_CATEGORIES)).min(1),
  totalExercises: z.number().int().min(1).max(50).default(DEFAULT_SESSION_EXERCISES),
  difficulty: z.enum(DIFFICULTY_LEVELS).optional(),
});

export const finishSessionSchema = z.object({
  summary: z
    .object({
      totalAttempts: z.number().int().min(0),
      correctAttempts: z.number().int().min(0),
      averageResponseMs: z.number().int().min(0),
    })
    .optional(),
});

export const bulkAttemptsSchema = z.object({
  sessionId: z.string().cuid(),
  attempts: z.array(
    z.object({
      category: z.enum(EXERCISE_CATEGORIES),
      level: z.number().int().min(1).max(20),
      prompt: z.string().min(1).max(500),
      operands: z.array(z.number()),
      expectedAnswer: z.string().min(1).max(80),
      studentAnswer: z.string().min(1).max(80),
      isCorrect: z.boolean(),
      responseMs: z.number().int().min(0).max(120000),
      metadata: z.record(z.string(), z.unknown()).optional(),
      answeredAt: z.string().datetime().optional(),
    }),
  ),
});

export type StartSessionDto = z.infer<typeof startSessionSchema>;
export type FinishSessionDto = z.infer<typeof finishSessionSchema>;
export type BulkAttemptsDto = z.infer<typeof bulkAttemptsSchema>;
