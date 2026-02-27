import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

export function JiraCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const exchanged = useRef(false);
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // Wait for auth to be ready before calling the API
    if (isLoading) return;
    if (!user) {
      setError('Not authenticated — please sign in first');
      return;
    }
    if (exchanged.current) return;
    exchanged.current = true;

    const code = searchParams.get('code');
    if (!code) {
      setError('No authorization code received from Atlassian');
      return;
    }

    apiFetch<{ atlassianUser: { name: string }; sites: { siteName: string }[] }>('/jira/exchange', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
      .then((data) => {
        const siteNames = data.sites.map((s) => s.siteName).join(', ');
        toast.success(`Connected to Jira: ${siteNames}`);
        navigate('/settings', { replace: true });
      })
      .catch((err) => {
        console.error('Jira exchange failed:', err);
        setError(err instanceof Error ? err.message : 'Token exchange failed');
      });
  }, [isLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-destructive">Jira connection failed</p>
        <p className="max-w-md text-center text-sm text-muted-foreground">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/settings', { replace: true })}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            Back to Settings
          </button>
          <button
            onClick={() => {
              exchanged.current = false;
              setError(null);
              window.location.reload();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <p className="text-muted-foreground">Connecting to Jira…</p>
    </div>
  );
}
