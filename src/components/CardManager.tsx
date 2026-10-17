import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import type { PayoutCardRequest } from '../api/types';
import { StripeCard } from './StripeCard';
import type { StripeCardApi } from './StripeCard';
import { ConfirmDialog } from './ConfirmDialog';
import { TrashIcon } from './DesignerIcons';
import { FormDialog } from './FormDialog';
import { Empty, ErrorBox, Spinner, SuccessBox } from './ui';
import { cardBrand, digitsOnly, formatCardNumber, formatExpiry, luhnOk, parseExpiry } from '../utils/card';
import { useAsync } from '../utils/useAsync';

/** What is shown about a saved card. The full number is never kept. */
export interface SavedCard {
  id: string;
  holderName: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  primary: boolean;
  /** False when the card must be typed again to pay with it. */
  canChargeAgain?: boolean;
}

/** What the API gets for a new card. With Stripe only the payment method id (and primary) is sent. */
export type NewCard = Pick<PayoutCardRequest, 'paymentToken' | 'primary'> & Partial<PayoutCardRequest>;

export interface CardCalls {
  list: () => Promise<SavedCard[]>;
  add: (body: NewCard) => Promise<unknown>;
  setPrimary: (id: string) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}

/**
 * Saved cards: see them, add one, choose the primary card, remove one. Used for an organization's payout cards and
 * for a customer's payment methods. With `stripe` set, the card is typed into Stripe's own field and saved through a
 * Stripe setup intent; otherwise it is the demo form (only the last four digits are sent).
 */
export function CardManager({
  calls,
  canEdit,
  intro,
  emptyText,
  addLabel = 'Add card',
  comingSoon = false,
  stripe,
}: {
  calls: CardCalls;
  canEdit: boolean;
  intro: string;
  emptyText: string;
  /** The add button and its dialog title (for example "Add payout account"). */
  addLabel?: string;
  /** A future feature: the add button is shown but switched off (see todo.md). Cards already saved can still be removed. */
  comingSoon?: boolean;
  stripe?: { publishableKey: string; clientSecret: () => Promise<string> };
}) {
  const cards = useAsync(() => calls.list(), []);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<SavedCard | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const list = (cards.data ?? []).slice().sort((a, b) => Number(b.primary) - Number(a.primary));

  async function act(run: () => Promise<unknown>, done: string) {
    setErr(null);
    setMsg(null);
    try {
      await run();
      setMsg(done);
      cards.reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <>
      <div className="row-between">
        <p className="muted small">{intro}</p>
        {canEdit && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={comingSoon}
            title={comingSoon ? 'Not available yet' : undefined}
            onClick={() => setAdding(true)}
          >
            {addLabel}
            {comingSoon && ' (coming soon)'}
          </button>
        )}
      </div>
      <ErrorBox message={cards.error ?? err} />
      <SuccessBox message={msg} />
      {cards.loading && !cards.data ? (
        <Spinner />
      ) : list.length === 0 && !cards.error ? (
        <Empty>{emptyText}</Empty>
      ) : (
        <ul className="plain-list pay-cards">
          {list.map((c) => (
            <li key={c.id} className={`pay-card${c.primary ? ' is-primary' : ''}`}>
              <span className="pay-card-brand">{c.brand}</span>
              <span className="pay-card-main">
                <strong>•••• {c.last4}</strong>
                <span className="muted small">
                  {c.holderName} · expires {String(c.expMonth).padStart(2, '0')}/{String(c.expYear).slice(-2)}
                </span>
              </span>
              {c.primary && <span className="status-chip status-good">Primary</span>}
              {canEdit && (
                <span className="admin-actions">
                  {!c.primary && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void act(() => calls.setPrimary(c.id), `•••• ${c.last4} is now the primary card.`)}
                    >
                      Make primary
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button icon-button-danger"
                    title={c.primary && list.length > 1 ? 'Choose another primary card first' : 'Remove card'}
                    aria-label={`Remove card ending ${c.last4}`}
                    disabled={c.primary && list.length > 1}
                    onClick={() => setRemoving(c)}
                  >
                    <TrashIcon />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <FormDialog open={adding} title={addLabel === 'Add card' ? 'Add a card' : addLabel} onClose={() => setAdding(false)}>
        {adding && (
          <AddCardForm
            first={list.length === 0}
            submitLabel={addLabel}
            stripe={stripe}
            onCancel={() => setAdding(false)}
            onSubmit={async (body, last4) => {
              await calls.add(body);
              setAdding(false);
              setErr(null);
              setMsg(last4 ? `Card ending ${last4} added.` : 'Card added.');
              cards.reload();
            }}
          />
        )}
      </FormDialog>

      <ConfirmDialog
        open={removing !== null}
        title="Remove this card?"
        confirmLabel="Remove"
        cancelLabel="Keep"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const c = removing;
          setRemoving(null);
          if (c) void act(() => calls.remove(c.id), `Card ending ${c.last4} removed.`);
        }}
      >
        The card ending {removing?.last4} will be removed.
      </ConfirmDialog>
    </>
  );
}

function AddCardForm({
  first,
  submitLabel,
  stripe,
  onCancel,
  onSubmit,
}: {
  first: boolean;
  submitLabel: string;
  stripe?: { publishableKey: string; clientSecret: () => Promise<string> };
  onCancel: () => void;
  onSubmit: (body: NewCard, last4: string | null) => Promise<void>;
}) {
  const [holder, setHolder] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [primary, setPrimary] = useState(first);
  const [stripeApi, setStripeApi] = useState<StripeCardApi | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!holder.trim()) return setError('Enter the name on the card.');
    if (stripe) {
      // Stripe: the card is saved to the customer through a setup intent; only the payment method id comes back.
      if (!stripeApi) return setError('The card field is still loading.');
      setBusy(true);
      try {
        const paymentMethod = await stripeApi.confirmSetup(await stripe.clientSecret(), holder.trim());
        await onSubmit({ paymentToken: paymentMethod, holderName: holder.trim(), primary: first || primary }, null);
      } catch (e2) {
        setError(errorMessage(e2));
      } finally {
        setBusy(false);
      }
      return;
    }
    const exp = parseExpiry(expiry);
    if (!luhnOk(number)) return setError('That card number does not look right. Check the digits.');
    if (!exp) return setError('Enter a valid expiry date that has not passed (MM/YY).');
    const brand = cardBrand(number);
    setBusy(true);
    try {
      // The full number stays in this form: only the brand, last four digits and expiry are sent.
      const last4 = digitsOnly(number).slice(-4);
      await onSubmit(
        {
          holderName: holder.trim(),
          brand,
          last4,
          expMonth: exp.month,
          expYear: exp.year,
          paymentToken: `tok_${brand.toLowerCase()}`,
          primary: first || primary,
        },
        last4,
      );
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>
        Name on card
        <input required maxLength={60} autoComplete="cc-name" value={holder} onChange={(e) => setHolder(e.target.value)} />
      </label>
      {stripe ? (
        <div className="stripe-field">
          <span>Card</span>
          <StripeCard publishableKey={stripe.publishableKey} onReady={setStripeApi} />
          <small className="muted">Entered in Stripe's secure field. We never see the number.</small>
        </div>
      ) : (
        <>
          <label>
            Card number
            <input
              required
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="1234 5678 9012 3456"
              value={number}
              onChange={(e) => setNumber(formatCardNumber(e.target.value))}
            />
            {number && <small className="muted">{cardBrand(number)}</small>}
          </label>
          <label>
            Expiry (MM/YY)
            <input
              required
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              maxLength={5}
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            />
          </label>
          <small className="muted">Only the last four digits are kept. The full number is never stored.</small>
        </>
      )}
      <label className="check-row">
        <input type="checkbox" checked={first || primary} disabled={first} onChange={(e) => setPrimary(e.target.checked)} />
        Use as the primary card
      </label>
      <ErrorBox message={error} />
      <div className="modal-actions">
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy || (Boolean(stripe) && !stripeApi)}>
          {busy ? 'Adding…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
