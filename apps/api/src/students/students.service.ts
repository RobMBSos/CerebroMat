import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  StudentHistoryQueryDto,
  StudentOverviewQueryDto,
} from '@cerebromat/shared';
import { ExerciseCategory, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listStudents(user: AuthUser, classId?: string) {
    if (user.role === Role.ADMIN) {
      return this.prisma.user.findMany({
        where: {
          role: Role.STUDENT,
          ...(classId
            ? {
                enrollments: {
                  some: {
                    classId,
                  },
                },
              }
            : {}),
        },
        include: {
          studentProfile: true,
          skills: true,
          enrollments: {
            include: { class: true },
          },
        },
      });
    }

    if (user.role === Role.TEACHER) {
      return this.prisma.user.findMany({
        where: {
          role: Role.STUDENT,
          enrollments: {
            some: {
              class: {
                teacherId: user.sub,
                ...(classId ? { id: classId } : {}),
              },
            },
          },
        },
        include: {
          studentProfile: true,
          skills: true,
          enrollments: {
            include: { class: true },
          },
        },
      });
    }

    if (user.role === Role.PARENT) {
      return this.prisma.user.findMany({
        where: {
          role: Role.STUDENT,
          childLinks: {
            some: {
              parentId: user.sub,
            },
          },
          ...(classId
            ? {
                enrollments: {
                  some: {
                    classId,
                  },
                },
              }
            : {}),
        },
        include: {
          studentProfile: true,
          skills: true,
          enrollments: {
            include: { class: true },
          },
        },
      });
    }

    return this.prisma.user.findMany({
      where: {
        id: user.sub,
        role: Role.STUDENT,
      },
      include: {
        studentProfile: true,
        skills: true,
        enrollments: {
          include: { class: true },
        },
      },
    });
  }

  async getStudentById(user: AuthUser, studentId: string) {
    await this.assertCanViewStudent(user, studentId);

    const student = await this.prisma.user.findUnique({
      where: {
        id: studentId,
        role: Role.STUDENT,
      },
      include: {
        studentProfile: true,
        skills: true,
        enrollments: {
          include: {
            class: {
              include: {
                teacher: {
                  select: { id: true, fullName: true },
                },
              },
            },
          },
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            attempts: {
              take: 50,
              orderBy: { answeredAt: 'desc' },
            },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const allAttempts = student.sessions.flatMap((session) => session.attempts);

    const totalAttempts = allAttempts.length;
    const correctAttempts = allAttempts.filter(
      (attempt) => attempt.isCorrect,
    ).length;

    const avgResponseMs =
      totalAttempts > 0
        ? Math.round(
            allAttempts.reduce((acc, attempt) => acc + attempt.responseMs, 0) /
              totalAttempts,
          )
        : 0;

    return {
      student,
      metrics: {
        totalAttempts,
        correctAttempts,
        accuracy:
          totalAttempts > 0
            ? Number((correctAttempts / totalAttempts).toFixed(2))
            : 0,
        avgResponseMs,
      },
    };
  }

  async getStudentsOverview(user: AuthUser, query: StudentOverviewQueryDto) {
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date range');
    }

    if (from > to) {
      throw new BadRequestException(
        '`from` must be lower than or equal to `to`',
      );
    }

    const students = await this.listStudents(user, query.classId);
    const studentIds = students.map((student) => student.id);

    if (studentIds.length === 0) {
      return {
        filters: {
          classId: query.classId,
          from,
          to,
        },
        summary: {
          studentCount: 0,
          totalAttempts: 0,
          correctAttempts: 0,
          incorrectAttempts: 0,
          overallAccuracy: 0,
        },
        students: [],
      };
    }

    const attempts = await this.prisma.exerciseAttempt.findMany({
      where: {
        studentId: {
          in: studentIds,
        },
        answeredAt: {
          gte: from,
          lte: to,
        },
        ...(query.classId
          ? {
              session: {
                classId: query.classId,
              },
            }
          : {}),
      },
      orderBy: {
        answeredAt: 'desc',
      },
    });

    const attemptsByStudent = attempts.reduce<
      Record<string, typeof attempts>
    >((acc, attempt) => {
      if (!acc[attempt.studentId]) {
        acc[attempt.studentId] = [];
      }
      acc[attempt.studentId].push(attempt);
      return acc;
    }, {});

    const studentRows = students
      .map((student) => {
        const studentAttempts = attemptsByStudent[student.id] ?? [];
        const totalAttempts = studentAttempts.length;
        const correctAttempts = studentAttempts.filter(
          (attempt) => attempt.isCorrect,
        ).length;
        const incorrectAttempts = totalAttempts - correctAttempts;
        const avgResponseMs =
          totalAttempts > 0
            ? Math.round(
                studentAttempts.reduce(
                  (acc, attempt) => acc + attempt.responseMs,
                  0,
                ) / totalAttempts,
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
          student: {
            id: student.id,
            fullName: student.fullName,
            email: student.email,
            ageGroup: student.studentProfile?.ageGroup ?? null,
          },
          metrics: {
            totalAttempts,
            correctAttempts,
            incorrectAttempts,
            accuracy:
              totalAttempts > 0
                ? Number((correctAttempts / totalAttempts).toFixed(3))
                : 0,
            averageResponseMs: avgResponseMs,
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

    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter((attempt) => attempt.isCorrect)
      .length;

    return {
      filters: {
        classId: query.classId,
        from,
        to,
      },
      summary: {
        studentCount: students.length,
        totalAttempts,
        correctAttempts,
        incorrectAttempts: totalAttempts - correctAttempts,
        overallAccuracy:
          totalAttempts > 0
            ? Number((correctAttempts / totalAttempts).toFixed(3))
            : 0,
      },
      students: studentRows,
    };
  }

  async assertCanViewStudent(user: AuthUser, studentId: string) {
    if (user.role === Role.ADMIN) {
      return;
    }

    if (user.role === Role.STUDENT) {
      if (user.sub !== studentId) {
        throw new ForbiddenException('Cannot view another student');
      }

      return;
    }

    if (user.role === Role.PARENT) {
      const link = await this.prisma.parentStudentLink.findFirst({
        where: {
          parentId: user.sub,
          studentId,
        },
      });

      if (!link) {
        throw new ForbiddenException('Not linked to this student');
      }

      return;
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        class: {
          teacherId: user.sub,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('Teacher cannot access this student');
    }
  }

  async getStudentHistory(
    user: AuthUser,
    studentId: string,
    query: StudentHistoryQueryDto,
  ) {
    await this.assertCanViewStudent(user, studentId);

    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date range');
    }

    if (from > to) {
      throw new BadRequestException(
        '`from` must be lower than or equal to `to`',
      );
    }

    const attempts = await this.prisma.exerciseAttempt.findMany({
      where: {
        studentId,
        category: query.category,
        answeredAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: {
        answeredAt: 'desc',
      },
      take: query.limit,
    });

    const byCategory = Object.values(ExerciseCategory)
      .map((category) => {
        const categoryAttempts = attempts.filter(
          (attempt) => attempt.category === category,
        );
        const total = categoryAttempts.length;
        const correct = categoryAttempts.filter(
          (attempt) => attempt.isCorrect,
        ).length;
        const incorrect = total - correct;
        const avgResponseMs =
          total > 0
            ? Math.round(
                categoryAttempts.reduce(
                  (acc, attempt) => acc + attempt.responseMs,
                  0,
                ) / total,
              )
            : 0;

        return {
          category,
          attempts: total,
          correct,
          incorrect,
          accuracy: total > 0 ? Number((correct / total).toFixed(3)) : 0,
          avgResponseMs,
        };
      })
      .filter((item) => item.attempts > 0)
      .sort((left, right) => {
        if (right.incorrect !== left.incorrect) {
          return right.incorrect - left.incorrect;
        }
        return right.attempts - left.attempts;
      });

    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter((attempt) => attempt.isCorrect)
      .length;

    return {
      filters: {
        from,
        to,
        category: query.category,
        limit: query.limit,
      },
      summary: {
        totalAttempts,
        correctAttempts,
        incorrectAttempts: totalAttempts - correctAttempts,
        accuracy:
          totalAttempts > 0
            ? Number((correctAttempts / totalAttempts).toFixed(3))
            : 0,
        averageResponseMs:
          totalAttempts > 0
            ? Math.round(
                attempts.reduce((acc, attempt) => acc + attempt.responseMs, 0) /
                  totalAttempts,
              )
            : 0,
      },
      byCategory,
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        category: attempt.category,
        level: attempt.level,
        prompt: attempt.prompt,
        expectedAnswer: attempt.expectedAnswer,
        studentAnswer: attempt.studentAnswer,
        isCorrect: attempt.isCorrect,
        responseMs: attempt.responseMs,
        answeredAt: attempt.answeredAt,
      })),
    };
  }
}
