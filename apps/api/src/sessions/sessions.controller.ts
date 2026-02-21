import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { finishSessionSchema, startSessionSchema } from '@cerebromat/shared';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SessionsService } from './sessions.service';

const startExtendedSchema = startSessionSchema.extend({
  classId: z.string().cuid().optional(),
  studentId: z.string().cuid().optional(),
});

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('start')
  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  start(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(startExtendedSchema))
    body: z.infer<typeof startExtendedSchema>,
  ) {
    return this.sessionsService.startSession(user, body);
  }

  @Post(':id/finish')
  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  finish(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(finishSessionSchema))
    body: z.infer<typeof finishSessionSchema>,
  ) {
    return this.sessionsService.finishSession(user, id, body.summary);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessionsService.getSession(user, id);
  }
}
