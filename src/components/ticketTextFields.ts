import type {
  DynamicTextFieldKey,
  Event,
  StaticTextFieldKey,
  TextField,
  TextFieldAlign,
  TextFieldKey,
} from '../api/types';

/** Everything that can go on a ticket from the placeholder box, in display order. */
export type PlaceholderKey = TextFieldKey | 'CODE';

export interface Placeholder {
  key: PlaceholderKey;
  /** Chip label in the placeholder box. */
  label: string;
}

/** Dynamic: printed with each ticket's own value (and the scannable code). */
export const PLACEHOLDERS: Placeholder[] = [
  { key: 'TICKET_TYPE', label: 'Ticket type' },
  { key: 'SECTION', label: 'Section' },
  { key: 'ROW', label: 'Row' },
  { key: 'SEAT', label: 'Seat' },
  { key: 'CODE', label: 'QR / Barcode' },
  { key: 'TICKET_NUMBER', label: 'Ticket no.' },
  { key: 'ATTENDEE_NAME', label: 'Attendee name' },
];

/** Static: the same on every ticket of the event. Custom labels sit next to these. */
export const STATIC_PLACEHOLDERS: Placeholder[] = [
  { key: 'EVENT_NAME', label: 'Event name' },
  { key: 'EVENT_DATE', label: 'Date' },
  { key: 'EVENT_TIME', label: 'Time' },
  { key: 'VENUE', label: 'Venue' },
];

const DYNAMIC_KEYS: TextFieldKey[] = ['TICKET_TYPE', 'SECTION', 'ROW', 'SEAT', 'TICKET_NUMBER', 'ATTENDEE_NAME'];
const STATIC_KEYS: TextFieldKey[] = ['EVENT_NAME', 'EVENT_DATE', 'EVENT_TIME', 'VENUE'];
const ALIGNS: TextFieldAlign[] = ['LEFT', 'CENTER', 'RIGHT'];

export const isDynamicKey = (key: TextFieldKey): key is DynamicTextFieldKey => DYNAMIC_KEYS.includes(key);
export const isStaticKey = (key: TextFieldKey): key is StaticTextFieldKey => STATIC_KEYS.includes(key);
const isKnownKey = (key: TextFieldKey) => isDynamicKey(key) || isStaticKey(key) || key === 'CUSTOM';

export function placeholderLabel(key: PlaceholderKey): string {
  if (key === 'CUSTOM') return 'Label';
  return [...PLACEHOLDERS, ...STATIC_PLACEHOLDERS].find((p) => p.key === key)?.label ?? key;
}

/** How the designer tells fields apart: the key, or a custom label's own id. */
export function fieldId(f: TextField): string {
  return f.id ?? f.key;
}

/** Custom labels: up to this many per ticket, each 1-60 characters. */
export const MAX_CUSTOM_LABELS = 10;
export const CUSTOM_TEXT_MAX = 60;

let customCounter = 0;
const newCustomId = () => `custom-${Date.now().toString(36)}-${++customCounter}`;

/** Placeholder length (characters) bounds, and a sensible default per dynamic field. */
export const SAMPLE_LENGTH = { min: 1, max: 30 } as const;

/** Own placeholder text for a dynamic field (instead of X's): at most 30 characters. */
export const SAMPLE_TEXT_MAX = 30;
export function cleanSampleText(text: string | undefined | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, SAMPLE_TEXT_MAX);
}

/** A starting example when switching a dynamic field to its own placeholder text. */
export function exampleSampleText(key: DynamicTextFieldKey, ticketPrefix?: string): string {
  const examples: Record<DynamicTextFieldKey, string> = {
    TICKET_TYPE: 'General Admission',
    SECTION: 'A',
    ROW: '12',
    SEAT: '7',
    TICKET_NUMBER: `${ticketPrefix || 'EVT'}-000123`,
    ATTENDEE_NAME: 'Juan Dela Cruz',
  };
  return examples[key];
}
const DEFAULT_LENGTH: Record<DynamicTextFieldKey, number> = {
  TICKET_TYPE: 16,
  SECTION: 2,
  ROW: 2,
  SEAT: 3,
  TICKET_NUMBER: 10,
  ATTENDEE_NAME: 16,
};

/*
 * Static values, formatted the way the ticket prints them (the API renderer
 * uses the same patterns, in the event's time zone):
 * date "Fri, Nov 20, 2026" (EEE, MMM d, yyyy), time "1:00 PM" (h:mm a).
 */
function inZone(event: Event, opts: Intl.DateTimeFormatOptions) {
  const at = new Date(event.startAt);
  if (Number.isNaN(at.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: event.timezone }).format(at);
  } catch {
    return new Intl.DateTimeFormat('en-US', opts).format(at); // unknown time zone
  }
}

export function eventDateText(event: Event): string {
  return inZone(event, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function eventTimeText(event: Event): string {
  // Newer ICU puts a narrow no-break space before AM/PM; show a plain one.
  return inZone(event, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s/g, ' ');
}

/**
 * What a field shows on the design. Dynamic fields: X repeated to their
 * placeholder length ("XXX"); real tickets print the ticket's own value
 * (general admission: Section "GA", Row/Seat "—"). Static fields: the
 * event's real value. Custom labels: their own text.
 */
export function fieldDisplayText(f: TextField, event?: Event | null): string {
  if (isDynamicKey(f.key)) return cleanSampleText(f.sampleText) || 'X'.repeat(f.sampleLength ?? DEFAULT_LENGTH[f.key]);
  if (f.key === 'CUSTOM') return f.text || placeholderLabel('CUSTOM');
  if (!event) return placeholderLabel(f.key);
  switch (f.key) {
    case 'EVENT_NAME':
      return event.title;
    case 'EVENT_DATE':
      return eventDateText(event);
    case 'EVENT_TIME':
      return eventTimeText(event);
    case 'VENUE':
      return event.venue?.name || 'Venue (not set)';
  }
}

export const FONT_SIZE = { min: 2, max: 25, default: 6 } as const;
export const DEFAULT_TEXT_COLOR = '#111111';

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Any angle -> whole degrees in [0, 360). */
export function normalizeDegrees(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((Math.round(deg) % 360) + 360) % 360;
}

/** A custom label's text, cleaned up: one line, trimmed, at most 60 characters. */
export function cleanCustomText(text: string | undefined | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, CUSTOM_TEXT_MAX);
}

/* ---- line breaks (double-click a field: only line breaks can change) ---- */

export const MAX_LINE_BREAKS = 10;

/** Break positions, cleaned: whole numbers above 0, ascending, no repeats, at most 10. */
function cleanBreaks(breaks: number[] | null | undefined, length?: number): number[] {
  const ok = (breaks ?? [])
    .filter((b) => Number.isInteger(b) && b > 0 && (length === undefined || b < length))
    .sort((a, b) => a - b);
  return [...new Set(ok)].slice(0, MAX_LINE_BREAKS);
}

/** The text split into its lines, exactly at the break positions (no trimming). */
function splitAt(text: string, breaks: number[] | null | undefined): string[] {
  const lines: string[] = [];
  let from = 0;
  for (const b of cleanBreaks(breaks, text.length)) {
    lines.push(text.slice(from, b));
    from = b;
  }
  lines.push(text.slice(from));
  return lines;
}

/** For editing: the text with a newline at each break, nothing else changed. */
export function textWithBreaks(text: string, breaks: number[] | null | undefined): string {
  return splitAt(text, breaks).join('\n');
}

/** As printed: each line trimmed, so a break next to a space doesn't leave an indent. */
export function printedLines(text: string, breaks: number[] | null | undefined): string {
  return splitAt(text, breaks)
    .map((l) => l.trim())
    .join('\n');
}

/**
 * The breaks from an edited text, or null if anything other than line
 * breaks changed (typed, deleted or pasted characters are refused).
 */
export function breaksFromEdit(original: string, edited: string): number[] | null {
  if (edited.replace(/\n/g, '') !== original) return null;
  const breaks: number[] = [];
  let count = 0;
  for (let i = 0; i < edited.length; i++) {
    if (edited[i] === '\n') breaks.push(count);
    else count++;
  }
  return cleanBreaks(breaks, original.length);
}

/** Keep a field inside the API's limits (x/y 0–100, size 2–25, #RRGGBB). */
export function clampField(f: TextField): TextField {
  const base: TextField = {
    key: f.key,
    id: f.key === 'CUSTOM' ? f.id ?? newCustomId() : f.key,
    x: clamp(Number.isFinite(f.x) ? f.x : 50, 0, 100),
    y: clamp(Number.isFinite(f.y) ? f.y : 50, 0, 100),
    fontSize: clamp(Number.isFinite(f.fontSize) ? f.fontSize : FONT_SIZE.default, FONT_SIZE.min, FONT_SIZE.max),
    color: /^#[0-9a-fA-F]{6}$/.test(f.color) ? f.color.toLowerCase() : DEFAULT_TEXT_COLOR,
    bold: Boolean(f.bold),
    align: ALIGNS.includes(f.align) ? f.align : 'LEFT',
    rotation: normalizeDegrees(f.rotation ?? 0),
  };
  if (isDynamicKey(f.key)) {
    base.sampleLength = Math.round(
      clamp(
        Number.isFinite(f.sampleLength) ? (f.sampleLength as number) : DEFAULT_LENGTH[f.key],
        SAMPLE_LENGTH.min,
        SAMPLE_LENGTH.max,
      ),
    );
    // Own placeholder text instead of X's; may briefly be empty while typing.
    if (f.sampleText != null) base.sampleText = f.sampleText.replace(/\n/g, ' ').slice(0, SAMPLE_TEXT_MAX);
  }
  // While typing, a custom label may briefly be empty; it's cleaned on save.
  if (f.key === 'CUSTOM') base.text = (f.text ?? '').slice(0, CUSTOM_TEXT_MAX);
  // Line breaks are for static items and custom labels only - a dynamic value
  // differs per ticket, so a fixed break could split it mid-word. A custom
  // label's breaks must fall inside its text; static values come from the event.
  if (!isDynamicKey(base.key)) {
    const breaks = cleanBreaks(f.lineBreaks, base.key === 'CUSTOM' ? base.text!.length : undefined);
    if (breaks.length) base.lineBreaks = breaks;
  }
  return base;
}

/**
 * Where a new field goes: the first free line from the top, so several added
 * in a row don't land on top of each other. Its anchor is the ticket's middle:
 * dynamic values start there and fill right, other text is centred on it.
 */
export function newField(key: TextFieldKey, existing: TextField[] = [], text?: string): TextField {
  const slots = [20, 32, 44, 56, 68, 80];
  const taken = (y: number) => existing.some((f) => Math.abs(f.x - 50) < 15 && Math.abs(f.y - y) < 6);
  const y = slots.find((s) => !taken(s)) ?? 50;
  return clampField({
    key,
    x: 50,
    y,
    fontSize: FONT_SIZE.default,
    color: DEFAULT_TEXT_COLOR,
    bold: false,
    // Dynamic values fill from the left by default; static text and labels are centred.
    align: isDynamicKey(key) ? 'LEFT' : 'CENTER',
    rotation: 0,
    ...(key === 'CUSTOM' ? { text: cleanCustomText(text) } : {}),
  });
}

/** Saved fields from a template: known keys only, one each (custom labels: several), clamped. */
export function fieldsFromTemplate(fields: TextField[] | null | undefined): TextField[] {
  const seen = new Set<TextFieldKey>();
  const out: TextField[] = [];
  let custom = 0;
  for (const f of fields ?? []) {
    if (!isKnownKey(f.key)) continue;
    if (f.key === 'CUSTOM') {
      const text = cleanCustomText(f.text);
      if (!text || custom >= MAX_CUSTOM_LABELS) continue;
      custom++;
      out.push(clampField({ ...f, id: undefined, text }));
      continue;
    }
    if (seen.has(f.key)) continue;
    seen.add(f.key);
    out.push(clampField({ ...f, id: undefined }));
  }
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What gets saved: clamped, 2 decimals, no designer-only id; empty custom labels dropped. */
export function fieldsForSave(fields: TextField[]): TextField[] {
  return fields
    .map(clampField)
    .filter((f) => f.key !== 'CUSTOM' || cleanCustomText(f.text))
    .map((f) => {
      const { id: _id, sampleText, ...c } = f;
      // An emptied placeholder text means "back to X's".
      const ownSample = cleanSampleText(sampleText);
      return {
        ...c,
        ...(ownSample ? { sampleText: ownSample } : {}),
        ...(c.key === 'CUSTOM' ? { text: cleanCustomText(c.text) } : {}),
        x: round2(c.x),
        y: round2(c.y),
        fontSize: round2(c.fontSize),
      };
    });
}
