import type { Order } from '../api/types';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_MS = 86_400_000;

/** Orders that count as sales: paid, or paid and partly refunded. */
const SOLD = new Set(['PAID', 'PARTIALLY_REFUNDED']);
/** Tickets that still count once sold (a refunded or cancelled one does not). */
const LIVE_TICKET = (status: string) => status !== 'REFUNDED' && status !== 'CANCELLED';

export interface SalesStats {
  orders: number;
  tickets: number;
  /** Tickets per day in the event's timezone, from the first sale to `until` (every day present, 0 when none). */
  daily: { day: string; tickets: number }[];
  /** Tickets by weekday, Monday first. */
  byWeekday: number[];
  /** Tickets by hour of day (0-23). */
  byHour: number[];
  /** Orders that used a promo code. */
  promoOrders: number;
  /** Tickets sold in the 7 days up to `now`. */
  last7Days: number;
}

/** Calendar day, weekday (0 = Monday) and hour of an instant in a timezone. */
function localParts(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WEEKDAYS.indexOf(get('weekday')),
    hour: Number(get('hour')) % 24,
  };
}

/** "2026-10-15" + n days, as a calendar date (no timezone involved). */
function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Counts an event's sales by day, weekday and hour in the event's own timezone. */
export function salesStats(orders: Order[], timeZone: string, now: number, until: number): SalesStats {
  const perDay = new Map<string, number>();
  const byWeekday = Array(7).fill(0) as number[];
  const byHour = Array(24).fill(0) as number[];
  let sold = 0;
  let tickets = 0;
  let promoOrders = 0;
  let last7Days = 0;
  for (const o of orders) {
    if (!SOLD.has(o.status)) continue;
    const n = o.tickets.filter((t) => LIVE_TICKET(t.status)).length;
    if (n === 0) continue;
    sold++;
    tickets += n;
    if (o.promoCode) promoOrders++;
    const at = localParts(o.createdAt, timeZone);
    perDay.set(at.day, (perDay.get(at.day) ?? 0) + n);
    if (at.weekday >= 0) byWeekday[at.weekday] += n;
    byHour[at.hour] += n;
    if (now - Date.parse(o.createdAt) <= 7 * DAY_MS) last7Days += n;
  }
  const daily: SalesStats['daily'] = [];
  if (perDay.size > 0) {
    const first = [...perDay.keys()].sort()[0];
    const last = localParts(new Date(Math.min(now, until)).toISOString(), timeZone).day;
    // shortcut: at most two years of days, so a bad date can't build a huge chart.
    for (let d = first, i = 0; d <= last && i < 731; d = addDays(d, 1), i++) {
      daily.push({ day: d, tickets: perDay.get(d) ?? 0 });
    }
  }
  return { orders: sold, tickets, daily, byWeekday, byHour, promoOrders, last7Days };
}

/** The 3-hour window (wrapping past midnight) with the most tickets: its first hour, and the tickets in it. */
export function bestWindow(byHour: number[], width = 3): { start: number; tickets: number } {
  let best = { start: 0, tickets: -1 };
  for (let h = 0; h < 24; h++) {
    let sum = 0;
    for (let k = 0; k < width; k++) sum += byHour[(h + k) % 24];
    if (sum > best.tickets) best = { start: h, tickets: sum };
  }
  return best;
}

/** "7 PM" for 19. */
export function hourLabel(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  return `${hh % 12 === 0 ? 12 : hh % 12} ${hh < 12 ? 'AM' : 'PM'}`;
}
