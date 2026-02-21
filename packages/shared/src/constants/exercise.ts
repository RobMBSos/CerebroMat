export const AGE_GROUPS = ['INFANT_3_5', 'AGE_6_7', 'AGE_8_9', 'AGE_10_12'] as const;

export const EXERCISE_MODES = ['OPERATIONS', 'WORD_PROBLEMS', 'MIXED'] as const;

export const EXERCISE_CATEGORIES = [
  'ADDITION',
  'SUBTRACTION',
  'MULTIPLICATION',
  'DIVISION',
  'WORD_PROBLEM',
] as const;

export const USER_ROLES = ['ADMIN', 'TEACHER', 'PARENT', 'STUDENT'] as const;

export const DEFAULT_SESSION_EXERCISES = 10;
export const ADAPTIVE_WINDOW_SIZE = 20;
