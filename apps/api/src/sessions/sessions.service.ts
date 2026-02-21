import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgeGroup,
  ExerciseCategory,
  ExerciseMode,
  Role,
  SessionStatus,
  StudentProfile,
} from '@prisma/client';
import { StartSessionDto } from '@cerebromat/shared';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { ExerciseGeneratorService } from '../exercise/exercise.generator';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: ExerciseGeneratorService,
  ) {}

  async startSession(
    user: AuthUser,
    input: StartSessionDto & { classId?: string; studentId?: string },
  ) {
    const studentId = this.resolveStudentId(user, input.studentId);

    const student = await this.prisma.user.findUnique({
      where: { id: studentId, role: Role.STUDENT },
      include: {
        studentProfile: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (input.classId) {
      await this.assertClassAccess(user, studentId, input.classId);
    }

    const categories = this.resolveCategories(input.mode, input.categories);
    await this.ensureStudentSkills(studentId, categories);
    const skillLevels = await this.getSkillLevels(studentId, categories);

    await this.syncAgeGroup(studentId, student.studentProfile, input.ageGroup);

    const session = await this.prisma.exerciseSession.create({
      data: {
        studentId,
        classId: input.classId,
        ageGroup: input.ageGroup,
        mode: input.mode,
        totalExercises: input.totalExercises,
        status: SessionStatus.STARTED,
      },
    });

    const exercises = this.generator.generateExercises({
      ageGroup: input.ageGroup,
      mode: input.mode,
      categories,
      totalExercises: input.totalExercises,
      currentLevels: skillLevels,
    });

    return {
      session,
      exercises,
    };
  }

  async finishSession(
    user: AuthUser,
    sessionId: string,
    summary?: {
      totalAttempts: number;
      correctAttempts: number;
      averageResponseMs: number;
    },
  ) {
    const session = await this.prisma.exerciseSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.assertSessionAccess(user, session.studentId);

    const updated = await this.prisma.exerciseSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.FINISHED,
        finishedAt: new Date(),
      },
      include: {
        attempts: true,
      },
    });

    return {
      session: updated,
      summary:
        summary ??
        this.buildSummary(
          updated.attempts.map((attempt) => ({
            isCorrect: attempt.isCorrect,
            responseMs: attempt.responseMs,
          })),
        ),
    };
  }

  async getSession(user: AuthUser, sessionId: string) {
    const session = await this.prisma.exerciseSession.findUnique({
      where: { id: sessionId },
      include: {
        attempts: {
          orderBy: {
            answeredAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.assertSessionAccess(user, session.studentId);

    return session;
  }

  private resolveCategories(
    mode: ExerciseMode,
    categories: ExerciseCategory[],
  ) {
    if (mode === ExerciseMode.WORD_PROBLEMS) {
      return [ExerciseCategory.WORD_PROBLEM];
    }

    if (mode === ExerciseMode.OPERATIONS) {
      const operation = categories.filter(
        (category) => category !== ExerciseCategory.WORD_PROBLEM,
      );
      if (operation.length > 0) {
        return operation;
      }

      return [
        ExerciseCategory.ADDITION,
        ExerciseCategory.SUBTRACTION,
        ExerciseCategory.MULTIPLICATION,
        ExerciseCategory.DIVISION,
      ];
    }

    return categories;
  }

  private async ensureStudentSkills(
    studentId: string,
    categories: ExerciseCategory[],
  ) {
    await Promise.all(
      categories.map(async (category) => {
        await this.prisma.studentSkill.upsert({
          where: {
            studentId_category: {
              studentId,
              category,
            },
          },
          update: {},
          create: {
            studentId,
            category,
            currentLevel: 1,
          },
        });
      }),
    );
  }

  private async getSkillLevels(
    studentId: string,
    categories: ExerciseCategory[],
  ) {
    const skills = await this.prisma.studentSkill.findMany({
      where: {
        studentId,
        category: { in: categories },
      },
    });

    return {
      ADDITION:
        skills.find((item) => item.category === ExerciseCategory.ADDITION)
          ?.currentLevel ?? 1,
      SUBTRACTION:
        skills.find((item) => item.category === ExerciseCategory.SUBTRACTION)
          ?.currentLevel ?? 1,
      MULTIPLICATION:
        skills.find((item) => item.category === ExerciseCategory.MULTIPLICATION)
          ?.currentLevel ?? 1,
      DIVISION:
        skills.find((item) => item.category === ExerciseCategory.DIVISION)
          ?.currentLevel ?? 1,
      WORD_PROBLEM:
        skills.find((item) => item.category === ExerciseCategory.WORD_PROBLEM)
          ?.currentLevel ?? 1,
    };
  }

  private async syncAgeGroup(
    studentId: string,
    profile: StudentProfile | null,
    ageGroup: AgeGroup,
  ) {
    if (!profile) {
      await this.prisma.studentProfile.create({
        data: {
          userId: studentId,
          ageGroup,
        },
      });
      return;
    }

    if (profile.ageGroup !== ageGroup) {
      await this.prisma.studentProfile.update({
        where: { userId: studentId },
        data: { ageGroup },
      });
    }
  }

  private resolveStudentId(user: AuthUser, requestedStudentId?: string) {
    if (user.role === Role.STUDENT) {
      return user.sub;
    }

    if (
      (user.role === Role.TEACHER || user.role === Role.ADMIN) &&
      requestedStudentId
    ) {
      return requestedStudentId;
    }

    throw new BadRequestException('studentId is required for teacher/admin');
  }

  private async assertSessionAccess(user: AuthUser, studentId: string) {
    if (user.role === Role.ADMIN) {
      return;
    }

    if (user.role === Role.STUDENT && user.sub === studentId) {
      return;
    }

    if (user.role === Role.PARENT) {
      const link = await this.prisma.parentStudentLink.findFirst({
        where: {
          parentId: user.sub,
          studentId,
        },
      });

      if (link) {
        return;
      }
    }

    if (user.role === Role.TEACHER) {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          studentId,
          class: {
            teacherId: user.sub,
          },
        },
      });

      if (enrollment) {
        return;
      }
    }

    throw new ForbiddenException('No permission for this session');
  }

  private async assertClassAccess(
    user: AuthUser,
    studentId: string,
    classId: string,
  ) {
    const classroom = await this.prisma.class.findUnique({
      where: { id: classId },
    });
    if (!classroom) {
      throw new NotFoundException('Class not found');
    }

    if (user.role === Role.ADMIN) {
      return;
    }

    if (user.role === Role.TEACHER) {
      if (classroom.teacherId !== user.sub) {
        throw new ForbiddenException('Teacher cannot use another class');
      }

      return;
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        classId,
        studentId,
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('Student is not enrolled in this class');
    }
  }

  private buildSummary(
    attempts: Array<{ isCorrect: boolean; responseMs: number }>,
  ) {
    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter(
      (attempt) => attempt.isCorrect,
    ).length;
    const averageResponseMs =
      totalAttempts > 0
        ? Math.round(
            attempts.reduce((acc, attempt) => acc + attempt.responseMs, 0) /
              totalAttempts,
          )
        : 0;

    return {
      totalAttempts,
      correctAttempts,
      averageResponseMs,
    };
  }
}
