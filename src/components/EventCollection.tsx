import { assetUrl } from '../api/client';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Event } from '../api/types';
import { formatDateTime, humanize } from '../utils/format';
import { isDaytime } from '../utils/timeOfDay';
import { draftDeletesIn, formatDuration, isEventOver, startsSoonIn } from '../utils/eventState';
import { useNow } from '../utils/useNow';
import { MoonIcon, SunIcon } from './DesignerIcons';
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
  noun = 'event',
  view,
  onViewChange,
  onRefresh,
  refreshing = false,
}: {
  count: number;
  /** What is being counted, singular ("event", "ticket"). */
  noun?: string;
  view: EventView;
  onViewChange: (v: EventView) => void;
  /** Adds a reload button next to the count. */
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="results-bar">
      <span className="muted small results-count">
        {count} {count === 1 ? noun : `${noun}s`}
        {onRefresh && (
          <button
            type="button"
            className={`icon-button refresh-button${refreshing ? ' is-spinning' : ''}`}
            title="Reload"
            aria-label="Reload"
            disabled={refreshing}
            onClick={onRefresh}
          >
            <RefreshIcon />
          </button>
        )}
      </span>
      <div className="segmented" role="group" aria-label="Layout">
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
  tickets = false,
  stamp = true,
}: {
  events: Event[];
  view: EventView;
  hrefFor: (e: Event) => string;
  /** Optional extra line per card (e.g. the ticket prefix on the Manage page). */
  extra?: (e: Event) => ReactNode;
  /** Optional small tag shown before the status (e.g. "You manage" on the public list). */
  tag?: (e: Event) => ReactNode;
  /** Show each event as a ticket (sun or moon stub by time of day) instead of a picture card. */
  tickets?: boolean;
  /** Rubber-stamp "Completed" across an ended event's card (a list that is already headed "Completed" leaves it off). */
  stamp?: boolean;
}) {
  const now = useNow(1000).getTime(); // ticks the "Starts in" countdowns
  if (tickets) {
    return (
      <ul className={`event-tickets${view === 'list' ? ' is-list' : ''}`}>
        {events.map((ev) => {
          const day = isDaytime(ev);
          const over = isEventOver(ev);
          const soon = over ? null : startsSoonIn(ev, now);
          const image = assetUrl(ev.images?.[0]);
          // The picture goes on top; the day / night gradient behind it shows if the picture is missing or fails to load.
          const sky = day ? 'linear-gradient(160deg, #ffd37a, #ff8e7a)' : 'linear-gradient(160deg, #8c6bea, #1b1b5e)';
          return (
            <li key={ev.id}>
              <Link to={hrefFor(ev)} className={`event-ticket ${day ? 'is-day' : 'is-night'}${over ? ' is-completed' : ''}${soon?.shake ? ' is-soon' : ''}`}>
                <span
                  className={`event-ticket-stub${image ? ' has-image' : ''}`}
                  style={image ? { backgroundImage: `url("${image}"), ${sky}` } : undefined}
                  title={day ? 'Daytime event' : 'Evening event'}
                >
                  {day ? <SunIcon /> : <MoonIcon />}
                  <span className="sr-only">{day ? 'Daytime event' : 'Evening event'}</span>
                </span>
                <span className="event-ticket-body">
                  <span className="event-ticket-top">
                    <span className="muted small">{humanize(ev.category)}</span>
                    <span className="card-tags">
                      {tag?.(ev)}
                      {soon && <SoonBadge in={soon.left} />}
                      <StatusBadge status={over ? 'COMPLETED' : ev.status} />
                    </span>
                  </span>
                  <strong className="event-ticket-title">{ev.title}</strong>
                  <span className="muted small when-line">{whenLine(ev)}</span>
                  <span className="muted small">{ev.venue ? ev.venue.name : 'Online'}</span>
                  {extra?.(ev) && <span className="muted small">{extra(ev)}</span>}
                  {over && stamp && <CompletedStamp />}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <div className={view === 'grid' ? 'event-grid' : 'event-list'}>
      {events.map((ev) => {
        const over = isEventOver(ev);
        const soon = over ? null : startsSoonIn(ev, now);
        const draft = ev.status === 'DRAFT';
        return (
          <Link key={ev.id} to={hrefFor(ev)} className={`card event-card${over ? ' is-completed' : ''}${soon?.shake ? ' is-soon' : ''}${draft ? ' is-draft' : ''}`}>
            <EventImage event={ev} size={view === 'grid' ? 'md' : 'sm'} />
            <div className="card-body">
              <div className="row-between">
                <span className="eyebrow">{ev.category}</span>
                <span className="card-tags">
                  {tag?.(ev)}
                  {soon && <SoonBadge in={soon.left} />}
                  <StatusBadge status={over ? 'COMPLETED' : ev.status} />
                </span>
              </div>
              <h3>{ev.title}</h3>
              {view === 'grid' ? (
                // The narrow stacked card: start and end on their own lines.
                <>
                  <p className="muted small">Starts {formatDateTime(ev.startAt, ev.timezone)}</p>
                  <p className="muted small">
                    Ends {formatDateTime(ev.endAt, ev.timezone)} · {formatDuration(new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime())}
                  </p>
                </>
              ) : (
                <p className="muted small when-line">{whenLine(ev)}</p>
              )}
              <p className="muted small">{ev.venue ? ev.venue.name : 'Online'}</p>
              {extra?.(ev) && <p className="muted small">{extra(ev)}</p>}
            </div>
            {over && stamp && <CompletedStamp />}
            {draft && (
              <span className="draft-flag" aria-hidden="true">
                {draftDeletesIn(ev, now) ? `Deletes in ${draftDeletesIn(ev, now)}` : 'Not published yet'}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** "Starts in 3h" on an event that begins within a day; the card itself gives a little shake (see .is-soon). */
function SoonBadge({ in: left }: { in: string }) {
  return <span className="soon-badge">🔥 Starts in {left}</span>;
}

/** "Oct 22, 2026, 6:00 AM → Oct 22, 2026, 7:00 AM · 1h": start, end and how long it lasts, on one line, in the event's timezone. */
function whenLine(ev: Event) {
  const length = formatDuration(new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime());
  return `${formatDateTime(ev.startAt, ev.timezone)} → ${formatDateTime(ev.endAt, ev.timezone)} · ${length}`;
}

/** A big rubber-stamp "Completed" across the card of an event that has ended (the badge carries the text for screen readers). */
function CompletedStamp() {
  return (
    <span className="completed-stamp" aria-hidden="true">
      Completed
    </span>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4" />
      <path d="M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4" />
    </svg>
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
