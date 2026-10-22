import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useInManagementView } from '../auth/ViewMode';

/** The customer's own pages: a short list on the left (Profile, Orders, Payment) and the chosen page on the right. */
export function ProfileTabs({ children }: { children: ReactNode }) {
  // Orders and the cards a buyer pays with belong to the customer view.
  const managing = useInManagementView();
  return (
    <div className="settings-layout profile-tabs">
      <nav className="settings-nav" aria-label="Profile">
        <NavLink to="/profile" end>
          Profile
        </NavLink>
        {!managing && (
          <>
            <NavLink to="/orders" end>
              Orders
            </NavLink>
            <NavLink to="/profile/payment">Payment</NavLink>
          </>
        )}
        <NavLink to="/profile/notifications">Notifications</NavLink>
      </nav>
      <div className="settings-panel">{children}</div>
    </div>
  );
}
