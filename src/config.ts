/**
 * Contact details for "Contact us" links. Override with VITE_CONTACT_EMAIL /
 * VITE_CONTACT_PHONE in .env; set either to an empty value to hide it.
 */
function setting(value: string | undefined, fallback: string): string | null {
  const v = value === undefined ? fallback : value.trim();
  return v || null;
}

export const CONTACT_EMAIL = setting(
  import.meta.env.VITE_CONTACT_EMAIL,
  'event.ko@gmail.com',
);

/** Shown as written; dialled via telHref(). */
export const CONTACT_PHONE = setting(import.meta.env.VITE_CONTACT_PHONE, '0998 123 9801');

/** tel: link for a Philippine number, e.g. "0998 123 9801" -> "tel:+639981239801". */
export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return `tel:${digits}`;
  if (digits.startsWith('0')) return `tel:+63${digits.slice(1)}`;
  return `tel:${digits}`;
}

/**
 * Stripe's PUBLISHABLE key (starts with pk_), meant to be public. Leave it unset and the cart keeps the demo
 * token field. Never put a secret key (sk_) anywhere in this app: card payments are completed by the API.
 */
export const STRIPE_PUBLISHABLE_KEY = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '').trim() || null;

/**
 * PayMongo's PUBLIC key (pk_test_... / pk_live_...), used to send the card straight to PayMongo from the browser.
 * Set it when the API runs with PAYMENTS_GATEWAY=paymongo. Never put the secret key (sk_...) in this app.
 */
export const PAYMONGO_PUBLIC_KEY = (import.meta.env.VITE_PAYMONGO_PUBLIC_KEY ?? '').trim() || null;

/**
 * "Save this card for next time" is a future feature: PayMongo has to switch card vaulting on for the account first (see
 * todo.md). While this is false the checkbox is shown but switched off, and no save request is sent.
 */
export const CARD_SAVING_AVAILABLE = false;

/**
 * The "Test users" shortcut in the log in window (demo accounts with their passwords). Always on in the dev server; in a built
 * site only when VITE_SHOW_TEST_USERS is "true" (for a demo or staging site, never a real one).
 */
export const SHOW_TEST_USERS = import.meta.env.DEV || String(import.meta.env.VITE_SHOW_TEST_USERS ?? '').trim().toLowerCase() === 'true';
