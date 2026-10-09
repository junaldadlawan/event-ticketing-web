import type { Money } from '../api/types';

export function formatMoney(m: Money | null | undefined): string {
  if (!m) return '-';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: m.currency }).format(
      m.amount / 100,
    );
  } catch {
    return `${(m.amount / 100).toFixed(2)} ${m.currency}`;
  }
}

export function formatDateTime(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

const clock = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);

/** The full date for a post's tooltip: "October 6, 2026 at 7:34 AM". */
export function formatPostFull(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(d);
  return `${date} at ${clock(d)}`;
}

/**
 * A post's time, friendly while it is new: "Just now", "5 mins ago", "3 hrs ago", "Yesterday", and after that the
 * real date ("October 6 at 7:34 AM", with the year when it is not this year). Times in the future (a scheduled post)
 * show the real date.
 */
export function formatPostTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  if (diffMs >= 0) {
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} ${mins === 1 ? 'min' : 'mins'} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'} ago`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  }
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(d);
  return `${date} at ${clock(d)}`;
}

/** `<input type="datetime-local">` value (local time) -> ISO-8601 instant. */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

export function humanize(enumValue: string): string {
  return enumValue
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** ISO-8601 instant -> `<input type="datetime-local">` value (local time, minutes). */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
