import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { analyticsQuerySchema } from '@cerebromat/shared';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../common/types/auth-user.type';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('student-series')
  studentSeries(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(analyticsQuerySchema))
    query: z.infer<typeof analyticsQuerySchema>,
  ) {
    return this.analyticsService.getStudentSeries(user, query);
  }
}
