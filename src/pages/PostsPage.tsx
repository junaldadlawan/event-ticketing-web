import { postApi } from '../api/endpoints';
import { EventPostsFeed } from '../components/EventPostsFeed';
import { Empty, ErrorBox, PageHeader, Spinner } from '../components/ui';
import { useLivePosts } from '../utils/livePosts';
import { useAsync } from '../utils/useAsync';

/** Posts tab: the latest announcements, site-wide and from events that are on sale or done. */
export function PostsPage() {
  const { data, error, loading, setData } = useAsync(() => postApi.list({ page: 0, size: 20 }), []);
  // A post an admin hides, deletes or schedules disappears here on its own, without a reload.
  useLivePosts(() => postApi.list({ page: 0, size: 20 }), setData);
  const posts = data?.content ?? [];
  return (
    <div className="narrow">
      <PageHeader title="Posts" lede="News and announcements from us and from the events on sale." />
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : posts.length === 0 ? <Empty>No announcements yet.</Empty> : <EventPostsFeed posts={posts} showEvent />}
    </div>
  );
}
