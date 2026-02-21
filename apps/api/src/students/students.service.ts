import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listStudents(user: AuthUser, classId?: string) {
    if (user.role === Role.ADMIN) {
      return this.prisma.user.findMany({
        where: { role: Role.STUDENT },
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

  async getStudentAttemptHistory(
    studentId: string,
    where?: Prisma.ExerciseAttemptWhereInput,
  ) {
    return this.prisma.exerciseAttempt.findMany({
      where: {
        studentId,
        ...where,
      },
      orderBy: {
        answeredAt: 'asc',
      },
      take: 500,
    });
  }
}
