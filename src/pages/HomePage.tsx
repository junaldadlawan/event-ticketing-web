import { Link } from 'react-router-dom';
import { eventApi, postApi, ticketTypeApi } from '../api/endpoints';
import type { Event, TicketType } from '../api/types';
import { EventPostsFeed } from '../components/EventPostsFeed';
import { Empty, ErrorBox, Spinner } from '../components/ui';
import { formatMoney } from '../utils/format';
import { useLivePosts } from '../utils/livePosts';
import { useAsync } from '../utils/useAsync';
import { saleNote, saleState } from './EventLandingPage';

interface OnSale {
  event: Event;
  live: TicketType[];
}

/** Home: what is on sale right now and the latest posts. Admins write posts in the Posts tab. */
export function HomePage() {
  const { data, error, loading } = useAsync(async (): Promise<OnSale[]> => {
    const page = await eventApi.search({ page: 0, size: 12, sort: 'startAt,asc' });
    const now = Date.now();
    return Promise.all(
      page.content.map(async (event) => {
        const types = await ticketTypeApi.list(event.id).catch(() => [] as TicketType[]);
        return { event, live: types.filter((tt) => saleState(tt, now) === 'live') };
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

  return (
    <>
      <h1>Home</h1>

      <h2>On sale now</h2>
      {onSale.length === 0 ? (
        <Empty>Nothing on sale right now.</Empty>
      ) : (
        <ul className="landing-sales">
          {onSale.flatMap(({ event, live }) =>
            live.map((tt) => (
              <li key={tt.id} className="landing-sale sale-live">
                <div>
                  <Link to={`/events/${event.id}`}>
                    <strong>{event.title}</strong>
                  </Link>{' '}
                  · {tt.name}
                  <span className="landing-sale-note">{saleNote(tt, 'live')}</span>
                </div>
                <span className="landing-sale-price">{formatMoney(tt.price)}</span>
              </li>
            )),
          )}
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
