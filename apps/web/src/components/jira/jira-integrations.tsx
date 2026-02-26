import { scaled } from '@/lib/scaled';
import { Plus } from 'lucide-react';
import { useJiraConnections } from '@/hooks/use-jira';
import { JiraConnectionCard } from './jira-connection-card';

function buildJiraAuthUrl(): string {
  const clientId = import.meta.env.VITE_JIRA_CLIENT_ID;
  const callbackUrl = import.meta.env.VITE_JIRA_CALLBACK_URL;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: 'read:jira-work read:jira-user read:me offline_access',
    redirect_uri: callbackUrl,
    state,
    response_type: 'code',
    prompt: 'consent',
  });

  return `https://auth.atlassian.com/authorize?${params}`;
}

export function JiraIntegrations() {
  const { data: connections = [], isLoading } = useJiraConnections();

  if (isLoading) {
    return (
      <p className="text-muted-foreground" style={{ fontSize: scaled(12) }}>
        Loading...
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {connections.map((conn, i) => (
        <JiraConnectionCard
          key={conn.id}
          connection={conn}
        />
      ))}

      <button
        onClick={() => {
          window.location.href = buildJiraAuthUrl();
        }}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-foreground transition-colors hover:border-primary/50 hover:bg-muted/50"
        style={{ fontSize: scaled(12) }}
      >
        <Plus className="h-3.5 w-3.5" />
        {connections.length > 0 ? 'Connect another Jira site' : 'Connect Jira'}
      </button>
    </div>
  );
}
