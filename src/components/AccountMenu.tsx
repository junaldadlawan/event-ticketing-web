import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { User } from '../api/types';
import type { ViewMode } from '../auth/ViewMode';
import { fullName } from '../utils/format';
import { Avatar } from './Avatar';
import { CheckIcon } from './DesignerIcons';

/** The customer header's account menu: a pill with a menu icon and the avatar, opening a list of links (log in or out at the end). */
export function AccountMenu({
  user,
  isHost,
  customerView,
  mode,
  position,
  onChooseMode,
  onOpenAuth,
  onLogout,
}: {
  user: User | null;
  isHost: boolean;
  /** True in the customer header: it adds Orders, My tickets and Payment methods. */
  customerView: boolean;
  mode: ViewMode;
  position: string | null;
  onChooseMode: (next: ViewMode) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const link = (to: string, label: string) => (
    <Link to={to} role="menuitem" className="account-item" onClick={() => setOpen(false)}>
      {label}
    </Link>
  );
  const action = (label: string, run: () => void, strong = false) => (
    <button type="button" role="menuitem" className={strong ? 'account-item strong' : 'account-item'} onClick={() => { setOpen(false); run(); }}>
      {label}
    </button>
  );

  // The role: browse as a customer, or work as the person's position (Organization Owner, Admin...). Only hosts have both.
  const roles: { mode: ViewMode; label: string }[] = [
    { mode: 'customer', label: 'Customer' },
    { mode: 'manage', label: position ?? 'Management' },
  ];

  return (
    <div className="account-menu" ref={box}>
      <div className="account-buttons">
        <button className="account-circle" type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)}>
          {user ? (
            <Avatar src={user.avatarUrl} name={fullName(user)} size={48} />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3.2" /><path d="M5.5 18.5c1.5-3 4-4 6.5-4s5 1 6.5 4" /></svg>
          )}
        </button>
      </div>
      {open && (
        <div className="account-popup" role="menu">
          {user ? (
            <>
              {isHost && (
                <>
                  <p className="account-role-title">Role</p>
                  {roles.map((r) => (
                    <button
                      key={r.mode}
                      type="button"
                      role="menuitemradio"
                      aria-checked={r.mode === mode}
                      className="account-item account-role"
                      onClick={() => {
                        setOpen(false);
                        if (r.mode !== mode) onChooseMode(r.mode);
                      }}
                    >
                      <span className="account-check" aria-hidden="true">
                        {r.mode === mode && <CheckIcon />}
                      </span>
                      {r.label}
                    </button>
                  ))}
                  <hr />
                </>
              )}
              {link('/profile', 'Profile')}
              {customerView && link('/orders', 'Orders')}
              {customerView && link('/tickets', 'My tickets')}
              {customerView && link('/profile/payment', 'Payment methods')}
              {link('/settings', 'Settings')}
              <hr />
              {customerView && !isHost && link('/apply', 'Host an event')}
              {customerView && link('/contact', 'Contact us')}
              <hr />
              {action('Log out', onLogout)}
            </>
          ) : (
            <>
              {action('Log in', () => onOpenAuth('login'), true)}
              {action('Sign up', () => onOpenAuth('register'))}
              <hr />
              {link('/apply', 'Host an event')}
              {link('/contact', 'Contact us')}
            </>
          )}
        </div>
      )}
    </div>
  );
}
