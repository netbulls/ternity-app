import { useHandleSignInCallback } from '@logto/react';
import { useNavigate } from 'react-router-dom';

export function CallbackPage() {
  const navigate = useNavigate();

  const { isLoading } = useHandleSignInCallback(() => {
    navigate('/', { replace: true });
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">Signing in…</p>
      </div>
    );
  }

  return null;
}
