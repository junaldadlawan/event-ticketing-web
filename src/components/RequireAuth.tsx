import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useAuthDialog } from '../auth/AuthDialog';
import { Empty, Spinner } from './ui';

/** Shows the page only to a logged-in user; otherwise the log in pop-up opens over it (no page change). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { openAuth } = useAuthDialog();
  const { pathname } = useLocation();
  const needsLogin = !loading && !user;
  useEffect(() => {
    if (needsLogin) openAuth('login', pathname);
  }, [needsLogin, pathname, openAuth]);
  if (loading) return <Spinner />;
  if (!user) {
    return (
      <Empty>
        Log in to continue.{' '}
        <button type="button" className="btn-link" onClick={() => openAuth('login', pathname)}>
          Log in
        </button>
      </Empty>
    );
  }
  return <>{children}</>;
}
