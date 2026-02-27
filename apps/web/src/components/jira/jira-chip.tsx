import { X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import type { JiraIssueLink } from '@ternity/shared';

interface JiraChipProps {
  issue: JiraIssueLink;
  onUnlink?: () => void;
  compact?: boolean;
}

/** Linked Jira issue badge: key (Oxanium) + external link + optional unlink X */
export function JiraChip({ issue, onUnlink, compact }: JiraChipProps) {
  const browseUrl = `${issue.siteUrl}/browse/${issue.key}`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 text-primary',
        compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5',
      )}
    >
      <span
        className="font-brand font-semibold"
        style={{ fontSize: scaled(compact ? 10 : 11) }}
      >
        {issue.key}
      </span>
      <a
        href={browseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-primary/80"
        onClick={(e) => e.stopPropagation()}
        title={`Open ${issue.key} in Jira`}
      >
        <ExternalLink className="h-3 w-3" />
      </a>
      {onUnlink && (
        <button
          className="hover:text-destructive transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onUnlink();
          }}
          title="Unlink issue"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
