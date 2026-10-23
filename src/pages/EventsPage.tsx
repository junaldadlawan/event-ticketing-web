import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { eventApi } from '../api/endpoints';
import type { Event } from '../api/types';
import { CategorySelect } from '../components/CategorySelect';
import { SearchIcon } from '../components/DesignerIcons';
import { EventCollection, ResultsBar, useEventView } from '../components/EventCollection';
import { HeroWords } from '../components/HeroWords';
import { HostCta } from '../components/HostCta';
import { ManagedTag } from '../components/ManagedTag';
import { Empty, ErrorBox, Pagination, Spinner } from '../components/ui';
import { formatDuration, isOngoing } from '../utils/eventState';
import { useAsync } from '../utils/useAsync';
import { useNow } from '../utils/useNow';

export function EventsPage() {
  const [params, setParams] = useSearchParams();
  const keyword = params.get('keyword') ?? '';
  const category = params.get('category') ?? '';
  const page = Number(params.get('page') ?? 0);
  const now = useNow().getTime(); // keeps the ongoing events' times current

  const [kw, setKw] = useState(keyword);
  const [view, setView] = useEventView('et.eventsView');

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
    update({ keyword: kw.trim(), page: '0' });
  }

  // Filtered here: the API has no "ongoing" filter, so it covers the events on this page of results.
  const ongoing = data?.content.filter((e) => isOngoing(e, now)) ?? [];
  const rest = data?.content.filter((e) => !isOngoing(e, now)) ?? [];
  const ongoingLine = (e: Event) => {
    const start = new Date(e.startAt).getTime();
    const end = new Date(e.endAt).getTime();
    return `Started ${formatDuration(now - start)} ago · ${formatDuration(end - now)} left · runs ${formatDuration(end - start)}`;
  };
  const tag = (ev: Event) => <ManagedTag organizationId={ev.organizationId} />;

  return (
    <>
      <section className="slab stage events-hero">
        <h1>
          <HeroWords text="Find your next event" />
        </h1>
        <p>Sunrise runs, noon markets, midnight sets: search them all.</p>
        <form className="search" onSubmit={onSearch}>
          <input
            placeholder="Search events..."
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            aria-label="Keyword"
          />
          {/* Applies immediately; the keyword still needs Search / Enter. */}
          <CategorySelect
            value={category}
            onChange={(value) => update({ keyword: kw.trim(), category: value, page: '0' })}
            emptyLabel="All categories"
            aria-label="Category"
          />
          <button className="btn btn-primary search-button" type="submit" title="Search" aria-label="Search">
            <SearchIcon />
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
            <ResultsBar count={data.totalElements} view={view} onViewChange={setView} />
            {ongoing.length > 0 && (
              <>
                <h2>Happening now</h2>
                <EventCollection events={ongoing} view={view} hrefFor={(ev) => `/events/${ev.id}`} tickets tag={tag} extra={ongoingLine} />
              </>
            )}
            {ongoing.length > 0 && <h2 className="events-section-gap">All other events</h2>}
            <EventCollection events={rest} view={view} hrefFor={(ev) => `/events/${ev.id}`} tickets tag={tag} />
            <Pagination page={data} onChange={(p) => update({ page: String(p) })} />
          </>
        )
      )}

      <HostCta />
    </>
  );
}
