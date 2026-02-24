import { z } from 'zod';

export const UserPreferencesSchema = z.object({
  theme: z.string().default('ternity-dark'),
  scale: z.number().default(1.1),
  confirmTimerSwitch: z.boolean().default(true),
  defaultProjectId: z.string().nullable().default(null),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const UserPreferencesPatchSchema = UserPreferencesSchema.partial();

export type UserPreferencesPatch = z.infer<typeof UserPreferencesPatchSchema>;
