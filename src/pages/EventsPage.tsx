import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { eventApi } from '../api/endpoints';
import { CategorySelect } from '../components/CategorySelect';
import { SearchIcon } from '../components/DesignerIcons';
import { EventCollection, ResultsBar, useEventView } from '../components/EventCollection';
import { HostCta } from '../components/HostCta';
import { ManagedTag } from '../components/ManagedTag';
import { Empty, ErrorBox, Pagination, Spinner } from '../components/ui';
import { useAsync } from '../utils/useAsync';

export function EventsPage() {
  const [params, setParams] = useSearchParams();
  const keyword = params.get('keyword') ?? '';
  const category = params.get('category') ?? '';
  const page = Number(params.get('page') ?? 0);

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

  return (
    <>
      <section className="hero">
        {/* Same header row as Manage, so the two pages line up exactly. */}
        <div className="row-between page-header">
          <h1>Find your next event</h1>
        </div>
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
            <EventCollection
              events={data.content}
              view={view}
              hrefFor={(ev) => `/events/${ev.id}`}
              tag={(ev) => <ManagedTag organizationId={ev.organizationId} />}
            />
            <Pagination page={data} onChange={(p) => update({ page: String(p) })} />
          </>
        )
      )}

      <HostCta />
    </>
  );
}
