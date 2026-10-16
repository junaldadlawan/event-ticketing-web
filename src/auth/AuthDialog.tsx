import { SHOW_TEST_USERS } from '../config';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoginPanel, RegisterPanel } from '../pages/AuthPages';
import { TEST_GROUPS, TEST_USERS } from './testUsers';

type Mode = 'login' | 'register';
type Fill = { email: string; password: string };

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

/**
 * Dev only: the seeded accounts; a click fills the log in form with that account. A manual popover, so it sits
 * in the top layer beside the dialog (it is a child of the dialog, so the dialog's modal "inert" does not block it).
 */
function TestUsers({ onPick }: { onPick: (fill: Fill) => void }) {
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = box.current;
    // Show it a frame later: the log in window is opened (as a modal) in the same render, and whatever enters the top layer
    // last is drawn on top. Shown first, the panel ended up behind the window's dimmed, blurred backdrop in a built site.
    const frame = requestAnimationFrame(() => {
      try {
        el?.showPopover?.();
      } catch {
        // already showing
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      try {
        el?.hidePopover?.();
      } catch {
        // not showing
      }
    };
  }, []);

  return (
    <aside ref={box} className="test-users" {...{ popover: 'manual' }} aria-label="Test users">
      <h2>Test users</h2>
      <p className="test-users-note small">
        <strong>Demo only.</strong> This panel is not part of the application. It only helps to try the app with
        sample accounts.
      </p>
      <p className="muted small">Click an account to fill the form.</p>
      {TEST_GROUPS.map((g) => (
        <section key={g.tone} className="test-group" data-tone={g.tone}>
          <h3>{g.title}</h3>
          <div className="test-grid">
            {TEST_USERS.filter((u) => u.tone === g.tone).map((u) => (
              <button
                key={u.email}
                type="button"
                className="test-user"
                data-tone={u.tone}
                title={u.email}
                onClick={() => onPick({ email: u.email, password: u.password })}
              >
                <strong>{u.name}</strong>
                <span className="muted small">{u.email}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [fill, setFill] = useState<Fill | null>(null);
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

  // After logging in (or signing up) the person starts fresh: the top of the Home page. A page that needed the log in
  // (add to cart, a members-only page) names itself in `from` so the person stays where they were.
  function done() {
    close();
    if (from) {
      if (from !== pathname) navigate(from);
      return;
    }
    navigate('/');
    window.scrollTo(0, 0);
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
              <LoginPanel onSuccess={done} onSwitch={() => setMode('register')} fill={fill} />
            ) : (
              <RegisterPanel onSuccess={done} onSwitch={() => setMode('login')} />
            )}
            {SHOW_TEST_USERS && mode === 'login' && <TestUsers onPick={(f) => setFill({ ...f })} />}
          </>
        )}
      </dialog>
    </AuthDialogContext.Provider>
  );
}
