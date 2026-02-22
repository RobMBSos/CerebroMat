import { z } from 'zod';
import {
  AGE_GROUPS,
  DIFFICULTY_LEVELS,
  EXERCISE_CATEGORIES,
  EXERCISE_MODES,
} from '../constants/exercise';

export const createAssignmentSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  classId: z.string().cuid(),
  ageGroup: z.enum(AGE_GROUPS),
  mode: z.enum(EXERCISE_MODES),
  categories: z.array(z.enum(EXERCISE_CATEGORIES)).min(1),
  totalExercises: z.number().int().min(1).max(50).default(10),
  difficulty: z.enum(DIFFICULTY_LEVELS).default('NORMAL'),
  dueDate: z.string().datetime().optional(),
});

export type CreateAssignmentDto = z.infer<typeof createAssignmentSchema>;
