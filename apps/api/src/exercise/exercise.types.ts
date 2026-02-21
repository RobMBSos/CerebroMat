import { AgeGroup, ExerciseCategory, ExerciseMode } from '@prisma/client';

export type GeneratedExercise = {
  category: ExerciseCategory;
  prompt: string;
  expectedAnswer: string;
  operands: number[];
  metadata?: Record<string, unknown>;
};

export type GenerateExercisesInput = {
  ageGroup: AgeGroup;
  mode: ExerciseMode;
  categories: ExerciseCategory[];
  totalExercises: number;
  currentLevels: Record<ExerciseCategory, number>;
};
