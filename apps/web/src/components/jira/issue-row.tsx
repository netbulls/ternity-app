import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import type { JiraIssue } from '@ternity/shared';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'In Progress': { bg: 'hsl(217 91% 60% / 0.15)', text: 'hsl(217 91% 60%)' },
  'To Do': { bg: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))' },
  'In Review': { bg: 'hsl(38 92% 50% / 0.15)', text: 'hsl(38 92% 50%)' },
  Done: { bg: 'hsl(142 71% 45% / 0.15)', text: 'hsl(142 71% 45%)' },
};

const TYPE_COLORS: Record<string, string> = {
  Story: 'hsl(142 71% 45%)',
  Bug: 'hsl(0 72% 51%)',
  Task: 'hsl(217 91% 60%)',
  Epic: 'hsl(271 81% 56%)',
  'Sub-task': 'hsl(38 92% 50%)',
};

interface IssueRowProps {
  issue: JiraIssue;
  selected?: boolean;
  onSelect: (issue: JiraIssue) => void;
  showStartTimer?: boolean;
  onStartTimer?: (issue: JiraIssue) => void;
}

/** Issue result row: type dot + key + title + status badge */
export function IssueRow({ issue, selected, onSelect, showStartTimer, onStartTimer }: IssueRowProps) {
  const sc = STATUS_COLORS[issue.status] ?? STATUS_COLORS['To Do']!;

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors',
        selected ? 'bg-primary/10' : 'hover:bg-muted/50',
      )}
      onClick={() => onSelect(issue)}
    >
      <div
        className="flex-shrink-0 h-2.5 w-2.5 rounded-full"
        style={{ background: TYPE_COLORS[issue.type] ?? 'hsl(var(--muted-foreground))' }}
      />
      <span
        className="font-brand font-semibold text-primary flex-shrink-0"
        style={{ fontSize: scaled(11) }}
      >
        {issue.key}
      </span>
      <span className="flex-1 truncate text-foreground" style={{ fontSize: scaled(12) }}>
        {issue.summary}
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
          onClick={(e) => {
            e.stopPropagation();
            onStartTimer(issue);
          }}
          title="Start timer"
        >
          <Play className="h-3 w-3 text-primary fill-primary" />
        </button>
      )}
    </div>
  );
}
