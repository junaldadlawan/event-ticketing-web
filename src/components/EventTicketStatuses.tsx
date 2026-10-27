import { ticketTypeApi } from '../api/endpoints';
import type { Event } from '../api/types';
import { isEventOver } from '../utils/eventState';
import { sortTicketTypes, ticketStatus } from '../utils/ticketTypes';
import { useAsync } from '../utils/useAsync';

/** An event's ticket types, each with where it is in its life (on sale, paused, suspended, sold out...). */
export function EventTicketStatuses({ event }: { event: Event }) {
  const { data, error } = useAsync(() => ticketTypeApi.list(event.id), [event.id]);
  if (error) return <span className="muted small">Tickets could not be loaded</span>;
  if (!data) return <span className="muted small">Loading tickets…</span>;
  if (data.length === 0) return <span className="muted small">No ticket types</span>;
  const over = isEventOver(event);
  return (
    <span className="ticket-status-line">
      {sortTicketTypes(data).map((tt) => {
        const s = ticketStatus(tt, over);
        return (
          <span key={tt.id} className="ticket-status-item">
            {tt.name}
            <span className={`status-chip status-${s.tone}`}>{s.label}</span>
          </span>
        );
      })}
    </span>
  );
}
