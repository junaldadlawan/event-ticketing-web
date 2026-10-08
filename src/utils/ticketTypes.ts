import type { TicketType } from '../api/types';

/**
 * Ticket types in a steady order: oldest first. The API returns them in whatever order the database gives, which
 * changes after an update (pausing sales moved a card to the bottom), so the lists sort them themselves.
 */
export function sortTicketTypes(list: TicketType[]): TicketType[] {
  return [...list].sort((a, b) => {
    const byDate = (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  });
}
