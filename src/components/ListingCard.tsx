import { Link } from 'react-router-dom';
import type { Event, Money } from '../api/types';
import { isOngoing, startsSoonIn } from '../utils/eventState';
import { formatDateTime, formatMoney } from '../utils/format';
import { useNow } from '../utils/useNow';
import { EventImage } from './EventImage';

/**
 * A photo-first event card: the picture (or the generated cover), a badge when it is on now or starts soon, then the
 * title, when, where, and the lowest price. Used in rows and grids of events; the whole card opens the event.
 */
export function ListingCard({ event, from, left }: { event: Event; from?: Money | null; left?: number }) {
  const now = useNow(30_000).getTime();
  const live = isOngoing(event, now);
  const soon = live ? null : startsSoonIn(event, now);
  const badge = live ? 'Happening now' : soon ? `Starts in ${soon.left}` : null;
  return (
    <Link to={`/events/${event.id}`} className="listing-card">
      <span className="listing-card-photo">
        <EventImage event={event} size="lg" />
        {badge && <span className="listing-card-badge">{badge}</span>}
      </span>
      <span className="listing-card-meta">
        <strong className="listing-card-title">{event.title}</strong>
        <span className="muted small">{formatDateTime(event.startAt, event.timezone)}</span>
        <span className="muted small">{event.venue ? event.venue.name : 'Online'}</span>
        {(from || left !== undefined) && (
          <span className="listing-card-foot">
            {from ? (
              <span>
                <strong>{formatMoney(from)}</strong> <span className="muted small">from</span>
              </span>
            ) : (
              <span />
            )}
            {left !== undefined && <span className="muted small">{left} left</span>}
          </span>
        )}
      </span>
    </Link>
  );
}
