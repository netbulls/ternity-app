import { describe, expect, it } from 'vitest';
import {
  AdjustEntrySchema,
  AuditEventSchema,
  CreateEntrySchema,
  DayGroupSchema,
  EntrySchema,
  EntrySearchHitSchema,
  EntryTagSchema,
  JiraIssueLinkSchema,
  MoveBlockSchema,
  SegmentSchema,
  SplitEntrySchema,
  StartTimerSchema,
  StatsSchema,
  StopTimerSchema,
  TimerStateSchema,
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

  it('preserves the old/new keys on each change entry (not just success)', () => {
    // Without this, a mutant that strips the inner change object's old/new keys would
    // still parse successfully and the test above would pass.
    const parsed = AuditEventSchema.parse({
      ...base,
      action: 'updated',
      changes: { description: { old: 'a', new: 'b' }, projectId: { new: 'p-1' } },
    });
    expect(parsed.changes).toEqual({ description: { old: 'a', new: 'b' }, projectId: { new: 'p-1' } });
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

// Direct accept/reject for the remaining payload schemas — without these, a mutant
// that strips the object's required fields (`z.object({a, b}) → z.object({})`) is
// unkillable, because zod's empty object schema accepts anything.

describe('MoveBlockSchema', () => {
  it('accepts a fully-formed payload', () => {
    expect(MoveBlockSchema.safeParse({ segmentId: 'seg-1' }).success).toBe(true);
    expect(
      MoveBlockSchema.safeParse({ segmentId: 'seg-1', description: 'x', projectId: 'p-1' }).success,
    ).toBe(true);
    expect(MoveBlockSchema.safeParse({ segmentId: 'seg-1', projectId: null }).success).toBe(true);
  });

  it('requires segmentId', () => {
    expect(MoveBlockSchema.safeParse({}).success).toBe(false);
    expect(MoveBlockSchema.safeParse({ description: 'x' }).success).toBe(false);
  });

  it('rejects wrong-type segmentId', () => {
    expect(MoveBlockSchema.safeParse({ segmentId: 42 }).success).toBe(false);
  });
});

describe('StopTimerSchema', () => {
  it('accepts an empty payload (description is optional)', () => {
    expect(StopTimerSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a string description', () => {
    expect(StopTimerSchema.safeParse({ description: 'finished' }).success).toBe(true);
  });

  it('rejects a wrong-type description', () => {
    expect(StopTimerSchema.safeParse({ description: 42 }).success).toBe(false);
  });
});

describe('StatsSchema', () => {
  it('accepts both required numeric counters', () => {
    expect(StatsSchema.safeParse({ todaySeconds: 0, weekSeconds: 0 }).success).toBe(true);
    expect(StatsSchema.safeParse({ todaySeconds: 3600, weekSeconds: 18000 }).success).toBe(true);
  });

  it('requires both fields', () => {
    expect(StatsSchema.safeParse({}).success).toBe(false);
    expect(StatsSchema.safeParse({ todaySeconds: 0 }).success).toBe(false);
    expect(StatsSchema.safeParse({ weekSeconds: 0 }).success).toBe(false);
  });

  it('rejects non-numeric values', () => {
    expect(StatsSchema.safeParse({ todaySeconds: '0', weekSeconds: 0 }).success).toBe(false);
  });
});

describe('EntryTagSchema', () => {
  it('accepts a valid tag (color nullable)', () => {
    expect(EntryTagSchema.safeParse({ id: 't1', name: 'billable', color: null }).success).toBe(true);
    expect(EntryTagSchema.safeParse({ id: 't1', name: 'billable', color: '#0f0' }).success).toBe(true);
  });

  it('requires id, name, color', () => {
    expect(EntryTagSchema.safeParse({}).success).toBe(false);
    expect(EntryTagSchema.safeParse({ id: 't1', name: 'n' }).success).toBe(false);
    expect(EntryTagSchema.safeParse({ id: 't1', color: null }).success).toBe(false);
  });
});

describe('JiraIssueLinkSchema', () => {
  const valid = { key: 'YOS-1', summary: 'do it', connectionId: 'c1', siteUrl: 'https://x' };

  it('accepts a fully-formed link', () => {
    expect(JiraIssueLinkSchema.safeParse(valid).success).toBe(true);
  });

  it('requires every field', () => {
    expect(JiraIssueLinkSchema.safeParse({}).success).toBe(false);
    const { key: _k, ...noKey } = valid;
    expect(JiraIssueLinkSchema.safeParse(noKey).success).toBe(false);
    const { summary: _s, ...noSummary } = valid;
    expect(JiraIssueLinkSchema.safeParse(noSummary).success).toBe(false);
  });
});

describe('TimerStateSchema', () => {
  it('accepts running + entry=null', () => {
    expect(TimerStateSchema.safeParse({ running: false, entry: null }).success).toBe(true);
  });

  it('requires running and entry', () => {
    expect(TimerStateSchema.safeParse({}).success).toBe(false);
    expect(TimerStateSchema.safeParse({ running: false }).success).toBe(false);
    expect(TimerStateSchema.safeParse({ entry: null }).success).toBe(false);
  });

  it('rejects wrong-type running', () => {
    expect(TimerStateSchema.safeParse({ running: 'no', entry: null }).success).toBe(false);
  });
});

describe('DayGroupSchema', () => {
  it('accepts a valid day group (entries can be empty)', () => {
    expect(DayGroupSchema.safeParse({ date: '2026-01-01', totalSeconds: 0, entries: [] }).success).toBe(
      true,
    );
  });

  it('requires date, totalSeconds, entries', () => {
    expect(DayGroupSchema.safeParse({}).success).toBe(false);
    expect(DayGroupSchema.safeParse({ date: '2026-01-01', entries: [] }).success).toBe(false);
    expect(DayGroupSchema.safeParse({ date: '2026-01-01', totalSeconds: 0 }).success).toBe(false);
  });

  it('rejects wrong-type totalSeconds', () => {
    expect(DayGroupSchema.safeParse({ date: '2026-01-01', totalSeconds: '0', entries: [] }).success).toBe(
      false,
    );
  });
});

describe('UpdateEntrySchema — wrong types are rejected even though all fields are optional', () => {
  it('rejects a non-string description', () => {
    expect(UpdateEntrySchema.safeParse({ description: 42 }).success).toBe(false);
  });

  it('rejects a non-array tagIds', () => {
    expect(UpdateEntrySchema.safeParse({ tagIds: 'nope' }).success).toBe(false);
  });

  it('rejects an array of non-strings in tagIds', () => {
    expect(UpdateEntrySchema.safeParse({ tagIds: [1, 2] }).success).toBe(false);
  });
});

describe('EntrySearchHitSchema', () => {
  const valid = {
    id: 'e-1',
    description: 'Task',
    projectId: null,
    projectName: null,
    projectColor: null,
    clientName: null,
    jiraIssueKey: null,
    jiraIssueSummary: null,
    jiraConnectionId: null,
    totalDurationSeconds: 3600,
    lastSegmentAt: '2026-01-01T00:00:00Z',
    isRunning: false,
  };

  it('accepts a fully-formed hit', () => {
    expect(EntrySearchHitSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects when any required field is missing', () => {
    expect(EntrySearchHitSchema.safeParse({}).success).toBe(false);
    const { id: _id, ...noId } = valid;
    expect(EntrySearchHitSchema.safeParse(noId).success).toBe(false);
    const { isRunning: _r, ...noRunning } = valid;
    expect(EntrySearchHitSchema.safeParse(noRunning).success).toBe(false);
    const { totalDurationSeconds: _t, ...noDuration } = valid;
    expect(EntrySearchHitSchema.safeParse(noDuration).success).toBe(false);
  });

  it('rejects wrong-type values', () => {
    expect(EntrySearchHitSchema.safeParse({ ...valid, isRunning: 'no' }).success).toBe(false);
    expect(EntrySearchHitSchema.safeParse({ ...valid, totalDurationSeconds: '0' }).success).toBe(false);
  });
});
