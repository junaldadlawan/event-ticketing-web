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
