import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { organizationApi, payoutApi } from '../../api/endpoints';
import type { EligiblePayoutItem, Money } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormDialog } from '../../components/FormDialog';
import { Empty, ErrorBox, Spinner, SuccessBox, PageHeader } from '../../components/ui';
import { formatMoney } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';
import { AdminOnly } from './AdminTabs';
import { GeneratePayoutForm } from './AdminPayoutsPage';
import { Checkbox } from '../../components/fields/Checkbox';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const keyOf = (i: EligiblePayoutItem) => `${i.organizationId}:${i.eventId ?? ''}`;

/** Admin page: review what can be paid out now, pick the lines to pay, and generate the payouts in one go. */
export function AdminGeneratePayoutPage() {
  return (
    <AdminOnly>
      <GeneratePayout />
    </AdminOnly>
  );
}

function GeneratePayout() {
  const navigate = useNavigate();
  const today = isoDay(new Date());
  const [start, setStart] = useState(isoDay(new Date(Date.now() - 7 * 86_400_000)));
  const [end, setEnd] = useState(today);
  const [orgId, setOrgId] = useState('');
  const [scope, setScope] = useState<'COMPLETED' | 'ALL'>('COMPLETED');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const orgs = useAsync(() => organizationApi.list('APPROVED'), []);
  const eligible = useAsync(
    () => (start && end && end >= start ? payoutApi.eligible({ periodStart: start, periodEnd: end, organizationId: orgId || undefined, eventScope: scope }) : Promise.resolve(null)),
    [start, end, orgId, scope],
  );

  const items = eligible.data?.items ?? [];
  const chosen = useMemo(() => items.filter((i) => picked.has(keyOf(i))), [items, picked]);
  const chosenOrgs = new Set(chosen.map((i) => i.organizationId)).size;
  const total: Money | null = chosen.length
    ? { amount: chosen.reduce((n, i) => n + i.eligible.amount, 0), currency: chosen[0].eligible.currency }
    : null;
  const readyKeys = items.filter((i) => i.status === 'READY').map(keyOf);
  const allReady = readyKeys.length > 0 && readyKeys.every((k) => picked.has(k));

  function toggle(key: string) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  async function generate() {
    setConfirming(false);
    setBusy(true);
    setError(null);
    try {
      const made = await payoutApi.generateBatch({
        periodStart: start,
        periodEnd: end,
        items: chosen.map((i) => ({ organizationId: i.organizationId, eventId: i.eventId })),
      });
      setDone(`${made.length} ${made.length === 1 ? 'payout was' : 'payouts were'} created.`);
      setPicked(new Set());
      eligible.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const summary = eligible.data?.summary;
  return (
    <>
      <nav className="gp-crumbs" aria-label="Breadcrumb">
        <Link to="/admin/payouts">Finance &amp; Payouts</Link>
        <span aria-hidden="true"> / </span>
        <span>Generate payout</span>
      </nav>
      <PageHeader title="Generate payout" lede="Review the funds that can be paid out and generate the payout records." />

      <SuccessBox message={done} />
      <ErrorBox message={error} />

      <div className="org-stats gp-stats">
        <div className="org-stat">
          <span className="org-stat-label">Eligible organizations</span>
          <strong className="org-stat-value">{summary ? summary.eligibleOrganizations : '–'}</strong>
        </div>
        <div className="org-stat org-stat-good">
          <span className="org-stat-label">Eligible amount</span>
          <strong className="org-stat-value">{summary ? formatMoney(summary.eligibleAmount) : '–'}</strong>
        </div>
        <div className="org-stat">
          <span className="org-stat-label">On hold</span>
          <strong className="org-stat-value">{summary ? formatMoney(summary.onHold) : '–'}</strong>
        </div>
      </div>

      <section className="gp-card" aria-labelledby="gp-criteria">
        <h2 id="gp-criteria" className="gp-title">Payout criteria</h2>
        <div className="gp-criteria">
          <label>
            First day
            <input type="date" value={start} max={end || today} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            Last day
            <input type="date" value={end} min={start} max={today} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <label>
            Organization
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">All eligible organizations</option>
              {(orgs.data ?? [])
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Event eligibility
            <select value={scope} onChange={(e) => setScope(e.target.value as 'COMPLETED' | 'ALL')}>
              <option value="COMPLETED">Completed events only</option>
              <option value="ALL">All events</option>
            </select>
          </label>
        </div>
        <small className="muted">Days are counted in UTC, both included. Refunds are subtracted and the platform fee is kept.</small>
      </section>

      <h2 className="gp-heading">Eligible payouts</h2>
      {eligible.loading && !eligible.data ? (
        <Spinner />
      ) : eligible.error ? (
        <Unavailable message={eligible.error} orgs={orgs.data ?? []} onDone={(m) => setDone(m)} />
      ) : items.length === 0 ? (
        <Empty>Nothing to pay out for these dates.</Empty>
      ) : (
        <table className="table admin-table gp-table">
          <thead>
            <tr>
              <th>
                <Checkbox
                  aria-label="Select all ready payouts"
                  checked={allReady}
                  onChange={() => setPicked(allReady ? new Set() : new Set(readyKeys))}
                />
              </th>
              <th>Organization</th>
              <th>Event</th>
              <th>Eligible</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const key = keyOf(i);
              const hold = i.status === 'ON_HOLD';
              return (
                <tr key={key} className={hold ? 'is-suspended' : undefined}>
                  <td>
                    <Checkbox
                      aria-label={`Select ${i.organizationName}${i.eventTitle ? `, ${i.eventTitle}` : ''}`}
                      disabled={hold}
                      checked={picked.has(key)}
                      onChange={() => toggle(key)}
                    />
                  </td>
                  <td>
                    <strong>{i.organizationName}</strong>
                  </td>
                  <td>{i.eventTitle ?? '—'}</td>
                  <td>{formatMoney(i.eligible)}</td>
                  <td>
                    <span className={`status-chip ${hold ? 'status-warn' : 'status-good'}`} title={i.holdReason ?? undefined}>
                      {hold ? 'On hold' : 'Ready'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="muted small">
        {chosenOrgs} {chosenOrgs === 1 ? 'organization' : 'organizations'} selected
      </p>

      <section className="gp-card" aria-labelledby="gp-summary">
        <h2 id="gp-summary" className="gp-title">Payout summary</h2>
        <dl className="gp-summary">
          <dt>Selected organizations</dt>
          <dd>{chosenOrgs}</dd>
          <dt>Total payout amount</dt>
          <dd>
            <strong>{total ? formatMoney(total) : '–'}</strong>
          </dd>
        </dl>
        <p className="gp-note small">Only funds that are ready can be paid. Lines on hold can't be selected.</p>
        <div className="modal-actions">
          <button type="button" className="btn" disabled={busy} onClick={() => navigate('/admin/payouts')}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || chosen.length === 0} onClick={() => setConfirming(true)}>
            {busy ? 'Working…' : 'Review & generate payout'}
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirming}
        title="Generate these payouts?"
        confirmLabel="Generate payout"
        cancelLabel="Back"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void generate()}
      >
        {chosenOrgs} {chosenOrgs === 1 ? 'organization' : 'organizations'} will be paid {total ? formatMoney(total) : ''} for {start} to {end}. A
        payout can't be generated twice for the same orders.
      </ConfirmDialog>
    </>
  );
}

/** The API cannot list eligible payouts yet: say so, and keep the one-organization form so payouts can still be made. */
function Unavailable({
  message,
  orgs,
  onDone,
}: {
  message: string;
  orgs: { id: string; name: string }[];
  onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [orgId, setOrgId] = useState('');
  const chosen = orgId || orgs[0]?.id || '';
  return (
    <div className="gp-card">
      <p>
        <strong>The list of eligible payouts is not available.</strong> {message}
      </p>
      <p className="muted small">You can still generate a payout for one organization and period.</p>
      <div className="admin-toolbar">
        <select value={chosen} onChange={(e) => setOrgId(e.target.value)} aria-label="Organization">
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-sm" disabled={!chosen} onClick={() => setOpen(true)}>
          Generate for this organization
        </button>
      </div>
      <FormDialog open={open} title="Generate payout" onClose={() => setOpen(false)}>
        {open && (
          <GeneratePayoutForm
            onCancel={() => setOpen(false)}
            onSubmit={async (periodStart, periodEnd) => {
              const payout = await payoutApi.generate(chosen, { periodStart, periodEnd });
              setOpen(false);
              onDone(`Payout created: ${formatMoney(payout.net)} net after ${formatMoney(payout.fees)} in fees.`);
            }}
          />
        )}
      </FormDialog>
    </div>
  );
}
