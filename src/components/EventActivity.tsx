import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { eventApi } from '../api/endpoints';
import type { EventActivityEntry, PageResponse, TicketType } from '../api/types';
import { changeLines } from '../utils/activityDetails';
import { formatDateTime, formatMoney, humanize } from '../utils/format';
import { ErrorBox, Spinner } from './ui';

const PAGE_SIZE = 20;

/** What each logged action did, in words ("paused sales of", then the ticket type's name when it is known). */
const ACTIONS: Record<string, string> = {
  'event.created': 'created the event',
  'event.updated': 'edited the event details',
  'event.published': 'published the event',
  'event.cancelled': 'cancelled the event',
  'event.deleted': 'deleted the event',
  'event.auto_deleted_unpublished': 'deleted the draft because it was not published in time',
  'event.completed': 'marked the event completed after it ended',
  'ticket_type.created': 'added the ticket type',
  'ticket_type.updated': 'edited the ticket type',
  'ticket_type.reordered': 'rearranged the ticket types',
  'ticket_type.sales_paused': 'paused sales of',
  'ticket_type.sales_resumed': 'resumed sales of',
  'ticket_type.deleted': 'deleted a ticket type',
  'promo_code.created': 'added a promo code',
  'promo_code.updated': 'edited a promo code',
  'promo_code.paused': 'paused a promo code',
  'promo_code.resumed': 'resumed a promo code',
  'promo_code.deleted': 'deleted a promo code',
  'ticket_template.created': 'saved a new ticket design',
  'ticket_template.updated': 'updated a ticket design',
  'ticket_template.deleted': 'deleted a ticket design',
  'refund_policy.updated': 'changed the refund policy',
  'resale_policy.updated': 'changed the resale policy',
  'check_in_config.updated': 'changed the check-in settings',
  'scanner_device.authorized': 'authorized a scanner device',
  'scanner_device.revoked': 'revoked a scanner device',
  'refund.issued': 'issued a refund',
  // Team and organization
  'organization.applied': 'applied to host events',
  'organization.approved': 'approved the organization',
  'organization.rejected': 'rejected the organization',
  'organization.updated': 'edited the organization details',
  'organization_member.assigned': 'gave someone a team role',
  // Money
  'payout.generated': 'generated a payout',
  'payout.cancelled': 'cancelled a payout',
  'payout_account.set': 'set the payout account',
  'payout_account.removed': 'removed the payout account',
  'payout_card.added': 'added a payout card',
  'payout_card.primary_set': 'changed the primary payout card',
  'payout_card.removed': 'removed a payout card',
  'platform_fee.set': 'changed the platform fee',
  'platform_fee.removed': 'removed the platform fee',
  'gateway_fee.set': 'changed the payment gateway fee',
  // Platform
  'post.created': 'created a post',
  'post.updated': 'edited a post',
  'post.deleted': 'deleted a post',
  'category.created': 'added a category',
  'category.updated': 'edited a category',
  'category.deactivated': 'deactivated a category',
  'dispute.raised': 'opened a dispute',
  'dispute.updated': 'updated a dispute',
  'dispute.resolved': 'resolved a dispute',
  'dispute.dismissed': 'dismissed a dispute',
  'user.registered': 'signed up',
  'user.deleted': 'deleted an account',
  'user.password_changed': 'changed their password',
};

/** Moderation verbs; the target (event, organization, user, post) comes from the entry. */
const MODERATION: Record<string, string> = {
  'moderation.suspend': 'suspended',
  'moderation.reinstate': 'reinstated',
  'moderation.remove': 'took down',
};
const TARGET_WORDS: Record<string, string> = { Event: 'event', Organization: 'organization', User: 'user', Post: 'post' };

/** With a name, these read e.g. "deleted ticket type “VIP”" instead of "deleted a ticket type". */
const NAMED: Record<string, string> = {
  'ticket_type.created': 'added ticket type',
  'ticket_type.updated': 'edited ticket type',
  'ticket_type.sales_paused': 'paused sales of',
  'ticket_type.sales_resumed': 'resumed sales of',
  'ticket_type.deleted': 'deleted ticket type',
  'promo_code.created': 'added promo code',
  'promo_code.updated': 'edited promo code',
  'promo_code.paused': 'paused promo code',
  'promo_code.resumed': 'resumed promo code',
  'promo_code.deleted': 'deleted promo code',
  'ticket_template.created': 'saved a new ticket design for',
  'ticket_template.deleted': 'deleted the ticket design for',
  'scanner_device.authorized': 'authorized scanner device',
  'scanner_device.revoked': 'revoked scanner device',
  'organization.applied': 'applied to host events as',
  'organization.approved': 'approved the organization',
  'organization.rejected': 'rejected the organization',
  'organization_member.assigned': 'gave a team role to',
  'payout.generated': 'generated a payout for',
  'payout.cancelled': 'cancelled the payout for',
  'payout_card.added': 'added payout card',
  'payout_card.primary_set': 'made the primary payout card',
  'payout_card.removed': 'removed payout card',
  'payout_account.set': 'set the payout account to',
  'post.created': 'created post',
  'post.updated': 'edited post',
  'post.deleted': 'deleted post',
  'category.created': 'added category',
  'category.updated': 'edited category',
  'category.deactivated': 'deactivated category',
};

function describe(entry: EventActivityEntry, typeNames: Map<string, string>): string {
  if (MODERATION[entry.action]) {
    const target = TARGET_WORDS[entry.targetType ?? ''] ?? 'item';
    return `${MODERATION[entry.action]} the ${target}${entry.details?.name ? ` “${entry.details.name}”` : ''}`;
  }
  const what = ACTIONS[entry.action] ?? humanize(entry.action.replace(/[._]/g, ' ')).toLowerCase();
  const name =
    entry.details?.name ?? (entry.targetType === 'TicketType' && entry.targetId ? typeNames.get(entry.targetId) : undefined);
  if (name && NAMED[entry.action]) return `${NAMED[entry.action]} “${name}”`;
  if (entry.action.startsWith('ticket_type.sales_')) return what.replace(/ of$/, ' of a ticket type');
  return what;
}

/** The lines under an entry: what changed, the new order, a refund's amount, a reason. */
function detailLines(entry: EventActivityEntry, timezone: string): string[] {
  const d = entry.details;
  if (!d) return [];
  const lines = changeLines(d, timezone);
  if (d.order?.length) lines.push(`New order: ${d.order.join(', ')}`);
  if (d.amount) lines.push(`Amount: ${formatMoney(d.amount)}${d.orderId ? ` · order ${d.orderId.slice(0, 8)}` : ''}`);
  if (d.reason) lines.push(`Reason: “${d.reason}”`);
  const roles = d.roles ?? (d.role ? [d.role] : []);
  if (roles.length) lines.push(`Role: ${roles.map((r) => humanize(r)).join(', ')}`);
  return lines;
}

/** The event's activity history (BR-EVENT-006); the system's own changes (e.g. completing it) show as "System". */
export function EventActivity({ eventId, timezone, ticketTypes }: { eventId: string; timezone: string; ticketTypes: TicketType[] }) {
  return (
    <ActivityList
      key={eventId}
      load={(page, size) => eventApi.activity(eventId, { page, size })}
      timezone={timezone}
      ticketTypes={ticketTypes}
    />
  );
}

/**
 * A log of who changed what, newest first, 20 at a time with "Show more". `load` fetches one page; give the
 * component a new `key` to start over from another source.
 */
export function ActivityList({
  load,
  timezone,
  ticketTypes = [],
  showEventTitle = false,
}: {
  load: (page: number, size: number) => Promise<PageResponse<EventActivityEntry>>;
  /** Times in this timezone (an event's); the browser's own when not given. */
  timezone?: string;
  ticketTypes?: TicketType[];
  /** Name the event on each entry (a log that spans several events). */
  showEventTitle?: boolean;
}) {
  const [entries, setEntries] = useState<EventActivityEntry[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load(page, PAGE_SIZE)
      .then((res) => {
        if (cancelled) return;
        setEntries((list) => (page === 0 ? res.content : [...list, ...res.content]));
        setHasMore(!res.last);
        setTotal(res.totalElements);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // load is a new function each render; the parent's key starts a new log.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const typeNames = new Map(ticketTypes.map((t) => [t.id, t.name]));

  return (
    <section className="event-activity">
      {/* The window around it carries the title. */}
      {total !== null && total > 0 && <p className="muted small">{total} {total === 1 ? 'change' : 'changes'}, newest first</p>}
      <ErrorBox message={error} />
      {entries.length > 0 && (
        <ol className="activity-list">
          {entries.map((e) => (
            <li key={e.id}>
              <div className="activity-what">
                <span>
                  <strong>{e.actorId ? (e.actorName ?? 'A former user') : 'System'}</strong> {describe(e, typeNames)}
                  {showEventTitle && e.eventTitle && <span className="muted"> · {e.eventTitle}</span>}
                </span>
                {detailLines(e, timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone).length > 0 && (
                  <ul className="activity-details">
                    {detailLines(e, timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
              <time className="muted small" dateTime={e.createdAt}>
                {formatDateTime(e.createdAt, timezone)}
              </time>
            </li>
          ))}
        </ol>
      )}
      {loading ? (
        <Spinner />
      ) : !error && entries.length === 0 ? (
        <p className="muted small">No changes recorded yet.</p>
      ) : hasMore ? (
        <button type="button" className="btn btn-sm" onClick={() => setPage((p) => p + 1)}>
          Show more
        </button>
      ) : null}
    </section>
  );
}
