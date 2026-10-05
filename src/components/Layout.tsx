import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';

export function Layout() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="brand">
            🎟️ Ticketing
          </Link>
          <nav className="nav">
            <NavLink to="/" end>
              Events
            </NavLink>
            {user && (
              <>
                <NavLink to="/orders">My orders</NavLink>
                <NavLink to="/manage">Manage events</NavLink>
                <NavLink to="/cart">
                  Cart{itemCount > 0 && <span className="pill">{itemCount}</span>}
                </NavLink>
              </>
            )}
          </nav>
          <div className="nav nav-right">
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
                <Link to="/register" className="btn btn-primary btn-sm">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="container main">
        <Outlet />
      </main>
    </div>
  );
}
