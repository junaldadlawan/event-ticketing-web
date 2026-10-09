import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Event } from '../api/types';
import { formatDateTime } from '../utils/format';
import { EventImage } from './EventImage';
import { StatusBadge } from './ui';

export type EventView = 'list' | 'grid';

/** List/grid choice, remembered per page under `storageKey`. */
export function useEventView(storageKey: string) {
  const [view, setView] = useState<EventView>(() => {
    try {
      return localStorage.getItem(storageKey) === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });

  function changeView(next: EventView) {
    setView(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // storage unavailable
    }
  }

  return [view, changeView] as const;
}

/** "N events" on the left, list/grid icons on the right. */
export function ResultsBar({
  count,
  view,
  onViewChange,
}: {
  count: number;
  view: EventView;
  onViewChange: (v: EventView) => void;
}) {
  return (
    <div className="results-bar">
      <span className="muted small">
        {count} {count === 1 ? 'event' : 'events'}
      </span>
      <div className="segmented" role="group" aria-label="Event layout">
        <button
          type="button"
          title="List view"
          aria-label="List view"
          aria-pressed={view === 'list'}
          onClick={() => onViewChange('list')}
        >
          <ListIcon />
        </button>
        <button
          type="button"
          title="Grid view"
          aria-label="Grid view"
          aria-pressed={view === 'grid'}
          onClick={() => onViewChange('grid')}
        >
          <GridIcon />
        </button>
      </div>
    </div>
  );
}

/** Events as list rows or grid cards. `hrefFor` picks where each card links. */
export function EventCollection({
  events,
  view,
  hrefFor,
  extra,
  tag,
}: {
  events: Event[];
  view: EventView;
  hrefFor: (e: Event) => string;
  /** Optional extra line per card (e.g. the ticket prefix on the Manage page). */
  extra?: (e: Event) => ReactNode;
  /** Optional small tag shown before the status (e.g. "You manage" on the public list). */
  tag?: (e: Event) => ReactNode;
}) {
  return (
    <div className={view === 'grid' ? 'event-grid' : 'event-list'}>
      {events.map((ev) => (
        <Link key={ev.id} to={hrefFor(ev)} className="card event-card">
          <EventImage event={ev} size={view === 'grid' ? 'md' : 'sm'} />
          <div className="card-body">
            <div className="row-between">
              <span className="eyebrow">{ev.category}</span>
              <span className="card-tags">
                {tag?.(ev)}
                <StatusBadge status={ev.status} />
              </span>
            </div>
            <h3>{ev.title}</h3>
            <p className="muted small">{formatDateTime(ev.startAt, ev.timezone)}</p>
            <p className="muted small">{ev.venue ? ev.venue.name : 'Online'}</p>
            {extra && <p className="muted small">{extra(ev)}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="3" height="3" rx="0.75" fill="currentColor" />
      <rect x="1.5" y="10.5" width="3" height="3" rx="0.75" fill="currentColor" />
      <path d="M7 4h7.5M7 12h7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" />
    </svg>
  );
}
