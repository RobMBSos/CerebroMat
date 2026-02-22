import { Injectable } from '@nestjs/common';
import { AgeGroup, ExerciseCategory, ExerciseMode } from '@prisma/client';
import { GeneratedExercise, GenerateExercisesInput } from './exercise.types';

type Operation = '+' | '-' | 'x' | '/';

const NAMES = ['Ana', 'Leo', 'Marta', 'Lucas', 'Nora', 'Pablo'];
const OBJECTS: Array<{ noun: string; quantifier: 'Cuántos' | 'Cuántas' }> = [
  { noun: 'manzanas', quantifier: 'Cuántas' },
  { noun: 'lápices', quantifier: 'Cuántos' },
  { noun: 'canicas', quantifier: 'Cuántas' },
  { noun: 'galletas', quantifier: 'Cuántas' },
  { noun: 'pegatinas', quantifier: 'Cuántas' },
];

@Injectable()
export class ExerciseGeneratorService {
  generateExercises(input: GenerateExercisesInput): GeneratedExercise[] {
    const categories = this.resolveCategories(input.mode, input.categories);
    const exercises: GeneratedExercise[] = [];

    for (let index = 0; index < input.totalExercises; index += 1) {
      const category = categories[index % categories.length];
      const level = input.currentLevels[category] ?? 1;

      if (category === ExerciseCategory.WORD_PROBLEM) {
        exercises.push(this.generateWordProblem(input.ageGroup, level));
      } else {
        exercises.push(this.generateOperation(category, input.ageGroup, level));
      }
    }

    return this.shuffle(exercises);
  }

  private resolveCategories(
    mode: ExerciseMode,
    selected: ExerciseCategory[],
  ): ExerciseCategory[] {
    if (mode === ExerciseMode.WORD_PROBLEMS) {
      return [ExerciseCategory.WORD_PROBLEM];
    }

    if (mode === ExerciseMode.OPERATIONS) {
      const operationCategories = selected.filter(
        (item) => item !== ExerciseCategory.WORD_PROBLEM,
      );
      return operationCategories.length > 0
        ? operationCategories
        : [
            ExerciseCategory.ADDITION,
            ExerciseCategory.SUBTRACTION,
            ExerciseCategory.MULTIPLICATION,
            ExerciseCategory.DIVISION,
          ];
    }

    return selected.length > 0
      ? selected
      : [
          ExerciseCategory.ADDITION,
          ExerciseCategory.SUBTRACTION,
          ExerciseCategory.MULTIPLICATION,
          ExerciseCategory.DIVISION,
          ExerciseCategory.WORD_PROBLEM,
        ];
  }

  private generateOperation(
    category: ExerciseCategory,
    ageGroup: AgeGroup,
    level: number,
  ): GeneratedExercise {
    const config = this.getRangeConfig(ageGroup, level);

    if (category === ExerciseCategory.ADDITION) {
      const [a, b] = this.generateAddends(ageGroup, config.max);
      return {
        category,
        prompt: `${a} + ${b} = ?`,
        expectedAnswer: String(a + b),
        operands: [a, b],
      };
    }

    if (category === ExerciseCategory.SUBTRACTION) {
      const [a, b] = this.generateSubtractionOperands(ageGroup, config.max);
      return {
        category,
        prompt: `${a} - ${b} = ?`,
        expectedAnswer: String(a - b),
        operands: [a, b],
      };
    }

    if (category === ExerciseCategory.MULTIPLICATION) {
      const [a, b] = this.generateMultiplicationOperands(
        ageGroup,
        config.max,
        level,
      );
      return {
        category,
        prompt: `${a} x ${b} = ?`,
        expectedAnswer: String(a * b),
        operands: [a, b],
      };
    }

    const division = this.generateDivisionOperands(ageGroup, config.max, level);

    return {
      category,
      prompt: `${division.dividend} / ${division.divisor} = ?`,
      expectedAnswer: division.remainder
        ? `${division.quotient} r ${division.remainder}`
        : String(division.quotient),
      operands: [division.dividend, division.divisor],
      metadata: {
        allowRemainder: division.remainder > 0,
      },
    };
  }

  private generateWordProblem(
    ageGroup: AgeGroup,
    level: number,
  ): GeneratedExercise {
    const person = this.pick(NAMES);
    const objectData = this.pick(OBJECTS);
    const object = objectData.noun;
    const quantifier = objectData.quantifier;
    const max = this.getRangeConfig(ageGroup, level).max;

    const typeByAge: Record<AgeGroup, Operation[]> = {
      INFANT_3_5: ['+', '-'],
      AGE_6_7: ['+', '-'],
      AGE_8_9: ['+', '-', 'x', '/'],
      AGE_10_12: ['+', '-', 'x', '/'],
    };

    const operation = this.pick(typeByAge[ageGroup]);

    if (operation === '+') {
      const a = this.randomInt(1, Math.max(2, max - 1));
      const b = this.randomInt(1, Math.max(2, max - a));
      return {
        category: ExerciseCategory.WORD_PROBLEM,
        prompt: `${person} tiene ${a} ${object} y consigue ${b} más. ¿${quantifier} ${object} tiene ahora?`,
        expectedAnswer: String(a + b),
        operands: [a, b],
        metadata: {
          operation: 'addition',
          data: { start: a, gain: b },
        },
      };
    }

    if (operation === '-') {
      const a = this.randomInt(4, Math.max(6, max));
      const b = this.randomInt(1, Math.max(2, a - 1));
      return {
        category: ExerciseCategory.WORD_PROBLEM,
        prompt: `${person} tenía ${a} ${object} y regaló ${b}. ¿${quantifier} ${object} le quedan?`,
        expectedAnswer: String(a - b),
        operands: [a, b],
        metadata: {
          operation: 'subtraction',
          data: { start: a, given: b },
        },
      };
    }

    if (operation === 'x') {
      let a: number;
      let b: number;
      if (ageGroup === AgeGroup.AGE_10_12) {
        a = this.randomInt(2, 30);
        b = this.randomInt(2, 20);
      } else if (ageGroup === AgeGroup.AGE_8_9 && level >= 6) {
        // 3-digit × 1-digit word problem
        a = this.randomInt(100, 999);
        b = this.randomInt(2, 9);
      } else {
        a = this.randomInt(2, 12);
        b = this.randomInt(2, 12);
      }
      return {
        category: ExerciseCategory.WORD_PROBLEM,
        prompt: `${person} guarda ${b} ${object} en cada caja y tiene ${a} cajas. ¿${quantifier} ${object} hay en total?`,
        expectedAnswer: String(a * b),
        operands: [a, b],
        metadata: {
          operation: 'multiplication',
          data: { groups: a, each: b },
        },
      };
    }

    let divisor: number;
    let quotient: number;
    if (ageGroup === AgeGroup.AGE_10_12) {
      divisor = this.randomInt(2, 15);
      quotient = this.randomInt(2, 25);
    } else if (ageGroup === AgeGroup.AGE_8_9 && level >= 6) {
      divisor = this.randomInt(2, 9);
      quotient = this.randomInt(Math.ceil(100 / 9), Math.floor(999 / 2));
    } else {
      divisor = this.randomInt(2, 12);
      quotient = this.randomInt(2, 12);
    }
    const dividend = divisor * quotient;

    return {
      category: ExerciseCategory.WORD_PROBLEM,
      prompt: `${person} reparte ${dividend} ${object} en ${divisor} grupos iguales. ¿${quantifier} ${object} van en cada grupo?`,
      expectedAnswer: String(quotient),
      operands: [dividend, divisor],
      metadata: {
        operation: 'division',
        data: { total: dividend, groups: divisor },
      },
    };
  }

  private generateAddends(ageGroup: AgeGroup, max: number): [number, number] {
    if (ageGroup === AgeGroup.INFANT_3_5) {
      const a = this.randomInt(1, 9);
      const b = this.randomInt(1, 10 - a);
      return [a, b];
    }

    return [this.randomInt(1, max), this.randomInt(1, max)];
  }

  private generateSubtractionOperands(
    ageGroup: AgeGroup,
    max: number,
  ): [number, number] {
    if (ageGroup === AgeGroup.INFANT_3_5) {
      const a = this.randomInt(2, 10);
      const b = this.randomInt(1, a - 1);
      return [a, b];
    }

    const a = this.randomInt(2, max);
    const b = this.randomInt(1, a - 1);
    return [a, b];
  }

  private generateMultiplicationOperands(
    ageGroup: AgeGroup,
    max: number,
    level: number,
  ): [number, number] {
    if (ageGroup === AgeGroup.AGE_8_9) {
      if (level >= 8) {
        // 3-digit × 1-2-digit (e.g. 345 × 12)
        return [this.randomInt(100, 999), this.randomInt(2, 12)];
      }
      if (level >= 6) {
        // 3-digit × 1-digit (e.g. 234 × 7)
        return [this.randomInt(100, 999), this.randomInt(2, 9)];
      }
      // Times tables
      return [this.randomInt(2, 12), this.randomInt(2, 12)];
    }

    if (ageGroup === AgeGroup.AGE_10_12) {
      const maxA = level >= 6 ? 99 : 20;
      const maxB = level >= 6 ? 99 : 20;
      return [this.randomInt(2, maxA), this.randomInt(2, maxB)];
    }

    return [
      this.randomInt(1, Math.min(max, 12)),
      this.randomInt(1, Math.min(max, 12)),
    ];
  }

  private generateDivisionOperands(
    ageGroup: AgeGroup,
    max: number,
    level: number,
  ) {
    if (ageGroup === AgeGroup.AGE_10_12 && level >= 8) {
      const divisor = this.randomInt(2, 20);
      const quotient = this.randomInt(2, 50);
      const remainder = this.randomInt(0, divisor - 1);
      const dividend = divisor * quotient + remainder;
      return { dividend, divisor, quotient, remainder };
    }

    if (ageGroup === AgeGroup.AGE_8_9 && level >= 6) {
      // 3-digit dividend ÷ 1-digit divisor (exact division)
      const divisor = level >= 8 ? this.randomInt(2, 12) : this.randomInt(2, 9);
      const quotient = this.randomInt(
        Math.ceil(100 / divisor),
        Math.floor(999 / divisor),
      );
      const dividend = divisor * quotient;
      return { dividend, divisor, quotient, remainder: 0 };
    }

    const divisor = this.randomInt(
      2,
      ageGroup === AgeGroup.AGE_10_12 ? 20 : 12,
    );
    const quotient = this.randomInt(
      2,
      Math.max(3, Math.floor(max / Math.max(2, divisor))),
    );
    const dividend = divisor * quotient;

    return {
      dividend,
      divisor,
      quotient,
      remainder: 0,
    };
  }

  private getRangeConfig(ageGroup: AgeGroup, level: number): { max: number } {
    const normalizedLevel = Math.max(1, level);

    if (ageGroup === AgeGroup.INFANT_3_5) {
      return { max: 10 };
    }

    if (ageGroup === AgeGroup.AGE_6_7) {
      return { max: Math.min(20, 10 + normalizedLevel * 2) };
    }

    if (ageGroup === AgeGroup.AGE_8_9) {
      // Levels 1-5: 2-digit (max 30→70), Levels 6-8: 3-digit (max 500→999)
      if (normalizedLevel >= 6) {
        return { max: Math.min(999, 300 + (normalizedLevel - 6) * 350) };
      }
      return { max: Math.min(100, 20 + normalizedLevel * 10) };
    }

    return { max: Math.min(1000, 100 + normalizedLevel * 60) };
  }

  private pick<T>(values: T[]): T {
    return values[this.randomInt(0, values.length - 1)];
  }

  private randomInt(min: number, max: number): number {
    const safeMin = Math.ceil(min);
    const safeMax = Math.floor(max);
    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
  }

  private shuffle<T>(values: T[]): T[] {
    const array = [...values];
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
  }
}
