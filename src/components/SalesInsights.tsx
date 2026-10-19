import { eventApi } from '../api/endpoints';
import type { Event, Order, TicketType } from '../api/types';
import { bestWindow, hourLabel, salesStats, WEEKDAYS } from '../utils/salesStats';
import type { SalesStats } from '../utils/salesStats';
import { useAsync } from '../utils/useAsync';
import { ErrorBox, Spinner } from './ui';

/** How many orders are read for the statistics (100 per request). */
const MAX_ORDERS = 2000;
/** Below this many orders the patterns are shown but flagged as early. */
const EARLY_ORDERS = 20;
const DAY_MS = 86_400_000;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Every order of the event, up to MAX_ORDERS; `complete` is false when there were more. */
async function loadOrders(eventId: string): Promise<{ orders: Order[]; complete: boolean; total: number }> {
  const orders: Order[] = [];
  for (let page = 0; ; page++) {
    const res = await eventApi.orders(eventId, { page, size: 100 });
    orders.push(...res.content);
    if (res.last || res.content.length === 0) return { orders, complete: true, total: res.totalElements };
    if (orders.length >= MAX_ORDERS) return { orders, complete: false, total: res.totalElements };
  }
}

/**
 * Sales statistics for the organizer: tickets per day, the best days of the week and hours, the recent pace and where it
 * leads, worked out from the event's own orders in the event's timezone.
 */
export function SalesInsights({ event, ticketTypes }: { event: Event; ticketTypes: TicketType[] }) {
  const { data, error, loading } = useAsync(() => loadOrders(event.id), [event.id]);
  if (loading && !data) {
    return (
      <section className="card sales-insights">
        <h2>Sales insights</h2>
        <Spinner />
      </section>
    );
  }
  if (error || !data) {
    return (
      <section className="card sales-insights">
        <h2>Sales insights</h2>
        <ErrorBox message={error ?? 'Could not load the orders.'} />
      </section>
    );
  }

  const now = Date.now();
  const end = new Date(event.endAt).getTime();
  const s = salesStats(data.orders, event.timezone, now, end);
  const capacity = ticketTypes.reduce((n, t) => n + t.quantityTotal, 0);
  const remaining = ticketTypes.reduce((n, t) => n + t.quantityAvailable, 0);
  // Sold is counted from the orders (like the charts); when not every order was read, the stock count stands in.
  const sold = data.complete ? s.tickets : capacity - remaining;
  const sellThrough = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;
  // Sales stop at the latest ticket type's sale end, and never after the event ends.
  const lastSaleEnd = Math.max(0, ...ticketTypes.map((t) => new Date(t.saleEndAt).getTime()));
  const saleEnd = Math.min(end, lastSaleEnd || end);
  const daysLeft = Math.max(0, Math.ceil((saleEnd - now) / DAY_MS));
  const pace = s.last7Days / 7;

  return (
    <section className="card sales-insights">
      <div className="row-between">
        <h2>Sales insights</h2>
        <span className="muted small">Times in {event.timezone}</span>
      </div>

      <div className="org-stats insights-stats">
        <Stat label="Tickets sold" value={String(sold)} hint={`${sellThrough}% of ${capacity}`} />
        <Stat
          label="Orders"
          value={String(s.orders)}
          hint={s.orders ? `${(s.tickets / s.orders).toFixed(1)} tickets per order` : 'None yet'}
        />
        <Stat label="Last 7 days" value={String(s.last7Days)} hint={`${pace.toFixed(1)} tickets a day`} />
        <Stat
          label="Promo codes"
          value={s.orders ? `${Math.round((s.promoOrders / s.orders) * 100)}%` : '—'}
          hint={`${s.promoOrders} of ${s.orders} orders`}
        />
      </div>

      {!data.complete && (
        <p className="muted small">
          Based on the first {data.orders.length} of {data.total} orders.
        </p>
      )}

      {s.orders === 0 ? (
        <p className="muted">No sales yet. Charts and tips appear after the first order.</p>
      ) : (
        <>
          <h3>Tickets sold per day</h3>
          <DailyChart points={s.daily} />

          <div className="insights-grid">
            <div>
              <h3>By day of the week</h3>
              <Bars values={s.byWeekday} labels={WEEKDAYS} />
            </div>
            <div>
              <h3>By time of day</h3>
              <Bars
                values={s.byHour}
                labels={s.byHour.map((_, h) => (h % 6 === 0 ? hourLabel(h) : ''))}
                titles={s.byHour.map((_, h) => hourLabel(h))}
              />
            </div>
          </div>

          <h3>What this tells you</h3>
          {s.orders < EARLY_ORDERS && (
            <p className="muted small">Early data: only {s.orders} orders so far, so these patterns can still change.</p>
          )}
          <ul className="insights-tips">
            {tips(s, remaining, daysLeft, pace, now >= saleEnd).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="org-stat">
      <span className="org-stat-label">{label}</span>
      <strong className="org-stat-value">{value}</strong>
      <span className="org-stat-hint">{hint}</span>
    </div>
  );
}

/** Plain-language findings and what to do with them, from the counts. */
function tips(s: SalesStats, remaining: number, daysLeft: number, pace: number, salesOver: boolean): string[] {
  const days = s.byWeekday.map((n, i) => ({ n, day: DAY_NAMES[i] }));
  const best = days.reduce((a, b) => (b.n > a.n ? b : a));
  const worst = days.reduce((a, b) => (b.n < a.n ? b : a));
  const window = bestWindow(s.byHour);
  const share = (n: number) => Math.round((n / s.tickets) * 100);
  const out = [
    `${best.day} is your best day (${best.n} tickets, ${share(best.n)}% of sales). Post updates and reminders on ${best.day}s and the day before.`,
    `Most tickets sell between ${hourLabel(window.start)} and ${hourLabel(window.start + 3)} (${share(window.tickets)}%). Time announcements and promo codes to go out just before then.`,
  ];
  const quiet = days.filter((d) => d.n === worst.n);
  if (worst.n < best.n && quiet.length === 1) {
    out.push(`${worst.day} is the slowest day (${worst.n} tickets). A ${worst.day}-only promo code can lift it.`);
  } else if (worst.n === 0 && quiet.length > 1) {
    out.push(`No sales yet on ${quiet.map((d) => d.day).join(', ')}. A promo code for those days can spread sales out.`);
  }
  if (s.promoOrders === 0) {
    out.push('No order has used a promo code yet. A limited code for early buyers or groups can bring in more sales.');
  }
  if (salesOver) {
    out.push('Sales are over for this event. Use these patterns to plan the timing of your next one.');
  } else if (remaining > 0) {
    const projected = Math.round(pace * daysLeft);
    out.push(
      pace === 0
        ? `No tickets sold in the last 7 days, with ${remaining} left and ${daysLeft} days of sales to go. A post or a promo code can restart sales.`
        : projected >= remaining
          ? `At the last 7 days' pace (${pace.toFixed(1)} a day) the remaining ${remaining} tickets sell out in about ${Math.ceil(remaining / pace)} days. A higher-priced tier for late buyers could earn more.`
          : `At the last 7 days' pace (${pace.toFixed(1)} a day) about ${projected} of the remaining ${remaining} tickets sell in the ${daysLeft} days left. To sell out you need about ${(remaining / Math.max(1, daysLeft)).toFixed(1)} a day.`,
    );
  }
  return out;
}

const W = 640;
const H = 180;
const PAD = { top: 12, right: 16, bottom: 26, left: 16 };

/** Tickets per day as a line over a soft area; hover or focus a point for its count. */
function DailyChart({ points }: { points: { day: string; tickets: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.tickets));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (n: number) => PAD.top + plotH - (n / max) * plotH;
  const line = points.map((p, i) => `${x(i)},${y(p.tickets)}`).join(' ');
  const area = `${x(0)},${H - PAD.bottom} ${line} ${x(points.length - 1)},${H - PAD.bottom}`;
  const every = Math.max(1, Math.ceil(points.length / 6));
  const label = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return (
    <svg className="insights-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tickets sold per day over ${points.length} days`}>
      <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className="chart-axis" />
      <polygon points={area} className="chart-area" />
      <polyline points={line} className="chart-line" />
      {points.map((p, i) => (
        <g key={p.day}>
          <circle cx={x(i)} cy={y(p.tickets)} r={3.5} className="chart-dot" tabIndex={0}>
            <title>{`${label(p.day)}: ${p.tickets} ${p.tickets === 1 ? 'ticket' : 'tickets'}`}</title>
          </circle>
          {i % every === 0 && (
            <text x={x(i)} y={H - 8} textAnchor="middle" className="chart-label">
              {label(p.day)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** A small bar chart; the highest bar is highlighted. */
function Bars({ values, labels, titles = labels }: { values: number[]; labels: string[]; titles?: string[] }) {
  const w = 320;
  const h = 150;
  const pad = { top: 8, bottom: 22 };
  const max = Math.max(1, ...values);
  const top = Math.max(...values);
  const slot = w / values.length;
  const barW = Math.max(3, slot * 0.7);
  const plotH = h - pad.top - pad.bottom;
  return (
    <svg className="insights-bars" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={titles.map((t, i) => `${t}: ${values[i]}`).join(', ')}>
      <line x1={0} x2={w} y1={h - pad.bottom} y2={h - pad.bottom} className="chart-axis" />
      {values.map((v, i) => {
        const bh = (v / max) * plotH;
        const bx = i * slot + (slot - barW) / 2;
        return (
          <g key={i}>
            <rect
              x={bx}
              y={h - pad.bottom - bh}
              width={barW}
              height={bh}
              rx={2}
              className={`chart-bar${v > 0 && v === top ? ' chart-bar-best' : ''}`}
              tabIndex={0}
            >
              <title>{`${titles[i]}: ${v} ${v === 1 ? 'ticket' : 'tickets'}`}</title>
            </rect>
            {labels[i] && (
              // The first label starts at its bar so it is not cut off at the left edge.
              <text x={i === 0 ? bx : bx + barW / 2} y={h - 6} textAnchor={i === 0 ? "start" : "middle"} className="chart-label">
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
