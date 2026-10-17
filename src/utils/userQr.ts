import jsQR from 'jsqr';
import QRCode from 'qrcode';

/**
 * The "My QR" code of a user: it carries their user ID, so a ticket owner can transfer a ticket to them by
 * uploading the picture instead of typing a long ID. The prefix makes sure a random QR (a website, a ticket's
 * own code) is never mistaken for a person.
 */
const PREFIX = 'ticketing:user:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function userQrPayload(userId: string): string {
  return PREFIX + userId;
}

/** The user ID inside a scanned payload, or null if it is not one of our user QR codes. */
export function parseUserQr(text: string): string | null {
  const t = text.trim();
  if (!t.startsWith(PREFIX)) return null;
  const id = t.slice(PREFIX.length);
  return UUID.test(id) ? id.toLowerCase() : null;
}

/** A PNG data URL of the user's QR code. */
export function userQrDataUrl(userId: string, size = 320): Promise<string> {
  return QRCode.toDataURL(userQrPayload(userId), { width: size, margin: 2, errorCorrectionLevel: 'M' });
}

/** Reads the QR code in an image file (a screenshot or photo works). Throws a readable error if there is none. */
export async function readQrFromImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image of the QR code.');
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('That image could not be opened.');
  // Scale big photos down: decoding is faster and QR codes survive it.
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser cannot read images.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(data, width, height);
  if (!code) throw new Error('No QR code found in that image. Try a clearer or larger picture.');
  return code.data;
}
