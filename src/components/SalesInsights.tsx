import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { analyticsApi } from '../api/endpoints';
import { RefreshButton } from './RefreshButton';
import { Segmented } from './Segmented';
import type { Event, EventAnalytics, EventAudience, EventFunnel, EventSalesPatterns, ShareTimeline, TicketType } from '../api/types';
import { formatDateTime, formatMoney } from '../utils/format';
import { downloadReportPdf } from '../utils/reportPdf';
import { bestWindow, hourLabel, WEEKDAYS } from '../utils/salesStats';
import { useAsync } from '../utils/useAsync';
import { ErrorBox, Spinner, StatusBadge } from './ui';

/** Below this many orders the patterns are shown but flagged as early. */
const EARLY_ORDERS = 20;
const DAY_MS = 86_400_000;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Tickets sold from 6 days before today through today, with today taken in the event's timezone. */
function last7Days(daily: EventSalesPatterns['daily'], timeZone: string, now: number): number {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * DAY_MS).toISOString().slice(0, 10);
  return daily.filter((d) => d.day >= from && d.day <= today).reduce((n, d) => n + d.tickets, 0);
}

/**
 * Sales statistics for the organizer: tickets per day, the best days of the week and hours, the recent pace and where it
 * leads, and buyers by age, counted by the API in the event's timezone.
 */
export function SalesInsights({ event, ticketTypes }: { event: Event; ticketTypes: TicketType[] }) {
  const patterns = useAsync(() => analyticsApi.eventSalesPatterns(event.id), [event.id]);
  const audience = useAsync(() => analyticsApi.eventAudience(event.id), [event.id]);
  const totals = useAsync(() => analyticsApi.event(event.id), [event.id]);
  const funnel = useAsync(() => analyticsApi.eventFunnel(event.id), [event.id]);
  const timeline = useAsync(() => analyticsApi.eventShareTimeline(event.id), [event.id]);
  // Which group of figures is open below the headline numbers.
  const [tab, setTab] = useState<'sales' | 'funnel' | 'sharing' | 'buyers'>('sales');
  // The report is drawn off screen, then turned into a PDF and downloaded.
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const makePdf = async (el: HTMLElement) => {
    try {
      // A stuck export (blocked fonts or images) must not leave the button waiting for ever.
      await Promise.race([
        downloadReportPdf(el, `${event.title.replace(/[^\w]+/g, '-').toLowerCase()}-report.pdf`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 60_000)),
      ]);
      setPdfError(null);
    } catch {
      setPdfError('Could not make the PDF. Try again.');
    } finally {
      setPdfBusy(false);
    }
  };
  const reloadAll = () => {
    patterns.reload();
    audience.reload();
    totals.reload();
    funnel.reload();
    timeline.reload();
  };
  const s = patterns.data;
  const a = audience.data;
  const f = funnel.data;
  if (patterns.loading && !s) {
    return (
      <section className="card sales-insights">
        <h2>Sales insights</h2>
        <Spinner />
      </section>
    );
  }
  if (patterns.error || !s) {
    return (
      <section className="card sales-insights">
        <h2>
          Sales insights
          <RefreshButton onClick={reloadAll} busy={patterns.loading} label="Reload sales insights" />
        </h2>
        <ErrorBox message={patterns.error ?? 'Could not load the sales figures.'} />
      </section>
    );
  }

  const now = Date.now();
  const end = new Date(event.endAt).getTime();
  const capacity = ticketTypes.reduce((n, t) => n + t.quantityTotal, 0);
  const remaining = ticketTypes.reduce((n, t) => n + t.quantityAvailable, 0);
  const sold = s.tickets;
  const sellThrough = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;
  // Sales stop at the latest ticket type's sale end, and never after the event ends.
  const lastSaleEnd = Math.max(0, ...ticketTypes.map((t) => new Date(t.saleEndAt).getTime()));
  const saleEnd = Math.min(end, lastSaleEnd || end);
  const daysLeft = Math.max(0, Math.ceil((saleEnd - now) / DAY_MS));
  const recent = last7Days(s.daily, event.timezone, now);
  const pace = recent / 7;

  const tabs: { value: typeof tab; label: string }[] = [
    { value: 'sales', label: 'Sales' },
    { value: 'funnel', label: 'Funnel' },
    { value: 'sharing', label: 'Sharing' },
    { value: 'buyers', label: 'Buyers' },
  ];

  return (
    <section className="card sales-insights">
      <div className="row-between">
        <h2>
          Sales insights
          <RefreshButton onClick={reloadAll} busy={patterns.loading || audience.loading || totals.loading || funnel.loading} label="Reload sales insights" />
        </h2>
        <div className="insights-view">
          <span className="muted small">Times in {event.timezone}</span>
          <button type="button" className="btn btn-sm" disabled={pdfBusy} onClick={() => setPdfBusy(true)} title="Download a PDF report of these figures, with the summaries">
            {pdfBusy ? 'Preparing PDF…' : 'Download report'}
          </button>
        </div>
      </div>

      {/* The answer first: how much has sold, and how it is going. */}
      <div className="insight-hero">
        <div className="insight-sold">
          <span className="org-stat-label">Tickets sold</span>
          <strong className="insight-sold-value">
            {sold} <span>of {capacity}</span>
          </strong>
          <div className="insight-bar" role="img" aria-label={`${sellThrough}% of the tickets are sold`}>
            <span style={{ width: `${Math.min(100, sellThrough)}%` }} />
          </div>
          <span className="org-stat-hint">
            {sellThrough}% sold · {remaining} left
          </span>
        </div>
        <div className="insight-side">
          {totals.data && <Stat label="Total sold" value={formatMoney(totals.data.revenue)} hint="What buyers paid, without the platform fee" />}
          <Stat label="Orders" value={String(s.orders)} hint={s.orders ? `${(s.tickets / s.orders).toFixed(1)} tickets per order` : 'None yet'} />
          <Stat label="Last 7 days" value={String(recent)} hint={`${pace.toFixed(1)} tickets a day`} />
        </div>
      </div>

      {s.orders === 0 ? (
        <p className="muted">No sales yet. What it tells you and the charts appear after the first order.</p>
      ) : (
        <div className="insight-tells">
          <h3>What this tells you</h3>
          {s.orders < EARLY_ORDERS && <p className="muted small">Early data: only {s.orders} orders so far, so these can still change.</p>}
          <ul className="insights-tips">
            {tips(s, remaining, daysLeft, pace, now >= saleEnd).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <ErrorBox message={pdfError} />
      {pdfBusy &&
        createPortal(
          <div className="report-offscreen" aria-hidden="true">
            <EventReport event={event} ticketTypes={ticketTypes} bare onReady={makePdf} />
          </div>,
          document.body,
        )}

      <div className="insight-tabs">
        <Segmented text label="Group of figures" value={tab} onChange={setTab} options={tabs} />
      </div>

      {tab === 'sales' && (
        <div className="insight-panel">
          <p className="insight-summary">{salesSummary(s, capacity, sellThrough, recent)}</p>
          {s.orders === 0 ? (
            <p className="muted">Nothing to chart yet.</p>
          ) : (
            <>
              <h3>
                Tickets sold per day
                <RefreshButton onClick={patterns.reload} busy={patterns.loading} label="Reload tickets sold per day" />
              </h3>
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
              <p className="muted small">
                Promo codes were used on {s.promoOrders} of {s.orders} {s.orders === 1 ? 'order' : 'orders'} ({Math.round((s.promoOrders / s.orders) * 100)}%).
              </p>
            </>
          )}
        </div>
      )}

      {tab === 'funnel' && (
        <div className="insight-panel">
          <p className="insight-summary">{f ? funnelSummary(f) : 'Loading the funnel…'}</p>
          <h3>
            From looking to buying
            <RefreshButton onClick={funnel.reload} busy={funnel.loading} label="Reload funnel" />
          </h3>
          <p className="muted small insight-about">How many people saw the event, added tickets to a cart, and checked out.</p>
          <ErrorBox message={funnel.error} />
          {f && <FunnelSteps f={f} />}
        </div>
      )}

      {tab === 'sharing' && (
        <div className="insight-panel">
          {totals.data && <p className="insight-summary">{sharingSummary(totals.data)}</p>}
          <ShareChart timeline={timeline.data} error={timeline.error} loading={timeline.loading} onRefresh={timeline.reload} />
          {totals.data ? <SharingStats a={totals.data} onRefresh={totals.reload} busy={totals.loading} /> : <Spinner />}
        </div>
      )}

      {tab === 'buyers' && (
        <div className="insight-panel">
          <ErrorBox message={audience.error} />
          {a && <p className="insight-summary">{buyersSummary(a)}</p>}
          {a && a.buyers > 0 ? (
            <>
              <h3>
                Buyers by age
                <RefreshButton onClick={audience.reload} busy={audience.loading} label="Reload buyers by age" />
              </h3>
              <BuyersTable a={a} />
            </>
          ) : (
            <p className="muted">No buyers yet.</p>
          )}
        </div>
      )}
    </section>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Sales in one or two sentences: how much, how it is going, when people buy. */
function salesSummary(s: EventSalesPatterns, capacity: number, sellThrough: number, recent: number): string {
  if (s.orders === 0) return 'No tickets sold yet.';
  const days = s.byWeekday.map((n, i) => ({ n, day: DAY_NAMES[i] }));
  const best = days.reduce((a, b) => (b.n > a.n ? b : a));
  const window = bestWindow(s.byHour);
  return `${plural(s.tickets, 'ticket', 'tickets')} sold in ${plural(s.orders, 'order', 'orders')} (${sellThrough}% of ${capacity}). ${
    recent === 0 ? 'None in the last 7 days.' : `${recent} in the last 7 days.`
  } ${best.day} is the best day, and most people buy between ${hourLabel(window.start)} and ${hourLabel(window.start + 3)}.`;
}

/** The funnel in words: how far people get, and where most of them stop. */
function funnelSummary(f: EventFunnel): string {
  const seen = f.uniqueVisitors;
  const carted = f.addToCart.uniqueBuyers;
  const bought = f.checkedOut.uniqueBuyers;
  if (seen === 0) return 'Nobody has been counted looking at this event yet.';
  const head = `Of ${plural(seen, 'person', 'people')} who saw the event, ${carted} added tickets to a cart (${percent(f.viewToCartRate)}) and ${bought} checked out (${percent(f.viewToPurchaseRate)}).`;
  const lostLooking = 1 - carted / seen;
  const lostCart = carted > 0 ? 1 - bought / carted : 0;
  if (lostLooking <= 0 && lostCart <= 0) return head;
  return `${head} Most people stop ${lostLooking >= lostCart ? 'before adding tickets to a cart' : 'between the cart and checking out'}.`;
}

/** Sharing in words: how often it was shared, what came back, and which way works better. */
function sharingSummary(a: EventAnalytics): string {
  const { shareClicks: clicks, shareLinkOpens: links, shareQrScans: scans, shareLinkBuys: linkBuys, shareQrBuys: qrBuys } = a;
  if (clicks == null || links == null || scans == null || linkBuys == null || qrBuys == null) return 'The sharing figures are not available yet.';
  const opens = links + scans;
  if (clicks === 0 && opens === 0) return 'Nobody has shared this event yet.';
  const buys = linkBuys + qrBuys;
  const better = links === scans ? '' : ` ${links > scans ? 'Copied links' : 'QR codes'} bring in more visits.`;
  return `The Share button was pressed ${plural(clicks, 'time', 'times')}. Shared links and QR codes brought ${plural(opens, 'visit', 'visits')} (${links} from copied links, ${scans} from QR codes), and ${buys} of them clicked Buy now.${better}`;
}

/** Buyers in words: how many, and the biggest age group when the API shows one. */
function buyersSummary(a: EventAudience): string {
  if (a.buyers === 0) return 'No buyers yet.';
  const shown = a.ageGroups.filter((g) => g.buyers != null && g.buyers > 0);
  const hidden = a.ageGroups.some((g) => g.buyers === null);
  if (shown.length === 0) {
    return `${plural(a.buyers, 'buyer', 'buyers')} so far. Age groups show once a group has 5 or more buyers, to keep small groups private.`;
  }
  const top = shown.reduce((x, y) => ((y.buyers ?? 0) > (x.buyers ?? 0) ? y : x));
  return `${plural(a.buyers, 'buyer', 'buyers')} in all. The biggest age group is ${top.label} (${top.buyers}).${hidden ? ' Smaller groups are hidden to keep them private.' : ''}`;
}

type ShareMetric = 'chosen' | 'opened' | 'buy';
const METRICS: { value: ShareMetric; label: string; link: keyof ShareTimeline['days'][number]; qr: keyof ShareTimeline['days'][number] }[] = [
  { value: 'opened', label: 'Opened', link: 'linkOpen', qr: 'qrScan' },
  { value: 'chosen', label: 'Chosen in the Share window', link: 'copyLink', qr: 'qrGenerate' },
  { value: 'buy', label: 'Clicked Buy now', link: 'linkBuy', qr: 'qrBuy' },
];

type Row = ShareTimeline['days'][number];
type Series = 'link' | 'qr';
const SERIES: { key: Series; label: string }[] = [
  { key: 'link', label: 'Copied link' },
  { key: 'qr', label: 'QR code' },
];
/** The chart always spans at least a week, so one or two days of activity still draw lines (the earlier days are zeros). */
const MIN_DAYS = 7;

function padDays(days: Row[]): Row[] {
  if (days.length === 0 || days.length >= MIN_DAYS) return days;
  const first = Date.parse(`${days[0]!.day}T00:00:00Z`);
  const before: Row[] = [];
  for (let i = MIN_DAYS - days.length; i >= 1; i--) {
    before.push({ day: new Date(first - i * DAY_MS).toISOString().slice(0, 10), shareButton: 0, copyLink: 0, qrGenerate: 0, linkOpen: 0, qrScan: 0, linkBuy: 0, qrBuy: 0 });
  }
  return [...before, ...days];
}

const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** The copied link and the QR code per day as two lines, for the action chosen above; click a name in the legend to hide its line. */
function ShareChart({
  timeline,
  error,
  loading,
  onRefresh,
}: {
  timeline: ShareTimeline | null | undefined;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [metric, setMetric] = useState<ShareMetric>('opened');
  const [view, setView] = useState<'time' | 'weekday' | 'hour'>('time');
  const [hidden, setHidden] = useState<Set<Series>>(new Set());
  // Shown for a few seconds when someone tries to hide the only line that is on.
  const [lastLineNotice, setLastLineNotice] = useState(false);
  useEffect(() => {
    if (!lastLineNotice) return;
    const t = setTimeout(() => setLastLineNotice(false), 4000);
    return () => clearTimeout(t);
  }, [lastLineNotice]);
  const m = METRICS.find((x) => x.value === metric)!;
  const toggle = (k: Series) => {
    const next = new Set(hidden);
    if (next.has(k)) next.delete(k);
    else if (next.size < SERIES.length - 1) next.add(k);
    else {
      setLastLineNotice(true); // one line always stays on
      return;
    }
    setLastLineNotice(false);
    setHidden(next);
  };
  const realDays = timeline?.days ?? [];
  const days = padDays(realDays);
  const values: Record<Series, number[]> = { link: days.map((d) => d[m.link] as number), qr: days.map((d) => d[m.qr] as number) };
  const totals: Record<Series, number> = { link: values.link.reduce((n, v) => n + v, 0), qr: values.qr.reduce((n, v) => n + v, 0) };
  const shown = SERIES.filter((x) => !hidden.has(x.key));
  const max = Math.max(1, ...shown.flatMap((x) => values[x.key]));
  const plotW = W - PAD.left - PAD.right - 12;
  const plotH = H - PAD.top - PAD.bottom;
  const left = PAD.left + 12;
  const x = (i: number) => left + (days.length === 1 ? plotW / 2 : (i / Math.max(1, days.length - 1)) * plotW);
  const y = (n: number) => PAD.top + plotH - (n / max) * plotH;
  const every = Math.max(1, Math.ceil(days.length / 6));
  const points = (v: number[]) => v.map((n, i) => `${x(i)},${y(n)}`).join(' ');
  const empty = totals.link + totals.qr === 0;
  return (
    <div className="share-chart">
      <div className="share-chart-head">
        <h3>
          Over time
          <RefreshButton onClick={onRefresh} busy={loading} label="Reload the chart" />
        </h3>
        <Segmented text label="What the lines count" value={metric} onChange={setMetric} options={METRICS.map((x) => ({ value: x.value, label: x.label }))} />
      </div>
      <ErrorBox message={error} />
      {timeline && (
        <div className="share-chart-view">
          <Segmented
            text
            label="Chart"
            value={view}
            onChange={setView}
            options={[
              { value: 'time', label: 'Over time' },
              { value: 'weekday', label: 'Average by day of the week' },
              { value: 'hour', label: 'Average by hour of the day' },
            ]}
          />
        </div>
      )}
      {timeline && (
        <>
          <ul className="chart-legend">
            {SERIES.map((x) => (
              <li key={x.key}>
                <button
                  type="button"
                  className={`legend-toggle${hidden.has(x.key) ? ' is-off' : ''}`}
                  aria-pressed={!hidden.has(x.key)}
                  onClick={() => toggle(x.key)}
                  title={hidden.has(x.key) ? `Show ${x.label}` : shown.length === 1 ? 'At least one line stays on' : `Hide ${x.label}`}
                >
                  <span className={`legend-dot legend-${x.key}`} /> {x.label} <strong>{totals[x.key]}</strong>
                </button>
              </li>
            ))}
          </ul>
          {lastLineNotice && (
            <p className="share-message share-notice" role="status">
              One line has to stay on. Show the other line first if you want to hide this one.
            </p>
          )}
          {empty ? (
            <p className="muted">
              Nothing here yet for this action.{timeline.trackingSince ? ` Counting began on ${shortDay(timeline.trackingSince)}.` : ' Counting starts with the first share.'}
            </p>
          ) : (
            <>
              {view === 'time' && (
                <>
                  <svg className="insights-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${m.label} per day: ${totals.link} from copied links, ${totals.qr} from QR codes`}>
                    {[0, max].map((t) => (
                      <g key={t}>
                        <line x1={left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-axis" />
                        <text x={left - 6} y={y(t) + 4} textAnchor="end" className="chart-label">
                          {t}
                        </text>
                      </g>
                    ))}
                    {shown.map((sr) => (
                      <polyline key={sr.key} points={points(values[sr.key])} className={`chart-line chart-line-${sr.key}`} />
                    ))}
                    {days.map((d, i) => (
                      <g key={d.day}>
                        {shown.map((sr) => (
                          <circle key={sr.key} cx={x(i)} cy={y(values[sr.key][i]!)} r={values[sr.key][i]! > 0 ? 4.5 : 3} className={`chart-dot chart-dot-${sr.key}`} tabIndex={0}>
                            <title>{`${shortDay(d.day)}: ${values.link[i]} from copied links, ${values.qr[i]} from QR codes`}</title>
                          </circle>
                        ))}
                        {i % every === 0 && (
                          <text x={x(i)} y={H - 8} textAnchor="middle" className="chart-label">
                            {shortDay(d.day)}
                          </text>
                        )}
                      </g>
                    ))}
                  </svg>
                  <p className="muted small">
                    Days in {timeline.timezone}.{timeline.trackingSince ? ` Counted since ${shortDay(timeline.trackingSince)}; earlier days are not recorded.` : ''}
                  </p>
                </>
              )}
              {view === 'weekday' && <ShareBars title="Average per day of the week" labels={WEEKDAYS} {...weekdayAverages(realDays, m)} hidden={hidden} unit="a day" />}
              {view === 'hour' && !timeline.byHour && (
                <p className="muted">The API did not send hourly figures. Update or restart the API to see the average by hour of the day.</p>
              )}
              {view === 'hour' && timeline.byHour && (
                <ShareBars
                  title="Average per hour of the day"
                  labels={timeline.byHour.map((h) => (h.hour % 3 === 0 ? hourLabel(h.hour) : ''))}
                  {...hourAverages(timeline.byHour, realDays.length, m)}
                  hidden={hidden}
                  unit="a day"
                  hourTitles={timeline.byHour.map((h) => hourLabel(h.hour))}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Average per day of the week: the total for each weekday divided by how many of that weekday are in the counted days. */
function weekdayAverages(days: Row[], m: (typeof METRICS)[number]) {
  const sum = { link: Array(7).fill(0) as number[], qr: Array(7).fill(0) as number[] };
  const count = Array(7).fill(0) as number[];
  for (const d of days) {
    const i = (new Date(`${d.day}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    count[i]! += 1;
    sum.link[i]! += d[m.link] as number;
    sum.qr[i]! += d[m.qr] as number;
  }
  const avg = (v: number[]) => v.map((n, i) => (count[i]! > 0 ? n / count[i]! : 0));
  return { link: avg(sum.link), qr: avg(sum.qr) };
}

/** Average per hour of the day: each hour's total divided by the number of counted days. */
function hourAverages(byHour: NonNullable<ShareTimeline['byHour']>, dayCount: number, m: (typeof METRICS)[number]) {
  const n = Math.max(1, dayCount);
  return { link: byHour.map((h) => (h[m.link as 'copyLink'] as number) / n), qr: byHour.map((h) => (h[m.qr as 'qrGenerate'] as number) / n) };
}

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString();

/** Two bars per slot (copied link, QR code): used for the day-of-the-week and the hour-of-the-day averages. */
function ShareBars({
  title,
  labels,
  link,
  qr,
  hidden,
  unit,
  hourTitles,
}: {
  title: string;
  labels: string[];
  link: number[];
  qr: number[];
  hidden: Set<Series>;
  unit: string;
  hourTitles?: string[];
}) {
  const values = { link, qr };
  const shown = SERIES.filter((x) => !hidden.has(x.key));
  const max = Math.max(0.1, ...shown.flatMap((x) => values[x.key]));
  const w = 640;
  const h = 160;
  const pad = { top: 16, bottom: 22 };
  const slot = w / labels.length;
  const barW = Math.min(26, (slot * 0.9) / Math.max(1, shown.length));
  const plotH = h - pad.top - pad.bottom;
  const name = (i: number) => hourTitles?.[i] ?? labels[i];
  return (
    <>
      <h3>{title}</h3>
      <svg className="insights-bars share-weekdays" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={labels.map((_, i) => `${name(i)}: ${oneDecimal(link[i]!)} copied link, ${oneDecimal(qr[i]!)} QR code`).join(', ')}>
        <text x={0} y={pad.top - 4} className="chart-label">
          {oneDecimal(max)} {unit}
        </text>
        <line x1={0} x2={w} y1={h - pad.bottom} y2={h - pad.bottom} className="chart-axis" />
        {labels.map((label, i) => (
          <g key={i}>
            {shown.map((sr, j) => {
              const bh = (values[sr.key][i]! / max) * plotH;
              const bx = i * slot + slot / 2 - (shown.length * barW) / 2 + j * barW;
              return (
                <rect key={sr.key} x={bx} y={h - pad.bottom - bh} width={Math.max(2, barW - 2)} height={bh} rx={2} className={`share-bar share-bar-${sr.key}`} tabIndex={0}>
                  <title>{`${name(i)}: ${oneDecimal(values[sr.key][i]!)} ${unit} from ${sr.key === 'link' ? 'copied links' : 'QR codes'}`}</title>
                </rect>
              );
            })}
            {label && (
              <text x={i * slot + slot / 2} y={h - 6} textAnchor="middle" className="chart-label">
                {label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="muted small">Average over the days counted so far, in the event's time zone.</p>
    </>
  );
}

/** Buyers by age group, with the one-line note under it. */
function BuyersTable({ a }: { a: EventAudience }) {
  return (
    <>
      <table className="share-table age-table">
        <thead>
          <tr>
            <th scope="col">Age</th>
            <th scope="col">Buyers</th>
            <th scope="col">Tickets</th>
          </tr>
        </thead>
        <tbody>
          {a.ageGroups.map((g) => (
            <tr key={g.label}>
              <th scope="row">{g.label}</th>
              {g.buyers === null ? (
                <td colSpan={2} className="muted">
                  Hidden
                </td>
              ) : (
                <>
                  <td>{g.buyers}</td>
                  <td>{g.tickets}</td>
                </>
              )}
            </tr>
          ))}
          {a.unknownAge > 0 && (
            <tr>
              <th scope="row">Unknown</th>
              <td>{a.unknownAge}</td>
              <td className="muted">—</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="muted small">
        {a.buyers} {a.buyers === 1 ? 'buyer' : 'buyers'} in total, grouped by age at their first order for this event.
        {a.ageGroups.some((g) => g.buyers === null) && ' Groups with fewer than 5 buyers are hidden to keep them private.'}
      </p>
    </>
  );
}

/** The funnel as three bars, widest first, with how many of the people who looked reached each step. */
function FunnelSteps({ f }: { f: EventFunnel }) {
  const steps = [
    { label: 'Saw the event', people: f.uniqueVisitors, note: `${f.views} views in all` },
    { label: 'Added to a cart', people: f.addToCart.uniqueBuyers, note: `${f.addToCart.quantity} tickets`, rate: f.viewToCartRate },
    { label: 'Checked out', people: f.checkedOut.uniqueBuyers, note: `${f.checkedOut.quantity} tickets`, rate: f.viewToPurchaseRate },
  ];
  const top = Math.max(1, ...steps.map((x) => x.people));
  return (
    <>
      <ol className="funnel-steps">
        {steps.map((x) => (
          <li key={x.label}>
            <div className="funnel-label">
              <strong>{x.label}</strong>
              <span className="muted small">{x.note}</span>
            </div>
            <div className="funnel-track">
              <span style={{ width: `${Math.max(2, Math.round((x.people / top) * 100))}%` }} />
            </div>
            <div className="funnel-number">
              <strong>{x.people}</strong>
              <span className="muted small">{x.rate === undefined ? 'people' : `${percent(x.rate)} of visitors`}</span>
            </div>
          </li>
        ))}
      </ol>
      {f.ticketTypes.length > 0 && (
        <>
          <h3>By ticket type</h3>
          <table className="share-table age-table funnel-table">
            <thead>
              <tr>
                <th scope="col">Ticket</th>
                <th scope="col">Added</th>
                <th scope="col">Bought</th>
                <th scope="col">Removed</th>
                <th scope="col">Expired</th>
                <th scope="col">Bought of added</th>
              </tr>
            </thead>
            <tbody>
              {f.ticketTypes.map((t) => (
                <tr key={t.ticketTypeId}>
                  <th scope="row">{t.name}</th>
                  <td>{t.addedQuantity}</td>
                  <td>{t.checkedOutQuantity}</td>
                  <td>{t.removedQuantity}</td>
                  <td>{t.expiredQuantity}</td>
                  <td>{percent(t.cartConversionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p className="muted small">
        {f.trackingSince && `Counted since ${formatDateTime(f.trackingSince, f.timezone)}. `}Days in {f.timezone}.
      </p>
    </>
  );
}

/** 0.25 as "25%"; "—" when there is no rate. */
const percent = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

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
function tips(
  s: Pick<EventSalesPatterns, 'tickets' | 'promoOrders' | 'byWeekday' | 'byHour'>,
  remaining: number,
  daysLeft: number,
  pace: number,
  salesOver: boolean,
): string[] {
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

/** How the event was shared and what came of it, in one small table: the two ways to share side by side. A dash, not a zero, when the API did not send a figure. */
function SharingStats({ a, onRefresh, busy = false }: { a: EventAnalytics; onRefresh?: () => void; busy?: boolean }) {
  const n = (v: number | undefined) => (v == null ? '—' : String(v));
  // "2 of 3 opens" as a share, so it is clear how many of the people who opened it went on to buy.
  const rate = (buys: number | undefined, opens: number | undefined) =>
    buys == null || opens == null || opens === 0 ? null : `${Math.round((buys / opens) * 100)}% of opens`;
  const rows: { label: string; link: number | undefined; qr: number | undefined; note?: [string | null, string | null] }[] = [
    { label: 'Chosen in the Share window', link: a.shareCopies, qr: a.shareQrs },
    { label: 'Opened', link: a.shareLinkOpens, qr: a.shareQrScans },
    {
      label: 'Clicked Buy now',
      link: a.shareLinkBuys,
      qr: a.shareQrBuys,
      note: [rate(a.shareLinkBuys, a.shareLinkOpens), rate(a.shareQrBuys, a.shareQrScans)],
    },
  ];
  return (
    <>
      <h3>
        Sharing
        {onRefresh && <RefreshButton onClick={onRefresh} busy={busy} label="Reload sharing figures" />}
      </h3>
      <p className="muted small share-intro">
        People who shared this event, how many opened it, and how many then clicked Buy now. The Share button was pressed{' '}
        <strong>{n(a.shareClicks)}</strong> {a.shareClicks === 1 ? 'time' : 'times'}.
      </p>
      <table className="share-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Step</span>
            </th>
            <th scope="col">Copied link</th>
            <th scope="col">QR code</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>
                <strong>{n(r.link)}</strong>
                {r.note?.[0] && <span className="muted small">{r.note[0]}</span>}
              </td>
              <td>
                <strong>{n(r.qr)}</strong>
                {r.note?.[1] && <span className="muted small">{r.note[1]}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** A printable report of the event's figures: the headline numbers, what they tell you, and the Sales, Funnel, Sharing and Buyers summaries with their tables and charts. */
export function EventReport({ event, ticketTypes, bare = false, onReady }: { event: Event; ticketTypes: TicketType[]; bare?: boolean; onReady?: (el: HTMLElement) => void }) {
  const patterns = useAsync(() => analyticsApi.eventSalesPatterns(event.id), [event.id]);
  const audience = useAsync(() => analyticsApi.eventAudience(event.id), [event.id]);
  const totals = useAsync(() => analyticsApi.event(event.id), [event.id]);
  const funnel = useAsync(() => analyticsApi.eventFunnel(event.id), [event.id]);
  const s = patterns.data;
  const a = audience.data;
  const f = funnel.data;
  const t = totals.data;
  const generated = new Date().toLocaleString();
  const article = useRef<HTMLElement>(null);
  const done = useRef(false);
  const ready = !((patterns.loading && !s) || (audience.loading && !a) || (totals.loading && !t) || (funnel.loading && !f)) && Boolean(s);
  const callback = useRef(onReady);
  callback.current = onReady;
  useEffect(() => {
    if (!ready) return;
    // let the charts and fonts settle for a moment before they are captured
    const timer = setTimeout(() => {
      if (done.current || !article.current) return;
      done.current = true;
      callback.current?.(article.current);
    }, 400);
    return () => clearTimeout(timer);
  }, [ready]);
  if ((patterns.loading && !s) || (audience.loading && !a) || (totals.loading && !t) || (funnel.loading && !f)) return <Spinner label="Preparing the report..." />;
  if (patterns.error || !s) return <ErrorBox message={patterns.error ?? 'Could not load the sales figures for the report.'} />;

  const now = Date.now();
  const end = new Date(event.endAt).getTime();
  const capacity = ticketTypes.reduce((n, x) => n + x.quantityTotal, 0);
  const remaining = ticketTypes.reduce((n, x) => n + x.quantityAvailable, 0);
  const sold = s.tickets;
  const sellThrough = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;
  const lastSaleEnd = Math.max(0, ...ticketTypes.map((x) => new Date(x.saleEndAt).getTime()));
  const saleEnd = Math.min(end, lastSaleEnd || end);
  const daysLeft = Math.max(0, Math.ceil((saleEnd - now) / DAY_MS));
  const recent = last7Days(s.daily, event.timezone, now);
  const pace = recent / 7;

  return (
    <article className="report" ref={article}>
      {!bare && (
      <div className="report-actions">
        <button type="button" className="btn btn-cta" onClick={() => window.print()}>
          Print or save as PDF
        </button>
        <span className="muted small">In the print window choose "Save as PDF" as the printer to keep a copy.</span>
      </div>
      )}

      <header className="report-head">
        <p className="muted">eventKo · Event report</p>
        <h1>{event.title}</h1>
        <p>
          {formatDateTime(event.startAt, event.timezone)} to {formatDateTime(event.endAt, event.timezone)} · {event.venue ? event.venue.name : 'Online'}{' '}
          <StatusBadge status={event.status} />
        </p>
        <p className="muted small">
          Prepared {generated}. Times in {event.timezone}.
        </p>
      </header>

      <section className="report-section">
        <h2>At a glance</h2>
        <div className="org-stats insights-stats">
          <Stat label="Tickets sold" value={`${sold} of ${capacity}`} hint={`${sellThrough}% sold, ${remaining} left`} />
          {t && <Stat label="Total sold" value={formatMoney(t.revenue)} hint="What buyers paid, without the platform fee" />}
          <Stat label="Orders" value={String(s.orders)} hint={s.orders ? `${(s.tickets / s.orders).toFixed(1)} tickets per order` : 'None yet'} />
          <Stat label="Last 7 days" value={String(recent)} hint={`${pace.toFixed(1)} tickets a day`} />
        </div>
        {s.orders > 0 && (
          <>
            <h3>What this tells you</h3>
            {s.orders < EARLY_ORDERS && <p className="muted small">Early data: only {s.orders} orders so far, so these can still change.</p>}
            <ul className="insights-tips">
              {tips(s, remaining, daysLeft, pace, now >= saleEnd).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="report-section">
        <h2>Sales</h2>
        <p className="insight-summary">{salesSummary(s, capacity, sellThrough, recent)}</p>
        {s.orders > 0 && (
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
                <Bars values={s.byHour} labels={s.byHour.map((_, h) => (h % 6 === 0 ? hourLabel(h) : ''))} titles={s.byHour.map((_, h) => hourLabel(h))} />
              </div>
            </div>
            <p className="muted small">
              Promo codes were used on {s.promoOrders} of {s.orders} {s.orders === 1 ? 'order' : 'orders'} ({Math.round((s.promoOrders / s.orders) * 100)}%).
            </p>
          </>
        )}
      </section>

      {f && (
        <section className="report-section">
          <h2>Funnel</h2>
          <p className="insight-summary">{funnelSummary(f)}</p>
          <FunnelSteps f={f} />
        </section>
      )}

      {t && (
        <section className="report-section">
          <h2>Sharing</h2>
          <p className="insight-summary">{sharingSummary(t)}</p>
          <SharingStats a={t} />
        </section>
      )}

      {a && (
        <section className="report-section">
          <h2>Buyers</h2>
          <p className="insight-summary">{buyersSummary(a)}</p>
          {a.buyers > 0 && <BuyersTable a={a} />}
        </section>
      )}
    </article>
  );
}
