import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createAssignmentSchema } from '@cerebromat/shared';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AssignmentsService } from './assignments.service';

@ApiTags('assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles('TEACHER', 'ADMIN')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createAssignmentSchema))
    body: z.infer<typeof createAssignmentSchema>,
  ) {
    return this.assignmentsService.create(user, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.assignmentsService.list(user);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assignmentsService.getById(user, id);
  }

  @Post(':id/start')
  @Roles('STUDENT')
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assignmentsService.start(user, id);
  }

  @Delete(':id')
  @Roles('TEACHER', 'ADMIN')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assignmentsService.remove(user, id);
  }
}
