import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { eventApi, orderApi, ticketApi, ticketTypeApi } from '../api/endpoints';
import type { Event, Ticket, TicketType } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ErrorBox, Spinner, StatusBadge, SuccessBox } from '../components/ui';
import { formatDateTime, formatMoney } from '../utils/format';
import { useAsync } from '../utils/useAsync';

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const location = useLocation();
  const justPurchased = (location.state as { justPurchased?: boolean } | null)?.justPurchased;

  const { data, error, loading, reload } = useAsync(async () => {
    const order = await orderApi.get(orderId);
    const typeIds = [...new Set(order.tickets.map((t) => t.ticketTypeId))];
    const eventIds = [...new Set(order.tickets.map((t) => t.eventId))];
    const [types, events] = await Promise.all([
      Promise.all(typeIds.map((id) => ticketTypeApi.get(id))),
      Promise.all(eventIds.map((id) => eventApi.get(id))),
    ]);
    return {
      order,
      types: new Map(types.map((t) => [t.id, t])),
      events: new Map(events.map((e) => [e.id, e])),
    };
  }, [orderId]);

  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? 'Order not found'} />;
  const { order, types, events } = data;

  return (
    <>
      <p>
        <Link to="/orders">← My orders</Link>
      </p>
      {justPurchased && <SuccessBox message="Payment successful — your tickets are below." />}
      <div className="row-between">
        <h1>
          Order <code>{order.id.slice(0, 8)}</code>
        </h1>
        <StatusBadge status={order.status} />
      </div>
      <dl className="meta">
        <div>
          <dt>Placed</dt>
          <dd>{formatDateTime(order.createdAt)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatMoney(order.total)}</dd>
        </div>
        {order.promoCode && (
          <div>
            <dt>Promo</dt>
            <dd>
              <code>{order.promoCode}</code>
            </dd>
          </div>
        )}
      </dl>

      <h2>Tickets</h2>
      <div className="stack">
        {order.tickets.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            ticketType={types.get(t.ticketTypeId)}
            event={events.get(t.eventId)}
            onChanged={reload}
          />
        ))}
      </div>
    </>
  );
}

function TicketCard({
  ticket,
  ticketType,
  event,
  onChanged,
}: {
  ticket: Ticket;
  ticketType?: TicketType;
  event?: Event;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [toUserId, setToUserId] = useState('');
  const ownedByMe = user?.id === ticket.ownerId;
  const usable = ticket.status === 'VALID' && ownedByMe;

  async function openArtifact(format: 'digital' | 'physical') {
    setBusy(true);
    setError(null);
    try {
      const blob = await ticketApi.artifact(ticket.id, format);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onTransfer(e: FormEvent) {
    e.preventDefault();
    if (!confirm('Transfer this ticket? You will no longer own it.')) return;
    setBusy(true);
    setError(null);
    try {
      await ticketApi.transfer(ticket.id, toUserId.trim());
      setNotice('Ticket transferred.');
      setShowTransfer(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card ticket-card">
      <div className="row-between">
        <div>
          <h3>{ticketType?.name ?? 'Ticket'}</h3>
          <p className="muted small">
            {event ? (
              <>
                <Link to={`/events/${event.id}`}>{event.title}</Link> ·{' '}
                {formatDateTime(event.startAt, event.timezone)}
              </>
            ) : (
              ticket.eventId
            )}
          </p>
          <p className="small">
            <code>{ticket.ticketNumber}</code>
            {!ownedByMe && <span className="muted"> · no longer owned by you</span>}
          </p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>
      <ErrorBox message={error} />
      <SuccessBox message={notice} />
      {usable && (
        <div className="actions">
          <button className="btn" disabled={busy} onClick={() => openArtifact('digital')}>
            View ticket
          </button>
          <button className="btn" disabled={busy} onClick={() => openArtifact('physical')}>
            Printable
          </button>
          <button className="btn btn-link" onClick={() => setShowTransfer((s) => !s)}>
            Transfer…
          </button>
        </div>
      )}
      {showTransfer && (
        <form className="inline-form" onSubmit={onTransfer}>
          <input
            required
            placeholder="Recipient user ID (UUID)"
            pattern="[0-9a-fA-F-]{36}"
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
          />
          <button className="btn btn-primary" disabled={busy}>
            Transfer
          </button>
        </form>
      )}
    </div>
  );
}
