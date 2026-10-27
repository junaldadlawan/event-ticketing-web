import { useEffect, useRef, useState } from 'react';
import { Button, FormActions } from '../../components/Button';
import { CheckRow } from '../../components/fields/CheckRow';
import { DateTimeField } from '../../components/fields/DateTimeFields';
import { SelectField, TextField } from '../../components/fields/TextField';
import type { CSSProperties, ReactNode } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useMatch, useNavigate, useParams } from 'react-router-dom';
import { assetUrl, errorMessage } from '../../api/client';
import { eventApi, layoutApi, promoApi, ticketSaleSettingsApi, ticketTemplateApi, ticketTypeApi } from '../../api/endpoints';
import type { Event, PromoCode, PromoCodeCreateRequest, TicketType, TicketTypeKind, TicketTypeUpdateRequest } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DeleteEventDialog } from '../../components/DeleteEventDialog';
import { EventActivity } from '../../components/EventActivity';
import { EventCheckIns } from '../../components/EventCheckIns';
import { RecapFeed } from '../../components/EventRecap';
import { RefreshButton } from '../../components/RefreshButton';
import { useAuth } from '../../auth/AuthContext';
import { isAdmin } from '../../auth/roles';
import { FormDialog } from '../../components/FormDialog';
import { EventFormDialog } from './CreateEventPage';
import { SalesInsights } from '../../components/SalesInsights';
import { CheckIcon, ChevronDownIcon, EditIcon, EyeIcon, GripIcon, PauseIcon, PlayIcon, TicketIcon, TrashIcon } from '../../components/DesignerIcons';
import { Empty, ErrorBox, Pagination, Spinner, StatusBadge } from '../../components/ui';
import { formatDateTime, formatMoney, humanize, isoToLocalInput, localInputToIso, minutesText } from '../../utils/format';
import { sortTicketTypes } from '../../utils/ticketTypes';
import { useHasPermission, useIsOrgManager, usePosition } from '../../auth/useCanManage';
import { useNow } from '../../utils/useNow';
import { useOrgNames } from '../../utils/useOrgNames';
import { SuspendedOrgNotice } from '../../components/SuspendedOrgNotice';
import { useAsync } from '../../utils/useAsync';
import { zonedParts, zonedToIso } from '../../utils/zonedTime';
import { draftDeletesIn, formatDuration, isEventOver } from '../../utils/eventState';

/** Tooltip on the controls an ended event greys out. */
const ENDED_TIP = 'This event has ended and can no longer be changed';

export function ManageEventPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // /manage/events/<id>/edit opens the Edit event window over this page.
  const editing = useMatch('/manage/events/:eventId/edit') !== null;
  // Coming back from the ticket designer after a save: "Customize ticket" shows "Ticket saved" for a moment.
  const location = useLocation();
  const [ticketJustSaved, setTicketJustSaved] = useState(
    () => (location.state as { ticketSaved?: boolean } | null)?.ticketSaved === true,
  );
  useEffect(() => {
    if (!ticketJustSaved) return;
    // Clear the flag from history so a reload or Back does not replay it.
    navigate(location.pathname, { replace: true, state: null });
    const t = setTimeout(() => setTicketJustSaved(false), 1250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketJustSaved]);
  const { data: event, setData: setEvent, error, loading } = useAsync(
    () => eventApi.get(eventId),
    [eventId],
  );
  // Whether the event has any ticket layout yet: without one the "Customize ticket" button shows a "!".
  const { data: templates } = useAsync(() => ticketTemplateApi.list(eventId), [eventId]);
  // Ticket types are loaded here so the launch checklist and the list below share one query.
  const typesQuery = useAsync(() => ticketTypeApi.list(eventId), [eventId]);
  // Promo codes of the event: the ticket types list shows how many apply to each type.
  const promoQuery = useAsync(() => promoApi.list(eventId), [eventId]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // The activity log (who changed what on the event) opens in a floating window.
  const [showingActivity, setShowingActivity] = useState(false);
  const [showingPromos, setShowingPromos] = useState(false);
  const [showingCheckIns, setShowingCheckIns] = useState(false);
  // Only the event's own owner / organizer may change ticket types; an admin sees them read-only.
  const canEvents = useHasPermission('EVENTS', event?.organizationId);
  const canPromos = useHasPermission('PROMO_CODES', event?.organizationId);
  const canOrders = useHasPermission('ORDERS_REFUNDS', event?.organizationId);
  const canAnalytics = useHasPermission('ANALYTICS', event?.organizationId);
  // Check-in staff get the event's details only: no ticket types (prices, sales) below the header.
  const scanner = usePosition() === 'Scanner';
  const now = useNow(30_000).getTime(); // keeps a draft's deletion countdown current
  const canEditTickets = useIsOrgManager(event?.organizationId) && canEvents;
  const orgName = useOrgNames(event ? [event.organizationId] : []).get(event?.organizationId ?? '');

  if (loading && !event) return <Spinner />;
  if (error || !event) return <ErrorBox message={error ?? 'Event not found'} />;

  async function act(action: () => Promise<Event | void>) {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await action();
      if (updated) setEvent(updated);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // A finished event is read-only: nothing about it or its tickets can change any more.
  const over = isEventOver(event);
  const canPublish = canEvents && event.status === 'DRAFT';
  // An ended event keeps the button (disabled) like its other controls.
  const canCancel = canEvents && (over || !['CANCELLED', 'COMPLETED'].includes(event.status));
  const cover = assetUrl(event.images?.find((u) => u && u.trim()));

  return (
    <div className="manage-page event-page">
      <SuspendedOrgNotice organizationIds={[event.organizationId]} />
      <header className="event-head">
        <div className="title-with-status">
          <h1>{event.title}</h1>
          {canEvents && (
            <button
              type="button"
              className="icon-button hero-edit"
              onClick={() => navigate(`/manage/events/${event.id}/edit`)}
              disabled={over}
              title={over ? ENDED_TIP : 'Edit event details'}
              aria-label="Edit event details"
            >
              <EditIcon />
            </button>
          )}
        </div>
        <p className="event-sub">
          {orgName && (
            <>
              {orgName}
              <span aria-hidden="true"> · </span>
            </>
          )}
          {event.category ? humanize(event.category) : 'Event'}
          <span aria-hidden="true"> · </span>
          {event.venue ? event.venue.name : 'Online'}
          <StatusBadge status={over ? 'COMPLETED' : event.status} />
        </p>
      </header>

      {cover ? (
        <img className="event-hero" src={cover} alt={`Picture for ${event.title}`} />
      ) : (
        <div className="event-hero event-hero-empty" aria-hidden="true">
          {event.category ? humanize(event.category) : 'Event'}
        </div>
      )}

      <aside className="booking-card manage-card" aria-label="Manage this event">
        <h2>Manage this event</h2>
        <ErrorBox message={actionError} />
        <div className="actions manage-actions">
        <Link
          to={`/events/${event.id}`}
          className="btn btn-outline-cta"
          title="See this event the way buyers see it"
        >
          <EyeIcon />
          View public page
        </Link>
        {!canEvents ? null : over ? (
          <button type="button" className="btn" disabled title={ENDED_TIP}>
            Customize ticket
          </button>
        ) : (
          <Link
            to={`/manage/events/${event.id}/ticket-design`}
            className={`btn${ticketJustSaved ? ' btn-just-saved' : ''}`}
            title={templates && templates.length === 0 ? "No ticket layout yet - design one" : undefined}
          >
            {ticketJustSaved && <CheckIcon />}
            {ticketJustSaved ? 'Ticket saved' : 'Customize ticket'}
            {!ticketJustSaved && templates && templates.length === 0 && (
              <span className="btn-badge" aria-label="No ticket layout yet">
                !
              </span>
            )}
          </Link>
        )}
        {canPromos && (
          <button
            type="button"
            className="btn"
            onClick={() => setShowingPromos(true)}
            disabled={over}
            title={over ? ENDED_TIP : 'Discount codes buyers can use on this event\'s tickets'}
          >
            Promo codes{promoQuery.data && promoQuery.data.length > 0 ? ` (${promoQuery.data.length})` : ''}
          </button>
        )}
        {/* The scan history is read-only and open to everyone who sees this page, check-in staff included. */}
        <button type="button" className="btn" onClick={() => setShowingCheckIns(true)} title="Tickets scanned at the door">
          Check-ins
        </button>
        {canAnalytics && (
          <button type="button" className="btn" onClick={() => setShowingActivity(true)} title="Who changed what on this event, and when">
            Activity log
          </button>
        )}
        {canPublish && (
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => act(() => eventApi.publish(event.id))}
          >
            Publish
          </button>
        )}
        {canCancel && (
          <button
            className="btn danger"
            disabled={busy || over}
            title={over ? ENDED_TIP : undefined}
            onClick={() => setConfirmingCancel(true)}
          >
            Cancel event
          </button>
        )}
        {canEvents && (
          <button
            className="btn btn-link danger"
            disabled={busy || over}
            title={over ? ENDED_TIP : undefined}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </button>
        )}
        </div>
      </aside>

      <ul className="event-facts">
        <li>
          <FactIcon>
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </FactIcon>
          <div>
            <strong>{formatDateTime(event.startAt, event.timezone)}</strong>
            <span>
              Ends {formatDateTime(event.endAt, event.timezone)} · runs {formatDuration(new Date(event.endAt).getTime() - new Date(event.startAt).getTime())}
            </span>
          </div>
        </li>
        <li>
          <FactIcon>
            <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
            <circle cx="12" cy="9" r="2.5" />
          </FactIcon>
          <div>
            <strong>{event.venue ? event.venue.name : 'Online'}</strong>
            <span>{event.venue ? event.venue.address : 'Join from anywhere'}</span>
          </div>
        </li>
        <li>
          <FactIcon>
            <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3z" />
            <path d="M14 7v10" strokeDasharray="2 2" />
          </FactIcon>
          <div>
            <strong>Ticket prefix <code>{event.ticketPrefix}</code></strong>
            <span>Every ticket number for this event starts with it</span>
          </div>
        </li>
      </ul>

      {event.description && (
        <section className="event-about">
          <h2>About this event</h2>
          <p className="description">{event.description}</p>
        </section>
      )}

      {draftDeletesIn(event, now) && (
        <p className="alert alert-warning" role="status">
          This draft is deleted in {draftDeletesIn(event, now)} unless you publish it first.
        </p>
      )}

      {/* The launch steps and the "You're live" note are for people who can edit the event, not read-only viewers. */}
      {canEvents && (
        <LaunchChecklist
          event={event}
          over={over}
          typeCount={typesQuery.data?.length ?? null}
          layoutCount={templates?.length ?? null}
          busy={busy}
          canEditTickets={canEditTickets}
          canEditEvent={canEvents}
          onPublish={() => act(() => eventApi.publish(event.id))}
        />
      )}

      {/* Same safeguard as delete: type the event name and re-enter the password. */}
      <DeleteEventDialog
        kind="cancel"
        open={confirmingCancel}
        eventTitle={event.title}
        onCancel={() => setConfirmingCancel(false)}
        onConfirmed={async () => {
          setConfirmingCancel(false);
          await act(() => eventApi.cancel(event.id));
        }}
      />

      {/* Asks for the exact event name and the user's password first. */}
      <DeleteEventDialog
        open={confirmingDelete}
        eventTitle={event.title}
        onCancel={() => setConfirmingDelete(false)}
        onConfirmed={async () => {
          await eventApi.remove(event.id);
          setConfirmingDelete(false);
          navigate('/manage');
        }}
      />

      <EventFormDialog
        open={editing}
        existing={event}
        onClose={() => navigate(`/manage/events/${event.id}`, { replace: true })}
        onSaved={(updated) => {
          setEvent(updated);
          navigate(`/manage/events/${event.id}`, { replace: true });
        }}
      />

      {/* After the event: pictures, links and messages for the people who joined (the owner or EVENTS organizers post). */}
      {over && (
        <section aria-label="Event recap">
          <h2>Recap</h2>
          <RecapFeed event={event} canPost={canEvents && !isAdmin(user?.role)} canDelete={canEvents} />
        </section>
      )}

      {!scanner && (
        <TicketTypes
          eventId={event.id}
          organizationId={event.organizationId}
          eventTitle={event.title}
          eventStartAt={event.startAt}
          eventEndAt={event.endAt}
          timezone={event.timezone}
          venueName={event.venue ? event.venue.name : 'Online'}
          canEdit={canEditTickets}
          eventOver={over}
          query={typesQuery}
          ownDesignTypeIds={new Set((templates ?? []).map((t) => t.ticketTypeId).filter((id): id is string => Boolean(id)))}
        />
      )}
      {/* A draft has sold nothing yet. */}
      {canAnalytics && event.status !== 'DRAFT' && typesQuery.data && <SalesInsights event={event} ticketTypes={typesQuery.data} />}
      {canOrders && <EventOrders eventId={event.id} />}
      <PromoCodesDialog
        eventId={event.id}
        open={showingPromos}
        ticketTypes={sortTicketTypes(typesQuery.data ?? [])}
        codes={promoQuery.data ?? []}
        onClose={() => setShowingPromos(false)}
        onChanged={promoQuery.reload}
      />
      <FormDialog open={showingCheckIns} size="large" title="Check-ins" onClose={() => setShowingCheckIns(false)}>
        <EventCheckIns eventId={event.id} timezone={event.timezone} />
      </FormDialog>
      <FormDialog open={showingActivity} title="Activity log" onClose={() => setShowingActivity(false)}>
        <EventActivity eventId={event.id} timezone={event.timezone} ticketTypes={typesQuery.data ?? []} />
      </FormDialog>
    </div>
  );
}

/** A small line icon for the key facts (the paths are drawn by the caller). */
function FactIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="fact-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/**
 * "Ready for showtime": the steps between a new draft and a live event, with progress. Each open step
 * has the button that does it. Draft events only; a live event gets a short celebration instead.
 */
function LaunchChecklist({
  event,
  over,
  typeCount,
  layoutCount,
  busy,
  canEditTickets,
  canEditEvent,
  onPublish,
}: {
  event: Event;
  /** The event has ended (see isEventOver). */
  over: boolean;
  /** null = still loading */
  typeCount: number | null;
  layoutCount: number | null;
  busy: boolean;
  canEditTickets: boolean;
  /** Holds EVENTS (BR-ORG-008): may design the ticket and publish. */
  canEditEvent: boolean;
  onPublish: () => void;
}) {
  // Collapsed = just the headline and the progress bar. The choice is remembered in this browser.
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('launchChecklistOpen') !== 'false';
    } catch {
      return true;
    }
  });
  function toggle() {
    setOpen((o) => {
      try {
        localStorage.setItem('launchChecklistOpen', String(!o));
      } catch {
        /* private window or blocked storage: it just won't be remembered */
      }
      return !o;
    });
  }

  if (over) {
    return (
      <section className="launch-card" aria-label="Event status">
        <h2>This event has ended</h2>
        <p>
          It ended {formatDateTime(event.endAt, event.timezone)}. Tickets are no longer on sale and the event can't be
          changed. Orders stay below.
        </p>
      </section>
    );
  }
  if (event.status === 'PUBLISHED') {
    return (
      <section className="launch-card launch-live" aria-label="Event status">
        <h2>You're live!</h2>
        <p>Buyers can see {event.title} and start buying tickets.</p>
      </section>
    );
  }
  if (event.status !== 'DRAFT') return null;

  const steps = [
    {
      key: 'details',
      title: 'Event details',
      hint: 'Title, date and category are set',
      done: true,
      action: null,
    },
    {
      key: 'types',
      title: 'Ticket types',
      hint: typeCount ? `${typeCount} ticket type${typeCount === 1 ? '' : 's'} ready to sell` : 'Decide what people can buy',
      done: Boolean(typeCount),
      action: canEditTickets ? (
        <a href="#ticket-types" className="btn btn-sm">
          Add ticket types
        </a>
      ) : null,
    },
    {
      key: 'design',
      title: 'Ticket design',
      hint: layoutCount ? 'Your ticket has a look' : 'Make a ticket people will want to keep',
      done: Boolean(layoutCount),
      action: canEditEvent ? (
        <Link to={`/manage/events/${event.id}/ticket-design`} className="btn btn-sm">
          Customize ticket
        </Link>
      ) : null,
    },
    {
      key: 'publish',
      title: 'Publish',
      hint: 'Open ticket sales to everyone',
      done: false,
      action: canEditEvent ? (
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={onPublish}>
          Publish
        </button>
      ) : null,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const headline =
    doneCount <= 1 ? "Let's get this event ready" : doneCount === 2 ? 'Halfway to showtime' : 'One step to go';

  return (
    <section className="launch-card" aria-label="Launch checklist">
      <button
        type="button"
        className="launch-head launch-toggle"
        aria-expanded={open}
        aria-controls="launch-steps"
        title={open ? 'Hide the checklist' : 'Show the checklist'}
        onClick={toggle}
      >
        <span className="launch-title">{headline}</span>
        <span className="launch-count">
          {doneCount} of {steps.length} done
        </span>
        <span className={`launch-chevron${open ? ' is-open' : ''}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      <div
        className="launch-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
        aria-label="Launch progress"
      >
        <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="launch-steps" id="launch-steps" hidden={!open}>
        {steps.map((s) => (
          <li key={s.key} className={s.done ? 'is-done' : ''}>
            <span className="launch-mark" aria-hidden="true">
              {s.done ? '✓' : ''}
            </span>
            <span className="launch-text">
              <strong>{s.title}</strong>
              <small>{s.hint}</small>
            </span>
            {!s.done && s.action}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Title, category and description, edited in a window opened by the pencil in the header card. */
/** A small "More" button that opens a short menu under it; closes on a click elsewhere or Escape. */
function RowMenu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="popover" ref={root}>
      <button
        type="button"
        className="btn btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        More
        <span className={`launch-chevron${open ? ' is-open' : ''}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div className="popover-panel row-menu" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** Currencies a ticket can be priced in (all with cents, which the price field assumes). PHP first: PayMongo charges PHP. */
const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'SGD', 'AUD', 'CAD', 'HKD'].map((code) => ({ code }));

/** The platform's sale timing rules until the admin's settings load (the API's defaults; it checks them anyway). */
const DEFAULT_SALE_SETTINGS = { salesCloseMinutesBeforeEvent: 60, minSaleDurationMinutes: 60 };

/** Card colours to pick from (the supplied palette); null = follow the status colour. */
const CARD_COLOURS: { name: string; value: string | null }[] = [
  { name: 'Match status', value: null },
  { name: 'Periwinkle', value: '#c5cbff' },
  { name: 'Purple', value: '#a071fd' },
  { name: 'Blue', value: '#658eff' },
  { name: 'Green', value: '#55cca2' },
  { name: 'Orange', value: '#fda471' },
  { name: 'Pink', value: '#fd719f' },
];

/** One word (and a colour) for where a ticket type is in its life: on sale, scheduled, paused, ended, sold out. */
function ticketStatus(tt: TicketType, eventOver: boolean): { label: string; tone: 'good' | 'warn' | 'bad' | 'info' | 'muted' } {
  const now = Date.now();
  if (eventOver) return { label: 'Event ended', tone: 'muted' };
  if (tt.salesPaused) return { label: 'Paused', tone: 'warn' };
  if (tt.quantityAvailable <= 0) return { label: 'Sold out', tone: 'bad' };
  if (new Date(tt.saleStartAt).getTime() > now) return { label: 'Scheduled', tone: 'info' };
  if (new Date(tt.saleEndAt).getTime() < now) return { label: 'Sale ended', tone: 'muted' };
  return { label: 'On sale', tone: 'good' };
}

/** "20% off" or "$5.00 off". */
function discountText(p: PromoCode, currency: string): string {
  return p.discountType === 'PERCENTAGE'
    ? `${p.discountValue}% off`
    : `${formatMoney({ amount: p.discountValue, currency })} off`;
}

/** Where a promo code is in its life, in plain words. */
function promoState(p: PromoCode, now = Date.now()): { label: string; tone: string } {
  if (p.paused) return { label: 'Paused', tone: 'warn' };
  if (new Date(p.validUntil).getTime() < now) return { label: 'Expired', tone: 'bad' };
  if (p.usageLimitTotal && (p.usedCount ?? 0) >= p.usageLimitTotal) return { label: 'Used up', tone: 'bad' };
  if (new Date(p.validFrom).getTime() > now) return { label: 'Scheduled', tone: 'info' };
  return { label: 'Active', tone: 'good' };
}

/** The promo codes that apply to one ticket type: read them at a glance, edit, pause / resume, delete, or add a new one. */
/**
 * The event's promo codes in one window: list, pause / resume / delete, and a form to add or edit one. Each code
 * applies to every ticket type, or to the ones picked (one or more).
 */
function PromoCodesDialog({
  eventId,
  open,
  ticketTypes,
  codes,
  onClose,
  onChanged,
}: {
  eventId: string;
  open: boolean;
  ticketTypes: TicketType[];
  codes: PromoCode[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [pending, setPending] = useState<{ promo: PromoCode; action: 'pause' | 'resume' | 'delete' } | null>(null);
  const [code, setCode] = useState('');
  const [type, setType] = useState<PromoCodeCreateRequest['discountType']>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [limitTotal, setLimitTotal] = useState('');
  const [limitPerBuyer, setLimitPerBuyer] = useState('');
  // Which ticket types the code is for: every one, or the ones ticked (one or more).
  const [appliesTo, setAppliesTo] = useState<'ALL' | 'SOME'>('ALL');
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const currency = ticketTypes[0]?.price.currency ?? 'PHP';
  const typeName = (id: string) => ticketTypes.find((t) => t.id === id)?.name ?? 'a removed ticket type';
  const noTypePicked = appliesTo === 'SOME' && typeIds.length === 0;
  // A new code is valid, by default, for as long as any of the event's tickets are on sale.
  const saleStarts = ticketTypes.map((t) => t.saleStartAt).sort();
  const saleEnds = ticketTypes.map((t) => t.saleEndAt).sort();
  // A code that was already used keeps its code and discount type (the API refuses changing them).
  const locked = editing !== null && (editing.usedCount ?? 0) > 0;

  function blankForm() {
    setEditing(null);
    setCode('');
    setType('PERCENTAGE');
    setValue('');
    setLimitTotal('');
    setLimitPerBuyer('');
    setAppliesTo('ALL');
    setTypeIds([]);
    setFrom(saleStarts.length ? isoToLocalInput(saleStarts[0]) : '');
    setUntil(saleEnds.length ? isoToLocalInput(saleEnds[saleEnds.length - 1]) : '');
  }

  function startEdit(promo: PromoCode) {
    setEditing(promo);
    setCode(promo.code);
    setType(promo.discountType);
    setValue(promo.discountType === 'PERCENTAGE' ? String(promo.discountValue) : String(promo.discountValue / 100));
    setFrom(isoToLocalInput(promo.validFrom));
    setUntil(isoToLocalInput(promo.validUntil));
    setLimitTotal(promo.usageLimitTotal ? String(promo.usageLimitTotal) : '');
    setLimitPerBuyer(promo.usageLimitPerBuyer ? String(promo.usageLimitPerBuyer) : '');
    setAppliesTo(promo.applicableTicketTypeIds?.length ? 'SOME' : 'ALL');
    setTypeIds(promo.applicableTicketTypeIds ?? []);
    setErr(null);
  }

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      blankForm();
      setErr(null);
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const amount = () => (type === 'PERCENTAGE' ? Number(value) : Math.round(Number(value) * 100));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (noTypePicked) {
      setErr('Pick at least one ticket type, or choose "All ticket types".');
      return;
    }
    // An empty list means every ticket type of the event (for a new code and for an edit alike).
    const applicableTicketTypeIds = appliesTo === 'ALL' ? [] : typeIds;
    setBusy(true);
    setErr(null);
    try {
      if (editing) {
        await promoApi.update(editing.id, {
          code: code.trim().toUpperCase() !== editing.code ? code.trim().toUpperCase() : undefined,
          discountType: type !== editing.discountType ? type : undefined,
          discountValue: amount(),
          // 0 removes a limit the code had; an empty box leaves a code with no limit as it is
          usageLimitTotal: limitTotal ? Number(limitTotal) : editing.usageLimitTotal ? 0 : undefined,
          usageLimitPerBuyer: limitPerBuyer ? Number(limitPerBuyer) : editing.usageLimitPerBuyer ? 0 : undefined,
          validFrom: localInputToIso(from),
          validUntil: localInputToIso(until),
          applicableTicketTypeIds,
        });
      } else {
        await promoApi.create(eventId, {
          code: code.trim().toUpperCase(),
          discountType: type,
          discountValue: amount(),
          applicableTicketTypeIds,
          usageLimitTotal: limitTotal ? Number(limitTotal) : undefined,
          usageLimitPerBuyer: limitPerBuyer ? Number(limitPerBuyer) : undefined,
          validFrom: localInputToIso(from),
          validUntil: localInputToIso(until),
        });
      }
      blankForm();
      onChanged();
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    const c = pending;
    setPending(null);
    if (!c) return;
    setErr(null);
    try {
      if (c.action === 'delete') await promoApi.remove(c.promo.id);
      else await promoApi.setStatus(c.promo.id, c.action === 'pause' ? 'PAUSED' : 'ACTIVE');
      if (editing?.id === c.promo.id) blankForm();
      onChanged();
    } catch (ex) {
      setErr(errorMessage(ex));
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal modal-landscape promo-dialog"
      aria-labelledby="promo-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id="promo-title">Promo codes</h2>
      </div>
      {codes.length === 0 ? (
        <p className="muted small">No promo codes for this event yet.</p>
      ) : (
        <ul className="promo-cards">
          {codes.map((pc) => {
            const state = promoState(pc);
            const used = pc.usedCount ?? 0;
            return (
              <li key={pc.id} className={`promo-card${pc.paused ? ' is-paused' : ''}${editing?.id === pc.id ? ' is-editing' : ''}`}>
                <div className="promo-main">
                  <div className="promo-title">
                    <code>{pc.code}</code>
                    <strong>{discountText(pc, currency)}</strong>
                    <span className={`status-chip status-${state.tone}`}>{state.label}</span>
                  </div>
                  <div className="muted small">
                    {formatDateTime(pc.validFrom)} to {formatDateTime(pc.validUntil)}
                  </div>
                  <div className="muted small">
                    {used}
                    {pc.usageLimitTotal ? ` of ${pc.usageLimitTotal}` : ''} used
                    {pc.usageLimitPerBuyer ? ` · ${pc.usageLimitPerBuyer} per buyer` : ''}
                    {' · '}
                    {pc.applicableTicketTypeIds?.length
                      ? pc.applicableTicketTypeIds.map(typeName).join(', ')
                      : 'all ticket types'}
                  </div>
                </div>
                <div className="promo-actions">
                  <button
                    type="button"
                    className="icon-button"
                    title="Edit"
                    aria-label={`Edit ${pc.code}`}
                    onClick={() => startEdit(pc)}
                  >
                    <EditIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    title={pc.paused ? 'Resume: let buyers use it again' : 'Pause: buyers can not use it'}
                    aria-label={`${pc.paused ? 'Resume' : 'Pause'} ${pc.code}`}
                    onClick={() => setPending({ promo: pc, action: pc.paused ? 'resume' : 'pause' })}
                  >
                    {pc.paused ? <PlayIcon /> : <PauseIcon />}
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button-danger"
                    title={used > 0 ? 'Already used, so it can not be deleted. Pause it instead.' : 'Delete'}
                    aria-label={`Delete ${pc.code}`}
                    disabled={used > 0}
                    onClick={() => setPending({ promo: pc, action: 'delete' })}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ErrorBox message={err} />
      <h3 className="promo-new">{editing ? `Edit ${editing.code}` : 'New promo code'}</h3>
      <form className="form promo-form" onSubmit={onSubmit}>
        <div className="promo-row promo-row-3">
          <TextField
            label="Code"
            required
            maxLength={50}
            disabled={locked}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="EARLYBIRD"
          />
          <SelectField
            label="Discount"
            value={type}
            disabled={locked}
            onChange={(e) => setType(e.target.value as PromoCodeCreateRequest['discountType'])}
          >
            <option value="PERCENTAGE">Percent off</option>
            <option value="FIXED">Amount off</option>
          </SelectField>
          <TextField
            label={type === 'PERCENTAGE' ? 'Percent (0-100)' : 'Amount'}
            type="number"
            required
            min={0}
            max={type === 'PERCENTAGE' ? 100 : undefined}
            step={type === 'PERCENTAGE' ? 1 : 0.01}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        {locked && (
          <small className="muted">
            This code was already used, so its code and discount type are fixed. Pause it and make a new one to change them.
          </small>
        )}
        <div className="promo-row promo-row-3">
          <SelectField label="Applies to" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as 'ALL' | 'SOME')}>
            <option value="ALL">All ticket types</option>
            <option value="SOME">Specific ticket types</option>
          </SelectField>
          <TextField label="Total uses" optional type="number" min={1} value={limitTotal} onChange={(e) => setLimitTotal(e.target.value)} />
          <TextField label="Per buyer" optional type="number" min={1} value={limitPerBuyer} onChange={(e) => setLimitPerBuyer(e.target.value)} />
        </div>
        {appliesTo === 'SOME' && (
          <fieldset className="promo-types">
            <legend className="sr-only">Ticket types this code applies to</legend>
            {ticketTypes.length === 0 ? (
              <p className="muted small">This event has no ticket types yet.</p>
            ) : (
              ticketTypes.map((t) => (
                <CheckRow
                  key={t.id}
                  checked={typeIds.includes(t.id)}
                  onChange={(e) =>
                    setTypeIds((ids) => (e.target.checked ? [...ids, t.id] : ids.filter((id) => id !== t.id)))
                  }
                >
                  {t.name}
                </CheckRow>
              ))
            )}
            {noTypePicked && <small className="warn">Pick at least one ticket type.</small>}
          </fieldset>
        )}
        <div className="promo-row">
          <TextField label="Valid from" type="datetime-local" required value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="Valid until" type="datetime-local" required value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
        <div className="modal-actions">
          <Button disabled={busy} onClick={onClose}>
            Close
          </Button>
          {editing && (
            <Button disabled={busy} onClick={blankForm}>
              Cancel edit
            </Button>
          )}
          <Button type="submit" variant="primary" busy={busy} busyLabel="Saving..." disabled={noTypePicked}>
            {editing ? 'Save changes' : 'Add promo code'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.action === 'delete'
            ? `Delete ${pending.promo.code}?`
            : pending?.action === 'resume'
              ? `Resume ${pending.promo.code}?`
              : `Pause ${pending?.promo.code ?? 'this code'}?`
        }
        confirmLabel={pending?.action === 'delete' ? 'Delete' : pending?.action === 'resume' ? 'Resume' : 'Pause'}
        cancelLabel="Cancel"
        danger={pending?.action === 'delete'}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmPending()}
      >
        {pending?.action === 'delete'
          ? 'The code is removed for good. It has not been used, so no order is affected.'
          : pending?.action === 'resume'
            ? 'Buyers can use this code again, within its dates and limits.'
            : 'Buyers can not use this code, and a cart that already has it can not check out until you resume it. Orders that used it are not affected.'}
      </ConfirmDialog>
    </dialog>
  );
}

/** The "Section" choice that copies every section of the layout. */
const WHOLE_LAYOUT = 'whole';

function TicketTypes({
  eventId,
  organizationId,
  eventTitle,
  eventStartAt,
  eventEndAt,
  timezone,
  canEdit,
  eventOver,
  venueName,
  query,
  ownDesignTypeIds,
}: {
  eventId: string;
  /** Whose seat layouts a reserved-seating ticket type can copy its seats from. */
  organizationId: string;
  /** The event this ticket type belongs to, named at the top of the window. */
  eventTitle: string;
  /** The event's start: ticket sales must close at least an hour before it. */
  eventStartAt: string;
  eventEndAt: string;
  /** The event's timezone: the sale window's dates and times are read in it. */
  timezone: string;
  /** Where the event is, shown on each ticket for read-only viewers. */
  venueName: string;
  /** false = read-only (an admin who is not an organizer of this event): no add, edit, pause, reorder or delete. */
  canEdit: boolean;
  /** The event has ended: every ticket type reads "Event ended" and the change controls are disabled. */
  eventOver: boolean;
  query: ReturnType<typeof useAsync<TicketType[]>>;
  /** Ticket types that have a layout of their own (the others print with "All ticket types"). */
  ownDesignTypeIds: Set<string>;
}) {
  const { data, error, reload } = query;
  // A ticket type waiting for a "yes" before it is deleted, and the last error from pause / delete.
  const [deleting, setDeleting] = useState<TicketType | null>(null);
  // A ticket type waiting for a "yes" before its sales are paused or resumed.
  const [toggling, setToggling] = useState<TicketType | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  // A short confirmation (new arrangement saved, sales paused / resumed) so the organizer knows the change stuck.
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const savedTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(savedTimer.current), []);
  function notify(text: string) {
    setSavedNote(text);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSavedNote(null), 2500);
  }
  // The order while a save is in flight (shown at once); empty otherwise, when each card's `position` rules.
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dragDy, setDragDy] = useState(0);
  const dragStartY = useRef(0);
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const sortedTypes = data
    ? order.length > 0
      ? [...data].sort((x, y) => rank(x.id) - rank(y.id))
      : sortTicketTypes(data)
    : [];

  async function saveOrder(ids: string[]) {
    setOrder(ids); // show the new arrangement at once
    setRowError(null);
    setSavedNote(null);
    try {
      const saved = await ticketTypeApi.reorder(eventId, ids);
      query.setData(saved);
      setOrder([]);
      notify('New arrangement saved');
    } catch (e) {
      setRowError(errorMessage(e));
      setOrder([]); // back to the saved positions
      reload();
    }
  }
  /** Put `id` where `targetId` is (the others shift). */
  function moveTo(id: string, targetId: string) {
    if (id === targetId) return;
    const ids = sortedTypes.map((t) => t.id);
    const to = ids.indexOf(targetId); // its place before the move: dragging down lands after it, up lands before it
    ids.splice(ids.indexOf(id), 1);
    ids.splice(to, 0, id);
    saveOrder(ids);
  }
  /** The card under the pointer (other than the dragged one), found by comparing the pointer's height with each card. */
  function cardUnder(clientY: number, draggedId: string): string | null {
    for (const el of document.querySelectorAll<HTMLElement>('[data-tt-id]')) {
      const id = el.dataset.ttId!;
      if (id === draggedId) continue;
      const r = el.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) return id;
    }
    return null;
  }
  // Pointer-based dragging (works the same in every browser and on touch): press the grip, move, release.
  function beginDrag(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer that is already gone: the drag still works from the events on the grip */
    }
    dragStartY.current = e.clientY;
    setDragId(id);
    setDragDy(0);
  }
  function moveDrag(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragId) return;
    setDragDy(e.clientY - dragStartY.current);
    setOverId(cardUnder(e.clientY, dragId));
  }
  function endDrag() {
    if (dragId && overId) moveTo(dragId, overId);
    cancelDrag();
  }
  function cancelDrag() {
    setDragId(null);
    setOverId(null);
    setDragDy(0);
  }

  /** Keyboard: one step up or down. */
  function moveBy(id: string, delta: number) {
    const ids = sortedTypes.map((t) => t.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    saveOrder(ids);
  }

  // The card colour of each ticket type, saved on the ticket type so buyers' tickets show it too. The API returns
  // it uppercase; the swatches are lowercase, so compare in lowercase.
  const colourOf = (tt: TicketType) => tt.color?.toLowerCase() ?? null;
  async function setColour(tt: TicketType, value: string | null) {
    setRowError(null);
    try {
      const updated = await ticketTypeApi.update(tt.id, { color: value });
      query.setData((list) => list?.map((t) => (t.id === updated.id ? updated : t)) ?? list);
    } catch (e) {
      setRowError(errorMessage(e));
    }
  }

  async function confirmDelete() {
    const tt = deleting;
    setDeleting(null);
    if (!tt) return;
    setRowError(null);
    try {
      await ticketTypeApi.remove(tt.id);
      reload();
    } catch (ex) {
      setRowError(errorMessage(ex));
    }
  }
  const [name, setName] = useState('');
  const [kind, setKind] = useState<TicketTypeKind>('GENERAL_ADMISSION');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [quantity, setQuantity] = useState('');
  // Reserved seating can copy its seats from an organization seat layout: the whole plan, or one section of it.
  const [layoutId, setLayoutId] = useState('');
  const [sectionId, setSectionId] = useState(WHOLE_LAYOUT);
  // The sale window, as dates and times in the event's timezone. "Start now" leaves the start empty: it is set on save.
  const [startNow, setStartNow] = useState(false);
  const [saleStartDate, setSaleStartDate] = useState('');
  const [saleStartTime, setSaleStartTime] = useState('');
  const [saleEndDate, setSaleEndDate] = useState('');
  const [saleEndTime, setSaleEndTime] = useState('');
  // The admin's sale timing rules: how long before the event sales close, and how long a sale must run.
  const saleRules = useAsync(() => ticketSaleSettingsApi.get(), []).data ?? DEFAULT_SALE_SETTINGS;
  const closeBefore = minutesText(saleRules.salesCloseMinutesBeforeEvent);
  const minDuration = minutesText(saleRules.minSaleDurationMinutes);
  // The latest the sale can end.
  const latestEndMs = new Date(eventEndAt).getTime() - saleRules.salesCloseMinutesBeforeEvent * 60_000;
  const latestEnd = zonedParts(new Date(latestEndMs).toISOString(), timezone);
  const saleStartMs = startNow
    ? null
    : saleStartDate && saleStartTime
      ? Date.parse(zonedToIso(saleStartDate, saleStartTime, timezone))
      : null;
  const saleEndMs = saleEndDate && saleEndTime ? Date.parse(zonedToIso(saleEndDate, saleEndTime, timezone)) : null;
  // "Start now" means the moment it is saved, so the window is measured from now.
  const windowStartMs = startNow ? Date.now() : saleStartMs;
  const saleWarning =
    saleEndMs === null
      ? null
      : saleEndMs > latestEndMs
        ? `Sales must end by ${formatDateTime(new Date(latestEndMs).toISOString(), timezone)}${
            saleRules.salesCloseMinutesBeforeEvent ? `, ${closeBefore} before the event ends` : ', when the event ends'
          }.`
        : windowStartMs !== null && saleEndMs - windowStartMs < saleRules.minSaleDurationMinutes * 60_000
          ? startNow
            ? `Sales must run for at least ${minDuration}, so the end must be at least ${minDuration} from now.`
            : `Sales must run for at least ${minDuration} after they start.`
          : null;
  const saleMissing = (!startNow && saleStartMs === null) || saleEndMs === null;
  const [maxPerOrder, setMaxPerOrder] = useState('');
  // Blank = unlimited.
  const [maxPerUser, setMaxPerUser] = useState('');
  const userLimit = maxPerUser === '' ? null : Number(maxPerUser);
  // The API refuses a per-order limit above the per-buyer one (a blank per-order limit becomes the lower of 10 and it).
  const limitWarning =
    userLimit !== null && maxPerOrder !== '' && Number(maxPerOrder) > userLimit
      ? "Max per order can't be more than the max per buyer."
      : null;
  // Why the Add / Save button is off, in the order the form is filled in; null when nothing is in the way.
  const blocker =
    (!name.trim() && 'Enter a name for the ticket type.') ||
    (price === '' && 'Enter a price (0 for free).') ||
    (quantity === '' && 'Enter how many tickets are available.') ||
    (!startNow && saleStartMs === null && 'Pick when the sale starts, or tick "Start now".') ||
    (saleEndMs === null &&
      (saleEndDate ? 'Pick the sale end time: hour, minutes and AM/PM.' : 'Pick the sale end date and time.')) ||
    limitWarning ||
    saleWarning ||
    null;
  const [err, setErr] = useState<string | null>(null);
  // The "add" form lives in its own window (a modal dialog), opened by the button in the section header.
  const [adding, setAdding] = useState(false);
  // The ticket type being edited in that same window (null = adding a new one).
  const [editing, setEditing] = useState<TicketType | null>(null);
  const seatLayouts = useAsync(() => (adding && !editing && kind === 'RESERVED_SEATING' ? layoutApi.listForOrg(organizationId) : Promise.resolve([])), [adding, editing, kind, organizationId]).data ?? [];
  const pickedLayout = useAsync(() => (layoutId ? layoutApi.get(layoutId) : Promise.resolve(null)), [layoutId]).data;
  const seatsForSale = (secs: { rows: { seats: { type?: string }[] }[] }[]) => secs.reduce((n, sec) => n + sec.rows.reduce((m, r) => m + r.seats.filter((x) => x.type !== 'BLOCKED').length, 0), 0);
  // Name of the ticket type a new one is being copied from (for the hint in the window).
  const [copyOf, setCopyOf] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  function openAdd() {
    setEditing(null);
    setCopyOf(null);
    setName('');
    setKind('GENERAL_ADMISSION');
    setPrice('');
    setCurrency('PHP');
    setQuantity('');
    setLayoutId('');
    setSectionId(WHOLE_LAYOUT);
    setStartNow(false);
    setSaleStartDate('');
    setSaleStartTime('');
    setSaleEndDate(latestEnd.date);
    setSaleEndTime(latestEnd.time);
    setMaxPerOrder('');
    setMaxPerUser('');
    setAdding(true);
  }

  /** "Duplicate": the add window, filled in from an existing ticket type (a new one is created). */
  function openDuplicate(tt: TicketType) {
    openEdit(tt);
    setEditing(null);
    setCopyOf(tt.name);
    setName(`Copy of ${tt.name}`.slice(0, 200));
  }

  function openEdit(tt: TicketType) {
    setCopyOf(null);
    setEditing(tt);
    setName(tt.name);
    setKind(tt.kind);
    setPrice(String(tt.price.amount / 100));
    setCurrency(tt.price.currency);
    setQuantity(String(tt.quantityTotal));
    setLayoutId('');
    const start = zonedParts(tt.saleStartAt, timezone);
    const end = zonedParts(tt.saleEndAt, timezone);
    setStartNow(false);
    setSaleStartDate(start.date);
    setSaleStartTime(start.time);
    setSaleEndDate(end.date);
    setSaleEndTime(end.time);
    setMaxPerOrder(String(tt.maxPerOrder));
    setMaxPerUser(tt.maxPerUser == null ? '' : String(tt.maxPerUser));
    setAdding(true);
  }
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (adding && !d.open) {
      setErr(null);
      d.showModal();
    } else if (!adding && d.open) {
      d.close();
    }
  }, [adding]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (saleMissing || saleWarning || limitWarning) {
      setErr(limitWarning ?? saleWarning ?? 'Fill in when the sale starts and ends.');
      return;
    }
    // "Start now": a new ticket type leaves the start out, so the API stamps it as it saves. An edit has to send
    // one, since a field left out of an update means "unchanged".
    const saleStartAt = startNow ? undefined : zonedToIso(saleStartDate, saleStartTime, timezone);
    const saleEndAt = zonedToIso(saleEndDate, saleEndTime, timezone);
    try {
      if (editing) {
        // Send only what changed: a new quantityTotal keeps what is sold or held (409 if it goes below that).
        const body: TicketTypeUpdateRequest = {};
        const amount = Math.round(Number(price) * 100);
        if (name !== editing.name) body.name = name;
        if (amount !== editing.price.amount || currency.toUpperCase() !== editing.price.currency) {
          body.price = { amount, currency: currency.toUpperCase() };
        }
        if (Number(quantity) !== editing.quantityTotal) body.quantityTotal = Number(quantity);
        const editStartAt = saleStartAt ?? new Date().toISOString();
        if (editStartAt !== new Date(editing.saleStartAt).toISOString()) body.saleStartAt = editStartAt;
        if (saleEndAt !== new Date(editing.saleEndAt).toISOString()) body.saleEndAt = saleEndAt;
        if (maxPerOrder && Number(maxPerOrder) !== editing.maxPerOrder) body.maxPerOrder = Number(maxPerOrder);
        if (userLimit !== (editing.maxPerUser ?? null)) body.maxPerUser = userLimit;
        if (Object.keys(body).length > 0) await ticketTypeApi.update(editing.id, body);
        reload();
        setAdding(false);
        return;
      }
      await ticketTypeApi.create(eventId, {
        name,
        kind,
        price: { amount: Math.round(Number(price) * 100), currency: currency.toUpperCase() },
        ...(kind === 'RESERVED_SEATING' && layoutId
          ? { layoutId, ...(sectionId === WHOLE_LAYOUT ? { wholeLayout: true } : { sectionId }) }
          : { quantityTotal: Number(quantity) }),
        saleStartAt,
        saleEndAt,
        maxPerOrder: maxPerOrder ? Number(maxPerOrder) : undefined,
        maxPerUser: userLimit,
      });
      setName('');
      setPrice('');
      setQuantity('');
      reload();
      setAdding(false);
    } catch (ex) {
      setErr(errorMessage(ex));
    }
  }

  return (
    <section className="card" id="ticket-types">
      <div className="section-head">
        <div className="section-title">
          <h2>Ticket types</h2>
          <RefreshButton onClick={query.reload} busy={query.loading} label="Reload ticket types" />
          {data && (
            <>
              <span className="count-badge" aria-label={`${data.length} ticket types`}>
                {data.length}
              </span>
              {canEdit && data.length > 0 && (
                <span className="muted small">
                  {data.reduce((n, t) => n + t.quantityTotal, 0)} tickets · {data.reduce((n, t) => n + (t.quantityTotal - t.quantityAvailable), 0)} sold
                </span>
              )}
            </>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={openAdd}
            disabled={eventOver}
            title={eventOver ? ENDED_TIP : undefined}
          >
            + Add ticket type
          </button>
        )}
      </div>
      <ErrorBox message={error ?? rowError} />
      {savedNote && (
        <div className="toast" role="status">
          <CheckIcon /> {savedNote}
        </div>
      )}
      {data && data.length === 0 && (
        <p className="muted small">
          {canEdit ? 'None yet. Add the first one to start selling.' : 'No ticket types yet.'}
        </p>
      )}
      <ul className="plain-list">
        {sortedTypes.map((tt) => (
          <li
            key={tt.id}
            className={`tt-row tt-${ticketStatus(tt, eventOver).tone}${tt.salesPaused ? " is-paused" : ""}${colourOf(tt) ? " has-color" : ""}${dragId === tt.id ? " is-dragging" : ""}${overId === tt.id && dragId !== tt.id ? " is-drop-target" : ""}`}
            data-tt-id={tt.id}
            style={
              {
                ...(colourOf(tt) ? { "--tt-color": colourOf(tt) } : {}),
                ...(dragId === tt.id ? { transform: `translateY(${dragDy}px)`, zIndex: 40 } : {}),
              } as CSSProperties
            }
          >
            <div className="tt-main">
              <div className="tt-name">
                <strong>{tt.name}</strong>
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-sm btn-icon tt-edit"
                    onClick={() => openEdit(tt)}
                    disabled={eventOver}
                    aria-label={`Edit ${tt.name}`}
                    title={eventOver ? ENDED_TIP : 'Edit'}
                  >
                    <EditIcon />
                  </button>
                )}
                <span className={`status-chip status-${ticketStatus(tt, eventOver).tone}`}>{ticketStatus(tt, eventOver).label}</span>
                {/* Which ticket design it uses: only for those who can edit, not read-only viewers. */}
                {canEdit && (
                  <span
                    className="tt-design"
                    tabIndex={0}
                    role="img"
                    aria-label={ownDesignTypeIds.has(tt.id) ? 'Uses its own ticket design' : 'Uses the "All ticket types" ticket design'}
                    data-tip={ownDesignTypeIds.has(tt.id) ? 'Own ticket design' : 'Uses the "All ticket types" design'}
                  >
                    <TicketIcon />
                  </span>
                )}
              </div>
              <p className="muted small tt-meta">{humanize(tt.kind)}</p>
              {!canEdit && <p className="muted small tt-meta">Venue: {venueName}</p>}
              <p className="muted small tt-meta tt-window">
                <span>On sale</span>
                <span className="nowrap">{formatDateTime(tt.saleStartAt)}</span>
                <span aria-hidden="true">→</span>
                <span className="nowrap">{formatDateTime(tt.saleEndAt)}</span>
              </p>
              {/* Sales figures: not for read-only viewers (check-in staff). */}
              {canEdit && (
                <div className="tt-progress">
                  <div
                    className="tt-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={tt.quantityTotal}
                    aria-valuenow={tt.quantityTotal - tt.quantityAvailable}
                    aria-label={`${tt.name} tickets sold`}
                  >
                    <span style={{ width: `${Math.round(((tt.quantityTotal - tt.quantityAvailable) / Math.max(1, tt.quantityTotal)) * 100)}%` }} />
                  </div>
                  <small className="muted">
                    {tt.quantityTotal - tt.quantityAvailable === 0
                      ? "No sales yet. Your first buyer is on the way!"
                      : `${tt.quantityTotal - tt.quantityAvailable} of ${tt.quantityTotal} sold · ${formatMoney({ amount: (tt.quantityTotal - tt.quantityAvailable) * tt.price.amount, currency: tt.price.currency })} so far`}
                  </small>
                </div>
              )}
            </div>
            <div className="tt-stub">
            {/* Read-only viewers (check-in staff) get an admit-one stub instead of the price and actions. */}
            {!canEdit && (
              <div className="tt-admit" aria-hidden="true">
                <TicketIcon />
                <strong>Admit one</strong>
                <span>{humanize(tt.kind)}</span>
              </div>
            )}
            {canEdit && <strong className="tt-price">{formatMoney(tt.price)}</strong>}
            {canEdit && (
            <div className="tt-actions">
              {canEdit && (
                <button
                  type="button"
                  className={`btn btn-sm btn-icon ${tt.salesPaused ? 'btn-resume' : 'btn-pause'}`}
                  onClick={() => setToggling(tt)}
                  disabled={eventOver}
                  aria-label={tt.salesPaused ? `Resume sales for ${tt.name}` : `Pause sales for ${tt.name}`}
                  title={
                    eventOver
                      ? ENDED_TIP
                      : tt.salesPaused
                        ? 'Resume sales: let people buy this ticket type again'
                        : 'Pause sales: stop new purchases without deleting anything'
                  }
                >
                  {tt.salesPaused ? <PlayIcon /> : <PauseIcon />}
                </button>
              )}
              {/* Colour, ticket design, duplicate and delete are all edits: read-only viewers (check-in staff) get no menu. */}
              {canEdit && (
              <RowMenu label={`More actions for ${tt.name}`}>
                {(close) => (
                  <>
                    <div className="swatch-row" role="group" aria-label="Card colour">
                      <span className="swatch-label">Card colour</span>
                      {CARD_COLOURS.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          className={`swatch${colourOf(tt) === c.value ? ' is-on' : ''}${c.value ? '' : ' swatch-none'}`}
                          style={c.value ? { background: c.value } : undefined}
                          title={eventOver ? ENDED_TIP : c.name}
                          aria-label={c.name}
                          aria-pressed={colourOf(tt) === c.value}
                          disabled={eventOver}
                          onClick={() => void setColour(tt, c.value)}
                        />
                      ))}
                    </div>
                    {eventOver ? (
                      <button type="button" className="menu-item" disabled title={ENDED_TIP}>
                        Customize ticket
                      </button>
                    ) : (
                      <Link
                        className="menu-item"
                        to={`/manage/events/${eventId}/ticket-design?type=${tt.id}`}
                        onClick={close}
                      >
                        Customize ticket
                      </Link>
                    )}
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          className="menu-item"
                          disabled={eventOver}
                          title={eventOver ? ENDED_TIP : undefined}
                          onClick={() => {
                            close();
                            openDuplicate(tt);
                          }}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="menu-item menu-item-danger"
                          disabled={eventOver}
                          title={eventOver ? ENDED_TIP : undefined}
                          onClick={() => {
                            close();
                            setDeleting(tt);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </>
                )}
              </RowMenu>
              )}
            </div>
            )}
            </div>
            {canEdit && (
              <button
                type="button"
                className="tt-grip"
                disabled={eventOver}
                title={eventOver ? ENDED_TIP : undefined}
                // Some browsers still deliver pointer events to a disabled button, so the drag checks it too.
                onPointerDown={(e) => !eventOver && beginDrag(e, tt.id)}
                onPointerMove={(e) => moveDrag(e)}
                onPointerUp={() => endDrag()}
                onPointerCancel={() => cancelDrag()}
                onKeyDown={(e) => {
                  if (!eventOver && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    moveBy(tt.id, e.key === 'ArrowUp' ? -1 : 1);
                  }
                }}
              >
                <GripIcon />
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Same safeguard as deleting an event: type the ticket name and re-enter the password. */}
      <DeleteEventDialog
        kind={toggling?.salesPaused ? 'resume' : 'pause'}
        open={toggling !== null}
        eventTitle={toggling?.name ?? ''}
        onCancel={() => setToggling(null)}
        onConfirmed={async () => {
          const tt = toggling;
          if (!tt) return;
          await ticketTypeApi.setSalesStatus(tt.id, tt.salesPaused ? 'ACTIVE' : 'PAUSED');
          setToggling(null);
          reload();
          notify(`${tt.name} ${tt.salesPaused ? 'resumed' : 'paused'}`);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'this ticket type'}?`}
        confirmLabel="Delete"
        cancelLabel="Keep it"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      >
        This removes the ticket type for good. If anyone has bought it, or has it in a cart, it can't be deleted:
        pause its sales instead.
      </ConfirmDialog>

      <dialog
        ref={dialog}
        className="modal modal-landscape"
        aria-labelledby="add-ticket-type-title"
        onCancel={(e) => {
          e.preventDefault(); // Escape closes it
          setAdding(false);
        }}
      >
        <div className="modal-head">
          <h2 id="add-ticket-type-title">{editing ? "Edit ticket type" : "Add ticket type"}</h2>
        </div>
        {/* Which event this is for, so the sale window can be set against its dates. */}
        <p className="tt-for-event">
          <strong>{eventTitle}</strong>
          <span className="muted small">
            {formatDateTime(eventStartAt, timezone)} → {formatDateTime(eventEndAt, timezone)}
          </span>
        </p>
        {copyOf && <p className="hint">Starting from a copy of {copyOf}. Check the dates and price, then add it.</p>}
        <ErrorBox message={err} />
        <form className="form tt-form" onSubmit={onSubmit}>
          <div className="tt-form-grid">
            <fieldset className="form-group">
              <legend>Basics</legend>
              <TextField label="Name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
              <SelectField
                label="Kind"
                hint={editing ? "The kind can't be changed after creation." : undefined}
                disabled={editing !== null}
                value={kind}
                onChange={(e) => setKind(e.target.value as TicketTypeKind)}
              >
                <option value="GENERAL_ADMISSION">General admission</option>
                <option value="RESERVED_SEATING">Reserved seating</option>
              </SelectField>
            </fieldset>

            <fieldset className="form-group">
              <legend>Price and stock</legend>
              <div className="form-row">
                <TextField label="Price" type="number" required min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                <SelectField label="Currency" required value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {/* A ticket type saved in a currency not listed here keeps it. */}
                  {(CURRENCIES.some((c) => c.code === currency) ? CURRENCIES : [{ code: currency }, ...CURRENCIES]).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </SelectField>
              </div>
              {kind === 'RESERVED_SEATING' && !editing && (
                <div className="form-row">
                  <SelectField label="Seats from" hint="Copy the seats of a seat layout, or leave it to just set a quantity." value={layoutId} onChange={(e) => { setLayoutId(e.target.value); setSectionId(WHOLE_LAYOUT); }}>
                    <option value="">A quantity (no seat map)</option>
                    {seatLayouts.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </SelectField>
                  {layoutId && (
                    <SelectField label="Section" hint="The seats are copied now; editing the layout later does not change them." value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                      <option value={WHOLE_LAYOUT}>Whole layout{pickedLayout ? ` (${seatsForSale(pickedLayout.sections)} seats)` : ''}</option>
                      {(pickedLayout?.sections ?? []).map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.name} ({seatsForSale([sec])} seats)
                        </option>
                      ))}
                    </SelectField>
                  )}
                </div>
              )}
              <div className="form-row">
                {!(kind === 'RESERVED_SEATING' && !editing && layoutId) && (
                <TextField
                  label="Quantity"
                  type="number"
                  required
                  min={editing ? Math.max(1, editing.quantityTotal - editing.quantityAvailable) : 1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                )}
                <TextField
                  label={
                    <>
                      Max per order <span className="hint">(default 10)</span>
                    </>
                  }
                  type="number"
                  min={1}
                  max={userLimit ?? undefined}
                  value={maxPerOrder}
                  onChange={(e) => setMaxPerOrder(e.target.value)}
                />
              </div>
              <div className="form-row">
                <TextField
                  label={
                    <>
                      Max per buyer <span className="hint">(blank = unlimited)</span>
                    </>
                  }
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={maxPerUser}
                  onChange={(e) => setMaxPerUser(e.target.value)}
                />
              </div>
              {limitWarning && (
                <p className="hint warn" role="alert">
                  {limitWarning}
                </p>
              )}
              {editing && Number(quantity) !== editing.quantityTotal && (
                <p className="hint">
                  Tickets already sold or held ({editing.quantityTotal - editing.quantityAvailable}) are kept. The
                  quantity can't go below them.
                </p>
              )}
            </fieldset>

            <fieldset className="form-group form-group-wide">
              <legend>Sale window</legend>
              <DateTimeField
                dateLabel="Sale start date"
                timeLabel="Sale start time"
                required={!startNow}
                disabled={startNow}
                maxDate={latestEnd.date}
                date={saleStartDate}
                time={saleStartTime}
                onDate={setSaleStartDate}
                onTime={setSaleStartTime}
                // Remounted when "Start now" changes, so a half-picked time is cleared too.
                timeKey={startNow ? 'now' : 'set'}
              />
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={startNow}
                  onChange={(e) => {
                    setStartNow(e.target.checked);
                    if (e.target.checked) {
                      setSaleStartDate('');
                      setSaleStartTime('');
                    }
                  }}
                />
                Start now (the sale starts the moment it is saved)
              </label>
              <DateTimeField
                dateLabel="Sale end date"
                timeLabel="Sale end time"
                required
                minDate={saleStartDate || undefined}
                maxDate={latestEnd.date}
                date={saleEndDate}
                time={saleEndTime}
                onDate={setSaleEndDate}
                onTime={setSaleEndTime}
              />
              <p className={`date-status small ${saleWarning ? 'warn' : 'muted'}`} role={saleWarning ? 'alert' : undefined}>
                {saleWarning ??
                  `Times in ${timezone}. Sales run at least ${minDuration} and close by ${formatDateTime(new Date(latestEndMs).toISOString(), timezone)}${
                    saleRules.salesCloseMinutesBeforeEvent ? `, ${closeBefore} before the event ends` : ', when the event ends'
                  }.`}
              </p>
            </fieldset>
          </div>
          {blocker && (
            <p className="hint warn" role="alert">
              {blocker}
            </p>
          )}
          <FormActions
            onCancel={() => setAdding(false)}
            submitLabel={editing ? 'Save changes' : 'Add ticket type'}
            submitDisabled={Boolean(blocker)}
            submitTitle={blocker ?? undefined}
          />
        </form>
      </dialog>
    </section>
  );
}

function EventOrders({ eventId }: { eventId: string }) {
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useAsync(
    () => eventApi.orders(eventId, { page, size: 10, sort: 'createdAt,desc' }),
    [eventId, page],
  );

  return (
    <section>
      <h2>
        Orders
        <RefreshButton onClick={reload} busy={loading} label="Reload orders" />
        {data && data.totalElements > 0 && (
          <span className="count-badge" aria-label={`${data.totalElements} orders`}>
            {data.totalElements}
          </span>
        )}
      </h2>
      <ErrorBox message={error} />
      {data && data.content.length === 0 ? (
        <Empty>No orders yet.</Empty>
      ) : (
        data && (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Placed</th>
                  <th>Tickets</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((o, i) => (
                  <tr key={o.id}>
                    <td>{page * data.size + i + 1}</td>
                    <td>
                      <code>{o.id.slice(0, 8)}</code>
                    </td>
                    <td>
                      <code>{o.buyerId.slice(0, 8)}</code>
                    </td>
                    <td>{formatDateTime(o.createdAt)}</td>
                    <td>{o.tickets.length}</td>
                    <td>{formatMoney(o.total)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={data} onChange={setPage} />
          </>
        )
      )}
    </section>
  );
}
