import { z } from 'zod';
import { OrgRole } from './roles.js';

// ── Project member as seen from the project side (V5 Bulk Matrix) ───
export interface ProjectMemberRow {
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  globalRole: string;
  active: boolean;
  role: string; // OrgRole — 'manager' | 'user'
  assigned: boolean;
}

// ── Project assignment as seen from the user side (V4 Inline Table) ─
export interface UserProjectRow {
  projectId: string;
  projectName: string;
  projectColor: string;
  clientName: string | null;
  isActive: boolean;
  role: string; // OrgRole — 'manager' | 'user'
  assigned: boolean;
}

// ── Mutations ───────────────────────────────────────────────────────
export const SetProjectMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(OrgRole).optional().default(OrgRole.User),
});
export type SetProjectMember = z.infer<typeof SetProjectMemberSchema>;

export const RemoveProjectMemberSchema = z.object({
  userId: z.string().uuid(),
});
export type RemoveProjectMember = z.infer<typeof RemoveProjectMemberSchema>;

export const BulkSetProjectMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
  role: z.nativeEnum(OrgRole).optional().default(OrgRole.User),
});
export type BulkSetProjectMembers = z.infer<typeof BulkSetProjectMembersSchema>;

export const BulkRemoveProjectMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});
export type BulkRemoveProjectMembers = z.infer<typeof BulkRemoveProjectMembersSchema>;

export const SetUserProjectSchema = z.object({
  projectId: z.string().uuid(),
  role: z.nativeEnum(OrgRole).optional().default(OrgRole.User),
});
export type SetUserProject = z.infer<typeof SetUserProjectSchema>;

export const RemoveUserProjectSchema = z.object({
  projectId: z.string().uuid(),
});
export type RemoveUserProject = z.infer<typeof RemoveUserProjectSchema>;

export const UpdateMemberRoleSchema = z.object({
  role: z.nativeEnum(OrgRole),
});
export type UpdateMemberRole = z.infer<typeof UpdateMemberRoleSchema>;
