import type { EventPost } from '../utils/eventPosts';
import { formatDateTime } from '../utils/format';

const LABEL = { ANNOUNCEMENT: 'Announcement', SALE: 'Sale' } as const;

export function EventPostsFeed({
  posts,
  onRemove,
}: {
  posts: EventPost[];
  /** Given only to the organizer: shows a remove button on each post. */
  onRemove?: (id: string) => void;
}) {
  return (
    <ul className="post-feed">
      {posts.map((p) => (
        <li key={p.id} className={`post-card post-${p.kind.toLowerCase()}`}>
          <div className="post-meta">
            <span className="post-kind">{LABEL[p.kind]}</span>
            <time dateTime={p.createdAt}>{formatDateTime(p.createdAt)}</time>
            {onRemove && (
              <button type="button" className="btn-link post-remove" onClick={() => onRemove(p.id)}>
                Remove
              </button>
            )}
          </div>
          <h3>{p.title}</h3>
          {p.body && <p>{p.body}</p>}
        </li>
      ))}
    </ul>
  );
}
