import { AgeGroup, ExerciseCategory, ExerciseMode } from '@prisma/client';
import { ExerciseGeneratorService } from './exercise.generator';

describe('ExerciseGeneratorService', () => {
  const service = new ExerciseGeneratorService();

  it('generates exact divisions for AGE_8_9 by default', () => {
    const exercises = service.generateExercises({
      ageGroup: AgeGroup.AGE_8_9,
      mode: ExerciseMode.OPERATIONS,
      categories: [ExerciseCategory.DIVISION],
      totalExercises: 20,
      currentLevels: {
        ADDITION: 1,
        SUBTRACTION: 1,
        MULTIPLICATION: 1,
        DIVISION: 2,
        WORD_PROBLEM: 1,
      },
    });

    for (const exercise of exercises) {
      const [dividend, divisor] = exercise.operands;
      expect(dividend % divisor).toBe(0);
      expect(exercise.expectedAnswer.includes('r')).toBe(false);
    }
  });

  it('supports remainder in AGE_10_12 high levels', () => {
    const exercises = service.generateExercises({
      ageGroup: AgeGroup.AGE_10_12,
      mode: ExerciseMode.OPERATIONS,
      categories: [ExerciseCategory.DIVISION],
      totalExercises: 50,
      currentLevels: {
        ADDITION: 1,
        SUBTRACTION: 1,
        MULTIPLICATION: 1,
        DIVISION: 9,
        WORD_PROBLEM: 1,
      },
    });

    const withRemainder = exercises.filter((exercise) =>
      exercise.expectedAnswer.includes('r'),
    );
    expect(withRemainder.length).toBeGreaterThan(0);
  });

  it('creates word problems with prompt and answer', () => {
    const exercises = service.generateExercises({
      ageGroup: AgeGroup.AGE_6_7,
      mode: ExerciseMode.WORD_PROBLEMS,
      categories: [ExerciseCategory.WORD_PROBLEM],
      totalExercises: 10,
      currentLevels: {
        ADDITION: 1,
        SUBTRACTION: 1,
        MULTIPLICATION: 1,
        DIVISION: 1,
        WORD_PROBLEM: 1,
      },
    });

    expect(
      exercises.every(
        (item) => item.category === ExerciseCategory.WORD_PROBLEM,
      ),
    ).toBe(true);
    expect(exercises.every((item) => item.prompt.length > 5)).toBe(true);
    expect(exercises.every((item) => item.expectedAnswer.length > 0)).toBe(
      true,
    );
  });
});
