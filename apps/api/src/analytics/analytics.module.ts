import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { StudentsModule } from '../students/students.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [StudentsModule, ClassesModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
