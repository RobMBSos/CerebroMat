import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  studentHistoryQuerySchema,
  studentOverviewQuerySchema,
} from '@cerebromat/shared';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../common/types/auth-user.type';
import { StudentsService } from './students.service';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('classId') classId?: string) {
    return this.studentsService.listStudents(user, classId);
  }

  @Get('overview')
  overview(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(studentOverviewQuerySchema))
    query: z.infer<typeof studentOverviewQuerySchema>,
  ) {
    return this.studentsService.getStudentsOverview(user, query);
  }

  @Get(':id/history')
  history(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(studentHistoryQuerySchema))
    query: z.infer<typeof studentHistoryQuerySchema>,
  ) {
    return this.studentsService.getStudentHistory(user, id, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studentsService.getStudentById(user, id);
  }
}
