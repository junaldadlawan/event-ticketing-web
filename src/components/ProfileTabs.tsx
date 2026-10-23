import type { ReactNode } from 'react';
import { useInManagementView } from '../auth/ViewMode';
import { SettingsLayout } from './SettingsLayout';

/** The customer's own pages: a short list on the left (Profile, Orders, Payment) and the chosen page on the right. */
export function ProfileTabs({ children }: { children: ReactNode }) {
  // Orders and the cards a buyer pays with belong to the customer view.
  const managing = useInManagementView();
  return (
    <SettingsLayout
      label="Profile"
      className="profile-tabs"
      links={[
        { to: '/profile', label: 'Profile', end: true },
        ...(managing
          ? []
          : [
              { to: '/orders', label: 'Orders', end: true },
              { to: '/profile/payment', label: 'Payment' },
            ]),
        { to: '/profile/notifications', label: 'Notifications' },
      ]}
    >
      {children}
    </SettingsLayout>
  );
}
