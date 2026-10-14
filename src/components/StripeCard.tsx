import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useRef } from 'react';

/** What the page can do with the card typed into Stripe's field. */
export interface StripeCardApi {
  /** Turns the card into a Stripe payment method id (pm_...), for paying right away. */
  createPaymentMethod: () => Promise<string>;
  /** Saves the card to the customer with a setup intent from the API; returns the payment method id. */
  confirmSetup: (clientSecret: string, name: string) => Promise<string>;
}

/**
 * Stripe's card field. The card number, expiry and security code live in an iframe that Stripe serves, so they
 * never touch this app or our API. `onReady` hands the page what it can do with the card, or null while the field
 * is not available.
 */
export function StripeCard({
  publishableKey,
  onReady,
}: {
  publishableKey: string;
  onReady: (api: StripeCardApi | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Keep the latest callback without re-mounting the field when the parent re-renders.
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    let cancelled = false;
    let destroy = () => {};
    loadStripe(publishableKey).then((stripe) => {
      if (cancelled || !stripe || !box.current) return;
      const card = stripe.elements().create('card', {
        hidePostalCode: true,
        style: { base: { fontSize: '16px', color: getComputedStyle(document.body).color } },
      });
      card.mount(box.current);
      destroy = () => card.destroy();
      ready.current({
        createPaymentMethod: async () => {
          const { paymentMethod, error } = await stripe.createPaymentMethod({ type: 'card', card });
          if (error || !paymentMethod) throw new Error(error?.message ?? 'The card could not be read.');
          return paymentMethod.id;
        },
        confirmSetup: async (clientSecret, name) => {
          const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
            payment_method: { card, billing_details: { name } },
          });
          const pm = setupIntent?.payment_method;
          if (error || !pm) throw new Error(error?.message ?? 'The card could not be saved.');
          return typeof pm === 'string' ? pm : pm.id;
        },
      });
    });
    return () => {
      cancelled = true;
      destroy();
      ready.current(null);
    };
  }, [publishableKey]);

  return <div ref={box} className="stripe-card" />;
}

/**
 * Finishes a card payment that needs an extra step (3-D Secure): Stripe opens its confirmation window, then the page
 * retries the payment. Throws with Stripe's message if the customer fails or closes it.
 */
export async function confirmCardAction(publishableKey: string, clientSecret: string): Promise<void> {
  const stripe = await loadStripe(publishableKey);
  if (!stripe) throw new Error('Stripe could not be loaded. Please try again.');
  const { error } = await stripe.handleNextAction({ clientSecret });
  if (error) throw new Error(error.message ?? 'The card could not be confirmed.');
}
