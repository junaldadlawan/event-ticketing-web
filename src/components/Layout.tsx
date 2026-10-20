import { CustomerNotificationBell } from './CustomerNotificationBell';
import { NotificationBell } from './NotificationBell';
import { isAdmin as isAdminRole } from '../auth/roles';
import { useEffect, useState } from 'react';
import { fullName, isNewAccount } from '../utils/format';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useAuthDialog } from '../auth/AuthDialog';
import { useManagementHidden, useViewMode } from '../auth/ViewMode';
import type { ViewMode } from '../auth/ViewMode';
import { useIsHost, usePosition } from '../auth/useCanManage';
import { useCart } from '../cart/CartContext';
import { ThemeToggle } from '../theme/ThemeToggle';
import { Avatar } from './Avatar';
import { SparkleIcon, TicketIcon } from './DesignerIcons';
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
  const { openAuth } = useAuthDialog();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const { confirmLeave } = useUnsavedChangesApi();

  const [confirmingLogout, setConfirmingLogout] = useState(false);
  // The view the user asked for, waiting for a "yes" before it is applied.
  const [switchingTo, setSwitchingTo] = useState<ViewMode | null>(null);
  const isHost = useIsHost();
  const position = usePosition();
  const { mode, setMode } = useViewMode();
  // Management tabs are for people who run events (or admins): a plain customer never sees them. While that is
  // still being checked (isHost === null) they stay hidden too.
  const hideManagement = useManagementHidden() || isHost !== true;
  const { pathname } = useLocation();
  // An owner or organizer (not an admin) looking at the management view.
  const orgMemberView = Boolean(user) && !isAdminRole(user?.role) && isHost === true && !hideManagement;

  // Switching to the customer view while on a management page takes you to the customer side.
  useEffect(() => {
    // A customer (or a host browsing as one) who lands on a management address is sent to the home page.
    if (isHost === false || (isHost === true && hideManagement)) {
      if (/^\/(manage|admin)(\/|$)/.test(pathname)) navigate('/', { replace: true });
    }
    // The customer home page is not a manager's landing screen: the management view starts at Event Management.
    if (isHost === true && !hideManagement && pathname === '/') navigate('/manage', { replace: true });
  }, [isHost, hideManagement, pathname, navigate]);

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
          {/* Organization members (owner, organizer) in their management view work from Event Management, Team and Settings. */}
          {!orgMemberView && (
            <>
              {hideManagement && (
                <NavLink to="/" end className="brand">
                  Home
                </NavLink>
              )}
              <NavLink to="/events" end className="brand">
                Events
              </NavLink>
            </>
          )}
          {user && !hideManagement && (
            <nav className="nav" aria-label="Organizer">
              {/* Team and Settings live under /manage too, so Event Management is not highlighted there */}
              <NavLink to="/manage" className={({ isActive }) => (isActive && !['/manage/team', '/manage/settings', '/manage/finance'].includes(pathname) ? 'active' : '')}>
                Event Management
              </NavLink>
              {!isAdminRole(user.role) && isHost === true && <NavLink to="/manage/team">Team</NavLink>}
              {!isAdminRole(user.role) && position === 'Organization Owner' && <NavLink to="/manage/finance">Finance &amp; Payouts</NavLink>}
              {!isAdminRole(user.role) && isHost === true && <NavLink to="/manage/settings">Settings</NavLink>}
              {isAdminRole(user.role) && (
                <>
                  <NavLink to="/admin/posts">Posts</NavLink>
                  <NavLink to="/admin/organizations">Organizations</NavLink>
                  <NavLink to="/admin/users">Users</NavLink>
                  <NavLink to="/admin/payouts">Finance &amp; Payouts</NavLink>
                  <NavLink to="/admin/disputes">Disputes</NavLink>
                  <NavLink to="/admin/settings">Settings</NavLink>
                </>
              )}
            </nav>
          )}
          <div className="nav nav-right">
            {user && isHost === true && (
              <ViewSwitcher mode={mode} position={position} onChoose={setSwitchingTo} />
            )}
            {user && isAdminRole(user.role) && !hideManagement && <NotificationBell />}
            {user && hideManagement && <CustomerNotificationBell userId={user.id} />}
            <ThemeToggle />
            {/* Cart and orders are the customer view's: no management view (admin, owner, organizer) shows them. */}
            {user && hideManagement && (
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
                  <span className="nav-avatar">
                    <Avatar src={user.avatarUrl} name={fullName(user)} size={26} />
                    {isNewAccount(user.createdAt) && (
                      <span className="nav-new" role="img" aria-label="New user" data-tip="New user">
                        <SparkleIcon />
                      </span>
                    )}
                  </span>
                  {user.firstName}
                </NavLink>
                <button className="btn btn-link" onClick={() => setConfirmingLogout(true)}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <a
                  href="/login"
                  onClick={(e) => {
                    e.preventDefault();
                    openAuth('login');
                  }}
                >
                  Log in
                </a>
                <a
                  href="/register"
                  className="btn btn-cta btn-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    openAuth('register');
                  }}
                >
                  Sign up
                </a>
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
        title={switchingTo === 'customer' ? 'Switch to Customer view?' : `Switch to ${position ?? 'Management'} view?`}
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
            <Link to="/events">Events</Link>
            <Link to="/apply">Host an event</Link>
            {user ? (
              <>
                <Link to="/orders">Orders</Link>
                {!hideManagement && <Link to="/manage">Event Management</Link>}
                <Link to="/profile">Profile</Link>
              </>
            ) : (
              <>
                <a
                  href="/login"
                  onClick={(e) => {
                    e.preventDefault();
                    openAuth('login');
                  }}
                >
                  Log in
                </a>
                <a
                  href="/register"
                  onClick={(e) => {
                    e.preventDefault();
                    openAuth('register');
                  }}
                >
                  Sign up
                </a>
              </>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}
