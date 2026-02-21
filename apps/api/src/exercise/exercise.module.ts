import { Module } from '@nestjs/common';
import { ExerciseGeneratorService } from './exercise.generator';

@Module({
  providers: [ExerciseGeneratorService],
  exports: [ExerciseGeneratorService],
})
export class ExerciseModule {}
