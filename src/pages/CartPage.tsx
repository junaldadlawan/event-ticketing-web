import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { eventApi, ticketTypeApi } from '../api/endpoints';
import type { Event, TicketType } from '../api/types';
import { useCart } from '../cart/CartContext';
import { Empty, ErrorBox } from '../components/ui';
import { formatDateTime, formatMoney, newIdempotencyKey } from '../utils/format';
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
        <Empty>
          Your cart is empty. <Link to="/">Browse events</Link>
        </Empty>
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
              <div key={item.id} className="card ticket-row">
                <div>
                  <h3>{d ? d.ticketType.name : 'Ticket'}</h3>
                  {d && (
                    <p className="muted small">
                      <Link to={`/events/${d.event.id}`}>{d.event.title}</Link> ·{' '}
                      {formatDateTime(d.event.startAt, d.event.timezone)}
                    </p>
                  )}
                  <p className="muted small">
                    Held until {formatDateTime(item.holdExpiresAt)}
                  </p>
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
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Processing...' : `Pay ${formatMoney(cart.total)}`}
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
