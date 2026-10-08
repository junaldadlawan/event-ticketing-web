import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import { ThemeToggle } from '../theme/ThemeToggle';
import { BackButton } from './BackButton';
import { useUnsavedChangesApi } from './UnsavedChanges';

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

  async function handleLogout() {
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
          {user && (
            <nav className="nav" aria-label="Organizer">
              <NavLink to="/manage">Manage</NavLink>
            </nav>
          )}
          <div className="nav nav-right">
            {user && (
              <>
                <nav className="nav" aria-label="Buyer">
                  <NavLink to="/orders">Orders</NavLink>
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
                </nav>
                <span className="nav-divider" aria-hidden="true" />
              </>
            )}
            <ThemeToggle />
            {user ? (
              <>
                <NavLink to="/profile">{user.name}</NavLink>
                <button className="btn btn-link" onClick={handleLogout}>
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
                <Link to="/manage">Manage</Link>
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
