import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { eventApi } from '../api/endpoints';
import type { Event } from '../api/types';
import { EventImage } from '../components/EventImage';
import { Empty, ErrorBox, Pagination, Spinner, StatusBadge } from '../components/ui';
import { formatDateTime } from '../utils/format';
import { useAsync } from '../utils/useAsync';

type View = 'list' | 'grid';
const VIEW_KEY = 'et.eventsView';

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

export function EventsPage() {
  const [params, setParams] = useSearchParams();
  const keyword = params.get('keyword') ?? '';
  const category = params.get('category') ?? '';
  const page = Number(params.get('page') ?? 0);

  const [kw, setKw] = useState(keyword);
  const [cat, setCat] = useState(category);
  const [view, setView] = useState<View>(readView);

  function changeView(next: View) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // storage unavailable
    }
  }

  const { data, error, loading } = useAsync(
    () => eventApi.search({ keyword, category, page, size: 12, sort: 'startAt,asc' }),
    [keyword, category, page],
  );

  function update(next: Record<string, string>) {
    const merged = { keyword, category, page: String(page), ...next };
    const clean = Object.fromEntries(Object.entries(merged).filter(([, v]) => v && v !== '0'));
    setParams(clean);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    update({ keyword: kw.trim(), category: cat.trim(), page: '0' });
  }

  return (
    <>
      <section className="hero">
        <h1>Find your next event</h1>
        <form className="search" onSubmit={onSearch}>
          <input
            placeholder="Search events..."
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            aria-label="Keyword"
          />
          <input
            placeholder="Category"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Category"
          />
          <button className="btn btn-primary" type="submit">
            Search
          </button>
        </form>
      </section>

      <ErrorBox message={error} />
      {loading && !data ? (
        <Spinner />
      ) : data && data.content.length === 0 ? (
        <Empty>No events match your search.</Empty>
      ) : (
        data && (
          <>
            <div className="results-bar">
              <span className="muted small">
                {data.totalElements} {data.totalElements === 1 ? 'event' : 'events'}
              </span>
              <div className="segmented" role="group" aria-label="Event layout">
                <button
                  type="button"
                  title="List view"
                  aria-label="List view"
                  aria-pressed={view === 'list'}
                  onClick={() => changeView('list')}
                >
                  <ListIcon />
                </button>
                <button
                  type="button"
                  title="Grid view"
                  aria-label="Grid view"
                  aria-pressed={view === 'grid'}
                  onClick={() => changeView('grid')}
                >
                  <GridIcon />
                </button>
              </div>
            </div>
            <div className={view === 'grid' ? 'event-grid' : 'event-list'}>
              {data.content.map((ev) => (
                <EventCard key={ev.id} event={ev} view={view} />
              ))}
            </div>
            <Pagination page={data} onChange={(p) => update({ page: String(p) })} />
          </>
        )
      )}
    </>
  );
}

function ListIcon() {
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

function EventCard({ event, view }: { event: Event; view: View }) {
  return (
    <Link to={`/events/${event.id}`} className="card event-card">
      <EventImage event={event} size={view === 'grid' ? 'md' : 'sm'} />
      <div className="card-body">
        <div className="row-between">
          <span className="eyebrow">{event.category}</span>
          <StatusBadge status={event.status} />
        </div>
        <h3>{event.title}</h3>
        <p className="muted small">{formatDateTime(event.startAt, event.timezone)}</p>
        <p className="muted small">{event.venue ? event.venue.name : 'Online'}</p>
      </div>
    </Link>
  );
}
