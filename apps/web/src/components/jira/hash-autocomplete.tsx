import { Loader2, CornerDownLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { scaled } from '@/lib/scaled';
import { useJiraSearch } from '@/hooks/use-jira';
import { IssueRow } from './issue-row';
import type { JiraIssue } from '@ternity/shared';

interface HashAutocompleteProps {
  query: string;
  onSelect: (issue: JiraIssue, connectionId: string, siteUrl: string) => void;
}

/** Inline autocomplete below description input, triggered by # */
export function HashAutocomplete({ query, onSelect }: HashAutocompleteProps) {
  const { data: results, isLoading } = useJiraSearch(query, 'text');

  const allIssues = results?.flatMap((r) => r.issues) ?? [];

  if (allIssues.length === 0 && query.length < 2 && !isLoading) return null;

  const handleSelect = (issue: JiraIssue) => {
    const result = results?.find((r) => r.issues.some((i) => i.key === issue.key));
    onSelect(issue, result?.connectionId ?? '', result?.siteUrl ?? '');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-4 text-muted-foreground gap-2" style={{ fontSize: scaled(11) }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Searching...
        </div>
      ) : allIssues.length > 0 ? (
        <div className="max-h-[200px] overflow-y-auto p-1">
          {allIssues.slice(0, 5).map((issue) => (
            <IssueRow key={issue.key} issue={issue} onSelect={handleSelect} />
          ))}
        </div>
      ) : (
        <div className="px-3 py-4 text-center text-muted-foreground" style={{ fontSize: scaled(11) }}>
          No issues matching &ldquo;{query}&rdquo;
        </div>
      )}
      <div className="border-t border-border px-3 py-1.5 text-muted-foreground" style={{ fontSize: scaled(9) }}>
        <span className="flex items-center gap-1">
          <CornerDownLeft className="inline h-3 w-3" /> to link issue
        </span>
      </div>
    </motion.div>
  );
}
