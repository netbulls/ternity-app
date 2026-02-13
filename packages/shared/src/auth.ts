import { z } from 'zod';
import { GlobalRole, OrgRole } from './roles.js';

/**
 * Represents the authenticated user context attached to every request.
 * In stub mode this is derived from X-Dev-User-Id header.
 * In logto mode this is derived from the JWT access token.
 */
export const AuthContextSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  globalRole: z.nativeEnum(GlobalRole),
  /** Organization (project) roles — key is projectId */
  orgRoles: z.record(z.string(), z.nativeEnum(OrgRole)),
});

export type AuthContext = z.infer<typeof AuthContextSchema>;
