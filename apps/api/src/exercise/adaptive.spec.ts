import { calculateAdaptiveLevel } from '@cerebromat/shared';

describe('calculateAdaptiveLevel', () => {
  it('increases level when accuracy and speed are high', () => {
    const attempts = Array.from({ length: 20 }, () => ({
      isCorrect: true,
      responseMs: 3000,
    }));

    const nextLevel = calculateAdaptiveLevel({
      currentLevel: 3,
      maxLevel: 8,
      responseThresholdMs: 7000,
      attempts,
    });

    expect(nextLevel).toBe(4);
  });

  it('decreases level when low accuracy', () => {
    const attempts = Array.from({ length: 20 }, (_, index) => ({
      isCorrect: index < 8,
      responseMs: 4000,
    }));

    const nextLevel = calculateAdaptiveLevel({
      currentLevel: 5,
      maxLevel: 8,
      responseThresholdMs: 7000,
      attempts,
    });

    expect(nextLevel).toBe(4);
  });

  it('keeps same level for middle-range performance', () => {
    const attempts = Array.from({ length: 20 }, (_, index) => ({
      isCorrect: index < 14,
      responseMs: 9000,
    }));

    const nextLevel = calculateAdaptiveLevel({
      currentLevel: 4,
      maxLevel: 8,
      responseThresholdMs: 7000,
      attempts,
    });

    expect(nextLevel).toBe(4);
  });
});
