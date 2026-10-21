import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { eventApi, orderApi, ticketApi, ticketTypeApi } from '../api/endpoints';
import type { TicketStatus } from '../api/types';
import { ResultsBar, useEventView } from '../components/EventCollection';
import { Empty, ErrorBox, PageHeader, Pagination, Spinner } from '../components/ui';
import { useAsync } from '../utils/useAsync';
import { TicketCard } from './OrderDetailPage';

/** Which tickets to show: "Unused" is a ticket still valid for entry, "Used" one already scanned at the door. */
const FILTERS: { label: string; status?: TicketStatus; noun: string }[] = [
  { label: 'All', noun: 'tickets' },
  { label: 'Unused', status: 'VALID', noun: 'unused tickets' },
  { label: 'Used', status: 'USED', noun: 'used tickets' },
];

/** Ways to order the tickets (the API sorts, so paging stays right). "Issued" is when the ticket was made, as on the card. */
const SORTS: { label: string; sort: string }[] = [
  { label: 'Event date, soonest first', sort: 'e.startAt,asc' },
  { label: 'Event date, latest first', sort: 'e.startAt,desc' },
  { label: 'Issued, newest first', sort: 'createdAt,desc' },
  { label: 'Issued, oldest first', sort: 'createdAt,asc' },
  { label: 'Event name, A to Z', sort: 'e.title,asc' },
];

/**
 * Every ticket the user holds now, whatever order it came from (bought, or transferred to them), as the same ticket
 * cards as on an order page, in a list or a grid.
 */
export function MyTicketsPage() {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState(FILTERS[0]);
  const [eventId, setEventId] = useState('');
  const [sort, setSort] = useState(SORTS[0].sort);
  const [view, setView] = useEventView('et.ticketsView');
  // The events the user holds tickets for, for the event filter.
  const events = useAsync(() => ticketApi.myEvents(), []);
  // The user's own orders: only the buyer may open an order, so only those tickets get the purchase-details icon.
  // shortcut: the first 100 orders only; page through them if someone ever holds tickets from more.
  const myOrders = useAsync(
    () => orderApi.mine({ size: 100 }).then((p) => new Set(p.content.map((o) => o.id))),
    [],
  );

  const { data, error, loading, reload } = useAsync(async () => {
    const tickets = await ticketApi.mine({ page, size: 20, sort, status: filter.status, eventId: eventId || undefined });
    const typeIds = [...new Set(tickets.content.map((t) => t.ticketTypeId))];
    const eventIds = [...new Set(tickets.content.map((t) => t.eventId))];
    const [types, events] = await Promise.all([
      Promise.all(typeIds.map((id) => ticketTypeApi.get(id))),
      Promise.all(eventIds.map((id) => eventApi.get(id))),
    ]);
    return {
      tickets,
      types: new Map(types.map((t) => [t.id, t])),
      events: new Map(events.map((e) => [e.id, e])),
    };
  }, [page, filter, eventId, sort]);

  return (
    <>
      <PageHeader title="My tickets" />
      <div className="ticket-filters">
        <div className="segmented ticket-filter" role="group" aria-label="Show tickets">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {events.data && events.data.length > 0 && (
          <select
            className="select-auto"
            aria-label="Event"
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All events</option>
            {events.data.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({ev.ticketCount})
              </option>
            ))}
          </select>
        )}
        <select
          className="select-auto"
          aria-label="Sort"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(0);
          }}
        >
          {SORTS.map((s) => (
            <option key={s.sort} value={s.sort}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <ErrorBox message={error} />
      {loading && !data ? (
        <Spinner />
      ) : data && data.tickets.content.length === 0 ? (
        <Empty>
          No {filter.noun} {eventId ? 'for this event' : 'yet'}. <Link to="/events">Find an event</Link>
        </Empty>
      ) : (
        data && (
          <>
            <ResultsBar count={data.tickets.totalElements} noun="ticket" view={view} onViewChange={setView} />
            <section className="tickets-panel" aria-label="My tickets">
              {/* Keyed on the view and the order, so each new arrangement deals the cards out again. */}
              <div
                key={view + data.tickets.content.map((t) => t.id).join()}
                className={`ticket-deal ${view === 'grid' ? 'my-tickets-grid' : 'stack'}`}
              >
                {data.tickets.content.map((t, i) => (
                  <div key={t.id} className="ticket-deal-slot" style={{ '--i': i } as CSSProperties}>
                    <TicketCard
                      ticket={t}
                      ticketType={data.types.get(t.ticketTypeId)}
                      event={data.events.get(t.eventId)}
                      layout={view === 'grid' ? 'pass' : 'list'}
                      showOrderLink={myOrders.data?.has(t.orderId) ?? false}
                      onChanged={() => {
                        reload();
                        events.reload(); // a transfer can take the last ticket of an event
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
            <Pagination page={data.tickets} onChange={setPage} />
          </>
        )
      )}
    </>
  );
}
