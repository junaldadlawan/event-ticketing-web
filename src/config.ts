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
  'junielald.adlawan@gmail.com',
);

/** Shown as written; dialled via telHref(). */
export const CONTACT_PHONE = setting(import.meta.env.VITE_CONTACT_PHONE, '0998 153 3822');

/** tel: link for a Philippine number, e.g. "0998 153 3822" -> "tel:+639981533822". */
export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return `tel:${digits}`;
  if (digits.startsWith('0')) return `tel:+63${digits.slice(1)}`;
  return `tel:${digits}`;
}
