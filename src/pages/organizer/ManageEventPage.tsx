import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { eventApi, ticketTypeApi } from '../../api/endpoints';
import type { Event, TicketTypeKind } from '../../api/types';
import { Empty, ErrorBox, Pagination, Spinner, StatusBadge, SuccessBox } from '../../components/ui';
import { formatDateTime, formatMoney, humanize, localInputToIso } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';

export function ManageEventPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { data: event, setData: setEvent, error, loading } = useAsync(
    () => eventApi.get(eventId),
    [eventId],
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !event) return <Spinner />;
  if (error || !event) return <ErrorBox message={error ?? 'Event not found'} />;

  async function act(action: () => Promise<Event | void>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await action();
      if (updated) setEvent(updated);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const canPublish = event.status === 'DRAFT';
  const canCancel = !['CANCELLED', 'COMPLETED'].includes(event.status);

  return (
    <>
      <p>
        <Link to="/manage">← Manage events</Link>
      </p>
      <div className="row-between">
        <h1>{event.title}</h1>
        <StatusBadge status={event.status} />
      </div>
      <p className="muted small">
        {formatDateTime(event.startAt, event.timezone)} · prefix <code>{event.ticketPrefix}</code>{' '}
        · <Link to={`/events/${event.id}`}>Public page</Link>
      </p>
      <ErrorBox message={actionError} />
      <div className="actions">
        {canPublish && (
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => act(() => eventApi.publish(event.id))}
          >
            Publish
          </button>
        )}
        {canCancel && (
          <button
            className="btn danger"
            disabled={busy}
            onClick={() =>
              act(() => eventApi.cancel(event.id), 'Cancel this event? Buyers will be affected.')
            }
          >
            Cancel event
          </button>
        )}
        <button
          className="btn btn-link danger"
          disabled={busy}
          onClick={() =>
            act(async () => {
              await eventApi.remove(event.id);
              navigate('/manage');
            }, 'Delete this event?')
          }
        >
          Delete
        </button>
      </div>

      <div className="two-col">
        <EditDetails event={event} onSaved={setEvent} />
        <TicketTypes eventId={event.id} />
      </div>
      <EventOrders eventId={event.id} />
    </>
  );
}

function EditDetails({ event, onSaved }: { event: Event; onSaved: (e: Event) => void }) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [category, setCategory] = useState(event.category);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      onSaved(await eventApi.update(event.id, { title, description, category }));
      setMsg('Saved.');
    } catch (ex) {
      setErr(errorMessage(ex));
    }
  }

  return (
    <section className="card">
      <h2>Details</h2>
      <ErrorBox message={err} />
      <SuccessBox message={msg} />
      <form className="form" onSubmit={onSubmit}>
        <label>
          Title
          <input maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Category
          <input maxLength={100} value={category} onChange={(e) => setCategory(e.target.value)} />
        </label>
        <label>
          Description
          <textarea
            rows={5}
            maxLength={10000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <p className="hint">Venue, dates and timezone can't be changed after creation.</p>
        <button className="btn btn-primary">Save</button>
      </form>
    </section>
  );
}

function TicketTypes({ eventId }: { eventId: string }) {
  const { data, error, reload } = useAsync(() => ticketTypeApi.list(eventId), [eventId]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<TicketTypeKind>('GENERAL_ADMISSION');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [quantity, setQuantity] = useState('');
  const [saleStart, setSaleStart] = useState('');
  const [saleEnd, setSaleEnd] = useState('');
  const [maxPerOrder, setMaxPerOrder] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await ticketTypeApi.create(eventId, {
        name,
        kind,
        price: { amount: Math.round(Number(price) * 100), currency: currency.toUpperCase() },
        quantityTotal: Number(quantity),
        saleStartAt: localInputToIso(saleStart),
        saleEndAt: localInputToIso(saleEnd),
        maxPerOrder: maxPerOrder ? Number(maxPerOrder) : undefined,
      });
      setName('');
      setPrice('');
      setQuantity('');
      reload();
    } catch (ex) {
      setErr(errorMessage(ex));
    }
  }

  return (
    <section className="card">
      <h2>Ticket types</h2>
      <ErrorBox message={error} />
      {data && data.length === 0 && <p className="muted small">None yet.</p>}
      <ul className="plain-list">
        {data?.map((tt) => (
          <li key={tt.id} className="row-between">
            <span>
              <strong>{tt.name}</strong>{' '}
              <span className="muted small">
                {humanize(tt.kind)} · {tt.quantityAvailable}/{tt.quantityTotal} ·{' '}
                {formatDateTime(tt.saleStartAt)} → {formatDateTime(tt.saleEndAt)}
              </span>
            </span>
            <span>{formatMoney(tt.price)}</span>
          </li>
        ))}
      </ul>

      <h3>Add ticket type</h3>
      <ErrorBox message={err} />
      <form className="form" onSubmit={onSubmit}>
        <label>
          Name
          <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="two-col">
          <label>
            Kind
            <select value={kind} onChange={(e) => setKind(e.target.value as TicketTypeKind)}>
              <option value="GENERAL_ADMISSION">General admission</option>
              <option value="RESERVED_SEATING">Reserved seating</option>
            </select>
          </label>
          <label>
            Quantity
            <input
              type="number"
              required
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
        </div>
        <div className="two-col">
          <label>
            Price
            <input
              type="number"
              required
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label>
            Currency
            <input
              required
              pattern="[A-Za-z]{3}"
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </label>
        </div>
        <div className="two-col">
          <label>
            Sale starts
            <input
              type="datetime-local"
              required
              value={saleStart}
              onChange={(e) => setSaleStart(e.target.value)}
            />
          </label>
          <label>
            Sale ends
            <input
              type="datetime-local"
              required
              value={saleEnd}
              onChange={(e) => setSaleEnd(e.target.value)}
            />
          </label>
        </div>
        <label>
          Max per order <span className="hint">(default 10)</span>
          <input
            type="number"
            min={1}
            value={maxPerOrder}
            onChange={(e) => setMaxPerOrder(e.target.value)}
          />
        </label>
        <button className="btn btn-primary">Add ticket type</button>
      </form>
    </section>
  );
}

function EventOrders({ eventId }: { eventId: string }) {
  const [page, setPage] = useState(0);
  const { data, error } = useAsync(
    () => eventApi.orders(eventId, { page, size: 10, sort: 'createdAt,desc' }),
    [eventId, page],
  );

  return (
    <section>
      <h2>Orders</h2>
      <ErrorBox message={error} />
      {data && data.content.length === 0 ? (
        <Empty>No orders yet.</Empty>
      ) : (
        data && (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Placed</th>
                  <th>Tickets</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <code>{o.id.slice(0, 8)}</code>
                    </td>
                    <td>
                      <code>{o.buyerId.slice(0, 8)}</code>
                    </td>
                    <td>{formatDateTime(o.createdAt)}</td>
                    <td>{o.tickets.length}</td>
                    <td>{formatMoney(o.total)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={data} onChange={setPage} />
          </>
        )
      )}
    </section>
  );
}
