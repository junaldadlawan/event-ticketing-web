/** Helpers for the payout card form. The full card number is only checked here; it is never sent or stored. */
export type CardBrand = 'Visa' | 'Mastercard' | 'Amex' | 'Discover' | 'Card';

export const digitsOnly = (v: string) => v.replace(/\D/g, '');

export function cardBrand(number: string): CardBrand {
  const n = digitsOnly(number);
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]|[3-6]|7[01]|720))/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^(6011|65)/.test(n)) return 'Discover';
  return 'Card';
}

/** "4242424242424242" -> "4242 4242 4242 4242" (Amex 4-6-5). */
export function formatCardNumber(v: string): string {
  const n = digitsOnly(v).slice(0, 19);
  if (cardBrand(n) === 'Amex') return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(' ');
  return n.replace(/(.{4})/g, '$1 ').trim();
}

/** Luhn checksum: catches a mistyped digit. */
export function luhnOk(number: string): boolean {
  const n = digitsOnly(number);
  if (n.length < 13 || n.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** "1228" / "12/28" -> { month: 12, year: 2028 }, or null when it is not a valid, unexpired month. */
export function parseExpiry(v: string, now = new Date()): { month: number; year: number } | null {
  const d = digitsOnly(v);
  if (d.length !== 4) return null;
  const month = Number(d.slice(0, 2));
  const year = 2000 + Number(d.slice(2));
  if (month < 1 || month > 12) return null;
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return null;
  return { month, year };
}

/** Shows the typed expiry as "MM/YY". */
export function formatExpiry(v: string): string {
  const d = digitsOnly(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
