import type { Event } from '../api/types';

/** Statuses of an event buyers can see and that is not stopped (cancelled, suspended). */
export const LIVE_STATUSES = ['PUBLISHED', 'ON_SALE', 'SOLD_OUT'];

/**
 * True once the event is done, by the API's own rule (BR-EVENT-005): it is COMPLETED, or a live event's end time
 * has passed. The API completes ended events every minute and on reads, so the end-time check only covers a list
 * fetched before the next sweep; the API already refuses writes (409 "Event has ended") from the end time on.
 */
export function isEventOver(event: Pick<Event, 'status' | 'endAt'>, now = Date.now()): boolean {
  return (
    event.status === 'COMPLETED' ||
    (LIVE_STATUSES.includes(event.status) && new Date(event.endAt).getTime() <= now)
  );
}

const SOON_MS = 24 * 60 * 60 * 1000;
const SHAKE_MS = 3 * 60 * 60 * 1000;

/**
 * The countdown for a live event that starts within a day ("5h 12m", then "12m 05s" in the last hour), and whether it
 * is close enough (3 hours) for the card to shake. Null for anything else (started, over, or further off).
 */
export function startsSoonIn(
  event: Pick<Event, 'status' | 'startAt'>,
  now = Date.now(),
): { left: string; shake: boolean } | null {
  const ms = new Date(event.startAt).getTime() - now;
  if (!LIVE_STATUSES.includes(event.status) || ms <= 0 || ms > SOON_MS) return null;
  const s = Math.ceil(ms / 1000);
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const left = h > 0 ? `${h}h ${m}m` : `${m}m ${String(sec).padStart(2, '0')}s`;
  return { left, shake: ms <= SHAKE_MS };
}

/** A live event that has started and not ended yet. */
export function isOngoing(event: Pick<Event, 'status' | 'startAt' | 'endAt'>, now = Date.now()): boolean {
  return LIVE_STATUSES.includes(event.status) && new Date(event.startAt).getTime() <= now && now < new Date(event.endAt).getTime();
}

/** "2h 5m" / "45m" for a length of time. */
export function formatDuration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`;
}

/** "5h 12m": how long until an unpublished draft is deleted, once that is 24 hours or less away (null before then, or when the rule is off). */
export function draftDeletesIn(event: Pick<Event, 'autoDeleteAt'>, now = Date.now()): string | null {
  if (!event.autoDeleteAt) return null;
  const ms = new Date(event.autoDeleteAt).getTime() - now;
  return ms > SOON_MS ? null : formatDuration(Math.max(ms, 0));
}
