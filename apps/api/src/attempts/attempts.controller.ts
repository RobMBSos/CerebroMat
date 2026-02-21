import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { bulkAttemptsSchema } from '@cerebromat/shared';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../common/types/auth-user.type';
import { AttemptsService } from './attempts.service';

@ApiTags('attempts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attempts')
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post('bulk')
  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  bulkCreate(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(bulkAttemptsSchema))
    body: z.infer<typeof bulkAttemptsSchema>,
  ) {
    return this.attemptsService.bulkCreate(user, body);
  }
}
