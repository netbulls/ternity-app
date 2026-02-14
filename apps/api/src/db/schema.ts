import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  integer,
  boolean,
  date,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ── Enums ──────────────────────────────────────────────────────────────────

export const globalRoleEnum = pgEnum('global_role', ['admin', 'user']);
export const orgRoleEnum = pgEnum('org_role', ['manager', 'user']);
export const leaveStatusEnum = pgEnum('leave_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);
export const syncSourceEnum = pgEnum('sync_source', ['toggl', 'timetastic']);
export const syncRunStatusEnum = pgEnum('sync_run_status', ['running', 'completed', 'failed']);

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
    active: boolean('active').notNull().default(true),
    themePreference: text('theme_preference').default('ternity-dark'),
    togglId: text('toggl_id'),
    timetasticId: text('timetastic_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_external_auth_id_idx').on(t.externalAuthId),
    uniqueIndex('users_toggl_id_idx').on(t.togglId),
    uniqueIndex('users_timetastic_id_idx').on(t.timetasticId),
  ],
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
  projectId: uuid('project_id').references(() => projects.id),
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
  color: text('color'),
  deducted: boolean('deducted').notNull().default(true),
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

// ── Sync Infrastructure ────────────────────────────────────────────────────

export const syncRuns = pgTable('sync_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: syncSourceEnum('source').notNull(),
  entity: text('entity').notNull(),
  status: syncRunStatusEnum('status').notNull().default('running'),
  recordCount: integer('record_count'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const syncMappings = pgTable(
  'sync_mappings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    source: syncSourceEnum('source').notNull(),
    entity: text('entity').notNull(),
    externalId: text('external_id').notNull(),
    targetTable: text('target_table').notNull(),
    targetId: uuid('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sync_mappings_source_entity_ext_idx').on(t.source, t.entity, t.externalId)],
);

// ── Staging: Toggl ─────────────────────────────────────────────────────────

export const stgTogglUsers = pgTable('stg_toggl_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').notNull(),
  rawData: jsonb('raw_data').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  syncRunId: uuid('sync_run_id').references(() => syncRuns.id),
});

export const stgTogglClients = pgTable('stg_toggl_clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').notNull(),
  rawData: jsonb('raw_data').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  syncRunId: uuid('sync_run_id').references(() => syncRuns.id),
});

export const stgTogglProjects = pgTable('stg_toggl_projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').notNull(),
  rawData: jsonb('raw_data').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  syncRunId: uuid('sync_run_id').references(() => syncRuns.id),
});

export const stgTogglTags = pgTable('stg_toggl_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').notNull(),
  rawData: jsonb('raw_data').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  syncRunId: uuid('sync_run_id').references(() => syncRuns.id),
});

export const stgTogglTimeEntries = pgTable('stg_toggl_time_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').notNull(),
  rawData: jsonb('raw_data').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  syncRunId: uuid('sync_run_id').references(() => syncRuns.id),
});

// ── Staging: Timetastic ────────────────────────────────────────────────────

export const stgTtUsers = pgTable('stg_tt_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').notNull(),
  rawData: jsonb('raw_data').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  syncRunId: uuid('sync_run_id').references(() => syncRuns.id),
});

export const stgTtDepartments = pgTable('stg_tt_departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').notNull(),
  rawData: jsonb('raw_data').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  syncRunId: uuid('sync_run_id').references(() => syncRuns.id),
});

export const stgTtLeaveTypes = pgTable('stg_tt_leave_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').notNull(),
  rawData: jsonb('raw_data').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  syncRunId: uuid('sync_run_id').references(() => syncRuns.id),
});

export const stgTtAbsences = pgTable('stg_tt_absences', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').notNull(),
  rawData: jsonb('raw_data').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  syncRunId: uuid('sync_run_id').references(() => syncRuns.id),
});
