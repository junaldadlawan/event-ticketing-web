import QRCode from 'qrcode';
import { assetUrl } from '../api/client';
import type { Event } from '../api/types';
import { formatDateTime } from './format';

// A phone screen's shape at 720x1280 (HD): sharp on a phone, and still small as a JPEG at quality 0.6.
const W = 720;
const H = 1120;
const PICTURE_H = 480;
const MAX_BYTES = 50 * 1024;
const BRAND_HUE = 262; // the app's violet, used when the event has no picture

type IconDrawer = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => void;

/** Draws a 24x24 SVG path filled at the given spot and size. */
const filled = (d: string, rule: CanvasFillRule = 'nonzero'): IconDrawer => {
  const path = new Path2D(d);
  return (ctx, x, y, size, color) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = color;
    ctx.fill(path, rule);
    ctx.restore();
  };
};
const FACEBOOK = filled(
  'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  'evenodd',
);
const TIKTOK = filled(
  'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
);
const INSTAGRAM: IconDrawer = (ctx, x, y, size, color) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(2, 2, 20, 20, 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(12, 12, 4.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(17.5, 6.5, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** Wraps `text` into lines no wider than `max` pixels with the font already set on `ctx`; at most `limit` lines (the last ends with "…"). */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, limit: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= max || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > limit) {
    lines.length = limit;
    lines[limit - 1] = lines[limit - 1]!.replace(/\s*\S*$/, '') + '…';
  }
  return lines;
}

/** The event's first picture as an image the canvas may read, or null if there is none or it cannot be read. */
async function loadPicture(event: Event): Promise<HTMLImageElement | null> {
  const src = assetUrl(event.images?.find((u) => u && u.trim()));
  if (!src) return null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    await img.decode();
    // A picture from another site without permission would taint the canvas; reading one pixel finds out now.
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.drawImage(img, 0, 0, 1, 1);
    probe.getImageData(0, 0, 1, 1);
    return img;
  } catch {
    return null;
  }
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** The picture's main color as [hue, saturation]: the most common hue, with colorful areas counting more than grey ones. */
function dominantColor(img: HTMLImageElement): [number, number] {
  const size = 32;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const weight = new Array<number>(36).fill(0);
  const sat = new Array<number>(36).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i]!, data[i + 1]!, data[i + 2]!);
    if (l < 0.08 || l > 0.95) continue; // near black or white says nothing about the picture's color
    const bucket = Math.floor(h / 10) % 36;
    weight[bucket]! += s + 0.1;
    sat[bucket]! += s;
  }
  let best = 0;
  for (let i = 1; i < 36; i++) if (weight[i]! > weight[best]!) best = i;
  if (weight[best] === 0) return [BRAND_HUE, 0.5];
  const count = Math.max(1, Math.round(weight[best]!));
  return [best * 10 + 5, Math.min(0.75, Math.max(0.3, sat[best]! / count))];
}

/**
 * A phone-sized poster of the event as a JPEG: its picture on top, then the title, when and where, and a QR
 * code of the event's address. The layout colors come from the picture's main color, so the poster matches it.
 */
export async function eventPoster(event: Event, url: string): Promise<Blob> {
  const picture = await loadPicture(event);
  const [hue, sat] = picture ? dominantColor(picture) : [BRAND_HUE, 0.7];
  const hsl = (s: number, l: number) => `hsl(${hue} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
  const background = hsl(Math.min(sat, 0.6), 0.14);
  const band = hsl(Math.min(sat + 0.1, 0.85), 0.4);
  const accent = hsl(Math.min(sat + 0.1, 0.85), 0.8);
  const soft = hsl(Math.min(sat, 0.5), 0.92);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const font = (px: number, weight = 400) => `${weight} ${px}px Archivo, system-ui, sans-serif`;

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);

  if (picture) {
    // Fill the top area with the picture (cropped to fit), then fade it into the background.
    const scale = Math.max(W / picture.width, PICTURE_H / picture.height);
    const w = picture.width * scale;
    const h = picture.height * scale;
    ctx.drawImage(picture, (W - w) / 2, (PICTURE_H - h) / 2, w, h);
    const fade = ctx.createLinearGradient(0, PICTURE_H * 0.45, 0, PICTURE_H);
    fade.addColorStop(0, 'transparent');
    fade.addColorStop(1, background);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, PICTURE_H);
  } else {
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, W, 16);
  }

  const left = 56;
  let y = picture ? 400 : 90;
  ctx.textBaseline = 'top';
  ctx.fillStyle = accent;
  ctx.font = font(28, 700);
  ctx.fillText(event.category, left, y);

  ctx.fillStyle = '#ffffff';
  ctx.font = font(56, 800);
  y += 46;
  for (const line of wrap(ctx, event.title, W - left * 2, 2)) {
    ctx.fillText(line, left, y);
    y += 62;
  }

  y += 12;
  ctx.fillStyle = soft;
  ctx.font = font(30, 500);
  for (const line of wrap(ctx, formatDateTime(event.startAt, event.timezone), W - left * 2, 1)) {
    ctx.fillText(line, left, y);
    y += 40;
  }
  ctx.fillStyle = accent;
  for (const line of wrap(ctx, event.venue ? event.venue.name : 'Online', W - left * 2, 1)) {
    ctx.fillText(line, left, y);
    y += 40;
  }

  const qr = new Image();
  qr.src = await QRCode.toDataURL(url, { width: 216, margin: 1, errorCorrectionLevel: 'M' });
  await qr.decode();
  const card = 240;
  const cx = (W - card) / 2;
  const cy = 680;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(cx, cy, card, card, 24);
  ctx.fill();
  ctx.drawImage(qr, cx + 12, cy + 12, 216, 216);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(28, 700);
  ctx.fillText('Scan to get tickets', W / 2, cy + card + 22);

  // Footer: a hairline, the socials on the left, the brand and website on the right.
  const footer = H - 118;
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(left, footer, W - left * 2, 2);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'left';
  const size = 36;
  const gap = 18;
  const iconY = footer + 26;
  [FACEBOOK, INSTAGRAM, TIKTOK].forEach((draw, i) => draw(ctx, left + i * (size + gap), iconY, size, soft));
  ctx.fillStyle = soft;
  ctx.font = font(22, 600);
  ctx.fillText('@eventko', left, iconY + size + 10);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(34, 800);
  ctx.fillText('eventKo', W - left, iconY);
  ctx.fillStyle = accent;
  ctx.font = font(22, 500);
  ctx.fillText(window.location.host, W - left, iconY + size + 10);

  // Keep the file under 50 KB: lower the quality step by step until it fits.
  const toBlob = (q: number) =>
    new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not make the poster'))), 'image/jpeg', q));
  let blob = await toBlob(0.6);
  for (const q of [0.5, 0.42, 0.34, 0.26, 0.2]) {
    if (blob.size <= MAX_BYTES) break;
    blob = await toBlob(q);
  }
  return blob;
}
