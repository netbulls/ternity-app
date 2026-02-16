import { z } from 'zod';

// ── Admin Project (returned by GET /api/admin/projects) ─────────────────
export interface AdminProject {
  id: string;
  name: string;
  color: string;
  description: string | null;
  isActive: boolean;
  clientId: string;
  clientName: string;
  clientIsActive: boolean;
  entryCount: number;
}

// ── Admin Client (returned by GET /api/admin/clients) ───────────────────
export interface AdminClient {
  id: string;
  name: string;
  isActive: boolean;
  projectCount: number;
  activeProjectCount: number;
  entryCount: number;
}

// ── Mutations ───────────────────────────────────────────────────────────
export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  clientId: z.string().uuid(),
  color: z.string().optional(),
  description: z.string().max(1000).optional(),
});
export type CreateProject = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  clientId: z.string().uuid().optional(),
  color: z.string().optional(),
  description: z.string().max(1000).nullable().optional(),
});
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;

export const CreateClientSchema = z.object({
  name: z.string().min(1).max(200),
});
export type CreateClient = z.infer<typeof CreateClientSchema>;

export const UpdateClientSchema = z.object({
  name: z.string().min(1).max(200),
});
export type UpdateClient = z.infer<typeof UpdateClientSchema>;

// ── Preset Colors ───────────────────────────────────────────────────────
export const PROJECT_COLORS = [
  '#00D4AA', // teal (brand)
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#EF4444', // red
  '#F59E0B', // amber
  '#14B8A6', // teal-2
  '#6366F1', // indigo
  '#84CC16', // lime
  '#F97316', // orange
] as const;
