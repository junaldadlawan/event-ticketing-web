import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { eventApi, organizationApi } from '../../api/endpoints';
import type { Event, EventStatus } from '../../api/types';
import { SuspendedOrgNotice } from '../../components/SuspendedOrgNotice';
import { CategorySelect } from '../../components/CategorySelect';
import { PlusIcon, SearchIcon } from '../../components/DesignerIcons';
import { EventCollection, ResultsBar, useEventView } from '../../components/EventCollection';
import { EventFormDialog } from './CreateEventPage';
import { Empty, ErrorBox, Pagination, Spinner, PageHeader } from '../../components/ui';
import { dateGroupLabel, groupInRuns } from '../../utils/dateGroups';
import { formatDuration, isEventOver, isOngoing } from '../../utils/eventState';
import { humanize } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';
import { useNow } from '../../utils/useNow';
import { useOrgNames } from '../../utils/useOrgNames';
import { EventTicketStatuses } from '../../components/EventTicketStatuses';
import { LogsButton } from '../../components/LogsButton';
import { useAuth } from '../../auth/AuthContext';
import { isAdmin } from '../../auth/roles';
import { useHasPermission, usePosition } from '../../auth/useCanManage';

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
  // Admins can narrow to suspended events, or to those that are not (shown only when not).
  const suspension = params.get('suspension') ?? '';
  // Admins can look at one organization's events (all of them when empty).
  const org = params.get('org') ?? '';
  // Lists each event's ticket types with their status.
  const showTickets = params.get('tickets') === '1';
  const page = Number(params.get('page') ?? 0);

  const [kw, setKw] = useState(keyword);
  // Admins read the platform's event log; organizers and owners their organizations'.
  const { user } = useAuth();
  const platformLogs = isAdmin(user?.role);
  // Admins only read events here (and suspend them on the event's page): they never create one.
  const canCreate = useHasPermission('EVENTS', 'any') && !platformLogs;
  // Check-in staff only read events: no logs, no editing.
  const scanner = usePosition() === 'Scanner';
  // /manage/new opens the New event window over this list.
  const navigate = useNavigate();
  const creating = useMatch('/manage/new') !== null;
  const [view, setView] = useEventView('et.manageView');

  const { data, error, loading, reload } = useAsync(
    () =>
      eventApi.managed({
        keyword,
        category,
        status: suspension === 'yes' ? 'SUSPENDED' : status || undefined,
        organizationId: platformLogs && org ? org : undefined,
        page,
        size: 12,
        sort: 'startAt,desc',
      }),
    [keyword, category, status, suspension, org, page],
  );

  const allOrgs = useAsync(() => (platformLogs ? organizationApi.list() : Promise.resolve([])), [platformLogs]).data ?? [];
  const orgNames = useOrgNames((data?.content ?? []).map((e) => e.organizationId));

  function update(next: Record<string, string>) {
    const merged = { keyword, category, status, suspension, org, tickets: showTickets ? '1' : '', page: String(page), ...next };
    const clean = Object.fromEntries(Object.entries(merged).filter(([, v]) => v && v !== '0'));
    setParams(clean);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    update({ keyword: kw.trim(), page: '0' });
  }

  const filtered = Boolean(keyword || category || status || suspension || org);
  // Events running right now, from this page of results, with how long they have been on.
  const now = useNow().getTime();
  // "Not suspended" can't be asked of the API, so it hides the suspended ones from this page of results.
  const shown = (data?.content ?? []).filter((e) => suspension !== 'no' || e.status !== 'SUSPENDED');
  const ongoing = shown.filter((e) => isOngoing(e, now));
  const rest = shown.filter((e) => !isOngoing(e, now));
  // Still to come, soonest first and grouped by when (Today, Tomorrow, a weekday, Later this month, a month); then the ended ones.
  // Drafts are one group of their own, whatever their date.
  const drafts = rest.filter((e) => e.status === 'DRAFT');
  const toCome = rest.filter((e) => e.status !== 'DRAFT' && !isEventOver(e, now)).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const completed = rest.filter((e) => e.status !== 'DRAFT' && isEventOver(e, now));
  // The organization's name, only when the list mixes several.
  const orgLabel = (ev: Event) => (orgNames.size > 1 || (platformLogs && !org) ? orgNames.get(ev.organizationId) : undefined);
  const extra = (ev: Event) => (
    <>
      {orgLabel(ev)}
      {showTickets && <EventTicketStatuses event={ev} />}
    </>
  );

  return (
    <>
      <EventFormDialog
        open={creating}
        onClose={() => navigate('/manage', { replace: true })}
        onSaved={(created) => navigate(`/manage/events/${created.id}`, { replace: true })}
      />
      <SuspendedOrgNotice organizationIds={(data?.content ?? []).map((e) => e.organizationId)} />
      <section className="hero">
        <PageHeader
          title="Events"
          lede={platformLogs ? (org ? orgNames.get(org) : "Every organization's events") : orgNames.size > 0 ? [...orgNames.values()].join(' · ') : undefined}
          actions={
            <>
              {!scanner && <LogsButton area="EVENTS" title="Event Management" organizations={platformLogs ? undefined : 'mine'} />}
              {canCreate && (
                <Link to="/manage/new" className="btn btn-cta">
                  <PlusIcon />
                  New event
                </Link>
              )}
            </>
          }
        />
        <form className={`search ${platformLogs ? 'search-admin' : 'search-wide'}`} onSubmit={onSearch}>
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
          {platformLogs && (
            <select value={org} onChange={(e) => update({ keyword: kw.trim(), org: e.target.value, page: '0' })} aria-label="Organization">
              <option value="">All organizations</option>
              {[...allOrgs].sort((a, b) => a.name.localeCompare(b.name)).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          {platformLogs && (
            <select
              value={suspension}
              onChange={(e) => update({ keyword: kw.trim(), suspension: e.target.value, page: '0' })}
              aria-label="Suspension"
            >
              <option value="">Suspended or not</option>
              <option value="yes">Suspended</option>
              <option value="no">Not suspended</option>
            </select>
          )}
          <button className="btn btn-primary search-button" type="submit" title="Search" aria-label="Search">
            <SearchIcon />
          </button>
        </form>
      </section>

      <ErrorBox message={error} />
      {loading && !data ? (
        <Spinner />
      ) : data && shown.length === 0 ? (
        <Empty>
          {filtered ? (
            'No events match your search.'
          ) : (
            <>
              No events to manage yet.{canCreate && <> <Link to="/manage/new">Create one</Link></>}
            </>
          )}
        </Empty>
      ) : (
        data && (
          <>
            <label className="show-tickets-toggle">
              <input type="checkbox" checked={showTickets} onChange={(e) => update({ tickets: e.target.checked ? '1' : '' })} />
              Show each event's tickets and their status
            </label>
            <ResultsBar count={suspension === 'no' ? shown.length : data.totalElements} view={view} onViewChange={setView} onRefresh={reload} refreshing={loading} />
            <div className="manage-list">
            {ongoing.length > 0 && (
              <>
                <h2>Happening now</h2>
                <EventCollection
                  events={ongoing}
                  view={view}
                  hrefFor={(ev) => `/manage/events/${ev.id}`}
                  extra={(ev) => (
                    <>
                      Running for {formatDuration(now - new Date(ev.startAt).getTime())} ·{' '}
                      {formatDuration(new Date(ev.endAt).getTime() - now)} left
                      {orgLabel(ev) && <> · {orgLabel(ev)}</>}
                      {showTickets && <EventTicketStatuses event={ev} />}
                    </>
                  )}
                />
              </>
            )}
            {drafts.length > 0 && (
              <section aria-label="Drafts">
                <h2 className={ongoing.length > 0 ? 'events-section-gap' : undefined}>Drafts</h2>
                <EventCollection events={drafts} view={view} hrefFor={(ev) => `/manage/events/${ev.id}`} extra={extra} />
              </section>
            )}
            {groupInRuns(toCome, (e) => dateGroupLabel(e.startAt)).map((g) => (
              <section key={g.start} aria-label={g.label}>
                <h2 className={ongoing.length > 0 || drafts.length > 0 || g.start > 0 ? 'events-section-gap' : undefined}>{g.label}</h2>
                <EventCollection events={g.items} view={view} hrefFor={(ev) => `/manage/events/${ev.id}`} extra={extra} />
              </section>
            ))}
            {completed.length > 0 && (
              <section aria-label="Completed">
                <h2 className={ongoing.length > 0 || drafts.length > 0 || toCome.length > 0 ? 'events-section-gap' : undefined}>Completed</h2>
                <EventCollection events={completed} view={view} hrefFor={(ev) => `/manage/events/${ev.id}`} extra={extra} stamp={false} />
              </section>
            )}
            </div>
            <Pagination page={data} onChange={(p) => update({ page: String(p) })} />
          </>
        )
      )}
    </>
  );
}
