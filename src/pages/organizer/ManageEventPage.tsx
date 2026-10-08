import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { eventApi, promoApi, ticketTemplateApi, ticketTypeApi } from '../../api/endpoints';
import type { Event, PromoCode, PromoCodeCreateRequest, TicketType, TicketTypeKind, TicketTypeUpdateRequest } from '../../api/types';
import { CategorySelect } from '../../components/CategorySelect';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DeleteEventDialog } from '../../components/DeleteEventDialog';
import { CheckIcon, ChevronDownIcon, EditIcon, EyeIcon, GripIcon, PauseIcon, PlayIcon, TicketIcon } from '../../components/DesignerIcons';
import { Empty, ErrorBox, Pagination, Spinner, StatusBadge } from '../../components/ui';
import { formatDateTime, formatMoney, humanize, isoToLocalInput, localInputToIso } from '../../utils/format';
import { sortTicketTypes } from '../../utils/ticketTypes';
import { useAsync } from '../../utils/useAsync';

export function ManageEventPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { data: event, setData: setEvent, error, loading } = useAsync(
    () => eventApi.get(eventId),
    [eventId],
  );
  // Whether the event has any ticket layout yet: without one the "Design ticket" button shows a "!".
  const { data: templates } = useAsync(() => ticketTemplateApi.list(eventId), [eventId]);
  // Ticket types are loaded here so the launch checklist and the list below share one query.
  const typesQuery = useAsync(() => ticketTypeApi.list(eventId), [eventId]);
  // Promo codes of the event: the ticket types list shows how many apply to each type.
  const promoQuery = useAsync(() => promoApi.list(eventId), [eventId]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);

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

  const canPublish = event.status === 'DRAFT';
  const canCancel = !['CANCELLED', 'COMPLETED'].includes(event.status);

  return (
    <div className="manage-page">
      <section className="event-hero">
        <div className="title-with-status">
          <h1>{event.title}</h1>
          <StatusBadge status={event.status} />
          <button
            type="button"
            className="icon-button hero-edit"
            onClick={() => setEditingDetails(true)}
            title="Edit title, category and description"
            aria-label="Edit event details"
          >
            <EditIcon />
          </button>
        </div>
        <p className="event-hero-when">
          {formatDateTime(event.startAt, event.timezone)} · prefix <code>{event.ticketPrefix}</code>
          {event.category && <span className="hero-category">{humanize(event.category)}</span>}
        </p>
        {event.description && <p className="event-hero-about">{event.description}</p>}
        <ErrorBox message={actionError} />
        <div className="actions">
        <Link
          to={`/events/${event.id}`}
          className="btn btn-outline-cta"
          title="See this event the way buyers see it"
        >
          <EyeIcon />
          View public page
        </Link>
        <Link
          to={`/manage/events/${event.id}/ticket-design`}
          className="btn"
          title={templates && templates.length === 0 ? "No ticket layout yet - design one" : undefined}
        >
          Design ticket
          {templates && templates.length === 0 && (
            <span className="btn-badge" aria-label="No ticket layout yet">
              !
            </span>
          )}
        </Link>
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
            disabled={busy}
            onClick={() => setConfirmingCancel(true)}
          >
            Cancel event
          </button>
        )}
        <button
          className="btn btn-link danger"
          disabled={busy}
          onClick={() => setConfirmingDelete(true)}
        >
          Delete
        </button>
        </div>
      </section>

      <LaunchChecklist
        event={event}
        typeCount={typesQuery.data?.length ?? null}
        layoutCount={templates?.length ?? null}
        busy={busy}
        onPublish={() => act(() => eventApi.publish(event.id))}
      />

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

      <EditDetailsDialog
        event={event}
        open={editingDetails}
        onClose={() => setEditingDetails(false)}
        onSaved={setEvent}
      />

      <TicketTypes
        eventId={event.id}
        query={typesQuery}
        promoQuery={promoQuery}
        ownDesignTypeIds={new Set((templates ?? []).map((t) => t.ticketTypeId).filter((id): id is string => Boolean(id)))}
      />
      <EventOrders eventId={event.id} />
    </div>
  );
}

/**
 * "Ready for showtime": the steps between a new draft and a live event, with progress. Each open step
 * has the button that does it. Draft events only; a live event gets a short celebration instead.
 */
function LaunchChecklist({
  event,
  typeCount,
  layoutCount,
  busy,
  onPublish,
}: {
  event: Event;
  /** null = still loading */
  typeCount: number | null;
  layoutCount: number | null;
  busy: boolean;
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
      action: (
        <a href="#ticket-types" className="btn btn-sm">
          Add ticket types
        </a>
      ),
    },
    {
      key: 'design',
      title: 'Ticket design',
      hint: layoutCount ? 'Your ticket has a look' : 'Make a ticket people will want to keep',
      done: Boolean(layoutCount),
      action: (
        <Link to={`/manage/events/${event.id}/ticket-design`} className="btn btn-sm">
          Design ticket
        </Link>
      ),
    },
    {
      key: 'publish',
      title: 'Publish',
      hint: 'Open ticket sales to everyone',
      done: false,
      action: (
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={onPublish}>
          Publish
        </button>
      ),
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
function EditDetailsDialog({
  event,
  open,
  onClose,
  onSaved,
}: {
  event: Event;
  open: boolean;
  onClose: () => void;
  onSaved: (e: Event) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [category, setCategory] = useState(event.category);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      // Start from what is saved, not from an abandoned edit.
      setTitle(event.title);
      setDescription(event.description);
      setCategory(event.category);
      setErr(null);
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, event]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      onSaved(await eventApi.update(event.id, { title, description, category }));
      onClose();
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal modal-wide"
      aria-labelledby="edit-details-title"
      onCancel={(e) => {
        e.preventDefault(); // Escape closes it
        if (!busy) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id="edit-details-title">Edit event details</h2>
      </div>
      <ErrorBox message={err} />
      <form className="form" onSubmit={onSubmit}>
        <label>
          Title
          <input maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Category
          <CategorySelect value={category} onChange={setCategory} required />
        </label>
        <label>
          Description
          <textarea
            rows={5}
            maxLength={10000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <p className="hint">Venue, dates and timezone can't be changed after creation.</p>
        <div className="modal-actions">
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

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
function ticketStatus(tt: TicketType): { label: string; tone: 'good' | 'warn' | 'bad' | 'info' | 'muted' } {
  const now = Date.now();
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

/** The promo codes that apply to one ticket type, and a form to make a new one for it. */
function PromoCodesDialog({
  eventId,
  ticketType,
  codes,
  onClose,
  onCreated,
}: {
  eventId: string;
  ticketType: TicketType | null;
  codes: PromoCode[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState('');
  const [type, setType] = useState<PromoCodeCreateRequest['discountType']>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [limitTotal, setLimitTotal] = useState('');
  const [limitPerBuyer, setLimitPerBuyer] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const open = ticketType !== null;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      setCode('');
      setType('PERCENTAGE');
      setValue('');
      setLimitTotal('');
      setLimitPerBuyer('');
      setFrom(ticketType ? isoToLocalInput(ticketType.saleStartAt) : '');
      setUntil(ticketType ? isoToLocalInput(ticketType.saleEndAt) : '');
      setErr(null);
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, ticketType]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ticketType) return;
    setBusy(true);
    setErr(null);
    try {
      await promoApi.create(eventId, {
        code: code.trim().toUpperCase(),
        discountType: type,
        discountValue: type === 'PERCENTAGE' ? Number(value) : Math.round(Number(value) * 100),
        applicableTicketTypeIds: [ticketType.id],
        usageLimitTotal: limitTotal ? Number(limitTotal) : undefined,
        usageLimitPerBuyer: limitPerBuyer ? Number(limitPerBuyer) : undefined,
        validFrom: localInputToIso(from),
        validUntil: localInputToIso(until),
      });
      setCode('');
      setValue('');
      onCreated();
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal modal-wide"
      aria-labelledby="promo-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id="promo-title">Promo codes for {ticketType?.name}</h2>
      </div>
      {codes.length === 0 ? (
        <p className="muted small">No promo codes apply to this ticket type yet.</p>
      ) : (
        <ul className="plain-list promo-list">
          {codes.map((p) => (
            <li key={p.id} className="row-between">
              <span>
                <code>{p.code}</code> <strong>{discountText(p, ticketType?.price.currency ?? 'USD')}</strong>
                <span className="muted small">
                  {' '}
                  · {p.applicableTicketTypeIds?.length ? 'this type only' : 'every ticket type'} · until{' '}
                  {formatDateTime(p.validUntil)}
                  {p.usageLimitTotal ? ` · ${p.usageLimitTotal} uses` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <ErrorBox message={err} />
      <h3 className="promo-new">New promo code for this type</h3>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Code
          <input required maxLength={50} value={code} onChange={(e) => setCode(e.target.value)} placeholder="EARLYBIRD" />
        </label>
        <div className="two-col">
          <label>
            Discount
            <select value={type} onChange={(e) => setType(e.target.value as PromoCodeCreateRequest['discountType'])}>
              <option value="PERCENTAGE">Percent off</option>
              <option value="FIXED">Amount off</option>
            </select>
          </label>
          <label>
            {type === 'PERCENTAGE' ? 'Percent (0-100)' : 'Amount'}
            <input
              type="number"
              required
              min={0}
              max={type === 'PERCENTAGE' ? 100 : undefined}
              step={type === 'PERCENTAGE' ? 1 : 0.01}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        </div>
        <div className="two-col">
          <label>
            Valid from
            <input type="datetime-local" required value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Valid until
            <input type="datetime-local" required value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
        </div>
        <div className="two-col">
          <label>
            Total uses <span className="hint">(optional)</span>
            <input type="number" min={1} value={limitTotal} onChange={(e) => setLimitTotal(e.target.value)} />
          </label>
          <label>
            Per buyer <span className="hint">(optional)</span>
            <input type="number" min={1} value={limitPerBuyer} onChange={(e) => setLimitPerBuyer(e.target.value)} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Adding...' : 'Add promo code'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function TicketTypes({
  eventId,
  query,
  promoQuery,
  ownDesignTypeIds,
}: {
  eventId: string;
  query: ReturnType<typeof useAsync<TicketType[]>>;
  promoQuery: ReturnType<typeof useAsync<PromoCode[]>>;
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

  // A colour for each ticket type card, remembered in this browser (the API has no colour field yet).
  const [colors, setColors] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("ticketTypeColors") ?? "{}") as Record<string, string>;
    } catch {
      return {};
    }
  });
  function setColour(id: string, value: string | null) {
    setColors((prev) => {
      const next = { ...prev };
      if (value) next[id] = value;
      else delete next[id];
      try {
        localStorage.setItem("ticketTypeColors", JSON.stringify(next));
      } catch {
        /* blocked storage: the colour just is not remembered */
      }
      return next;
    });
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
  const [currency, setCurrency] = useState('USD');
  const [quantity, setQuantity] = useState('');
  const [saleStart, setSaleStart] = useState('');
  const [saleEnd, setSaleEnd] = useState('');
  const [maxPerOrder, setMaxPerOrder] = useState('');
  const [err, setErr] = useState<string | null>(null);
  // The "add" form lives in its own window (a modal dialog), opened by the button in the section header.
  const [adding, setAdding] = useState(false);
  // The ticket type being edited in that same window (null = adding a new one).
  const [editing, setEditing] = useState<TicketType | null>(null);
  // Name of the ticket type a new one is being copied from (for the hint in the window).
  const [copyOf, setCopyOf] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  function openAdd() {
    setEditing(null);
    setCopyOf(null);
    setName('');
    setKind('GENERAL_ADMISSION');
    setPrice('');
    setCurrency('USD');
    setQuantity('');
    setSaleStart('');
    setSaleEnd('');
    setMaxPerOrder('');
    setAdding(true);
  }

  // Promo codes: the ticket type whose codes are open in their own window, and the codes that apply to a type.
  const [promoFor, setPromoFor] = useState<TicketType | null>(null);
  const promosFor = (tt: TicketType) =>
    (promoQuery.data ?? []).filter((p) => !p.applicableTicketTypeIds?.length || p.applicableTicketTypeIds.includes(tt.id));

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
    setSaleStart(isoToLocalInput(tt.saleStartAt));
    setSaleEnd(isoToLocalInput(tt.saleEndAt));
    setMaxPerOrder(String(tt.maxPerOrder));
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
    try {
      if (editing) {
        // Send only what changed: the server resets the remaining stock whenever quantityTotal is sent.
        const body: TicketTypeUpdateRequest = {};
        const amount = Math.round(Number(price) * 100);
        if (name !== editing.name) body.name = name;
        if (amount !== editing.price.amount || currency.toUpperCase() !== editing.price.currency) {
          body.price = { amount, currency: currency.toUpperCase() };
        }
        if (Number(quantity) !== editing.quantityTotal) body.quantityTotal = Number(quantity);
        if (localInputToIso(saleStart) !== new Date(editing.saleStartAt).toISOString()) body.saleStartAt = localInputToIso(saleStart);
        if (localInputToIso(saleEnd) !== new Date(editing.saleEndAt).toISOString()) body.saleEndAt = localInputToIso(saleEnd);
        if (maxPerOrder && Number(maxPerOrder) !== editing.maxPerOrder) body.maxPerOrder = Number(maxPerOrder);
        if (Object.keys(body).length > 0) await ticketTypeApi.update(editing.id, body);
        reload();
        setAdding(false);
        return;
      }
      await ticketTypeApi.create(eventId, {
        name,
        kind,
        price: { amount: Math.round(Number(price) * 100), currency: currency.toUpperCase() },
        quantityTotal: Number(quantity),
        saleStartAt: localInputToIso(saleStart),
        saleEndAt: localInputToIso(saleEnd),
        maxPerOrder: maxPerOrder ? Number(maxPerOrder) : undefined,
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
          {data && (
            <>
              <span className="count-badge" aria-label={`${data.length} ticket types`}>
                {data.length}
              </span>
              {data.length > 0 && (
                <span className="muted small">
                  {data.reduce((n, t) => n + t.quantityTotal, 0)} tickets · {data.reduce((n, t) => n + (t.quantityTotal - t.quantityAvailable), 0)} sold
                </span>
              )}
            </>
          )}
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
          + Add ticket type
        </button>
      </div>
      <ErrorBox message={error ?? rowError} />
      {savedNote && (
        <div className="toast" role="status">
          <CheckIcon /> {savedNote}
        </div>
      )}
      {data && data.length === 0 && (
        <p className="muted small">None yet. Add the first one to start selling.</p>
      )}
      <ul className="plain-list">
        {sortedTypes.map((tt) => (
          <li
            key={tt.id}
            className={`tt-row tt-${ticketStatus(tt).tone}${tt.salesPaused ? " is-paused" : ""}${colors[tt.id] ? " has-color" : ""}${dragId === tt.id ? " is-dragging" : ""}${overId === tt.id && dragId !== tt.id ? " is-drop-target" : ""}`}
            data-tt-id={tt.id}
            style={
              {
                ...(colors[tt.id] ? { "--tt-color": colors[tt.id] } : {}),
                ...(dragId === tt.id ? { transform: `translateY(${dragDy}px)`, zIndex: 40 } : {}),
              } as CSSProperties
            }
          >
            <div className="tt-main">
              <div className="tt-name">
                <strong>{tt.name}</strong>
                <button
                  type="button"
                  className="btn btn-sm btn-icon tt-edit"
                  onClick={() => openEdit(tt)}
                  aria-label={`Edit ${tt.name}`}
                  title="Edit"
                >
                  <EditIcon />
                </button>
                <span className={`status-chip status-${ticketStatus(tt).tone}`}>{ticketStatus(tt).label}</span>
                <span
                  className="tt-design"
                  tabIndex={0}
                  role="img"
                  aria-label={ownDesignTypeIds.has(tt.id) ? 'Uses its own ticket design' : 'Uses the "All ticket types" ticket design'}
                  data-tip={ownDesignTypeIds.has(tt.id) ? 'Own ticket design' : 'Uses the "All ticket types" design'}
                >
                  <TicketIcon />
                </span>
              </div>
              <p className="muted small tt-meta">{humanize(tt.kind)}</p>
              <p className="muted small tt-meta tt-window">
                <span>On sale</span>
                <span className="nowrap">{formatDateTime(tt.saleStartAt)}</span>
                <span aria-hidden="true">→</span>
                <span className="nowrap">{formatDateTime(tt.saleEndAt)}</span>
              </p>
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
            </div>
            <div className="tt-stub">
            <strong className="tt-price">{formatMoney(tt.price)}</strong>
            <div className="tt-actions">
              <button
                type="button"
                className={`btn btn-sm btn-icon ${tt.salesPaused ? 'btn-resume' : 'btn-pause'}`}
                onClick={() => setToggling(tt)}
                aria-label={tt.salesPaused ? `Resume sales for ${tt.name}` : `Pause sales for ${tt.name}`}
                title={tt.salesPaused ? 'Resume sales: let people buy this ticket type again' : 'Pause sales: stop new purchases without deleting anything'}
              >
                {tt.salesPaused ? <PlayIcon /> : <PauseIcon />}
              </button>
              <RowMenu label={`More actions for ${tt.name}`}>
                {(close) => (
                  <>
                    <div className="swatch-row" role="group" aria-label="Card colour">
                      <span className="swatch-label">Card colour</span>
                      {CARD_COLOURS.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          className={`swatch${(colors[tt.id] ?? null) === c.value ? ' is-on' : ''}${c.value ? '' : ' swatch-none'}`}
                          style={c.value ? { background: c.value } : undefined}
                          title={c.name}
                          aria-label={c.name}
                          aria-pressed={(colors[tt.id] ?? null) === c.value}
                          onClick={() => setColour(tt.id, c.value)}
                        />
                      ))}
                    </div>
                    <Link
                      className="menu-item"
                      to={`/manage/events/${eventId}/ticket-design?type=${tt.id}`}
                      onClick={close}
                    >
                      Design ticket
                    </Link>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        close();
                        setPromoFor(tt);
                      }}
                    >
                      Promo codes ({promosFor(tt).length})
                    </button>
                    <button
                      type="button"
                      className="menu-item"
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
                      onClick={() => {
                        close();
                        setDeleting(tt);
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </RowMenu>
            </div>
            </div>
            <button
              type="button"
              className="tt-grip"
              onPointerDown={(e) => beginDrag(e, tt.id)}
              onPointerMove={(e) => moveDrag(e)}
              onPointerUp={() => endDrag()}
              onPointerCancel={() => cancelDrag()}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  moveBy(tt.id, e.key === 'ArrowUp' ? -1 : 1);
                }
              }}
            >
              <GripIcon />
            </button>
          </li>
        ))}
      </ul>

      <PromoCodesDialog
        eventId={eventId}
        ticketType={promoFor}
        codes={promoFor ? promosFor(promoFor) : []}
        onClose={() => setPromoFor(null)}
        onCreated={promoQuery.reload}
      />

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
        {copyOf && <p className="hint">Starting from a copy of {copyOf}. Check the dates and price, then add it.</p>}
        <ErrorBox message={err} />
        <form className="form tt-form" onSubmit={onSubmit}>
          <div className="tt-form-grid">
            <fieldset className="form-group">
              <legend>Basics</legend>
              <label>
                Name
                <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Kind
                <select disabled={editing !== null} value={kind} onChange={(e) => setKind(e.target.value as TicketTypeKind)}>
                  <option value="GENERAL_ADMISSION">General admission</option>
                  <option value="RESERVED_SEATING">Reserved seating</option>
                </select>
                {editing && <span className="hint">The kind can't be changed after creation.</span>}
              </label>
            </fieldset>

            <fieldset className="form-group">
              <legend>Price and stock</legend>
              <div className="form-row">
                <label>
                  Price
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </label>
                <label>
                  Currency
                  <input
                    required
                    pattern="[A-Za-z]{3}"
                    maxLength={3}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Quantity
                  <input
                    type="number"
                    required
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
                <label>
                  Max per order <span className="hint">(default 10)</span>
                  <input
                    type="number"
                    min={1}
                    value={maxPerOrder}
                    onChange={(e) => setMaxPerOrder(e.target.value)}
                  />
                </label>
              </div>
              {editing && Number(quantity) !== editing.quantityTotal && (
                <p className="hint">Saving resets the remaining tickets to the new quantity.</p>
              )}
            </fieldset>

            <fieldset className="form-group form-group-wide">
              <legend>Sale window</legend>
              <div className="form-row">
                <label>
                  Sale starts
                  <input
                    type="datetime-local"
                    required
                    value={saleStart}
                    onChange={(e) => setSaleStart(e.target.value)}
                  />
                </label>
                <label>
                  Sale ends
                  <input
                    type="datetime-local"
                    required
                    value={saleEnd}
                    onChange={(e) => setSaleEnd(e.target.value)}
                  />
                </label>
              </div>
            </fieldset>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="btn btn-primary">{editing ? 'Save changes' : 'Add ticket type'}</button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

function EventOrders({ eventId }: { eventId: string }) {
  const [page, setPage] = useState(0);
  const { data, error } = useAsync(
    () => eventApi.orders(eventId, { page, size: 10, sort: 'createdAt,desc' }),
    [eventId, page],
  );

  return (
    <section>
      <h2>
        Orders
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
