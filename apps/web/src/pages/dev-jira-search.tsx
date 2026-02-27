import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider, usePreferences } from '@/providers/preferences-provider';
import { DevToolbar } from '@/dev/dev-toolbar';
import {
  Timer, LayoutDashboard, BarChart3, Calendar, Palmtree, Settings, LogOut,
  Users, FolderKanban, Download, Play, Square, Search, X, ExternalLink,
  MoreHorizontal, ChevronDown, Hash, Command, ArrowUp, ArrowDown, CornerDownLeft,
  Layers, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { HourglassLogo } from '@/components/layout/hourglass-logo';

// ============================================================
// Types & Mock Data
// ============================================================

interface JiraIssue {
  id: string;
  key: string;
  title: string;
  status: 'In Progress' | 'To Do' | 'In Review' | 'Done';
  type: 'Story' | 'Bug' | 'Task';
  site: string;
  project: string;
  assignee?: string;
}

interface MockProject {
  id: string;
  name: string;
  clientName: string;
  color: string;
}

interface MockEntry {
  id: string;
  description: string;
  project: MockProject;
  durationSeconds: number;
  startTime: string;
  endTime: string | null;
  running?: boolean;
  jiraIssue?: JiraIssue | null;
  segments?: number;
}

const MOCK_PROJECTS: MockProject[] = [
  { id: 'p1', name: 'Platform Core', clientName: 'Meridian Labs', color: 'hsl(var(--t-project-1))' },
  { id: 'p2', name: 'Brand Redesign', clientName: 'Acme Co', color: 'hsl(var(--t-project-2))' },
  { id: 'p3', name: 'Mobile App', clientName: 'Neon Labs', color: 'hsl(var(--t-project-3))' },
];

const JIRA_ISSUES: JiraIssue[] = [
  { id: 'j1', key: 'NETB-142', title: 'Implement user onboarding flow', status: 'In Progress', type: 'Story', site: 'netbulls.atlassian.net', project: 'Netbulls Core', assignee: 'Elena Marsh' },
  { id: 'j2', key: 'NETB-201', title: 'Add export to PDF feature', status: 'To Do', type: 'Task', site: 'netbulls.atlassian.net', project: 'Netbulls Core', assignee: 'James Oakley' },
  { id: 'j3', key: 'NETB-189', title: 'Fix timezone handling in reports', status: 'In Review', type: 'Bug', site: 'netbulls.atlassian.net', project: 'Netbulls Core', assignee: 'Elena Marsh' },
  { id: 'j4', key: 'NETB-210', title: 'Redesign notification preferences', status: 'To Do', type: 'Story', site: 'netbulls.atlassian.net', project: 'Netbulls Core' },
  { id: 'j5', key: 'NETB-215', title: 'Add bulk import for time entries', status: 'In Progress', type: 'Task', site: 'netbulls.atlassian.net', project: 'Netbulls Core', assignee: 'Nora Fielding' },
  { id: 'j6', key: 'ACME-87', title: 'Fix login timeout on mobile', status: 'In Progress', type: 'Bug', site: 'acme.atlassian.net', project: 'ACME Portal', assignee: 'Leo Tanner' },
  { id: 'j7', key: 'ACME-112', title: 'Update billing page design', status: 'To Do', type: 'Story', site: 'acme.atlassian.net', project: 'ACME Portal' },
  { id: 'j8', key: 'ACME-95', title: 'API rate limiting middleware', status: 'In Progress', type: 'Task', site: 'acme.atlassian.net', project: 'ACME API', assignee: 'Sam Whitford' },
  { id: 'j9', key: 'OAK-34', title: 'Set up CI/CD pipeline', status: 'Done', type: 'Task', site: 'acme.atlassian.net', project: 'Oakley Infra' },
  { id: 'j10', key: 'OAK-41', title: 'Docker multi-stage build optimization', status: 'In Progress', type: 'Task', site: 'acme.atlassian.net', project: 'Oakley Infra', assignee: 'Ren Kimura' },
];

const MY_ISSUES = JIRA_ISSUES.filter(i => i.assignee === 'Elena Marsh');
const RECENT_ISSUES: JiraIssue[] = [JIRA_ISSUES[0]!, JIRA_ISSUES[5]!, JIRA_ISSUES[2]!, JIRA_ISSUES[7]!];

const MOCK_ENTRIES: MockEntry[] = [
  { id: 'e1', description: 'Implement user onboarding flow', project: MOCK_PROJECTS[0]!, durationSeconds: 7200, startTime: '09:00', endTime: '11:00', jiraIssue: JIRA_ISSUES[0]!, segments: 2 },
  { id: 'e2', description: 'Code review — auth middleware', project: MOCK_PROJECTS[0]!, durationSeconds: 3600, startTime: '11:15', endTime: '12:15', jiraIssue: null },
  { id: 'e3', description: 'Fix login timeout on mobile', project: MOCK_PROJECTS[1]!, durationSeconds: 5400, startTime: '13:00', endTime: '14:30', jiraIssue: JIRA_ISSUES[5]! },
  { id: 'e4', description: 'Design review session', project: MOCK_PROJECTS[2]!, durationSeconds: 2700, startTime: '14:45', endTime: '15:30', jiraIssue: null },
  { id: 'e5', description: '', project: MOCK_PROJECTS[0]!, durationSeconds: 1800, startTime: '15:45', endTime: '16:15', jiraIssue: null },
];

// ============================================================
// Helpers
// ============================================================

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDurationShort(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'In Progress': { bg: 'hsl(217 91% 60% / 0.15)', text: 'hsl(217 91% 60%)' },
  'To Do': { bg: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))' },
  'In Review': { bg: 'hsl(38 92% 50% / 0.15)', text: 'hsl(38 92% 50%)' },
  'Done': { bg: 'hsl(142 71% 45% / 0.15)', text: 'hsl(142 71% 45%)' },
};

const TYPE_COLORS: Record<string, string> = {
  Story: 'hsl(142 71% 45%)',
  Bug: 'hsl(0 72% 51%)',
  Task: 'hsl(217 91% 60%)',
};

function searchIssues(query: string): JiraIssue[] {
  if (!query) return [];
  const q = query.toLowerCase().replace(/^#/, '');
  return JIRA_ISSUES.filter(i =>
    i.key.toLowerCase().includes(q) ||
    i.title.toLowerCase().includes(q)
  );
}

function groupBysite(issues: JiraIssue[]): Record<string, JiraIssue[]> {
  const groups: Record<string, JiraIssue[]> = {};
  for (const i of issues) {
    (groups[i.site] ??= []).push(i);
  }
  return groups;
}

// ============================================================
// Fake Timer Hook
// ============================================================

function useFakeTimer() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, [running]);

  const start = useCallback(() => { setElapsed(0); setRunning(true); }, []);
  const stop = useCallback(() => { setRunning(false); setElapsed(0); }, []);

  return { running, elapsed, start, stop };
}

// ============================================================
// Command Palette Context
// ============================================================

interface PaletteCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
}
const PaletteContext = createContext<PaletteCtx>({ open: false, setOpen: () => {} });
function usePalette() { return useContext(PaletteContext); }

// ============================================================
// Jira Issue Result Row
// ============================================================

function IssueRow({ issue, selected, onSelect, showStartTimer, onStartTimer }: {
  issue: JiraIssue;
  selected?: boolean;
  onSelect: (issue: JiraIssue) => void;
  showStartTimer?: boolean;
  startTimerVariant?: number;
  onStartTimer?: (issue: JiraIssue) => void;
}) {
  const sc = STATUS_COLORS[issue.status] ?? STATUS_COLORS['To Do']!;
  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors',
        selected ? 'bg-primary/10' : 'hover:bg-muted/50',
      )}
      onClick={() => onSelect(issue)}
    >
      <div className="flex-shrink-0 h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLORS[issue.type] }} />
      <span className="font-brand font-semibold text-primary flex-shrink-0" style={{ fontSize: scaled(11) }}>
        {issue.key}
      </span>
      <span className="flex-1 truncate text-foreground" style={{ fontSize: scaled(12) }}>
        {issue.title}
      </span>
      <span
        className="flex-shrink-0 rounded-full px-2 py-0.5"
        style={{ fontSize: scaled(9), background: sc.bg, color: sc.text }}
      >
        {issue.status}
      </span>
      {showStartTimer && onStartTimer && (
        <button
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-primary/10 hover:bg-primary/20 p-1"
          onClick={(e) => { e.stopPropagation(); onStartTimer(issue); }}
          title="Start timer"
        >
          <Play className="h-3 w-3 text-primary fill-primary" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// Jira Chip (linked issue badge)
// ============================================================

function JiraChip({ issue, onUnlink, compact }: { issue: JiraIssue; onUnlink?: () => void; compact?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 text-primary',
      compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5',
    )}>
      <span className="font-brand font-semibold" style={{ fontSize: scaled(compact ? 10 : 11) }}>
        {issue.key}
      </span>
      <a
        href={`https://${issue.site}/browse/${issue.key}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-primary/80"
        onClick={e => e.stopPropagation()}
        title={`Open ${issue.key} in Jira`}
      >
        <ExternalLink className="h-3 w-3" />
      </a>
      {onUnlink && (
        <button
          className="hover:text-destructive transition-colors"
          onClick={e => { e.stopPropagation(); onUnlink(); }}
          title="Unlink issue"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

// ============================================================
// Jira Search Dropdown (shared between timer bar and entries)
// ============================================================

function JiraSearchDropdown({ onSelect, onClose, anchorRight }: {
  onSelect: (issue: JiraIssue) => void;
  onClose: () => void;
  anchorRight?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'browse' | 'search'>('browse');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => searchIssues(query), [query]);
  const grouped = useMemo(() => groupBysite(results), [results]);
  const showSearch = tab === 'search' || query.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'absolute z-50 top-full mt-2 w-[480px] rounded-xl border border-border bg-card shadow-xl',
        anchorRight ? 'right-0' : 'left-0',
      )}
      onClick={e => e.stopPropagation()}
    >
      {/* Search input */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          style={{ fontSize: scaled(12) }}
          placeholder="Search issues by key or title..."
          value={query}
          onChange={e => { setQuery(e.target.value); if (e.target.value) setTab('search'); }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setTab('browse'); }} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Tab toggle */}
      {!query && (
        <div className="flex gap-0 border-b border-border">
          <button
            className={cn(
              'px-4 py-2 font-brand text-xs transition-colors',
              tab === 'browse' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab('browse')}
            style={{ fontSize: scaled(10) }}
          >
            Browse
          </button>
          <button
            className={cn(
              'px-4 py-2 font-brand text-xs transition-colors',
              tab === 'search' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab('search')}
            style={{ fontSize: scaled(10) }}
          >
            Search
          </button>
        </div>
      )}

      {/* Content */}
      <div className="max-h-[360px] overflow-y-auto p-2">
        {showSearch ? (
          results.length > 0 ? (
            Object.entries(grouped).map(([site, issues]) => (
              <div key={site} className="mb-2">
                <div className="px-3 py-1.5 font-brand text-muted-foreground/60 uppercase tracking-wider" style={{ fontSize: scaled(9) }}>
                  {site}
                </div>
                {issues.map(issue => (
                  <IssueRow key={issue.id} issue={issue} onSelect={onSelect} />
                ))}
              </div>
            ))
          ) : query.length > 0 ? (
            <div className="py-8 text-center text-muted-foreground" style={{ fontSize: scaled(12) }}>
              No issues matching "{query}"
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground" style={{ fontSize: scaled(12) }}>
              Type to search Jira issues
            </div>
          )
        ) : (
          <>
            {/* Assigned to me */}
            <div className="mb-3">
              <div className="px-3 py-1.5 font-brand text-muted-foreground/60 uppercase tracking-wider" style={{ fontSize: scaled(9) }}>
                Assigned to me
              </div>
              {MY_ISSUES.length > 0 ? MY_ISSUES.map(issue => (
                <IssueRow key={issue.id} issue={issue} onSelect={onSelect} />
              )) : (
                <div className="px-3 py-2 text-muted-foreground" style={{ fontSize: scaled(11) }}>No assigned issues</div>
              )}
            </div>
            {/* Recently viewed */}
            <div>
              <div className="px-3 py-1.5 font-brand text-muted-foreground/60 uppercase tracking-wider" style={{ fontSize: scaled(9) }}>
                Recently viewed
              </div>
              {RECENT_ISSUES.map(issue => (
                <IssueRow key={issue.id} issue={issue} onSelect={onSelect} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <div className="flex items-center gap-3 text-muted-foreground" style={{ fontSize: scaled(9) }}>
          <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> Navigate</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> Select</span>
          <span className="flex items-center gap-1">esc Close</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" style={{ fontSize: scaled(10) }}>
          Close
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================
// # Trigger autocomplete
// ============================================================

function HashAutocomplete({ query, onSelect }: {
  query: string;
  onSelect: (issue: JiraIssue) => void;
  onClose: () => void;
}) {
  const results = useMemo(() => searchIssues(query), [query]);
  if (results.length === 0 && query.length < 2) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden"
    >
      {results.length > 0 ? (
        <div className="max-h-[200px] overflow-y-auto p-1">
          {results.slice(0, 5).map(issue => (
            <IssueRow key={issue.id} issue={issue} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <div className="px-3 py-4 text-center text-muted-foreground" style={{ fontSize: scaled(11) }}>
          No issues matching "{query}"
        </div>
      )}
      <div className="border-t border-border px-3 py-1.5 text-muted-foreground" style={{ fontSize: scaled(9) }}>
        <span className="flex items-center gap-1"><CornerDownLeft className="inline h-3 w-3" /> to link issue</span>
      </div>
    </motion.div>
  );
}

// ============================================================
// Timer Bar (with Jira integration)
// ============================================================

function MockTimerBar({ timer, description, setDescription, linkedIssue, setLinkedIssue, selectedProject }: {
  timer: ReturnType<typeof useFakeTimer>;
  description: string;
  setDescription: (v: string) => void;
  linkedIssue: JiraIssue | null;
  setLinkedIssue: (v: JiraIssue | null) => void;
  selectedProject: MockProject;
  setSelectedProject: (v: MockProject) => void;
}) {
  const [jiraDropdownOpen, setJiraDropdownOpen] = useState(false);
  const [hashTrigger, setHashTrigger] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const digits = fmtDuration(timer.elapsed).split('');

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDescription(val);

    // Detect # trigger
    const hashIdx = val.lastIndexOf('#');
    if (hashIdx >= 0 && (hashIdx === 0 || val[hashIdx - 1] === ' ')) {
      const afterHash = val.substring(hashIdx + 1);
      if (afterHash.length >= 1 && !afterHash.includes(' ')) {
        setHashTrigger(afterHash);
        return;
      }
    }
    setHashTrigger(null);
  };

  const handleIssueSelect = (issue: JiraIssue) => {
    setLinkedIssue(issue);
    setDescription(issue.title);
    setJiraDropdownOpen(false);
    setHashTrigger(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !timer.running) {
      timer.start();
    }
    if (e.key === 'Escape') {
      setHashTrigger(null);
      setJiraDropdownOpen(false);
    }
  };

  return (
    <div className="relative z-50">
      <motion.div
        className="relative flex items-center gap-3 rounded-lg border px-4 py-3"
        animate={{
          borderColor: timer.running ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--t-timer-border))',
          backgroundColor: 'hsl(var(--t-timer-bg))',
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Liquid edge when running */}
        {timer.running && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden">
            <div className="absolute inset-0 animate-[liquid-drift_5s_ease-in-out_infinite_alternate]" style={{
              background: 'radial-gradient(ellipse 80px 3px at 30% 100%, hsl(var(--primary) / 0.5), transparent)',
            }} />
          </div>
        )}

        {/* Jira chip or icon */}
        <div className="relative z-10 flex items-center gap-2">
          {linkedIssue ? (
            <JiraChip issue={linkedIssue} onUnlink={() => setLinkedIssue(null)} compact />
          ) : (
            <button
              className={cn(
                'flex items-center justify-center rounded-md border p-1.5 transition-colors',
                jiraDropdownOpen
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/20 hover:text-primary',
              )}
              onClick={() => setJiraDropdownOpen(!jiraDropdownOpen)}
              title="Link Jira issue"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 00-.84-.84H11.53zM6.77 6.8a4.362 4.362 0 004.34 4.34h1.8v1.72a4.362 4.362 0 004.34 4.34V7.63a.84.84 0 00-.84-.84H6.77zM2 11.6c0 2.4 1.95 4.34 4.35 4.35h1.78v1.72c.01 2.39 1.95 4.33 4.34 4.34v-9.57a.84.84 0 00-.84-.84H2z" />
              </svg>
            </button>
          )}
        </div>

        {/* Description input */}
        <div className="relative z-10 flex-1">
          <input
            ref={inputRef}
            className="w-full border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            style={{ fontSize: scaled(13) }}
            placeholder={linkedIssue ? 'Linked to Jira issue' : 'What are you working on? (type # to search Jira)'}
            value={description}
            onChange={handleDescriptionChange}
            onKeyDown={handleKeyDown}
          />
          {/* # trigger autocomplete */}
          <AnimatePresence>
            {hashTrigger !== null && (
              <HashAutocomplete
                query={hashTrigger}
                onSelect={handleIssueSelect}
                onClose={() => setHashTrigger(null)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Project selector mock */}
        <button className="relative z-10 flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-foreground transition-colors hover:border-primary/20 hover:bg-muted/50">
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: selectedProject.color }} />
          <span style={{ fontSize: scaled(12) }}>{selectedProject.name}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        {/* Timer display */}
        <div className="relative z-10 flex flex-col items-end font-brand tabular-nums">
          <div className="text-xl font-semibold tracking-wider text-primary">
            {timer.running ? (
              <span className="inline-flex">{digits.map((d, i) => <span key={i}>{d}</span>)}</span>
            ) : (
              <span style={{ opacity: 0.4 }}>0:00:00</span>
            )}
          </div>
          <span className="text-[9px] font-normal tracking-wider text-muted-foreground" style={{ opacity: 0.5 }}>
            UTC+1 (CET)
          </span>
        </div>

        {/* Start/Stop button */}
        <AnimatePresence mode="wait">
          {timer.running ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              whileTap={{ scale: 0.85 }}
              onClick={timer.stop}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-white"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          ) : (
            <motion.button
              key="start"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              whileTap={{ scale: 0.85 }}
              onClick={timer.start}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Jira dropdown */}
      <AnimatePresence>
        {jiraDropdownOpen && (
          <JiraSearchDropdown
            onSelect={handleIssueSelect}
            onClose={() => setJiraDropdownOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Entry Row (with Jira integration)
// ============================================================

function MockEntryRow({ entry, onUpdate }: { entry: MockEntry; onUpdate: (id: string, patch: Partial<MockEntry>) => void }) {
  const [jiraDropdownOpen, setJiraDropdownOpen] = useState(false);
  const [hashTrigger, setHashTrigger] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(entry.description);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleIssueSelect = (issue: JiraIssue) => {
    onUpdate(entry.id, { jiraIssue: issue, description: issue.title });
    setJiraDropdownOpen(false);
    setHashTrigger(null);
    setEditing(false);
  };

  const handleDescChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditDesc(val);
    const hashIdx = val.lastIndexOf('#');
    if (hashIdx >= 0 && (hashIdx === 0 || val[hashIdx - 1] === ' ')) {
      const afterHash = val.substring(hashIdx + 1);
      if (afterHash.length >= 1 && !afterHash.includes(' ')) {
        setHashTrigger(afterHash);
        return;
      }
    }
    setHashTrigger(null);
  };

  return (
    <div className={cn(
      'group relative flex items-center gap-3 border-b border-border/50 px-4 py-2.5 transition-colors hover:bg-muted/30',
      (jiraDropdownOpen || hashTrigger !== null) ? 'z-50' : 'z-10',
    )}>
      {/* Incomplete indicator */}
      {(!entry.description || !entry.project) && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r bg-amber-500/70" />
      )}

      {/* Description + Project */}
      <div className="flex flex-1 flex-col gap-0.5 min-w-0 relative">
        {editing ? (
          <div className="relative">
            <input
              ref={inputRef}
              className="w-full rounded border border-primary/30 bg-transparent px-2 py-0.5 text-foreground outline-none"
              style={{ fontSize: scaled(13) }}
              value={editDesc}
              onChange={handleDescChange}
              onKeyDown={e => {
                if (e.key === 'Escape') { setEditing(false); setHashTrigger(null); }
                if (e.key === 'Enter') { onUpdate(entry.id, { description: editDesc }); setEditing(false); setHashTrigger(null); }
              }}
              autoFocus
            />
            <AnimatePresence>
              {hashTrigger !== null && (
                <HashAutocomplete
                  query={hashTrigger}
                  onSelect={handleIssueSelect}
                  onClose={() => setHashTrigger(null)}
                />
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {entry.jiraIssue && <JiraChip issue={entry.jiraIssue} onUnlink={() => onUpdate(entry.id, { jiraIssue: null })} compact />}
            <span
              className={cn(
                'cursor-pointer truncate',
                entry.description ? 'text-foreground' : 'text-muted-foreground italic',
              )}
              style={{ fontSize: scaled(13) }}
              onClick={() => { setEditing(true); setEditDesc(entry.description); }}
            >
              {entry.description || 'No description'}
            </span>
            {!entry.jiraIssue && (
              <button
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                onClick={() => setJiraDropdownOpen(true)}
                title="Link Jira issue"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 00-.84-.84H11.53zM6.77 6.8a4.362 4.362 0 004.34 4.34h1.8v1.72a4.362 4.362 0 004.34 4.34V7.63a.84.84 0 00-.84-.84H6.77zM2 11.6c0 2.4 1.95 4.34 4.35 4.35h1.78v1.72c.01 2.39 1.95 4.33 4.34 4.34v-9.57a.84.84 0 00-.84-.84H2z" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ background: entry.project.color }} />
          <span className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
            {entry.project.clientName} · {entry.project.name}
          </span>
        </div>
      </div>

      {/* Segments badge */}
      {entry.segments && entry.segments > 1 && (
        <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-brand tabular-nums text-muted-foreground" style={{ fontSize: scaled(10) }}>
          <Layers className="h-3 w-3" /> {entry.segments}
        </span>
      )}

      {/* Time range */}
      <span className="tabular-nums text-muted-foreground" style={{ fontSize: scaled(11) }}>
        {entry.startTime} – {entry.endTime ?? 'now'}
      </span>

      {/* Duration */}
      <span className="font-brand font-semibold tabular-nums text-foreground" style={{ fontSize: scaled(13) }}>
        {fmtDurationShort(entry.durationSeconds)}
      </span>

      {/* Play */}
      <button className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
        <Play className="h-3.5 w-3.5" />
      </button>

      {/* More */}
      <button className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {/* Jira dropdown for entry row */}
      <AnimatePresence>
        {jiraDropdownOpen && (
          <JiraSearchDropdown
            onSelect={handleIssueSelect}
            onClose={() => setJiraDropdownOpen(false)}
            anchorRight
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Command Palette (⌘K)
// ============================================================

function CommandPalette({ onSelectIssue, onStartTimer }: {
  onSelectIssue: (issue: JiraIssue) => void;
  onStartTimer: (issue: JiraIssue, variant: number) => void;
}) {
  const { open, setOpen } = usePalette();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [startVariant, setStartVariant] = useState(0); // 0 = none, 1-5 = variant
  const inputRef = useRef<HTMLInputElement>(null);

  const isJiraMode = query.startsWith('#');
  const jiraQuery = isJiraMode ? query.substring(1) : query;

  const results = useMemo(() => {
    if (isJiraMode) return searchIssues(jiraQuery);
    if (query.length >= 2) return searchIssues(query);
    return [];
  }, [query, isJiraMode, jiraQuery]);

  const grouped = useMemo(() => groupBysite(results), [results]);
  const defaultItems = useMemo(() => [...MY_ISSUES, ...RECENT_ISSUES], []);
  const flatResults = useMemo(() => !query ? defaultItems : Object.values(grouped).flat(), [query, defaultItems, grouped]);

  useEffect(() => { if (open) { setQuery(''); setSelectedIdx(0); setStartVariant(0); } }, [open]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, flatResults.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    const selected = flatResults[selectedIdx];
    if (e.key === 'Enter' && selected) {
      e.preventDefault();
      onSelectIssue(selected);
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />

      {/* Palette */}
      <motion.div
        className="relative w-[600px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        initial={{ opacity: 0, y: -20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Command className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-foreground outline-none"
            style={{ fontSize: scaled(14) }}
            placeholder="Search... (# for Jira issues)"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-muted-foreground" style={{ fontSize: scaled(9) }}>
            esc
          </kbd>
        </div>

        {/* Jira mode indicator */}
        {isJiraMode && (
          <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-1.5">
            <Hash className="h-3 w-3 text-primary" />
            <span className="text-primary" style={{ fontSize: scaled(10) }}>Jira search mode — searching issues across all connections</span>
          </div>
        )}

        {/* Results */}
        <div className="max-h-[380px] overflow-y-auto p-2">
          {!query ? (
            <>
              <div className="px-3 py-1.5 font-brand text-muted-foreground/60 uppercase tracking-wider" style={{ fontSize: scaled(9) }}>
                Jira — Assigned to me
              </div>
              {MY_ISSUES.map((issue, i) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  selected={i === selectedIdx}
                  onSelect={() => { onSelectIssue(issue); setOpen(false); }}
                  showStartTimer
                  startTimerVariant={startVariant}
                  onStartTimer={(iss) => { onStartTimer(iss, startVariant || 1); setOpen(false); }}
                />
              ))}
              <div className="px-3 py-1.5 mt-2 font-brand text-muted-foreground/60 uppercase tracking-wider" style={{ fontSize: scaled(9) }}>
                Recently viewed
              </div>
              {RECENT_ISSUES.map((issue, idx) => {
                if (!issue) return null;
                return (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  selected={idx + MY_ISSUES.length === selectedIdx}
                  onSelect={() => { onSelectIssue(issue); setOpen(false); }}
                  showStartTimer
                  onStartTimer={(iss) => { onStartTimer(iss, startVariant || 1); setOpen(false); }}
                />
                );
              })}
            </>
          ) : results.length > 0 ? (
            Object.entries(grouped).map(([site, issues]) => (
              <div key={site} className="mb-2">
                <div className="px-3 py-1.5 font-brand text-muted-foreground/60 uppercase tracking-wider" style={{ fontSize: scaled(9) }}>
                  {site}
                </div>
                {issues.map((issue) => {
                  const globalIdx = flatResults.indexOf(issue);
                  return (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      selected={globalIdx === selectedIdx}
                      onSelect={() => { onSelectIssue(issue); setOpen(false); }}
                      showStartTimer
                      onStartTimer={(iss) => { onStartTimer(iss, startVariant || 1); setOpen(false); }}
                    />
                  );
                })}
              </div>
            ))
          ) : query.length >= 2 ? (
            <div className="py-12 text-center text-muted-foreground" style={{ fontSize: scaled(12) }}>
              No results for "{query}"
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground" style={{ fontSize: scaled(12) }}>
              Keep typing to search...
            </div>
          )}
        </div>

        {/* Footer with start timer approaches */}
        <div className="border-t border-border px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-muted-foreground" style={{ fontSize: scaled(9) }}>
              <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> Navigate</span>
              <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> Copy to description</span>
              <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> Jira mode</span>
            </div>
          </div>

          {/* Start Timer Variants */}
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="font-brand text-muted-foreground/50 uppercase tracking-wider mb-1.5" style={{ fontSize: scaled(8) }}>
              Start timer from palette
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 1, label: 'A — Shift+Enter', desc: 'Hold Shift when pressing Enter to start timer instead of just copying' },
                { id: 2, label: 'B — Play button', desc: 'Hover row → play icon appears on right → click to start timer' },
                { id: 3, label: 'C — Tab to toggle', desc: 'Tab key toggles action: Enter=Copy vs Enter=Start. Indicator shows current mode' },
                { id: 4, label: 'D — / prefix', desc: 'Start query with / to switch to "start timer" mode for all results' },
                { id: 5, label: 'E — Long press', desc: 'Long-press Enter (hold 0.5s) to start timer. Quick press = copy' },
              ].map(v => (
                <button
                  key={v.id}
                  className={cn(
                    'rounded-md border px-2 py-1 transition-colors',
                    startVariant === v.id
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/20 hover:text-foreground',
                  )}
                  style={{ fontSize: scaled(9) }}
                  onClick={() => setStartVariant(startVariant === v.id ? 0 : v.id)}
                  title={v.desc}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {startVariant > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-1.5 text-muted-foreground/70 overflow-hidden"
                style={{ fontSize: scaled(9) }}
              >
                {startVariant === 1 && (
                  <div className="flex items-center gap-2">
                    <kbd className="rounded border border-border px-1 py-0.5 font-mono" style={{ fontSize: scaled(8) }}>⇧↵</kbd>
                    <span>Shift+Enter starts timer with selected issue. Plain Enter just copies title.</span>
                  </div>
                )}
                {startVariant === 2 && (
                  <div className="flex items-center gap-2">
                    <Play className="h-3 w-3 text-primary" />
                    <span>Play button visible on each result row (on hover). Click = start timer. Enter = copy title.</span>
                  </div>
                )}
                {startVariant === 3 && (
                  <div className="flex items-center gap-2">
                    <kbd className="rounded border border-border px-1 py-0.5 font-mono" style={{ fontSize: scaled(8) }}>⇥</kbd>
                    <span>Tab toggles between "Copy" and "Start" mode. Footer shows active mode. Enter applies current mode.</span>
                  </div>
                )}
                {startVariant === 4 && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-primary">/</span>
                    <span>Type / before query to enter "start timer" mode. e.g. "/#NETB-142" = start timer for that issue.</span>
                  </div>
                )}
                {startVariant === 5 && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-primary" />
                    <span>Hold Enter for 0.5s = start timer (progress ring around Enter key hint). Quick press = copy title.</span>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// Mock Sidebar
// ============================================================

function MockSidebar() {
  const navItems = [
    { label: 'Timer & Entries', icon: Timer, active: true },
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Calendar', icon: Calendar },
    { label: 'Leave', icon: Palmtree },
    { label: 'Reports', icon: BarChart3 },
  ];
  const adminItems = [
    { label: 'Users', icon: Users },
    { label: 'Projects', icon: FolderKanban },
  ];

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r border-sidebar-border bg-sidebar px-3 py-5">
      {/* Logo */}
      <div className="mb-5 flex items-center gap-2 px-2.5">
        <HourglassLogo className="h-[22px] w-[18px] text-primary" />
        <span className="font-brand text-[15px] font-semibold uppercase tracking-[3px] text-sidebar-foreground">
          Ternity
        </span>
      </div>

      {/* Tracking nav */}
      <nav className="flex flex-col gap-0.5">
        <div
          className="px-2.5 pb-1 pt-2 font-brand uppercase text-muted-foreground opacity-50"
          style={{ fontSize: 'calc(9px * var(--t-scale, 1.1))', letterSpacing: '2px' }}
        >
          Tracking
        </div>
        {navItems.map(item => (
          <div
            key={item.label}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground transition-colors cursor-pointer',
              item.active
                ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
            style={{ fontSize: 'calc(13px * var(--t-scale, 1.1))' }}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </div>
        ))}
      </nav>

      {/* Admin nav */}
      <nav className="mt-3 flex flex-col gap-0.5">
        <div
          className="px-2.5 pb-1 pt-2 font-brand uppercase text-muted-foreground opacity-50"
          style={{ fontSize: 'calc(9px * var(--t-scale, 1.1))', letterSpacing: '2px' }}
        >
          Admin
        </div>
        {adminItems.map(item => (
          <div
            key={item.label}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground transition-colors cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            style={{ fontSize: 'calc(13px * var(--t-scale, 1.1))' }}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </div>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Bottom nav */}
      <nav className="mb-2 flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground transition-colors cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          style={{ fontSize: 'calc(13px * var(--t-scale, 1.1))' }}>
          <Download className="h-4 w-4" />
          Downloads
        </div>
        <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground transition-colors cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          style={{ fontSize: 'calc(13px * var(--t-scale, 1.1))' }}>
          <Settings className="h-4 w-4" />
          Settings
        </div>
      </nav>

      {/* User block */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2.5">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] text-[11px] font-semibold text-[hsl(var(--t-avatar-text))]">
          EM
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-medium text-sidebar-foreground">Elena Marsh</div>
          <div className="text-[10px] text-muted-foreground">Admin</div>
        </div>
        <button className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 px-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
        v0.3.0-dev<span className="text-blue-400"> · local</span><span className="text-muted-foreground/50"> · 02-27 14:30</span>
      </div>
    </aside>
  );
}

// ============================================================
// Main Page Content
// ============================================================

function PageContent() {
  usePreferences(); // ensure provider is connected
  const timer = useFakeTimer();
  const [description, setDescription] = useState('');
  const [linkedIssue, setLinkedIssue] = useState<JiraIssue | null>(null);
  const [selectedProject, setSelectedProject] = useState<MockProject>(MOCK_PROJECTS[0]!);
  const [entries, setEntries] = useState(MOCK_ENTRIES);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const handleUpdateEntry = useCallback((id: string, patch: Partial<MockEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, []);

  const handlePaletteSelectIssue = useCallback((issue: JiraIssue) => {
    setDescription(issue.title);
    setLinkedIssue(issue);
    setLastAction(`Linked ${issue.key}: "${issue.title}" → description`);
    setTimeout(() => setLastAction(null), 3000);
  }, []);

  const handlePaletteStartTimer = useCallback((issue: JiraIssue, variant: number) => {
    setDescription(issue.title);
    setLinkedIssue(issue);
    timer.start();
    setLastAction(`Started timer for ${issue.key} (variant ${variant})`);
    setTimeout(() => setLastAction(null), 3000);
  }, [timer]);

  const totalSeconds = entries.reduce((sum, e) => sum + e.durationSeconds, 0) + (timer.running ? timer.elapsed : 0);

  return (
    <PaletteContext.Provider value={{ open: paletteOpen, setOpen: setPaletteOpen }}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <MockSidebar />

        <div className="flex flex-1 flex-col overflow-hidden">
          <DevToolbar />

          <main className="flex-1 overflow-auto p-6">
            {/* Page header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h1 className="font-brand text-lg font-semibold text-foreground" style={{ fontSize: scaled(18) }}>
                  Timer & Entries
                </h1>
                <p className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
                  Jira search prototype — # trigger, explicit icon, ⌘K palette
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPaletteOpen(true)}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary/20 hover:text-foreground"
                  style={{ fontSize: scaled(12) }}
                >
                  <Command className="h-3.5 w-3.5" />
                  Search
                  <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-muted-foreground/60" style={{ fontSize: scaled(9) }}>⌘K</kbd>
                </button>
              </div>
            </div>

            {/* Action feedback toast */}
            <AnimatePresence>
              {lastAction && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-primary"
                  style={{ fontSize: scaled(12) }}
                >
                  {lastAction}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Timer Bar */}
            <div className="mb-5">
              <MockTimerBar
                timer={timer}
                description={description}
                setDescription={setDescription}
                linkedIssue={linkedIssue}
                setLinkedIssue={setLinkedIssue}
                selectedProject={selectedProject}
                setSelectedProject={setSelectedProject}
              />
            </div>

            {/* Date nav bar */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex rounded-md border border-border">
                  <button className="rounded-l-md bg-primary/10 px-3 py-1.5 font-brand text-primary" style={{ fontSize: scaled(11) }}>Day</button>
                  <button className="rounded-r-md px-3 py-1.5 font-brand text-muted-foreground hover:text-foreground" style={{ fontSize: scaled(11) }}>Week</button>
                </div>
                <button className="rounded-md px-2 py-1.5 text-muted-foreground hover:text-foreground">
                  <ChevronDown className="h-4 w-4 rotate-90" />
                </button>
                <span className="font-brand font-semibold" style={{ fontSize: scaled(12) }}>
                  Thursday, 27 February 2026
                </span>
                <button className="rounded-md px-2 py-1.5 text-muted-foreground hover:text-foreground">
                  <ChevronDown className="h-4 w-4 -rotate-90" />
                </button>
                <button className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 font-brand text-primary" style={{ fontSize: scaled(10) }}>
                  Today
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground" style={{ fontSize: scaled(11) }}>Total</span>
                <span className="font-brand font-semibold tabular-nums text-foreground" style={{ fontSize: scaled(13) }}>
                  {fmtDurationShort(totalSeconds)}
                </span>
              </div>
            </div>

            {/* Day group */}
            <div className="rounded-lg border border-border">
              {/* Date header */}
              <div className="flex items-center justify-between rounded-t-lg px-4 py-2" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
                <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Thursday, 27 Feb
                </span>
                <span className="font-brand text-xs font-semibold tabular-nums text-foreground">
                  {fmtDurationShort(totalSeconds)}
                </span>
              </div>

              {/* Running entry */}
              {timer.running && (
                <div className="flex items-center gap-3 border-b border-border/50 px-4 py-2.5" style={{ background: 'hsl(var(--primary) / 0.06)' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r bg-primary" />
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      {linkedIssue && <JiraChip issue={linkedIssue} compact />}
                      <span className="text-primary truncate" style={{ fontSize: scaled(13) }}>
                        {description || 'No description'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ background: selectedProject.color }} />
                      <span className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
                        {selectedProject.clientName} · {selectedProject.name}
                      </span>
                    </div>
                  </div>
                  <span className="tabular-nums text-primary" style={{ fontSize: scaled(11) }}>
                    {new Date().toTimeString().slice(0, 5)} – now
                  </span>
                  <span className="font-brand font-semibold tabular-nums text-primary" style={{ fontSize: scaled(13) }}>
                    {fmtDuration(timer.elapsed)}
                  </span>
                  <button
                    onClick={timer.stop}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-white"
                  >
                    <Square className="h-3 w-3 fill-current" />
                  </button>
                </div>
              )}

              {/* Past entries */}
              {entries.map(entry => (
                <MockEntryRow key={entry.id} entry={entry} onUpdate={handleUpdateEntry} />
              ))}
            </div>

            {/* Legend */}
            <div className="mt-8 rounded-lg border border-border/50 bg-muted/20 px-5 py-4">
              <h3 className="font-brand font-semibold text-foreground mb-3" style={{ fontSize: scaled(13) }}>
                Interaction Guide
              </h3>
              <div className="grid grid-cols-2 gap-4" style={{ fontSize: scaled(11) }}>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Timer Bar</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Click the <strong className="text-primary">Jira icon</strong> to open the browse/search dropdown</li>
                    <li>• Type <strong className="text-primary">#</strong> in the description to trigger inline Jira search</li>
                    <li>• <strong className="text-primary">⌘K</strong> opens the global command palette</li>
                    <li>• Selecting an issue sets description + shows a linked chip</li>
                    <li>• Click <strong className="text-primary">X</strong> on the chip to unlink</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Entry Rows</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Hover an unlinked entry → <strong className="text-primary">Jira icon</strong> appears → click to search</li>
                    <li>• Click description to edit → type <strong className="text-primary">#</strong> for inline Jira search</li>
                    <li>• Linked entries show a <strong className="text-primary">key chip</strong> with external link</li>
                    <li>• Click the external link icon to open in Jira</li>
                  </ul>
                </div>
                <div className="col-span-2">
                  <h4 className="font-semibold text-foreground mb-1">Command Palette (⌘K)</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Opens with <strong className="text-primary">⌘K</strong> — shows assigned + recent issues by default</li>
                    <li>• Type <strong className="text-primary">#</strong> to activate Jira search mode (e.g., #123 searches IDs, #onboard searches titles)</li>
                    <li>• <strong className="text-primary">Enter</strong> copies issue title to timer description</li>
                    <li>• <strong className="text-primary">5 start-timer variants</strong> shown in the palette footer — click to preview each approach</li>
                    <li>• Hover a result row → <strong className="text-primary">play button</strong> appears to start timer directly</li>
                  </ul>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Command palette */}
        <AnimatePresence>
          {paletteOpen && (
            <CommandPalette
              onSelectIssue={handlePaletteSelectIssue}
              onStartTimer={handlePaletteStartTimer}
            />
          )}
        </AnimatePresence>
      </div>
    </PaletteContext.Provider>
  );
}

// ============================================================
// Export
// ============================================================

export function DevJiraSearchPage() {
  if (!import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_PAGES !== 'true') return null;

  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <PageContent />
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
