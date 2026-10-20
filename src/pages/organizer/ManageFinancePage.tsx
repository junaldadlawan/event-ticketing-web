import { useState } from 'react';
import { Link } from 'react-router-dom';
import { analyticsApi, eventApi, organizationApi } from '../../api/endpoints';
import type { EarningsInterval, OrgTransaction } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { EarningsChart } from '../../components/EarningsChart';
import { PeriodFields, money, useFinancePeriod } from '../../components/FinanceStats';
import { Empty, ErrorBox, Spinner, PageHeader } from '../../components/ui';
import { LogsButton } from '../../components/LogsButton';
import { formatDateTime, formatMoney, humanize } from '../../utils/format';
import { downloadText, statementCsv } from '../../utils/statement';
import { useAsync } from '../../utils/useAsync';

/** Finance & Payouts for an organization's owner: balances, earnings over time, and the latest transactions (all events or one). */
export function ManageFinancePage() {
  const { user } = useAuth();
  const orgs = useAsync(
    async () => (await organizationApi.mine()).filter((o) => o.status === 'APPROVED' || o.status === 'SUSPENDED'),
    [],
  );
  const [orgId, setOrgId] = useState('');
  const selected = orgId || orgs.data?.[0]?.id || '';
  const orgName = orgs.data?.find((o) => o.id === selected)?.name ?? '';
  // '' = all events. Reset when the organization changes, since the event belongs to one organization.
  const [eventFilter, setEventFilter] = useState({ orgId: '', eventId: '' });
  const eventId = eventFilter.orgId === selected ? eventFilter.eventId : '';
  const events = useAsync(
    () =>
      selected
        ? eventApi.managed({ organizationId: selected, page: 0, size: 100, sort: 'startAt,desc' })
        : Promise.resolve(null),
    [selected],
  );
  // Drafts never sell, so they have nothing to show here.
  const eventOptions = (events.data?.content ?? []).filter((e) => e.organizationId === selected && e.status !== 'DRAFT');
  const eventTitle = eventOptions.find((e) => e.id === eventId)?.title ?? '';
  const scope = eventId || undefined;
  const period = useFinancePeriod();
  const { from, to } = period;
  const [interval, setInterval] = useState<EarningsInterval>('DAY');
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const fin = useAsync(
    () => (selected ? analyticsApi.organizationFinance(selected, { from, to, eventId: scope }) : Promise.resolve(null)),
    [selected, from, to, scope],
  );
  const earnings = useAsync(
    () => (selected ? analyticsApi.organizationEarnings(selected, { interval, from, to, eventId: scope }) : Promise.resolve(null)),
    [selected, interval, from, to, scope],
  );
  const recent = useAsync(
    () => (selected ? analyticsApi.organizationTransactions(selected, { page: 0, size: 10, eventId: scope }) : Promise.resolve(null)),
    [selected, scope],
  );
  const f = fin.data;

  /** The statement: this period's figures and its transactions (up to 500), as a CSV file. */
  async function download() {
    if (!f || !selected) return;
    setBusy(true);
    setDownloadError(null);
    try {
      const rows: OrgTransaction[] = [];
      for (let page = 0; page < 5; page++) {
        const res = await analyticsApi.organizationTransactions(selected, { from, to, page, size: 100, eventId: scope });
        rows.push(...res.content);
        if (res.last) break;
      }
      const label = eventTitle ? `${orgName} · ${eventTitle}` : orgName;
      const slug = eventTitle ? `-${eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : '';
      downloadText(`statement${slug}-${from}-to-${to}.csv`, statementCsv(label, f, rows));
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Could not build the statement.');
    } finally {
      setBusy(false);
    }
  }

  if (orgs.loading && !orgs.data) return <Spinner />;
  if (orgs.error) return <ErrorBox message={orgs.error} />;
  if (!orgs.data || orgs.data.length === 0) return <Empty>You don&apos;t have an organization yet.</Empty>;

  const upcoming = f?.payouts.scheduled;
  const rows = recent.data?.content ?? [];
  return (
    <>
      <PageHeader
        title="Finance & Payouts"
        lede={
          orgs.data.length > 1 ? (
            <select value={selected} onChange={(e) => setOrgId(e.target.value)} aria-label="Organization">
              {orgs.data.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : (
            orgs.data[0].name
          )
        }
        actions={
          <>
          <LogsButton area="FINANCE" title="Finance & Payouts" organizations={[{ id: selected, name: orgName }]} />
          <button type="button" className="btn btn-primary" disabled={!f || busy} onClick={() => void download()}>
            {busy ? 'Preparing…' : 'Download statement'}
          </button>
          </>
        }
      />
      <div className="finance-filters">
        <PeriodFields period={period} />
        <select
          className="select-auto"
          value={eventId}
          onChange={(e) => setEventFilter({ orgId: selected, eventId: e.target.value })}
          aria-label="Event"
          disabled={events.loading && !events.data}
        >
          <option value="">All events</option>
          {eventOptions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </div>
      <ErrorBox message={events.error ?? fin.error ?? downloadError} />

      {fin.loading && !f ? (
        <Spinner />
      ) : f ? (
        <div className="org-stats finance-stats">
          <div className="org-stat org-stat-good">
            <span className="org-stat-label">Available balance</span>
            <strong className="org-stat-value">{money(f.owedNotYetInPayout)}</strong>
            <span className="org-stat-hint">Earned, not in a payout yet</span>
          </div>
          <div className="org-stat">
            <span className="org-stat-label">Pending balance</span>
            <strong className="org-stat-value">{money(f.inPayouts)}</strong>
            <span className="org-stat-hint">In payouts on their way</span>
          </div>
          <div className="org-stat">
            <span className="org-stat-label">Total earnings</span>
            <strong className="org-stat-value">{money(f.income)}</strong>
            <span className="org-stat-hint">After refunds and fees</span>
          </div>
          <div className="org-stat">
            <span className="org-stat-label">Total paid out</span>
            <strong className="org-stat-value">{money(f.paidOut)}</strong>
            <span className="org-stat-hint">Sent to your payout account</span>
          </div>
          <div className="org-stat">
            <span className="org-stat-label">Upcoming payout</span>
            <strong className="org-stat-value">{money(upcoming?.net)}</strong>
            <span className="org-stat-hint">
              {upcoming?.count ?? 0} scheduled {upcoming?.count === 1 ? 'payout' : 'payouts'}
            </span>
          </div>
        </div>
      ) : null}
      <p className="muted small">
        Payouts are sent to your primary payout account. <Link to="/manage/settings">Change it in Settings</Link>
        {user && ' · Fees are taken before the payout.'}
      </p>

      <section className="admin-section">
        <div className="row-between">
          <h2>Financial overview</h2>
          <select className="select-auto" value={interval} onChange={(e) => setInterval(e.target.value as EarningsInterval)} aria-label="Group earnings by">
            <option value="DAY">Days</option>
            <option value="MONTH">Months</option>
          </select>
        </div>
        <ErrorBox message={earnings.error} />
        {earnings.loading && !earnings.data ? (
          <Spinner />
        ) : earnings.data && earnings.data.points.length > 0 ? (
          <EarningsChart points={earnings.data.points} />
        ) : earnings.data ? (
          <Empty>No earnings in this period.</Empty>
        ) : null}
      </section>

      <section className="admin-section">
        <h2>Recent transactions</h2>
        <ErrorBox message={recent.error} />
        {recent.loading && !recent.data ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>No transactions yet.</Empty>
        ) : (
          <table className="table admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="small">{formatDateTime(t.occurredAt)}</td>
                  <td>
                    {t.description}
                    {t.eventTitle && <span className="muted small"> · {t.eventTitle}</span>}
                  </td>
                  <td>
                    <strong>{formatMoney(t.net)}</strong>
                  </td>
                  <td>{t.status ? humanize(t.status) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
