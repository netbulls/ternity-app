import { z } from 'zod';

export const ProjectOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  clientName: z.string().nullable(),
});

export type ProjectOption = z.infer<typeof ProjectOptionSchema>;

export const TagOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
});

export type TagOption = z.infer<typeof TagOptionSchema>;

export const CreateTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().nullable().optional(),
});

export type CreateTag = z.infer<typeof CreateTagSchema>;

export const UpdateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().nullable().optional(),
});

export type UpdateTag = z.infer<typeof UpdateTagSchema>;

export const UserOptionSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  globalRole: z.string(),
  active: z.boolean(),
});

export type UserOption = z.infer<typeof UserOptionSchema>;
