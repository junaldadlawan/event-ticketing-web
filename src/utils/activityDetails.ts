import type { ActivityDetails, Money } from '../api/types';
import { formatDateTime, formatMoney, humanize } from './format';

/** Readable names for the fields an update can change, by the API's JSON name. */
const FIELD_LABELS: Record<string, string> = {
  // event
  title: 'Title',
  description: 'Description',
  category: 'Category',
  images: 'Images',
  // ticket type
  name: 'Name',
  price: 'Price',
  quantityTotal: 'Tickets available',
  saleStartAt: 'Sale starts',
  saleEndAt: 'Sale ends',
  maxPerOrder: 'Max per order',
  // promo code
  code: 'Code',
  discountType: 'Discount type',
  discountValue: 'Discount',
  applicableTicketTypeIds: 'Ticket types it applies to',
  usageLimitTotal: 'Total uses allowed',
  usageLimitPerBuyer: 'Uses per buyer',
  validFrom: 'Valid from',
  validUntil: 'Valid until',
  // ticket design
  logoUrl: 'Logo',
  backgroundImageUrl: 'Background image',
  primaryColor: 'Main colour',
  codeType: 'Code type',
  codeX: 'Code position (across)',
  codeY: 'Code position (down)',
  codeWidth: 'Code size',
  codeRotation: 'Code rotation',
  ticketWidth: 'Ticket width',
  ticketHeight: 'Ticket height',
  backgroundColor: 'Background colour',
  backgroundFit: 'Background fit',
  backgroundX: 'Background position (across)',
  backgroundY: 'Background position (down)',
  backgroundWidth: 'Background width',
  backgroundHeight: 'Background height',
  textFields: 'Text fields',
  // policies and check-in
  ruleType: 'Refund rule',
  daysBeforeEvent: 'Days before the event',
  customTerms: 'Custom terms',
  enabled: 'Resale allowed',
  priceCapRule: 'Price cap',
  feeAmount: 'Resale fee',
  mode: 'Check-in mode',
  offlineFallbackExpirySeconds: 'Offline fallback (seconds)',
};

/** Fields the API records as a count (a list's size), not the list itself. */
const COUNTED = new Set(['images', 'applicableTicketTypeIds', 'textFields']);
/** Fields whose value is a URL: shown as set / removed / changed, not the whole address. */
const URLS = new Set(['logoUrl', 'backgroundImageUrl']);
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function isMoney(v: unknown): v is Money {
  return typeof v === 'object' && v !== null && 'amount' in v && 'currency' in v;
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? humanize(field.replace(/([a-z])([A-Z])/g, '$1_$2')).replace(/_/g, ' ');
}

/** One value of a change, as it reads on screen. */
export function formatValue(field: string, value: unknown, timeZone: string): string {
  if (value === null || value === undefined || value === '') return 'none';
  if (isMoney(value)) return formatMoney({ amount: Number(value.amount), currency: String(value.currency) });
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') {
    if (COUNTED.has(field)) return field === 'images' ? `${value} ${value === 1 ? 'image' : 'images'}` : String(value);
    return String(value);
  }
  const text = String(value);
  if (ISO_INSTANT.test(text)) return formatDateTime(text, timeZone);
  if (/^[A-Z][A-Z_]+$/.test(text)) return humanize(text);
  return `“${text}”`;
}

/** "Price: ₱100.00 → ₱120.00" lines for an update, or the URL field's set / removed / changed. */
export function changeLines(details: ActivityDetails | null, timeZone: string): string[] {
  return (details?.changes ?? []).map(({ field, from, to }) => {
    const label = fieldLabel(field);
    if (URLS.has(field)) return `${label}: ${!from ? 'added' : !to ? 'removed' : 'replaced'}`;
    return `${label}: ${formatValue(field, from, timeZone)} → ${formatValue(field, to, timeZone)}`;
  });
}
