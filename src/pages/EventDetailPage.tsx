import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { cartApi, eventApi, ticketTypeApi, waitlistApi } from '../api/endpoints';
import type { TicketType } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useAuthDialog } from '../auth/AuthDialog';
import { isAdmin } from '../auth/roles';
import { useManagementHidden } from '../auth/ViewMode';
import { useCanManage } from '../auth/useCanManage';
import { EditIcon, MoonIcon, SunIcon } from '../components/DesignerIcons';
import { useCart } from '../cart/CartContext';
import { EventCover } from '../components/EventSky';
import { EventRecap } from '../components/EventRecap';
import { Empty, ErrorBox, Spinner, StatusBadge, SuccessBox } from '../components/ui';
import { formatDateTime, formatMoney, humanize } from '../utils/format';
import { isDaytime } from '../utils/timeOfDay';
import { sortTicketTypes } from '../utils/ticketTypes';
import { useAsync } from '../utils/useAsync';
import { isEventOver } from '../utils/eventState';

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
  const day = isDaytime(event);
  const over = isEventOver(event);
  // Category and status, then the big title (with the Manage shortcut): over the sky, or under a picture.
  const titleBlock = (
    <>
      <div className="row-between">
        <span className="eyebrow">{event.category}</span>
        <StatusBadge status={over ? 'COMPLETED' : event.status} />
      </div>
      <div className="row-between event-title-row">
        <h1>{event.title}</h1>
        {canManage && (
          <Link
            to={`/manage/events/${event.id}`}
            className="btn"
            title="Edit details, tickets and ticket design"
          >
            <EditIcon />
            Manage
          </Link>
        )}
      </div>
    </>
  );

  return (
    <article className="event-detail">
      <EventCover event={event}>
        {titleBlock}
      </EventCover>
      <dl className="meta">
        <div>
          <dt>Starts</dt>
          <dd>{formatDateTime(event.startAt, event.timezone)}</dd>
        </div>
        <div>
          <dt>Ends</dt>
          <dd>{formatDateTime(event.endAt, event.timezone)}</dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>{event.venue ? `${event.venue.name}, ${event.venue.address}` : 'Online'}</dd>
        </div>
      </dl>
      <p className="description">{event.description}</p>

      <p>
        <Link to={`/events/${event.id}/updates`} className="event-posts-link">
          Posts
        </Link>
      </p>

      {over ? (
        // A finished event has nothing left to buy: its rating, reviews and the organizer's recap instead.
        <EventRecap event={event} />
      ) : (
        <h2>Tickets</h2>
      )}
      {over ? null : ticketTypes.length === 0 ? (
        <Empty>No tickets available yet.</Empty>
      ) : (
        <div className="stack">
          {sortTicketTypes(ticketTypes).map((tt) => (
            <TicketTypeRow key={tt.id} ticketType={tt} day={day} eventOver={over} />
          ))}
        </div>
      )}
    </article>
  );
}

function TicketTypeRow({ ticketType: tt, day, eventOver }: { ticketType: TicketType; day: boolean; eventOver: boolean }) {
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
    <div className="card ticket-row cart-ticket">
      <span className={`cart-stub ${day ? 'is-day' : 'is-night'}`} aria-hidden="true">
        {day ? <SunIcon /> : <MoonIcon />}
      </span>
      <div>
        <h3>{tt.name}</h3>
        <p className="muted small">
          {humanize(tt.kind)} · {tt.quantityAvailable} of {tt.quantityTotal} left · max{' '}
          {tt.maxPerOrder} per order
          {tt.maxPerUser != null && <> · max {tt.maxPerUser} per buyer</>}
          {tt.gateOpensMinutesBefore != null && (
            <>
              {' '}· gates open{' '}
              {tt.gateOpensMinutesBefore % 60 === 0
                ? `${tt.gateOpensMinutesBefore / 60} h`
                : `${tt.gateOpensMinutesBefore} min`}{' '}
              before start
            </>
          )}
        </p>
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
      </div>
      <div className="ticket-buy">
        <strong className="price">{formatMoney(tt.price)}</strong>
        {!adminView && (
        <span className="qty-stepper" role="group" aria-label="Quantity">
          <button
            type="button"
            className="btn btn-sm"
            aria-label="One ticket fewer"
            disabled={disabled || qty <= 1}
            onClick={() => setQtyText(String(qty - 1))}
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            className="qty-input"
            aria-label="Number of tickets"
            min={1}
            max={limit}
            disabled={disabled}
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value)}
            // Typed past the limit, or left blank: show the number that will be used.
            onBlur={() => setQtyText(String(qty))}
          />
          <button
            type="button"
            className="btn btn-sm"
            aria-label="One more ticket"
            disabled={disabled || qty >= limit}
            onClick={() => setQtyText(String(qty + 1))}
          >
            +
          </button>
        </span>
        )}
        {adminView ? (
          <span className="muted small">Admins can't buy tickets. Switch to Customer view to buy.</span>
        ) : (
          <>
          {soldOut && !paused && !ended && !notStarted ? (
            <button className="btn signup-submit ticket-cta" disabled={busy || waitPosition !== null} onClick={onJoinWaitlist}>
              {waitPosition !== null ? `On the waitlist (#${waitPosition})` : busy ? 'Joining...' : 'Join waitlist'}
            </button>
          ) : (
            <>
              <button className="btn ticket-cta" disabled={disabled || busy} onClick={() => void onAdd()}>
                {busy && !buying ? 'Adding...' : 'Add to cart'}
              </button>
              <button className="btn signup-submit ticket-cta" disabled={disabled || busy} onClick={() => void onAdd(true)}>
                {buying ? 'Opening...' : 'Buy now'}
              </button>
            </>
          )}
          </>
        )}
      </div>
    </div>
  );
}
