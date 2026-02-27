import { useState } from 'react';
import { scaled } from '@/lib/scaled';
import { Plus, UserPlus, ExternalLink, ArrowRight } from 'lucide-react';
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
  const [showSwitchSteps, setShowSwitchSteps] = useState(false);

  if (isLoading) {
    return (
      <p className="text-muted-foreground" style={{ fontSize: scaled(12) }}>
        Loading...
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {connections.map((conn) => (
        <JiraConnectionCard
          key={conn.id}
          connection={conn}
          onReconnect={() => {
            window.location.href = buildJiraAuthUrl();
          }}
        />
      ))}

      {/* Switch account — two-step flow */}
      {showSwitchSteps ? (
        <div className="rounded-lg border border-border bg-muted/15 px-4 py-3 space-y-2.5">
          <p className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
            To connect a different Atlassian account:
          </p>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" style={{ fontSize: scaled(10) }}>1</span>
            <a
              href="https://id.atlassian.com/logout"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary/80"
              style={{ fontSize: scaled(12) }}
            >
              Log out of Atlassian
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" style={{ fontSize: scaled(10) }}>2</span>
            <button
              onClick={() => {
                window.location.href = buildJiraAuthUrl();
              }}
              className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary/80"
              style={{ fontSize: scaled(12) }}
            >
              Connect new account
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <button
            onClick={() => setShowSwitchSteps(false)}
            className="text-muted-foreground/50 transition-colors hover:text-muted-foreground"
            style={{ fontSize: scaled(10) }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              window.location.href = buildJiraAuthUrl();
            }}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-foreground transition-colors hover:border-primary/50 hover:bg-muted/50"
            style={{ fontSize: scaled(12) }}
          >
            <Plus className="h-3.5 w-3.5" />
            {connections.length > 0 ? 'Connect another site' : 'Connect Jira'}
          </button>

          {connections.length > 0 && (
            <button
              onClick={() => setShowSwitchSteps(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 hover:text-foreground"
              style={{ fontSize: scaled(12) }}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Different account
            </button>
          )}
        </div>
      )}
    </div>
  );
}
