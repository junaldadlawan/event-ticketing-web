import type { LayoutRow, LayoutSection, LayoutSeat, LayoutShape, SeatType, VenueLayout } from '../api/types';

/** The drawn size of a seat, in plan units. */
export const SEAT_R = 9;

/** What a block of seats is built from; read back from the saved rows, so nothing extra is stored. */
export interface SectionParams {
  rows: number;
  perRow: number;
  gap: number;
  rowGap: number;
  firstLabel: string;
  firstNumber: number;
}

export const DEFAULT_PARAMS: SectionParams = { rows: 5, perRow: 10, gap: 26, rowGap: 28, firstLabel: 'A', firstNumber: 1 };

/** A, B ... Z, AA, AB ... (or 1, 2, 3 ... when the first label is a number). */
export function rowLabel(first: string, i: number): string {
  const f = first.trim().toUpperCase();
  if (/^\d+$/.test(f)) return String(Number(f) + i);
  let n = 0;
  for (const ch of /^[A-Z]+$/.test(f) ? f : 'A') n = n * 26 + (ch.charCodeAt(0) - 64);
  n += i; // 1-based: A = 1
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const keyOf = (label: string, number: string) => `${label}|${number}`;

/** The rows and seats for a block, keeping the type (wheelchair, blocked) of a seat that is still there. */
export function buildRows(p: SectionParams, previous: LayoutRow[] = []): LayoutRow[] {
  const types = new Map<string, SeatType>();
  for (const r of previous) for (const s of r.seats) if (s.type && s.type !== 'SEAT') types.set(keyOf(r.label, s.number), s.type);
  const rows: LayoutRow[] = [];
  for (let r = 0; r < p.rows; r++) {
    const label = rowLabel(p.firstLabel, r);
    const seats: LayoutSeat[] = [];
    for (let i = 0; i < p.perRow; i++) {
      const number = String(p.firstNumber + i);
      const type = types.get(keyOf(label, number));
      seats.push({ number, x: round(i * p.gap), y: round(r * p.rowGap), ...(type ? { type } : {}) });
    }
    rows.push({ label, offset: 0, seats });
  }
  return rows;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The settings a block was built with, read from its rows. */
export function paramsOf(section: LayoutSection): SectionParams {
  const first = section.rows[0];
  const second = section.rows[1];
  const s0 = first?.seats[0];
  const s1 = first?.seats[1];
  return {
    rows: section.rows.length || DEFAULT_PARAMS.rows,
    perRow: first?.seats.length || DEFAULT_PARAMS.perRow,
    gap: s0 && s1 ? Math.max(12, round(s1.x - s0.x)) : DEFAULT_PARAMS.gap,
    rowGap: first && second && first.seats[0] && second.seats[0] ? Math.max(12, round(second.seats[0].y - first.seats[0].y)) : DEFAULT_PARAMS.rowGap,
    firstLabel: first?.label ?? DEFAULT_PARAMS.firstLabel,
    firstNumber: Number(s0?.number) || DEFAULT_PARAMS.firstNumber,
  };
}

/** A point inside a section (its row's offset added along x) as a point on the plan: turned about the section's position, then moved there. */
export function worldPoint(section: LayoutSection, x: number, y: number, offset = 0): { x: number; y: number } {
  const a = ((section.rotation ?? 0) * Math.PI) / 180;
  const lx = x + offset;
  return { x: section.x + lx * Math.cos(a) - y * Math.sin(a), y: section.y + lx * Math.sin(a) + y * Math.cos(a) };
}

/** The block's outline inside the section (local units), a little bigger than its seats. */
export function sectionBox(section: LayoutSection): { x: number; y: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of section.rows) {
    for (const s of r.seats) {
      const x = s.x + (r.offset ?? 0);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, s.y);
      maxY = Math.max(maxY, s.y);
    }
  }
  if (!Number.isFinite(minX)) return { x: -SEAT_R, y: -SEAT_R, w: SEAT_R * 2, h: SEAT_R * 2 };
  const pad = SEAT_R + 6;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The smallest upright box around some points. */
function around(points: { x: number; y: number }[]): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Where a section sits on the plan, as an upright box (its outline turned and moved into place). */
export function sectionBounds(section: LayoutSection): Rect {
  const b = sectionBox(section);
  return around([
    worldPoint(section, b.x, b.y),
    worldPoint(section, b.x + b.w, b.y),
    worldPoint(section, b.x, b.y + b.h),
    worldPoint(section, b.x + b.w, b.y + b.h),
  ]);
}

/** The same for a stage, label or wall (turned about its x, y like a section). */
export function shapeBounds(shape: LayoutShape): Rect {
  const w = shape.type === 'LABEL' ? Math.max(40, (shape.text?.length ?? 4) * 11) : shape.width ?? 0;
  const h = shape.type === 'LABEL' ? 26 : shape.height ?? 0;
  const top = shape.type === 'LABEL' ? -20 : 0;
  const turned = { x: shape.x, y: shape.y, rotation: shape.rotation ?? 0 } as LayoutSection;
  return around([worldPoint(turned, 0, top), worldPoint(turned, w, top), worldPoint(turned, 0, top + h), worldPoint(turned, w, top + h)]);
}

export function seatCount(layout: VenueLayout): { total: number; sellable: number; wheelchair: number; blocked: number } {
  let total = 0;
  let wheelchair = 0;
  let blocked = 0;
  for (const sec of layout.sections) {
    for (const r of sec.rows) {
      for (const s of r.seats) {
        total++;
        if (s.type === 'WHEELCHAIR') wheelchair++;
        if (s.type === 'BLOCKED') blocked++;
      }
    }
  }
  return { total, sellable: total - blocked, wheelchair, blocked };
}

/** What the API would refuse, found here first so it can be fixed on the plan. Messages say what and where. */
export function layoutIssues(layout: VenueLayout): string[] {
  const out: string[] = [];
  if (layout.sections.length > 50) out.push('A layout holds at most 50 sections.');
  const { total } = seatCount(layout);
  if (total > 5000) out.push(`A layout holds at most 5,000 seats (it has ${total}).`);
  if ((layout.shapes?.length ?? 0) > 200) out.push('A layout holds at most 200 shapes.');
  const names = new Map<string, number>();
  layout.sections.forEach((sec) => {
    const name = sec.name.trim();
    if (!name) out.push('A section has no name.');
    const k = name.toLowerCase();
    names.set(k, (names.get(k) ?? 0) + 1);
    if (name.length > 100) out.push(`"${name.slice(0, 20)}…": the name is over 100 characters.`);
    if (sec.rows.some((r) => r.label.length > 20 || r.seats.some((s) => s.number.length > 20))) out.push(`${name}: a row label or seat number is over 20 characters.`);
    let outside = 0;
    for (const r of sec.rows)
      for (const s of r.seats) {
        const p = worldPoint(sec, s.x, s.y, r.offset ?? 0);
        if (p.x < 0 || p.y < 0 || p.x > layout.width || p.y > layout.height) outside++;
      }
    if (outside > 0) out.push(`${name}: ${outside} ${outside === 1 ? 'seat is' : 'seats are'} outside the plan. Move the section in, or make the plan bigger.`);
  });
  for (const [k, n] of names) if (n > 1 && k) out.push(`Two sections are called "${layout.sections.find((s) => s.name.trim().toLowerCase() === k)?.name.trim()}". Names must be different.`);
  (layout.shapes ?? []).forEach((sh, i) => {
    if (sh.type === 'LABEL' && !(sh.text ?? '').trim()) out.push(`Label ${i + 1} has no text.`);
    if (sh.type !== 'LABEL') {
      const w = sh.width ?? 0;
      const h = sh.height ?? 0;
      if (sh.x < 0 || sh.y < 0 || sh.x + w > layout.width || sh.y + h > layout.height) out.push(`The ${sh.type === 'STAGE' ? 'stage' : 'wall'} goes outside the plan.`);
    } else if (sh.x < 0 || sh.y < 0 || sh.x > layout.width || sh.y > layout.height) {
      out.push('A label is outside the plan.');
    }
  });
  return out;
}

export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, () => ((Math.random() * 16) | 0).toString(16)));
