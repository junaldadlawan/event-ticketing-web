import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useManagementHidden, useViewMode } from '../auth/ViewMode';
import type { ViewMode } from '../auth/ViewMode';
import { useIsHost } from '../auth/useCanManage';
import { useCart } from '../cart/CartContext';
import { ThemeToggle } from '../theme/ThemeToggle';
import { Avatar } from './Avatar';
import { TicketIcon } from './DesignerIcons';
import { BackButton } from './BackButton';
import { ConfirmDialog } from './ConfirmDialog';
import { useUnsavedChangesApi } from './UnsavedChanges';
import { ViewSwitcher } from './ViewSwitcher';

function CartIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.3h8.7a1.5 1.5 0 0 0 1.5-1.2L21 8H6.2" />
      <circle cx="9.5" cy="20" r="1.25" />
      <circle cx="17.5" cy="20" r="1.25" />
    </svg>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const { confirmLeave } = useUnsavedChangesApi();

  const [confirmingLogout, setConfirmingLogout] = useState(false);
  // The view the user asked for, waiting for a "yes" before it is applied.
  const [switchingTo, setSwitchingTo] = useState<ViewMode | null>(null);
  const isHost = useIsHost();
  const { mode, setMode } = useViewMode();
  const managementHidden = useManagementHidden();
  const { pathname } = useLocation();

  // Switching to the customer view while on a management page takes you to the customer side.
  useEffect(() => {
    if (managementHidden && /^\/(manage|admin)(\/|$)/.test(pathname)) navigate('/home', { replace: true });
  }, [managementHidden, pathname, navigate]);

  async function confirmSwitch() {
    const next = switchingTo;
    setSwitchingTo(null);
    if (!next) return;
    // Going to the customer view leaves any management page: ask about unsaved edits first.
    if (next === 'customer' && /^\/(manage|admin)(\/|$)/.test(pathname) && !(await confirmLeave())) return;
    setMode(next);
  }

  async function handleLogout() {
    setConfirmingLogout(false);
    if (!(await confirmLeave())) return; // unsaved edits: discard or keep editing
    await logout();
    navigate('/');
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="container topbar-inner">
          <NavLink to="/home" className="brand">
            Home
          </NavLink>
          <NavLink to="/" end className="brand">
            Events
          </NavLink>
          {user && !managementHidden && (
            <nav className="nav" aria-label="Organizer">
              {/* the Team tab lives under /manage too, so Manage is not highlighted there */}
              <NavLink to="/manage" className={({ isActive }) => (isActive && pathname !== '/manage/team' ? 'active' : '')}>
                Manage
              </NavLink>
              {user.role !== 'ADMIN' && isHost === true && <NavLink to="/manage/team">Team</NavLink>}
              {user.role === 'ADMIN' && (
                <>
                  <NavLink to="/admin/posts">Posts</NavLink>
                  <NavLink to="/admin/organizations">Organizations</NavLink>
                  <NavLink to="/admin/users">Users</NavLink>
                  <NavLink to="/admin/payouts">Payouts</NavLink>
                </>
              )}
            </nav>
          )}
          <div className="nav nav-right">
            {user && isHost === true && (
              <ViewSwitcher mode={mode} onChoose={setSwitchingTo} />
            )}
            <ThemeToggle />
            {user && (
              <>
                <span className="nav-divider" aria-hidden="true" />
                <nav className="nav" aria-label="Buyer">
                  <NavLink
                    to="/cart"
                    className="cart-link"
                    title="Cart"
                    aria-label={itemCount > 0 ? `Cart, ${itemCount} items` : 'Cart'}
                  >
                    <CartIcon />
                    {itemCount > 0 && (
                      <span className="cart-count" aria-hidden="true">
                        {itemCount > 99 ? '99+' : itemCount}
                      </span>
                    )}
                  </NavLink>
                  <NavLink to="/orders" className="cart-link" title="My orders" aria-label="My orders">
                    <TicketIcon />
                  </NavLink>
                </nav>
              </>
            )}
            {user ? (
              <>
                <NavLink to="/profile" className="nav-user">
                  <Avatar src={user.avatarUrl} name={user.name} size={26} />
                  {user.name.trim().split(/\s+/)[0]}
                </NavLink>
                <button className="btn btn-link" onClick={() => setConfirmingLogout(true)}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Log in</NavLink>
                <Link to="/register" className="btn btn-cta btn-sm">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <ConfirmDialog
        open={confirmingLogout}
        title="Log out?"
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={() => void handleLogout()}
      >
        You'll need to sign in again to see your orders and tickets.
      </ConfirmDialog>
      <ConfirmDialog
        open={switchingTo !== null}
        title={switchingTo === 'customer' ? 'Switch to Customer view?' : 'Switch to Management view?'}
        confirmLabel="Switch"
        cancelLabel="Stay here"
        onCancel={() => setSwitchingTo(null)}
        onConfirm={() => void confirmSwitch()}
      >
        {switchingTo === 'customer'
          ? "You'll see the app the way buyers do, without the Manage and Posts tabs. Switch back any time."
          : 'The Manage and Posts tabs come back, along with the Manage buttons on your events.'}
      </ConfirmDialog>
      <main className="container main">
        <BackButton />
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <span>© {new Date().getFullYear()} events</span>
          <nav className="footer-links" aria-label="Footer">
            <Link to="/">Events</Link>
            <Link to="/apply">Host an event</Link>
            {user ? (
              <>
                <Link to="/orders">Orders</Link>
                {!managementHidden && <Link to="/manage">Manage</Link>}
                <Link to="/profile">Profile</Link>
              </>
            ) : (
              <>
                <Link to="/login">Log in</Link>
                <Link to="/register">Sign up</Link>
              </>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}
