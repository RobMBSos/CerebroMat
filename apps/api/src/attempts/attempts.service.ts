import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AgeGroup, ExerciseCategory, Prisma, Role } from '@prisma/client';
import { BulkAttemptsDto, calculateAdaptiveLevel } from '@cerebromat/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';

const maxLevelByAge: Record<AgeGroup, number> = {
  INFANT_3_5: 4,
  AGE_6_7: 6,
  AGE_8_9: 8,
  AGE_10_12: 12,
};

const responseThresholdByAge: Record<AgeGroup, number> = {
  INFANT_3_5: 12000,
  AGE_6_7: 10000,
  AGE_8_9: 8500,
  AGE_10_12: 7000,
};

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async bulkCreate(user: AuthUser, input: BulkAttemptsDto) {
    const session = await this.prisma.exerciseSession.findUnique({
      where: { id: input.sessionId },
      include: {
        student: {
          include: {
            studentProfile: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.assertCanWriteAttempts(user, session.studentId);

    if (input.attempts.length === 0) {
      throw new BadRequestException('No attempts to create');
    }

    const createManyData = input.attempts.map((attempt) => ({
      sessionId: session.id,
      studentId: session.studentId,
      category: attempt.category,
      level: attempt.level,
      prompt: attempt.prompt,
      operands: attempt.operands,
      expectedAnswer: attempt.expectedAnswer,
      studentAnswer: attempt.studentAnswer,
      isCorrect: attempt.isCorrect,
      responseMs: attempt.responseMs,
      metadata: attempt.metadata as Prisma.InputJsonValue | undefined,
      answeredAt: attempt.answeredAt
        ? new Date(attempt.answeredAt)
        : new Date(),
    }));

    const result = await this.prisma.exerciseAttempt.createMany({
      data: createManyData,
    });

    const ageGroup =
      session.student.studentProfile?.ageGroup ?? session.ageGroup;
    const categories = [
      ...new Set(input.attempts.map((attempt) => attempt.category)),
    ];
    const updatedSkills = await this.updateAdaptiveLevels(
      session.studentId,
      ageGroup,
      categories,
    );

    return {
      created: result.count,
      updatedSkills,
    };
  }

  private async updateAdaptiveLevels(
    studentId: string,
    ageGroup: AgeGroup,
    categories: ExerciseCategory[],
  ) {
    const updated: Array<{
      category: ExerciseCategory;
      previousLevel: number;
      currentLevel: number;
    }> = [];

    for (const category of categories) {
      const skill = await this.prisma.studentSkill.upsert({
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

      const attempts = await this.prisma.exerciseAttempt.findMany({
        where: {
          studentId,
          category,
        },
        orderBy: {
          answeredAt: 'desc',
        },
        take: 20,
      });

      const nextLevel = calculateAdaptiveLevel({
        currentLevel: skill.currentLevel,
        maxLevel: maxLevelByAge[ageGroup],
        minLevel: 1,
        responseThresholdMs: responseThresholdByAge[ageGroup],
        attempts: attempts.map((attempt) => ({
          isCorrect: attempt.isCorrect,
          responseMs: attempt.responseMs,
        })),
      });

      if (nextLevel !== skill.currentLevel) {
        await this.prisma.studentSkill.update({
          where: { id: skill.id },
          data: { currentLevel: nextLevel },
        });
      }

      updated.push({
        category,
        previousLevel: skill.currentLevel,
        currentLevel: nextLevel,
      });
    }

    return updated;
  }

  private async assertCanWriteAttempts(user: AuthUser, studentId: string) {
    if (user.role === Role.ADMIN) {
      return;
    }

    if (user.role === Role.STUDENT && user.sub === studentId) {
      return;
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

    throw new ForbiddenException('You cannot submit attempts for this student');
  }
}
