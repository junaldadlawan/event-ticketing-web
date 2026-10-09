import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { eventApi, orderApi, ticketApi, ticketTypeApi } from '../api/endpoints';
import type { Event, Ticket, TicketType } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ChevronDownIcon, QrIcon } from '../components/DesignerIcons';
import { TicketViewer } from '../components/TicketViewer';
import { parseUserQr, readQrFromImage } from '../utils/userQr';
import { ErrorBox, Spinner, StatusBadge, SuccessBox } from '../components/ui';
import { formatDateTime, formatMoney, humanize } from '../utils/format';
import { useAsync } from '../utils/useAsync';

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const location = useLocation();
  const justPurchased = (location.state as { justPurchased?: boolean } | null)?.justPurchased;

  const { data, error, loading, reload } = useAsync(async () => {
    const order = await orderApi.get(orderId);
    const typeIds = [...new Set(order.tickets.map((t) => t.ticketTypeId))];
    const eventIds = [...new Set(order.tickets.map((t) => t.eventId))];
    const [types, events] = await Promise.all([
      Promise.all(typeIds.map((id) => ticketTypeApi.get(id))),
      Promise.all(eventIds.map((id) => eventApi.get(id))),
    ]);
    return {
      order,
      types: new Map(types.map((t) => [t.id, t])),
      events: new Map(events.map((e) => [e.id, e])),
    };
  }, [orderId]);

  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? 'Order not found'} />;
  const { order, types, events } = data;
  // The event the hero talks about: the first ticket's (an order is for one event).
  const heroEvent = order.tickets[0] ? events.get(order.tickets[0].eventId) : undefined;

  return (
    <>
      {justPurchased && <SuccessBox message="Payment successful — your tickets are below." />}
      <section className="order-hero">
        <div className="order-hero-text">
          <p className="order-kicker">
            Order <code>{order.id.slice(0, 8)}</code> <StatusBadge status={order.status} />
          </p>
          <h1>
            {order.status === 'PAID' && heroEvent ? (
              <>
                You're going to <span className="order-hero-event">{heroEvent.title}</span>!
              </>
            ) : (
              <>Your order</>
            )}
          </h1>
          <div className="order-facts">
            <span className="order-fact">
              <small>Placed</small>
              {formatDateTime(order.createdAt)}
            </span>
            <span className="order-fact">
              <small>Total</small>
              {formatMoney(order.total)}
            </span>
            {order.platformFee && order.platformFee.amount > 0 && (
              <span className="order-fact">
                <small>Platform fee</small>
                {formatMoney(order.platformFee)}
              </span>
            )}
            <span className="order-fact">
              <small>Tickets</small>
              {order.tickets.length}
            </span>
            {order.promoCode && (
              <span className="order-fact">
                <small>Promo</small>
                <code>{order.promoCode}</code>
              </span>
            )}
          </div>
        </div>
        {heroEvent && <BigCountdown startAt={heroEvent.startAt} endAt={heroEvent.endAt} />}
      </section>

      <section className="tickets-panel" aria-label="Tickets in this order">
        <div className="section-title">
          <h2>Tickets</h2>
          <span className="count-badge" aria-label={`${order.tickets.length} tickets`}>
            {order.tickets.length}
          </span>
        </div>
        <div className="stack">
          {order.tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              ticketType={types.get(t.ticketTypeId)}
              event={events.get(t.eventId)}
              onChanged={reload}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function TicketCard({
  ticket,
  ticketType,
  event,
  onChanged,
}: {
  ticket: Ticket;
  ticketType?: TicketType;
  event?: Event;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [toUserId, setToUserId] = useState('');
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  // True while the recipient shown came from an uploaded QR picture (shows a small note).
  const [fromQr, setFromQr] = useState(false);
  const [showFormats, setShowFormats] = useState(false);
  // The ticket file shown in our own window (with Close and Download) instead of a bare new tab.
  const [viewing, setViewing] = useState<{ url: string; format: 'digital' | 'physical' } | null>(null);
  function closeViewer() {
    setViewing((v) => {
      if (v) URL.revokeObjectURL(v.url);
      return null;
    });
  }
  const ownedByMe = user?.id === ticket.ownerId;
  const usable = ticket.status === 'VALID' && ownedByMe;

  async function openArtifact(format: 'digital' | 'physical') {
    setBusy(true);
    setError(null);
    try {
      const blob = await ticketApi.artifact(ticket.id, format);
      closeViewer(); // frees a previous ticket's file first
      setViewing({ url: URL.createObjectURL(blob), format });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** A picture of the recipient's "My QR": read the user ID out of it and fill the recipient in. */
  async function onQrFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same picture again
    if (!file) return;
    setError(null);
    try {
      const id = parseUserQr(await readQrFromImage(file));
      if (!id) throw new Error("That QR code isn't a ticket transfer QR. Ask the recipient for the QR from their Profile page.");
      setToUserId(id);
      setFromQr(true);
    } catch (err) {
      setFromQr(false);
      setError(errorMessage(err));
    }
  }

  /** The form was submitted: ask first (our own dialog, not the browser's pop-up), then transfer. */
  function onTransferSubmit(e: FormEvent) {
    e.preventDefault();
    setConfirmingTransfer(true);
  }

  async function onTransfer() {
    setConfirmingTransfer(false);
    setBusy(true);
    setError(null);
    try {
      await ticketApi.transfer(ticket.id, toUserId.trim());
      setNotice('Ticket transferred.');
      setShowTransfer(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // The colour the organizer picked for this ticket type (the Card colour swatches on the manage page). It is
  // kept in this browser, so it shows on the strip wherever that browser is used; the API stores no colour yet.
  const cardColour = (() => {
    try {
      const all = JSON.parse(localStorage.getItem('ticketTypeColors') ?? '{}') as Record<string, string>;
      return all[ticket.ticketTypeId] ?? null;
    } catch {
      return null;
    }
  })();
  // The ticket's status in the same words and colours as the ticket cards elsewhere.
  const tone: 'good' | 'warn' | 'bad' | 'info' | 'muted' =
    ticket.status === 'VALID' ? 'good' : ticket.status === 'USED' ? 'muted' : /CANCEL|REFUND|VOID/.test(ticket.status) ? 'bad' : 'info';

  return (
    <div
      className={`tt-row ticket-owned tt-${tone}${ownedByMe ? "" : " is-given"}${cardColour ? " has-color" : ""}`}
      style={cardColour ? ({ "--tt-color": cardColour } as CSSProperties) : undefined}
    >
      <div className="tt-main">
        <div className="tt-name">
          <h3>{ticketType?.name ?? 'Ticket'}</h3>
          <span className={`status-chip status-${tone}`}>{humanize(ticket.status)}</span>
        </div>
        <p className="muted small tt-meta">
          {event ? (
            <>
              <Link to={`/events/${event.id}`}>{event.title}</Link> · {formatDateTime(event.startAt, event.timezone)}
            </>
          ) : (
            ticket.eventId
          )}
        </p>
        {event && <Countdown startAt={event.startAt} endAt={event.endAt} />}
        <p className="small tt-meta">
          Ticket no. <code>{ticket.ticketNumber}</code>
          {!ownedByMe && <span className="muted"> · no longer owned by you</span>}
        </p>
        {/* Errors from the transfer window show in the window itself, not behind it. */}
        {!showTransfer && <ErrorBox message={error} />}
        <SuccessBox message={notice} />
      </div>

      <div className="tt-stub">
        {ticketType && <strong className="tt-price">{formatMoney(ticketType.price)}</strong>}
        {usable ? (
          <div className="owned-actions">
            {/* One "View ticket" button; clicking it opens the two choices (digital or printable). */}
            <button
              className="btn btn-primary"
              aria-expanded={showFormats}
              aria-controls={`ticket-formats-${ticket.id}`}
              disabled={busy}
              onClick={() => setShowFormats((s) => !s)}
            >
              View ticket
              <span className={`launch-chevron${showFormats ? ' is-open' : ''}`} aria-hidden="true">
                <ChevronDownIcon />
              </span>
            </button>
            {showFormats && (
              <span className="ticket-formats ticket-formats-stack" id={`ticket-formats-${ticket.id}`}>
                <button
                  className="btn btn-sm"
                  disabled={busy}
                  onClick={() => {
                    setShowFormats(false);
                    void openArtifact('digital');
                  }}
                >
                  Digital ticket
                </button>
                <button
                  className="btn btn-sm"
                  disabled={busy}
                  onClick={() => {
                    setShowFormats(false);
                    void openArtifact('physical');
                  }}
                >
                  Printable (PDF)
                </button>
              </span>
            )}
            <button className="btn" onClick={() => setShowTransfer((s) => !s)}>
              Transfer…
            </button>
          </div>
        ) : (
          <span className="muted small">{ownedByMe ? 'Not usable' : 'Transferred'}</span>
        )}
      </div>

      <TransferDialog
        open={showTransfer}
        ticketName={ticketType?.name ?? 'Ticket'}
        toUserId={toUserId}
        fromQr={fromQr}
        busy={busy}
        error={error}
        onChangeId={(v) => {
          setToUserId(v);
          setFromQr(false);
        }}
        onQrFile={onQrFile}
        onSubmit={onTransferSubmit}
        onClose={() => setShowTransfer(false)}
      />

      <TicketViewer
        url={viewing?.url ?? null}
        format={viewing?.format ?? 'digital'}
        title={ticketType?.name ?? 'Ticket'}
        onClose={closeViewer}
      />

      <ConfirmDialog
        open={confirmingTransfer}
        title="Transfer this ticket?"
        confirmLabel="Transfer"
        cancelLabel="Keep it"
        danger
        onCancel={() => setConfirmingTransfer(false)}
        onConfirm={() => void onTransfer()}
      >
        You will no longer own it.
      </ConfirmDialog>
    </div>
  );
}

/** The transfer form in its own window: pick the recipient from their QR picture or paste their user ID. */
function TransferDialog({
  open,
  ticketName,
  toUserId,
  fromQr,
  busy,
  error,
  onChangeId,
  onQrFile,
  onSubmit,
  onClose,
}: {
  open: boolean;
  ticketName: string;
  toUserId: string;
  fromQr: boolean;
  busy: boolean;
  error: string | null;
  onChangeId: (v: string) => void;
  onQrFile: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="transfer-title"
      onCancel={(e) => {
        e.preventDefault(); // Escape closes it
        if (!busy) onClose();
      }}
    >
      <h2 id="transfer-title" className="transfer-title">
        Transfer ticket
      </h2>
      <p className="muted small transfer-sub">{ticketName}</p>
      <ErrorBox message={error} />
      <form className="form transfer-min" onSubmit={onSubmit}>
        <div className="transfer-field">
          <input
            required
            autoFocus
            placeholder="Recipient's user ID"
            aria-label="Recipient's user ID"
            pattern="[0-9a-fA-F-]{36}"
            value={toUserId}
            onChange={(e) => onChangeId(e.target.value)}
          />
          <label className="btn btn-icon transfer-qr" title="Fill it in from their My QR picture">
            <QrIcon />
            <input type="file" accept="image/*" hidden onChange={(e) => void onQrFile(e)} />
          </label>
        </div>
        <p className="muted small transfer-hint">
          {fromQr ? 'Filled in from the QR code.' : 'Find it on their Profile page, or upload their My QR picture.'}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-link" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            Transfer
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** "12 days to go" / "Tomorrow!" / "Today!" / "Happening now" / "This event has ended": counted in calendar days. */
function Countdown({ startAt, endAt }: { startAt: string; endAt?: string | null }) {
  const now = new Date();
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : null;
  const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((dayOf(start) - dayOf(now)) / 86_400_000);

  let label: string;
  let tone: 'soon' | 'later' | 'live' | 'over';
  if (end && now > end) {
    label = 'This event has ended';
    tone = 'over';
  } else if (now >= start) {
    label = 'Happening now';
    tone = 'live';
  } else if (days <= 0) {
    label = 'Today!';
    tone = 'soon';
  } else if (days === 1) {
    label = 'Tomorrow!';
    tone = 'soon';
  } else {
    label = `${days} days to go`;
    tone = days <= 7 ? 'soon' : 'later';
  }
  return (
    <p className={`countdown countdown-${tone}`}>
      <span aria-hidden="true" className="countdown-dot" />
      {label}
    </p>
  );
}

/** The big number in the order hero: days to go, or "Tomorrow" / "Today" / "Live now" / "Done". */
function BigCountdown({ startAt, endAt }: { startAt: string; endAt?: string | null }) {
  const now = new Date();
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : null;
  const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((dayOf(start) - dayOf(now)) / 86_400_000);

  let big: string;
  let small: string;
  if (end && now > end) {
    big = 'Done';
    small = 'what a night';
  } else if (now >= start) {
    big = 'Live';
    small = 'happening now';
  } else if (days <= 0) {
    big = 'Today';
    small = 'see you there!';
  } else if (days === 1) {
    big = 'Tomorrow';
    small = 'get ready!';
  } else {
    big = String(days);
    small = 'days to go';
  }
  return (
    <div className="big-countdown" role="img" aria-label={`${big} ${small}`}>
      <strong>{big}</strong>
      <span>{small}</span>
    </div>
  );
}
