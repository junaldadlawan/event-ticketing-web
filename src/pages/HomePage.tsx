import { Link } from 'react-router-dom';
import { eventApi, ticketTypeApi } from '../api/endpoints';
import type { Event, TicketType } from '../api/types';
import { EventPostsFeed } from '../components/EventPostsFeed';
import { Empty, ErrorBox, Spinner } from '../components/ui';
import { formatMoney } from '../utils/format';
import { loadPosts } from '../utils/eventPosts';
import type { EventPost } from '../utils/eventPosts';
import { useAsync } from '../utils/useAsync';
import { saleNote, saleState } from './EventLandingPage';

interface HomeData {
  event: Event;
  live: TicketType[];
  posts: EventPost[];
}

/** Home: what is on sale right now and the latest organizer posts across the upcoming events. */
export function HomePage() {
  const { data, error, loading } = useAsync(async (): Promise<HomeData[]> => {
    const page = await eventApi.search({ page: 0, size: 12, sort: 'startAt,asc' });
    const now = Date.now();
    return Promise.all(
      page.content.map(async (event) => {
        const types = await ticketTypeApi.list(event.id).catch(() => [] as TicketType[]);
        return {
          event,
          live: types.filter((tt) => saleState(tt, now) === 'live'),
          posts: loadPosts(event.id),
        };
      }),
    );
  }, []);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? 'Could not load the home page'} />;

  const onSale = data.filter((d) => d.live.length > 0);
  const posts = data
    .flatMap((d) => d.posts.map((p) => ({ post: p, event: d.event })))
    .sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt));

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

      <h2>Sales &amp; announcements</h2>
      {posts.length === 0 ? (
        <Empty>No announcements yet.</Empty>
      ) : (
        <>
          <EventPostsFeed posts={posts.map((p) => ({ ...p.post, title: `${p.event.title}: ${p.post.title}` }))} />
        </>
      )}
    </>
  );
}
