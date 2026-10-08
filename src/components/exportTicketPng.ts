import type { CodePlacement, TextField } from '../api/types';
import type { BackgroundRect, TicketSize } from './TicketCanvas';

/** Same font as the designer's text fields, so the export matches the screen. */
const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const LINE_HEIGHT = 1.15;
/** Text boxes have 0.15em padding left and right (see .ticket-field). */
const PAD_EM = 0.15;
/** Width : height of each code type. */
const CODE_ASPECT = { QR: 1, BARCODE: 3 } as const;

/** One text field as it should appear: its lines, or a value inside a reserved box. */
export interface ExportText {
  field: TextField;
  /** The lines drawn (already split at line breaks and trimmed). */
  lines: string[];
  /**
   * Dynamic fields in preview: the sample value, placed inside the box the
   * `lines` (the X's / own placeholder) would take - like the printed ticket.
   */
  value?: string;
}

export interface ExportDesign {
  size: TicketSize;
  /** Fill color; null = white. */
  backgroundColor: string | null;
  backgroundUrl: string | null;
  /** Where the image goes (% of the ticket); null = cover the whole ticket. */
  backgroundRect: BackgroundRect | null;
  texts: ExportText[];
  /** The code, if it's on the ticket, and its artwork (the designer's SVG). */
  code: { placement: CodePlacement; svg: string | null } | null;
}

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${src}`));
    img.src = src;
  });
}

/** Draw the background image like the designer: placed rect, or cover when unknown. */
function drawBackground(ctx: CanvasRenderingContext2D, img: HTMLImageElement, d: ExportDesign) {
  const { width: W, height: H } = d.size;
  let r = d.backgroundRect;
  if (!r) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = (img.naturalWidth * s * 100) / W;
    const h = (img.naturalHeight * s * 100) / H;
    r = { x: (100 - w) / 2, y: (100 - h) / 2, width: w, height: h };
  }
  ctx.drawImage(img, (r.x / 100) * W, (r.y / 100) * H, (r.width / 100) * W, (r.height / 100) * H);
}

/**
 * A text field the way the designer places it: the box's anchor edge (left,
 * centre or right) at x, the block's vertical centre at y, turned around the
 * box's centre.
 */
function drawText(ctx: CanvasRenderingContext2D, t: ExportText, size: TicketSize) {
  const f = t.field;
  const fontPx = (f.fontSize / 100) * size.height;
  ctx.font = `${f.bold ? 700 : 400} ${fontPx}px ${FONT_FAMILY}`;
  const pad = PAD_EM * fontPx;
  const lineH = LINE_HEIGHT * fontPx;
  const textW = Math.max(0, ...t.lines.map((l) => ctx.measureText(l).width));
  const boxW = textW + pad * 2;
  const boxH = lineH * t.lines.length;
  const ax = (f.x / 100) * size.width;
  const left = f.align === 'LEFT' ? ax : f.align === 'CENTER' ? ax - boxW / 2 : ax - boxW;
  const top = (f.y / 100) * size.height - boxH / 2;

  ctx.save();
  ctx.translate(left + boxW / 2, top + boxH / 2);
  if (f.rotation) ctx.rotate(((f.rotation ?? 0) * Math.PI) / 180);
  ctx.translate(-boxW / 2, -boxH / 2);
  ctx.fillStyle = f.color;
  ctx.textBaseline = 'middle';
  if (t.value !== undefined) {
    // Sample value inside the reserved box, from the fill direction's edge.
    ctx.textAlign = f.align === 'LEFT' ? 'left' : f.align === 'CENTER' ? 'center' : 'right';
    const x = f.align === 'LEFT' ? pad : f.align === 'CENTER' ? boxW / 2 : boxW - pad;
    ctx.fillText(t.value, x, lineH / 2);
  } else {
    ctx.textAlign = f.align === 'LEFT' ? 'left' : f.align === 'CENTER' ? 'center' : 'right';
    const x = f.align === 'LEFT' ? pad : f.align === 'CENTER' ? boxW / 2 : boxW - pad;
    t.lines.forEach((line, i) => ctx.fillText(line, x, lineH * i + lineH / 2));
  }
  ctx.restore();
}

async function drawCode(ctx: CanvasRenderingContext2D, code: NonNullable<ExportDesign['code']>, size: TicketSize) {
  const p = code.placement;
  const w = (p.codeWidth / 100) * size.width;
  const h = w / CODE_ASPECT[p.codeType];
  const x = (p.codeX / 100) * size.width;
  const y = (p.codeY / 100) * size.height;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (p.codeRotation) ctx.rotate((p.codeRotation * Math.PI) / 180);
  if (code.svg) {
    const markup = code.svg.includes('xmlns=') ? code.svg : code.svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`, false);
    ctx.imageSmoothingEnabled = false; // crisp modules, like the designer
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

/**
 * The design as a PNG at the ticket's real size. If the background image
 * can't be read (another site that blocks it), the PNG is made without it and
 * `skippedImage` says so.
 */
export async function exportTicketPng(d: ExportDesign): Promise<{ blob: Blob; skippedImage: boolean }> {
  const render = async (withImage: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(d.size.width);
    canvas.height = Math.round(d.size.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = d.backgroundColor ?? '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (withImage && d.backgroundUrl) {
      const img = await loadImage(d.backgroundUrl, !d.backgroundUrl.startsWith('/') && !d.backgroundUrl.startsWith(location.origin));
      drawBackground(ctx, img, d);
    }
    await document.fonts?.ready;
    for (const t of d.texts) drawText(ctx, t, d.size);
    // The code last - always on top, as it prints.
    if (d.code) await drawCode(ctx, d.code, d.size);
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the PNG'))), 'image/png'),
    );
  };
  if (!d.backgroundUrl) return { blob: await render(false), skippedImage: false };
  try {
    return { blob: await render(true), skippedImage: false };
  } catch {
    // Unreadable image (blocked by its site, or it failed to load): export the rest.
    return { blob: await render(false), skippedImage: true };
  }
}

/** Save a blob as a file (a normal browser download). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
