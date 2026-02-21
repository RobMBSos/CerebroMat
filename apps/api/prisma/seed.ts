import argon2 from 'argon2';
import {
  AgeGroup,
  ExerciseCategory,
  ExerciseMode,
  PrismaClient,
  Role,
  SessionStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo12345!';

async function upsertUser(input: {
  email: string;
  fullName: string;
  role: Role;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      fullName: input.fullName,
      role: input.role,
      passwordHash: input.passwordHash,
    },
    create: input,
  });
}

async function main() {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  const admin = await upsertUser({
    email: 'admin@demo.local',
    fullName: 'Admin Demo',
    role: Role.ADMIN,
    passwordHash,
  });

  const teacher = await upsertUser({
    email: 'teacher@demo.local',
    fullName: 'Profe Laura',
    role: Role.TEACHER,
    passwordHash,
  });

  const student = await upsertUser({
    email: 'student@demo.local',
    fullName: 'Mateo García',
    role: Role.STUDENT,
    passwordHash,
  });

  const parent = await upsertUser({
    email: 'parent@demo.local',
    fullName: 'Marta Madre',
    role: Role.PARENT,
    passwordHash,
  });

  await prisma.teacherProfile.upsert({
    where: { userId: teacher.id },
    update: { schoolName: 'Colegio Demo Local' },
    create: {
      userId: teacher.id,
      schoolName: 'Colegio Demo Local',
    },
  });

  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: { ageGroup: AgeGroup.AGE_8_9, nickname: 'Mati' },
    create: {
      userId: student.id,
      ageGroup: AgeGroup.AGE_8_9,
      nickname: 'Mati',
    },
  });

  await prisma.parentProfile.upsert({
    where: { userId: parent.id },
    update: {},
    create: { userId: parent.id },
  });

  const existingClass = await prisma.class.findFirst({
    where: {
      teacherId: teacher.id,
      name: 'Clase Arcoiris 3A',
    },
  });

  const classroom = existingClass
    ? await prisma.class.update({
        where: { id: existingClass.id },
        data: {
          description: 'Curso demo para pruebas locales',
        },
      })
    : await prisma.class.create({
        data: {
          name: 'Clase Arcoiris 3A',
          description: 'Curso demo para pruebas locales',
          teacherId: teacher.id,
        },
      });

  await prisma.enrollment.upsert({
    where: {
      classId_studentId: {
        classId: classroom.id,
        studentId: student.id,
      },
    },
    update: {},
    create: {
      classId: classroom.id,
      studentId: student.id,
    },
  });

  await prisma.parentStudentLink.upsert({
    where: {
      parentId_studentId: {
        parentId: parent.id,
        studentId: student.id,
      },
    },
    update: {},
    create: {
      parentId: parent.id,
      studentId: student.id,
    },
  });

  const allCategories = [
    ExerciseCategory.ADDITION,
    ExerciseCategory.SUBTRACTION,
    ExerciseCategory.MULTIPLICATION,
    ExerciseCategory.DIVISION,
    ExerciseCategory.WORD_PROBLEM,
  ];

  for (const category of allCategories) {
    await prisma.studentSkill.upsert({
      where: {
        studentId_category: {
          studentId: student.id,
          category,
        },
      },
      update: { currentLevel: 1 },
      create: {
        studentId: student.id,
        category,
        currentLevel: 1,
      },
    });
  }

  const now = new Date();
  const session = await prisma.exerciseSession.create({
    data: {
      studentId: student.id,
      classId: classroom.id,
      ageGroup: AgeGroup.AGE_8_9,
      mode: ExerciseMode.MIXED,
      totalExercises: 10,
      status: SessionStatus.FINISHED,
      startedAt: new Date(now.getTime() - 20 * 60 * 1000),
      finishedAt: now,
    },
  });

  await prisma.exerciseAttempt.createMany({
    data: [
      {
        sessionId: session.id,
        studentId: student.id,
        category: ExerciseCategory.ADDITION,
        level: 1,
        prompt: '8 + 7 = ?',
        operands: [8, 7],
        expectedAnswer: '15',
        studentAnswer: '15',
        isCorrect: true,
        responseMs: 4200,
      },
      {
        sessionId: session.id,
        studentId: student.id,
        category: ExerciseCategory.MULTIPLICATION,
        level: 1,
        prompt: '6 x 4 = ?',
        operands: [6, 4],
        expectedAnswer: '24',
        studentAnswer: '20',
        isCorrect: false,
        responseMs: 6100,
      },
      {
        sessionId: session.id,
        studentId: student.id,
        category: ExerciseCategory.WORD_PROBLEM,
        level: 1,
        prompt: 'Ana tiene 5 galletas y compra 3. ¿Cuántas tiene?',
        operands: [5, 3],
        expectedAnswer: '8',
        studentAnswer: '8',
        isCorrect: true,
        responseMs: 9300,
      },
    ],
  });

  await prisma.inviteCode.upsert({
    where: { code: 'STU3A2026' },
    update: {
      type: 'STUDENT',
      classId: classroom.id,
      createdById: teacher.id,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    create: {
      code: 'STU3A2026',
      type: 'STUDENT',
      classId: classroom.id,
      createdById: teacher.id,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.inviteCode.upsert({
    where: { code: 'PAR3A2026' },
    update: {
      type: 'PARENT',
      classId: classroom.id,
      createdById: teacher.id,
      studentId: student.id,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    create: {
      code: 'PAR3A2026',
      type: 'PARENT',
      classId: classroom.id,
      createdById: teacher.id,
      studentId: student.id,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Seed complete. Demo users created: admin, teacher, student, parent');
  console.log(`Default password for all demo users: ${DEMO_PASSWORD}`);
  console.log({
    admin: admin.email,
    teacher: teacher.email,
    student: student.email,
    parent: parent.email,
    classId: classroom.id,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
