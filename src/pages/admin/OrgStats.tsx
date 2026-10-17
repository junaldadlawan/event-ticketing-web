import { useAsync } from '../../utils/useAsync';
import { analyticsApi, eventApi } from '../../api/endpoints';
import type { Event, Money, Organization } from '../../api/types';
import { ErrorBox, Spinner } from '../../components/ui';
import { formatMoney } from '../../utils/format';

const LIVE = ['PUBLISHED', 'ON_SALE', 'SOLD_OUT'];
/** How many events are counted (and asked for sales figures); the total shown is always the real total. */
const MAX_EVENTS = 100;

interface Stats {
  total: number;
  counted: number;
  ongoing: number;
  upcoming: number;
  completed: number;
  draft: number;
  cancelled: number;
  suspended: number;
  ticketsSold: number;
  revenue: Money[];
}

function summarize(events: Event[], total: number, now: number): Omit<Stats, 'ticketsSold' | 'revenue'> {
  const out = { total, counted: events.length, ongoing: 0, upcoming: 0, completed: 0, draft: 0, cancelled: 0, suspended: 0 };
  for (const e of events) {
    const start = new Date(e.startAt).getTime();
    const end = new Date(e.endAt).getTime();
    if (e.status === 'DRAFT') out.draft++;
    else if (e.status === 'CANCELLED') out.cancelled++;
    else if (e.status === 'SUSPENDED') out.suspended++;
    else if (e.status === 'COMPLETED' || (LIVE.includes(e.status) && end < now)) out.completed++;
    else if (LIVE.includes(e.status) && start <= now) out.ongoing++;
    else if (LIVE.includes(e.status)) out.upcoming++;
  }
  return out;
}

/** What one organization has done on the platform: its events by state, tickets sold and revenue. */
export function OrgStats({ org }: { org: Organization }) {
  const stats = useAsync(async (): Promise<Stats> => {
    const page = await eventApi.managed({ organizationId: org.id, page: 0, size: MAX_EVENTS, sort: 'startAt,desc' });
    const base = summarize(page.content, page.totalElements, Date.now());
    // Sales figures for every event that was ever on sale (a draft has none); one that fails is just skipped.
    const sellable = page.content.filter((e) => e.status !== 'DRAFT');
    const results = await Promise.all(sellable.map((e) => analyticsApi.event(e.id).catch(() => null)));
    let ticketsSold = 0;
    const byCurrency = new Map<string, number>();
    for (const r of results) {
      if (!r) continue;
      ticketsSold += r.ticketsSold;
      byCurrency.set(r.revenue.currency, (byCurrency.get(r.revenue.currency) ?? 0) + r.revenue.amount);
    }
    const revenue = [...byCurrency.entries()].map(([currency, amount]) => ({ currency, amount }));
    return { ...base, ticketsSold, revenue };
  }, [org.id]);

  if (stats.loading && !stats.data) return <Spinner />;
  if (stats.error || !stats.data) return <ErrorBox message={stats.error ?? 'Could not load the statistics'} />;
  const s = stats.data;

  type Tile = { label: string; value: string | number; hint?: string; tone?: string };
  const eventTiles: Tile[] = [
    { label: 'Events', value: s.total, hint: 'in total' },
    { label: 'Ongoing', value: s.ongoing, hint: 'happening now', tone: 'good' },
    { label: 'Upcoming', value: s.upcoming, hint: 'on sale or published' },
    { label: 'Completed', value: s.completed, hint: 'finished' },
    { label: 'Drafts', value: s.draft, hint: 'not published yet' },
    { label: 'Cancelled', value: s.cancelled + s.suspended, hint: s.suspended ? `${s.suspended} suspended` : 'cancelled events' },
  ];
  const salesTiles: Tile[] = [
    { label: 'Tickets sold', value: s.ticketsSold.toLocaleString(), hint: 'across all events' },
    {
      label: 'Revenue',
      value: s.revenue.length === 0 ? formatMoney({ amount: 0, currency: 'USD' }) : s.revenue.map(formatMoney).join(' + '),
    },
  ];
  const tile = (t: Tile) => (
    <div key={t.label} className={`org-stat${t.tone ? ` org-stat-${t.tone}` : ''}`}>
      <span className="org-stat-label">{t.label}</span>
      <strong className="org-stat-value">{t.value}</strong>
      {t.hint && <span className="org-stat-hint">{t.hint}</span>}
    </div>
  );

  return (
    <div className="org-stats-wrap">
      <h3 className="org-stats-heading">Events</h3>
      <div className="org-stats org-stats-3">{eventTiles.map(tile)}</div>
      <h3 className="org-stats-heading">Sales</h3>
      <div className="org-stats org-stats-2">{salesTiles.map(tile)}</div>
      {s.total > s.counted && (
        <small className="muted">
          Counted over the latest {s.counted} of {s.total} events.
        </small>
      )}
    </div>
  );
}
