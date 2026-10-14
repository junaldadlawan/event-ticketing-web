import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { organizationApi, payoutApi } from '../../api/endpoints';
import type { Payout, PayoutStatus } from '../../api/types';
import { SearchIcon } from '../../components/DesignerIcons';
import { Empty, ErrorBox, Pagination, Spinner } from '../../components/ui';
import { formatMoney, humanize } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';
import { AdminOnly } from './AdminTabs';

const PAYOUT_TONE: Record<string, string> = {
  PAID: 'status-good',
  SCHEDULED: 'status-warn',
  FAILED: 'status-bad',
};

/** Admin tab: every organization's payouts. (The platform fee lives under Settings.) */
export function AdminPayoutsPage() {
  return (
    <AdminOnly>
      <PayoutsManager />
    </AdminOnly>
  );
}

function PayoutsManager() {
  const orgs = useAsync(() => organizationApi.list(), []);

  return (
    <>
      <div className="row-between page-header">
        <h1>Finance &amp; Payouts</h1>
        <Link to="/admin/payouts/generate" className="btn btn-primary">
          Generate payout
        </Link>
      </div>
      <p className="muted">What each organization has earned, the platform fee, and what was paid out.</p>
      <ErrorBox message={orgs.error} />

      <section className="admin-section">
        <h2>Organization payouts</h2>
        <PayoutsList orgs={orgs.data ?? []} loading={orgs.loading && !orgs.data} />
      </section>
    </>
  );
}

/** One organization's payouts, newest first: gross, the platform fee, and the net paid out. */
function PayoutsList({ orgs, loading }: { orgs: { id: string; name: string }[]; loading: boolean }) {
  const [orgId, setOrgId] = useState('');
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'' | PayoutStatus>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const sorted = useMemo(() => orgs.slice().sort((a, b) => a.name.localeCompare(b.name)), [orgs]);
  const selected = orgId || sorted[0]?.id || '';
  const payouts = useAsync(
    () => (selected ? payoutApi.list(selected, { page, size: 20 }) : Promise.resolve(null)),
    [selected, page],
  );

  if (loading) return <Spinner />;
  if (sorted.length === 0) return <Empty>No organizations yet.</Empty>;

  // Filter the payouts on this page: by event name, status, and the dates (a payout counts if its period overlaps them).
  const q = query.trim().toLowerCase();
  const loaded: Payout[] = payouts.data?.content ?? [];
  const hasEvents = loaded.some((p) => p.eventTitle);
  const rows = loaded.filter(
    (p) =>
      (!q || (p.eventTitle ?? '').toLowerCase().includes(q)) &&
      (!status || p.status === status) &&
      (!from || p.periodEnd >= from) &&
      (!to || p.periodStart <= to),
  );
  const filtering = Boolean(q || status || from || to);
  const clear = () => {
    setQuery('');
    setStatus('');
    setFrom('');
    setTo('');
  };
  return (
    <>
      <div className="admin-toolbar payout-filters">
        <select
          value={selected}
          onChange={(e) => {
            setOrgId(e.target.value);
            setPage(0);
            clear();
          }}
          aria-label="Organization"
        >
          {sorted.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        {hasEvents && (
          <label className="admin-search">
            <SearchIcon />
            <input
              type="search"
              placeholder="Search by event name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search by event name"
            />
          </label>
        )}
        <select value={status} onChange={(e) => setStatus(e.target.value as '' | PayoutStatus)} aria-label="Payout status">
          <option value="">All statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
        </select>
        <label className="payout-date">
          Start date
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="payout-date">
          End date
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
        {filtering && (
          <button type="button" className="btn btn-link" onClick={clear}>
            Clear
          </button>
        )}
      </div>
      <ErrorBox message={payouts.error} />
      {payouts.loading && !payouts.data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty>{filtering ? 'No payouts match your filters.' : 'No payouts for this organization yet. They are created on a schedule.'}</Empty>
      ) : (
        <>
          <table className="table admin-table">
            <thead>
              <tr>
                {hasEvents && <th>Event</th>}
                <th>Period</th>
                <th>Gross</th>
                <th>Fees</th>
                <th>Net</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  {hasEvents && <td>{p.eventTitle ?? '—'}</td>}
                  <td className="small">
                    {p.periodStart} → {p.periodEnd}
                  </td>
                  <td>{formatMoney(p.gross)}</td>
                  <td>{formatMoney(p.fees)}</td>
                  <td>
                    <strong>{formatMoney(p.net)}</strong>
                  </td>
                  <td>
                    <span className={`status-chip ${PAYOUT_TONE[p.status] ?? 'status-info'}`}>{humanize(p.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payouts.data && <Pagination page={payouts.data} onChange={setPage} />}
        </>
      )}
    </>
  );
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Settles the organization's paid orders of a period: the platform fee is deducted and the rest is the net payout. */
export function GeneratePayoutForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (periodStart: string, periodEnd: string) => Promise<void>;
}) {
  const today = isoDay(new Date());
  const [start, setStart] = useState(isoDay(new Date(Date.now() - 7 * 86_400_000)));
  const [end, setEnd] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (end < start) {
      setError('The last day must not be before the first day.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(start, end);
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <p className="small">
        Settles the paid orders placed in this period that are not in a payout yet. Refunds are subtracted, the
        platform fee is kept, and the rest is paid out. An order is never paid out twice.
      </p>
      <div className="two-col payout-dates">
        <label>
          First day
          <input type="date" required value={start} max={today} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          Last day
          <input type="date" required value={end} min={start} max={today} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <small className="muted">Days are counted in UTC, both included. The last day can't be in the future.</small>
      <ErrorBox message={error} />
      <div className="modal-actions">
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Working…' : 'Generate payout'}
        </button>
      </div>
    </form>
  );
}
