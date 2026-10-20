import type { EarningsPoint } from '../api/types';
import { formatMoney } from '../utils/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-15" -> "Oct 15", "2026-10" -> "Oct 2026". */
export function periodLabel(period: string): string {
  const [y, m, d] = period.split('-');
  const month = MONTHS[Number(m) - 1] ?? period;
  return d ? `${month} ${Number(d)}` : `${month} ${y}`;
}

const W = 640;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 8 };

export interface Bar {
  key: string;
  /** Shown under the bar (about six are named, however many bars there are). */
  label: string;
  /** Tooltip. */
  title: string;
  value: number;
}

/**
 * Bars from zero. A negative value shows as an empty bar and its tooltip carries the real figure. Hover (or focus) a
 * bar for its tooltip.
 */
export function BarChart({ bars, label }: { bars: Bar[]; label: string }) {
  if (bars.length === 0) return null;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = (W - PAD.left - PAD.right) / bars.length;
  const barW = Math.max(2, Math.min(36, slot * 0.7));
  const plotH = H - PAD.top - PAD.bottom;
  const every = Math.max(1, Math.ceil(bars.length / 6));
  return (
    <svg className="earnings-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className="chart-axis" />
      {bars.map((b, i) => {
        const h = (Math.max(0, b.value) / max) * plotH;
        const x = PAD.left + i * slot + (slot - barW) / 2;
        return (
          <g key={b.key}>
            <rect x={x} y={H - PAD.bottom - h} width={barW} height={h} rx={2} className="chart-bar" tabIndex={0}>
              <title>{b.title}</title>
            </rect>
            {i % every === 0 && (
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="chart-label">
                {b.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Earnings as bars, one per day or month. */
export function EarningsChart({ points }: { points: EarningsPoint[] }) {
  if (points.length === 0) return null;
  return (
    <BarChart
      label={`Earnings in ${points[0].earnings.currency}, ${points.length} periods`}
      bars={points.map((p) => ({
        key: p.period,
        label: periodLabel(p.period),
        title: `${periodLabel(p.period)}: ${formatMoney(p.earnings)}`,
        value: p.earnings.amount,
      }))}
    />
  );
}
