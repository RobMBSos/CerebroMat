import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  CreateClassDto,
  CreateInviteDto,
  UpdateClassDto,
} from '@cerebromat/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async createClass(user: AuthUser, input: CreateClassDto) {
    if (user.role !== Role.TEACHER && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only teacher or admin can create classes');
    }

    const teacherId = await this.resolveTeacherId(user);

    return this.prisma.class.create({
      data: {
        name: input.name,
        description: input.description,
        teacherId,
      },
      include: {
        teacher: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async listClasses(user: AuthUser) {
    if (user.role === Role.ADMIN) {
      return this.prisma.class.findMany({
        include: {
          teacher: {
            select: { id: true, fullName: true, email: true },
          },
          _count: {
            select: { enrollments: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    if (user.role === Role.TEACHER) {
      return this.prisma.class.findMany({
        where: { teacherId: user.sub },
        include: {
          _count: {
            select: { enrollments: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    if (user.role === Role.STUDENT) {
      return this.prisma.class.findMany({
        where: {
          enrollments: {
            some: {
              studentId: user.sub,
            },
          },
        },
        include: {
          teacher: {
            select: { id: true, fullName: true },
          },
        },
      });
    }

    return this.prisma.class.findMany({
      where: {
        enrollments: {
          some: {
            student: {
              childLinks: {
                some: {
                  parentId: user.sub,
                },
              },
            },
          },
        },
      },
      include: {
        teacher: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  async getClassById(user: AuthUser, classId: string) {
    const classroom = await this.prisma.class.findUnique({
      where: { id: classId },
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
        invites: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!classroom) {
      throw new NotFoundException('Class not found');
    }

    await this.assertCanViewClass(user, classroom.id);

    return classroom;
  }

  async updateClass(user: AuthUser, classId: string, input: UpdateClassDto) {
    await this.assertCanManageClass(user, classId);

    return this.prisma.class.update({
      where: { id: classId },
      data: {
        name: input.name,
        description: input.description,
      },
    });
  }

  async deleteClass(user: AuthUser, classId: string) {
    await this.assertCanManageClass(user, classId);

    await this.prisma.class.delete({ where: { id: classId } });
    return { success: true };
  }

  async createInviteCode(
    user: AuthUser,
    classId: string,
    input: CreateInviteDto,
  ) {
    await this.assertCanManageClass(user, classId);

    if (input.type === 'PARENT' && !input.studentId) {
      throw new BadRequestException(
        'studentId is required for parent invite codes',
      );
    }

    const expiresAt = new Date(
      Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
    );

    return this.prisma.inviteCode.create({
      data: {
        code: this.generateCode(input.type === 'STUDENT' ? 'STU' : 'PAR'),
        type: input.type,
        classId,
        createdById: user.sub,
        studentId: input.studentId,
        expiresAt,
      },
    });
  }

  async joinWithCode(user: AuthUser, code: string) {
    const invite = await this.prisma.inviteCode.findUnique({
      where: { code },
      include: {
        class: true,
      },
    });

    if (!invite) {
      throw new NotFoundException('Invite code not found');
    }

    if (invite.usedAt) {
      throw new BadRequestException('Invite code already used');
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite code expired');
    }

    if (invite.type === 'STUDENT') {
      if (user.role !== Role.STUDENT) {
        throw new ForbiddenException('Only students can use this code');
      }

      await this.prisma.enrollment.upsert({
        where: {
          classId_studentId: {
            classId: invite.classId,
            studentId: user.sub,
          },
        },
        update: {},
        create: {
          classId: invite.classId,
          studentId: user.sub,
        },
      });
    }

    if (invite.type === 'PARENT') {
      if (user.role !== Role.PARENT) {
        throw new ForbiddenException('Only parents can use this code');
      }

      if (!invite.studentId) {
        throw new BadRequestException(
          'Parent invite code has no student target',
        );
      }

      await this.prisma.parentStudentLink.upsert({
        where: {
          parentId_studentId: {
            parentId: user.sub,
            studentId: invite.studentId,
          },
        },
        update: {},
        create: {
          parentId: user.sub,
          studentId: invite.studentId,
        },
      });
    }

    await this.prisma.inviteCode.update({
      where: { id: invite.id },
      data: {
        usedAt: new Date(),
        usedById: user.sub,
      },
    });

    return {
      success: true,
      classId: invite.classId,
      className: invite.class.name,
      inviteType: invite.type,
    };
  }

  async assertCanViewClass(user: AuthUser, classId: string) {
    if (user.role === Role.ADMIN) {
      return;
    }

    if (user.role === Role.TEACHER) {
      const ownClass = await this.prisma.class.findFirst({
        where: {
          id: classId,
          teacherId: user.sub,
        },
      });

      if (!ownClass) {
        throw new ForbiddenException('No access to class');
      }

      return;
    }

    if (user.role === Role.STUDENT) {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          classId,
          studentId: user.sub,
        },
      });

      if (!enrollment) {
        throw new ForbiddenException('No access to class');
      }

      return;
    }

    const link = await this.prisma.parentStudentLink.findFirst({
      where: {
        parentId: user.sub,
        student: {
          enrollments: {
            some: {
              classId,
            },
          },
        },
      },
    });

    if (!link) {
      throw new ForbiddenException('No access to class');
    }
  }

  async assertCanManageClass(user: AuthUser, classId: string) {
    if (user.role === Role.ADMIN) {
      return;
    }

    if (user.role !== Role.TEACHER) {
      throw new ForbiddenException('Only teacher/admin can manage classes');
    }

    const ownClass = await this.prisma.class.findFirst({
      where: {
        id: classId,
        teacherId: user.sub,
      },
    });

    if (!ownClass) {
      throw new ForbiddenException('You cannot manage this class');
    }
  }

  private async resolveTeacherId(user: AuthUser): Promise<string> {
    if (user.role === Role.TEACHER) {
      return user.sub;
    }

    const teacher = await this.prisma.user.findFirst({
      where: { role: Role.TEACHER },
    });
    if (!teacher) {
      throw new BadRequestException('No teacher available. Create one first.');
    }

    return teacher.id;
  }

  private generateCode(prefix: string): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 8; i += 1) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }

    return `${prefix}${suffix}`;
  }
}
