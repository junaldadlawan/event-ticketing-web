import type { TicketType } from '../api/types';

/**
 * Ticket types in the order the organizer arranged them (`position`, first = 0). Ties (and older data without a
 * position) fall back to oldest first, so a card never jumps after a pause or an edit.
 */
export function sortTicketTypes(list: TicketType[]): TicketType[] {
  return [...list].sort((a, b) => {
    const byPosition = (a.position ?? 0) - (b.position ?? 0);
    if (byPosition !== 0) return byPosition;
    const byDate = (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  });
}
