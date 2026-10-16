import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Money } from '../api/types';
import { formatMoney } from '../utils/format';

const DAY_MS = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);
/** A UTC day as a Date at midnight, moved by whole days. */
const shift = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS);

export type PeriodPreset = 'ALL' | 'TODAY' | 'WEEK' | 'TWO_WEEKS' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';
const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'ALL', label: 'All (up to a year back)' },
  { value: 'TODAY', label: 'Today' },
  { value: 'WEEK', label: 'This week' },
  { value: 'TWO_WEEKS', label: 'Last two weeks' },
  { value: 'MONTH', label: 'This month' },
  { value: 'QUARTER', label: 'This quarter' },
  { value: 'YEAR', label: 'This year' },
  { value: 'CUSTOM', label: 'Specific dates' },
];

/** The first and last UTC day of a preset, ending today. "All" is the API's longest period: 366 days. */
function rangeOf(preset: Exclude<PeriodPreset, 'CUSTOM'>, today: string): { from: string; to: string } {
  const t = new Date(Date.parse(today));
  switch (preset) {
    case 'TODAY':
      return { from: today, to: today };
    case 'WEEK':
      // weeks start on Monday
      return { from: day(shift(today, -((t.getUTCDay() + 6) % 7))), to: today };
    case 'TWO_WEEKS':
      return { from: day(shift(today, -13)), to: today };
    case 'MONTH':
      return { from: day(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))), to: today };
    case 'QUARTER':
      return { from: day(new Date(Date.UTC(t.getUTCFullYear(), Math.floor(t.getUTCMonth() / 3) * 3, 1))), to: today };
    case 'YEAR':
      return { from: day(new Date(Date.UTC(t.getUTCFullYear(), 0, 1))), to: today };
    default:
      return { from: day(shift(today, -365)), to: today };
  }
}

/** The period of a finance summary (UTC days, at most 366): a preset, or the dates the person picks. Starts on this month. */
export function useFinancePeriod() {
  const today = day(new Date());
  const [preset, setPresetState] = useState<PeriodPreset>('MONTH');
  const [custom, setCustom] = useState(() => rangeOf('TWO_WEEKS', today));
  const { from, to } = preset === 'CUSTOM' ? custom : rangeOf(preset, today);
  const setPreset = (p: PeriodPreset) => {
    // picking "Specific dates" starts from the range that was showing
    if (p === 'CUSTOM') setCustom({ from, to });
    setPresetState(p);
  };
  return {
    from,
    to,
    today,
    preset,
    setPreset,
    setFrom: (v: string) => setCustom((c) => ({ ...c, from: v })),
    setTo: (v: string) => setCustom((c) => ({ ...c, to: v })),
  };
}

export function PeriodFields({ period }: { period: ReturnType<typeof useFinancePeriod> }) {
  const { from, to, today, preset, setPreset, setFrom, setTo } = period;
  return (
    <div className="admin-toolbar">
      <select className="select-auto" value={preset} onChange={(e) => setPreset(e.target.value as PeriodPreset)} aria-label="Period">
        {PRESETS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {preset === 'CUSTOM' ? (
        <>
          <label className="payout-date">
            From
            <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label className="payout-date">
            To
            <input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
        </>
      ) : (
        <span className="muted small">
          {from === to ? from : `${from} to ${to}`}
        </span>
      )}
    </div>
  );
}

export interface Stat {
  label: string;
  value: ReactNode;
  hint?: string;
  good?: boolean;
}
export const money = (m: Money | null | undefined) => formatMoney(m);

/** A titled panel of figures: one row per figure, label on the left, amount on the right. */
export function StatGroup({ title, stats }: { title: string; stats: Stat[] }) {
  return (
    <section className="finance-group">
      <h3>{title}</h3>
      <dl className="finance-rows">
        {stats.map((s) => (
          <div key={s.label} className={`finance-row${s.good ? ' is-good' : ''}`}>
            <dt>
              {s.label}
              {s.hint && <small>{s.hint}</small>}
            </dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
