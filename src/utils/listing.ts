import { ticketTypeApi } from '../api/endpoints';
import type { Event, TicketType } from '../api/types';
import { saleState } from '../pages/EventLandingPage';
import { isEventOver } from './eventState';

/** An event with the ticket types that can be bought right now. */
export interface WithLive {
  event: Event;
  live: TicketType[];
}

/** Each event with its ticket types on sale now (an event whose types can't be read counts as having none). */
export function withLiveTypes(events: Event[]): Promise<WithLive[]> {
  const now = Date.now();
  return Promise.all(
    events.map(async (event) => {
      const types = await ticketTypeApi.list(event.id).catch(() => [] as TicketType[]);
      return { event, live: types.filter((tt) => saleState(tt, now, isEventOver(event, now)) === 'live') };
    }),
  );
}

/** The lowest-priced of some ticket types. */
export const cheapest = (live: TicketType[]) => live.reduce((a, b) => (b.price.amount < a.price.amount ? b : a));
