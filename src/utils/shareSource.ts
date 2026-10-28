/** How this browser tab reached an event: through a shared link or a scanned QR code. Kept per event for the tab's life. */
type ShareSource = 'LINK' | 'QR';
const key = (eventId: string) => `shareSource.${eventId}`;

export function rememberShareSource(eventId: string, source: ShareSource): void {
  try {
    sessionStorage.setItem(key(eventId), source);
  } catch {
    // storage blocked: the buy click just won't be attributed
  }
}

export function shareSourceOf(eventId: string): ShareSource | null {
  try {
    const v = sessionStorage.getItem(key(eventId));
    return v === 'LINK' || v === 'QR' ? v : null;
  } catch {
    return null;
  }
}
