import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { eventApi, ticketTypeApi } from '../api/endpoints';
import type { TicketType } from '../api/types';
import { EventImage } from '../components/EventImage';
import { EventPostsFeed } from '../components/EventPostsFeed';
import { Empty, ErrorBox, Spinner } from '../components/ui';
import { formatDateTime, formatMoney } from '../utils/format';
import { loadPosts } from '../utils/eventPosts';
import { sortTicketTypes } from '../utils/ticketTypes';
import { useAsync } from '../utils/useAsync';

type SaleState = 'live' | 'soon' | 'soldout' | 'paused' | 'ended';

export function saleState(tt: TicketType, now: number): SaleState {
  if (tt.salesPaused) return 'paused';
  if (tt.quantityAvailable <= 0) return 'soldout';
  if (new Date(tt.saleStartAt).getTime() > now) return 'soon';
  if (new Date(tt.saleEndAt).getTime() < now) return 'ended';
  return 'live';
}

export function saleNote(tt: TicketType, state: SaleState): string {
  switch (state) {
    case 'live':
      return `${tt.quantityAvailable} left · ends ${formatDateTime(tt.saleEndAt)}`;
    case 'soon':
      return `On sale ${formatDateTime(tt.saleStartAt)}`;
    case 'soldout':
      return 'Sold out';
    case 'paused':
      return 'Sales paused for now';
    default:
      return 'Sales ended';
  }
}

/** Public landing page of an event: what is on sale right now, plus the organizer's posts and announcements. */
export function EventLandingPage() {
  const { eventId = '' } = useParams();
  const { data, error, loading } = useAsync(
    () => Promise.all([eventApi.get(eventId), ticketTypeApi.list(eventId)]),
    [eventId],
  );
  const [posts] = useState(() => loadPosts(eventId));

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? 'Event not found'} />;
  const [event, ticketTypes] = data;
  const now = Date.now();
  const sorted = sortTicketTypes(ticketTypes);
  const liveCount = sorted.filter((tt) => saleState(tt, now) === 'live').length;

  return (
    <article className="event-landing">
      <EventImage event={event} size="lg" className="event-banner" />
      <span className="eyebrow">{event.category}</span>
      <h1>{event.title}</h1>
      <p className="landing-when">{formatDateTime(event.startAt, event.timezone)}</p>
      <div className="actions">
        <Link to={`/events/${event.id}`} className="btn btn-primary">
          {liveCount > 0 ? 'Get tickets' : 'Event details'}
        </Link>
      </div>

      <h2>Tickets &amp; sales</h2>
      {sorted.length === 0 ? (
        <Empty>No tickets announced yet.</Empty>
      ) : (
        <ul className="landing-sales">
          {sorted.map((tt) => {
            const state = saleState(tt, now);
            return (
              <li key={tt.id} className={`landing-sale sale-${state}`}>
                <div>
                  <strong>{tt.name}</strong>
                  <span className="landing-sale-note">{saleNote(tt, state)}</span>
                </div>
                <span className="landing-sale-price">{formatMoney(tt.price)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <h2>Announcements</h2>
      {posts.length === 0 ? <Empty>No announcements yet.</Empty> : <EventPostsFeed posts={posts} />}
    </article>
  );
}
