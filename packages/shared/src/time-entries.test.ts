import { describe, expect, it } from 'vitest';
import {
  AdjustEntrySchema,
  AuditEventSchema,
  CreateEntrySchema,
  EntrySchema,
  SegmentSchema,
  SplitEntrySchema,
  StartTimerSchema,
  UpdateEntrySchema,
} from './time-entries.js';

// Characterization tests — pin the CURRENT validation contract of the time-entry
// payload schemas so a refactor (or wiring them onto the API boundary, per audit S4)
// can't silently change what is accepted/rejected. Focus is on non-obvious rules and
// the deliberate contrasts between sibling schemas, not on re-asserting every field.

describe('CreateEntrySchema', () => {
  const minimal = {
    startedAt: '2026-05-21T09:00:00Z',
    stoppedAt: '2026-05-21T10:00:00Z',
    note: 'worked offline, adding manually',
  };

  it('defaults description to "" and tagIds to [] when omitted', () => {
    const parsed = CreateEntrySchema.parse(minimal);
    expect(parsed.description).toBe('');
    expect(parsed.tagIds).toEqual([]);
  });

  it('requires a non-empty note (justification for manual time)', () => {
    expect(CreateEntrySchema.safeParse({ ...minimal, note: '' }).success).toBe(false);
    expect(CreateEntrySchema.safeParse({ ...minimal, note: 'x' }).success).toBe(true);
  });

  it('requires both startedAt and stoppedAt', () => {
    expect(CreateEntrySchema.safeParse({ note: 'n', stoppedAt: minimal.stoppedAt }).success).toBe(
      false,
    );
    expect(CreateEntrySchema.safeParse({ note: 'n', startedAt: minimal.startedAt }).success).toBe(
      false,
    );
  });

  it('accepts a null projectId and optional jira fields', () => {
    const parsed = CreateEntrySchema.parse({
      ...minimal,
      projectId: null,
      jiraIssueKey: 'PROJ-1',
    });
    expect(parsed.projectId).toBeNull();
    expect(parsed.jiraIssueKey).toBe('PROJ-1');
  });
});

describe('StartTimerSchema', () => {
  it('parses an empty payload, defaulting description and tagIds', () => {
    const parsed = StartTimerSchema.parse({});
    expect(parsed).toMatchObject({ description: '', tagIds: [] });
  });
});

describe('UpdateEntrySchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(UpdateEntrySchema.parse({})).toEqual({});
  });
});

describe('AdjustEntrySchema vs SplitEntrySchema (deliberate contrast)', () => {
  it('Adjust requires a note but allows any duration, including negative', () => {
    expect(AdjustEntrySchema.safeParse({ durationSeconds: -600, note: 'remove overlog' }).success).toBe(
      true,
    );
    expect(AdjustEntrySchema.safeParse({ durationSeconds: 0, note: 'n' }).success).toBe(true);
    expect(AdjustEntrySchema.safeParse({ durationSeconds: 600, note: '' }).success).toBe(false);
  });

  it('Split requires a strictly positive duration and treats note as optional', () => {
    expect(SplitEntrySchema.safeParse({ durationSeconds: 600 }).success).toBe(true);
    expect(SplitEntrySchema.safeParse({ durationSeconds: 0 }).success).toBe(false);
    expect(SplitEntrySchema.safeParse({ durationSeconds: -1 }).success).toBe(false);
  });
});

describe('SegmentSchema', () => {
  it('only accepts clocked or manual as type', () => {
    const base = {
      id: 's1',
      startedAt: null,
      stoppedAt: null,
      durationSeconds: null,
      note: null,
      createdAt: '2026-05-21T09:00:00Z',
    };
    expect(SegmentSchema.safeParse({ ...base, type: 'clocked' }).success).toBe(true);
    expect(SegmentSchema.safeParse({ ...base, type: 'manual' }).success).toBe(true);
    expect(SegmentSchema.safeParse({ ...base, type: 'adjustment' }).success).toBe(false);
  });
});

describe('AuditEventSchema', () => {
  const base = {
    id: 'a1',
    entryId: 'e1',
    actorId: 'u1',
    actorName: 'Elena Marsh',
    changes: null,
    metadata: null,
    createdAt: '2026-05-21T09:00:00Z',
  };

  it('pins the exact set of allowed actions', () => {
    const actions = [
      'created',
      'updated',
      'deleted',
      'timer_started',
      'timer_stopped',
      'timer_resumed',
      'adjustment_added',
      'block_moved',
      'entry_split',
    ];
    for (const action of actions) {
      expect(AuditEventSchema.safeParse({ ...base, action }).success).toBe(true);
    }
    expect(AuditEventSchema.safeParse({ ...base, action: 'archived' }).success).toBe(false);
  });

  it('accepts a structured changes record and rejects a non-object change value', () => {
    expect(
      AuditEventSchema.safeParse({
        ...base,
        action: 'updated',
        changes: { description: { old: 'a', new: 'b' } },
      }).success,
    ).toBe(true);
    expect(
      AuditEventSchema.safeParse({ ...base, action: 'updated', changes: { description: 'oops' } })
        .success,
    ).toBe(false);
  });
});

describe('EntrySchema (optional vs nullable distinction)', () => {
  const valid = {
    id: 'e1',
    description: 'task',
    projectId: null,
    projectName: null,
    projectColor: null,
    clientName: null,
    jiraIssue: null,
    tags: [],
    segments: [],
    totalDurationSeconds: 0,
    isRunning: false,
    isActive: true,
    createdAt: '2026-05-21T09:00:00Z',
    lastSegmentAt: '2026-05-21T09:00:00Z',
    userId: 'u1',
  };

  it('allows userName/userAvatarUrl to be omitted entirely (optional)', () => {
    expect(EntrySchema.safeParse(valid).success).toBe(true);
  });

  it('also allows userName/userAvatarUrl to be null', () => {
    expect(EntrySchema.safeParse({ ...valid, userName: null, userAvatarUrl: null }).success).toBe(
      true,
    );
  });

  it('requires projectId to be present (nullable, not optional)', () => {
    const { projectId, ...withoutProjectId } = valid;
    void projectId;
    expect(EntrySchema.safeParse(withoutProjectId).success).toBe(false);
  });
});
