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
