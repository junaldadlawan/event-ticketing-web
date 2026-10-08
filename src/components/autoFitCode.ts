import type { BackgroundRect, TicketSize } from './TicketCanvas';

/** Where the code goes (% of the ticket), or why it can't: a blank box too small for a scannable code. */
export type AutoFitResult =
  | { codeX: number; codeY: number; codeWidth: number }
  | { tooSmall: true; boxPx: number; needPx: number }
  | { noBox: true }
  | null;

/** Rectangles in % of the ticket (x, y = top-left). */
export interface PctRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Analysis grid: this many square cells across the ticket. */
const GRID_COLUMNS = 240;
/** A brightness jump between neighbouring cells bigger than this is an edge (0-255). */
const EDGE_THRESHOLD = 22;
/** Margin kept inside the blank area, each side, as a share of its size (room for a border / quiet zone). */
const INSET = 0.02;
/** The smallest extra margin when a box only just fits the code (the area already keeps clear of its border). */
const MIN_INSET = 0;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('/') && !src.startsWith(location.origin) && !src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The background image could not be loaded'));
    img.src = src;
  });
}

/**
 * Find the largest blank (edge-free) area of the background image with the
 * code's shape (`aspect` = width / height), and return where the code should
 * go: centred in it with a small margin, in % of the ticket. Areas outside the
 * image and under `avoid` (text fields) don't count. Of equally big areas, the
 * one nearest `near` (the code's current centre, %) wins. Null = nothing blank
 * is big enough for `minWidthPct`.
 */
export async function findBlankArea(opts: {
  imageUrl: string;
  /** Where the image sits on the ticket (%); null = covers the ticket. */
  imageRect: BackgroundRect | null;
  ticket: TicketSize;
  aspect: number;
  minWidthPct: number;
  avoid: PctRect[];
  near: { x: number; y: number };
}): Promise<AutoFitResult> {
  const { ticket, aspect } = opts;
  const img = await loadImage(opts.imageUrl);
  const gw = GRID_COLUMNS;
  const cell = ticket.width / gw; // ticket px per cell (square cells)
  const gh = Math.max(1, Math.round(ticket.height / cell));

  // Draw the image where it sits on the ticket, at grid resolution.
  let r = opts.imageRect;
  if (!r) {
    const s = Math.max(ticket.width / img.naturalWidth, ticket.height / img.naturalHeight);
    const w = ((img.naturalWidth * s) / ticket.width) * 100;
    const h = ((img.naturalHeight * s) / ticket.height) * 100;
    r = { x: (100 - w) / 2, y: (100 - h) / 2, width: w, height: h };
  }
  const canvas = document.createElement('canvas');
  canvas.width = gw;
  canvas.height = gh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, (r.x / 100) * gw, (r.y / 100) * gh, (r.width / 100) * gw, (r.height / 100) * gh);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, gw, gh).data;
  } catch {
    throw new Error('The background image can’t be analysed (its site blocks it)');
  }

  // Busy cells: edges in the image, outside the image, or under text.
  const lum = new Float32Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) {
    lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  const busy = new Uint8Array(gw * gh);
  const ix0 = Math.max(0, Math.floor((r.x / 100) * gw));
  const iy0 = Math.max(0, Math.floor((r.y / 100) * gh));
  const ix1 = Math.min(gw, Math.ceil(((r.x + r.width) / 100) * gw));
  const iy1 = Math.min(gh, Math.ceil(((r.y + r.height) / 100) * gh));
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      if (x < ix0 || x >= ix1 || y < iy0 || y >= iy1 || data[i * 4 + 3] < 128) {
        busy[i] = 1;
        continue;
      }
      const right = x + 1 < gw ? Math.abs(lum[i] - lum[i + 1]) : 0;
      const down = y + 1 < gh ? Math.abs(lum[i] - lum[i + gw]) : 0;
      // An edge sits between two cells: mark both sides. Marking only this cell made the blank
      // area keep one cell less clearance on its right / bottom border than on its left / top,
      // which pulled the code off-centre (up and left) in every box.
      if (right > EDGE_THRESHOLD) busy[i] = busy[i + 1] = 1;
      if (down > EDGE_THRESHOLD) busy[i] = busy[i + gw] = 1;
    }
  }
  for (const a of opts.avoid) {
    const x0 = Math.max(0, Math.floor((a.x / 100) * gw));
    const y0 = Math.max(0, Math.floor((a.y / 100) * gh));
    const x1 = Math.min(gw, Math.ceil(((a.x + a.width) / 100) * gw));
    const y1 = Math.min(gh, Math.ceil(((a.y + a.height) / 100) * gh));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) busy[y * gw + x] = 1;
  }
  // Grow busy cells by one, so the area keeps clear of lines and borders.
  const grown = new Uint8Array(busy);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (!busy[y * gw + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) grown[ny * gw + nx] = 1;
        }
      }
    }
  }

  const nearX = (opts.near.x / 100) * gw;
  const nearY = (opts.near.y / 100) * gh;

  /**
   * The biggest blank window with the code's shape where `blocked` is 0 (a
   * smaller one always fits if a bigger one does, so binary search on size);
   * of equal ones, the nearest to `near`. Null = none.
   */
  function biggestWindow(blocked: Uint8Array) {
    const sat = new Int32Array((gw + 1) * (gh + 1)); // summed-area table: any window's count in O(1)
    for (let y = 1; y <= gh; y++) {
      for (let x = 1; x <= gw; x++) {
        sat[y * (gw + 1) + x] =
          blocked[(y - 1) * gw + (x - 1)] + sat[(y - 1) * (gw + 1) + x] + sat[y * (gw + 1) + x - 1] - sat[(y - 1) * (gw + 1) + x - 1];
      }
    }
    const blockedIn = (x: number, y: number, w: number, h: number) =>
      sat[(y + h) * (gw + 1) + (x + w)] - sat[y * (gw + 1) + (x + w)] - sat[(y + h) * (gw + 1) + x] + sat[y * (gw + 1) + x];
    const windows = (h: number) => {
      const w = Math.round(h * aspect);
      const found: { x: number; y: number; w: number; h: number }[] = [];
      if (w < 1 || w > gw || h > gh) return found;
      for (let y = 0; y + h <= gh; y++) for (let x = 0; x + w <= gw; x++) if (blockedIn(x, y, w, h) === 0) found.push({ x, y, w, h });
      return found;
    };
    let lo = 0;
    let hi = Math.min(gh, Math.floor(gw / aspect));
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (windows(mid).length) lo = mid;
      else hi = mid - 1;
    }
    if (lo === 0) return null;
    return windows(lo).reduce((a, b) =>
      Math.hypot(a.x + a.w / 2 - nearX, a.y + a.h / 2 - nearY) <= Math.hypot(b.x + b.w / 2 - nearX, b.y + b.h / 2 - nearY) ? a : b,
    );
  }

  // Blank regions: groups of connected blank cells, each bounded by lines.
  const region = new Int32Array(gw * gh).fill(-1);
  const regions: { cells: number[]; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let start = 0; start < gw * gh; start++) {
    if (grown[start] || region[start] >= 0) continue;
    const id = regions.length;
    const r2 = { cells: [] as number[], x0: gw, y0: gh, x1: 0, y1: 0 };
    const stack = [start];
    region[start] = id;
    while (stack.length) {
      const i = stack.pop()!;
      r2.cells.push(i);
      const x = i % gw;
      const y = (i - x) / gw;
      r2.x0 = Math.min(r2.x0, x);
      r2.y0 = Math.min(r2.y0, y);
      r2.x1 = Math.max(r2.x1, x);
      r2.y1 = Math.max(r2.y1, y);
      const next = [x > 0 ? i - 1 : -1, x + 1 < gw ? i + 1 : -1, y > 0 ? i - gw : -1, y + 1 < gh ? i + gw : -1];
      for (const n of next) {
        if (n >= 0 && !grown[n] && region[n] < 0) {
          region[n] = id;
          stack.push(n);
        }
      }
    }
    regions.push(r2);
  }

  // Box-like regions first - an outlined "scan here" box: nearly filled, and
  // shaped like the code. The open background around text and art isn't.
  const boxes = regions.filter((g) => {
    const bw = g.x1 - g.x0 + 1;
    const bh = g.y1 - g.y0 + 1;
    const shape = bw / bh / aspect;
    return g.cells.length / (bw * bh) >= 0.85 && shape >= 0.7 && shape <= 1.45;
  });
  let best: { x: number; y: number; w: number; h: number } | null = null;
  for (const g of boxes) {
    const blocked = new Uint8Array(gw * gh).fill(1);
    for (const i of g.cells) blocked[i] = 0;
    let w = biggestWindow(blocked);
    if (w) {
      // Equal-size windows slide around inside a box that isn't exactly the code's shape; put it
      // where the free space around it is equal on both sides, up/down and left/right, instead of
      // wherever is nearest the code's old spot. Free space is measured to the box's own border
      // (the nearest blocked cell along the window's rows / columns), so a thicker border or
      // rounded corners on one side don't pull the code off-centre. Two passes: moving one way
      // changes which cells the other measurement sees.
      const free = (x: number, y: number, dx: number, dy: number) => {
        let n = 0;
        for (;;) {
          const cx = dx === 0 ? x : dx < 0 ? x - 1 - n : x + w!.w + n;
          const cy = dy === 0 ? y : dy < 0 ? y - 1 - n : y + w!.h + n;
          if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) return n;
          for (let k = 0; k < (dx === 0 ? w!.w : w!.h); k++) {
            if (blocked[(dx === 0 ? cy : cy + k) * gw + (dx === 0 ? cx + k : cx)]) return n;
          }
          n++;
        }
      };
      let { x, y } = w;
      for (let pass = 0; pass < 2; pass++) {
        x += Math.trunc((free(x, y, 1, 0) - free(x, y, -1, 0)) / 2);
        y += Math.trunc((free(x, y, 0, 1) - free(x, y, 0, -1)) / 2);
      }
      w = { ...w, x, y };
    }
    if (w && (!best || w.h > best.h)) best = w;
  }
  // A box that is too small for the code to scan: say so rather than putting it
  // somewhere else. No box at all: the biggest blank area anywhere.
  const minCells = ((opts.minWidthPct / 100) * gw) / (1 - 2 * MIN_INSET);
  if (best && best.w < minCells) {
    return { tooSmall: true, boxPx: Math.round(best.w * cell), needPx: Math.round((opts.minWidthPct / 100) * ticket.width) };
  }
  // No outlined box at all: say so rather than guessing a spot in the open background.
  if (!best) return { noBox: true };

  // Ticket px: the code centred in the area with a margin - the full one when
  // there's room, less (down to MIN_INSET) when only the minimum size fits.
  const areaW = best.w * cell;
  const areaH = best.h * cell;
  const minW = (opts.minWidthPct / 100) * ticket.width;
  const codeW = Math.min(Math.max(areaW * (1 - 2 * INSET), minW), areaW * (1 - 2 * MIN_INSET));
  if (codeW < minW - 1e-6) return null;
  const codeH = codeW / aspect;
  const left = best.x * cell + (areaW - codeW) / 2;
  const top = best.y * cell + (areaH - codeH) / 2;
  return { codeX: (left / ticket.width) * 100, codeY: (top / ticket.height) * 100, codeWidth: (codeW / ticket.width) * 100 };
}
