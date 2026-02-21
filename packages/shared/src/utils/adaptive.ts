import { ADAPTIVE_WINDOW_SIZE } from '../constants/exercise';

export type AdaptiveAttempt = {
  isCorrect: boolean;
  responseMs: number;
};

export type AdaptiveInput = {
  currentLevel: number;
  minLevel?: number;
  maxLevel: number;
  responseThresholdMs: number;
  attempts: AdaptiveAttempt[];
};

export function calculateAdaptiveLevel({
  currentLevel,
  maxLevel,
  responseThresholdMs,
  attempts,
  minLevel = 1,
}: AdaptiveInput): number {
  const recent = attempts.slice(-ADAPTIVE_WINDOW_SIZE);
  if (recent.length < 5) {
    return currentLevel;
  }

  const correctCount = recent.filter((attempt) => attempt.isCorrect).length;
  const accuracy = correctCount / recent.length;
  const avgResponseMs = recent.reduce((acc, attempt) => acc + attempt.responseMs, 0) / recent.length;

  if (accuracy >= 0.8 && avgResponseMs <= responseThresholdMs) {
    return Math.min(currentLevel + 1, maxLevel);
  }

  if (accuracy <= 0.5) {
    return Math.max(currentLevel - 1, minLevel);
  }

  return currentLevel;
}
