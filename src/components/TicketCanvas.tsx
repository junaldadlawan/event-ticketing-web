import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { CodePlacement, CodeType, TextField } from '../api/types';
import {
  breaksFromEdit,
  clampField,
  fieldId,
  isDynamicKey,
  placeholderLabel,
  printedLines,
  textWithBreaks,
} from './ticketTextFields';

/** Size of the ticket in pixels. All placements are % of this. */
export interface TicketSize {
  width: number;
  height: number;
}

/** Used when there's no background image (what the API renders by default). */
export const DEFAULT_TICKET_SIZE: TicketSize = { width: 900, height: 380 };

/**
 * Fixed shape per code type (width / height), smallest width in % that still
 * scans, and whether it may be rotated. Mirrors the API's CodeType enum and
 * TicketTemplateServiceImpl#requireValidCodePlacement - keep them in sync, or
 * placements made here get rejected on save.
 */
const SHAPES: Record<CodeType, { aspect: number; minWidth: number; minInches?: number; label: string; rotatable: boolean }> = {
  // A QR code's minimum is a real size (0.75 in), not a share of the ticket.
  QR: { aspect: 1, minWidth: 0, minInches: 0.75, label: 'QR code', rotatable: true },
  BARCODE: { aspect: 3, minWidth: 35, label: 'Barcode', rotatable: true },
};

/** Pixels per inch a ticket's pixel size is defined in (same as the API's CodeType.PX_PER_INCH). */
const PX_PER_INCH = 300;

/** Smallest scannable width of a code type, in % of a ticket `ticketWidthPx` wide. */
function minWidthPct(type: CodeType, ticketWidthPx: number): number {
  const { minWidth, minInches } = SHAPES[type];
  return minInches ? Math.min(100, ((minInches * PX_PER_INCH) / ticketWidthPx) * 100) : minWidth;
}

export function codeLabel(type: CodeType) {
  return SHAPES[type].label;
}

/** Whether a code type may be rotated (both can; the API accepts 0-359° for either). */
export function isRotatable(type: CodeType) {
  return SHAPES[type].rotatable;
}

/** A code type's fixed shape (width / height) and its smallest scannable width (% of a ticket this wide). */
export function codeShape(type: CodeType, ticketWidthPx: number) {
  return { aspect: SHAPES[type].aspect, minWidth: minWidthPct(type, ticketWidthPx) };
}

/** Any angle -> whole degrees in [0, 360). */
export function normalizeRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((Math.round(deg) % 360) + 360) % 360;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/* ---- geometry, in ticket pixels ---- */

interface Box {
  cx: number; // centre
  cy: number;
  w: number; // unrotated size
  h: number;
  rot: number; // degrees
}

function toBox(p: CodePlacement, t: TicketSize): Box {
  const w = (p.codeWidth / 100) * t.width;
  const h = w / SHAPES[p.codeType].aspect;
  return {
    cx: (p.codeX / 100) * t.width + w / 2,
    cy: (p.codeY / 100) * t.height + h / 2,
    w,
    h,
    rot: p.codeRotation,
  };
}

function fromBox(type: CodeType, b: Box, t: TicketSize): CodePlacement {
  return {
    codeType: type,
    codeWidth: (b.w / t.width) * 100,
    codeX: ((b.cx - b.w / 2) / t.width) * 100,
    codeY: ((b.cy - b.h / 2) / t.height) * 100,
    codeRotation: b.rot,
  };
}

/** Size of the axis-aligned box around the rotated code. */
function boundingSize(w: number, h: number, rotDeg: number) {
  const r = (rotDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { bw: w * c + h * s, bh: w * s + h * c };
}

/**
 * Allowed range for the centre of a box, under both rules that apply:
 * - what you see: the rotated outline stays on the ticket;
 * - what the API checks on save: the *unrotated* box has codeX >= 0,
 *   codeX + codeWidth <= 100 and codeY >= 0.
 * For an unrotated code these are the same; for a rotated barcode the API's
 * rule is the stricter one horizontally (it can't hug the left/right edge).
 */
function centreRange(w: number, h: number, rot: number, t: TicketSize) {
  const { bw, bh } = boundingSize(w, h, rot);
  const halfX = Math.max(bw, w) / 2;
  return {
    minX: halfX,
    maxX: t.width - halfX,
    minY: Math.max(bh, h) / 2,
    maxY: t.height - bh / 2,
  };
}

/**
 * Keep the code fully inside the ticket at its type's shape and rotation, in a
 * spot the API will accept; if it can't fit at its current size it is scaled
 * down.
 */
export function clampPlacement(p: CodePlacement, t: TicketSize): CodePlacement {
  const rot = isRotatable(p.codeType) ? normalizeRotation(p.codeRotation) : 0;
  // On a short, wide ticket a steeply rotated barcode can't fit at its minimum
  // scannable size; rather than shrink it below what the API accepts, stand it
  // back upright (rotatePlacement refuses such rotations before they get here).
  if (rot !== 0 && !rotationFits(p.codeType, rot, t)) return clampAt(p, 0, t);
  return clampAt(p, rot, t);
}

/** Whether the type's minimum size, turned by `rot`, can sit on the ticket. */
function rotationFits(type: CodeType, rot: number, t: TicketSize) {
  const { aspect } = SHAPES[type];
  const w = (minWidthPct(type, t.width) / 100) * t.width;
  const { bw, bh } = boundingSize(w, w / aspect, rot);
  const e = 1e-9;
  return bw <= t.width + e && bh <= t.height + e && w / aspect + bh <= 2 * t.height + e && w <= t.width + e;
}

function clampAt(p: CodePlacement, rot: number, t: TicketSize): CodePlacement {
  const { aspect } = SHAPES[p.codeType];
  const minWidth = minWidthPct(p.codeType, t.width);
  // Take the centre from the placement as given, *before* changing the size:
  // size limits must grow/shrink the code around its centre. (Re-deriving the
  // centre from codeX after changing the width anchored it at the top-left
  // corner, so the code jumped about when resized below its minimum.)
  const { cx, cy, w: requested } = toBox(p, t);
  let w = clamp(requested, (minWidth / 100) * t.width, t.width);
  const { bw, bh } = boundingSize(w, w / aspect, rot);
  // Everything scales with w, so one factor makes every range non-empty:
  // outline fits across and down, and the top rule (cy >= h/2) leaves room
  // for the bottom rule (cy <= height - bh/2).
  const fit = Math.min(1, t.width / bw, t.height / bh, (2 * t.height) / (w / aspect + bh));
  w *= fit;
  const h = w / aspect;
  const r = centreRange(w, h, rot, t);
  return fromBox(
    p.codeType,
    { w, h, rot, cx: clamp(cx, r.minX, r.maxX), cy: clamp(cy, r.minY, r.maxY) },
    t,
  );
}

/**
 * Default placement per type: bottom-right, inset like the API's renderer
 * (on the default 900x380 ticket the QR is its 260px square, 24px in).
 */
export function defaultPlacement(codeType: CodeType, t: TicketSize): CodePlacement {
  const scale = Math.min(t.width / DEFAULT_TICKET_SIZE.width, t.height / DEFAULT_TICKET_SIZE.height);
  const margin = 24 * scale;
  const { aspect } = SHAPES[codeType];
  const w = codeType === 'QR' ? 260 * scale : Math.min(t.width * 0.4, (t.height - 2 * margin) * aspect);
  const h = w / aspect;
  return clampPlacement(
    fromBox(codeType, { w, h, cx: t.width - margin - w / 2, cy: t.height - margin - h / 2, rot: 0 }, t),
    t,
  );
}

/** Switch type, keeping the code centred where it was (and its rotation, if the new type allows one). */
export function changeCodeType(p: CodePlacement, codeType: CodeType, t: TicketSize): CodePlacement {
  if (p.codeType === codeType) return p;
  const { cx, cy } = toBox(p, t);
  const d = defaultPlacement(codeType, t);
  const w = (d.codeWidth / 100) * t.width;
  return clampPlacement(
    fromBox(
      codeType,
      { cx, cy, w, h: w / SHAPES[codeType].aspect, rot: isRotatable(codeType) ? p.codeRotation : 0 },
      t,
    ),
    t,
  );
}

/** Rotate the vector (x, y) clockwise by `deg` (screen coordinates, y down). */
function rotateVec(x: number, y: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** The four resize dots: where each sits, and the corner that stays fixed while it's dragged. */
const CORNER_HANDLES: { at: 'tl' | 'tr' | 'bl' | 'br'; fixed: Exclude<ResizeAnchor, 'centre'> }[] = [
  { at: 'tl', fixed: 'bottom-right' },
  { at: 'tr', fixed: 'bottom-left' },
  { at: 'bl', fixed: 'top-right' },
  { at: 'br', fixed: 'top-left' },
];

/** Which corner, as signs from the centre in the box's own frame (-1 = left / top). */
type Side = { x: -1 | 1; y: -1 | 1 };
const ANCHOR_SIDE: Record<Exclude<ResizeAnchor, 'centre'>, Side> = {
  'top-left': { x: -1, y: -1 },
  'top-right': { x: 1, y: -1 },
  'bottom-left': { x: -1, y: 1 },
  'bottom-right': { x: 1, y: 1 },
};

/** A corner of the (rotated) box, in ticket px. */
function cornerOf(b: Box, sx: number, sy: number) {
  const v = rotateVec((sx * b.w) / 2, (sy * b.h) / 2, b.rot);
  return { x: b.cx + v.x, y: b.cy + v.y };
}

/** The box of width `w` whose own corner (sx, sy; default top-left) sits at `corner`. */
function boxFromCorner(corner: { x: number; y: number }, w: number, aspect: number, rot: number, sx = -1, sy = -1): Box {
  const h = w / aspect;
  const v = rotateVec((sx * w) / 2, (sy * h) / 2, rot);
  return { cx: corner.x - v.x, cy: corner.y - v.y, w, h, rot };
}

/** On the ticket *and* acceptable to the API (see centreRange). */
function fitsOnTicket(b: Box, t: TicketSize) {
  const r = centreRange(b.w, b.h, b.rot, t);
  const e = 1e-6;
  return b.cx >= r.minX - e && b.cx <= r.maxX + e && b.cy >= r.minY - e && b.cy <= r.maxY + e;
}

/** What stays fixed while resizing. */
export type ResizeAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'centre';

/**
 * Set the width (% of ticket width), keeping one point fixed:
 * - a corner ('top-left' default, 'top-right', 'bottom-left', 'bottom-right'):
 *   that corner of the code (in its own, rotated frame) - the opposite edges move.
 * - 'centre': the centre - it grows/shrinks evenly on all sides.
 * Growing stops where the code would leave the ticket instead of shifting
 * the fixed point; sizes below the type's minimum are raised to it, still
 * from the same fixed point.
 */
export function resizePlacement(
  p: CodePlacement,
  codeWidth: number,
  t: TicketSize,
  anchor: ResizeAnchor = 'top-left',
): CodePlacement {
  const { aspect } = SHAPES[p.codeType];
  const minWidth = minWidthPct(p.codeType, t.width);
  const start = toBox(clampPlacement(p, t), t);
  const side = ANCHOR_SIDE[anchor === 'centre' ? 'top-left' : anchor];
  const corner = cornerOf(start, side.x, side.y);
  const minW = (minWidth / 100) * t.width;
  const requested = Math.max((codeWidth / 100) * t.width, minW);
  const at = (w: number): Box =>
    anchor === 'centre' ? { ...start, w, h: w / aspect } : boxFromCorner(corner, w, aspect, start.rot, side.x, side.y);

  let w = requested;
  if (!fitsOnTicket(at(w), t)) {
    // Largest width that still fits from the fixed point (fit shrinks monotonically).
    let lo = Math.min(start.w, requested);
    let hi = requested;
    if (!fitsOnTicket(at(lo), t)) lo = minW;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fitsOnTicket(at(mid), t)) lo = mid;
      else hi = mid;
    }
    w = lo;
  }
  // clampPlacement only nudges if the minimum size can't fit at the fixed point.
  return clampPlacement(fromBox(p.codeType, at(w), t), t);
}

/**
 * Rotate around the centre; keeps the code inside the ticket. No-op for QR
 * codes, and for angles at which the barcode couldn't fit at its minimum
 * size (it stays at its current angle instead).
 */
export function rotatePlacement(p: CodePlacement, degrees: number, t: TicketSize): CodePlacement {
  const rot = normalizeRotation(degrees);
  if (!isRotatable(p.codeType) || !rotationFits(p.codeType, rot, t)) return clampPlacement(p, t);
  return clampPlacement({ ...p, codeRotation: rot }, t);
}

/* ---- background image placement ---- */

/** Where the background image sits, in % of the ticket (may reach past the edges; the ticket clips it). */
export interface BackgroundRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type BackgroundFitMode = 'COVER' | 'CONTAIN' | 'STRETCH' | 'CUSTOM';

/** Width limits for a moved/resized image, in % of the ticket's width. */
export const BG_WIDTH = { min: 5, max: 500 } as const;

/** The rect a fit preset gives: centred, scaled to fill (cover) or fit (contain), or stretched. */
export function fitBackground(fit: Exclude<BackgroundFitMode, 'CUSTOM'>, t: TicketSize, img: TicketSize): BackgroundRect {
  if (fit === 'STRETCH') return { x: 0, y: 0, width: 100, height: 100 };
  const pick = fit === 'COVER' ? Math.max : Math.min;
  const s = pick(t.width / img.width, t.height / img.height);
  const w = ((img.width * s) / t.width) * 100;
  const h = ((img.height * s) / t.height) * 100;
  return { x: (100 - w) / 2, y: (100 - h) / 2, width: w, height: h };
}

/**
 * Keep a moved/resized image inside sensible limits: width 5-500% (height
 * follows the image's shape when known) and at least 5% of it still on the
 * ticket, so it can always be grabbed again.
 */
export function clampBackground(r: BackgroundRect, t: TicketSize, img: TicketSize | null): BackgroundRect {
  const width = Math.min(Math.max(r.width, BG_WIDTH.min), BG_WIDTH.max);
  const height = img ? ((width / 100) * t.width * (img.height / img.width) / t.height) * 100 : (r.height * width) / r.width;
  return {
    x: Math.min(Math.max(r.x, 5 - width), 95),
    y: Math.min(Math.max(r.y, 5 - height), 95),
    width,
    height,
  };
}

/* ---- component ---- */

type Drag =
  | { mode: 'move'; startX: number; startY: number; start: CodePlacement }
  | { mode: 'resize'; anchor: ResizeAnchor; startDist: number; start: CodePlacement }
  | { mode: 'rotate'; start: CodePlacement }
  | { mode: 'field'; startX: number; startY: number; start: TextField }
  | { mode: 'fieldRotate'; start: TextField; cx: number; cy: number }
  | { mode: 'bgMove'; startX: number; startY: number; start: BackgroundRect }
  | { mode: 'bgResize'; ax: number; ay: number; side: Side; startDist: number; start: BackgroundRect }
  | { mode: 'group'; startX: number; startY: number; fields: TextField[]; code: CodePlacement | null };

/** What's selected on the canvas: the code, the background image, a text field (by fieldId), or nothing. */
export type CanvasSelection = 'code' | 'background' | (string & {}) | null;

/** Static items and custom labels can be split into lines; dynamic values can't (they differ per ticket). */
const canBreakLines = (key: TextField['key']) => !isDynamicKey(key);

const ALIGN_SHIFT: Record<TextField['align'], string> = { LEFT: '0', CENTER: '-50%', RIGHT: '-100%' };

/** Default grid: square cells, 40 across the ticket's width. */
/** Print safe area: keep important things this far inside the edges (1/16 in = ~1.6 mm at 300 DPI). */
export const SAFE_MARGIN_PX = 18.75;

/** A layout problem, and the item it's about ('code' or a text field's id). */
export interface LayoutWarning {
  /** overlap = text on text, or text on the code (the page pops these up). */
  kind: 'overlap' | 'size' | 'offTicket' | 'safeArea';
  target: string;
  /** "QR code", "Attendee name", 'Label "VIP"'. */
  item: string;
  message: string;
  /** Overlaps: the other item(s) involved - they're marked too. */
  partners?: string[];
}

export const GRID_COLUMNS = 40;
export const GRID_PX = { min: 2, max: 500 } as const;

/** The default grid cell size in ticket pixels for a ticket of this size. */
export function autoGridPx(size: TicketSize) {
  return size.width / GRID_COLUMNS;
}

/**
 * Grid cell size in % of the ticket's width (x) and height (y). `cellPx` is the
 * square cell's side in ticket pixels (= background image pixels); omitted =
 * auto (40 across).
 */
export function gridStep(size: TicketSize, cellPx?: number | null) {
  const px = cellPx && cellPx > 0 ? cellPx : autoGridPx(size);
  return { x: (px / size.width) * 100, y: (px / size.height) * 100 };
}

const snapTo = (v: number, step: number) => Math.round(v / step) * step;

export function TicketCanvas({
  backgroundUrl,
  backgroundColor = null,
  backgroundFit = 'COVER',
  backgroundRect = null,
  onBackgroundChange,
  size,
  placement,
  onChange,
  resizeFromCentre = false,
  onCodeMove,
  leavingIds = [],
  onImageSize,
  showCode = true,
  textFields = [],
  fieldText,
  selected = null,
  onSelect,
  selectedIds,
  onGroupMove,
  onWarnings,
  printGuides = false,
  dimensions,
  onFieldChange,
  onFieldRemove,
  onCodeRemove,
  showGrid = false,
  gridPx = null,
  snap = false,
  preview = false,
  fieldValue,
}: {
  backgroundUrl: string | null;
  /** The ticket's fill color (shows where the image is transparent or absent); null = white. */
  backgroundColor?: string | null;
  /** How the image fills a ticket of another shape. */
  backgroundFit?: BackgroundFitMode;
  /** Where the image sits (% of the ticket); null = fill by backgroundFit until its size is known. */
  backgroundRect?: BackgroundRect | null;
  /** The image was moved or resized (it becomes selectable when this is set). */
  onBackgroundChange?: (r: BackgroundRect) => void;
  /** The ticket's size; the canvas takes its shape (fitted to the screen). */
  size: TicketSize;
  placement: CodePlacement;
  onChange: (p: CodePlacement) => void;
  /** Resizing the code (corner drag, + / - keys) keeps its centre fixed instead of the opposite corner. */
  resizeFromCentre?: boolean;
  /** The code was moved (drag, arrow keys, group drag) - not resized or rotated. */
  onCodeMove?: () => void;
  /** Ids (field ids, or "code") being removed: they fade out before the page drops them. */
  leavingIds?: string[];
  /** Reports the background image's real pixel size once it has loaded. */
  onImageSize?: (size: TicketSize) => void;
  /** False when the organizer removed the QR/barcode from the ticket. */
  showCode?: boolean;
  textFields?: TextField[];
  /** The example text shown for each field. */
  fieldText?: (f: TextField) => string;
  selected?: CanvasSelection;
  /** additive = Shift-click: add the item to (or take it out of) a multi-selection. */
  onSelect?: (s: CanvasSelection, additive?: boolean) => void;
  /** Everything selected (2+ = a group that drags together); defaults to just `selected`. */
  selectedIds?: string[];
  /** A group drag moved these fields and (if it was in the group) the code - one change. */
  onGroupMove?: (fields: TextField[], code: CodePlacement | null) => void;
  /** Layout problems (code too small / covered / outside the safe area, text off the ticket / outside the safe area). */
  onWarnings?: (warnings: LayoutWarning[]) => void;
  /** Printable ticket: show the print safe area (1/16 in inside the edges at 300 DPI). */
  printGuides?: boolean;
  /** Size labels shown outside the ticket: width along the top, height down the left. */
  dimensions?: { width: string; height: string };
  onFieldChange?: (f: TextField) => void;
  onFieldRemove?: (id: string) => void;
  /** Delete / Backspace on the selected code (the page asks before removing it). */
  onCodeRemove?: () => void;
  /** Draw grid lines over the ticket. */
  showGrid?: boolean;
  /** While dragging, snap text fields and the code to the grid. */
  snap?: boolean;
  /** Preview: read-only, no outlines or handles - looks like the printed ticket. */
  preview?: boolean;
  /** In preview, a dynamic field's sample value (shown inside its reserved X box); null = its usual text. */
  fieldValue?: (f: TextField) => string | null;
  /** Grid cell size in ticket pixels; null = auto (40 across). */
  gridPx?: number | null;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [imageFailed, setImageFailed] = useState<string | null>(null);
  // The text field being split into lines (double-click); ends when it loses focus.
  const [editing, setEditing] = useState<string | null>(null);
  // The background image's own pixel size, once it has loaded (keeps its shape while resizing).
  const [natural, setNatural] = useState<TicketSize | null>(null);
  // Alignment guide lines shown while dragging (% of the ticket), null = none.
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [warnings, setWarnings] = useState<LayoutWarning[]>([]);
  const ids = selectedIds ?? (selected ? [selected] : []);
  const isMulti = ids.length > 1;
  const showImage = Boolean(backgroundUrl) && imageFailed !== backgroundUrl;
  const { codeType, codeX, codeY, codeWidth, codeRotation } = placement;
  const label = codeLabel(codeType);
  const rotatable = isRotatable(codeType);

  /** A point on the ticket (ticket pixels) in screen pixels. */
  function toScreen(pt: { x: number; y: number }) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: rect.left + (pt.x / size.width) * rect.width,
      y: rect.top + (pt.y / size.height) * rect.height,
    };
  }

  /** The point that stays fixed for a resize, in screen pixels. */
  function screenAnchor(p: CodePlacement, anchor: ResizeAnchor) {
    const b = toBox(p, size);
    if (anchor === 'centre') return toScreen({ x: b.cx, y: b.cy });
    const side = ANCHOR_SIDE[anchor];
    return toScreen(cornerOf(b, side.x, side.y));
  }

  function capture(e: ReactPointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  /**
   * Shift-click adds to / takes out of a multi-selection; a press on a member of
   * a group starts a group drag. Returns true when it handled the press.
   */
  function groupPress(e: ReactPointerEvent, id: string) {
    if (e.shiftKey && onSelect) {
      e.preventDefault();
      e.stopPropagation();
      onSelect(id, true);
      return true;
    }
    if (isMulti && ids.includes(id) && onGroupMove) {
      capture(e);
      drag.current = {
        mode: 'group',
        startX: e.clientX,
        startY: e.clientY,
        fields: textFields.filter((f) => ids.includes(fieldId(f))),
        code: ids.includes('code') && showCode ? placement : null,
      };
      return true;
    }
    return false;
  }

  /** Lines an item can line up with: the ticket's centre, other text anchors, the code's edges and centre (%). */
  function guideLines(exclude: string) {
    const xs = [50];
    const ys = [50];
    for (const f of textFields) {
      if (fieldId(f) === exclude) continue;
      xs.push(f.x);
      ys.push(f.y);
    }
    if (showCode && exclude !== 'code') {
      const h = codeHeightPct(placement);
      xs.push(codeX, codeX + codeWidth / 2, codeX + codeWidth);
      ys.push(codeY, codeY + h / 2, codeY + h);
    }
    return { xs, ys };
  }

  /** The code's height in % of the ticket's height (its shape is fixed per type). */
  function codeHeightPct(p: CodePlacement) {
    return ((p.codeWidth / 100) * size.width) / SHAPES[p.codeType].aspect / size.height * 100;
  }

  /** Nudge to the nearest guide line within ~6 screen px: the shift to apply, and the line. */
  function snapToGuide(points: number[], lines: number[], tolerance: number) {
    let best: { delta: number; line: number } | null = null;
    for (const p of points) {
      for (const l of lines) {
        const delta = l - p;
        if (Math.abs(delta) <= tolerance && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line: l };
      }
    }
    return best;
  }

  function beginMove(e: ReactPointerEvent) {
    if (groupPress(e, 'code')) return;
    capture(e);
    // capture() cancels the press's default, which includes focusing the code - without this the
    // arrow keys never reach it (text fields focus themselves the same way in beginFieldMove).
    (e.currentTarget as HTMLElement).focus();
    onSelect?.('code');
    drag.current = { mode: 'move', startX: e.clientX, startY: e.clientY, start: placement };
  }

  function beginResize(cornerAnchor: ResizeAnchor) {
    return (e: ReactPointerEvent) => {
      const anchor: ResizeAnchor = resizeFromCentre ? 'centre' : cornerAnchor;
      capture(e);
      onSelect?.('code');
      const a = screenAnchor(placement, anchor);
      drag.current = {
        mode: 'resize',
        anchor,
        startDist: Math.max(1, Math.hypot(e.clientX - a.x, e.clientY - a.y)),
        start: placement,
      };
    };
  }

  function beginRotate(e: ReactPointerEvent) {
    capture(e);
    onSelect?.('code');
    drag.current = { mode: 'rotate', start: placement };
  }

  function beginFieldMove(f: TextField) {
    return (e: ReactPointerEvent) => {
      if (groupPress(e, fieldId(f))) return;
      capture(e);
      (e.currentTarget as HTMLElement).focus();
      onSelect?.(fieldId(f));
      drag.current = { mode: 'field', startX: e.clientX, startY: e.clientY, start: f };
    };
  }

  function move(e: ReactPointerEvent) {
    const d = drag.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const step = gridStep(size, gridPx);
    if (d.mode === 'bgMove') {
      const dx = ((e.clientX - d.startX) / rect.width) * 100;
      const dy = ((e.clientY - d.startY) / rect.height) * 100;
      let x = d.start.x + dx;
      let y = d.start.y + dy;
      if (snap) {
        x = snapTo(x, step.x);
        y = snapTo(y, step.y);
      }
      onBackgroundChange?.(clampBackground({ ...d.start, x, y }, size, natural));
      return;
    }
    if (d.mode === 'bgResize') {
      // The opposite corner stays put; scale by how far the pointer is from it (shape kept).
      const s = d.start;
      const width = Math.min(Math.max(s.width * (Math.hypot(e.clientX - d.ax, e.clientY - d.ay) / d.startDist), BG_WIDTH.min), BG_WIDTH.max);
      const height = s.height * (width / s.width);
      const x = d.side.x < 0 ? s.x : s.x + s.width - width;
      const y = d.side.y < 0 ? s.y : s.y + s.height - height;
      onBackgroundChange?.(clampBackground({ x, y, width, height }, size, natural));
      return;
    }
    if (d.mode === 'fieldRotate') {
      // The knob sits straight above the box's centre (what the text turns around), so pointing up = 0 degrees.
      const ax = d.cx;
      const ay = d.cy;
      let deg = (Math.atan2(e.clientY - ay, e.clientX - ax) * 180) / Math.PI + 90;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      onFieldChange?.(clampField({ ...d.start, rotation: deg }));
      return;
    }
    if (d.mode === 'group') {
      const dx = ((e.clientX - d.startX) / rect.width) * 100;
      const dy = ((e.clientY - d.startY) / rect.height) * 100;
      if (d.code) onCodeMove?.();
      onGroupMove?.(
        d.fields.map((f) => clampField({ ...f, x: f.x + dx, y: f.y + dy })),
        d.code ? clampPlacement({ ...d.code, codeX: d.code.codeX + dx, codeY: d.code.codeY + dy }, size) : null,
      );
      return;
    }
    // Guides: line up with the ticket's centre and other items (~6 px pull); off with the magnet, or Alt for one drag.
    const tolX = (6 / rect.width) * 100;
    const tolY = (6 / rect.height) * 100;
    if (d.mode === 'field') {
      const dx = ((e.clientX - d.startX) / rect.width) * 100;
      const dy = ((e.clientY - d.startY) / rect.height) * 100;
      let x = d.start.x + dx;
      let y = d.start.y + dy;
      // Snap the anchor point (aligned edge / centre line) to the grid.
      if (snap) {
        x = snapTo(x, step.x);
        y = snapTo(y, step.y);
      }
      let gx: number | null = null;
      let gy: number | null = null;
      if (snap && !e.altKey) {
        const { xs, ys } = guideLines(fieldId(d.start));
        const sx = snapToGuide([x], xs, tolX);
        const sy = snapToGuide([y], ys, tolY);
        if (sx) {
          x += sx.delta;
          gx = sx.line;
        }
        if (sy) {
          y += sy.delta;
          gy = sy.line;
        }
      }
      setGuides({ x: gx, y: gy });
      onFieldChange?.(clampField({ ...d.start, x, y }));
      return;
    }
    const s = d.start;
    if (d.mode === 'move') {
      const dx = ((e.clientX - d.startX) / rect.width) * 100;
      const dy = ((e.clientY - d.startY) / rect.height) * 100;
      let codeX = s.codeX + dx;
      let codeY = s.codeY + dy;
      // Snap the code's top-left corner to the grid (the edges may still be
      // nudged back inside the ticket).
      if (snap) {
        codeX = snapTo(codeX, step.x);
        codeY = snapTo(codeY, step.y);
      }
      // Guides for the code: its left / centre / right and top / middle / bottom.
      let gx: number | null = null;
      let gy: number | null = null;
      if (snap && !e.altKey) {
        const { xs, ys } = guideLines('code');
        const h = codeHeightPct(s);
        const sx = snapToGuide([codeX, codeX + s.codeWidth / 2, codeX + s.codeWidth], xs, tolX);
        const sy = snapToGuide([codeY, codeY + h / 2, codeY + h], ys, tolY);
        if (sx) {
          codeX += sx.delta;
          gx = sx.line;
        }
        if (sy) {
          codeY += sy.delta;
          gy = sy.line;
        }
      }
      setGuides({ x: gx, y: gy });
      onCodeMove?.();
      onChange(clampPlacement({ ...s, codeX, codeY }, size));
    } else if (d.mode === 'resize') {
      // The anchor (top-left corner or centre) stays put; scale by how far the
      // pointer is from it compared to where the drag started (any rotation).
      const a = screenAnchor(s, d.anchor);
      const scale = Math.hypot(e.clientX - a.x, e.clientY - a.y) / d.startDist;
      onChange(resizePlacement(s, s.codeWidth * scale, size, d.anchor));
    } else {
      // The knob sits straight above the centre, so pointing up = 0 degrees.
      const c = screenAnchor(s, 'centre');
      let deg = (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI + 90;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      onChange(rotatePlacement(s, deg, size));
    }
  }

  function end() {
    drag.current = null;
    // Functional: this handler may come from a render before the guides appeared.
    setGuides((g) => (g.x === null && g.y === null ? g : { x: null, y: null }));
  }

  // Layout checks, measured after each render (cheap): the code must be big
  // enough to print, uncovered and inside the print safe area; text must stay
  // on the ticket (and inside the safe area when printed). Not re-measured in
  // preview, where sample values replace the boxes being checked.
  const safeX = (SAFE_MARGIN_PX / size.width) * 100;
  const safeY = (SAFE_MARGIN_PX / size.height) * 100;
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || preview) return;
    const list: LayoutWarning[] = [];
    const c = canvas.getBoundingClientRect();
    const safe = {
      left: c.left + (safeX / 100) * c.width,
      right: c.right - (safeX / 100) * c.width,
      top: c.top + (safeY / 100) * c.height,
      bottom: c.bottom - (safeY / 100) * c.height,
    };
    const fieldEls = [...canvas.querySelectorAll<HTMLElement>('.ticket-field')];
    const codeEl = canvas.querySelector('.dummy-code');
    if (showCode && codeEl) {
      const item = label;
      const px = (codeWidth / 100) * size.width;
      const min = codeType === 'QR' ? 225 : 450;
      if (px < min) {
        list.push({
          kind: 'size',
          target: 'code',
          item,
          message: `Small for printing: ${Math.round(px)} px wide (aim for ${min}+ px, about ${codeType === 'QR' ? '¾' : '1½'} in)`,
        });
      }
      const k = codeEl.getBoundingClientRect();
      // The text fields lying on the code (each gets a "!" too).
      const covering = fieldEls.flatMap((el, i) => {
        const r = el.getBoundingClientRect();
        const hit = r.left < k.right && r.right > k.left && r.top < k.bottom && r.bottom > k.top;
        return hit && textFields[i] ? [fieldId(textFields[i])] : [];
      });
      if (covering.length) {
        list.push({ kind: 'overlap', target: 'code', item, message: 'Text overlaps it - it may not scan', partners: covering });
      }
      const h = codeHeightPct(placement);
      if (printGuides && (codeX < safeX || codeY < safeY || codeX + codeWidth > 100 - safeX || codeY + h > 100 - safeY)) {
        list.push({ kind: 'safeArea', target: 'code', item, message: 'Outside the print safe area - it may be trimmed off' });
      }
    }
    fieldEls.forEach((el, i) => {
      const f = textFields[i];
      if (!f) return;
      const item = f.key === 'CUSTOM' ? `Label “${f.text ?? ''}”` : placeholderLabel(f.key);
      const r = el.getBoundingClientRect();
      if (r.left < c.left - 1 || r.right > c.right + 1 || r.top < c.top - 1 || r.bottom > c.bottom + 1) {
        list.push({ kind: 'offTicket', target: fieldId(f), item, message: 'Runs off the ticket - part of it won’t print' });
      } else if (printGuides && (r.left < safe.left || r.right > safe.right || r.top < safe.top || r.bottom > safe.bottom)) {
        list.push({ kind: 'safeArea', target: fieldId(f), item, message: 'Outside the print safe area - it may be trimmed off' });
      }
    });
    // Text on text: each overlapping pair once, on the one drawn on top (the
    // later field). A couple of px of touching doesn't count.
    const names = textFields.map((f) => (f.key === 'CUSTOM' ? `Label “${f.text ?? ''}”` : placeholderLabel(f.key)));
    const rects = fieldEls.map((el) => el.getBoundingClientRect());
    for (let j = 1; j < rects.length; j++) {
      for (let i = 0; i < j; i++) {
        const a = rects[i];
        const b = rects[j];
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 2 && overlapY > 2 && textFields[j]) {
          list.push({
            kind: 'overlap',
            target: fieldId(textFields[j]),
            item: names[j],
            message: `Overlaps ${names[i]}`,
            partners: textFields[i] ? [fieldId(textFields[i])] : [],
          });
        }
      }
    }
    const key = (w: LayoutWarning[]) => w.map((x) => `${x.target}:${x.message}:${(x.partners ?? []).join(",")}`).join("|");
    if (key(list) !== key(warnings)) {
      setWarnings(list);
      onWarnings?.(list);
    }
  });
  const codeWarnings = warnings.filter((w) => w.target === 'code');
  // Every item a warning is about (incl. the other side of an overlap): each shows a "!".
  const flagged = new Set(warnings.flatMap((w) => [w.target, ...(w.partners ?? [])]));

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onCodeRemove?.();
      return;
    }
    const step = e.shiftKey ? 5 : 1;
    const turn = e.shiftKey ? 15 : 1;
    const actions: Record<string, () => CodePlacement> = {
      ArrowLeft: () => clampPlacement({ ...placement, codeX: codeX - step }, size),
      ArrowRight: () => clampPlacement({ ...placement, codeX: codeX + step }, size),
      ArrowUp: () => clampPlacement({ ...placement, codeY: codeY - step }, size),
      ArrowDown: () => clampPlacement({ ...placement, codeY: codeY + step }, size),
      // Same as the - / + buttons: top-left corner stays put.
      '+': () => resizePlacement(placement, codeWidth + step, size, resizeFromCentre ? 'centre' : undefined),
      '=': () => resizePlacement(placement, codeWidth + step, size, resizeFromCentre ? 'centre' : undefined),
      '-': () => resizePlacement(placement, codeWidth - step, size, resizeFromCentre ? 'centre' : undefined),
      '[': () => rotatePlacement(placement, codeRotation - turn, size),
      '{': () => rotatePlacement(placement, codeRotation - turn, size),
      ']': () => rotatePlacement(placement, codeRotation + turn, size),
      '}': () => rotatePlacement(placement, codeRotation + turn, size),
    };
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    if (e.key.startsWith('Arrow')) onCodeMove?.();
    onChange(action());
  }

  function onFieldKeyDown(f: TextField) {
    return (e: KeyboardEvent) => {
      if (e.key === 'F2' && canBreakLines(f.key)) {
        e.preventDefault();
        setEditing(fieldId(f)); // same as double-click: break the text into lines
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onFieldRemove?.(fieldId(f));
        return;
      }
      const step = e.shiftKey ? 5 : 0.5;
      const sizeStep = e.shiftKey ? 2 : 0.5;
      const patches: Record<string, Partial<TextField>> = {
        ArrowLeft: { x: f.x - step },
        ArrowRight: { x: f.x + step },
        ArrowUp: { y: f.y - step },
        ArrowDown: { y: f.y + step },
        '+': { fontSize: f.fontSize + sizeStep },
        '=': { fontSize: f.fontSize + sizeStep },
        '-': { fontSize: f.fontSize - sizeStep },
        '[': { rotation: (f.rotation ?? 0) - (e.shiftKey ? 15 : 1) },
        '{': { rotation: (f.rotation ?? 0) - (e.shiftKey ? 15 : 1) },
        ']': { rotation: (f.rotation ?? 0) + (e.shiftKey ? 15 : 1) },
        '}': { rotation: (f.rotation ?? 0) + (e.shiftKey ? 15 : 1) },
      };
      const patch = patches[e.key];
      if (!patch) return;
      e.preventDefault();
      onFieldChange?.(clampField({ ...f, ...patch }));
    };
  }

  const handlers = { onPointerMove: move, onPointerUp: end, onPointerCancel: end };
  // The canvas takes the ticket's shape (CSS fits it to the screen).
  const aspect = size.width / size.height;

  return (
    <div className="ticket-canvas-frame">
      <div
        className={`ticket-canvas${preview ? ' is-preview' : ''}`}
        ref={canvasRef}
        style={{ ['--ticket-aspect' as string]: String(aspect), background: backgroundColor ?? undefined }}
        // A click on the image selects it (when it can be edited); a click on
        // empty ticket space clears the selection.
        onPointerDown={(e) => {
          const target = e.target as Element;
          if (target.closest('.ticket-canvas-bg') && onBackgroundChange) {
            onSelect?.('background');
          } else if (target === e.currentTarget || target.closest('.ticket-canvas-clip, .ticket-canvas-empty')) {
            onSelect?.(null);
          }
        }}
      >
        {showImage ? (
          // The image may be moved past the edges; this layer clips it to the ticket.
          <div className="ticket-canvas-clip">
            <img
              className={`ticket-canvas-bg${onBackgroundChange ? ' is-editable' : ''}${backgroundRect ? ' is-placed' : ''}`}
              src={backgroundUrl!}
              alt=""
              draggable={false}
              style={
                backgroundRect
                  ? {
                      left: `${backgroundRect.x}%`,
                      top: `${backgroundRect.y}%`,
                      width: `${backgroundRect.width}%`,
                      height: `${backgroundRect.height}%`,
                      objectFit: 'fill',
                    }
                  : { objectFit: backgroundFit === 'CONTAIN' ? 'contain' : backgroundFit === 'STRETCH' ? 'fill' : 'cover' }
              }
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  const s = { width: img.naturalWidth, height: img.naturalHeight };
                  setNatural(s);
                  onImageSize?.(s);
                }
              }}
              onError={() => setImageFailed(backgroundUrl)}
            />
          </div>
        ) : (
          <div className="ticket-canvas-empty">
            <span>Your ticket starts here</span>
            {backgroundUrl ? <small>Image could not be loaded</small> : <small className="canvas-hint">Add something from the box above</small>}
          </div>
        )}

        {/* Selected background: an unclipped frame over the image - drag to move, corner dot to resize. */}
        {showImage && backgroundRect && selected === 'background' && onBackgroundChange && (
          <div
            className="bg-frame"
            role="slider"
            tabIndex={preview ? -1 : 0}
            aria-label="Background image. Drag to move, drag the corner dot to resize, arrow keys move (Shift for bigger steps)."
            aria-valuetext={`x ${backgroundRect.x.toFixed(1)}%, y ${backgroundRect.y.toFixed(1)}%, width ${backgroundRect.width.toFixed(1)}%`}
            // Only the part on the ticket: the image is clipped there, and a frame
            // reaching past the edges would make the page scroll sideways.
            style={{
              left: `${Math.max(backgroundRect.x, 0)}%`,
              top: `${Math.max(backgroundRect.y, 0)}%`,
              width: `${Math.min(backgroundRect.x + backgroundRect.width, 100) - Math.max(backgroundRect.x, 0)}%`,
              height: `${Math.min(backgroundRect.y + backgroundRect.height, 100) - Math.max(backgroundRect.y, 0)}%`,
            }}
            onPointerDown={(e) => {
              capture(e);
              drag.current = { mode: 'bgMove', startX: e.clientX, startY: e.clientY, start: backgroundRect };
            }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 5 : 1;
              const moves: Record<string, Partial<BackgroundRect>> = {
                ArrowLeft: { x: backgroundRect.x - step },
                ArrowRight: { x: backgroundRect.x + step },
                ArrowUp: { y: backgroundRect.y - step },
                ArrowDown: { y: backgroundRect.y + step },
              };
              if (!moves[e.key]) return;
              e.preventDefault();
              onBackgroundChange(clampBackground({ ...backgroundRect, ...moves[e.key] }, size, natural));
            }}
            {...handlers}
          >
            {CORNER_HANDLES.map((h) => (
              <span
                key={h.at}
                className={`dummy-code-handle handle-${h.at}`}
                aria-hidden="true"
                title="Drag to resize (the image's opposite corner stays put, shape kept)"
                onPointerDown={(e) => {
                  capture(e);
                  // The image's own fixed corner (it may be off the ticket).
                  const side = ANCHOR_SIDE[h.fixed];
                  const r = canvasRef.current!.getBoundingClientRect();
                  const fx = backgroundRect.x + (side.x > 0 ? backgroundRect.width : 0);
                  const fy = backgroundRect.y + (side.y > 0 ? backgroundRect.height : 0);
                  const ax = r.left + (fx / 100) * r.width;
                  const ay = r.top + (fy / 100) * r.height;
                  drag.current = {
                    mode: 'bgResize',
                    ax,
                    ay,
                    side,
                    startDist: Math.max(1, Math.hypot(e.clientX - ax, e.clientY - ay)),
                    start: backgroundRect,
                  };
                }}
                {...handlers}
              />
            ))}
          </div>
        )}

        {/* Ticket size: dimension lines outside the ticket, width on top, height on the left. */}
        {dimensions && (
          <>
            <div className="ticket-dim ticket-dim-w" aria-label={`Ticket width ${dimensions.width}`}>
              <span>{dimensions.width}</span>
            </div>
            <div className="ticket-dim ticket-dim-h" aria-label={`Ticket height ${dimensions.height}`}>
              <span>{dimensions.height}</span>
            </div>
          </>
        )}
        {/* Print safe area (printable tickets): keep important things inside the dashed line. */}
        {printGuides && !preview && (
          <div
            className="print-safe"
            aria-hidden="true"
            style={{ left: `${safeX}%`, right: `${safeX}%`, top: `${safeY}%`, bottom: `${safeY}%` }}
          >
            <span>Print safe area</span>
          </div>
        )}
        {/* Alignment guides while dragging. */}
        {guides.x !== null && <div className="snap-guide snap-guide-v" style={{ left: `${guides.x}%` }} aria-hidden="true" />}
        {guides.y !== null && <div className="snap-guide snap-guide-h" style={{ top: `${guides.y}%` }} aria-hidden="true" />}

        {showGrid && (
          <div
            className="ticket-grid"
            aria-hidden="true"
            style={{
              backgroundSize: `${gridStep(size, gridPx).x}% ${gridStep(size, gridPx).y}%`,
            }}
          />
        )}

        {textFields.map((f) => {
          const id = fieldId(f);
          const text = fieldText ? fieldText(f) : placeholderLabel(f.key);
          const isEditing = editing === id && selected === id;
          return (
          <div
            key={id}
            data-field-id={id}
            className={`ticket-field${selected === id && !isMulti ? ' is-selected' : ''}${isMulti && ids.includes(id) ? ' in-group' : ''}${isDynamicKey(f.key) ? ' is-dynamic' : ' is-static'}${isEditing ? ' is-editing' : ''}${flagged.has(id) && !preview ? ' has-warning' : ''}${leavingIds.includes(id) ? ' is-leaving' : ''}`}
            role="button"
            tabIndex={preview ? -1 : 0}
            aria-label={`${f.key === 'CUSTOM' ? `Label "${f.text ?? ''}"` : placeholderLabel(f.key)} text. Drag or use arrow keys to move, plus and minus to resize, square brackets to rotate, Delete to remove${canBreakLines(f.key) ? ', double-click or F2 to break it into lines' : ''}.`}
            aria-pressed={selected === fieldId(f)}
            style={{
              left: `${f.x}%`,
              top: `${f.y}%`,
              // Place the anchor at (x, y), then turn around the box's centre.
              transform: `translate(${ALIGN_SHIFT[f.align]}, -50%)${f.rotation ? ` rotate(${f.rotation}deg)` : ''}`,
              transformOrigin: '50% 50%',
              fontSize: `${f.fontSize}cqh`,
              color: f.color,
              fontWeight: f.bold ? 700 : 400,
              textAlign: f.align === 'LEFT' ? 'left' : f.align === 'CENTER' ? 'center' : 'right',
            }}
            onPointerDown={beginFieldMove(f)}
            onDoubleClick={() => {
              onSelect?.(id);
              if (canBreakLines(f.key)) setEditing(id);
            }}
            onFocus={() => !ids.includes(id) && onSelect?.(id)}
            onKeyDown={onFieldKeyDown(f)}
            {...handlers}
          >
            {isEditing ? (
              <>
                {/* Sizes the box like the printed text; the editor sits on top of it. */}
                <span className="field-text-mirror" aria-hidden="true">
                  {textWithBreaks(text, f.lineBreaks)}
                </span>
                <textarea
                  className="field-text-edit"
                  value={textWithBreaks(text, f.lineBreaks)}
                  wrap="off"
                  spellCheck={false}
                  autoFocus
                  aria-label="Line breaks only: Enter breaks the line here, Backspace joins lines, Escape finishes."
                  onPointerDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation(); // keep the field's own keys (Delete, arrows...) out of the editor
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditing(null);
                      (e.currentTarget.parentElement as HTMLElement).focus();
                    }
                  }}
                  onChange={(e) => {
                    // Only line breaks may change; anything else is refused (the text snaps back).
                    const breaks = breaksFromEdit(text, e.target.value);
                    if (breaks) onFieldChange?.(clampField({ ...f, lineBreaks: breaks }));
                  }}
                  onBlur={() => setEditing(null)}
                />
              </>
            ) : (
              (() => {
                const value = preview ? fieldValue?.(f) : null;
                if (value == null) return printedLines(text, f.lineBreaks);
                // Sample value inside the reserved box (the X's, kept invisible for its size),
                // placed by the fill direction - the same way the ticket prints it.
                return (
                  <>
                    <span className="field-reserve" aria-hidden="true">
                      {text}
                    </span>
                    <span className={`field-value field-value-${f.align.toLowerCase()}`}>{value}</span>
                  </>
                );
              })()
            )}
            {isDynamicKey(f.key) && <FillArrow align={f.align} />}
            {/* "!" marker: this text has a warning (overlap, off the ticket, outside the safe area). */}
            {flagged.has(id) && !preview && (
              <span className="code-warning field-warning" aria-hidden="true">
                !
              </span>
            )}
            {selected === id && !isMulti && (
              <span
                className="field-rotate"
                aria-hidden="true"
                title="Drag to rotate (Shift snaps to 15°)"
                style={{ left: '50%' }}
                onPointerDown={(e) => {
                  capture(e);
                  onSelect?.(fieldId(f));
                  // Turning around the centre keeps it in place, so it's the middle of the on-screen box.
                  const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                  drag.current = { mode: 'fieldRotate', start: f, cx: box.left + box.width / 2, cy: box.top + box.height / 2 };
                }}
                {...handlers}
              />
            )}
          </div>
          );
        })}

        {showCode && (
          <div
            className={`dummy-code dummy-code-${codeType.toLowerCase()}${selected === 'code' && !isMulti ? ' is-selected' : ''}${isMulti && ids.includes('code') ? ' in-group' : ''}${codeWarnings.length && !preview ? ' has-warning' : ''}${leavingIds.includes('code') ? ' is-leaving' : ''}`}
            role="slider"
            tabIndex={preview ? -1 : 0}
            aria-label={`${label} position. Arrow keys move, plus and minus resize${rotatable ? ', square brackets rotate' : ''}, hold Shift for bigger steps, Delete removes.`}
            aria-valuetext={`x ${codeX.toFixed(1)}%, y ${codeY.toFixed(1)}%, width ${codeWidth.toFixed(1)}%${rotatable ? `, rotated ${codeRotation} degrees` : ''}`}
            style={{
              left: `${codeX}%`,
              top: `${codeY}%`,
              width: `${codeWidth}%`,
              aspectRatio: String(SHAPES[codeType].aspect),
              transform: codeRotation ? `rotate(${codeRotation}deg)` : undefined,
            }}
            onPointerDown={beginMove}
            onFocus={() => !ids.includes('code') && onSelect?.('code')}
            onKeyDown={onKeyDown}
            {...handlers}
          >
            {codeType === 'QR' ? <DummyQrGraphic /> : <DummyBarcodeGraphic />}
            {/* Marker only - the full list is behind the warnings icon in the toolbar. */}
            {codeWarnings.length > 0 && !preview && (
              <span className="code-warning" aria-hidden="true">
                !
              </span>
            )}
            {/* A round dot on every corner: drag one to resize, the opposite corner stays put. */}
            {CORNER_HANDLES.map((h) => (
              <span
                key={h.at}
                className={`dummy-code-handle handle-${h.at}`}
                aria-hidden="true"
                title="Drag to resize (the opposite corner stays put)"
                onPointerDown={beginResize(h.fixed)}
                {...handlers}
              />
            ))}
            {rotatable && (
              <span
                className="dummy-code-rotate"
                aria-hidden="true"
                title="Drag to rotate (Shift snaps to 15°)"
                onPointerDown={beginRotate}
                {...handlers}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Under a dynamic field: where each ticket's value starts (dot) and which way
 * it fills the X box (arrowhead). Turns with the field; never takes space.
 */
function FillArrow({ align }: { align: TextField['align'] }) {
  return (
    <span className={`fill-arrow fill-arrow-${align.toLowerCase()}`} aria-hidden="true">
      {align === 'LEFT' && (
        <>
          <i className="fill-arrow-dot" />
          <i className="fill-arrow-line" />
          <i className="fill-arrow-head is-right" />
        </>
      )}
      {align === 'CENTER' && (
        <>
          <i className="fill-arrow-head is-left" />
          <i className="fill-arrow-line" />
          <i className="fill-arrow-dot" />
          <i className="fill-arrow-line" />
          <i className="fill-arrow-head is-right" />
        </>
      )}
      {align === 'RIGHT' && (
        <>
          <i className="fill-arrow-head is-left" />
          <i className="fill-arrow-line" />
          <i className="fill-arrow-dot" />
        </>
      )}
    </span>
  );
}

/** A fixed, fake QR pattern - only shows where the real code will go. */
function DummyQrGraphic() {
  const n = 21;
  const cells: JSX.Element[] = [];
  const inFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (inFinder(r, c)) continue;
      // Deterministic pseudo-random fill.
      if (((r * 31 + c * 17 + r * c) % 7) % 3 === 0) {
        cells.push(<rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" />);
      }
    }
  }
  const finder = (x: number, y: number) => (
    <g key={`f${x}${y}`}>
      <rect x={x} y={y} width="7" height="7" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  );
  return (
    <svg viewBox="-1 -1 23 23" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="-1" y="-1" width="23" height="23" fill="#fff" />
      <g fill="#111">
        {finder(0, 0)}
        {finder(n - 7, 0)}
        {finder(0, n - 7)}
        {cells}
      </g>
    </svg>
  );
}

/** A fixed, fake 1D barcode (3:1) with a number underneath. */
function DummyBarcodeGraphic() {
  // Deterministic bar widths (1-3 units) alternating bar / gap.
  const pattern = [2, 1, 1, 2, 3, 1, 1, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 1, 1, 3, 1, 2, 2, 1, 1, 1, 3, 1, 2, 1, 1, 2, 1, 1];
  const quiet = 6; // blank margin either side, like a real barcode
  const width = pattern.reduce((sum, w) => sum + w, 0) + quiet * 2;
  const height = width / 3;
  const barHeight = height - 9; // leave room for the number underneath
  const bars: JSX.Element[] = [];
  let x = quiet;
  pattern.forEach((w, i) => {
    if (i % 2 === 0) bars.push(<rect key={i} x={x} y={2} width={w} height={barHeight} />);
    x += w;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" shapeRendering="crispEdges">
      <rect width={width} height={height} fill="#fff" />
      <g fill="#111">{bars}</g>
      <text
        x={width / 2}
        y={height - 1.5}
        textAnchor="middle"
        fontSize="4.5"
        fontFamily="ui-monospace, monospace"
        fill="#111"
      >
        0 123456 789012
      </text>
    </svg>
  );
}
