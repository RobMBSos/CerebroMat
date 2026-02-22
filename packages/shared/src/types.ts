import { AGE_GROUPS, DIFFICULTY_LEVELS, EXERCISE_CATEGORIES, EXERCISE_MODES, USER_ROLES } from './constants/exercise';

export type UserRole = (typeof USER_ROLES)[number];
export type AgeGroup = (typeof AGE_GROUPS)[number];
export type ExerciseMode = (typeof EXERCISE_MODES)[number];
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

export type AttemptPayload = {
  category: ExerciseCategory;
  level: number;
  prompt: string;
  operands: number[];
  expectedAnswer: string;
  studentAnswer: string;
  isCorrect: boolean;
  responseMs: number;
  metadata?: Record<string, unknown>;
};
