import { useState } from 'react';
import { errorMessage } from '../api/client';
import { notificationApi } from '../api/endpoints';
import type { OptionalNotificationType } from '../api/types';
import { ProfileTabs } from '../components/ProfileTabs';
import { ErrorBox, PageHeader } from '../components/ui';
import { useAsync } from '../utils/useAsync';
import { Checkbox } from '../components/fields/Checkbox';

const NOTIFICATION_OPTIONS: { type: OptionalNotificationType; label: string; hint: string }[] = [
  { type: 'EVENT_REMINDER', label: 'Event reminders', hint: 'A day before your event' },
  { type: 'GATE_OPEN', label: 'Gates open', hint: 'When you can head in' },
  { type: 'EVENT_STARTING', label: 'Event starting', hint: 'When your event begins' },
  { type: 'REVIEW_REQUEST', label: 'Review requests', hint: 'After an event you attended' },
  { type: 'EVENT_CHANGE', label: 'Event changes', hint: 'When the date, time or venue moves' },
  { type: 'WAITLIST_AVAILABILITY', label: 'Waitlist offers', hint: 'When tickets open up for you' },
];

/** The Notifications page (next to Profile): the notifications a user may turn off. Saves on each click. */
export function NotificationsPage() {
  const prefs = useAsync(() => notificationApi.preferences(), []);
  const [busy, setBusy] = useState<OptionalNotificationType | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(type: OptionalNotificationType, on: boolean) {
    setErr(null);
    setBusy(type);
    try {
      prefs.setData(await notificationApi.updatePreferences({ [type]: on }));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ProfileTabs>
      <PageHeader title="Notifications" />
      <section className="profile-notifications" aria-label="Notifications">
        <p className="muted small">Order receipts, refunds and event cancellations are always sent.</p>
        <ErrorBox message={prefs.error ?? err} />
        {prefs.data &&
          NOTIFICATION_OPTIONS.map((o) => (
            <label key={o.type} className="check-row">
              <Checkbox
                checked={prefs.data?.preferences[o.type] ?? true}
                disabled={busy !== null}
                onChange={(e) => void toggle(o.type, e.target.checked)}
              />
              <span>
                {o.label} <span className="muted small">· {o.hint}</span>
              </span>
            </label>
          ))}
      </section>
    </ProfileTabs>
  );
}
