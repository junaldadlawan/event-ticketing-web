import { Link, useNavigate } from 'react-router-dom';
import { eventApi, postApi } from '../api/endpoints';
import { CategoryChips } from '../components/CategoryChips';
import { ListingCard } from '../components/ListingCard';
import { SearchBar } from '../components/SearchBar';
import { Section } from '../components/Section';
import { EventPostsFeed } from '../components/EventPostsFeed';
import { HeroWords } from '../components/HeroWords';
import { Empty, ErrorBox, Spinner } from '../components/ui';
import { useLivePosts } from '../utils/livePosts';
import { useAsync } from '../utils/useAsync';
import { isOngoing } from '../utils/eventState';
import { cheapest, withLiveTypes } from '../utils/listing';
import { useNow } from '../utils/useNow';

// The picture behind the first screen (hotlinked from Vecteezy).
const HERO_IMAGE = 'https://static.vecteezy.com/system/resources/previews/035/817/200/large_2x/ai-generated-crowd-in-club-with-fireworks-free-photo.jpg';

/** Home: a picture banner, what is on sale right now, and the latest posts. */
export function HomePage() {
  const { data, error, loading } = useAsync(async () => {
    const page = await eventApi.search({ page: 0, size: 12, sort: 'startAt,asc' });
    return withLiveTypes(page.content);
  }, []);
  // Site-wide posts plus posts of events that are on sale or done, newest first (the API decides which).
  const postsQuery = useAsync(() => postApi.list({ page: 0, size: 20 }), []);
  // A post an admin hides, deletes or schedules disappears here on its own, without a reload.
  useLivePosts(() => postApi.list({ page: 0, size: 20 }), postsQuery.setData);
  const posts = postsQuery.data?.content ?? [];

  const now = useNow().getTime(); // keeps "happening now" and the countdown badges current
  const navigate = useNavigate();

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? 'Could not load the home page'} />;

  const onSale = data.filter((d) => d.live.length > 0);
  // Rows: on now, starting within a week, then everything else on sale (a row with nothing in it is left out).
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const ongoingNow = data.filter((d) => isOngoing(d.event, now));
  const soon = onSale.filter((d) => !isOngoing(d.event, now) && new Date(d.event.startAt).getTime() <= now + WEEK);
  const later = onSale.filter((d) => !ongoingNow.includes(d) && !soon.includes(d));
  const rows = [
    { title: 'Happening now', items: ongoingNow },
    { title: 'Starting this week', items: soon },
    { title: 'On sale now', items: later },
  ].filter((r) => r.items.length > 0);
  const goSearch = (keyword: string, category: string) =>
    navigate('/events' + (keyword || category ? `?${new URLSearchParams({ ...(keyword && { keyword }), ...(category && { category }) })}` : ''));

  return (
    <div className="home-page">
      {/* One big picture over the first screen: a crowd at a show, with the same words on top. */}
      <section className="home-cover" style={{ backgroundImage: `url("${HERO_IMAGE}")` }}>
        <div className="home-cover-inner">
          <div className="home-cover-copy">
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
          {/* The search and the kinds of event sit on the right of the picture. */}
          <div className="home-cover-find">
            <SearchBar onSearch={goSearch} />
            <CategoryChips />
          </div>
        </div>
      </section>

      {rows.map((r) => (
        <Section key={r.title} title={r.title} to={r.title === 'On sale now' ? '/events' : undefined}>
          <div className="listing-row">
            {r.items.map(({ event, live }) => (
              <ListingCard
                key={event.id}
                event={event}
                from={live.length ? cheapest(live).price : null}
                left={live.length ? live.reduce((n, tt) => n + tt.quantityAvailable, 0) : undefined}
              />
            ))}
          </div>
        </Section>
      ))}
      {rows.length === 0 && (
        <Empty>
          Nothing on sale right now. <Link to="/events">See all events</Link>
        </Empty>
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
    </div>
  );
}
