import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent, MouseEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { assetUrl, errorMessage } from '../api/client';
import { eventApi, orderApi, ticketApi, ticketTypeApi } from '../api/endpoints';
import type { Event, Ticket, TicketType } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CheckIcon, ChevronDownIcon, QrIcon, TicketIcon } from '../components/DesignerIcons';
import { FormDialog } from '../components/FormDialog';
import { CARD_NOT_SAVED_KEY } from '../utils/paymongo';
import { ReportProblemDialog } from '../components/ReportProblemDialog';
import { TicketViewer } from '../components/TicketViewer';
import QRCode from 'qrcode';
import { parseUserQr, readQrFromImage } from '../utils/userQr';
import { ErrorBox, Spinner, StatusBadge, SuccessBox } from '../components/ui';
import { formatDateTime, formatMoney, humanize } from '../utils/format';
import { useAsync } from '../utils/useAsync';
import { isEventOver, isOngoing, startsSoonIn } from '../utils/eventState';
import { useNow } from '../utils/useNow';

/** How often an open order re-reads its tickets' status. */
const REFRESH_MS = 10_000;

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const location = useLocation();
  const justPurchased = (location.state as { justPurchased?: boolean } | null)?.justPurchased;

  const { data, setData, error, loading, reload } = useAsync(async () => {
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

  // Keep the tickets current (e.g. one just scanned at the door): re-read the order every few seconds while the tab is
  // visible, and on coming back to it. A failed refresh keeps what is shown.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      orderApi
        .get(orderId)
        .then((order) => setData((d) => (d && d.order.id === order.id ? { ...d, order } : d)))
        .catch(() => {});
    };
    const timer = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [orderId, setData]);

  // After a purchase whose card could not be saved: say so once.
  const [cardNotSaved] = useState(() => {
    try {
      return Boolean(justPurchased) && sessionStorage.getItem(CARD_NOT_SAVED_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    // read once, then forget it (done here, not while reading: React may run the initializer twice)
    try {
      if (justPurchased) sessionStorage.removeItem(CARD_NOT_SAVED_KEY);
    } catch {
      // nothing to clear
    }
  }, [justPurchased]);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? 'Order not found'} />;
  const { order, types, events } = data;
  // The event the hero talks about: the first ticket's (an order is for one event).
  // The payment breakdown: the tickets by type, then promo and fees. Without a promo the subtotal is exact (total minus fees);
  // with one it comes from the ticket prices, and the discount is whatever is left over.
  const money = (amount: number) => ({ amount, currency: order.total.currency });
  const platformFee = order.platformFee?.amount ?? 0;
  const gatewayFee = order.gatewayFee?.amount ?? 0;
  const byType = new Map<string, number>();
  for (const t of order.tickets) byType.set(t.ticketTypeId, (byType.get(t.ticketTypeId) ?? 0) + 1);
  const lines = [...byType].map(([id, count]) => ({ id, count, type: types.get(id) }));
  const fromPrices = lines.every((l) => l.type) ? lines.reduce((n, l) => n + l.count * l.type!.price.amount, 0) : null;
  const subtotal = order.promoCode && fromPrices !== null ? fromPrices : order.total.amount - platformFee - gatewayFee;
  const discount = order.promoCode ? Math.max(0, subtotal + platformFee + gatewayFee - order.total.amount) : 0;
  const heroEvent = order.tickets[0] ? events.get(order.tickets[0].eventId) : undefined;

  return (
    <>
      {justPurchased && <SuccessBox message="Payment successful — your tickets are below." />}
      {cardNotSaved && <p className="small warn">Your card could not be saved. Your payment went through.</p>}
      <section className="order-hero">
        <div className="order-hero-text">
          <p className="order-kicker">
            Order <code>{order.id.slice(0, 8)}</code> <StatusBadge status={order.status} />
          </p>
          <h1>
            {order.status === 'PAID' && heroEvent ? (
              <>
                You're going to {heroEvent.title}!
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
          <details className="order-breakdown">
            <summary>Show all figures</summary>
            <ul className="plain-list">
              {lines.map((l) => (
                <li key={l.id}>
                  <span>
                    {l.type?.name ?? 'Ticket'} × {l.count}
                  </span>
                  <span>{l.type ? formatMoney(money(l.type.price.amount * l.count)) : ''}</span>
                </li>
              ))}
            </ul>
            <div className="row-between">
              <span>Subtotal</span>
              <span>{formatMoney(money(subtotal))}</span>
            </div>
            {order.promoCode && (
              <div className="row-between">
                <span>
                  Promo <code>{order.promoCode}</code>
                </span>
                <span>{discount > 0 ? `−${formatMoney(money(discount))}` : ''}</span>
              </div>
            )}
            {platformFee > 0 && (
              <div className="row-between">
                <span>Platform fee</span>
                <span>{formatMoney(money(platformFee))}</span>
              </div>
            )}
            {gatewayFee > 0 && (
              <div className="row-between">
                <span>Payment processing fee</span>
                <span>{formatMoney(money(gatewayFee))}</span>
              </div>
            )}
            <div className="row-between total">
              <span>Total</span>
              <strong>{formatMoney(order.total)}</strong>
            </div>
          </details>
          <ReportProblemDialog
            orderId={order.id}
            until={heroEvent?.startAt}
            open={reporting}
            onClose={() => setReporting(false)}
            onReported={() => {
              setReporting(false);
              setReported(true);
            }}
          />
        </div>
        {heroEvent && <BigCountdown startAt={heroEvent.startAt} endAt={heroEvent.endAt} />}
      </section>

      <section className="tickets-panel" aria-label="Tickets in this order">
        <div className="section-title">
          <h2>Tickets</h2>
          <span className="count-badge" aria-label={`${order.tickets.length} tickets`}>
            {order.tickets.length}
          </span>
          {order.status === 'PAID' &&
            !(heroEvent && new Date(heroEvent.startAt) <= new Date()) &&
            (reported ? (
              <p className="small muted report-note">Problem reported. We will let you know the outcome.</p>
            ) : (
              <button type="button" className="btn btn-sm report-button" onClick={() => setReporting(true)}>
                Report a problem
              </button>
            ))}
        </div>
        <div className="stack">
          {order.tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              ticketType={types.get(t.ticketTypeId)}
              event={events.get(t.eventId)}
              buyerId={order.buyerId}
              onChanged={reload}
            />
          ))}
        </div>
      </section>
    </>
  );
}

/** The QR code as a door pass: the event on a black slab, a tear line, then the code and ticket number on white. */
function QrPass({
  qr,
  ticket,
  ticketType,
  event,
  scanned,
  onClose,
}: {
  /** The QR code as a PNG data URL; null keeps the pass closed. */
  qr: string | null;
  ticket: Ticket;
  ticketType?: TicketType;
  event?: Event;
  /** The door staff scanned it while the pass was open. */
  scanned: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (qr && !d.open) d.showModal();
    else if (!qr && d.open) d.close();
  }, [qr]);
  // Scanned at the door while the pass is open: show "Scanned" in place of the code, then close.
  useEffect(() => {
    if (!qr || !scanned) return;
    const timer = window.setTimeout(onClose, 3500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr, scanned]);
  return (
    <dialog
      ref={dialog}
      className={`modal qr-pass${scanned ? ' scanned' : ''}`}
      aria-label={`QR code for ticket ${ticket.ticketNumber}`}
      onCancel={(e) => {
        // A file picker inside the window sends its own "cancel" up to here: only the window's own Escape counts.
        if (e.target !== e.currentTarget) return;
        e.preventDefault(); // Escape closes it
        onClose();
      }}
    >
      {qr && (
        <>
          <div className="qr-pass-top">
            <button type="button" className="modal-close" aria-label="Close" title="Close" onClick={onClose}>
              ×
            </button>
            <h2>{event?.title ?? ticketType?.name ?? 'Your ticket'}</h2>
            {event && <p>{formatDateTime(event.startAt, event.timezone)}</p>}
            {ticketType && <p>{ticketType.name} ticket</p>}
          </div>
          <div className="qr-pass-body">
            {scanned ? (
              <div className="qr-pass-scanned" role="status">
                <span className="qr-pass-check" aria-hidden="true">
                  ✓
                </span>
                Scanned
              </div>
            ) : (
              <img src={qr} alt={`QR code for ticket ${ticket.ticketNumber}`} />
            )}
            <strong className="qr-pass-number">{ticket.ticketNumber}</strong>
            {!scanned && event && isOngoing(event) && (
              <p className="qr-pass-invite">What are you waiting for? Come join the event. We're excited to have you!</p>
            )}
            {!scanned && <p>Show this at the entrance. If it won't scan, turn your screen brightness up.</p>}
          </div>
        </>
      )}
    </dialog>
  );
}

export function TicketCard({
  ticket,
  ticketType,
  event,
  buyerId,
  layout = 'row',
  showOrderLink = false,
  onChanged,
}: {
  ticket: Ticket;
  ticketType?: TicketType;
  event?: Event;
  /** Who placed the order: only they can have given a ticket away. Left out where every ticket is the user's own. */
  buyerId?: string;
  /**
   * 'row': the wide ticket with a side stub (order page). 'list': the same with the event's picture behind the stub
   * (My tickets). 'pass': the square card for a grid.
   */
  layout?: 'row' | 'list' | 'pass';
  /** Show an icon to the order it came from (only the buyer may open an order, so only for the user's own orders). */
  showOrderLink?: boolean;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Where the pointer went down on the grid card: a click that ends elsewhere was a drag to select text.
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [toUserId, setToUserId] = useState('');
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  // True while the recipient shown came from an uploaded QR picture (shows a small note).
  const [fromQr, setFromQr] = useState(false);
  const [showFormats, setShowFormats] = useState(false);
  const [showingScan, setShowingScan] = useState(false);
  // The ticket's QR code on its own (a PNG data URL), read from its digital ticket.
  const [qr, setQr] = useState<string | null>(null);
  // The ticket file shown in our own window (with Close and Download) instead of a bare new tab.
  const [viewing, setViewing] = useState<{ url: string; format: 'digital' | 'physical' } | null>(null);
  function closeViewer() {
    setViewing((v) => {
      if (v) URL.revokeObjectURL(v.url);
      return null;
    });
  }
  // While the QR is on screen, ask the API whether the door scanned it. The list is only reloaded once the pass closes:
  // a scanned ticket can move to another group or filter, which would remount this card and tear the pass away.
  const [scanned, setScanned] = useState(false);
  useEffect(() => {
    if (!qr) return;
    const timer = window.setInterval(() => {
      ticketApi
        .get(ticket.id)
        .then((t) => t.status === 'USED' && setScanned(true))
        .catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [qr, ticket.id]);
  function closeQr() {
    setQr(null);
    if (scanned) {
      setScanned(false);
      onChanged();
    }
  }
  const ownedByMe = user?.id === ticket.ownerId;
  // A transfer keeps the ticket VALID and changes its owner, so only the buyer looking at a ticket they no longer
  // own means "transferred". Anyone else who may open the order (the event's organizers) is not its owner either.
  const transferred = !ownedByMe && Boolean(buyerId) && user?.id === buyerId;
  const usable = ticket.status === 'VALID' && ownedByMe;
  // The scan that used it (behind the scan-record icon); only a used ticket has one.
  const checkIn = ticket.status === 'USED' ? ticket.checkIn : null;
  // Like a paper ticket: once used, the stub went to the door staff, so the card ends at the perforation.
  const torn = ticket.status === 'USED';

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

  /**
   * Only the QR code. The API never sends the raw code, so read it from the rendered digital ticket and draw it
   * again; a ticket with no readable QR (a barcode design, say) opens the whole ticket instead.
   */
  async function showQr() {
    setBusy(true);
    setError(null);
    try {
      const blob = await ticketApi.artifact(ticket.id, 'digital');
      const code = await readQrFromImage(new File([blob], 'ticket.png', { type: blob.type || 'image/png' })).catch(() => null);
      if (code) {
        setQr(await QRCode.toDataURL(code, { width: 360, margin: 2, errorCorrectionLevel: 'M' }));
      } else {
        closeViewer();
        setViewing({ url: URL.createObjectURL(blob), format: 'digital' });
      }
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

  // The colour the organizer picked for this ticket type (the Card colour swatches on the manage page).
  const cardColour = ticketType?.color ?? null;
  // The ticket's status in the same words and colours as the ticket cards elsewhere.
  // A ticket nobody scanned before its event finished: still VALID to the API, but it can no longer get anyone in.
  const expired = ticket.status === 'VALID' && Boolean(event && isEventOver(event));
  // Starts in 3 hours or less: the card shakes like the event cards do.
  const now = useNow(60_000).getTime();
  const soon = usable && !expired && Boolean(event && startsSoonIn(event, now)?.shake);
  const statusLabel = expired ? 'Expired, unused' : humanize(ticket.status);
  const tone: 'good' | 'warn' | 'bad' | 'info' | 'muted' =
    expired ? 'muted' : ticket.status === 'VALID' ? 'good' : ticket.status === 'USED' ? 'muted' : /CANCEL|REFUND|VOID/.test(ticket.status) ? 'bad' : 'info';

  // The pieces both layouts share.
  const icons = (
    <>
      {/* The API never sends the raw code: the QR is on the rendered digital ticket. Not once the event is over. */}
      {usable && !expired && (
        <button
          type="button"
          className="icon-button"
          title="Show the QR code"
          aria-label="Show this ticket's QR code"
          disabled={busy}
          onClick={() => void showQr()}
        >
          <QrIcon />
        </button>
      )}
      {checkIn && (
        <button type="button" className="icon-button" title="Scan record" aria-label="Show the scan record" onClick={() => setShowingScan(true)}>
          <CheckIcon />
        </button>
      )}
      {showOrderLink && (
        <Link to={`/orders/${ticket.orderId}`} className="icon-button" title="Purchase details" aria-label="Purchase details">
          <ReceiptIcon />
        </Link>
      )}
    </>
  );
  const facts = (
    <dl className="small ticket-facts">
      <dt>Ticket no.</dt>
      <dd>
        <code>{ticket.ticketNumber}</code>
        {transferred && <span className="muted"> · no longer owned by you</span>}
      </dd>
      {/* The grid card keeps to what a person reads off a ticket. */}
      {layout !== 'pass' && (
        <>
          <dt>Ticket ID</dt>
          <dd>
            <code>{ticket.id}</code>
          </dd>
        </>
      )}
      <dt>Issued</dt>
      <dd>{formatDateTime(ticket.createdAt, event?.timezone)}</dd>
    </dl>
  );
  const messages = (
    <>
      {/* Errors from the transfer window show in the window itself, not behind it. */}
      {!showTransfer && <ErrorBox message={error} />}
      <SuccessBox message={notice} />
    </>
  );
  // The two ways to open the ticket, shown after "View ticket" (the button or the grid card's icon).
  const formats = showFormats && (
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
  );
  const actions = (
    <>
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
          {formats}
          {/* The API refuses a transfer once the event has ended. */}
          {!expired && (
            <button className="btn" onClick={() => setShowTransfer((s) => !s)}>
              Transfer…
            </button>
          )}
        </div>
      ) : (
        <span className="muted small">
          {transferred ? 'Transferred' : ownedByMe ? 'Not usable' : humanize(ticket.status)}
        </span>
      )}
    </>
  );
  const dialogs = (
    <>
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

      <QrPass qr={qr} ticket={ticket} ticketType={ticketType} event={event} scanned={scanned} onClose={closeQr} />

      {checkIn && (
        <FormDialog open={showingScan} title="Scan record" onClose={() => setShowingScan(false)}>
          <dl className="ticket-facts">
            <dt>Scanner ID</dt>
            <dd>
              <code>{checkIn.scannerId}</code>
            </dd>
            <dt>Ticket no.</dt>
            <dd>
              <code>{ticket.ticketNumber}</code>
            </dd>
            <dt>Scanned on</dt>
            <dd>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: event?.timezone }).format(new Date(checkIn.scannedAt))}</dd>
            <dt>Time</dt>
            <dd>{new Intl.DateTimeFormat(undefined, { timeStyle: 'short', timeZone: event?.timezone }).format(new Date(checkIn.scannedAt))}</dd>
            <dt>Location</dt>
            <dd>{checkIn.scannerLocation ?? <span className="muted">Not recorded</span>}</dd>
            <dt>Scanner</dt>
            <dd>{checkIn.scannerName ?? <span className="muted">Fallback scan</span>}</dd>
          </dl>
        </FormDialog>
      )}

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
    </>
  );

  // The event's picture (the first one, as on its page), behind the grid card's slab or the list's stub.
  const cover = layout === 'row' ? undefined : assetUrl(event?.images?.find((u) => u && u.trim()));
  const coverStyle = cover ? ({ '--pass-cover': `url(${JSON.stringify(cover)})` } as CSSProperties) : undefined;

  // On My tickets (grid and list) a click anywhere opens the event (the title link is the keyboard way), but not a
  // click on a control or in a dialog or the ticket facts (double-click copies the number), and not the end of a drag
  // that selected text.
  const opensEvent = Boolean(event) && layout !== 'row';
  const openEvent = opensEvent
    ? {
        onMouseDown: (e: MouseEvent) => {
          downAt.current = { x: e.clientX, y: e.clientY };
        },
        onClick: (e: MouseEvent) => {
          if (!event || (e.target as HTMLElement).closest('a, button, input, label, select, textarea, dialog, .ticket-facts')) return;
          const d = downAt.current;
          if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
          if (window.getSelection()?.toString()) return;
          navigate(`/events/${event.id}`);
        },
      }
    : {};

  // In a grid: a compact square card, the event on the slab, the ticket's actions as icons in its top row.
  if (layout === 'pass') {
    return (
      <article
        className={`pass-card pass-${tone}${cardColour ? ' has-color' : ''}${torn || expired ? ' is-used' : ''}${expired ? ' is-expired' : ''}${soon ? ' is-soon' : ''}${transferred ? ' is-given' : ''}${opensEvent ? ' is-link' : ''}`}
        style={cardColour ? ({ '--tt-color': cardColour } as CSSProperties) : undefined}
        {...openEvent}
      >
        <div
          className={`pass-card-top${cover ? ' has-cover' : ''}`}
          style={coverStyle}
        >
          <div className="pass-card-head">
            <span className={`status-chip status-${tone}`}>{statusLabel}</span>
            {icons}
            {usable && (
              <>
                <button
                  type="button"
                  className="icon-button"
                  title="View ticket"
                  aria-label="View ticket"
                  aria-expanded={showFormats}
                  aria-controls={`ticket-formats-${ticket.id}`}
                  disabled={busy}
                  onClick={() => setShowFormats((s) => !s)}
                >
                  <TicketIcon />
                </button>
                {!expired && (
                  <button
                    type="button"
                    className="icon-button"
                    title="Transfer this ticket"
                    aria-label="Transfer this ticket"
                    onClick={() => setShowTransfer((s) => !s)}
                  >
                    <TransferIcon />
                  </button>
                )}
              </>
            )}
            {ticketType && <strong className="pass-card-price">{formatMoney(ticketType.price)}</strong>}
          </div>
          <h3>{event ? <Link to={`/events/${event.id}`}>{event.title}</Link> : (ticketType?.name ?? 'Ticket')}</h3>
          {event && <p>{formatDateTime(event.startAt, event.timezone)}</p>}
          {ticketType && <p>{ticketType.name} ticket</p>}
          {event && <Countdown startAt={event.startAt} endAt={event.endAt} status={event.status} />}
          {/* Inked at the door, or voided once the event is over unused; the status chip says it for screen readers. */}
          {(torn || expired) && (
            <span className={`pass-stamp${expired ? ' is-expired' : ''}`} aria-hidden="true">
              <strong>{expired ? 'Expired' : 'Admitted'}</strong>
              {expired && <span>Unused</span>}
              {checkIn && (
                <span>
                  {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: event?.timezone }).format(
                    new Date(checkIn.scannedAt),
                  )}
                </span>
              )}
            </span>
          )}
        </div>
        {/* Plain white, like paper, so the ticket facts stand out under the dark slab. */}
        <div className="pass-card-body">
          {facts}
          {formats}
          {messages}
        </div>
        {dialogs}
      </article>
    );
  }

  return (
    <div
      className={`tt-row ticket-owned tt-${tone}${transferred ? " is-given" : ""}${soon ? " is-soon" : ""}${torn ? " is-torn" : ""}${torn || expired ? " is-spent" : ""}${layout === "list" ? " is-list" : ""}${cardColour ? " has-color" : ""}${opensEvent ? " is-link" : ""}`}
      style={cardColour ? ({ "--tt-color": cardColour } as CSSProperties) : undefined}
      {...openEvent}
    >
      {/* Plain white on the ticket side; the event picture stays on the stub. */}
      <div className="tt-main photo-wash">
        <div className="tt-name">
          <h3>{ticketType?.name ?? 'Ticket'}</h3>
          <span className={`status-chip status-${tone}`}>{statusLabel}</span>
          {icons}
          {/* On the ticket itself, top right, so it stays when a used ticket's stub is torn off. */}
          {ticketType && <span className="tt-price tt-name-price">{formatMoney(ticketType.price)}</span>}
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
        {event && <Countdown startAt={event.startAt} endAt={event.endAt} status={event.status} />}
        {facts}
        {messages}
      </div>

      {!torn && (
        <div className={`tt-stub${cover ? ' has-cover' : ''}`} style={coverStyle}>
          {actions}
        </div>
      )}

      {dialogs}
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
        // A file picker inside the window sends its own "cancel" up to here: only the window's own Escape counts.
        if (e.target !== e.currentTarget) return;
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
/** Purchase details: a receipt with a zigzag foot. */
function ReceiptIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

/** Transfer: a ticket handed on, an arrow leaving a box. */
function TransferIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

function Countdown({ startAt, endAt, status }: { startAt: string; endAt?: string | null; status: Event["status"] }) {
  const now = useNow(1000); // ticks the last-day countdown
  const soon = startsSoonIn({ status, startAt }, now.getTime());
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
  if (soon) return <p className="countdown"><span className="soon-badge">🔥 Starts in {soon.left}</span></p>;
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
