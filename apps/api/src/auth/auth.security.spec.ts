import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { registerSchema, type RegisterDto } from '@cerebromat/shared';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Env } from '../config/env';

const signup = {
  email: 'signup@example.test',
  password: 'Test-only-password-123',
  fullName: 'Test Signup',
};

describe('Public registration privileges', () => {
  it('rejects administrator registration at the request boundary', () => {
    expect(registerSchema.safeParse({ ...signup, role: 'ADMIN' }).success).toBe(
      false,
    );
  });

  it.each(['TEACHER', 'PARENT', 'STUDENT', undefined])(
    'allows the supported public role %s',
    (role) => {
      expect(registerSchema.safeParse({ ...signup, role }).success).toBe(true);
    },
  );

  it('also rejects an administrator before querying or writing the database', async () => {
    const findUnique = jest.fn();
    const create = jest.fn();
    const prisma = { user: { findUnique, create } } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      {} as JwtService,
      {} as ConfigService<Env, true>,
    );
    await expect(
      service.register({ ...signup, role: 'ADMIN' } as unknown as RegisterDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
