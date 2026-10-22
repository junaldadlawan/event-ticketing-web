import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from './DesignerIcons';
import { formatMoney } from '../utils/format';
import { useGatewayFeeAlert } from '../utils/useGatewayFeeAlert';

const READ_KEY = 'et.feeAlertRead';
const readId = () => {
  try {
    return localStorage.getItem(READ_KEY);
  } catch {
    return null;
  }
};

/**
 * The bell in the top bar (admins). For now it carries one kind of notification: the gateway fee the last payment really
 * paid differs from the fee that is set. Clicking it opens Settings > Finance & Payouts with the gateway fee flagged.
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const { alert } = useGatewayFeeAlert(true);
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string | null>(readId);
  const root = useRef<HTMLDivElement>(null);

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

  const unread = alert && read !== alert.paymentId ? 1 : 0;

  function markRead() {
    if (!alert) return;
    try {
      localStorage.setItem(READ_KEY, alert.paymentId);
    } catch {
      // not saved: the dot comes back next visit
    }
    setRead(alert.paymentId);
  }

  function openIssue() {
    markRead();
    setOpen(false);
    navigate('/admin/settings/finance', { state: { highlight: 'gateway-fee' } });
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
        onClick={() => {
          if (!open) markRead(); // opening the bell reads it
          setOpen((o) => !o);
        }}
      >
        <BellIcon />
        {unread > 0 && <span className="bell-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="popover-panel bell-panel" role="menu">
          <strong className="bell-title">Notifications</strong>
          {alert ? (
            <button type="button" role="menuitem" className={`bell-item${unread ? ' is-unread' : ''}`} onClick={openIssue}>
              <strong>Gateway fee differs from the last payment</strong>
              <span className="muted small">
                The gateway charged {formatMoney(alert.charged)}; your setting would charge {formatMoney(alert.expected)}.
              </span>
              <span className="small bell-link">Review the gateway fee</span>
            </button>
          ) : (
            <p className="muted small bell-empty">No notifications.</p>
          )}
        </div>
      )}
    </div>
  );
}
