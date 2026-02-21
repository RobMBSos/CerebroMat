import { Injectable } from '@nestjs/common';
import { ExerciseCategory } from '@prisma/client';
import type { AnalyticsQueryDto } from '@cerebromat/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { StudentsService } from '../students/students.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentsService: StudentsService,
  ) {}

  async getStudentSeries(user: AuthUser, query: AnalyticsQueryDto) {
    await this.studentsService.assertCanViewStudent(user, query.studentId);

    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const attempts = await this.prisma.exerciseAttempt.findMany({
      where: {
        studentId: query.studentId,
        category: query.category,
        answeredAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: {
        answeredAt: 'asc',
      },
    });

    const grouped = this.groupAttempts(attempts, query.granularity);
    const periods = Object.keys(grouped).sort();

    const accuracySeries = periods.map((period) => {
      const items = grouped[period] ?? [];
      const total = items.length;
      const correct = items.filter((item) => item.isCorrect).length;
      return {
        period,
        attempts: total,
        correct,
        accuracy: total > 0 ? Number((correct / total).toFixed(3)) : 0,
      };
    });

    const timeSeries = periods.map((period) => {
      const items = grouped[period] ?? [];
      const avgResponseMs =
        items.length > 0
          ? Math.round(
              items.reduce((acc, item) => acc + item.responseMs, 0) /
                items.length,
            )
          : 0;

      return {
        period,
        avgResponseMs,
      };
    });

    const levelSeries = periods.map((period) => {
      const items = grouped[period] ?? [];
      const avgLevel =
        items.length > 0
          ? Number(
              (
                items.reduce((acc, item) => acc + item.level, 0) / items.length
              ).toFixed(2),
            )
          : 0;

      const byCategory = Object.values(ExerciseCategory).map((category) => {
        const categoryItems = items.filter(
          (item) => item.category === category,
        );
        const categoryAverage =
          categoryItems.length > 0
            ? Number(
                (
                  categoryItems.reduce((acc, item) => acc + item.level, 0) /
                  categoryItems.length
                ).toFixed(2),
              )
            : 0;

        return {
          category,
          averageLevel: categoryAverage,
        };
      });

      return {
        period,
        avgLevel,
        byCategory,
      };
    });

    const currentSkills = await this.prisma.studentSkill.findMany({
      where: {
        studentId: query.studentId,
      },
      orderBy: {
        category: 'asc',
      },
    });

    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter((item) => item.isCorrect).length;

    return {
      summary: {
        totalAttempts,
        correctAttempts,
        overallAccuracy:
          totalAttempts > 0
            ? Number((correctAttempts / totalAttempts).toFixed(3))
            : 0,
        averageResponseMs:
          totalAttempts > 0
            ? Math.round(
                attempts.reduce((acc, item) => acc + item.responseMs, 0) /
                  totalAttempts,
              )
            : 0,
      },
      filters: {
        from,
        to,
        category: query.category,
        granularity: query.granularity,
      },
      accuracySeries,
      timeSeries,
      levelSeries,
      currentSkills,
    };
  }

  private groupAttempts(
    attempts: Array<{
      answeredAt: Date;
      isCorrect: boolean;
      responseMs: number;
      level: number;
      category: ExerciseCategory;
    }>,
    granularity: 'day' | 'week',
  ) {
    return attempts.reduce<Record<string, typeof attempts>>((acc, attempt) => {
      const key =
        granularity === 'week'
          ? this.toWeekStartKey(attempt.answeredAt)
          : this.toDayKey(attempt.answeredAt);

      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(attempt);
      return acc;
    }, {});
  }

  private toDayKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private toWeekStartKey(value: Date) {
    const date = new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
    const weekday = date.getUTCDay();
    const diff = weekday === 0 ? -6 : 1 - weekday;
    date.setUTCDate(date.getUTCDate() + diff);
    return date.toISOString().slice(0, 10);
  }
}
