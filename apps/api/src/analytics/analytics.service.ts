import { Injectable } from '@nestjs/common';
import { ExerciseCategory } from '@prisma/client';
import type {
  AnalyticsQueryDto,
  ClassAnalyticsQueryDto,
} from '@cerebromat/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { ClassesService } from '../classes/classes.service';
import { StudentsService } from '../students/students.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classesService: ClassesService,
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

  async getClassOverview(user: AuthUser, query: ClassAnalyticsQueryDto) {
    await this.classesService.assertCanViewClass(user, query.classId);

    const classroom = await this.prisma.class.findUnique({
      where: { id: query.classId },
      include: {
        teacher: {
          select: { id: true, fullName: true, email: true },
        },
        enrollments: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                email: true,
                studentProfile: true,
              },
            },
          },
        },
      },
    });

    if (!classroom) {
      return {
        class: null,
        summary: {
          totalAttempts: 0,
          correctAttempts: 0,
          incorrectAttempts: 0,
          overallAccuracy: 0,
          averageResponseMs: 0,
          activeStudents: 0,
        },
        filters: {
          from: query.from,
          to: query.to,
          category: query.category,
          granularity: query.granularity,
        },
        byCategory: [],
        studentSummaries: [],
        accuracySeries: [],
        timeSeries: [],
        levelSeries: [],
      };
    }

    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const attempts = await this.prisma.exerciseAttempt.findMany({
      where: {
        session: {
          classId: query.classId,
        },
        category: query.category,
        answeredAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: {
        answeredAt: 'asc',
      },
      include: {
        student: {
          select: { id: true, fullName: true },
        },
      },
    });

    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter((attempt) => attempt.isCorrect)
      .length;
    const incorrectAttempts = totalAttempts - correctAttempts;

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
      return {
        period,
        avgLevel,
      };
    });

    const byCategory = Object.values(ExerciseCategory).map((category) => {
      const categoryAttempts = attempts.filter(
        (attempt) => attempt.category === category,
      );
      const categoryTotal = categoryAttempts.length;
      const categoryCorrect = categoryAttempts.filter(
        (attempt) => attempt.isCorrect,
      ).length;
      return {
        category,
        attempts: categoryTotal,
        correct: categoryCorrect,
        incorrect: categoryTotal - categoryCorrect,
        accuracy:
          categoryTotal > 0
            ? Number((categoryCorrect / categoryTotal).toFixed(3))
            : 0,
      };
    });

    const attemptsByStudent = attempts.reduce<
      Record<string, (typeof attempts)[number][]>
    >((acc, attempt) => {
      const key = attempt.studentId;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(attempt);
      return acc;
    }, {});

    const studentSummaries = classroom.enrollments
      .map((enrollment) => {
        const studentAttempts = attemptsByStudent[enrollment.student.id] ?? [];
        const studentTotal = studentAttempts.length;
        const studentCorrect = studentAttempts.filter(
          (attempt) => attempt.isCorrect,
        ).length;
        const studentIncorrect = studentTotal - studentCorrect;
        const studentAvgMs =
          studentTotal > 0
            ? Math.round(
                studentAttempts.reduce(
                  (acc, attempt) => acc + attempt.responseMs,
                  0,
                ) / studentTotal,
              )
            : 0;

        const weakCategory = Object.values(ExerciseCategory)
          .map((category) => {
            const categoryAttempts = studentAttempts.filter(
              (attempt) => attempt.category === category,
            );
            const failures = categoryAttempts.filter(
              (attempt) => !attempt.isCorrect,
            ).length;
            return {
              category,
              failures,
              attempts: categoryAttempts.length,
            };
          })
          .sort((left, right) => {
            if (right.failures !== left.failures) {
              return right.failures - left.failures;
            }
            return right.attempts - left.attempts;
          })[0];

        return {
          student: enrollment.student,
          metrics: {
            totalAttempts: studentTotal,
            correctAttempts: studentCorrect,
            incorrectAttempts: studentIncorrect,
            accuracy:
              studentTotal > 0
                ? Number((studentCorrect / studentTotal).toFixed(3))
                : 0,
            averageResponseMs: studentAvgMs,
          },
          weakCategory:
            weakCategory && weakCategory.attempts > 0
              ? weakCategory
              : null,
        };
      })
      .sort((left, right) => {
        if (
          right.metrics.incorrectAttempts !== left.metrics.incorrectAttempts
        ) {
          return right.metrics.incorrectAttempts - left.metrics.incorrectAttempts;
        }
        return right.metrics.totalAttempts - left.metrics.totalAttempts;
      });

    return {
      class: {
        id: classroom.id,
        name: classroom.name,
        description: classroom.description,
        teacher: classroom.teacher,
        studentCount: classroom.enrollments.length,
      },
      summary: {
        totalAttempts,
        correctAttempts,
        incorrectAttempts,
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
        activeStudents: studentSummaries.filter(
          (student) => student.metrics.totalAttempts > 0,
        ).length,
      },
      filters: {
        from,
        to,
        category: query.category,
        granularity: query.granularity,
      },
      byCategory,
      studentSummaries,
      accuracySeries,
      timeSeries,
      levelSeries,
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
