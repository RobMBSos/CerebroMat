import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listUsers() {
    return this.prisma.user.findMany({
      include: {
        teacherProfile: true,
        studentProfile: true,
        parentProfile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateUserRole(userId: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    if (role === Role.TEACHER) {
      await this.prisma.teacherProfile.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });
    }

    if (role === Role.STUDENT) {
      await this.prisma.studentProfile.upsert({
        where: { userId },
        update: {},
        create: { userId, ageGroup: 'AGE_6_7' },
      });
    }

    if (role === Role.PARENT) {
      await this.prisma.parentProfile.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });
    }

    return updated;
  }

  listClasses() {
    return this.prisma.class.findMany({
      include: {
        teacher: {
          select: { id: true, fullName: true, email: true },
        },
        _count: {
          select: {
            enrollments: true,
            invites: true,
            sessions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
