import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { eventApi, ticketTypeApi } from '../api/endpoints';
import type { Event, TicketType } from '../api/types';
import { useCart } from '../cart/CartContext';
import { MoonIcon, SunIcon } from '../components/DesignerIcons';
import { ErrorBox } from '../components/ui';
import { formatDateTime, formatMoney, newIdempotencyKey } from '../utils/format';
import { isDaytime } from '../utils/timeOfDay';
import { useAsync } from '../utils/useAsync';

interface ItemDetails {
  ticketType: TicketType;
  event: Event;
}

export function CartPage() {
  const { cart, removeItem, applyPromo, removePromo, checkout } = useCart();
  const navigate = useNavigate();
  const [promo, setPromo] = useState('');
  const [token, setToken] = useState('tok_visa');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  async function onApplyPromo(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      await applyPromo(promo.trim());
      setPromo('');
      setIdempotencyKey(newIdempotencyKey());
    });
  }

  async function onCheckout(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const order = await checkout(token.trim(), idempotencyKey);
      navigate(`/orders/${order.id}`, { state: { justPurchased: true } });
    });
  }

  if (!cart || cart.items.length === 0) {
    return (
      <>
        <h1>Your cart</h1>
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

  return (
    <>
      <h1>Your cart</h1>
      <ErrorBox message={error} />
      <div className="cart-layout">
        <div className="stack">
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
                  <h3>{d ? d.ticketType.name : 'Ticket'}</h3>
                  {d && (
                    <p className="muted small">
                      <Link to={`/events/${d.event.id}`}>{d.event.title}</Link> ·{' '}
                      {formatDateTime(d.event.startAt, d.event.timezone)}
                    </p>
                  )}
                  <p className="cart-hold small">Held for you until {formatDateTime(item.holdExpiresAt)}</p>
                </div>
                <div className="ticket-buy">
                  <span>
                    {item.quantity} × {d ? formatMoney(d.ticketType.price) : '...'}
                  </span>
                  <button
                    className="btn btn-link danger"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await removeItem(item.id);
                        setIdempotencyKey(newIdempotencyKey());
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="card summary">
          <h2>Summary</h2>
          {cart.appliedPromoCode ? (
            <div className="row-between">
              <span>
                Promo <code>{cart.appliedPromoCode.code}</code>
              </span>
              <span>
                −{formatMoney(cart.appliedPromoCode.discountAmount)}{' '}
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
          {cart.platformFee && cart.platformFee.amount > 0 && (
            <div className="row-between">
              <span>Platform fee</span>
              <span>{formatMoney(cart.platformFee)}</span>
            </div>
          )}
          <div className="row-between total">
            <span>Total</span>
            <strong>{formatMoney(cart.total)}</strong>
          </div>
          <form className="form" onSubmit={onCheckout}>
            <label>
              Payment method token
              <input required value={token} onChange={(e) => setToken(e.target.value)} />
              <span className="hint">
                The API uses a mock gateway: any token succeeds, tokens starting with{' '}
                <code>tok_fail</code> are declined.
              </span>
            </label>
            <button className="btn signup-submit" disabled={busy}>
              {busy ? 'Processing...' : `Pay ${formatMoney(cart.total)}`}
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
