import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { QuantityField } from '../components/fields/QuantityField';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { assetUrl, errorMessage } from '../api/client';
import { cartApi, eventApi, ticketTypeApi, waitlistApi } from '../api/endpoints';
import type { TicketType } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useAuthDialog } from '../auth/AuthDialog';
import { isAdmin } from '../auth/roles';
import { useManagementHidden } from '../auth/ViewMode';
import { useCanManage } from '../auth/useCanManage';
import { EditIcon } from '../components/DesignerIcons';
import { useCart } from '../cart/CartContext';
import { EventRecap } from '../components/EventRecap';
import { ShareEvent } from '../components/ShareEvent';
import { Empty, ErrorBox, Spinner, StatusBadge, SuccessBox } from '../components/ui';
import { formatDateTime, formatMoney, humanize } from '../utils/format';
import { sortTicketTypes } from '../utils/ticketTypes';
import { useAsync } from '../utils/useAsync';
import { isEventOver } from '../utils/eventState';
import { shareSourceOf } from '../utils/shareSource';

let memoryVisitorId: string | null = null;

/** A random id for this browser, kept in localStorage (or in memory for the page session when storage fails). */
function visitorId(): string {
  try {
    const saved = localStorage.getItem('visitorId');
    if (saved) return saved;
  } catch {
    // storage blocked: fall back to the in-memory id
  }
  memoryVisitorId ??= crypto.randomUUID();
  try {
    localStorage.setItem('visitorId', memoryVisitorId);
  } catch {
    // keep the in-memory id
  }
  return memoryVisitorId;
}

export function EventDetailPage() {
  const { eventId = '' } = useParams();
  const { data, error, loading } = useAsync(
    () => Promise.all([eventApi.get(eventId), ticketTypeApi.list(eventId)]),
    [eventId],
  );
  // Feeds the organizer's funnel; fire-and-forget, never shown.
  useEffect(() => {
    // Inside the chain so a storage or crypto failure is swallowed too.
    if (eventId) Promise.resolve().then(() => eventApi.recordView(eventId, visitorId())).catch(() => {});
  }, [eventId]);
  // Owners/organizers of the event's organization (and admins) get a shortcut to edit it.
  const managementHidden = useManagementHidden(); // a host browsing as a customer
  const canManage = useCanManage(data?.[0].organizationId) && !managementHidden;

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? 'Event not found'} />;
  const [event, ticketTypes] = data;
  const over = isEventOver(event);
  const cover = assetUrl(event.images?.find((u) => u && u.trim()));
  const sorted = sortTicketTypes(ticketTypes);
  const lowest = ticketTypes.length ? ticketTypes.reduce((m, t) => (t.price.amount < m.price.amount ? t : m)).price : null;
  const gates =
    event.gateOpensMinutesBefore != null
      ? formatDateTime(new Date(Date.parse(event.startAt) - event.gateOpensMinutesBefore * 60_000).toISOString(), event.timezone)
      : null;

  return (
    <article className="event-page">
      <header className="event-head">
        <h1>{event.title}</h1>
        <div className="event-head-row">
          <p className="event-sub">
            {event.category}
            <span aria-hidden="true"> · </span>
            {event.venue ? event.venue.name : 'Online'}
            <StatusBadge status={over ? 'COMPLETED' : event.status} />
          </p>
          <div className="event-head-actions">
            {!over && ['PUBLISHED', 'ON_SALE', 'SOLD_OUT'].includes(event.status) && <ShareEvent event={event} />}
            {canManage && (
              <Link to={`/manage/events/${event.id}`} className="btn" title="Edit details, tickets and ticket design">
                <EditIcon />
                Manage
              </Link>
            )}
          </div>
        </div>
      </header>

      {cover ? (
        <img className="event-hero" src={cover} alt={`Picture for ${event.title}`} />
      ) : (
        <div className="event-hero event-hero-empty" aria-hidden="true">
          {event.category}
        </div>
      )}

      <div className="event-cols">
        <div className="event-main">
          <ul className="event-facts">
            <li>
              <FactIcon>
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </FactIcon>
              <div>
                <strong>{formatDateTime(event.startAt, event.timezone)}</strong>
                <span>Ends {formatDateTime(event.endAt, event.timezone)}</span>
              </div>
            </li>
            {gates && (
              <li>
                <FactIcon>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </FactIcon>
                <div>
                  <strong>Gates open {gates}</strong>
                  <span>Arrive a little early to get in without a rush</span>
                </div>
              </li>
            )}
            <li>
              <FactIcon>
                <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
                <circle cx="12" cy="9" r="2.5" />
              </FactIcon>
              <div>
                <strong>{event.venue ? event.venue.name : 'Online'}</strong>
                <span>{event.venue ? event.venue.address : 'Join from anywhere'}</span>
              </div>
            </li>
          </ul>

          {event.description && (
            <section className="event-about">
              <h2>About this event</h2>
              <p className="description">{event.description}</p>
            </section>
          )}

          <Link to={`/events/${event.id}/updates`} className="event-posts-link">
            Posts
          </Link>

          {over && <EventRecap event={event} />}
        </div>

        {!over && (
          <aside className="booking-card" aria-label="Tickets">
            <div className="booking-head">
              {lowest ? (
                <p>
                  <span className="muted">From</span> <strong>{formatMoney(lowest)}</strong>
                </p>
              ) : (
                <p>
                  <strong>Tickets</strong>
                </p>
              )}
            </div>
            {sorted.length === 0 ? (
              <Empty>No tickets available yet.</Empty>
            ) : (
              <div className="booking-options">
                {sorted.map((tt) => (
                  <TicketTypeRow key={tt.id} ticketType={tt} eventOver={over} />
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </article>
  );
}

/** A small line icon for the key facts (the paths are drawn by the caller). */
function FactIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="fact-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function TicketTypeRow({ ticketType: tt, eventOver }: { ticketType: TicketType; eventOver: boolean }) {
  const { user } = useAuth();
  const { addItem } = useCart();
  const { openAuth } = useAuthDialog();
  const navigate = useNavigate();
  const location = useLocation();
  // The quantity a Buy now was for, kept on this page's history entry so cancelling the payment comes back to it.
  const qtyKey = `qty.${tt.id}`;
  // An admin in the admin view manages the platform and does not buy tickets; the customer view can.
  const customerView = useManagementHidden();
  const adminView = isAdmin(user?.role) && !customerView;
  const [buying, setBuying] = useState(false);
  // What is typed in the quantity box (it can be blank or out of range while typing); qty is the number used.
  const [qtyText, setQtyText] = useState(() => String((location.state as Record<string, number> | null)?.[qtyKey] ?? 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  // Sold out: the buyer can join the line instead (the API puts them in order).
  const [waitPosition, setWaitPosition] = useState<number | null>(null);

  const now = Date.now();
  const notStarted = new Date(tt.saleStartAt).getTime() > now;
  const ended = eventOver || new Date(tt.saleEndAt).getTime() < now;
  const soldOut = tt.quantityAvailable <= 0;
  const reserved = tt.kind === 'RESERVED_SEATING';
  const max = Math.min(tt.maxPerOrder, tt.quantityAvailable);
  // From 1 up to what one order may hold and what is left.
  const limit = Math.max(1, max);
  const qty = Math.min(limit, Math.max(1, Math.floor(Number(qtyText)) || 1));
  const paused = tt.salesPaused;
  const disabled = notStarted || ended || soldOut || reserved || paused;

  let note: string | null = null;
  if (eventOver) note = 'This event has ended';
  else if (paused) note = 'Sales are paused for now';
  else if (soldOut) note = 'Sold out. Join the waitlist and we will tell you if tickets come back.';
  else if (notStarted) note = `On sale ${formatDateTime(tt.saleStartAt)}`;
  else if (ended) note = 'Sales ended';
  else if (reserved) note = 'Seat selection not supported in this app yet';

  async function onJoinWaitlist() {
    if (!user) {
      openAuth('login', `/events/${tt.eventId}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const entry = await waitlistApi.join(tt.eventId, tt.id);
      setWaitPosition(entry.position);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // "Add to cart" keeps the buyer here; "Buy now" pays for exactly the chosen quantity in a cart of its own, so the
  // buyer's cart is left as it was.
  async function onAdd(buyNow = false) {
    if (!user) {
      openAuth('login', `/events/${tt.eventId}`);
      return;
    }
    // Someone who came through a shared link or QR code and now buys is counted for that source.
    const source = buyNow ? shareSourceOf(tt.eventId) : null;
    if (source) void eventApi.recordShareBuyClick(tt.eventId, source).catch(() => {});
    setBusy(true);
    setBuying(buyNow);
    setError(null);
    try {
      if (buyNow) {
        const direct = await cartApi.addItem((await cartApi.create()).id, tt.id, qty);
        navigate(location.pathname, { replace: true, state: { ...(location.state as object | null), [qtyKey]: qty } });
        navigate('/cart', { state: { buyNow: direct } });
      } else {
        await addItem(tt.id, qty);
        setAdded(true);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setBuying(false);
    }
  }

  return (
    <div className="ticket-option">
      <div className="ticket-option-top">
        <div>
          <h3>{tt.name}</h3>
          <p className="muted small">
            {humanize(tt.kind)} · {tt.quantityAvailable} of {tt.quantityTotal} left · max {tt.maxPerOrder} per order
            {tt.maxPerUser != null && <> · max {tt.maxPerUser} per buyer</>}
          </p>
        </div>
        <strong className="price">{formatMoney(tt.price)}</strong>
      </div>
      {note && <p className="small warn">{note}</p>}
      <ErrorBox message={error} />
      {added && (
        <SuccessBox
          message={
            <>
              Added to cart. <Link to="/cart">View cart →</Link>
            </>
          }
        />
      )}
      {adminView ? (
        <span className="muted small">Admins can't buy tickets. Switch to Customer view to buy.</span>
      ) : (
        <div className="ticket-option-buy">
          <QuantityField
            value={qty}
            max={limit}
            disabled={disabled}
            onCommit={(n) => setQtyText(String(n))}
            lessLabel="One ticket fewer"
            moreLabel="One more ticket"
          />
          {soldOut && !paused && !ended && !notStarted ? (
            <button className="btn btn-cta ticket-cta" disabled={busy || waitPosition !== null} onClick={onJoinWaitlist}>
              {waitPosition !== null ? `On the waitlist (#${waitPosition})` : busy ? 'Joining...' : 'Join waitlist'}
            </button>
          ) : (
            <>
              <button className="btn ticket-cta" disabled={disabled || busy} onClick={() => void onAdd()}>
                {busy && !buying ? 'Adding...' : 'Add to cart'}
              </button>
              <button className="btn btn-cta ticket-cta" disabled={disabled || busy} onClick={() => void onAdd(true)}>
                {buying ? 'Opening...' : 'Buy now'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
