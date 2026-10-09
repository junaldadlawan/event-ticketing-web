import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { eventApi, organizationApi, payoutApi, platformFeeApi } from '../../api/endpoints';
import type { FeeScope, FeeType, Payout, PlatformFeeRule, PlatformFeeRuleRequest } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EditIcon, TrashIcon } from '../../components/DesignerIcons';
import { FormDialog } from '../../components/FormDialog';
import { Empty, ErrorBox, Pagination, Spinner, SuccessBox } from '../../components/ui';
import { formatDateTime, formatMoney, humanize } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';
import { AdminOnly } from './AdminTabs';

const DEFAULT_CURRENCY = 'USD';

/** "5% of the ticket total" / "$1.00 per order". */
function describeRule(r: PlatformFeeRule): string {
  if (r.type === 'PERCENTAGE') return `${r.percentage ?? 0}% of the ticket total`;
  return `${formatMoney(r.flatAmount)} per order`;
}

const PAYOUT_TONE: Record<string, string> = {
  PAID: 'status-good',
  SCHEDULED: 'status-warn',
  FAILED: 'status-bad',
};

type FeeDialog =
  | { kind: 'default'; rule?: PlatformFeeRule }
  | { kind: 'override'; rule?: PlatformFeeRule };

/** Admin tab: the platform fee ("overhead" on each ticket order) and its rules, plus every organization's payouts. */
export function AdminPayoutsPage() {
  return (
    <AdminOnly>
      <PayoutsManager />
    </AdminOnly>
  );
}

function PayoutsManager() {
  const rules = useAsync(() => platformFeeApi.list(), []);
  const orgs = useAsync(() => organizationApi.list(), []);
  const [dialog, setDialog] = useState<FeeDialog | null>(null);
  const [removing, setRemoving] = useState<PlatformFeeRule | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const orgName = useMemo(() => new Map((orgs.data ?? []).map((o) => [o.id, o.name])), [orgs.data]);
  const defaultRule = (rules.data ?? []).find((r) => r.scope === 'PLATFORM');
  const overrides = (rules.data ?? []).filter((r) => r.scope !== 'PLATFORM');

  // Event titles for the event rules (the rule only carries the id).
  const eventIds = overrides.filter((r) => r.scope === 'EVENT' && r.scopeId).map((r) => r.scopeId as string);
  const eventKey = eventIds.join(',');
  const [eventTitles, setEventTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    Promise.all(
      eventIds.map((id) =>
        eventApi
          .get(id)
          .then((e) => [id, e.title] as const)
          .catch(() => [id, 'Unknown event'] as const),
      ),
    ).then((pairs) => alive && setEventTitles(Object.fromEntries(pairs)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey]);

  const targetName = (r: PlatformFeeRule) =>
    r.scope === 'ORGANIZATION'
      ? (orgName.get(r.scopeId ?? '') ?? 'Unknown organization')
      : (eventTitles[r.scopeId ?? ''] ?? '…');

  function saved(message: string) {
    setDialog(null);
    setErr(null);
    setMsg(message);
    rules.reload();
  }

  async function confirmRemove() {
    const r = removing;
    setRemoving(null);
    if (!r) return;
    setErr(null);
    setMsg(null);
    try {
      if (r.scope === 'PLATFORM') await platformFeeApi.removeDefault();
      else if (r.scope === 'ORGANIZATION') await platformFeeApi.removeForOrganization(r.scopeId as string);
      else await platformFeeApi.removeForEvent(r.scopeId as string);
      setMsg(r.scope === 'PLATFORM' ? 'Default fee removed.' : 'Fee override removed.');
      rules.reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <>
      <h1>Payouts</h1>
      <p className="muted">
        The platform fee is added on top of the ticket price at checkout, and deducted when an organization is paid out.
      </p>
      <ErrorBox message={rules.error ?? err} />
      <SuccessBox message={msg} />

      <section className="admin-section">
        <h2>Platform fee</h2>
        <p className="muted small">
          The most specific rule applies to an order: an event rule first, then an organization rule, then the default.
          A rate of 0 waives the fee.
        </p>

        <div className="admin-card">
          <div className="row-between">
            <div>
              <strong>Default fee</strong>
              <div className="muted small">
                {rules.loading && !rules.data
                  ? 'Loading…'
                  : defaultRule
                    ? describeRule(defaultRule)
                    : 'No default fee: orders are not charged a fee unless an override applies.'}
              </div>
            </div>
            <div className="admin-actions">
              <button type="button" className="btn btn-sm" onClick={() => setDialog({ kind: 'default', rule: defaultRule })}>
                {defaultRule ? 'Edit' : 'Set default fee'}
              </button>
              {defaultRule && (
                <button
                  type="button"
                  className="icon-button icon-button-danger"
                  title="Remove the default fee"
                  aria-label="Remove the default fee"
                  onClick={() => setRemoving(defaultRule)}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="row-between admin-subhead">
          <h3>Overrides</h3>
          <button type="button" className="btn btn-sm" onClick={() => setDialog({ kind: 'override' })}>
            + Add override
          </button>
        </div>
        {overrides.length === 0 ? (
          <Empty>No overrides. Every order uses the default fee.</Empty>
        ) : (
          <table className="table admin-table">
            <thead>
              <tr>
                <th>Applies to</th>
                <th>Fee</th>
                <th>Updated</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {overrides.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{targetName(r)}</strong>
                    <div className="muted small">{r.scope === 'ORGANIZATION' ? 'Organization' : 'Event'}</div>
                  </td>
                  <td>{describeRule(r)}</td>
                  <td className="muted small">{formatDateTime(r.updatedAt ?? r.createdAt)}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="icon-button"
                        title="Edit"
                        aria-label={`Edit the fee for ${targetName(r)}`}
                        onClick={() => setDialog({ kind: 'override', rule: r })}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button-danger"
                        title="Remove"
                        aria-label={`Remove the fee for ${targetName(r)}`}
                        onClick={() => setRemoving(r)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-section">
        <h2>Organization payouts</h2>
        <PayoutsList orgs={orgs.data ?? []} loading={orgs.loading && !orgs.data} />
      </section>

      <FormDialog
        open={dialog?.kind === 'default'}
        title={dialog?.kind === 'default' && dialog.rule ? 'Edit the default fee' : 'Set the default fee'}
        onClose={() => setDialog(null)}
      >
        {dialog?.kind === 'default' && (
          <FeeRuleForm
            initial={dialog.rule}
            onCancel={() => setDialog(null)}
            onSubmit={async (body) => {
              await platformFeeApi.setDefault(body);
              saved('Default fee saved.');
            }}
          />
        )}
      </FormDialog>

      <FormDialog
        open={dialog?.kind === 'override'}
        title={dialog?.kind === 'override' && dialog.rule ? 'Edit fee override' : 'Add fee override'}
        onClose={() => setDialog(null)}
      >
        {dialog?.kind === 'override' && (
          <OverrideForm
            rule={dialog.rule}
            orgs={(orgs.data ?? []).map((o) => ({ id: o.id, name: o.name }))}
            eventTitle={dialog.rule?.scope === 'EVENT' ? eventTitles[dialog.rule.scopeId ?? ''] : undefined}
            orgTitle={dialog.rule?.scope === 'ORGANIZATION' ? orgName.get(dialog.rule.scopeId ?? '') : undefined}
            onCancel={() => setDialog(null)}
            onSaved={() => saved('Fee override saved.')}
          />
        )}
      </FormDialog>

      <ConfirmDialog
        open={removing !== null}
        title={removing?.scope === 'PLATFORM' ? 'Remove the default fee?' : 'Remove this override?'}
        confirmLabel="Remove"
        cancelLabel="Keep"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => void confirmRemove()}
      >
        {removing?.scope === 'PLATFORM'
          ? 'Orders without a more specific rule will no longer be charged a platform fee.'
          : 'Orders for it go back to the next rule that applies (the organization rule, or the default).'}
      </ConfirmDialog>
    </>
  );
}

/** The fee rule itself: a percentage of the ticket total, or a flat amount per order. */
function FeeRuleForm({
  initial,
  onCancel,
  onSubmit,
  extra,
  canSubmit = true,
}: {
  initial?: PlatformFeeRule;
  onCancel: () => void;
  onSubmit: (body: PlatformFeeRuleRequest) => Promise<void>;
  /** Fields shown above the rule (the override form puts its target pickers here). */
  extra?: React.ReactNode;
  canSubmit?: boolean;
}) {
  const [type, setType] = useState<FeeType>(initial?.type ?? 'PERCENTAGE');
  const [percentage, setPercentage] = useState(initial?.percentage != null ? String(initial.percentage) : '');
  const [flat, setFlat] = useState(initial?.flatAmount ? (initial.flatAmount.amount / 100).toFixed(2) : '');
  const [currency, setCurrency] = useState(initial?.flatAmount?.currency ?? DEFAULT_CURRENCY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let body: PlatformFeeRuleRequest;
    if (type === 'PERCENTAGE') {
      const p = Number(percentage);
      if (percentage.trim() === '' || Number.isNaN(p) || p < 0 || p > 100) {
        setError('Enter a percentage between 0 and 100.');
        return;
      }
      body = { type, percentage: Math.round(p * 100) / 100 };
    } else {
      const f = Number(flat);
      if (flat.trim() === '' || Number.isNaN(f) || f < 0) {
        setError('Enter the amount per order (0 or more).');
        return;
      }
      body = { type, flatAmount: { amount: Math.round(f * 100), currency: currency.trim().toUpperCase() } };
    }
    setBusy(true);
    try {
      await onSubmit(body);
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      {extra}
      <div className="segmented segmented-text" role="group" aria-label="Fee type">
        <button type="button" aria-pressed={type === 'PERCENTAGE'} onClick={() => setType('PERCENTAGE')}>
          Percentage
        </button>
        <button type="button" aria-pressed={type === 'FLAT'} onClick={() => setType('FLAT')}>
          Flat per order
        </button>
      </div>
      {type === 'PERCENTAGE' ? (
        <label>
          Percentage of the ticket total
          <input
            inputMode="decimal"
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
            placeholder="e.g. 5"
          />
          <small className="muted">Up to two decimals. 0 waives the fee.</small>
        </label>
      ) : (
        <div className="two-col">
          <label>
            Amount per order
            <input inputMode="decimal" value={flat} onChange={(e) => setFlat(e.target.value)} placeholder="e.g. 1.00" />
          </label>
          <label>
            Currency
            <input maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </label>
        </div>
      )}
      <ErrorBox message={error} />
      <div className="modal-actions">
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy || !canSubmit}>
          {busy ? 'Saving…' : 'Save fee'}
        </button>
      </div>
    </form>
  );
}

function OverrideForm({
  rule,
  orgs,
  eventTitle,
  orgTitle,
  onCancel,
  onSaved,
}: {
  rule?: PlatformFeeRule;
  orgs: { id: string; name: string }[];
  eventTitle?: string;
  orgTitle?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(rule);
  const [scope, setScope] = useState<Exclude<FeeScope, 'PLATFORM'>>(
    rule && rule.scope !== 'PLATFORM' ? rule.scope : 'ORGANIZATION',
  );
  const [targetId, setTargetId] = useState(rule?.scopeId ?? '');
  // Events an admin can pick: every event, including drafts.
  const events = useAsync(() => eventApi.managed({ page: 0, size: 100, sort: 'startAt,asc' }), []);

  const extra = editing ? (
    <p className="small">
      <span className="muted">{scope === 'ORGANIZATION' ? 'Organization' : 'Event'}: </span>
      <strong>{(scope === 'ORGANIZATION' ? orgTitle : eventTitle) ?? '…'}</strong>
    </p>
  ) : (
    <>
      <label>
        Applies to
        <select
          value={scope}
          onChange={(e) => {
            setScope(e.target.value as Exclude<FeeScope, 'PLATFORM'>);
            setTargetId('');
          }}
        >
          <option value="ORGANIZATION">One organization (all its events)</option>
          <option value="EVENT">One event</option>
        </select>
      </label>
      <label>
        {scope === 'ORGANIZATION' ? 'Organization' : 'Event'}
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)} required>
          <option value="">Choose…</option>
          {scope === 'ORGANIZATION'
            ? orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))
            : (events.data?.content ?? []).map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({humanize(ev.status)})
                </option>
              ))}
        </select>
      </label>
    </>
  );

  return (
    <FeeRuleForm
      initial={rule}
      extra={extra}
      canSubmit={Boolean(targetId)}
      onCancel={onCancel}
      onSubmit={async (body) => {
        if (scope === 'ORGANIZATION') await platformFeeApi.setForOrganization(targetId, body);
        else await platformFeeApi.setForEvent(targetId, body);
        onSaved();
      }}
    />
  );
}

/** One organization's payouts, newest first: gross, the platform fee, and the net paid out. */
function PayoutsList({ orgs, loading }: { orgs: { id: string; name: string }[]; loading: boolean }) {
  const [orgId, setOrgId] = useState('');
  const [page, setPage] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const sorted = useMemo(() => orgs.slice().sort((a, b) => a.name.localeCompare(b.name)), [orgs]);
  const selected = orgId || sorted[0]?.id || '';
  const payouts = useAsync(
    () => (selected ? payoutApi.list(selected, { page, size: 10 }) : Promise.resolve(null)),
    [selected, page],
  );

  if (loading) return <Spinner />;
  if (sorted.length === 0) return <Empty>No organizations yet.</Empty>;

  const rows: Payout[] = payouts.data?.content ?? [];
  const orgName = sorted.find((o) => o.id === selected)?.name ?? '';
  return (
    <>
      <div className="admin-toolbar">
        <select
          value={selected}
          onChange={(e) => {
            setOrgId(e.target.value);
            setPage(0);
          }}
          aria-label="Organization"
        >
          {sorted.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setGenerating(true)}>
          Generate payout
        </button>
      </div>
      <SuccessBox message={created} />
      <ErrorBox message={payouts.error} />
      {payouts.loading && !payouts.data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty>No payouts for this organization yet. They are created on a schedule.</Empty>
      ) : (
        <>
          <table className="table admin-table">
            <thead>
              <tr>
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
      <FormDialog open={generating} title={`Generate payout: ${orgName}`} onClose={() => setGenerating(false)}>
        {generating && (
          <GeneratePayoutForm
            onCancel={() => setGenerating(false)}
            onSubmit={async (periodStart, periodEnd) => {
              const payout = await payoutApi.generate(selected, { periodStart, periodEnd });
              setGenerating(false);
              setPage(0);
              setCreated(`Payout created for ${orgName}: ${formatMoney(payout.net)} net after ${formatMoney(payout.fees)} in fees.`);
              payouts.reload();
            }}
          />
        )}
      </FormDialog>
    </>
  );
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Settles the organization's paid orders of a period: the platform fee is deducted and the rest is the net payout. */
function GeneratePayoutForm({
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
