import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoginPanel, RegisterPanel } from '../pages/AuthPages';

type Mode = 'login' | 'register';

interface AuthDialogValue {
  /** Opens the log in / sign up pop-up over the current page. `from`: where to go after logging in. */
  openAuth: (mode: Mode, from?: string) => void;
}

const AuthDialogContext = createContext<AuthDialogValue | null>(null);

export function useAuthDialog(): AuthDialogValue {
  const ctx = useContext(AuthDialogContext);
  if (!ctx) throw new Error('useAuthDialog must be used inside <AuthDialogProvider>');
  return ctx;
}

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dialog = useRef<HTMLDialogElement>(null);

  const openAuth = useCallback((next: Mode, target?: string) => {
    setMode(next);
    setFrom(target ?? null);
  }, []);
  const close = useCallback(() => setMode(null), []);
  const value = useMemo(() => ({ openAuth }), [openAuth]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (mode && !d.open) d.showModal();
    else if (!mode && d.open) d.close();
  }, [mode]);

  function done() {
    close();
    if (from && from !== pathname) navigate(from);
  }

  return (
    <AuthDialogContext.Provider value={value}>
      {children}
      <dialog
        ref={dialog}
        className="modal modal-auth"
        aria-label={mode === 'register' ? 'Create your account' : 'Log in'}
        onCancel={(e) => {
          e.preventDefault(); // Escape closes it
          close();
        }}
        onClick={(e) => e.target === dialog.current && close()}
      >
        {mode && (
          <>
            <button type="button" className="auth-close" aria-label="Close" onClick={close}>
              ×
            </button>
            {mode === 'login' ? (
              <LoginPanel onSuccess={done} onSwitch={() => setMode('register')} />
            ) : (
              <RegisterPanel onSuccess={done} onSwitch={() => setMode('login')} />
            )}
          </>
        )}
      </dialog>
    </AuthDialogContext.Provider>
  );
}
