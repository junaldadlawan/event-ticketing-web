import type { Post } from '../api/types';
import { formatDateTime, formatPostFull, formatPostTime } from '../utils/format';
import { useNow } from '../utils/useNow';
import { EditIcon, EyeIcon, EyeOffIcon, TrashIcon } from './DesignerIcons';

const LABEL = { ANNOUNCEMENT: 'Announcement', SALE: 'Sale' } as const;

/** One short line about the schedule: when a post goes live, or until when it is up. */
function scheduleNote(p: Post): string | null {
  if (p.status === 'HIDDEN') return 'Hidden';
  if (p.status === 'SCHEDULED' && p.publishAt) return `Goes live ${formatDateTime(p.publishAt)}`;
  if (p.status === 'EXPIRED' && p.expiresAt) return `Expired ${formatDateTime(p.expiresAt)}`;
  if (p.expiresAt) return `Until ${formatDateTime(p.expiresAt)}`;
  return null;
}

export function EventPostsFeed({
  posts,
  onRemove,
  onEdit,
  onToggleHidden,
  showSchedule = false,
  showEvent = false,
  layout = 'cards',
}: {
  posts: Post[];
  /** Given only to admins: shows a remove button on each post. */
  onRemove?: (id: string) => void;
  /** Given only to admins: shows an eye on each post to hide it from / show it to the public. */
  onToggleHidden?: (post: Post) => void;
  /** Given only to admins: shows a pencil on each post. */
  onEdit?: (post: Post) => void;
  /** Show the publish / expiry line (admin only; the public never sees when a post goes away). */
  showSchedule?: boolean;
  /** Prefix the title with the event's name (for posts shown outside their event's page). */
  showEvent?: boolean;
  /** Full posts as cards (default), or compact one-line rows. */
  layout?: 'cards' | 'list';
}) {
  const now = useNow(); // keeps "5 mins ago" fresh while the page stays open
  const when = (p: Post) => p.publishAt ?? p.createdAt;
  const title = (p: Post) => (showEvent && p.eventTitle ? `${p.eventTitle}: ${p.title}` : p.title);
  const statusClass = (p: Post) => (p.status && p.status !== 'LIVE' ? ` post-${p.status.toLowerCase()}` : '');

  const actions = (p: Post) =>
    (onToggleHidden || onEdit || onRemove) && (
      <div className="post-actions">
        {onToggleHidden && (
          <button
            type="button"
            className="icon-button post-hide"
            onClick={() => onToggleHidden(p)}
            title={p.hidden ? 'Show to the public' : 'Hide from the public'}
            aria-label={`${p.hidden ? 'Show' : 'Hide'} ${p.title}`}
          >
            {p.hidden ? <EyeIcon /> : <EyeOffIcon />}
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            className="icon-button post-edit"
            onClick={() => onEdit(p)}
            title="Edit post"
            aria-label={`Edit ${p.title}`}
          >
            <EditIcon />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            className="icon-button icon-button-danger post-remove"
            onClick={() => onRemove(p.id)}
            title="Delete post"
            aria-label={`Delete ${p.title}`}
          >
            <TrashIcon />
          </button>
        )}
      </div>
    );

  const meta = (p: Post) => (
    <div className="post-meta">
      <span className="post-kind">{LABEL[p.kind]}</span>
      <time dateTime={when(p)} title={formatPostFull(when(p))}>
        {formatPostTime(when(p), now)}
      </time>
      {showSchedule && scheduleNote(p) && (
        <span className={`post-schedule${p.status && p.status !== 'LIVE' ? ' post-schedule-off' : ''}`}>
          {scheduleNote(p)}
        </span>
      )}
    </div>
  );

  if (layout === 'list') {
    return (
      <ul className="post-feed post-feed-list">
        {posts.map((p) => (
          <li key={p.id} className={`post-row post-${p.kind.toLowerCase()}${statusClass(p)}`}>
            {p.imageUrl ? (
              <img className="post-thumb" src={p.imageUrl} alt="" loading="lazy" />
            ) : (
              <span className="post-thumb post-thumb-empty" aria-hidden="true" />
            )}
            <div className="post-row-main">
              <h3>{title(p)}</h3>
              {meta(p)}
              {p.body && <p className="post-row-body">{p.body}</p>}
            </div>
            {actions(p)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="post-feed">
      {posts.map((p) => (
        <li key={p.id} className={`post-card post-${p.kind.toLowerCase()}${statusClass(p)}`}>
          <div className="post-head">
            <h3>{title(p)}</h3>
            {actions(p)}
          </div>
          {meta(p)}
          {p.body && <p>{p.body}</p>}
          {p.imageUrl && <img className="post-image" src={p.imageUrl} alt="" loading="lazy" />}
        </li>
      ))}
    </ul>
  );
}
