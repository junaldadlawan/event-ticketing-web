import { Link } from 'react-router-dom';
import { eventApi, postApi, ticketTypeApi } from '../api/endpoints';
import type { Event, TicketType } from '../api/types';
import { MoonIcon, SunIcon } from '../components/DesignerIcons';
import { EventPostsFeed } from '../components/EventPostsFeed';
import { HeroWords } from '../components/HeroWords';
import { Empty, ErrorBox, Spinner } from '../components/ui';
import { formatDateTime, formatMoney } from '../utils/format';
import { useLivePosts } from '../utils/livePosts';
import { isDaytime } from '../utils/timeOfDay';
import { useAsync } from '../utils/useAsync';
import { saleState } from './EventLandingPage';
import { isEventOver } from '../utils/eventState';

interface OnSale {
  event: Event;
  live: TicketType[];
}

const cheapest = (live: TicketType[]) => live.reduce((a, b) => (b.price.amount < a.price.amount ? b : a));

/** Home: what is on sale right now, with the next event as a ticket in the banner, and the latest posts. */
export function HomePage() {
  const { data, error, loading } = useAsync(async (): Promise<OnSale[]> => {
    const page = await eventApi.search({ page: 0, size: 12, sort: 'startAt,asc' });
    const now = Date.now();
    return Promise.all(
      page.content.map(async (event) => {
        const types = await ticketTypeApi.list(event.id).catch(() => [] as TicketType[]);
        return { event, live: types.filter((tt) => saleState(tt, now, isEventOver(event, now)) === 'live') };
      }),
    );
  }, []);
  // Site-wide posts plus posts of events that are on sale or done, newest first (the API decides which).
  const postsQuery = useAsync(() => postApi.list({ page: 0, size: 20 }), []);
  // A post an admin hides, deletes or schedules disappears here on its own, without a reload.
  useLivePosts(() => postApi.list({ page: 0, size: 20 }), postsQuery.setData);
  const posts = postsQuery.data?.content ?? [];

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? 'Could not load the home page'} />;

  const onSale = data.filter((d) => d.live.length > 0);
  const next = onSale[0]; // events come soonest first

  return (
    <>
      <section className={`slab stage home-hero${next ? ' has-stub' : ''}`}>
        <div className="home-hero-copy">
          <h1>
            <HeroWords text="Tickets for every hour of the day" />
          </h1>
          <p>
            {onSale.length > 0
              ? "From the dawn run to the midnight set, see what's on sale right now."
              : 'Nothing is on sale at the moment. New events show up here as soon as tickets open.'}
          </p>
          <Link to="/events" className="btn btn-invert">
            Browse all events
          </Link>
        </div>
        {next && (
          <Link
            to={`/events/${next.event.id}`}
            className="slab-stub home-next"
            aria-label={`Get tickets for ${next.event.title}`}
          >
            <div>
              <div className="home-next-title">{next.event.title}</div>
              <div className="home-next-meta">
                {formatDateTime(next.event.startAt, next.event.timezone)}
                <br />
                {next.event.venue ? next.event.venue.name : 'Online'}
              </div>
            </div>
            <div>
              <div className="home-next-price">
                From <strong>{formatMoney(cheapest(next.live).price)}</strong>
              </div>
              <div className="home-next-go">Get tickets</div>
            </div>
          </Link>
        )}
      </section>

      <h2>On sale now</h2>
      {onSale.length === 0 ? (
        <Empty>
          Nothing on sale right now. <Link to="/events">See all events</Link>
        </Empty>
      ) : (
        <ul className="home-events">
          {onSale.map(({ event, live }) => {
            const day = isDaytime(event);
            const left = live.reduce((n, tt) => n + tt.quantityAvailable, 0);
            return (
              <li key={event.id}>
                <Link to={`/events/${event.id}`} className={`event-ticket ${day ? 'is-day' : 'is-night'}`}>
                  <span className="event-ticket-stub" title={day ? 'Daytime event' : 'Evening event'}>
                    {day ? <SunIcon /> : <MoonIcon />}
                    <span className="sr-only">{day ? 'Daytime event' : 'Evening event'}</span>
                  </span>
                  <span className="event-ticket-body">
                    <strong className="event-ticket-title">{event.title}</strong>
                    <span className="muted small">{formatDateTime(event.startAt, event.timezone)}</span>
                    <span className="muted small">{event.venue ? event.venue.name : 'Online'}</span>
                    <span className="event-ticket-types">
                      {live.map((tt) => (
                        <span key={tt.id}>
                          {tt.name} {formatMoney(tt.price)}
                        </span>
                      ))}
                    </span>
                    <span className="small muted">{left} left</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <h2>Posts</h2>
      <ErrorBox message={postsQuery.error} />
      {postsQuery.loading && !postsQuery.data ? (
        <Spinner />
      ) : posts.length === 0 ? (
        <Empty>No announcements yet.</Empty>
      ) : (
        <EventPostsFeed posts={posts} showEvent />
      )}
    </>
  );
}
