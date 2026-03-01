import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ArrowUp, ArrowDown, CornerDownLeft, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { useJiraSearch, useJiraAssigned, useJiraRecent } from '@/hooks/use-jira';
import { IssueRow } from './issue-row';
import type { JiraIssue, JiraSearchResult } from '@ternity/shared';

interface JiraSearchDropdownProps {
  onSelect: (issue: JiraIssue, connectionId: string, siteUrl: string) => void;
  onClose: () => void;
  anchorRight?: boolean;
}

/** 480px dropdown with Browse/Search tabs and keyboard nav */
export function JiraSearchDropdown({ onSelect, onClose, anchorRight }: JiraSearchDropdownProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'browse' | 'search'>('browse');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Real queries
  const assignedQuery = useJiraAssigned();
  const recentQuery = useJiraRecent();
  const searchQuery = useJiraSearch(query, 'text');

  const showSearch = tab === 'search' || query.length > 0;

  const handleSelect = useCallback(
    (issue: JiraIssue, results: JiraSearchResult[]) => {
      // Find which connection this issue belongs to
      const result = results.find((r) => r.issues.some((i) => i.key === issue.key));
      onSelect(issue, result?.connectionId ?? '', result?.siteUrl ?? '');
    },
    [onSelect],
  );

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
      onClick={(e) => e.stopPropagation()}
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
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value) setTab('search');
          }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setTab('browse');
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Tab toggle */}
      {!query && (
        <div className="flex gap-0 border-b border-border">
          <button
            className={cn(
              'px-4 py-2 font-brand transition-colors',
              tab === 'browse'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab('browse')}
            style={{ fontSize: scaled(10) }}
          >
            Browse
          </button>
          <button
            className={cn(
              'px-4 py-2 font-brand transition-colors',
              tab === 'search'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground',
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
          <SearchResults
            query={query}
            results={searchQuery.data ?? []}
            isLoading={searchQuery.isLoading}
            onSelect={(issue) => handleSelect(issue, searchQuery.data ?? [])}
          />
        ) : (
          <BrowseResults
            assigned={assignedQuery.data ?? []}
            recent={recentQuery.data ?? []}
            isLoading={assignedQuery.isLoading || recentQuery.isLoading}
            onSelect={(issue) => {
              const all = [...(assignedQuery.data ?? []), ...(recentQuery.data ?? [])];
              handleSelect(issue, all);
            }}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <div
          className="flex items-center gap-3 text-muted-foreground"
          style={{ fontSize: scaled(9) }}
        >
          <span className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            <ArrowDown className="h-3 w-3" /> Navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> Select
          </span>
          <span className="flex items-center gap-1">esc Close</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          style={{ fontSize: scaled(10) }}
        >
          Close
        </button>
      </div>
    </motion.div>
  );
}

function SearchResults({
  query,
  results,
  isLoading,
  onSelect,
}: {
  query: string;
  results: JiraSearchResult[];
  isLoading: boolean;
  onSelect: (issue: JiraIssue) => void;
}) {
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-8 text-muted-foreground gap-2"
        style={{ fontSize: scaled(12) }}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Searching...
      </div>
    );
  }

  if (results.length === 0 && query.length >= 2) {
    return (
      <div className="py-8 text-center text-muted-foreground" style={{ fontSize: scaled(12) }}>
        No issues matching &ldquo;{query}&rdquo;
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground" style={{ fontSize: scaled(12) }}>
        Type to search Jira issues
      </div>
    );
  }

  return (
    <>
      {results.map((group) => (
        <div key={group.connectionId} className="mb-2">
          <div
            className="px-3 py-1.5 font-brand text-muted-foreground/60 uppercase tracking-wider"
            style={{ fontSize: scaled(9) }}
          >
            {group.siteName}
          </div>
          {group.issues.map((issue) => (
            <IssueRow key={issue.key} issue={issue} onSelect={onSelect} />
          ))}
        </div>
      ))}
    </>
  );
}

function BrowseResults({
  assigned,
  recent,
  isLoading,
  onSelect,
}: {
  assigned: JiraSearchResult[];
  recent: JiraSearchResult[];
  isLoading: boolean;
  onSelect: (issue: JiraIssue) => void;
}) {
  const assignedIssues = assigned.flatMap((r) => r.issues);
  const recentIssues = recent.flatMap((r) => r.issues);

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-8 text-muted-foreground gap-2"
        style={{ fontSize: scaled(12) }}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <>
      {/* Assigned to me */}
      <div className="mb-3">
        <div
          className="px-3 py-1.5 font-brand text-muted-foreground/60 uppercase tracking-wider"
          style={{ fontSize: scaled(9) }}
        >
          Assigned to me
        </div>
        {assignedIssues.length > 0 ? (
          assignedIssues.map((issue) => (
            <IssueRow key={issue.key} issue={issue} onSelect={onSelect} />
          ))
        ) : (
          <div className="px-3 py-2 text-muted-foreground" style={{ fontSize: scaled(11) }}>
            No assigned issues
          </div>
        )}
      </div>
      {/* Recently viewed */}
      <div>
        <div
          className="px-3 py-1.5 font-brand text-muted-foreground/60 uppercase tracking-wider"
          style={{ fontSize: scaled(9) }}
        >
          Recently viewed
        </div>
        {recentIssues.length > 0 ? (
          recentIssues.map((issue) => (
            <IssueRow key={issue.key} issue={issue} onSelect={onSelect} />
          ))
        ) : (
          <div className="px-3 py-2 text-muted-foreground" style={{ fontSize: scaled(11) }}>
            No recent issues
          </div>
        )}
      </div>
    </>
  );
}
