import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Navigate, NavLink, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { platformFeeApi } from '../../api/endpoints';
import type { FeeType, PlatformFeeRule, PlatformFeeRuleRequest } from '../../api/types';
import { FormDialog } from '../../components/FormDialog';
import { Empty, ErrorBox, SuccessBox } from '../../components/ui';
import { formatMoney } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';
import { AdminOnly } from './AdminTabs';

const DEFAULT_CURRENCY = 'USD';

/** "5% of the ticket total" / "$1.00 per order". */
function describeRule(r: PlatformFeeRule): string {
  if (r.type === 'PERCENTAGE') return `${r.percentage ?? 0}% of the ticket total`;
  return `${formatMoney(r.flatAmount)} per order`;
}

type FeeDialog =
  | { kind: 'default'; rule?: PlatformFeeRule };

/** One entry per admin tab, in the tab bar's order. Only the ones with something to set have a panel so far. */
const SECTIONS: { key: string; label: string; panel?: () => ReactNode }[] = [
  { key: 'events', label: 'Event Management' },
  { key: 'posts', label: 'Posts' },
  { key: 'organizations', label: 'Organizations' },
  { key: 'users', label: 'Users' },
  { key: 'finance', label: 'Finance & Payouts', panel: () => <FinanceSettings /> },
];

/** Admin tab: settings, with a vertical list on the left (one entry per admin tab) and that tab's settings on the right. */
export function AdminSettingsPage() {
  const { section } = useParams();
  const current = SECTIONS.find((x) => x.key === section);
  return (
    <AdminOnly>
      {!current ? (
        <Navigate to="/admin/settings/finance" replace />
      ) : (
        <>
          <h1>Settings</h1>
          <div className="settings-layout">
            <nav className="settings-nav" aria-label="Settings">
              {SECTIONS.map((x) => (
                <NavLink key={x.key} to={`/admin/settings/${x.key}`}>
                  {x.label}
                </NavLink>
              ))}
            </nav>
            <div className="settings-panel">
              <h2>{current.label}</h2>
              {current.panel ? current.panel() : <Empty>Nothing to set for {current.label} yet.</Empty>}
            </div>
          </div>
        </>
      )}
    </AdminOnly>
  );
}

/** Finance & Payouts settings: the platform fee ("overhead" on each ticket order) and its rules. */
function FinanceSettings() {
  const rules = useAsync(() => platformFeeApi.list(), []);
  const [dialog, setDialog] = useState<FeeDialog | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const defaultRule = (rules.data ?? []).find((r) => r.scope === 'PLATFORM');
  function saved(message: string) {
    setDialog(null);
    setErr(null);
    setMsg(message);
    rules.reload();
  }

  return (
    <>
      <ErrorBox message={rules.error ?? err} />
      <SuccessBox message={msg} />

      <dl className="setting-row">
        <dt>Default fee</dt>
        <dd>
          {rules.loading && !rules.data ? '…' : defaultRule ? describeRule(defaultRule) : 'None'}
        </dd>
        <button type="button" className="btn btn-sm" onClick={() => setDialog({ kind: 'default', rule: defaultRule })}>
          {defaultRule ? 'Edit' : 'Set'}
        </button>
      </dl>

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
