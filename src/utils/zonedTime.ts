/** Wall-clock dates and times in a given timezone (an event's), independent of the browser's own. */

/** "2026-11-15" + "18:14" as wall-clock time in `timeZone` -> the UTC instant, as ISO. */
export function zonedToIso(date: string, time: string, timeZone: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // The offset depends on the instant (daylight saving), so look it up at the first guess and correct once.
  let at = wall - utcOffsetMinutes(timeZone, new Date(wall)) * 60_000;
  at = wall - utcOffsetMinutes(timeZone, new Date(at)) * 60_000;
  return new Date(at).toISOString();
}

/** The zone's offset from UTC at an instant, in minutes (daylight saving included). */
export function utcOffsetMinutes(timeZone: string, at: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** 480 -> "+08:00", -210 -> "-03:30", 0 -> "+00:00". */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** An instant as the wall-clock date ("YYYY-MM-DD") and time ("HH:mm", 24-hour) in `timeZone`. */
export function zonedParts(iso: string, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}
