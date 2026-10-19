import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, errorMessage } from '../api/client';
import { cartApi, eventApi, paymentMethodApi, ticketTypeApi } from '../api/endpoints';
import type { Cart, Event, TicketType } from '../api/types';
import { useCart } from '../cart/CartContext';
import { CARD_SAVING_AVAILABLE, PAYMONGO_PUBLIC_KEY, STRIPE_PUBLISHABLE_KEY } from '../config';
import { PayMongoCardFields } from '../components/PayMongoCardFields';
import { CARD_NOT_SAVED_KEY, PENDING_KEY, RETURN_PATH, attachToIntent, createPaymentMethod, waitForCheckout } from '../utils/paymongo';
import type { PayMongoCard } from '../utils/paymongo';
import { MoonIcon, SunIcon } from '../components/DesignerIcons';
import { StripeCard, confirmCardAction } from '../components/StripeCard';
import type { StripeCardApi } from '../components/StripeCard';
import { FormDialog } from '../components/FormDialog';
import { ErrorBox, PageHeader } from '../components/ui';
import { formatDateTime, formatMoney, newIdempotencyKey } from '../utils/format';
import { isDaytime } from '../utils/timeOfDay';
import { useAsync } from '../utils/useAsync';

interface ItemDetails {
  ticketType: TicketType;
  event: Event;
}

export function CartPage() {
  const { cart, removeItem, setQuantity, applyPromo, removePromo, checkout, afterPurchase } = useCart();
  const navigate = useNavigate();
  const [promo, setPromo] = useState('');
  // Tick tickets to remove several at once, or to pay for just those: the summary and the payment follow the ticked ones.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [token, setToken] = useState('tok_visa');
  // The customer's saved cards (Settings > Payment). The primary one is chosen first; "new" pays with another card.
  const savedCards = useAsync(() => paymentMethodApi.list().catch(() => []), []).data ?? [];
  const [choice, setChoice] = useState('');
  // Start on the primary card, but with PayMongo only a card the API can charge again counts; otherwise start on a new card
  // (a card saved before one-step payments has to be typed again anyway).
  const payable = (c: { canChargeAgain?: boolean }) => !PAYMONGO_PUBLIC_KEY || c.canChargeAgain === true;
  const preferred = savedCards.find((c) => c.primary && payable(c)) ?? savedCards.find(payable);
  const chosen = choice === 'new' ? 'new' : (savedCards.find((c) => c.id === choice) ?? preferred)?.id ?? 'new';
  // With a Stripe key set, the card is typed into Stripe's own field and this turns it into a payment method id.
  const [stripeCard, setStripeCard] = useState<StripeCardApi | null>(null);
  // With PayMongo (the API's PAYMENTS_GATEWAY=paymongo) the card typed here goes straight to PayMongo.
  const [pmCard, setPmCard] = useState<PayMongoCard | null>(null);
  // A card typed by hand can be kept for next time (the API vaults it with PayMongo once the payment succeeds).
  const [saveCard, setSaveCard] = useState(CARD_SAVING_AVAILABLE);
  // A saved card the API can charge again is paid with its security code only (the API attaches it to PayMongo itself).
  const [securityCode, setSecurityCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const chosenCard = savedCards.find((c) => c.id === chosen);
  /** A saved card the API can charge again is paid with from the server: no card details to type. */
  const payWithSaved = Boolean(PAYMONGO_PUBLIC_KEY && chosenCard && chosenCard.canChargeAgain === true);
  // One key per checkout attempt; reused on retry so a double-submit
  // can't create two orders, regenerated once the cart changes.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const typeIds = useMemo(
    () => [...new Set(cart?.items.map((i) => i.ticketTypeId) ?? [])].sort().join(','),
    [cart],
  );

  // The cart only carries ticketTypeIds, so resolve names/prices/events for display.
  const { data: details } = useAsync(async () => {
    const ids = typeIds ? typeIds.split(',') : [];
    const types = await Promise.all(ids.map((id) => ticketTypeApi.get(id)));
    const eventIds = [...new Set(types.map((t) => t.eventId))];
    const events = await Promise.all(eventIds.map((id) => eventApi.get(id)));
    const byId = new Map<string, ItemDetails>();
    for (const t of types) {
      byId.set(t.id, { ticketType: t, event: events.find((e) => e.id === t.eventId)! });
    }
    return byId;
  }, [typeIds]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const pickedIds = (cart?.items ?? []).filter((i) => picked.has(i.id)).map((i) => i.id);
  const allPicked = Boolean(cart?.items.length) && pickedIds.length === cart?.items.length;
  const togglePick = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // The selection priced by the API with checkout's own rules (a partial selection; all ticked is just the cart).
  const quoteKey = `${cart?.id ?? ''}|${pickedIds.join(',')}|${cart?.appliedPromoCode?.code ?? ''}|${cart?.items.map((i) => i.quantity).join('.') ?? ''}`;
  const quote = useAsync(
    () => (cart && pickedIds.length > 0 && !allPicked ? cartApi.get(cart.id, pickedIds) : Promise.resolve(null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quoteKey],
  );
  useEffect(() => {
    setIdempotencyKey(newIdempotencyKey());
  }, [quoteKey]);
  /** The ticket ids to pay for: none given when the whole cart is ticked. */
  const payIds = allPicked ? undefined : pickedIds;

  async function removePicked() {
    await run(async () => {
      for (const id of pickedIds) await removeItem(id);
      setPicked(new Set());
      setIdempotencyKey(newIdempotencyKey());
    });
  }

  async function onApplyPromo(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      await applyPromo(promo.trim());
      setPromo('');
      setIdempotencyKey(newIdempotencyKey());
    });
  }

  /** After the API started a PayMongo payment: follow 3-D Secure if asked, then wait for the order. */
  async function finishPayMongo(checkoutId: string) {
    const done = await waitForCheckout(checkoutId);
    sessionStorage.removeItem(PENDING_KEY);
    if (done.status === 'PAID' && done.orderId) {
      afterPurchase();
      navigate(`/orders/${done.orderId}`, { state: { justPurchased: true } });
    } else if (done.status === 'PENDING') {
      throw new Error('Your payment is still being confirmed. Check My orders in a minute before paying again.');
    } else {
      throw new Error(done.failureReason ?? 'The payment did not go through.');
    }
  }

  /** PayMongo, a card typed here: start the payment, send the card to PayMongo, follow 3-D Secure if asked, then wait for the order. */
  async function payWithPayMongo(publicKey: string, card: PayMongoCard) {
    const started = await checkout(CARD_SAVING_AVAILABLE && saveCard && chosen === 'new' ? { saveCard: true } : {}, idempotencyKey, payIds);
    if (!('checkoutId' in started)) {
      // The API is not on PayMongo: it charged at once and answered with the order.
      navigate(`/orders/${started.id}`, { state: { justPurchased: true } });
      return;
    }
    if (!started.clientKey) throw new Error('The payment could not be started. Please try again.');
    // The payment carries on either way; the order page tells the buyer when the card could not be saved.
    if (started.cardSaving === 'UNAVAILABLE') sessionStorage.setItem(CARD_NOT_SAVED_KEY, '1');
    else sessionStorage.removeItem(CARD_NOT_SAVED_KEY);
    const method = await createPaymentMethod(publicKey, card);
    sessionStorage.setItem(PENDING_KEY, started.checkoutId);
    const attached = await attachToIntent(publicKey, started.clientKey, method, window.location.origin + RETURN_PATH);
    if (attached.status === 'redirect') {
      window.location.href = attached.url; // the bank's page; it sends the buyer back to /checkout/return
      return;
    }
    await finishPayMongo(started.checkoutId);
  }

  /** PayMongo, a saved card: the API attaches it itself. Only the security code is sent (never stored). */
  async function payWithSavedCard() {
    const started = await checkout(
      { paymentMethodId: chosen, securityCode, returnUrl: window.location.origin + RETURN_PATH },
      idempotencyKey,
      payIds,
    );
    if (!('checkoutId' in started)) {
      navigate(`/orders/${started.id}`, { state: { justPurchased: true } });
      return;
    }
    sessionStorage.setItem(PENDING_KEY, started.checkoutId);
    if (started.nextAction === 'REDIRECT' && started.redirectUrl) {
      window.location.href = started.redirectUrl; // 3-D Secure; the bank sends the buyer back to /checkout/return
      return;
    }
    await finishPayMongo(started.checkoutId);
  }

  async function onCheckout(e: FormEvent) {
    e.preventDefault();
    if (PAYMONGO_PUBLIC_KEY) {
      if (payWithSaved) {
        if (/^\d{3,4}$/.test(securityCode)) await run(payWithSavedCard);
        return;
      }
      if (!pmCard) return;
      await run(() => payWithPayMongo(PAYMONGO_PUBLIC_KEY, pmCard));
      return;
    }
    await run(async () => {
      const payment =
        chosen !== 'new'
          ? { paymentMethodId: chosen }
          : { paymentMethodToken: STRIPE_PUBLISHABLE_KEY ? await stripeCard!.createPaymentMethod() : token.trim() };
      // A card that needs 3-D Secure comes back as 402 REQUIRES_ACTION: confirm it with Stripe, then pay again with
      // the same idempotency key so the order is only created once.
      const pay = () => checkout(payment, idempotencyKey, payIds);
      const order = await pay().catch(async (e) => {
        if (!(e instanceof ApiError) || e.status !== 402 || e.problem?.error !== 'REQUIRES_ACTION' || !e.problem.clientSecret || !STRIPE_PUBLISHABLE_KEY) throw e;
        await confirmCardAction(STRIPE_PUBLISHABLE_KEY, e.problem.clientSecret);
        return pay();
      });
      if ('checkoutId' in order) throw new Error('This payment needs PayMongo. Ask the shop owner to set it up.');
      navigate(`/orders/${order.id}`, { state: { justPurchased: true } });
    });
  }

  if (!cart || cart.items.length === 0) {
    return (
      <>
        <PageHeader title="Your cart" />
        <div className="cart-empty">
          <svg viewBox="0 0 260 130" width="260" height="130" aria-hidden="true">
            <path
              className="cart-empty-ticket"
              d="M26 14h208a14 14 0 0 1 14 14v18a16 16 0 0 0 0 38v18a14 14 0 0 1-14 14H26a14 14 0 0 1-14-14V84a16 16 0 0 0 0-38V28a14 14 0 0 1 14-14z"
            />
            <path className="cart-empty-tear" d="M178 20v90" />
            <g className="cart-empty-sun">
              <circle cx="78" cy="65" r="17" />
              <path d="M78 36v7M78 87v7M49 65h7M100 65h7M57 44l5 5M94 81l5 5M99 44l-5 5M62 81l-5 5" />
            </g>
            <path
              className="cart-empty-moon"
              d="M222 78a19 19 0 0 1-17-30 19 19 0 1 0 17 30z"
            />
          </svg>
          <h2>Nothing here yet</h2>
          <p className="muted">Tickets you add are held for you while you check out.</p>
          <Link to="/events" className="btn signup-submit cart-empty-cta">
            Browse events
          </Link>
        </div>
      </>
    );
  }

  // What the summary and the payment cover: the whole cart, the priced selection, or nothing while nothing is ticked.
  const shown: Cart = allPicked
    ? cart
    : (quote.data ?? { ...cart, items: [], appliedPromoCode: null, platformFee: null, gatewayFee: null, total: { amount: 0, currency: cart.total.currency } });
  // The tickets' own price (quantity x price), before promo and fees. Left out until every price has loaded.
  const priced = shown.items.map((i) => {
    const d = details?.get(i.ticketTypeId);
    return d ? { amount: d.ticketType.price.amount * i.quantity, currency: d.ticketType.price.currency } : null;
  });
  const subtotal = priced.length > 0 && priced.every(Boolean) ? { amount: priced.reduce((n, m) => n + (m?.amount ?? 0), 0), currency: priced[0]!.currency } : null;

  return (
    <>
      <PageHeader title="Your cart" />
      {!checkingOut && <ErrorBox message={error} />}
      <div className="cart-layout">
        <div className="stack">
          <div className="cart-bulk">
            <label className="check-row">
              <input
                type="checkbox"
                checked={allPicked}
                onChange={() => setPicked(allPicked ? new Set() : new Set(cart.items.map((i) => i.id)))}
              />
              Select all
            </label>
            {pickedIds.length > 0 && (
              <button type="button" className="btn btn-sm danger" disabled={busy} onClick={() => void removePicked()}>
                Remove selected ({pickedIds.length})
              </button>
            )}
          </div>
          {cart.items.map((item) => {
            const d = details?.get(item.ticketTypeId);
            return (
              <div key={item.id} className="card ticket-row cart-ticket">
                <span
                  className={`cart-stub ${d ? (isDaytime(d.event) ? 'is-day' : 'is-night') : ''}`}
                  aria-hidden="true"
                >
                  {d && !isDaytime(d.event) ? <MoonIcon /> : <SunIcon />}
                </span>
                <div>
                  <label className="cart-pick">
                    <input
                      type="checkbox"
                      checked={picked.has(item.id)}
                      onChange={() => togglePick(item.id)}
                      aria-label={`Select ${d ? d.ticketType.name : 'ticket'}`}
                    />
                    <h3>{d ? d.ticketType.name : 'Ticket'}</h3>
                  </label>
                  {d && (
                    <p className="muted small">
                      <Link to={`/events/${d.event.id}`}>{d.event.title}</Link> ·{' '}
                      {formatDateTime(d.event.startAt, d.event.timezone)}
                    </p>
                  )}
                  <p className="cart-hold small">Held for you until {formatDateTime(item.holdExpiresAt)}</p>
                </div>
                <div className="ticket-buy cart-buy">
                  <div className="qty-stepper" role="group" aria-label="Quantity">
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label="One fewer"
                      disabled={busy || item.quantity <= 1}
                      onClick={() => void run(() => setQuantity(item.id, item.quantity - 1))}
                    >
                      −
                    </button>
                    <output aria-live="polite">{item.quantity}</output>
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label="One more"
                      disabled={busy || (d ? item.quantity >= d.ticketType.maxPerOrder || d.ticketType.quantityAvailable < 1 : false)}
                      onClick={() => void run(() => setQuantity(item.id, item.quantity + 1))}
                    >
                      +
                    </button>
                  </div>
                  <span>{d ? `${formatMoney(d.ticketType.price)} each` : '...'}</span>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="card summary">
          <h2>Summary</h2>
          <ErrorBox message={quote.error} />
          {cart.appliedPromoCode ? (
            <div className="row-between">
              <span>
                Promo <code>{cart.appliedPromoCode.code}</code>
              </span>
              <span>
                {shown.appliedPromoCode ? `−${formatMoney(shown.appliedPromoCode.discountAmount)}` : 'not for these tickets'}{' '}
                <button
                  className="btn btn-link danger"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await removePromo();
                      setIdempotencyKey(newIdempotencyKey());
                    })
                  }
                >
                  ✕
                </button>
              </span>
            </div>
          ) : (
            <form className="inline-form" onSubmit={onApplyPromo}>
              <input
                placeholder="Promo code"
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
              />
              <button className="btn" disabled={busy || !promo.trim()}>
                Apply
              </button>
            </form>
          )}
          {shown.platformFee && shown.platformFee.amount > 0 && (
            <div className="row-between">
              <span>Platform fee</span>
              <span>{formatMoney(shown.platformFee)}</span>
            </div>
          )}
          {shown.gatewayFee && shown.gatewayFee.amount > 0 && (
            <div className="row-between">
              <span>Payment processing fee</span>
              <span>{formatMoney(shown.gatewayFee)}</span>
            </div>
          )}
          <div className="row-between total">
            <span>Total</span>
            <strong>{formatMoney(shown.total)}</strong>
          </div>
          <button type="button" className="btn signup-submit" disabled={busy || pickedIds.length === 0} onClick={() => setCheckingOut(true)}>
            Checkout
          </button>
          {pickedIds.length === 0 && <p className="small muted">Select a ticket to check out.</p>}
        </aside>
      </div>
      <FormDialog open={checkingOut} title="Checkout" onClose={() => !busy && setCheckingOut(false)}>
        {checkingOut && (
          <>
          <form className="form" onSubmit={onCheckout}>
            <div className="breakdown">
              <ul className="plain-list breakdown-tickets">
                {shown.items.map((item) => {
                  const d = details?.get(item.ticketTypeId);
                  return (
                    <li key={item.id}>
                      <span>
                        <strong>{d ? d.ticketType.name : 'Ticket'}</strong>
                        {d && (
                          <small className="muted">
                            {d.event.title} · {formatDateTime(d.event.startAt, d.event.timezone)}
                          </small>
                        )}
                        <small className="muted">
                          {item.quantity} × {d ? formatMoney(d.ticketType.price) : '…'}
                        </small>
                      </span>
                      <span>{d ? formatMoney({ amount: d.ticketType.price.amount * item.quantity, currency: d.ticketType.price.currency }) : ''}</span>
                    </li>
                  );
                })}
              </ul>
              {subtotal && (
                <div className="row-between">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
              )}
              {shown.appliedPromoCode && (
                <div className="row-between">
                  <span>
                    Promo <code>{shown.appliedPromoCode.code}</code>
                  </span>
                  <span>−{formatMoney(shown.appliedPromoCode.discountAmount)}</span>
                </div>
              )}
              {shown.platformFee && shown.platformFee.amount > 0 && (
                <div className="row-between">
                  <span>Platform fee</span>
                  <span>{formatMoney(shown.platformFee)}</span>
                </div>
              )}
              {shown.gatewayFee && shown.gatewayFee.amount > 0 && (
                <div className="row-between">
                  <span>Payment processing fee</span>
                  <span>{formatMoney(shown.gatewayFee)}</span>
                </div>
              )}
              <div className="row-between total">
                <span>Total</span>
                <strong>{formatMoney(shown.total)}</strong>
              </div>
            </div>
            <ErrorBox message={error} />
            {PAYMONGO_PUBLIC_KEY ? (
              <>
                {savedCards.length > 0 && (
                  <label>
                    <span className="row-between">
                      <span>Pay with</span>
                      <Link to="/profile/payment">Manage cards</Link>
                    </span>
                    <select value={chosen} onChange={(e) => setChoice(e.target.value)}>
                      {savedCards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.brand} •••• {c.last4}
                          {c.primary ? ' (primary)' : ''}
                        </option>
                      ))}
                      <option value="new">Use a new card</option>
                    </select>
                  </label>
                )}
                {payWithSaved ? (
                  <label>
                    Security code
                    <input
                      required
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      maxLength={4}
                      placeholder="123"
                      value={securityCode}
                      onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, ''))}
                    />
                    <span className="hint">The code is sent for this payment only and never saved.</span>
                  </label>
                ) : (
                  <>
                    {chosenCard ? (
                      <div className="small muted">
                        <p>This card was saved before one-step payments, so it has to be added again.</p>
                        <button type="button" className="btn btn-sm" onClick={() => {
                            setChoice('new');
                            setSaveCard(true);
                          }}>
                          Use a new card
                        </button>
                      </div>
                    ) : (
                      <PayMongoCardFields key={chosen} onChange={setPmCard} />
                    )}
                    {chosen === 'new' && (
                      <label className="check-row" title={CARD_SAVING_AVAILABLE ? undefined : 'Not available yet'}>
                        <input
                          type="checkbox"
                          checked={CARD_SAVING_AVAILABLE && saveCard}
                          disabled={!CARD_SAVING_AVAILABLE}
                          onChange={(e) => setSaveCard(e.target.checked)}
                        />
                        Save this card for next time{!CARD_SAVING_AVAILABLE && <span className="muted"> (coming soon)</span>}
                      </label>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
            {savedCards.length > 0 && (
              <label>
                <span className="row-between">
                  <span>Pay with</span>
                  <Link to="/profile/payment">Manage cards</Link>
                </span>
                <select value={chosen} onChange={(e) => setChoice(e.target.value)}>
                  {savedCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.brand} •••• {c.last4}
                      {c.primary ? ' (primary)' : ''}
                    </option>
                  ))}
                  <option value="new">Use a new card</option>
                </select>
              </label>
            )}
            {chosen === 'new' &&
              (STRIPE_PUBLISHABLE_KEY ? (
                <div className="stripe-field">
                  <span>Card</span>
                  <StripeCard publishableKey={STRIPE_PUBLISHABLE_KEY} onReady={setStripeCard} />
                  <span className="hint">Your card is entered into Stripe's secure field. We never see the number.</span>
                </div>
              ) : (
                <label>
                  Payment method token
                  <input required value={token} onChange={(e) => setToken(e.target.value)} />
                  <span className="hint">
                    The API uses a mock gateway: any token succeeds, tokens starting with <code>tok_fail</code> are
                    declined.
                  </span>
                </label>
              ))}
              </>
            )}
            <button
              className="btn signup-submit"
              disabled={busy || (PAYMONGO_PUBLIC_KEY ? (payWithSaved ? !/^\d{3,4}$/.test(securityCode) : Boolean(chosenCard) || !pmCard) : chosen === 'new' && Boolean(STRIPE_PUBLISHABLE_KEY) && !stripeCard)}
            >
              {busy ? 'Processing...' : `Pay ${formatMoney(shown.total)}`}
            </button>
          </form>

            <button type="button" className="btn btn-link" disabled={busy} onClick={() => setCheckingOut(false)}>
              Cancel
            </button>
          </>
        )}
      </FormDialog>
    </>
  );
}
