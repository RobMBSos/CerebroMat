import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createClassSchema,
  createInviteSchema,
  updateClassSchema,
} from '@cerebromat/shared';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ClassesService } from './classes.service';

const joinSchema = z.object({
  code: z.string().min(4).max(20),
});

@ApiTags('classes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Roles('TEACHER', 'ADMIN')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createClassSchema))
    body: z.infer<typeof createClassSchema>,
  ) {
    return this.classesService.createClass(user, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.classesService.listClasses(user);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.classesService.getClassById(user, id);
  }

  @Patch(':id')
  @Roles('TEACHER', 'ADMIN')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateClassSchema))
    body: z.infer<typeof updateClassSchema>,
  ) {
    return this.classesService.updateClass(user, id, body);
  }

  @Delete(':id')
  @Roles('TEACHER', 'ADMIN')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.classesService.deleteClass(user, id);
  }

  @Post(':id/invites')
  @Roles('TEACHER', 'ADMIN')
  createInvite(
    @CurrentUser() user: AuthUser,
    @Param('id') classId: string,
    @Body(new ZodValidationPipe(createInviteSchema))
    body: z.infer<typeof createInviteSchema>,
  ) {
    return this.classesService.createInviteCode(user, classId, body);
  }

  @Post('join')
  @Roles('STUDENT', 'PARENT')
  join(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(joinSchema)) body: z.infer<typeof joinSchema>,
  ) {
    return this.classesService.joinWithCode(user, body.code);
  }
}
