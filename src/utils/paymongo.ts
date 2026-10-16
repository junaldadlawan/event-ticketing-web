import { checkoutApi } from '../api/endpoints';
import type { CheckoutStart } from '../api/types';

const API = 'https://api.paymongo.com/v1';

/** What the buyer typed into the card form. It goes to PayMongo only, never to our API. */
export interface PayMongoCard {
  name: string;
  email: string;
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
}

/** PayMongo's own answers: `errors[].detail` says what went wrong (for example a declined card). */
async function call<T>(publicKey: string, path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(`${publicKey}:`)}` },
      body: JSON.stringify({ data: { attributes: body } }),
    });
  } catch {
    throw new Error("Can't reach the payment provider. Check your connection and try again.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.errors?.[0]?.detail ?? 'The payment provider refused the card.');
  return json as T;
}

/** The payment intent id is the part of the client key before "_client_". */
export const intentIdFrom = (clientKey: string) => clientKey.split('_client_')[0];

/** Step 1: turn the card into a PayMongo payment method (pm_...). */
export async function createPaymentMethod(publicKey: string, card: PayMongoCard): Promise<string> {
  const res = await call<{ data: { id: string } }>(publicKey, '/payment_methods', {
    type: 'card',
    details: { card_number: card.number.replace(/\D/g, ''), exp_month: card.expMonth, exp_year: card.expYear, cvc: card.cvc },
    billing: { name: card.name, email: card.email },
  });
  return res.data.id;
}

export type AttachResult =
  | { status: 'paid' } // succeeded or processing: the webhook is what confirms it, so the page polls
  | { status: 'redirect'; url: string }; // the bank asks for 3-D Secure

/** Step 2: attach the payment method to the payment intent the API created; PayMongo may ask for 3-D Secure. */
export async function attachToIntent(
  publicKey: string,
  clientKey: string,
  paymentMethodId: string,
  returnUrl: string,
): Promise<AttachResult> {
  const res = await call<{ data: { attributes: { status: string; next_action?: { redirect?: { url: string } } } } }>(
    publicKey,
    `/payment_intents/${intentIdFrom(clientKey)}/attach`,
    { payment_method: paymentMethodId, client_key: clientKey, return_url: returnUrl },
  );
  const a = res.data.attributes;
  if (a.status === 'awaiting_next_action' && a.next_action?.redirect?.url) return { status: 'redirect', url: a.next_action.redirect.url };
  if (a.status === 'awaiting_payment_method') throw new Error('The card was declined. Try another card.');
  return { status: 'paid' };
}

/** Where the 3-D Secure page sends the buyer back to, and what the page remembers meanwhile. */
export const RETURN_PATH = '/checkout/return';
export const PENDING_KEY = 'et.pendingCheckout';
/** Set when the API says the card could not be saved; the order page says so once and clears it (it survives a 3-D Secure redirect). */
export const CARD_NOT_SAVED_KEY = 'et.cardNotSaved';

/**
 * Step 3: the webhook is what creates the order, so ask the API until it says PAID or FAILED (up to `ms`).
 * Returns the last answer; a status that is still PENDING means it is taking longer than usual.
 */
export async function waitForCheckout(checkoutId: string, ms = 30_000, every = 1_500): Promise<CheckoutStart> {
  const stop = Date.now() + ms;
  for (;;) {
    const s = await checkoutApi.status(checkoutId);
    if (s.status !== 'PENDING' || Date.now() >= stop) return s;
    await new Promise((r) => setTimeout(r, every));
  }
}
