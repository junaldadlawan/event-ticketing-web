import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { eventApi } from '../../api/endpoints';
import type { EventStatus } from '../../api/types';
import { CategorySelect } from '../../components/CategorySelect';
import { PlusIcon, SearchIcon } from '../../components/DesignerIcons';
import { EventCollection, ResultsBar, useEventView } from '../../components/EventCollection';
import { Empty, ErrorBox, Pagination, Spinner } from '../../components/ui';
import { humanize } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';

const STATUSES: EventStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'ON_SALE',
  'SOLD_OUT',
  'CANCELLED',
  'COMPLETED',
  'SUSPENDED',
];

export function ManageEventsPage() {
  // Filters live in the URL (like the events page) so Back keeps them.
  const [params, setParams] = useSearchParams();
  const keyword = params.get('keyword') ?? '';
  const category = params.get('category') ?? '';
  const status = (params.get('status') ?? '') as EventStatus | '';
  const page = Number(params.get('page') ?? 0);

  const [kw, setKw] = useState(keyword);
  const [view, setView] = useEventView('et.manageView');

  const { data, error, loading } = useAsync(
    () =>
      eventApi.managed({
        keyword,
        category,
        status: status || undefined,
        page,
        size: 12,
        sort: 'startAt,desc',
      }),
    [keyword, category, status, page],
  );

  function update(next: Record<string, string>) {
    const merged = { keyword, category, status, page: String(page), ...next };
    const clean = Object.fromEntries(Object.entries(merged).filter(([, v]) => v && v !== '0'));
    setParams(clean);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    update({ keyword: kw.trim(), page: '0' });
  }

  const filtered = Boolean(keyword || category || status);

  return (
    <>
      <section className="hero">
        <div className="row-between page-header">
          <h1>Manage events</h1>
          <Link to="/manage/new" className="btn btn-cta">
            <PlusIcon />
            New event
          </Link>
        </div>
        <form className="search search-wide" onSubmit={onSearch}>
          <input
            placeholder="Search your events..."
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            aria-label="Keyword"
          />
          {/* Dropdowns apply immediately; the keyword still needs Search / Enter. */}
          <CategorySelect
            value={category}
            onChange={(value) => update({ keyword: kw.trim(), category: value, page: '0' })}
            emptyLabel="All categories"
            aria-label="Category"
          />
          <select
            value={status}
            onChange={(e) => update({ keyword: kw.trim(), status: e.target.value, page: '0' })}
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
          <button className="btn btn-primary search-button" type="submit" title="Search" aria-label="Search">
            <SearchIcon />
          </button>
        </form>
      </section>

      <ErrorBox message={error} />
      {loading && !data ? (
        <Spinner />
      ) : data && data.content.length === 0 ? (
        <Empty>
          {filtered ? (
            'No events match your search.'
          ) : (
            <>
              No events to manage yet. <Link to="/manage/new">Create one</Link>
            </>
          )}
        </Empty>
      ) : (
        data && (
          <>
            <ResultsBar count={data.totalElements} view={view} onViewChange={setView} />
            <EventCollection
              events={data.content}
              view={view}
              hrefFor={(ev) => `/manage/events/${ev.id}`}
              extra={(ev) => (
                <>
                  Prefix <code>{ev.ticketPrefix}</code>
                </>
              )}
            />
            <Pagination page={data} onChange={(p) => update({ page: String(p) })} />
          </>
        )
      )}
    </>
  );
}
