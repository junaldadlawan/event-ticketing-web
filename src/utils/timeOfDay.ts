import type { Event } from '../api/types';

/** Daytime events (6 AM to 5:59 PM where the event is) get a sun, the rest a moon. */
export function isDaytime(event: Pick<Event, 'startAt' | 'timezone'>): boolean {
  const start = new Date(event.startAt);
  let hour = start.getHours();
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: event.timezone }).format(start),
    );
  } catch {
    /* an unknown time zone name: use the visitor's own clock */
  }
  return hour >= 6 && hour < 18;
}
