import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Navigate, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { gatewayFeeApi, platformFeeApi } from '../../api/endpoints';
import type { FeePayer, GatewayFeePayer, GatewayFeeRequest, GatewayFeeSetting, Money, PlatformFeeRule, PlatformFeeRuleRequest } from '../../api/types';
import { FormDialog } from '../../components/FormDialog';
import { Empty, ErrorBox, SuccessBox, PageHeader } from '../../components/ui';
import { LogsButton } from '../../components/LogsButton';
import { formatMoney } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';
import { AdminOnly } from './AdminTabs';
import { GATEWAY_FEE_SAVED } from '../../utils/useGatewayFeeAlert';
import { ConfirmDialog } from '../../components/ConfirmDialog';

const DEFAULT_CURRENCY = 'PHP';
const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD'];

/** A fixed amount's currency: pick from the list (a currency already saved is kept even if it is not on the list). */
function CurrencySelect({ value, onChange }: { value: string; onChange: (currency: string) => void }) {
  const list = CURRENCIES.includes(value) ? CURRENCIES : [value, ...CURRENCIES];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Currency">
      {list.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

/** "5% of the ticket total" / "$1.00 per ticket" / "5% + $1.00 per ticket". */
const FEE_PAYER_LABEL: Record<FeePayer, string> = {
  CUSTOMER: 'the customer pays it (added in the cart)',
  ORGANIZATION: 'taken from the organization’s payout',
  PLATFORM: 'the platform absorbs it',
};

function describeRule(r: PlatformFeeRule): string {
  if (r.type === 'PERCENTAGE') return `${r.percentage ?? 0}% of the ticket total`;
  if (r.type === 'COMBINED' && !r.flatAmount?.amount) return `${r.percentage ?? 0}% of the ticket total`;
  if (r.type === 'COMBINED') return `${r.percentage ?? 0}% + ${formatMoney(r.flatAmount)} per ticket`;
  return `${formatMoney(r.flatAmount)} per ticket`;
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
          <PageHeader title="Settings" actions={<LogsButton area="SETTINGS" title="Settings" />} />
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
        <dt>Platform fee</dt>
        <dd>
          {rules.loading && !rules.data ? '…' : defaultRule ? describeRule(defaultRule) : 'None'}
          {defaultRule?.payer && <span className="muted small"> · {FEE_PAYER_LABEL[defaultRule.payer]}</span>}
        </dd>
        <button type="button" className="btn btn-sm" onClick={() => setDialog({ kind: 'default', rule: defaultRule })}>
          {defaultRule ? 'Edit' : 'Set'}
        </button>
      </dl>

      <GatewayFeeRow onSaved={(m) => { setErr(null); setMsg(m); }} />

      <FormDialog
        open={dialog?.kind === 'default'}
        title={dialog?.kind === 'default' && dialog.rule ? 'Edit the platform fee' : 'Set the platform fee'}
        onClose={() => setDialog(null)}
      >
        {dialog?.kind === 'default' && (
          <FeeRuleForm
            initial={dialog.rule}
            onCancel={() => setDialog(null)}
            onSubmit={async (body) => {
              const rule = await platformFeeApi.setDefault(body);
              if (body.payer && rule.payer !== body.payer) {
                rules.reload();
                throw new Error('The fee was saved, but the API does not store who pays it yet, so the customer still pays. It needs the platform-fee payer update.');
              }
              saved('Platform fee saved.');
            }}
          />
        )}
      </FormDialog>
    </>
  );
}

/** "3.125% + ₱13.39" or "None". */
function describeGatewayFee(percentage: number, flat: Money | null): string {
  const parts: string[] = [];
  if (percentage > 0) parts.push(`${percentage}%`);
  if (flat && flat.amount > 0) parts.push(formatMoney(flat));
  return parts.length ? parts.join(' + ') : 'None';
}

const hasForeign = (f: GatewayFeeSetting) => (f.foreignPercentage ?? 0) > 0 || (f.foreignFlatAmount?.amount ?? 0) > 0;

const GATEWAY_PAYER_LABEL: Record<GatewayFeePayer, string> = {
  CUSTOMER: 'the customer pays it (added in the cart)',
  ORGANIZATION: 'taken from the organization’s payout',
  PLATFORM: 'the platform absorbs it',
};

/** The two card rates PayMongo charges, as the API recognises them (VAT included). */
const CARD_RATES = [
  { key: 'DOMESTIC_CARD', label: 'Local card', percentage: 3.5 },
  { key: 'INTERNATIONAL_CARD', label: 'Foreign card', percentage: 4.5 },
];
const CARD_FLAT: Money = { amount: 1500, currency: 'PHP' };

/**
 * One line per card type whose rate about to be saved is not what PayMongo charges (the rates the payments are charged,
 * see CARD_RATES). A foreign card with no rate of its own costs the local rate.
 */
function differsFromGateway(body: GatewayFeeRequest): string[] {
  const rate = (pct: number | undefined, flat: Money | undefined) => `${pct ?? 0}% + ${formatMoney(flat ?? { amount: 0, currency: CARD_FLAT.currency })}`;
  const hasForeign = body.foreignPercentage !== undefined || body.foreignFlatAmount !== undefined;
  const set = {
    DOMESTIC_CARD: rate(body.percentage, body.flatAmount),
    INTERNATIONAL_CARD: hasForeign ? rate(body.foreignPercentage, body.foreignFlatAmount) : rate(body.percentage, body.flatAmount),
  };
  return CARD_RATES.flatMap((r) => {
    const charged = `${r.percentage}% + ${formatMoney(CARD_FLAT)}`;
    const now = set[r.key as keyof typeof set];
    return now === charged ? [] : [`${r.label}: PayMongo charges ${charged}; you are setting ${now}.`];
  });
}

/** The gateway fee row, like the platform fee row: the rate, who pays it, and an Edit button. */
function GatewayFeeRow({ onSaved }: { onSaved: (message: string) => void }) {
  const fee = useAsync(() => gatewayFeeApi.get(), []);
  const [editing, setEditing] = useState(false);
  const f = fee.data;
  // The notification bell sends the admin here with { highlight: 'gateway-fee' }: flag the row.
  const location = useLocation();
  const navigate = useNavigate();
  const flagged = (location.state as { highlight?: string } | null)?.highlight === 'gateway-fee';
  const row = useRef<HTMLDListElement>(null);
  const diffs = f
    ? differsFromGateway({
        percentage: f.percentage,
        flatAmount: f.flatAmount?.amount ? f.flatAmount : undefined,
        payer: f.payer,
        foreignPercentage: f.foreignPercentage ?? undefined,
        foreignFlatAmount: f.foreignFlatAmount?.amount ? f.foreignFlatAmount : undefined,
      })
    : [];
  useEffect(() => {
    if (flagged) row.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [flagged, f]);
  return (
    <>
      <ErrorBox message={fee.error} />
      <dl className={`setting-row${flagged ? ' is-flagged' : ''}`} ref={row}>
        <dt>Gateway fee</dt>
        <dd>
          {!f ? '…' : hasForeign(f) ? `Local ${describeGatewayFee(f.percentage, f.flatAmount)} · Foreign ${describeGatewayFee(f.foreignPercentage ?? 0, f.foreignFlatAmount ?? null)}` : describeGatewayFee(f.percentage, f.flatAmount)}
          {diffs.length > 0 && (
            <span className="fee-warn" role="img" tabIndex={0} title={diffs.join('\n')} aria-label={diffs.join(' ')}>
              !
            </span>
          )}
          {f && describeGatewayFee(f.percentage, f.flatAmount) !== 'None' && (
            <span className="muted small"> · {GATEWAY_PAYER_LABEL[f.payer]}</span>
          )}
        </dd>
        <button type="button" className="btn btn-sm" disabled={!f} onClick={() => setEditing(true)}>
          Edit
        </button>
      </dl>
      <FormDialog open={editing} title="Gateway fee" onClose={() => setEditing(false)}>
        {editing && f && (
          <GatewayFeeForm
            initial={f}
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              await gatewayFeeApi.update(body);
              setEditing(false);
              fee.reload();
              // the flag was about the old rate: drop it, and have the bell look again
              if (flagged) navigate(location.pathname, { replace: true, state: null });
              window.dispatchEvent(new Event(GATEWAY_FEE_SAVED));
              onSaved('Gateway fee saved.');
            }}
          />
        )}
      </FormDialog>
    </>
  );
}

/** Edit the gateway fee: type the percentage and fixed amount, and choose who pays. (An automatic rate is a future feature: see todo.md.) */
function GatewayFeeForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: GatewayFeeSetting;
  onCancel: () => void;
  onSubmit: (body: GatewayFeeRequest) => Promise<void>;
}) {
  const [percentage, setPercentage] = useState(initial.percentage > 0 ? String(initial.percentage) : '');
  const [flat, setFlat] = useState(initial.flatAmount && initial.flatAmount.amount > 0 ? (initial.flatAmount.amount / 100).toFixed(2) : '');
  const [currency, setCurrency] = useState(initial.flatAmount?.currency ?? DEFAULT_CURRENCY);
  const [foreignPct, setForeignPct] = useState(initial.foreignPercentage ? String(initial.foreignPercentage) : '');
  const [foreignFlat, setForeignFlat] = useState(
    initial.foreignFlatAmount && initial.foreignFlatAmount.amount > 0 ? (initial.foreignFlatAmount.amount / 100).toFixed(2) : '',
  );
  const [payer, setPayer] = useState<GatewayFeePayer>(initial.payer === 'PLATFORM' ? 'CUSTOMER' : initial.payer);
  const [pending, setPending] = useState<{ body: GatewayFeeRequest; diffs: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const num = (v: string) => (v.trim() === '' ? 0 : Number(v));
    const [p, f, fp, ff] = [num(percentage), num(flat), num(foreignPct), num(foreignFlat)];
    if ([p, fp].some((n) => Number.isNaN(n) || n < 0 || n > 100)) return setError('Enter each percentage between 0 and 100, or leave it empty.');
    if ([f, ff].some((n) => Number.isNaN(n) || n < 0)) return setError('Enter each fixed amount as 0 or more, or leave it empty.');
    const money = (n: number) => ({ amount: Math.round(n * 100), currency });
    const foreign = fp > 0 || ff > 0;
    const body: GatewayFeeRequest = {
      percentage: Math.round(p * 1000) / 1000,
      flatAmount: f > 0 ? money(f) : undefined,
      payer,
      foreignPercentage: foreign ? Math.round(fp * 1000) / 1000 : undefined,
      foreignFlatAmount: ff > 0 ? money(ff) : undefined,
    };
    const diffs = differsFromGateway(body);
    if (diffs.length) return setPending({ body, diffs });
    await save(body);
  }

  async function save(body: GatewayFeeRequest) {
    setPending(null);
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
      <p className="small muted">
        What the payment gateway charges for each payment. Every amount is optional; leave the local card rate empty to switch it off. Leave the foreign card rate empty and a foreign card costs the local rate.
      </p>
      <div className="segmented segmented-text" role="group" aria-label="How the fee is set">
        <button type="button" aria-pressed="true">
          Manual
        </button>
        <button type="button" aria-pressed="false" disabled title="Not available yet">
          Automatic (coming soon)
        </button>
      </div>
      <p className="small muted">
        Automatic is not available yet: the fee cannot follow PayMongo&apos;s rate by itself. For now, enter the rate
        yourself. PayMongo charges these card rates:
      </p>
      <ul className="plain-list card-rates">
        {CARD_RATES.map((r) => (
          <li key={r.key}>
            <span>{r.label}</span>
            <strong>
              {r.percentage}% + {formatMoney(CARD_FLAT)}
            </strong>
          </li>
        ))}
      </ul>
      <fieldset className="rate-group">
        <legend>Local card</legend>
        <div className="amount-pair">
          <label>
            <span>
              Percentage <span className="muted">(optional)</span>
            </span>
            <input inputMode="decimal" value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="e.g. 3.5" />
          </label>
          <label>
            <span>
              Fixed amount <span className="muted">(optional)</span>
            </span>
            <input inputMode="decimal" value={flat} onChange={(e) => setFlat(e.target.value)} placeholder="e.g. 15.00" />
          </label>
        </div>
      </fieldset>
      <fieldset className="rate-group">
        <legend>Foreign card</legend>
        <div className="amount-pair">
          <label>
            <span>
              Percentage <span className="muted">(optional)</span>
            </span>
            <input inputMode="decimal" value={foreignPct} onChange={(e) => setForeignPct(e.target.value)} placeholder="e.g. 4.5" />
          </label>
          <label>
            <span>
              Fixed amount <span className="muted">(optional)</span>
            </span>
            <input inputMode="decimal" value={foreignFlat} onChange={(e) => setForeignFlat(e.target.value)} placeholder="e.g. 15.00" />
          </label>
        </div>
      </fieldset>
      <label>
        Currency
        <CurrencySelect value={currency} onChange={setCurrency} />
      </label>
      <label>
        Who pays the fee
        <select value={payer} onChange={(e) => setPayer(e.target.value as GatewayFeePayer)}>
          <option value="CUSTOMER">The customer (added in the cart)</option>
          <option value="ORGANIZATION">The organization (taken from its payout)</option>
        </select>
      </label>
      <ErrorBox message={error} />
      <div className="modal-actions">
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save fee'}
        </button>
      </div>
      <ConfirmDialog
        open={!!pending}
        title="Different from the gateway rate"
        confirmLabel="Save anyway"
        onConfirm={() => pending && void save(pending.body)}
        onCancel={() => setPending(null)}
      >
        <ul className="plain-list">
          {pending?.diffs.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="small muted">Save this fee anyway?</p>
      </ConfirmDialog>
    </form>
  );
}

/** The fee rule: a percentage of the ticket total, a fixed amount per ticket, or both together. */
function FeeRuleForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: PlatformFeeRule;
  onCancel: () => void;
  onSubmit: (body: PlatformFeeRuleRequest) => Promise<void>;
}) {
  const [percentage, setPercentage] = useState(initial?.percentage != null ? String(initial.percentage) : '');
  const [flat, setFlat] = useState(initial?.flatAmount && initial.flatAmount.amount > 0 ? (initial.flatAmount.amount / 100).toFixed(2) : '');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [payer, setPayer] = useState<FeePayer>(initial?.payer && initial.payer !== 'PLATFORM' ? initial.payer : 'CUSTOMER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const hasPct = percentage.trim() !== '';
    const hasFlat = flat.trim() !== '';
    const p = Number(percentage);
    if (hasPct && (Number.isNaN(p) || p < 0 || p > 100)) return setError('Enter a percentage between 0 and 100.');
    const f = Number(flat);
    if (hasFlat && (Number.isNaN(f) || f < 0)) return setError('Enter the fixed amount as 0 or more.');
    const body: PlatformFeeRuleRequest = {
      // Neither filled in means a 0% fee: it waives the fee.
      type: hasPct && hasFlat ? 'COMBINED' : hasFlat ? 'FLAT' : 'PERCENTAGE',
      payer,
      ...(hasPct ? { percentage: Math.round(p * 100) / 100 } : hasFlat ? {} : { percentage: 0 }),
      ...(hasFlat ? { flatAmount: { amount: Math.round(f * 100), currency: currency.trim().toUpperCase() } } : {}),
    };
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
      <p className="small muted">
        Both amounts are optional. Fill in one or both; leave both empty to waive the fee.
      </p>
      <label>
        <span>
          Percentage of the ticket total <span className="muted">(optional)</span>
        </span>
        <input inputMode="decimal" value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="e.g. 5" />
      </label>
      <div className="amount-pair">
        <label>
          <span>
            Fixed amount per ticket <span className="muted">(optional)</span>
          </span>
          <input inputMode="decimal" value={flat} onChange={(e) => setFlat(e.target.value)} placeholder="e.g. 15.00" />
        </label>
        <label>
          Currency
          <CurrencySelect value={currency} onChange={setCurrency} />
        </label>
      </div>
      <label>
        Who pays the fee
        <select value={payer} onChange={(e) => setPayer(e.target.value as FeePayer)}>
          <option value="CUSTOMER">The customer (added in the cart)</option>
          <option value="ORGANIZATION">The organization (taken from its payout)</option>
        </select>
      </label>
      <ErrorBox message={error} />
      <div className="modal-actions">
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save fee'}
        </button>
      </div>
    </form>
  );
}
