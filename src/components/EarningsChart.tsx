import type { EarningsPoint } from '../api/types';
import { formatMoney } from '../utils/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-15" -> "Oct 15", "2026-10" -> "Oct 2026". */
function periodLabel(period: string): string {
  const [y, m, d] = period.split('-');
  const month = MONTHS[Number(m) - 1] ?? period;
  return d ? `${month} ${Number(d)}` : `${month} ${y}`;
}

const W = 640;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 8 };

/**
 * Earnings as bars, one per day or month. Bars start at zero; a negative period (refunds above sales) shows as an empty
 * bar and its tooltip carries the real amount. Hover (or focus) a bar for its amount.
 */
export function EarningsChart({ points }: { points: EarningsPoint[] }) {
  if (points.length === 0) return null;
  const currency = points[0].earnings.currency;
  const max = Math.max(1, ...points.map((p) => p.earnings.amount));
  const slot = (W - PAD.left - PAD.right) / points.length;
  const barW = Math.max(2, Math.min(36, slot * 0.7));
  const plotH = H - PAD.top - PAD.bottom;
  // Name about six periods along the bottom, however many bars there are.
  const every = Math.max(1, Math.ceil(points.length / 6));
  return (
    <svg className="earnings-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Earnings in ${currency}, ${points.length} periods`}>
      <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className="chart-axis" />
      {points.map((p, i) => {
        const h = (Math.max(0, p.earnings.amount) / max) * plotH;
        const x = PAD.left + i * slot + (slot - barW) / 2;
        return (
          <g key={p.period}>
            <rect x={x} y={H - PAD.bottom - h} width={barW} height={h} rx={2} className="chart-bar" tabIndex={0}>
              <title>{`${periodLabel(p.period)}: ${formatMoney(p.earnings)}`}</title>
            </rect>
            {i % every === 0 && (
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="chart-label">
                {periodLabel(p.period)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
