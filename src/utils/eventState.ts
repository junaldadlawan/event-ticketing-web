import type { Event } from '../api/types';

/** Statuses of an event buyers can see and that is not stopped (cancelled, suspended). */
export const LIVE_STATUSES = ['PUBLISHED', 'ON_SALE', 'SOLD_OUT'];

/**
 * True once the event is done: the API marked it COMPLETED, or a live event's end time has passed
 * (the API does not set COMPLETED on its own yet, so the end time is the reliable signal).
 */
export function isEventOver(event: Pick<Event, 'status' | 'endAt'>, now = Date.now()): boolean {
  return (
    event.status === 'COMPLETED' ||
    (LIVE_STATUSES.includes(event.status) && new Date(event.endAt).getTime() < now)
  );
}
