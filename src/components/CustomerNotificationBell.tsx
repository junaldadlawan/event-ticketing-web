import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../api/endpoints';
import type { AppNotification, NotificationType } from '../api/types';
import { BellIcon } from './DesignerIcons';
import { formatDateTime } from '../utils/format';

const EVERY_MS = 5 * 60_000;
const SHOWN = 10;

/** What each kind of notification says. The API sends only the kind and what it is about, not the wording. */
const TEXT: Record<NotificationType, { title: string; hint: string }> = {
  ORDER_CONFIRMATION: { title: 'Order confirmed', hint: 'Your tickets are ready.' },
  PAYMENT_RECEIPT: { title: 'Payment received', hint: 'Your receipt is on the order.' },
  EVENT_REMINDER: { title: 'Event reminder', hint: 'Your event is coming up.' },
  EVENT_CHANGE: { title: 'Event changed', hint: 'The organizer updated your event.' },
  EVENT_CANCELLATION: { title: 'Event cancelled', hint: 'An event you booked was cancelled.' },
  WAITLIST_AVAILABILITY: { title: 'Tickets available', hint: 'A spot opened up from your waitlist.' },
  REFUND_CONFIRMATION: { title: 'Refund issued', hint: 'Your refund is on its way.' },
  DISPUTE_RESOLVED: { title: 'Your report was reviewed', hint: 'We have an outcome for your problem report.' },
  ACCOUNT_MODERATION_ACTION: { title: 'Account update', hint: 'There was a change to your account.' },
};

/** Where a notification opens: the order or event it is about, else the list that holds it. */
function target(n: AppNotification): string | null {
  if (n.relatedObjectType === 'Order' && n.relatedObjectId) return `/orders/${n.relatedObjectId}`;
  if (n.relatedObjectType === 'Event' && n.relatedObjectId) return `/events/${n.relatedObjectId}`;
  if (n.type === 'REFUND_CONFIRMATION' || n.type === 'DISPUTE_RESOLVED') return '/orders';
  if (n.type === 'WAITLIST_AVAILABILITY') return '/events';
  return null;
}

const seenKey = (userId: string) => `et.notificationsSeen.${userId}`;
const readSeen = (userId: string) => {
  try {
    return localStorage.getItem(seenKey(userId)) ?? '';
  } catch {
    return '';
  }
};

/**
 * The bell in the customer's top bar: the latest notifications sent to them (GET /users/me/notifications). The API has
 * no read flag, so "new" means newer than the last time this browser opened the bell.
 */
export function CustomerNotificationBell({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => readSeen(userId));
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const all = await notificationApi.mine();
      setItems([...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, SHOWN));
    } catch {
      // not reachable right now: keep what is shown
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = items.filter((n) => n.createdAt > seen).length;

  function toggle() {
    if (!open) void load();
    // Opening the bell is what "reads" them: the dot goes away, the new ones stay marked until it is closed.
    if (open && items[0]) {
      try {
        localStorage.setItem(seenKey(userId), items[0].createdAt);
      } catch {
        // not saved: the dot comes back next visit
      }
      setSeen(items[0].createdAt);
    }
    setOpen((o) => !o);
  }

  function go(n: AppNotification) {
    const to = target(n);
    if (items[0]) {
      try {
        localStorage.setItem(seenKey(userId), items[0].createdAt);
      } catch {
        // not saved
      }
      setSeen(items[0].createdAt);
    }
    setOpen(false);
    if (to) navigate(to);
  }

  return (
    <div className="popover notification-bell" ref={root}>
      <button
        type="button"
        className="icon-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
        title="Notifications"
        onClick={toggle}
      >
        <BellIcon />
        {unread > 0 && <span className="bell-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="popover-panel bell-panel" role="menu">
          <strong className="bell-title">Notifications</strong>
          {items.length === 0 ? (
            <p className="muted small bell-empty">No notifications yet.</p>
          ) : (
            <div className="bell-list">
              {items.map((n) => {
                const text = TEXT[n.type] ?? { title: n.type, hint: '' };
                return (
                  <button
                    key={n.id}
                    type="button"
                    role="menuitem"
                    className={`bell-item${n.createdAt > seen ? ' is-unread' : ''}`}
                    onClick={() => go(n)}
                  >
                    <strong>{text.title}</strong>
                    {text.hint && <span className="muted small">{text.hint}</span>}
                    <span className="muted small">{formatDateTime(n.createdAt)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
