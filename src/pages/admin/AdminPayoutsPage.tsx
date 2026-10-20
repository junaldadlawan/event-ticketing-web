import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { analyticsApi, organizationApi, payoutApi, payoutWalletApi } from '../../api/endpoints';
import type { Money, Payout, PayoutStatus } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RefreshIcon, SearchIcon } from '../../components/DesignerIcons';
import { PeriodFields, StatGroup, money, useFinancePeriod } from '../../components/FinanceStats';
import { Empty, ErrorBox, Pagination, Spinner, PageHeader } from '../../components/ui';
import { LogsButton } from '../../components/LogsButton';
import { formatMoney, humanize } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';
import { AdminOnly } from './AdminTabs';

export const PAYOUT_TONE: Record<string, string> = {
  PAID: 'status-good',
  SCHEDULED: 'status-warn',
  PROCESSING: 'status-info',
  FAILED: 'status-bad',
  CANCELLED: 'status-bad',
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
      <PageHeader
        title="Finance & Payouts"
        lede="What each organization has earned, the platform fee, and what was paid out."
        actions={
          <>
            <LogsButton area="FINANCE" title="Finance & Payouts" />
            <Link to="/admin/payouts/generate" className="btn btn-primary">
              Generate payout
            </Link>
          </>
        }
      />
      <ErrorBox message={orgs.error} />

      <PlatformFinance />

      <WalletBalance />

      <section className="admin-section">
        <h2>Organization payouts</h2>
        <PayoutsList orgs={orgs.data ?? []} loading={orgs.loading && !orgs.data} />
      </section>
    </>
  );
}

/** The platform's money for a period: sales, what the platform keeps, gateway costs, the organizers' share and the payouts. */
function PlatformFinance() {
  const period = useFinancePeriod();
  const { from, to } = period;
  const fin = useAsync(() => analyticsApi.platformFinance({ from, to }), [from, to]);
  const f = fin.data;
  const p = f?.payouts;
  const count = (t: { count: number } | undefined) => `${t?.count ?? 0} ${t?.count === 1 ? 'payout' : 'payouts'}`;
  return (
    <section className="admin-section">
      <h2>Finance summary</h2>
      <PeriodFields period={period} />
      <ErrorBox message={fin.error} />
      {fin.loading && !f ? (
        <Spinner />
      ) : f ? (
        <>
          <div className="org-stats finance-stats">
            <div className="org-stat">
              <span className="org-stat-label">Gross sales</span>
              <strong className="org-stat-value">{money(f.sales.gross)}</strong>
              <span className="org-stat-hint">{f.orders.count} orders</span>
            </div>
            <div className={`org-stat${f.platform.netIncome.amount >= 0 ? ' org-stat-good' : ''}`}>
              <span className="org-stat-label">Platform net income</span>
              <strong className="org-stat-value">{money(f.platform.netIncome)}</strong>
              <span className="org-stat-hint">Fee kept minus gateway cost</span>
            </div>
            <div className="org-stat">
              <span className="org-stat-label">Owed to organizers</span>
              {/* Still to be sent: in a payout that has not been paid yet, or not in a payout at all. */}
              <strong className="org-stat-value">
                {money({ ...f.organizers.inPayouts, amount: f.organizers.inPayouts.amount + f.organizers.owedNotYetInPayout.amount })}
              </strong>
              <span className="org-stat-hint">
                {money(f.organizers.inPayouts)} in payouts · {money(f.organizers.owedNotYetInPayout)} not in a payout yet
              </span>
            </div>
            <div className="org-stat">
              <span className="org-stat-label">Paid out</span>
              <strong className="org-stat-value">{money(f.organizers.paidOut)}</strong>
              <span className="org-stat-hint">of {money(f.organizers.share)} organizers' share</span>
            </div>
          </div>
          <details className="finance-details">
            <summary>Show all figures</summary>
          <div className="finance-grid">
          <StatGroup
            title="Sales"
            stats={[
              { label: 'Gross sales', value: money(f.sales.gross), hint: `${f.orders.count} orders · ${f.orders.refunded} refunded` },
              { label: 'Refunds', value: money(f.sales.refunds) },
              { label: 'Net sales', value: money(f.sales.net) },
            ]}
          />
          <StatGroup
            title="Platform income"
            stats={[
              { label: 'Platform fee kept', value: money(f.platform.feeIncome) },
              { label: 'Gateway cost borne', value: money(f.platform.gatewayCostBorne), hint: 'Paid by the platform' },
              { label: 'Net income', value: money(f.platform.netIncome), good: f.platform.netIncome.amount >= 0 },
            ]}
          />
          <StatGroup
            title="Gateway fees"
            stats={[
              { label: 'Charged by gateway', value: money(f.gatewayFees.charged), hint: `${f.gatewayFees.foreignCardOrders} foreign-card orders` },
              { label: 'Paid by customers', value: money(f.gatewayFees.paidByCustomer) },
              { label: 'Borne by organizations', value: money(f.gatewayFees.borneByOrganization) },
              { label: 'Borne by platform', value: money(f.gatewayFees.borneByPlatform) },
            ]}
          />
          <StatGroup
            title="Organizers' share"
            stats={[
              { label: 'Share in all', value: money(f.organizers.share), hint: 'After platform and gateway fees' },
              { label: 'Paid out', value: money(f.organizers.paidOut), good: true },
              { label: 'In payouts', value: money(f.organizers.inPayouts), hint: 'Scheduled, processing or failed' },
              { label: 'Not in a payout yet', value: money(f.organizers.owedNotYetInPayout) },
            ]}
          />
          <StatGroup
            title="Payouts created in this period"
            stats={[
              { label: 'Scheduled', value: money(p?.scheduled.net), hint: count(p?.scheduled) },
              { label: 'Processing', value: money(p?.processing.net), hint: count(p?.processing) },
              { label: 'Paid', value: money(p?.paid.net), hint: count(p?.paid) },
              { label: 'Failed', value: money(p?.failed.net), hint: count(p?.failed) },
            ]}
          />
          </div>
          </details>
          <p className="muted small">
            Figures are in {f.currency}, for orders placed {f.from} to {f.to} (UTC days).
            {f.otherCurrencies.length > 0 && ` Left out: orders in ${f.otherCurrencies.join(', ')}.`}
          </p>
        </>
      ) : null}
    </section>
  );
}

/** PayMongo reports this amount for a limit it does not set. */
const NO_LIMIT = 999_999_999_999_999_999;
const limitText = (m: Money) => (m.amount >= NO_LIMIT ? 'No limit' : formatMoney(m));

/** The wallet organizers are paid from: what can be sent now, what is still on its way, and what limits apply. */
function WalletBalance() {
  const wallet = useAsync(() => payoutWalletApi.get(), []);
  // After a failed refresh (for example no wallet on the account) do not keep showing the old numbers.
  const w = wallet.error ? null : wallet.data;
  return (
    <section className="admin-section wallet">
      <div className="row-between">
        <h2>Payout wallet</h2>
        <span className="admin-actions">
          {w && (
            <>
              <span className={`status-chip ${w.activated ? 'status-good' : 'status-warn'}`}>{humanize(w.status)}</span>
              <span className="status-chip status-info">{w.provider === 'PAYMONGO' ? 'PayMongo' : 'Simulated'}</span>
            </>
          )}
          <button
            type="button"
            className={`icon-button wallet-refresh${wallet.loading ? ' is-spinning' : ''}`}
            title="Refresh the balance"
            aria-label="Refresh the balance"
            disabled={wallet.loading}
            onClick={wallet.reload}
          >
            <RefreshIcon />
          </button>
        </span>
      </div>
      <ErrorBox message={wallet.error} />
      {wallet.loading && !w ? (
        <Spinner />
      ) : w ? (
        <>
          <div className="org-stats wallet-stats">
            <div className="org-stat org-stat-good">
              <span className="org-stat-label">Available balance</span>
              <strong className="org-stat-value">{formatMoney(w.balance.available)}</strong>
              <span className="org-stat-hint">Can be sent now</span>
            </div>
            <div className="org-stat">
              <span className="org-stat-label">Pending</span>
              <strong className="org-stat-value">{formatMoney(w.balance.pending)}</strong>
              <span className="org-stat-hint">Still on its way</span>
            </div>
            <div className="org-stat">
              <span className="org-stat-label">Sent today</span>
              <strong className="org-stat-value">{formatMoney(w.usage.outwardDaily)}</strong>
              <span className="org-stat-hint">Limit {limitText(w.limits.outwardDaily)}</span>
            </div>
            <div className="org-stat">
              <span className="org-stat-label">Sent this month</span>
              <strong className="org-stat-value">{formatMoney(w.usage.outwardMonthly)}</strong>
              <span className="org-stat-hint">Limit {limitText(w.limits.outwardMonthly)}</span>
            </div>
          </div>
          <p className="muted small">
            {w.account ? `${w.account.accountName} · ${w.account.accountNumber}` : 'No account details'}
            {w.matchesConfiguredAccount === false && ' · Not the wallet set in the API settings'}
            {!w.activated && ' · Only an activated wallet can send payouts'}
          </p>
        </>
      ) : null}
    </section>
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
  const [cancelling, setCancelling] = useState<Payout | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const sorted = useMemo(() => orgs.slice().sort((a, b) => a.name.localeCompare(b.name)), [orgs]);
  const selected = orgId || sorted[0]?.id || '';
  const payouts = useAsync(
    () => (selected ? payoutApi.list(selected, { page, size: 20 }) : Promise.resolve(null)),
    [selected, page],
  );

  async function cancelPayout(p: Payout) {
    setCancelling(null);
    setCancelError(null);
    try {
      await payoutApi.cancel(p.id);
    } catch (e) {
      setCancelError(errorMessage(e));
    }
    payouts.reload();
  }

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
          <option value="CANCELLED">Cancelled</option>
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
      <ErrorBox message={payouts.error ?? cancelError} />
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
                <th />
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
                  <td>
                    {p.status === 'SCHEDULED' && (
                      <button type="button" className="btn btn-link" onClick={() => setCancelling(p)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payouts.data && <Pagination page={payouts.data} onChange={setPage} />}
        </>
      )}
      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel this payout?"
        confirmLabel="Cancel payout"
        cancelLabel="Keep it"
        danger
        onCancel={() => setCancelling(null)}
        onConfirm={() => cancelling && void cancelPayout(cancelling)}
      >
        {cancelling && formatMoney(cancelling.net)} will not be paid. Its orders are released and can be paid out in a new
        payout. This cannot be undone.
      </ConfirmDialog>
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
