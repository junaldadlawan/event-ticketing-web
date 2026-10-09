import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { eventApi, postApi, ticketTypeApi } from '../api/endpoints';
import type { TicketType } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { EventImage } from '../components/EventImage';
import { EventPostsFeed } from '../components/EventPostsFeed';
import { PostComposer } from '../components/PostComposer';
import { Empty, ErrorBox, Spinner } from '../components/ui';
import { formatDateTime, formatMoney } from '../utils/format';
import { sortTicketTypes } from '../utils/ticketTypes';
import { useLivePosts } from '../utils/livePosts';
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const postsQuery = useAsync(() => postApi.list({ eventId, page: 0, size: 20 }), [eventId]);
  useLivePosts(() => postApi.list({ eventId, page: 0, size: 20 }), postsQuery.setData);
  const posts = postsQuery.data?.content ?? [];
  const [removeError, setRemoveError] = useState<string | null>(null);

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
      {isAdmin && (
        <PostComposer
          onPost={async (p) => {
            await postApi.create({ ...p, eventId });
            postsQuery.reload();
          }}
        />
      )}
      <ErrorBox message={postsQuery.error ?? removeError} />
      {postsQuery.loading && !postsQuery.data ? (
        <Spinner />
      ) : posts.length === 0 ? (
        <Empty>No announcements yet.</Empty>
      ) : (
        <EventPostsFeed
          posts={posts}
          onRemove={
            isAdmin
              ? async (id) => {
                  setRemoveError(null);
                  try {
                    await postApi.remove(id);
                    postsQuery.reload();
                  } catch (e) {
                    setRemoveError(errorMessage(e));
                  }
                }
              : undefined
          }
        />
      )}
    </article>
  );
}
