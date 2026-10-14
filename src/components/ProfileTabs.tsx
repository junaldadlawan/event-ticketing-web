import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

/** The customer's own pages: a short list on the left (Profile, Payment) and the chosen page on the right. */
export function ProfileTabs({ children }: { children: ReactNode }) {
  return (
    <div className="settings-layout profile-tabs">
      <nav className="settings-nav" aria-label="Profile">
        <NavLink to="/profile" end>
          Profile
        </NavLink>
        <NavLink to="/profile/payment">Payment</NavLink>
      </nav>
      <div className="settings-panel">{children}</div>
    </div>
  );
}
