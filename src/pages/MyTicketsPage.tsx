import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { eventApi, orderApi, ticketApi, ticketTypeApi } from '../api/endpoints';
import type { Event, Ticket, TicketStatus } from '../api/types';
import { ResultsBar, useEventView } from '../components/EventCollection';
import { Empty, ErrorBox, PageHeader, Pagination, Spinner } from '../components/ui';
import { isEventOver } from '../utils/eventState';
import { dateGroupLabel, groupInRuns } from '../utils/dateGroups';
import { useAsync } from '../utils/useAsync';
import { TicketCard } from './OrderDetailPage';

/**
 * Which tickets to show: "Unused" still gets you in, "Used" was scanned at the door, "Expired" was never used and its
 * event is over. The API only knows the status (an expired ticket is still VALID), so `keep` splits VALID here.
 */
const FILTERS: { label: string; status?: TicketStatus; keep?: 'usable' | 'expired'; noun: string }[] = [
  { label: 'All', noun: 'tickets' },
  { label: 'Unused', status: 'VALID', keep: 'usable', noun: 'unused tickets' },
  { label: 'Used', status: 'USED', noun: 'used tickets' },
  { label: 'Expired', status: 'VALID', keep: 'expired', noun: 'expired tickets' },
];

// The default order, sorted here because the API can't tell an expired ticket (valid, event over) from a usable one.
const UPCOMING_FIRST = 'upcoming-first';
const PAGE_SIZE = 20;

/**
 * Ways to order the tickets. "Upcoming first" puts the tickets that still get you in first (soonest event first), then
 * the used, expired and other spent ones (latest event first); the API sorts the rest, so their paging stays right.
 * "Issued" is when the ticket was made, as on the card.
 */
const SORTS: { label: string; sort: string }[] = [
  { label: 'Upcoming first', sort: UPCOMING_FIRST },
  { label: 'Event date, soonest first', sort: 'e.startAt,asc' },
  { label: 'Event date, latest first', sort: 'e.startAt,desc' },
  { label: 'Issued, newest first', sort: 'createdAt,desc' },
  { label: 'Issued, oldest first', sort: 'createdAt,asc' },
  { label: 'Event name, A to Z', sort: 'e.title,asc' },
];

/** A ticket that still gets you in: valid, and its event isn't over. */
function isUsable(t: Ticket, ev: Event | undefined, now = Date.now()) {
  return t.status === 'VALID' && !(ev && isEventOver(ev, now));
}

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
    const upcomingFirst = sort === UPCOMING_FIRST;
    // Sorted or filtered here (see above), so all of them are loaded and paged here.
    // shortcut: the first 200 tickets only; ask the API for this order and filter if anyone ever holds more.
    const local = upcomingFirst || Boolean(filter.keep);
    const all = await ticketApi.mine({
      page: local ? 0 : page,
      size: local ? 200 : PAGE_SIZE,
      sort: upcomingFirst ? 'e.startAt,asc' : sort,
      status: filter.status,
      eventId: eventId || undefined,
    });
    const typeIds = [...new Set(all.content.map((t) => t.ticketTypeId))];
    const eventIds = [...new Set(all.content.map((t) => t.eventId))];
    const [types, events] = await Promise.all([
      Promise.all(typeIds.map((id) => ticketTypeApi.get(id))),
      Promise.all(eventIds.map((id) => eventApi.get(id))),
    ]);
    const eventsById = new Map(events.map((e) => [e.id, e]));
    let tickets = all;
    if (local) {
      const now = Date.now();
      const usable = (t: Ticket) => isUsable(t, eventsById.get(t.eventId), now);
      const kept = filter.keep ? all.content.filter((t) => usable(t) === (filter.keep === 'usable')) : all.content;
      // Already soonest first: usable ones keep that, spent ones flip to latest first.
      const ordered = upcomingFirst ? [...kept.filter(usable), ...kept.filter((t) => !usable(t)).reverse()] : kept;
      const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
      tickets = {
        ...all,
        content: ordered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
        page,
        size: PAGE_SIZE,
        totalElements: filter.keep ? ordered.length : all.totalElements,
        totalPage: pages,
        last: page >= pages - 1,
      };
    }
    return {
      tickets,
      types: new Map(types.map((t) => [t.id, t])),
      events: eventsById,
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
              <div key={view + data.tickets.content.map((t) => t.id).join()} className="ticket-groups">
                {/* Headings only when sorted by event date; "Upcoming first" puts its spent tickets under one. */}
                {groupInRuns(data.tickets.content, (t) => {
                  if (sort.startsWith('createdAt') || sort.startsWith('e.title')) return undefined;
                  const ev = data.events.get(t.eventId);
                  if (sort === UPCOMING_FIRST && !isUsable(t, ev)) return 'Used and past';
                  return ev && dateGroupLabel(ev.startAt);
                }).map((g) => (
                  <div key={g.start}>
                    {g.label && (
                      <div className="section-title">
                        <h2>{g.label}</h2>
                        <span className="count-badge" aria-label={`${g.items.length} tickets`}>
                          {g.items.length}
                        </span>
                      </div>
                    )}
                    <div className={`ticket-deal ${view === 'grid' ? 'my-tickets-grid' : 'stack'}`}>
                      {g.items.map((t, j) => (
                        <div key={t.id} className="ticket-deal-slot" style={{ '--i': g.start + j } as CSSProperties}>
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
