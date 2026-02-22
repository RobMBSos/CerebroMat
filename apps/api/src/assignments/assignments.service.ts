import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Difficulty, Role } from '@prisma/client';
import { CreateAssignmentDto } from '@cerebromat/shared';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionsService: SessionsService,
  ) {}

  async create(user: AuthUser, input: CreateAssignmentDto) {
    const classroom = await this.prisma.class.findUnique({
      where: { id: input.classId },
    });

    if (!classroom) {
      throw new NotFoundException('Class not found');
    }

    if (
      user.role === Role.TEACHER &&
      classroom.teacherId !== user.sub
    ) {
      throw new ForbiddenException('Not your class');
    }

    return this.prisma.assignment.create({
      data: {
        title: input.title,
        description: input.description,
        teacherId: user.sub,
        classId: input.classId,
        ageGroup: input.ageGroup,
        mode: input.mode,
        categories: input.categories,
        totalExercises: input.totalExercises,
        difficulty: (input.difficulty as Difficulty) ?? Difficulty.NORMAL,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      },
    });
  }

  async list(user: AuthUser) {
    if (user.role === Role.TEACHER || user.role === Role.ADMIN) {
      const raw = await this.prisma.assignment.findMany({
        where:
          user.role === Role.ADMIN
            ? {}
            : { teacherId: user.sub },
        include: {
          class: { select: { name: true } },
          _count: { select: { completions: true } },
          completions: {
            include: {
              student: { select: { id: true, fullName: true } },
              session: {
                include: {
                  attempts: {
                    select: { isCorrect: true, responseMs: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return raw.map((a) => ({
        ...a,
        completions: a.completions.map((c) => {
          const attempts = c.session?.attempts ?? [];
          const total = attempts.length;
          const correct = attempts.filter((att) => att.isCorrect).length;
          const avgMs =
            total > 0
              ? Math.round(
                  attempts.reduce((acc, att) => acc + att.responseMs, 0) /
                    total,
                )
              : 0;
          return {
            id: c.id,
            studentId: c.studentId,
            student: c.student,
            completedAt: c.completedAt,
            score: {
              total,
              correct,
              accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
              avgMs,
            },
          };
        }),
      }));
    }

    // Student: get assignments from enrolled classes
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: user.sub },
      select: { classId: true },
    });

    const classIds = enrollments.map((e) => e.classId);

    if (classIds.length === 0) {
      return [];
    }

    const assignments = await this.prisma.assignment.findMany({
      where: { classId: { in: classIds } },
      include: {
        class: { select: { name: true } },
        completions: {
          where: { studentId: user.sub },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Return only pending (uncompleted) assignments
    return assignments.filter((a) => a.completions.length === 0);
  }

  async getById(user: AuthUser, id: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: {
        class: {
          select: {
            name: true,
            enrollments: { select: { studentId: true } },
          },
        },
        completions: {
          include: {
            student: { select: { id: true, fullName: true } },
            session: {
              include: {
                attempts: {
                  select: { isCorrect: true, responseMs: true },
                },
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    // Compute summary stats for each completion
    const completionsWithStats = assignment.completions.map((c) => {
      const attempts = c.session?.attempts ?? [];
      const total = attempts.length;
      const correct = attempts.filter((a) => a.isCorrect).length;
      const avgMs =
        total > 0
          ? Math.round(
              attempts.reduce((acc, a) => acc + a.responseMs, 0) / total,
            )
          : 0;

      return {
        id: c.id,
        studentId: c.studentId,
        student: c.student,
        completedAt: c.completedAt,
        score: { total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0, avgMs },
      };
    });

    return {
      ...assignment,
      completions: completionsWithStats,
    };
  }

  async start(user: AuthUser, assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        completions: {
          where: { studentId: user.sub },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.completions.length > 0) {
      throw new BadRequestException('Assignment already completed');
    }

    // Verify the student is enrolled in the assignment's class
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        classId: assignment.classId,
        studentId: user.sub,
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('Not enrolled in this class');
    }

    // Start a session with the assignment's settings
    const result = await this.sessionsService.startSession(user, {
      ageGroup: assignment.ageGroup,
      mode: assignment.mode,
      categories: assignment.categories,
      totalExercises: assignment.totalExercises,
      difficulty: assignment.difficulty,
      classId: assignment.classId,
    });

    // Create the completion record linked to this session
    await this.prisma.assignmentCompletion.create({
      data: {
        assignmentId,
        studentId: user.sub,
        sessionId: result.session.id,
      },
    });

    return result;
  }

  async remove(user: AuthUser, id: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (
      user.role === Role.TEACHER &&
      assignment.teacherId !== user.sub
    ) {
      throw new ForbiddenException('Not your assignment');
    }

    await this.prisma.assignment.delete({ where: { id } });
    return { deleted: true };
  }
}
