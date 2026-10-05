import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { eventApi } from '../api/endpoints';
import type { Event } from '../api/types';
import { Empty, ErrorBox, Pagination, Spinner, StatusBadge } from '../components/ui';
import { formatDateTime } from '../utils/format';
import { useAsync } from '../utils/useAsync';

export function EventsPage() {
  const [params, setParams] = useSearchParams();
  const keyword = params.get('keyword') ?? '';
  const category = params.get('category') ?? '';
  const page = Number(params.get('page') ?? 0);

  const [kw, setKw] = useState(keyword);
  const [cat, setCat] = useState(category);

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
            <div className="grid">
              {data.content.map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
            <Pagination page={data} onChange={(p) => update({ page: String(p) })} />
          </>
        )
      )}
    </>
  );
}

function EventCard({ event }: { event: Event }) {
  const image = event.images?.[0];
  return (
    <Link to={`/events/${event.id}`} className="card event-card">
      <div className="event-image" style={image ? { backgroundImage: `url(${image})` } : undefined}>
        {!image && <span>{event.category}</span>}
      </div>
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
