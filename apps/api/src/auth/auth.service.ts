import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ParentProfile,
  Role,
  StudentProfile,
  TeacherProfile,
  User,
} from '@prisma/client';
import argon2 from 'argon2';
import { LoginDto, RefreshDto, RegisterDto } from '@cerebromat/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { Env } from '../config/env';

type UserWithProfiles = User & {
  teacherProfile: TeacherProfile | null;
  studentProfile: StudentProfile | null;
  parentProfile: ParentProfile | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(
    input: RegisterDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const role = input.role ?? Role.STUDENT;
    const passwordHash = await argon2.hash(input.password);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role,
      },
    });

    await this.ensureProfile(user.id, role);

    const tokens = await this.issueTokens(user, meta);

    return {
      user: await this.getPublicUser(user.id),
      ...tokens,
    };
  }

  async login(
    input: LoginDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user, meta);
    return {
      user: await this.getPublicUser(user.id),
      ...tokens,
    };
  }

  async refresh(
    input: RefreshDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const payload = await this.verifyRefreshToken(input.refreshToken);

    const activeTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    let matchedTokenId: string | null = null;
    for (const token of activeTokens) {
      const same = await argon2.verify(token.tokenHash, input.refreshToken);
      if (same) {
        matchedTokenId = token.id;
        break;
      }
    }

    if (!matchedTokenId) {
      throw new UnauthorizedException('Refresh token is invalid or revoked');
    }

    await this.prisma.refreshToken.update({
      where: { id: matchedTokenId },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.issueTokens(user, meta);
    return {
      user: await this.getPublicUser(user.id),
      ...tokens,
    };
  }

  async logout(userId: string, refreshToken?: string) {
    if (!refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return { success: true };
    }

    const payload = await this.verifyRefreshToken(refreshToken);
    if (payload.sub !== userId) {
      throw new BadRequestException(
        'Refresh token does not belong to current user',
      );
    }

    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
      },
    });

    for (const token of tokens) {
      if (await argon2.verify(token.tokenHash, refreshToken)) {
        await this.prisma.refreshToken.update({
          where: { id: token.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }

    return { success: true };
  }

  async me(userId: string) {
    return this.getPublicUser(userId);
  }

  private async ensureProfile(userId: string, role: Role) {
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
        create: {
          userId,
          ageGroup: 'AGE_6_7',
        },
      });
    }

    if (role === Role.PARENT) {
      await this.prisma.parentProfile.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });
    }
  }

  private async issueTokens(
    user: User,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES', { infer: true }),
      },
    );

    const refreshDays = this.config.get('JWT_REFRESH_EXPIRES_DAYS', {
      infer: true,
    });

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        type: 'refresh',
      },
      {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: `${refreshDays}d`,
      },
    );

    const refreshHash = await argon2.hash(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshHash,
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000),
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<{ sub: string; type?: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        type?: string;
      }>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });

      if (payload.type && payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async getPublicUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        teacherProfile: true,
        studentProfile: true,
        parentProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.stripSecretFields(user);
  }

  private stripSecretFields(user: UserWithProfiles) {
    const safeUser = { ...user };
    delete (safeUser as Partial<UserWithProfiles>).passwordHash;
    return safeUser;
  }
}
