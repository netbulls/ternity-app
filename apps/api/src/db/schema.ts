import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  integer,
  date,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ── Enums ──────────────────────────────────────────────────────────────────

export const globalRoleEnum = pgEnum('global_role', ['admin', 'user']);
export const orgRoleEnum = pgEnum('org_role', ['manager', 'user']);
export const leaveStatusEnum = pgEnum('leave_status', ['pending', 'approved', 'rejected']);

// ── Users ──────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    externalAuthId: text('external_auth_id'),
    displayName: text('display_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    avatarUrl: text('avatar_url'),
    globalRole: globalRoleEnum('global_role').notNull().default('user'),
    themePreference: text('theme_preference').default('ternity-dark'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_external_auth_id_idx').on(t.externalAuthId)],
);

// ── Clients ────────────────────────────────────────────────────────────────

export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Projects ───────────────────────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id),
  name: text('name').notNull(),
  color: text('color').notNull().default('#00D4AA'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Project Members ────────────────────────────────────────────────────────

export const projectMembers = pgTable(
  'project_members',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    role: orgRoleEnum('role').notNull().default('user'),
  },
  (t) => [uniqueIndex('project_members_user_project_idx').on(t.userId, t.projectId)],
);

// ── Labels ─────────────────────────────────────────────────────────────────

export const labels = pgTable('labels', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Time Entries ───────────────────────────────────────────────────────────

export const timeEntries = pgTable('time_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  description: text('description').notNull().default(''),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  stoppedAt: timestamp('stopped_at', { withTimezone: true }),
  durationSeconds: integer('duration_seconds'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Entry Labels (join table) ──────────────────────────────────────────────

export const entryLabels = pgTable(
  'entry_labels',
  {
    entryId: uuid('entry_id')
      .notNull()
      .references(() => timeEntries.id),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id),
  },
  (t) => [uniqueIndex('entry_labels_entry_label_idx').on(t.entryId, t.labelId)],
);

// ── Leave Types ────────────────────────────────────────────────────────────

export const leaveTypes = pgTable('leave_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  daysPerYear: integer('days_per_year').notNull(),
});

// ── Leave Allowances ───────────────────────────────────────────────────────

export const leaveAllowances = pgTable('leave_allowances', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  leaveTypeId: uuid('leave_type_id')
    .notNull()
    .references(() => leaveTypes.id),
  year: integer('year').notNull(),
  totalDays: integer('total_days').notNull(),
  usedDays: integer('used_days').notNull().default(0),
});

// ── Leave Requests ─────────────────────────────────────────────────────────

export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  leaveTypeId: uuid('leave_type_id')
    .notNull()
    .references(() => leaveTypes.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  daysCount: integer('days_count').notNull(),
  note: text('note'),
  status: leaveStatusEnum('status').notNull().default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
