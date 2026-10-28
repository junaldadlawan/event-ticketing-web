import { useSearchParams } from 'react-router-dom';
import { eventApi } from '../api/endpoints';
import type { Event } from '../api/types';
import { CategoryChips } from '../components/CategoryChips';
import { EventCollection, ResultsBar, useEventView } from '../components/EventCollection';
import { HostCta } from '../components/HostCta';
import { ListingCard } from '../components/ListingCard';
import { ManagedTag } from '../components/ManagedTag';
import { SearchBar } from '../components/SearchBar';
import { Empty, ErrorBox, Pagination, Spinner } from '../components/ui';
import { formatDuration, isOngoing } from '../utils/eventState';
import { cheapest, withLiveTypes } from '../utils/listing';
import { useAsync } from '../utils/useAsync';
import { useNow } from '../utils/useNow';

export function EventsPage() {
  const [params, setParams] = useSearchParams();
  const keyword = params.get('keyword') ?? '';
  const category = params.get('category') ?? '';
  const page = Number(params.get('page') ?? 0);
  const now = useNow().getTime(); // keeps the ongoing events' times current

  const [view, setView] = useEventView('et.eventsView');

  const { data, error, loading } = useAsync(
    () => eventApi.search({ keyword, category, page, size: 12, sort: 'startAt,asc' }),
    [keyword, category, page],
  );

  // Ticket types and the lowest price for the cards of this page.
  const live = useAsync(() => (data ? withLiveTypes(data.content) : Promise.resolve([])), [data]);

  function update(next: Record<string, string>) {
    const merged = { keyword, category, page: String(page), ...next };
    const clean = Object.fromEntries(Object.entries(merged).filter(([, v]) => v && v !== '0'));
    setParams(clean);
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
      {/* The search and the kinds of event stay in view under the header while the grid scrolls. */}
      <div className="find-bar">
        <SearchBar
          key={`${keyword}|${category}`}
          keyword={keyword}
          category={category}
          onSearch={(k, c) => update({ keyword: k, category: c, page: '0' })}
        />
        <CategoryChips active={category} onPick={(c) => update({ category: c, page: '0' })} />
      </div>

      <ErrorBox message={error} />
      {loading && !data ? (
        <Spinner />
      ) : data && data.content.length === 0 ? (
        <Empty>No events match your search.</Empty>
      ) : (
        data && (
          <>
            <ResultsBar count={data.totalElements} view={view} onViewChange={setView} />
            {view === 'grid' ? (
              <div className="listing-row listing-row-page">
                {[...ongoing, ...rest].map((event) => {
                  const types = live.data?.find((d) => d.event.id === event.id)?.live ?? [];
                  return (
                    <ListingCard
                      key={event.id}
                      event={event}
                      from={types.length ? cheapest(types).price : null}
                      left={types.length ? types.reduce((n, tt) => n + tt.quantityAvailable, 0) : undefined}
                    />
                  );
                })}
              </div>
            ) : (
              <>
                {ongoing.length > 0 && (
                  <>
                    <h2>Happening now</h2>
                    <EventCollection events={ongoing} view={view} hrefFor={(ev) => `/events/${ev.id}`} tickets tag={tag} extra={ongoingLine} />
                  </>
                )}
                {ongoing.length > 0 && <h2 className="events-section-gap">All other events</h2>}
                <EventCollection events={rest} view={view} hrefFor={(ev) => `/events/${ev.id}`} tickets tag={tag} />
              </>
            )}
            <Pagination page={data} onChange={(p) => update({ page: String(p) })} />
          </>
        )
      )}

      <HostCta />
    </>
  );
}
