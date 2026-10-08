import { useState } from 'react';
import { Link } from 'react-router-dom';
import { eventApi, ticketTypeApi } from '../api/endpoints';
import type { Event, TicketType } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { EventPostsFeed } from '../components/EventPostsFeed';
import { PostComposer } from '../components/PostComposer';
import { Empty, ErrorBox, Spinner } from '../components/ui';
import { formatMoney } from '../utils/format';
import { addPost, loadPosts, removePost } from '../utils/eventPosts';
import type { EventPost } from '../utils/eventPosts';
import { useAsync } from '../utils/useAsync';
import { saleNote, saleState } from './EventLandingPage';

/** Storage key for posts that belong to the whole site (written by an admin on Home), not to one event. */
const SITE = 'site';

interface HomeData {
  event: Event;
  live: TicketType[];
  posts: EventPost[];
}

/** Home: what is on sale right now and the latest posts. Only an admin can add site-wide posts here. */
export function HomePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [sitePosts, setSitePosts] = useState<EventPost[]>(() => loadPosts(SITE));
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
  const eventPosts = data
    .flatMap((d) => d.posts.map((p) => ({ ...p, title: `${d.event.title}: ${p.title}` })));
  const posts = [...sitePosts, ...eventPosts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const siteIds = new Set(sitePosts.map((p) => p.id));

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
      {isAdmin && (
        <>
          <p className="muted">Admin: post a sale or announcement on the Home page. Saved in this browser only for now.</p>
          <PostComposer onPost={(p) => setSitePosts(addPost(SITE, p))} />
        </>
      )}
      {posts.length === 0 ? (
        <Empty>No announcements yet.</Empty>
      ) : (
        <EventPostsFeed
          posts={posts}
          onRemove={isAdmin ? (id) => setSitePosts(removePost(SITE, id)) : undefined}
          canRemove={(id) => siteIds.has(id)}
        />
      )}
    </>
  );
}
