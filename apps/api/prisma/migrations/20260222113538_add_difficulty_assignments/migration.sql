-- CreateEnum
CREATE TYPE "public"."Difficulty" AS ENUM ('EASY', 'NORMAL', 'HARD');

-- AlterTable
ALTER TABLE "public"."ExerciseSession" ADD COLUMN     "difficulty" "public"."Difficulty" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "public"."Assignment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "ageGroup" "public"."AgeGroup" NOT NULL,
    "mode" "public"."ExerciseMode" NOT NULL,
    "categories" "public"."ExerciseCategory"[],
    "totalExercises" INTEGER NOT NULL,
    "difficulty" "public"."Difficulty" NOT NULL DEFAULT 'NORMAL',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssignmentCompletion" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentCompletion_sessionId_key" ON "public"."AssignmentCompletion"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentCompletion_assignmentId_studentId_key" ON "public"."AssignmentCompletion"("assignmentId", "studentId");

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignmentCompletion" ADD CONSTRAINT "AssignmentCompletion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignmentCompletion" ADD CONSTRAINT "AssignmentCompletion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignmentCompletion" ADD CONSTRAINT "AssignmentCompletion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ExerciseSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
