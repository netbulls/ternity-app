import { z } from 'zod';

export const ProjectOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  clientName: z.string().nullable(),
});

export type ProjectOption = z.infer<typeof ProjectOptionSchema>;

export const LabelOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
});

export type LabelOption = z.infer<typeof LabelOptionSchema>;

export const UserOptionSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  globalRole: z.string(),
  active: z.boolean(),
});

export type UserOption = z.infer<typeof UserOptionSchema>;
