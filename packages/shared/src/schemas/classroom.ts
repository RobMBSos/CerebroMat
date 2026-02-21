import { z } from 'zod';

export const createClassSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(240).optional(),
});

export const updateClassSchema = createClassSchema.partial();

export const createInviteSchema = z.object({
  type: z.enum(['STUDENT', 'PARENT']),
  studentId: z.string().cuid().optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export type CreateClassDto = z.infer<typeof createClassSchema>;
export type UpdateClassDto = z.infer<typeof updateClassSchema>;
export type CreateInviteDto = z.infer<typeof createInviteSchema>;
