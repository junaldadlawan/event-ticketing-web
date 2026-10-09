import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { eventApi, ticketTypeApi, waitlistApi } from '../api/endpoints';
import type { TicketType } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useManagementHidden } from '../auth/ViewMode';
import { useCanManage } from '../auth/useCanManage';
import { EditIcon } from '../components/DesignerIcons';
import { useCart } from '../cart/CartContext';
import { EventImage } from '../components/EventImage';
import { Empty, ErrorBox, Spinner, StatusBadge, SuccessBox } from '../components/ui';
import { formatDateTime, formatMoney, humanize } from '../utils/format';
import { sortTicketTypes } from '../utils/ticketTypes';
import { useAsync } from '../utils/useAsync';

export function EventDetailPage() {
  const { eventId = '' } = useParams();
  const { data, error, loading } = useAsync(
    () => Promise.all([eventApi.get(eventId), ticketTypeApi.list(eventId)]),
    [eventId],
  );
  // Owners/organizers of the event's organization (and admins) get a shortcut to edit it.
  const managementHidden = useManagementHidden(); // a host browsing as a customer
  const canManage = useCanManage(data?.[0].organizationId) && !managementHidden;

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? 'Event not found'} />;
  const [event, ticketTypes] = data;

  return (
    <article className="event-detail">
      <EventImage event={event} size="lg" className="event-banner" />
      <div className="row-between">
        <span className="eyebrow">{event.category}</span>
        <StatusBadge status={event.status} />
      </div>
      <div className="row-between page-header event-title-row">
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
        <Link to={`/events/${event.id}/updates`}>Posts</Link>
      </p>

      <h2>Tickets</h2>
      {ticketTypes.length === 0 ? (
        <Empty>No tickets available yet.</Empty>
      ) : (
        <div className="stack">
          {sortTicketTypes(ticketTypes).map((tt) => (
            <TicketTypeRow key={tt.id} ticketType={tt} />
          ))}
        </div>
      )}
    </article>
  );
}

function TicketTypeRow({ ticketType: tt }: { ticketType: TicketType }) {
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  // Sold out: the buyer can join the line instead (the API puts them in order).
  const [waitPosition, setWaitPosition] = useState<number | null>(null);

  const now = Date.now();
  const notStarted = new Date(tt.saleStartAt).getTime() > now;
  const ended = new Date(tt.saleEndAt).getTime() < now;
  const soldOut = tt.quantityAvailable <= 0;
  const reserved = tt.kind === 'RESERVED_SEATING';
  const max = Math.min(tt.maxPerOrder, tt.quantityAvailable);
  const paused = tt.salesPaused;
  const disabled = notStarted || ended || soldOut || reserved || paused;

  let note: string | null = null;
  if (paused) note = 'Sales are paused for now';
  else if (soldOut) note = 'Sold out. Join the waitlist and we will tell you if tickets come back.';
  else if (notStarted) note = `On sale ${formatDateTime(tt.saleStartAt)}`;
  else if (ended) note = 'Sales ended';
  else if (reserved) note = 'Seat selection not supported in this app yet';

  async function onJoinWaitlist() {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
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

  async function onAdd() {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addItem(tt.id, qty);
      setAdded(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card ticket-row">
      <div>
        <h3>{tt.name}</h3>
        <p className="muted small">
          {humanize(tt.kind)} · {tt.quantityAvailable} of {tt.quantityTotal} left · max{' '}
          {tt.maxPerOrder} per order
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
        <select
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          disabled={disabled}
          aria-label="Quantity"
        >
          {Array.from({ length: Math.max(1, max) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {soldOut && !paused && !ended && !notStarted ? (
          <button className="btn btn-primary" disabled={busy || waitPosition !== null} onClick={onJoinWaitlist}>
            {waitPosition !== null ? `On the waitlist (#${waitPosition})` : busy ? 'Joining...' : 'Join waitlist'}
          </button>
        ) : (
          <button className="btn btn-primary" disabled={disabled || busy} onClick={onAdd}>
            {busy ? 'Adding...' : 'Add to cart'}
          </button>
        )}
      </div>
    </div>
  );
}
